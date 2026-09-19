/**
 * Authentication and authorization module
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { query, queryOne, execute } from '../database/schema.mjs';
import { Errors } from '../agent/error-handling.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token 有效期
const SESSION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * Hash password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: randomUUID() }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Register a new user
 */
export async function registerUser({ email, password, username }) {
  // Validate input
  if (!email || !email.includes('@')) {
    throw Errors.invalidInput('邮箱', '邮箱格式不正确');
  }

  if (!password || password.length < 6) {
    throw Errors.invalidInput('密码', '密码至少 6 个字符');
  }

  // Check if user exists
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    throw Errors.invalidInput('邮箱', '该邮箱已被注册');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const userId = randomUUID();
  const now = Date.now();

  await execute(
    `INSERT INTO users (id, email, password_hash, username, quota_balance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, email, passwordHash, username || null, 100, now, now]
  );

  return {
    userId,
    email,
    username,
  };
}

/**
 * Login user
 */
export async function loginUser({ email, password }) {
  // Find user
  const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);

  if (!user) {
    throw Errors.authenticationRequired('邮箱或密码错误');
  }

  if (user.status !== 'active') {
    throw Errors.permissionDenied('账号已被封禁');
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw Errors.authenticationRequired('邮箱或密码错误');
  }

  // Generate token
  const token = generateToken(user);
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_EXPIRES_MS;

  // Save session
  await execute(
    `INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, token, expiresAt, now, now]
  );

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      quotaBalance: user.quota_balance,
      isVip: user.is_vip === 1 || Boolean(user.is_vip),
      vipExpiresAt: user.vip_expires_at || 0,
      concurrencyLimit: user.concurrency_limit || 1,
    },
  };
}

/**
 * Logout user
 */
export async function logoutUser(token) {
  await execute('DELETE FROM sessions WHERE token = ?', [token]);
}

/**
 * Refresh token
 */
export async function refreshToken(oldToken) {
  const session = await queryOne('SELECT * FROM sessions WHERE token = ?', [oldToken]);

  if (!session || session.expires_at < Date.now()) {
    throw Errors.authenticationRequired();
  }

  const user = await queryOne('SELECT * FROM users WHERE id = ?', [session.user_id]);

  if (!user || user.status !== 'active') {
    throw Errors.permissionDenied('账号不可用');
  }

  // Generate new token
  const newToken = generateToken(user);
  const now = Date.now();
  const expiresAt = now + SESSION_EXPIRES_MS;

  // Update session
  await execute(
    `UPDATE sessions SET token = ?, expires_at = ?, last_used_at = ? WHERE id = ?`,
    [newToken, expiresAt, now, session.id]
  );

  return {
    token: newToken,
    expiresAt,
  };
}

/**
 * Get user from token
 */
export async function getUserFromToken(token) {
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  // Check session
  const session = await queryOne('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session || session.expires_at < Date.now()) {
    return null;
  }

  // Get user
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [decoded.userId]);

  // Update last used
  await execute('UPDATE sessions SET last_used_at = ? WHERE id = ?', [Date.now(), session.id]);

  if (!user || user.status !== 'active') {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    quotaBalance: user.quota_balance,
    isVip: user.is_vip === 1 || Boolean(user.is_vip),
    vipExpiresAt: user.vip_expires_at || 0,
    concurrencyLimit: user.concurrency_limit || 1,
  };
}

/**
 * Express middleware: Require authentication
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: '需要身份验证',
      category: 'permission',
    });
  }

  const token = authHeader.slice(7);

  getUserFromToken(token)
    .then((user) => {
      if (!user) {
        return res.status(401).json({
          ok: false,
          error: 'Token 无效或已过期',
          category: 'permission',
        });
      }

      req.user = user;
      req.token = token;
      next();
    })
    .catch((error) => {
      console.error('Auth error:', error);
      res.status(500).json({
        ok: false,
        error: '认证失败',
        category: 'system',
      });
    });
}

/**
 * Express middleware: Require specific role
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: '需要身份验证',
        category: 'permission',
      });
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: '权限不足',
        category: 'permission',
      });
    }

    next();
  };
}

/**
 * Check user quota balance
 */
