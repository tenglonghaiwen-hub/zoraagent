/**
 * Login page handler
 */
import { login, register, isAuthenticated, getUser, logout, storeUser } from './auth.js';

// Initialize login page
export function initLoginPage() {
  const loginForm = document.querySelector('#login-form');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const loginButton = document.querySelector('#login-submit');
  const demoButton = document.getElementById('enter-demo');
  const statusEl = document.querySelector('#login .login-status');

  if (!loginForm) return;

  // Check if already authenticated
  if (isAuthenticated()) {
    const user = getUser();
    if (user) {
      showLoginStatus(`已登录：${user.username || user.email}（余额：${user.quotaBalance} 积分）`);
      setTimeout(() => {
        window.location.hash = '#studio';
      }, 1000);
      return;
    }
  }

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showLoginStatus('请填写邮箱和密码', 'error');
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = '登录中...';
    showLoginStatus('正在登录...', 'info');

    try {
      const result = await login(email, password);
      showLoginStatus(`登录成功！欢迎回来，${result.user.username || result.user.email}`, 'success');

      // Synchronously refresh header user menu without needing full page reload
      initUserMenu();

      setTimeout(() => {
        window.location.hash = '#studio';
      }, 500);
    } catch (error) {
      showLoginStatus(error.message || '登录失败，请检查邮箱和密码', 'error');
      loginButton.disabled = false;
      loginButton.textContent = '登录';
    }
  });

  // Keep demo mode
  if (demoButton) {
    demoButton.addEventListener('click', () => {
      window.location.hash = '#studio';
    });
  }

  function showLoginStatus(message, type = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'login-status ' + type;
    statusEl.hidden = false;
  }
}

// Clean user menu from header
export function clearUserMenu() {
  const existingMenu = document.querySelector('.user-menu');
  if (existingMenu) existingMenu.remove();

  const loginLink = document.querySelector('header a[href="#login"]');
  if (loginLink) loginLink.hidden = false;

  const creditsSpan = document.querySelector('.credits-link span');
  if (creditsSpan) creditsSpan.textContent = '— 积分';
}

// Initialize user menu in header
export function initUserMenu() {
  const user = getUser();
  if (!user) {
    clearUserMenu();
    return;
  }

  // Find or create header-right container
  let headerRight = document.querySelector('header .header-right');
  if (!headerRight) {
    const header = document.querySelector('header');
    if (!header) return;

    headerRight = document.createElement('div');
    headerRight.className = 'header-right';
    header.appendChild(headerRight);
  }

  // Hide the bare login link in header if authenticated
  const loginLink = document.querySelector('header a[href="#login"]');
  if (loginLink) {
    loginLink.hidden = true;
  }

  // Update studio credits and avatar if present
  const creditsLink = document.querySelector('.credits-link span');
  if (creditsLink) {
    creditsLink.textContent = `${user.quotaBalance} 积分`;
  }
  const avatar = document.querySelector('#account-menu-open.account-avatar');
  if (avatar) {
    avatar.textContent = (user.username || user.email || 'Z').charAt(0).toUpperCase();
  }

  // Remove existing user menu to re-render fresh state
  const existingMenu = document.querySelector('.user-menu');
  if (existingMenu) existingMenu.remove();

  // Create user menu
  const userMenu = document.createElement('div');
  userMenu.className = 'user-menu';
  userMenu.innerHTML = `
    <button type="button" class="user-button">
      <span class="user-name">${user.username || user.email}</span>
      <span class="user-balance">${user.quotaBalance} 积分</span>
    </button>
    <div class="user-dropdown" hidden>
      <div class="user-info">
        <div class="user-email">${user.email}</div>
        <div class="user-quota">余额：${user.quotaBalance} 积分</div>
      </div>
      <button type="button" id="user-logout" class="dropdown-item">登出</button>
    </div>
  `;

  // Toggle dropdown
  const userButton = userMenu.querySelector('.user-button');
  const dropdown = userMenu.querySelector('.user-dropdown');

  userButton.addEventListener('click', () => {
    dropdown.hidden = !dropdown.hidden;
  });

  // Logout
  const logoutButton = userMenu.querySelector('#user-logout');
  logoutButton.addEventListener('click', async () => {
    try {
      await logout();
      clearUserMenu();
      window.location.hash = '#welcome';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) {
      dropdown.hidden = true;
    }
  });

  headerRight.appendChild(userMenu);
}

// Update user balance display
export function updateUserBalance(newBalance) {
  const user = getUser();
  if (user) {
    user.quotaBalance = newBalance;
    storeUser(user);

    // Update UI
    const balanceEl = document.querySelector('.user-balance');
    if (balanceEl) {
      balanceEl.textContent = `${newBalance} 积分`;
    }

    const quotaEl = document.querySelector('.user-quota');
    if (quotaEl) {
      quotaEl.textContent = `余额：${newBalance} 积分`;
    }

    const creditsSpan = document.querySelector('.credits-link span');
    if (creditsSpan) {
      creditsSpan.textContent = `${newBalance} 积分`;
    }
  }
}
