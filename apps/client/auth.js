/**
 * Authentication module for Zora client
 */

const TOKEN_KEY = 'zora.auth.token';
const USER_KEY = 'zora.auth.user';

/**
 * Store authentication token
 */
export function storeToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store token:', error);
  }
}

/**
 * Get stored token
 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

/**
 * Store user info
 */
export function storeUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to store user:', error);
  }
}

/**
 * Get stored user
 */
export function getUser() {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Clear authentication
 */
export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Failed to clear auth:', error);
  }
}

export const GATEWAY_MODE_KEY = 'zora.gateway.mode.v1';
export const GATEWAY_CLOUD_URL_KEY = 'zora.gateway.cloudUrl.v1';
export const GATEWAY_LOCAL_URL_KEY = 'zora.gateway.localUrl.v1';
export const DEFAULT_CLOUD_GATEWAY = 'https://zora-api.tenglonghaiwen.workers.dev';
export const DEFAULT_LOCAL_GATEWAY = 'http://127.0.0.1:4318';
export const DEFAULT_GATEWAY_MODE = 'cloud';

export function isLegacyGatewayUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().replace(/\/+$/, '');
  return (trimmed.includes('zora-api.workers.dev') || trimmed.includes('your-worker.workers.dev')) && !trimmed.includes('tenglonghaiwen');
}

export function getGatewayConfig() {
  let mode = DEFAULT_GATEWAY_MODE;
  let cloudUrl = DEFAULT_CLOUD_GATEWAY;
  let localUrl = DEFAULT_LOCAL_GATEWAY;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedMode = localStorage.getItem(GATEWAY_MODE_KEY);
      mode = storedMode || DEFAULT_GATEWAY_MODE;
      const storedCloud = localStorage.getItem(GATEWAY_CLOUD_URL_KEY);
      if (storedCloud && !isLegacyGatewayUrl(storedCloud)) {
        cloudUrl = storedCloud.trim().replace(/\/+$/, '');
      } else {
        cloudUrl = DEFAULT_CLOUD_GATEWAY;
        localStorage.setItem(GATEWAY_CLOUD_URL_KEY, cloudUrl);
      }
      localUrl = localStorage.getItem(GATEWAY_LOCAL_URL_KEY) || DEFAULT_LOCAL_GATEWAY;
    } catch {}
  }
  const effectiveBase = mode === 'cloud' ? cloudUrl.replace(/\/+$/, '') : (localUrl ? localUrl.replace(/\/+$/, '') : '');
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedBase = localStorage.getItem('zora.api.base');
      if (isLegacyGatewayUrl(storedBase)) {
        localStorage.setItem('zora.api.base', effectiveBase);
      }
    } catch {}
  }
  return {
    mode,
    cloudUrl,
    localUrl,
    effectiveBase
  };
}

export function setGatewayConfig({ mode, cloudUrl, localUrl }) {
  if (typeof window === 'undefined' || !window.localStorage) return getGatewayConfig();
  try {
    if (mode) window.localStorage.setItem(GATEWAY_MODE_KEY, mode);
    if (cloudUrl != null) {
      let finalCloud = cloudUrl.trim().replace(/\/+$/, '');
      if (isLegacyGatewayUrl(finalCloud)) {
        finalCloud = DEFAULT_CLOUD_GATEWAY;
      }
      window.localStorage.setItem(GATEWAY_CLOUD_URL_KEY, finalCloud);
    }
    if (localUrl != null) window.localStorage.setItem(GATEWAY_LOCAL_URL_KEY, localUrl.trim().replace(/\/+$/, ''));
    const config = getGatewayConfig();
    window.localStorage.setItem('zora.api.base', config.effectiveBase);
    return config;
  } catch (e) {
    console.error('Failed to save gateway config:', e);
    return getGatewayConfig();
  }
}