export async function checkUserBalance(userId) {
  const user = await queryOne('SELECT quota_balance FROM users WHERE id = ?', [userId]);
  return user ? user.quota_balance : 0;
}

/**
 * Deduct user quota
 */
export async function deductUserQuota(userId, amount, metadata = {}) {
  // Check balance
  const user = await queryOne('SELECT quota_balance FROM users WHERE id = ?', [userId]);
  if (!user || user.quota_balance < amount) {
    throw Errors.resourceExhausted('账户余额', user?.quota_balance || 0);
  }

  // Deduct balance
  await execute(
    'UPDATE users SET quota_balance = quota_balance - ?, updated_at = ? WHERE id = ?',
    [amount, Date.now(), userId]
  );

  // Log usage
  const logId = randomUUID();
  await execute(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logId,
      userId,
      metadata.resourceType || 'unknown',
      metadata.modelId || null,
      metadata.tokensUsed || null,
      amount,
      metadata.requestId || null,
      Date.now()
    ]
  );

  return user.quota_balance - amount;
}

/**
 * Add user quota (recharge)
 */
export async function addUserQuota(userId, amount) {
  await execute(
    'UPDATE users SET quota_balance = quota_balance + ?, updated_at = ? WHERE id = ?',
    [amount, Date.now(), userId]
  );
}

export { calculateQuotaCost } from './pricing.mjs';

/**
 * Helper to authenticate HTTP request from Bearer token
 * Returns user object or throws 401 error
 */
export async function authenticateRequest(req) {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Errors.authenticationRequired('需要登录后使用此服务');
  }

  const token = authHeader.slice(7);
  const user = await getUserFromToken(token);

  if (!user) {
    throw Errors.authenticationRequired('登录已过期，请重新登录');
  }

  if (user.status !== 'active') {
    throw Errors.permissionDenied('账号已被封禁');
  }

  return { user, token };
}

/**
 * Retrieve user usage logs with pagination and summary stats
 */
export async function getUserUsageLogs(userId, { limit = 20, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const logs = await query(
    `SELECT id, resource_type as resourceType, model_id as modelId,
            tokens_used as tokensUsed, quota_cost as quotaCost,
            request_id as requestId, created_at as createdAt
     FROM usage_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, safeLimit, safeOffset]
  );

  const totalRow = await queryOne(
    'SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN quota_cost > 0 THEN quota_cost ELSE 0 END), 0) as totalConsumed FROM usage_logs WHERE user_id = ?',
    [userId]
  );

  return {
    logs,
    total: totalRow?.count || 0,
    totalConsumed: totalRow?.totalConsumed || 0,
  };
}

/**
 * Topup user quota (demo / fixed-point ledger recharge)
 */
export async function topupUserQuota(userId, amount, metadata = {}) {
  const numAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (numAmount <= 0) {
    throw Errors.invalidInput('充值积分必须大于 0');
  }

  await execute(
    'UPDATE users SET quota_balance = quota_balance + ?, updated_at = ? WHERE id = ?',
    [numAmount, Date.now(), userId]
  );

  const user = await queryOne('SELECT quota_balance FROM users WHERE id = ?', [userId]);

  const logId = randomUUID();
  await execute(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logId,
      userId,
      'topup',
      metadata.channel || 'demo',
      null,
      -numAmount,
      metadata.requestId || null,
      Date.now(),
    ]
  );

  return user ? user.quota_balance : numAmount;
}

/**
 * Retrieve enabled server models and their quota costs
 */
export async function getServerModelsList() {
  return await query(
    `SELECT id, name, kind, enabled, provider, quota_cost_per_unit as quotaCostPerUnit,
            max_concurrency as maxConcurrency, config, updated_at as updatedAt
     FROM server_models
     WHERE enabled = 1
     ORDER BY kind ASC, name ASC`
  );
}

