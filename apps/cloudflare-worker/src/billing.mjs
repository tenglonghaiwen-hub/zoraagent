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
    'SELECT id, email, username, role, quota_balance as quotaBalance, status, is_vip as isVip, vip_expires_at as vipExpiresAt, concurrency_limit as concurrencyLimit FROM users WHERE id = ?'
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

const KNOWN_MODEL_METAS = {
  'MiniMax-H3': {
    ratios: ['16:9', '9:16', '1:1', 'adaptive', '21:9', '4:3', '3:4'],
    resolutions: ['768P', '2K'],
    durationRange: { min: 4, max: 15, step: 1 },
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    modes: [
      { id: 't2v', name: '文生视频', enabled: true },
      { id: 'i2v', name: '首帧生视频', enabled: true },
      { id: 'fl', name: '首尾帧', enabled: true },
      { id: 'ref', name: '多模态参考', enabled: true },
    ]
  },
  'doubao-seedream-5-0-260128': {
    ratios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
    resolutions: ['1K', '2K', '4K'],
    modes: [
      { id: 't2i', name: '文生图', enabled: true },
      { id: 'i2i', name: '图生图', enabled: true },
      { id: 'ref', name: '全能参考', enabled: true },
    ]
  },
  'gpt-image-2': {
    ratios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
    resolutions: ['1K', '2K'],
    modes: [
      { id: 't2i', name: '文生图', enabled: true },
      { id: 'i2i', name: '图生图', enabled: true },
      { id: 'ref', name: '全能参考', enabled: true },
    ]
  }
};

