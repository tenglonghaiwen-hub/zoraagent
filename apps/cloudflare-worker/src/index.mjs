import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt
} from './auth.mjs';
import {
  authenticateRequest,
  calculateQuotaCost,
  deductUserQuota,
  topupUserQuota,
  getUserUsageLogs,
  getServerModels,
  getAllServerModels,
  upsertServerModel,
  deleteServerModel,
  getSystemConfig,
  getAllSystemConfigs,
  setSystemConfig,
  getAdminStats,
  getAdminUsers,
  adjustUserBalance,
  verifyAdminRequest
} from './billing.mjs';
import {
  proxyGeneration,
  proxyChat,
  proxyQueryTask
} from './proxy.mjs';
import { renderAdminHtml } from './admin-ui.mjs';

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}

function errorResponse(message, status = 400, headers = {}, extra = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, status, headers);
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const jwtSecret = env.JWT_SECRET || 'zora-default-secret-change-in-production';

    try {
      // ----------------------------------------------------
      // 0. Visual Admin Console Dashboard (HTML)
      // ----------------------------------------------------
      if (path === '/admin' || (path === '/' && request.headers.get('Accept')?.includes('text/html'))) {
        return new Response(renderAdminHtml(), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store'
          }
        });
      }

      // ----------------------------------------------------
      // 1. Health / Gateway Metadata (JSON)
      // ----------------------------------------------------
      if (path === '/' || path === '/health') {
        return jsonResponse({
          ok: true,
          service: 'zora-cloud-gateway',
          version: '1.0.0',
          runtime: 'cloudflare-workers',
          adminUi: '/admin',
          timestamp: new Date().toISOString()
        }, 200, cors);
      }

      // ----------------------------------------------------
      // 2. Admin APIs (Console Backend)
      // ----------------------------------------------------
      if (path === '/api/admin/login' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const password = body.password;
        if (!password) {
          return errorResponse('请输入管理员密码', 400, cors);
        }

        const expectedPass = (await getSystemConfig(env.DB, 'ADMIN_PASSWORD')) || env.ADMIN_PASSWORD || 'admin123456';
        if (password !== expectedPass) {
          return errorResponse('管理员密码错误', 401, cors);
        }

        const token = await signJwt({
          role: 'admin',
          username: 'admin'
        }, jwtSecret, 7 * 86400);

        return jsonResponse({
          ok: true,
          token,
          role: 'admin'
        }, 200, cors);
      }

      if (path === '/api/admin/stats' && method === 'GET') {
        await verifyAdminRequest(request, env);
        const stats = await getAdminStats(env.DB);
        return jsonResponse({ ok: true, stats }, 200, cors);
      }

      if (path === '/api/admin/models' && method === 'GET') {
        await verifyAdminRequest(request, env);
        const models = await getAllServerModels(env.DB);
        return jsonResponse({ ok: true, models }, 200, cors);
      }

      if (path === '/api/admin/models' && method === 'POST') {
        await verifyAdminRequest(request, env);
        const body = await request.json().catch(() => ({}));
        const model = await upsertServerModel(env.DB, body);
        return jsonResponse({ ok: true, model }, 200, cors);
      }

      if (path === '/api/admin/models' && method === 'DELETE') {
        await verifyAdminRequest(request, env);
        const id = url.searchParams.get('id');
        if (!id) return errorResponse('缺少模型 ID 参数', 400, cors);
        await deleteServerModel(env.DB, id);
        return jsonResponse({ ok: true, id }, 200, cors);
      }

      if (path === '/api/admin/config' && method === 'GET') {
        await verifyAdminRequest(request, env);
        const configs = await getAllSystemConfigs(env.DB);
        // Mask secret values in response
        const safeConfigs = configs.map(c => ({
          ...c,
          value: c.isSecret && c.value ? (c.value.length > 8 ? `••••••••${c.value.slice(-6)}` : '••••••••') : c.value
        }));
        return jsonResponse({ ok: true, configs: safeConfigs }, 200, cors);
      }

      if (path === '/api/admin/config' && method === 'PUT') {
        await verifyAdminRequest(request, env);
        const body = await request.json().catch(() => ({}));
        for (const [key, val] of Object.entries(body)) {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            await setSystemConfig(env.DB, key, String(val).trim());
          }
        }
        return jsonResponse({ ok: true, message: '配置已更新并即时生效' }, 200, cors);
      }

      if (path === '/api/admin/users' && method === 'GET') {
        await verifyAdminRequest(request, env);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const data = await getAdminUsers(env.DB, { limit, offset });
        return jsonResponse({ ok: true, ...data }, 200, cors);
      }

      if (path === '/api/admin/users/adjust-balance' && method === 'POST') {
        await verifyAdminRequest(request, env);
        const body = await request.json().catch(() => ({}));
        const { userId, delta, reason } = body;
        if (!userId) return errorResponse('缺少目标 userId', 400, cors);
        const result = await adjustUserBalance(env.DB, userId, delta, reason);
        return jsonResponse({ ok: true, ...result }, 200, cors);
      }

      if (path === '/api/admin/logs' && method === 'GET') {
        await verifyAdminRequest(request, env);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const { results: logs } = await env.DB.prepare(
          `SELECT id, user_id as userId, resource_type as resourceType, model_id as modelId,
                  tokens_used as tokensUsed, quota_cost as quotaCost, request_id as requestId, created_at as createdAt
           FROM usage_logs
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(limit).all();
        return jsonResponse({ ok: true, logs: logs || [] }, 200, cors);
      }

      // ----------------------------------------------------
      // 3. Model Catalog (Client public)
      // ----------------------------------------------------
      if (path === '/api/models' && method === 'GET') {
        const models = await getServerModels(env.DB);
        return jsonResponse({ ok: true, models }, 200, cors);
      }

      // ----------------------------------------------------
      // 4. Authentication Endpoints
      // ----------------------------------------------------
      if (path === '/api/auth/register' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const username = (body.username || body.email || '').trim();
        const email = (body.email || body.username || '').trim();
        const password = body.password;

        if (!username || username.length < 3) {
          return errorResponse('用户名至少需要 3 个字符', 400, cors);
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
          return errorResponse('密码至少需要 6 个字符', 400, cors);
        }

        // Check duplicate
        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ? OR username = ?'
        ).bind(email, username).first();

        if (existing) {
          return errorResponse('该用户/邮箱已被注册', 409, cors);
        }

        const userId = crypto.randomUUID();
        const now = Date.now();
        const passwordHash = await hashPassword(password);
        const initialQuota = 100;

        await env.DB.prepare(
          `INSERT INTO users (id, email, password_hash, username, role, quota_balance, created_at, updated_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, email, passwordHash, username, 'user', initialQuota, now, now, 'active').run();

        const token = await signJwt({
          userId,
          username,
          email,
          role: 'user'
        }, jwtSecret, 7 * 86400);

        // Record session
        const sessionId = crypto.randomUUID();
        const expiresAt = now + 7 * 86400 * 1000;
        await env.DB.prepare(
          'INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(sessionId, userId, token, expiresAt, now, now).run();

        return jsonResponse({
          ok: true,
          token,
          user: {
            id: userId,
            username,
            email,
            role: 'user',
            balance: initialQuota,
            quotaBalance: initialQuota
          }
        }, 201, cors);
      }

      if (path === '/api/auth/login' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const account = (body.email || body.username || '').trim();
        const password = body.password;

        if (!account || !password) {
          return errorResponse('请输入账号与密码', 400, cors);
        }

        const user = await env.DB.prepare(
          'SELECT id, email, username, password_hash, role, quota_balance as quotaBalance, status FROM users WHERE email = ? OR username = ?'
        ).bind(account, account).first();

        if (!user) {
          return errorResponse('账号或密码错误', 401, cors);
        }

        if (user.status !== 'active') {
          return errorResponse('账号已被封禁', 403, cors);
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          return errorResponse('账号或密码错误', 401, cors);
        }

        const now = Date.now();
        const token = await signJwt({
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }, jwtSecret, 7 * 86400);

        const sessionId = crypto.randomUUID();
        const expiresAt = now + 7 * 86400 * 1000;
        await env.DB.prepare(
          'INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(sessionId, user.id, token, expiresAt, now, now).run();

        return jsonResponse({
          ok: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            balance: user.quotaBalance,
            quotaBalance: user.quotaBalance
          }
        }, 200, cors);
      }

      if (path === '/api/auth/refresh' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const oldToken = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!oldToken) {
          return errorResponse('Missing token', 401, cors);
        }

        const payload = await verifyJwt(oldToken, jwtSecret);
        if (!payload || !payload.userId) {
          return errorResponse('Token 无效或已过期', 401, cors);
        }

        const user = await env.DB.prepare(
          'SELECT id, email, username, role, quota_balance as quotaBalance, status FROM users WHERE id = ?'
        ).bind(payload.userId).first();

        if (!user || user.status !== 'active') {
          return errorResponse('用户不存在或已封禁', 401, cors);
        }

        const now = Date.now();
        const newToken = await signJwt({
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }, jwtSecret, 7 * 86400);

        // Invalidate old session and insert new session
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(oldToken).run();
        const sessionId = crypto.randomUUID();
        const expiresAt = now + 7 * 86400 * 1000;
        await env.DB.prepare(
          'INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(sessionId, user.id, newToken, expiresAt, now, now).run();

        return jsonResponse({
          ok: true,
          token: newToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            balance: user.quotaBalance,
            quotaBalance: user.quotaBalance
          }
        }, 200, cors);
      }

      if (path === '/api/auth/me' && method === 'GET') {
        const { user } = await authenticateRequest(request, env);
        return jsonResponse({
          ok: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            balance: user.quotaBalance,
            quotaBalance: user.quotaBalance
          }
        }, 200, cors);
      }

      // ----------------------------------------------------
      // 5. Ledger & Consumption Audit (User personal)
      // ----------------------------------------------------
      if (path === '/api/user/usage' && method === 'GET') {
        const { user } = await authenticateRequest(request, env);
        const limit = parseInt(url.searchParams.get('limit') || url.searchParams.get('pageSize') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const logsData = await getUserUsageLogs(env.DB, user.id, { limit, offset });

        return jsonResponse({
          ok: true,
          logs: logsData.logs,
          total: logsData.total,
          totalConsumed: logsData.totalConsumed,
          limit,
          offset
        }, 200, cors);
      }

      if (path === '/api/user/topup' && method === 'POST') {
        const { user } = await authenticateRequest(request, env);
        const body = await request.json().catch(() => ({}));
        const amount = parseInt(body.amount, 10);

        if (isNaN(amount) || amount <= 0 || amount > 1000) {
          return errorResponse('无效的充值积分数量（单次体验上限 1000）', 400, cors);
        }

        const newBalance = await topupUserQuota(env.DB, user.id, amount, {
          channel: 'demo',
          requestId: `topup-${Date.now()}`
        });

        return jsonResponse({
          ok: true,
          message: `成功充值 ${amount} 积分 [DEMO]`,
          newBalance,
          balance: newBalance
        }, 200, cors);
      }

      // ----------------------------------------------------
      // 6. Cost Preview Endpoint
      // ----------------------------------------------------
      if (path === '/api/preview' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const modelId = body.model || body.modelId || 'flux-schnell';
        const kind = body.type || body.kind || 'image';
        const count = body.count || 1;

        const cost = await calculateQuotaCost(env.DB, { modelId, kind, count });

        return jsonResponse({
          ok: true,
          model: modelId,
          type: kind,
          cost_per_unit: cost,
          unit_name: kind === 'video' ? '次' : '张',
          estimated_cost: cost
        }, 200, cors);
      }

      // ----------------------------------------------------
      // 7. Generation Task Status Polling (MiniMax / Duoyuanx Video Tasks)
      // ----------------------------------------------------
      if (method === 'GET' && (path.startsWith('/api/generation-tasks/') || path.startsWith('/v2/query/video_generation/') || path.startsWith('/api/tasks/'))) {
        const taskId = path.split('/').filter(Boolean).pop();
        if (!taskId) return errorResponse('缺少 taskId 参数', 400, cors);

        const provider = url.searchParams.get('provider') || (path.includes('video_generation') ? 'minimax' : 'minimax');
        const queryRoute = url.searchParams.get('queryRoute') || url.searchParams.get('query_route') || null;
        const taskResult = await proxyQueryTask({ taskId, provider, queryRoute, env });
        return jsonResponse(taskResult, 200, cors);
      }

      // ----------------------------------------------------
      // 8. Upstream Proxy (Generate & Chat)
      // ----------------------------------------------------
      if (path === '/api/generate' && method === 'POST') {
        const { user } = await authenticateRequest(request, env);
        const body = await request.json().catch(() => ({}));
        const prompt = body.prompt;
        const model = body.model || body.modelId || 'flux-schnell';
        const kind = body.type || body.kind || (body.duration ? 'video' : 'image');

        if (!prompt || typeof prompt !== 'string') {
          return errorResponse('缺少必要的 prompt 参数', 400, cors);
        }

        // Check if model is enabled in database & retrieve custom routes
        let modelInfo = null;
        if (env.DB) {
          try {
            modelInfo = await env.DB.prepare(
              'SELECT id, name, kind, provider, route, query_route, enabled FROM server_models WHERE id = ?'
            ).bind(model).first();
          } catch {}
        }

        if (modelInfo && (modelInfo.enabled === 0 || modelInfo.enabled === false)) {
          return errorResponse(`模型 ${model} 已下架或暂停开放`, 403, cors);
        }

        const provider = body.provider || modelInfo?.provider || (model === 'MiniMax-H3' ? 'minimax' : 'duoyuanx');
        const route = body.route || modelInfo?.route || null;
        const queryRoute = body.queryRoute || body.query_route || modelInfo?.query_route || null;

        const cost = await calculateQuotaCost(env.DB, { modelId: model, kind, count: 1 });
        const currentBalance = user.quotaBalance || 0;

        // Quota Pre-check
        if (currentBalance < cost) {
          return errorResponse(
            `积分不足，本次操作需要 ${cost} 积分，当前可用 ${currentBalance} 积分，请充值后继续`,
            402,
            cors,
            { currentBalance, requiredCost: cost }
          );
        }

        // Upstream generation with provider & route routing
        const upstreamData = await proxyGeneration({
          body: { ...body, model, kind },
          env,
          provider,
          route,
          queryRoute
        });

        // Extract result URL / Task ID
        const outputUrl = upstreamData.data?.[0]?.url || upstreamData.url || null;
        const taskId = upstreamData.task_id || upstreamData.taskId || `task-${Date.now()}`;
        const status = upstreamData.status || (outputUrl ? 'success' : 'processing');

        // Atomic balance deduction & log
        const newBalance = await deductUserQuota(env.DB, user.id, cost, {
          resourceType: 'generation',
          modelId: model,
          requestId: taskId
        });

        return jsonResponse({
          ok: true,
          url: outputUrl,
          taskId,
          task_id: taskId,
          status,
          provider: upstreamData.provider || provider,
          route: upstreamData.route || route,
          cost,
          newBalance,
          balance: newBalance,
          model,
          prompt,
          data: upstreamData.data,
          upstream: upstreamData.upstream || upstreamData
        }, 200, cors);
      }

      if (path === '/api/chat' && method === 'POST') {
        const { user } = await authenticateRequest(request, env);
        const body = await request.json().catch(() => ({}));
        const model = body.modelId || body.model || 'gpt-5.5';

        // Check if model is enabled & retrieve custom route
        let modelInfo = null;
        if (env.DB) {
          try {
            modelInfo = await env.DB.prepare(
              'SELECT id, name, kind, provider, route, enabled FROM server_models WHERE id = ?'
            ).bind(model).first();
          } catch {}
        }

        if (modelInfo && (modelInfo.enabled === 0 || modelInfo.enabled === false)) {
          return errorResponse(`模型 ${model} 已下架或暂停开放`, 403, cors);
        }

        const provider = body.provider || modelInfo?.provider || null;
        const route = body.route || modelInfo?.route || null;

        const cost = await calculateQuotaCost(env.DB, { modelId: model, kind: 'agent', count: 1 });
        const currentBalance = user.quotaBalance || 0;

        if (currentBalance < cost) {
          return errorResponse(
            `积分不足，对话需要 ${cost} 积分，当前可用 ${currentBalance} 积分`,
            402,
            cors,
            { currentBalance, requiredCost: cost }
          );
        }

        const upstreamData = await proxyChat({
          body: { ...body, modelId: model },
          env,
          provider,
          route
        });

        const newBalance = await deductUserQuota(env.DB, user.id, cost, {
          resourceType: 'chat',
          modelId: model,
          requestId: upstreamData.conversationId
        });

        return jsonResponse({
          ok: true,
          ...upstreamData,
          cost,
          newBalance,
          balance: newBalance
        }, 200, cors);
      }

      return errorResponse(`Endpoint not found: ${method} ${path}`, 404, cors);
    } catch (err) {
      console.error('[CloudflareWorker Error]', err);
      return errorResponse(
        err.message || '内部服务异常',
        err.status || 500,
        cors
      );
    }
  }
};
