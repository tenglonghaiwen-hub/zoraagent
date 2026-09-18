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
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || '注册失败');
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
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }

  clearAuth();
}

/**
 * Get current user info from server
 */
export async function getCurrentUser() {
  const token = getToken();

  if (!token) {
    return null;
  }

  const response = await fetch('/api/auth/me', {
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
 * Fetch with automatic authentication
 */
export async function authFetch(url, options = {}) {
  const token = getToken();

  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  const response = await fetch(url, options);

  // Handle 401 - redirect to login
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
