/**
 * Login page handler
 */
import { login, register, isAuthenticated, getUser, logout, storeUser, fetchUsageLogs, topupDemoQuota } from './auth.js';

// Initialize login page
export function initLoginPage() {
  const loginForm = document.querySelector('#login-form');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const loginButton = document.querySelector('#login-submit');
  const demoButton = document.getElementById('enter-demo');
  const statusEl = document.querySelector('#login .login-status');

  // Also bind credits panel interactions
  initCreditsPanel();

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

  // Autofill test account on clicking hint
  const testHint = document.querySelector('#login .fine');
  if (testHint) {
    testHint.style.cursor = 'pointer';
    testHint.title = '点击一键填入测试账号';
    testHint.addEventListener('click', () => {
      emailInput.value = 'test@zora.local';
      passwordInput.value = 'test123';
      showLoginStatus('已填入测试账号 (test@zora.local / test123)，点击登录即可', 'info');
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

  const accountMenu = document.querySelector('#account-menu');
  if (accountMenu) {
    const nameEl = accountMenu.querySelector('.menu-profile strong');
    const statusEl = accountMenu.querySelector('.menu-profile small');
    if (nameEl) nameEl.textContent = '演示账户';
    if (statusEl) statusEl.textContent = '未登录';
    const signoutBtn = accountMenu.querySelector('#account-signout');
    if (signoutBtn) {
      signoutBtn.textContent = '退出演示';
      signoutBtn.onclick = null;
    }
  }
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

  const accountMenu = document.querySelector('#account-menu');
  if (accountMenu) {
    const nameEl = accountMenu.querySelector('.menu-profile strong');
    const statusEl = accountMenu.querySelector('.menu-profile small');
    if (nameEl) nameEl.textContent = user.username || user.email;
    if (statusEl) statusEl.textContent = `已登录 · 余额 ${user.quotaBalance} 积分`;
    const signoutBtn = accountMenu.querySelector('#account-signout');
    if (signoutBtn) {
      signoutBtn.textContent = '退出登录';
      signoutBtn.onclick = async () => {
        await logout();
        clearUserMenu();
        window.location.hash = '#welcome';
      };
    }
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
  initCreditsPanel();
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

    const overviewFirst = document.querySelector('#credits .account-overview strong');
    if (overviewFirst) {
      overviewFirst.textContent = `${newBalance} 积分`;
    }

    const accountMenuStatus = document.querySelector('#account-menu .menu-profile small');
    if (accountMenuStatus && accountMenuStatus.textContent.includes('已登录')) {
      accountMenuStatus.textContent = `已登录 · 余额 ${newBalance} 积分`;
    }
  }
}

let creditsPanelBound = false;

/**
 * Bind credits panel & wallet dialog to live usage data and demo recharge
 */
export function initCreditsPanel() {
  if (creditsPanelBound) return;
  creditsPanelBound = true;

  async function refreshCreditsView() {
    const user = getUser();
    if (!user) return;

    try {
      const data = await fetchUsageLogs({ limit: 15 });
      if (!data || !data.ok) return;

      const overviewEls = document.querySelectorAll('#credits .account-overview strong');
      if (overviewEls.length >= 3) {
        overviewEls[0].textContent = `${user.quotaBalance} 积分`;
        overviewEls[1].textContent = '0 积分';
        overviewEls[2].textContent = `${data.totalConsumed || 0} 积分`;
      }

      let logContainer = document.querySelector('#credits-log-container');
      if (!logContainer) {
        logContainer = document.createElement('div');
        logContainer.id = 'credits-log-container';
        logContainer.style.marginTop = '20px';
        const creditsMain = document.querySelector('#credits');
        if (creditsMain) creditsMain.appendChild(logContainer);
      }

      if (!data.logs || data.logs.length === 0) {
        logContainer.innerHTML = '<p class="muted">暂无积分流水明细。</p>';
      } else {
        const rowsHtml = data.logs.map((log) => {
          const timeStr = new Date(log.createdAt).toLocaleTimeString();
          const isTopup = log.resourceType === 'topup' || log.quotaCost < 0;
          const costText = isTopup ? `+${Math.abs(log.quotaCost)}` : `-${log.quotaCost}`;
          const costColor = isTopup ? '#10b981' : '#f59e0b';
          const typeName = log.resourceType === 'chat' ? 'Agent 对话' :
                           log.resourceType === 'generation' ? '创作生成' :
                           log.resourceType === 'topup' ? '演示充值' : log.resourceType;
          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 8px 6px; font-size: 13px;">${timeStr}</td>
              <td style="padding: 8px 6px; font-size: 13px;">${typeName}</td>
              <td style="padding: 8px 6px; font-size: 13px; font-family: monospace;">${log.modelId || '—'}</td>
              <td style="padding: 8px 6px; font-size: 13px; font-weight: bold; color: ${costColor};">${costText} 积分</td>
            </tr>
          `;
        }).join('');

        logContainer.innerHTML = `
          <h3 style="margin-top: 24px; margin-bottom: 10px; font-size: 15px;">积分明细流水（共 ${data.total} 条）</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.15); color: #888; font-size: 12px;">
                <th style="padding: 6px;">时间</th>
                <th style="padding: 6px;">类型</th>
                <th style="padding: 6px;">模型 / 渠道</th>
                <th style="padding: 6px;">积分变动</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }

      // Add demo topup button if not present in #credits
      const creditsTab = document.querySelector('#credits');
      let topupBtn = document.querySelector('#demo-topup-btn');
      if (!topupBtn && creditsTab) {
        topupBtn = document.createElement('button');
        topupBtn.id = 'demo-topup-btn';
        topupBtn.className = 'button';
        topupBtn.style.marginTop = '14px';
        topupBtn.style.padding = '8px 16px';
        topupBtn.style.cursor = 'pointer';
        topupBtn.style.display = 'inline-block';
        topupBtn.textContent = '【演示测试】补充 100 积分';
        topupBtn.title = '演示环境模拟充值，用于开发测试闭环';
        topupBtn.addEventListener('click', async () => {
          topupBtn.disabled = true;
          topupBtn.textContent = '充值中...';
          try {
            const res = await topupDemoQuota(100);
            updateUserBalance(res.newBalance);
            await refreshCreditsView();
          } catch (e) {
            alert(e.message || '充值失败');
          } finally {
            topupBtn.disabled = false;
            topupBtn.textContent = '【演示测试】补充 100 积分';
          }
        });

        const fieldset = creditsTab.querySelector('fieldset');
        if (fieldset && fieldset.parentNode) {
          fieldset.parentNode.insertBefore(topupBtn, fieldset.nextSibling);
        }
      }
    } catch (err) {
      console.warn('Failed to load usage logs:', err);
    }
  }

  // Hook tab changes
  document.querySelectorAll('[data-tab="credits"], .credits-link, #wallet-open').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(refreshCreditsView, 100);
    });
  });
}
