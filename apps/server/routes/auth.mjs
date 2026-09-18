/**
 * Authentication routes
 */
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  requireAuth,
  getUserFromToken,
} from '../../../packages/auth/index.mjs';
import { formatErrorResponse } from '../../../packages/agent/error-handling.mjs';

/**
 * Handle authentication routes
 * Returns true if the request was handled
 */
export async function handleAuthRoutes(req, res, url, { sendJson }) {
  // Only handle /api/auth/* routes
  if (!url.pathname.startsWith('/api/auth/')) {
    return false;
  }

  try {
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

    // Unknown auth route
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
        resolve(JSON.parse(data));
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