export function attachModelCapabilities(model) {
  if (!model) return model;
  const known = KNOWN_MODEL_METAS[model.id] || {};
  const isVideo = model.kind === 'video';
  const isImage = model.kind === 'image';
  return {
    ...model,
    ratios: model.ratios || known.ratios || (isVideo ? ['16:9', '9:16', '1:1', '4:3', '21:9'] : ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9']),
    resolutions: model.resolutions || known.resolutions || (isVideo ? ['720P', '1080P', '2K'] : ['1K', '2K', '4K']),
    modes: model.modes || known.modes || (isVideo ? [
      { id: 't2v', name: '文生视频', enabled: true },
      { id: 'i2v', name: '首帧生视频', enabled: true },
      { id: 'fl', name: '首尾帧', enabled: true },
      { id: 'ref', name: '全能参考', enabled: true },
      { id: 'v2v', name: '参考视频', enabled: true }
    ] : [
      { id: 't2i', name: '文生图', enabled: true },
      { id: 'i2i', name: '图生图', enabled: true },
      { id: 'ref', name: '全能参考', enabled: true }
    ]),
    durations: model.durations || known.durations || (isVideo ? [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : undefined),
    durationRange: model.durationRange || known.durationRange || (isVideo ? { min: 4, max: 15, step: 1 } : undefined),
    maxCount: model.maxCount || (isImage ? 4 : 2),
    maxConcurrency: model.maxConcurrency || 2
  };
}

/**
 * Retrieve enabled server models
 */
export async function getServerModels(db) {
  const { results } = await db.prepare(
    `SELECT id, name, kind, enabled, provider, route, query_route as queryRoute,
            quota_cost_per_unit as quotaCostPerUnit,
            max_concurrency as maxConcurrency,
            vip_only as vipOnly, updated_at as updatedAt
     FROM server_models
     WHERE enabled = 1
     ORDER BY kind ASC, name ASC`
  ).all();

  return (results || []).map(attachModelCapabilities);
}

/**
 * Retrieve all server models (including disabled ones) for Admin Console
 */
export async function getAllServerModels(db) {
  const { results } = await db.prepare(
    `SELECT id, name, kind, enabled, provider, route, query_route as queryRoute,
            quota_cost_per_unit as quotaCostPerUnit,
            max_concurrency as maxConcurrency,
            vip_only as vipOnly, updated_at as updatedAt
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
  const vipOnly = model.vipOnly === 1 || model.vipOnly === true ? 1 : 0;

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
    `INSERT INTO server_models (id, name, kind, enabled, provider, route, query_route, quota_cost_per_unit, max_concurrency, vip_only, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       kind = excluded.kind,
       enabled = excluded.enabled,
       provider = excluded.provider,
       route = excluded.route,
       query_route = excluded.query_route,
       quota_cost_per_unit = excluded.quota_cost_per_unit,
       max_concurrency = excluded.max_concurrency,
       vip_only = excluded.vip_only,
       updated_at = excluded.updated_at`
  ).bind(id, name, kind, enabled, provider, route, queryRoute || null, quotaCostPerUnit, maxConcurrency, vipOnly, now, now).run();

  return { id, name, kind, enabled, provider, route, queryRoute, quotaCostPerUnit, maxConcurrency, vipOnly, updatedAt: now };
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
 * Admin Users list with VIP info and metrics
 */
export async function getAdminUsers(db, { limit = 50, offset = 0, search = '' } = {}) {
  let query = `
    SELECT id, username, email, role, quota_balance as quotaBalance,
           is_vip as isVip, vip_expires_at as vipExpiresAt, concurrency_limit as concurrencyLimit,
           status, created_at as createdAt, updated_at as updatedAt
    FROM users
  `;
  const params = [];
  if (search && search.trim()) {
    query += ` WHERE email LIKE ? OR username LIKE ?`;
    const s = `%${search.trim()}%`;
    params.push(s, s);
  }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results: users } = await db.prepare(query).bind(...params).all();

  const countRow = await db.prepare('SELECT COUNT(*) as count FROM users').first();
  const vipCountRow = await db.prepare('SELECT COUNT(*) as vips FROM users WHERE is_vip = 1').first();
  const quotaSumRow = await db.prepare('SELECT SUM(quota_balance) as totalQuota FROM users').first();

  return {
    users: users || [],
    total: countRow?.count || 0,
    totalVips: vipCountRow?.vips || 0,
    totalQuota: quotaSumRow?.totalQuota || 0
  };
}

/**
 * Adjust a user's balance manually from Admin Console (Topup or Refund)
 */
export async function adjustUserBalance(db, userId, delta, reason = '管理员手动调账') {
  const numDelta = parseInt(delta, 10);
  if (isNaN(numDelta) || numDelta === 0) throw new Error('调账积分变动值无效');

  const now = Date.now();
  const logId = crypto.randomUUID();
  const resourceType = numDelta > 0 ? 'admin_topup' : 'admin_refund';

  await db.prepare('UPDATE users SET quota_balance = quota_balance + ?, updated_at = ? WHERE id = ?')
    .bind(numDelta, now, userId).run();

  await db.prepare(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    resourceType,
    reason,
    null,
    -numDelta, // cost 负值表示入账增加积分，正值表示扣除
    `admin-${Date.now()}`,
    now
  ).run();

  const user = await db.prepare('SELECT quota_balance FROM users WHERE id = ?').bind(userId).first();
  return { userId, newBalance: user ? user.quota_balance : 0, delta: numDelta, resourceType };
}

/**
 * Update user's VIP status and expiration
 */
export async function setUserVip(db, userId, arg3 = {}, arg4) {
  let isVip;
  let days = 30;

  if (typeof arg3 === 'boolean' || typeof arg3 === 'number') {
    isVip = Boolean(arg3);
    if (arg4 !== undefined) days = Number(arg4);
  } else if (arg3 && typeof arg3 === 'object') {
    isVip = Boolean(arg3.isVip);
    if (arg3.days !== undefined) days = Number(arg3.days);
  } else {
    isVip = Boolean(arg3);
  }

  const now = Date.now();
  let vipVal = isVip ? 1 : 0;
  let expiresAt = 0;
  let concurrency = vipVal ? 4 : 1;

  if (vipVal) {
    if (days === -1) {
      expiresAt = -1; // 永久 VIP
    } else {
      const existing = await db.prepare(
        'SELECT is_vip as isVip, vip_expires_at as vipExpiresAt FROM users WHERE id = ?'
      ).bind(userId).first();
      const currentExpiry = Number(existing?.vipExpiresAt) || 0;
      const baseTime = (existing?.isVip && currentExpiry > now) ? currentExpiry : now;
      expiresAt = baseTime + (days * 86400000);
    }
  }

  await db.prepare(
    `UPDATE users SET is_vip = ?, vip_expires_at = ?, concurrency_limit = ?, updated_at = ? WHERE id = ?`
  ).bind(vipVal, expiresAt, concurrency, now, userId).run();

  return { userId, isVip: vipVal === 1, vipExpiresAt: expiresAt, concurrencyLimit: concurrency };
}

/**
 * Self-service membership upgrade for users (supporting demo/paid flows)
 */
export async function upgradeUserMembership(db, userId, { days = 30, giftQuota = 0, tier = 'monthly' } = {}) {
  const now = Date.now();
  const existing = await db.prepare(
    'SELECT is_vip as isVip, vip_expires_at as vipExpiresAt, quota_balance as quotaBalance, concurrency_limit as concurrencyLimit FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!existing) {
    throw Object.assign(new Error('目标用户不存在'), { status: 404 });
  }

  let newExpiresAt = 0;
  if (days === -1) {
    newExpiresAt = -1; // 终身永久 VIP
  } else {
    const currentExpiry = Number(existing.vipExpiresAt) || 0;
    const baseTime = (existing.isVip && currentExpiry > now) ? currentExpiry : now;
    newExpiresAt = baseTime + (days * 86400000);
  }

  // Set concurrency limit according to tier
  let targetConcurrency = 2;
  if (days === -1 || days >= 365) {
    targetConcurrency = 4;
  } else if (days >= 90) {
    targetConcurrency = 3;
  }
  const newConcurrency = Math.max(Number(existing.concurrencyLimit) || 1, targetConcurrency);

  // Calculate new quota
  const addPoints = Math.max(0, parseInt(giftQuota, 10) || 0);
  const newBalance = (Number(existing.quotaBalance) || 0) + addPoints;

  // Update DB
  await db.prepare(
    `UPDATE users SET is_vip = 1, vip_expires_at = ?, concurrency_limit = ?, quota_balance = ?, updated_at = ? WHERE id = ?`
  ).bind(newExpiresAt, newConcurrency, newBalance, now, userId).run();

  // Record audit log
  const logId = `mem-${now}-${Math.random().toString(36).slice(2, 7)}`;
  await db.prepare(
    `INSERT INTO usage_logs (id, user_id, type, amount, balance_after, details, created_at)
     VALUES (?, ?, 'topup', ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    addPoints,
    newBalance,
    JSON.stringify({
      channel: 'membership_upgrade',
      tier,
      days,
      giftQuota: addPoints,
      vipExpiresAt: newExpiresAt,
      concurrencyLimit: newConcurrency,
      note: '造境 VIP 会员开通/续费入账'
    }),
    now
  ).run();

  return {
    userId,
    isVip: true,
    vipExpiresAt: newExpiresAt,
    concurrencyLimit: newConcurrency,
    newBalance,
    giftQuota: addPoints,
    tier
  };
}

/**
 * Update user's account status (active / suspended)
 */
export async function setUserStatus(db, userId, status) {
  const validStatus = status === 'suspended' ? 'suspended' : 'active';
  const now = Date.now();
  await db.prepare(
    `UPDATE users SET status = ?, updated_at = ? WHERE id = ?`
  ).bind(validStatus, now, userId).run();

  return { userId, status: validStatus };
}


/**
 * Notification management for Admin & User
 */
export async function getNotifications(db, { limit = 50 } = {}) {
  const { results } = await db.prepare(
    `SELECT id, user_id as userId, title, content, kind, created_at as createdAt
     FROM notifications
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all();
  return results || [];
}

export async function createNotification(db, { title, content, kind = 'official', userId = '*' } = {}) {
  if (!title || !content) throw new Error('通知标题与内容不能为空');
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const targetUser = (userId && userId.trim()) ? userId.trim() : '*';

  await db.prepare(
    `INSERT INTO notifications (id, user_id, title, content, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, targetUser, title.trim(), content.trim(), kind, now).run();

  return { id, userId: targetUser, title, content, kind, createdAt: now };
}

export async function deleteNotification(db, id) {
  await db.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();
  return { ok: true, id };
}

export async function getUserMessages(db, userId, { limit = 50 } = {}) {
  const { results } = await db.prepare(
    `SELECT id, user_id as userId, title, content, kind, created_at as createdAt
     FROM notifications
     WHERE user_id = '*' OR user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(userId, limit).all();
  return results || [];
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