export async function testGatewayConnection(targetUrl) {
  const base = (targetUrl != null ? targetUrl : getApiBase() || '').replace(/\/+$/, '');
  const url = `${base}/api/models`;
  const startTime = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    const latency = Date.now() - startTime;
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${res.statusText}`, latency };
    }
    const data = await res.json();
    const modelCount = Array.isArray(data.models) ? data.models.length : 0;
    return { ok: true, latency, modelCount, models: data.models };
  } catch (err) {
    return { ok: false, error: err.message || '连接失败或超时', latency: Date.now() - startTime };
  }
}

export function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.ZORA_API_BASE) {
      if (isLegacyGatewayUrl(window.ZORA_API_BASE)) return DEFAULT_CLOUD_GATEWAY;
      return window.ZORA_API_BASE.replace(/\/+$/, '');
    }
    const cfg = getGatewayConfig();
    if (cfg && cfg.effectiveBase) {
      if (isLegacyGatewayUrl(cfg.effectiveBase)) return DEFAULT_CLOUD_GATEWAY;
      return cfg.effectiveBase;
    }
    const stored = (window.localStorage && window.localStorage.getItem('zora.api.base')) || null;
    if (stored) {
      if (isLegacyGatewayUrl(stored)) return DEFAULT_CLOUD_GATEWAY;
      return stored.replace(/\/+$/, '');
    }
  }
  return DEFAULT_CLOUD_GATEWAY;
}

export function apiUrl(path) {
  const base = getApiBase();
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Login with email and password
 */
export async function login(email, password) {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username: email }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || '登录失败');
  }

  storeToken(data.token);
  storeUser(data.user);

  return data;
}

/**
 * Register new user
 */
export async function register(email, password, username) {
  const response = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username: username || email }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || '注册失败');
  }

  if (data.token) {
    storeToken(data.token);
  }
  if (data.user) {
    storeUser(data.user);
  }

  return data;
}

/**
 * Logout
 */
export async function logout() {
  const token = getToken();

  if (token) {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }

  clearAuth();
}

let isRefreshing = null;

/**
 * Refresh authentication token
 */
export async function refreshToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();
    if (data.ok && data.token) {
      storeToken(data.token);
      return data;
    }
  } catch (err) {
    console.warn('Token refresh failed:', err);
  }
  return null;
}

/**
 * Get current user info from server
 */
export async function getCurrentUser() {
  const token = getToken();

  if (!token) {
    return null;
  }

  const response = await fetch(apiUrl('/api/auth/me'), {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();

  if (!data.ok) {
    clearAuth();
    return null;
  }

  storeUser(data.user);
  return data.user;
}

/**
 * Fetch with automatic authentication, token refresh, and balance sync
 */
export async function authFetch(url, options = {}, isRetry = false) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const finalUrl = apiUrl(url);
  const response = await fetch(finalUrl, { ...options, headers });

  // Handle 401 - try refresh token once if not a retry and not already an auth endpoint
  if (response.status === 401 && !isRetry && token && !url.includes('/api/auth/')) {
    try {
      if (!isRefreshing) {
        isRefreshing = refreshToken().finally(() => {
          isRefreshing = null;
        });
      }
      const refreshed = await isRefreshing;
      if (refreshed && refreshed.token) {
        // Retry original request with new token
        return authFetch(url, options, true);
      }
    } catch {
      // Refresh failed, proceed to logout
    }

    clearAuth();
    window.location.hash = '#login';
    throw new Error('登录已过期，请重新登录');
  }

  if (response.status === 401) {
    clearAuth();
    window.location.hash = '#login';
    throw new Error('需要重新登录');
  }

  // Intercept and auto-update user balance if returned in JSON response
  try {
    const cloned = response.clone();
    cloned.json().then((data) => {
      if (data && typeof data.newBalance === 'number') {
        import('./login-handler.js').then(({ updateUserBalance }) => {
          updateUserBalance(data.newBalance);
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  return response;
}

/**
 * Fetch user usage logs and consumption totals
 */
export async function fetchUsageLogs({ limit = 20, offset = 0 } = {}) {
  const res = await authFetch(`/api/user/usage?limit=${limit}&offset=${offset}`);
  return res.json();
}

/**
 * Top up demo quota (prominently marked as demo in UI and server audit)
 */
export async function topupDemoQuota(amount = 100) {
  const res = await authFetch('/api/user/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  return res.json();
}

/**
 * Fetch server models list
 */
export async function fetchServerModels() {
  const res = await fetch(apiUrl('/api/models'));
  return res.json();
}

/**
 * Fetch official & personal messages from server / gateway
 */
export async function fetchMessages() {
  const token = getToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(apiUrl('/api/messages'), { headers });
  return res.json();
}

