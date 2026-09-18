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
    `SELECT id, name, kind, enabled, provider, route, query_route as queryRoute,
            quota_cost_per_unit as quotaCostPerUnit,
            max_concurrency as maxConcurrency, updated_at as updatedAt
     FROM server_models
     WHERE enabled = 1
     ORDER BY kind ASC, name ASC`
  ).all();

  return results || [];
}

/**
 * Retrieve all server models (including disabled ones) for Admin Console
 */
export async function getAllServerModels(db) {
  const { results } = await db.prepare(
    `SELECT id, name, kind, enabled, provider, route, query_route as queryRoute,
            quota_cost_per_unit as quotaCostPerUnit,
            max_concurrency as maxConcurrency, updated_at as updatedAt
     FROM server_models
     ORDER BY kind ASC, name ASC`
  ).all();

  return results || [];
}

/**
 * Upsert a server model with custom or default API route
 */
export async function upsertServerModel(db, model) {
  const now = Date.now();
  const id = (model.id || '').trim();
  if (!id) throw new Error('模型唯一 ID (id) 不能为空');

  const name = (model.name || id).trim();
  const kind = ['image', 'video', 'agent'].includes(model.kind) ? model.kind : 'image';
  const enabled = model.enabled === 0 || model.enabled === false ? 0 : 1;
  const provider = (model.provider || 'duoyuanx').trim();
  const quotaCostPerUnit = Math.max(0, parseInt(model.quotaCostPerUnit, 10) || 10);
  const maxConcurrency = Math.max(1, parseInt(model.maxConcurrency, 10) || 1);

  let route = (model.route || '').trim();
  let queryRoute = (model.queryRoute || model.query_route || '').trim();

  // Auto-fill canonical routes if not provided
  if (!route) {
    if (kind === 'video') {
      route = (provider === 'minimax' || id === 'MiniMax-H3') ? '/v2/video_generation' : '/v1/videos';
    } else if (kind === 'image') {
      route = '/v1/images/generations';
    } else {
      route = '/v1/chat/completions';
    }
  }

  if (!queryRoute && kind === 'video') {
    queryRoute = (provider === 'minimax' || id === 'MiniMax-H3')
      ? '/v2/query/video_generation/{task_id}'
      : '/v1/videos/{task_id}';
  }

  await db.prepare(
    `INSERT INTO server_models (id, name, kind, enabled, provider, route, query_route, quota_cost_per_unit, max_concurrency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       kind = excluded.kind,
       enabled = excluded.enabled,
       provider = excluded.provider,
       route = excluded.route,
       query_route = excluded.query_route,
       quota_cost_per_unit = excluded.quota_cost_per_unit,
       max_concurrency = excluded.max_concurrency,
       updated_at = excluded.updated_at`
  ).bind(id, name, kind, enabled, provider, route, queryRoute || null, quotaCostPerUnit, maxConcurrency, now, now).run();

  return { id, name, kind, enabled, provider, route, queryRoute, quotaCostPerUnit, maxConcurrency, updatedAt: now };
}

/**
 * Delete a server model
 */
export async function deleteServerModel(db, id) {
  await db.prepare('DELETE FROM server_models WHERE id = ?').bind(id).run();
  return { ok: true, id };
}

/**
 * System Configs operations
 */
export async function getSystemConfig(db, key) {
  try {
    const row = await db.prepare('SELECT value FROM system_configs WHERE key = ?').bind(key).first();
    return row ? row.value : null;
  } catch {
    return null;
  }
}

export async function getAllSystemConfigs(db) {
  try {
    const { results } = await db.prepare(
      'SELECT key, value, description, is_secret as isSecret, updated_at as updatedAt FROM system_configs ORDER BY key ASC'
    ).all();
    return results || [];
  } catch {
    return [];
  }
}

export async function setSystemConfig(db, key, value, description = '') {
  const now = Date.now();
  await db.prepare(
    `INSERT INTO system_configs (key, value, description, is_secret, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).bind(key, String(value), description, key.includes('KEY') || key.includes('PASSWORD') || key.includes('SECRET') ? 1 : 0, now).run();
  return { key, value, updatedAt: now };
}

/**
 * Admin Stats overview
 */
export async function getAdminStats(db) {
  const userRow = await db.prepare('SELECT COUNT(*) as userCount, COALESCE(SUM(quota_balance), 0) as totalBalance FROM users').first();
  const logRow = await db.prepare(
    'SELECT COUNT(*) as totalRequests, COALESCE(SUM(CASE WHEN quota_cost > 0 THEN quota_cost ELSE 0 END), 0) as totalConsumed FROM usage_logs'
  ).first();
  const modelRow = await db.prepare('SELECT COUNT(*) as modelCount FROM server_models WHERE enabled = 1').first();

  return {
    totalUsers: userRow?.userCount || 0,
    totalBalance: userRow?.totalBalance || 0,
    totalRequests: logRow?.totalRequests || 0,
    totalConsumed: logRow?.totalConsumed || 0,
    activeModels: modelRow?.modelCount || 0
  };
}

/**
 * Admin Users list
 */
export async function getAdminUsers(db, { limit = 50, offset = 0 } = {}) {
  const { results: users } = await db.prepare(
    `SELECT id, username, email, role, quota_balance as quotaBalance, status, created_at as createdAt, updated_at as updatedAt
     FROM users
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const countRow = await db.prepare('SELECT COUNT(*) as count FROM users').first();
  return {
    users: users || [],
    total: countRow?.count || 0
  };
}

/**
 * Adjust a user's balance manually from Admin Console
 */
export async function adjustUserBalance(db, userId, delta, reason = '管理员手动调账') {
  const numDelta = parseInt(delta, 10);
  if (isNaN(numDelta) || numDelta === 0) throw new Error('调账积分变动值无效');

  const now = Date.now();
  const logId = crypto.randomUUID();

  await db.prepare('UPDATE users SET quota_balance = quota_balance + ?, updated_at = ? WHERE id = ?')
    .bind(numDelta, now, userId).run();

  await db.prepare(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    'admin_adjust',
    reason,
    null,
    -numDelta,
    `admin-${Date.now()}`,
    now
  ).run();

  const user = await db.prepare('SELECT quota_balance FROM users WHERE id = ?').bind(userId).first();
  return { userId, newBalance: user ? user.quota_balance : 0 };
}

/**
 * Admin Authentication Guard
 */
export async function verifyAdminRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('未授权：请先登录管理员后台'), { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  const jwtSecret = env.JWT_SECRET || 'zora-default-secret-change-in-production';
  const payload = await verifyJwt(token, jwtSecret);

  if (!payload || payload.role !== 'admin') {
    throw Object.assign(new Error('无权限：需要管理员凭据'), { status: 403 });
  }

  return payload;
}

