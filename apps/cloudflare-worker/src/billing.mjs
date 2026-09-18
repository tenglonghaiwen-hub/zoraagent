/**
 * Billing and D1 database operations for Cloudflare Workers
 */
import { verifyJwt } from './auth.mjs';

/**
 * Authenticate request via Bearer token against D1 users & sessions
 */
export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('需要登录后使用此服务'), { status: 401 });
  }

  const token = authHeader.slice(7);
  const jwtSecret = env.JWT_SECRET || 'zora-default-secret-change-in-production';
  const payload = await verifyJwt(token, jwtSecret);

  if (!payload || !payload.userId) {
    throw Object.assign(new Error('登录已过期，请重新登录'), { status: 401 });
  }

  // Query user from D1 database
  const user = await env.DB.prepare(
    'SELECT id, email, username, role, quota_balance as quotaBalance, status FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user) {
    throw Object.assign(new Error('用户不存在或已注销'), { status: 401 });
  }

  if (user.status !== 'active') {
    throw Object.assign(new Error('账号已被封禁'), { status: 403 });
  }

  return { user, token };
}

/**
 * Calculate quota cost querying D1 server_models with fallbacks
 */
export async function calculateQuotaCost(db, { modelId, kind = 'image', count = 1 }) {
  const numCount = Math.max(1, Number(count) || 1);

  if (modelId) {
    try {
      const model = await db.prepare(
        'SELECT quota_cost_per_unit as unitCost, enabled FROM server_models WHERE id = ?'
      ).bind(modelId).first();

      if (model && model.enabled) {
        return model.unitCost * numCount;
      }
    } catch {
      /* fallback */
    }
  }

  // Fallbacks: agent = 1, image = 10, video = 100
  const normalizedKind = String(kind || '').toLowerCase();
  if (normalizedKind === 'agent' || normalizedKind === 'chat') return 1 * numCount;
  if (normalizedKind === 'video') return 100 * numCount;
  return 10 * numCount;
}

/**
 * Deduct quota in D1 and write usage_log
 */
export async function deductUserQuota(db, userId, amount, metadata = {}) {
  const numAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (numAmount === 0) return;

  const now = Date.now();
  const logId = crypto.randomUUID();

  // Deduct balance
  await db.prepare(
    'UPDATE users SET quota_balance = quota_balance - ?, updated_at = ? WHERE id = ?'
  ).bind(numAmount, now, userId).run();

  // Log usage
  await db.prepare(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    metadata.resourceType || 'generation',
    metadata.modelId || null,
    metadata.tokensUsed || null,
    numAmount,
    metadata.requestId || null,
    now
  ).run();

  // Return new balance
  const user = await db.prepare('SELECT quota_balance FROM users WHERE id = ?').bind(userId).first();
  return user ? user.quota_balance : 0;
}

/**
 * Top up quota in D1 and write log
 */
export async function topupUserQuota(db, userId, amount, metadata = {}) {
  const numAmount = Math.max(1, Math.floor(Number(amount) || 100));
  const now = Date.now();
  const logId = crypto.randomUUID();

  await db.prepare(
    'UPDATE users SET quota_balance = quota_balance + ?, updated_at = ? WHERE id = ?'
  ).bind(numAmount, now, userId).run();

  await db.prepare(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    'topup',
    metadata.channel || 'demo',
    null,
    -numAmount,
    metadata.requestId || null,
    now
  ).run();

  const user = await db.prepare('SELECT quota_balance FROM users WHERE id = ?').bind(userId).first();
  return user ? user.quota_balance : numAmount;
}

/**
 * Retrieve user usage logs with pagination
 */
export async function getUserUsageLogs(db, userId, { limit = 20, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const { results: logs } = await db.prepare(
    `SELECT id, resource_type as resourceType, model_id as modelId,
            tokens_used as tokensUsed, quota_cost as quotaCost,
            request_id as requestId, created_at as createdAt
     FROM usage_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(userId, safeLimit, safeOffset).all();

  const totalRow = await db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN quota_cost > 0 THEN quota_cost ELSE 0 END), 0) as totalConsumed FROM usage_logs WHERE user_id = ?'
  ).bind(userId).first();

  return {
    logs: logs || [],
    total: totalRow?.count || 0,
    totalConsumed: totalRow?.totalConsumed || 0,
  };
}

/**
 * Retrieve enabled server models
 */
export async function getServerModels(db) {
  const { results } = await db.prepare(
    `SELECT id, name, kind, enabled, provider, quota_cost_per_unit as quotaCostPerUnit,
            max_concurrency as maxConcurrency, updated_at as updatedAt
     FROM server_models
     WHERE enabled = 1
     ORDER BY kind ASC, name ASC`
  ).all();

  return results || [];
}
