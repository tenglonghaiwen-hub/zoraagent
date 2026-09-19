/**
 * Authentication routes
 */
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  getUserFromToken,
  authenticateRequest,
  getUserUsageLogs,
  topupUserQuota,
  getServerModelsList,
} from '../../../packages/auth/index.mjs';
import { formatErrorResponse } from '../../../packages/agent/error-handling.mjs';

/**
 * Handle authentication, user account, and model catalog routes
 * Returns true if the request was handled
 */
export async function handleAuthRoutes(req, res, url, { sendJson }) {
  const isAuthRoute = url.pathname.startsWith('/api/auth/');
  const isUserRoute = url.pathname.startsWith('/api/user/');
  const isModelsRoute = url.pathname === '/api/models';

  if (!isAuthRoute && !isUserRoute && !isModelsRoute) {
    return false;
  }

  try {
    // GET /api/models
    if (req.method === 'GET' && isModelsRoute) {
      let models = await getServerModelsList();
      const { getModels, getModel } = await import('../../../packages/duoyuanx/catalog.mjs');
      if (!models || models.length === 0) {
        const catalogModels = getModels();
        models = catalogModels.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          enabled: m.enabled ? 1 : 0,
          provider: m.family || 'duoyuanx',
          quotaCostPerUnit: m.kind === 'agent' ? 1 : m.kind === 'image' ? 10 : 100,
          maxConcurrency: m.maxConcurrency || 1,
          ratios: m.ratios || [],
          resolutions: m.resolutions || [],
          modes: m.modes || [],
          durations: m.durations || [],
          durationRange: m.durationRange || null,
          fixedSeconds: m.fixedSeconds,
        }));
      } else {
        // Merge capability metadata from catalog for DB-stored server models
        models = models.map((m) => {
          const cat = getModel(m.id) || {};
          return {
            ...m,
            ratios: (m.ratios && m.ratios.length) ? m.ratios : (cat.ratios || []),
            resolutions: (m.resolutions && m.resolutions.length) ? m.resolutions : (cat.resolutions || []),
            modes: (m.modes && m.modes.length) ? m.modes : (cat.modes || []),
            durations: (m.durations && m.durations.length) ? m.durations : (cat.durations || []),
            durationRange: m.durationRange || cat.durationRange || null,
            fixedSeconds: m.fixedSeconds !== undefined ? m.fixedSeconds : cat.fixedSeconds,
            family: m.family || cat.family,
            route: m.route || cat.route,
            queryRoute: m.queryRoute || cat.queryRoute,
          };
        });
      }
      sendJson(res, 200, {
        ok: true,
        models,
      });
      return true;
    }
    // GET /api/user/usage
    if (req.method === 'GET' && url.pathname === '/api/user/usage') {
      const { user } = await authenticateRequest(req);
      const limit = url.searchParams.get('limit') || 20;
      const offset = url.searchParams.get('offset') || 0;
      const result = await getUserUsageLogs(user.id, { limit, offset });
      sendJson(res, 200, {
        ok: true,
        quotaBalance: user.quotaBalance,
        total: result.total,
        totalConsumed: result.totalConsumed,
        logs: result.logs,
      });
      return true;
    }

    // POST /api/user/topup (Demo top-up channel with prominent DEMO mark)
    if (req.method === 'POST' && url.pathname === '/api/user/topup') {
      const { user } = await authenticateRequest(req);
      const body = await parseBody(req);
      const amount = Math.max(1, Number(body.amount) || 100);
      const newBalance = await topupUserQuota(user.id, amount, {
        channel: 'demo',
        requestId: `topup-${Date.now()}`,
      });
      sendJson(res, 200, {
        ok: true,
        message: `[演示充值] 成功充值 ${amount} 积分`,
        amount,
        newBalance,
        isDemo: true,
      });
      return true;
    }

    // POST /api/auth/register
    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await parseBody(req);
      const { email, password, username } = body;
      const result = await registerUser({ email, password, username });

      sendJson(res, 200, {
        ok: true,
        userId: result.userId,
        message: '注册成功',
      });
      return true;
    }

    // POST /api/auth/login
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const { email, password } = body;
      const result = await loginUser({ email, password });

      sendJson(res, 200, {
        ok: true,
        token: result.token,
        expiresAt: new Date(result.expiresAt).toISOString(),
        user: result.user,
      });
      return true;
    }

    // POST /api/auth/logout
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = extractToken(req);
      if (!token) {
        sendJson(res, 401, {
          ok: false,
          error: '需要身份验证',
          category: 'permission',
        });
        return true;
      }

      await logoutUser(token);
      sendJson(res, 200, {
        ok: true,
        message: '登出成功',
      });
      return true;
    }

    // POST /api/auth/refresh
    if (req.method === 'POST' && url.pathname === '/api/auth/refresh') {
      const token = extractToken(req);
      if (!token) {
        sendJson(res, 401, {
          ok: false,
          error: '需要身份验证',
          category: 'permission',
        });
        return true;
      }

      const result = await refreshToken(token);
      sendJson(res, 200, {
        ok: true,
        token: result.token,
        expiresAt: new Date(result.expiresAt).toISOString(),
      });
      return true;
    }

    // GET /api/auth/me
    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      const token = extractToken(req);
      if (!token) {
        sendJson(res, 401, {
          ok: false,
          error: '需要身份验证',
          category: 'permission',
        });
        return true;
      }

      const user = await getUserFromToken(token);
      if (!user) {
        sendJson(res, 401, {
          ok: false,
          error: 'Token 无效或已过期',
          category: 'permission',
        });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        user,
      });
      return true;
    }

    return false;
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    sendJson(res, status, body);
    return true;
  }
}

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}
