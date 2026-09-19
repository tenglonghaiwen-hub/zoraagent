/**
 * Login page handler
 */
import { login, register, isAuthenticated, getUser, logout, storeUser, fetchUsageLogs, topupDemoQuota, upgradeMembership } from './auth.js';

// Initialize login page
export function initLoginPage() {
  const loginForm = document.querySelector('#login-form');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const loginButton = document.querySelector('#login-submit');
  const registerButton = document.querySelector('#login-register-btn');
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
    if (registerButton) registerButton.disabled = true;
    showLoginStatus('正在连接造境云端网关登录...', 'info');

    try {
      const result = await login(email, password);
      showLoginStatus(`登录成功！欢迎回来，${result.user.username || result.user.email}（余额：${result.user.quotaBalance || result.user.balance || 0} 积分）`, 'success');

      // Synchronously refresh header user menu without needing full page reload
      initUserMenu();

      setTimeout(() => {
        window.location.hash = '#studio';
      }, 500);
    } catch (error) {
      showLoginStatus(error.message || '登录失败，请检查邮箱和密码', 'error');
      loginButton.disabled = false;
      loginButton.textContent = '登录';
      if (registerButton) registerButton.disabled = false;
    }
  });

  // Handle user registration
  if (registerButton) {
    registerButton.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !email.includes('@')) {
        showLoginStatus('注册请提供有效的电子邮箱地址', 'error');
        emailInput.focus();
        return;
      }
      if (!password || password.length < 6) {
        showLoginStatus('注册密码长度至少为 6 个字符', 'error');
        passwordInput.focus();
        return;
      }

      registerButton.disabled = true;
      registerButton.textContent = '注册中...';
      if (loginButton) loginButton.disabled = true;
      showLoginStatus('正在为您开通新账户并赠送初始积分...', 'info');

      try {
        const result = await register(email, password);
        showLoginStatus(`注册成功！欢迎加入造境，赠送 ${(result.user && result.user.quotaBalance) || 100} 积分，正在进入工作台...`, 'success');
        initUserMenu();
        setTimeout(() => {
          window.location.hash = '#studio';
        }, 600);
      } catch (error) {
        showLoginStatus(error.message || '注册失败，请稍后重试', 'error');
        registerButton.disabled = false;
        registerButton.textContent = '注册账号';
        if (loginButton) loginButton.disabled = false;
      }
    });
  }

  // Keep demo mode
  if (demoButton) {
    demoButton.addEventListener('click', () => {
      window.location.hash = '#studio';
    });
  }

  // Autofill test account on clicking hint
  const testHint = document.querySelector('#test-account-hint') || document.querySelector('#login .fine');
  if (testHint) {
    testHint.style.cursor = 'pointer';
    testHint.title = '点击一键填入并直接登录';
    testHint.addEventListener('click', () => {
      emailInput.value = 'test@zora.local';
      passwordInput.value = 'test123';
      showLoginStatus('已填入测试账号，正在自动登录...', 'info');
      // Directly trigger form submit for maximum ease-of-use
      if (typeof loginForm.requestSubmit === 'function') {
        loginForm.requestSubmit();
      } else {
        loginButton.click();
      }
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

  updateUserVipUI(null);
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
  updateUserVipUI(user);
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

      // Initialize structured recharge tiers and checkout modal
      initCheckoutSystem(refreshCreditsView);
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

  // Also bind checkout controls on first mount
  initCheckoutSystem(refreshCreditsView);
}

let checkoutSystemBound = false;

/**
 * Initialize structured recharge tiers and demo checkout modal
 */
export function initCheckoutSystem(onRechargeSuccess = () => {}) {
  if (checkoutSystemBound) return;
  checkoutSystemBound = true;

  let currentRecharge = {
    amount: 10,
    quota: 100,
    gift: 0,
    method: 'alipay'
  };

  let countdownInterval = null;

  // 1. Recharge tier selection
  const tierCards = document.querySelectorAll('.recharge-tier-card');
  const customInput = document.querySelector('#recharge-custom-input');
  const customCalc = document.querySelector('#recharge-custom-calc');

  tierCards.forEach((card) => {
    card.addEventListener('click', () => {
      tierCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      if (customInput) customInput.value = '';

      const amount = Number(card.dataset.amount) || 10;
      const quota = Number(card.dataset.quota) || amount * 10;
      const gift = Number(card.dataset.gift) || 0;

      currentRecharge.amount = amount;
      currentRecharge.quota = quota;
      currentRecharge.gift = gift;

      if (customCalc) {
        customCalc.textContent = `预计获得：${quota + gift} 积分${gift > 0 ? ` (含赠送 ${gift} 分)` : ''}`;
      }
    });
  });

  // 2. Custom recharge amount input
  if (customInput) {
    customInput.addEventListener('input', () => {
      const val = parseInt(customInput.value, 10);
      if (!val || val <= 0) {
        if (customCalc) customCalc.textContent = '预计获得：— 积分';
        return;
      }

      tierCards.forEach((c) => c.classList.remove('active'));

      const baseQuota = val * 10; // 1 元 = 10 积分
      let gift = 0;
      if (val >= 200) gift = 150;
      else if (val >= 100) gift = 50;
      else if (val >= 50) gift = 20;

      currentRecharge.amount = val;
      currentRecharge.quota = baseQuota;
      currentRecharge.gift = gift;

      if (customCalc) {
        customCalc.textContent = `预计获得：${baseQuota + gift} 积分${gift > 0 ? ` (含赠送 ${gift} 分)` : ''}`;
      }
    });
  }

  // 3. Payment method radios
  document.querySelectorAll('input[name="credit-payment"], input[name="wallet-payment"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      currentRecharge.method = e.target.value;
      // Synchronize radios across views
      document.querySelectorAll(`input[name="credit-payment"][value="${e.target.value}"], input[name="wallet-payment"][value="${e.target.value}"]`).forEach((r) => {
        r.checked = true;
      });
    });
  });

  // 4. Checkout Dialog Elements
  const checkoutDialog = document.querySelector('#checkout-dialog');
  const checkoutOrderId = document.querySelector('#checkout-order-id');
  const checkoutItemName = document.querySelector('#checkout-item-name');
  const checkoutPoints = document.querySelector('#checkout-points');
  const checkoutMethodName = document.querySelector('#checkout-method-name');
  const checkoutAmount = document.querySelector('#checkout-amount');
  const checkoutTimer = document.querySelector('#checkout-timer');
  const checkoutMainBody = document.querySelector('#checkout-main-body');
  const checkoutSuccessView = document.querySelector('#checkout-success-view');
  const checkoutSuccessDesc = document.querySelector('#checkout-success-desc');
  const checkoutActionsBar = document.querySelector('#checkout-actions-bar');
  const checkoutConfirmBtn = document.querySelector('#checkout-confirm-btn');
  const checkoutCloseBtn = document.querySelector('#checkout-close');
  const checkoutCancelBtn = document.querySelector('#checkout-cancel-btn');

  let activeCheckout = {
    type: 'credits',
    title: '造境创作积分充值',
    amount: 10,
    quota: 100,
    gift: 0,
    method: 'alipay',
    membershipTier: 'monthly',
    membershipDays: 30
  };

  function openCheckout(customOptions = null) {
    const user = getUser();
    if (!user) {
      alert('请先登录账户后再进行开通或充值');
      window.location.hash = '#login';
      return;
    }

    if (!checkoutDialog) return;

    // Reset view states
    if (checkoutMainBody) checkoutMainBody.hidden = false;
    if (checkoutActionsBar) checkoutActionsBar.hidden = false;
    if (checkoutSuccessView) checkoutSuccessView.hidden = true;
    if (checkoutConfirmBtn) {
      checkoutConfirmBtn.disabled = false;
      checkoutConfirmBtn.textContent = '模拟完成支付 (确认入账)';
    }

    if (customOptions && customOptions.type === 'membership') {
      activeCheckout = {
        type: 'membership',
        title: customOptions.title || '造境 VIP 会员',
        amount: Number(customOptions.amount) || 19,
        gift: Number(customOptions.gift) || 0,
        method: customOptions.method || 'alipay',
        membershipTier: customOptions.tier || 'monthly',
        membershipDays: customOptions.days != null ? customOptions.days : 30,
        concurrency: customOptions.concurrency || 2
      };

      const orderNo = 'ORD-VIP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
      if (checkoutOrderId) checkoutOrderId.textContent = orderNo;
      if (checkoutItemName) checkoutItemName.textContent = activeCheckout.title;
      if (checkoutPoints) {
        const periodStr = activeCheckout.membershipDays === -1 ? '终身永久' : `${activeCheckout.membershipDays}天`;
        checkoutPoints.textContent = `赠送 ${activeCheckout.gift} 积分 · ${periodStr} VIP 特权`;
      }
      const isWechat = activeCheckout.method === 'wechat';
      if (checkoutMethodName) {
        checkoutMethodName.textContent = isWechat ? '微信支付' : '支付宝';
        checkoutMethodName.className = `value pay-badge ${isWechat ? 'wechat' : 'alipay'}`;
      }
      if (checkoutAmount) {
        checkoutAmount.textContent = `￥${activeCheckout.amount.toFixed(2)}`;
      }
    } else {
      activeCheckout = {
        type: 'credits',
        title: '造境创作积分充值',
        amount: currentRecharge.amount,
        quota: currentRecharge.quota,
        gift: currentRecharge.gift,
        method: currentRecharge.method
      };

      const orderNo = 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
      if (checkoutOrderId) checkoutOrderId.textContent = orderNo;
      if (checkoutItemName) checkoutItemName.textContent = activeCheckout.title;
      const totalPoints = currentRecharge.quota + currentRecharge.gift;
      if (checkoutPoints) {
        checkoutPoints.textContent = `${totalPoints} 积分${currentRecharge.gift > 0 ? ` (含赠 ${currentRecharge.gift})` : ''}`;
      }
      const isWechat = currentRecharge.method === 'wechat';
      if (checkoutMethodName) {
        checkoutMethodName.textContent = isWechat ? '微信支付' : '支付宝';
        checkoutMethodName.className = `value pay-badge ${isWechat ? 'wechat' : 'alipay'}`;
      }
      if (checkoutAmount) {
        checkoutAmount.textContent = `￥${currentRecharge.amount.toFixed(2)}`;
      }
    }

    // Start 5-minute mock countdown
    let secondsLeft = 299;
    if (countdownInterval) clearInterval(countdownInterval);
    function updateCountdown() {
      const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
      const s = String(secondsLeft % 60).padStart(2, '0');
      if (checkoutTimer) checkoutTimer.textContent = `${m}:${s}`;
      if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
      } else {
        secondsLeft--;
      }
    }
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);

    // Open modal
    if (typeof checkoutDialog.showModal === 'function') {
      try {
        checkoutDialog.showModal();
      } catch {
        checkoutDialog.hidden = false;
      }
    } else {
      checkoutDialog.hidden = false;
    }
  }

  // Export helper globally for direct invocation from test or membership
  window.__openCheckout = openCheckout;

  function closeCheckout() {
    if (countdownInterval) clearInterval(countdownInterval);
    if (!checkoutDialog) return;
    if (typeof checkoutDialog.close === 'function') {
      try {
        checkoutDialog.close();
      } catch {
        checkoutDialog.hidden = true;
      }
    } else {
      checkoutDialog.hidden = true;
    }
  }

  // Bind Open Buttons
  const openCheckoutBtn = document.querySelector('#btn-open-checkout');
  if (openCheckoutBtn) {
    openCheckoutBtn.addEventListener('click', () => openCheckout({ type: 'credits' }));
  }

  const walletQuickTopup = document.querySelector('#wallet-quick-topup');
  if (walletQuickTopup) {
    walletQuickTopup.addEventListener('click', () => {
      const walletDialog = document.querySelector('#wallet');
      if (walletDialog && typeof walletDialog.close === 'function') {
        walletDialog.close();
      }
      openCheckout({ type: 'credits' });
    });
  }

  // Bind Close Buttons
  if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckout);
  if (checkoutCancelBtn) checkoutCancelBtn.addEventListener('click', closeCheckout);

  // Bind Confirm Mock Payment
  if (checkoutConfirmBtn) {
    checkoutConfirmBtn.addEventListener('click', async () => {
      checkoutConfirmBtn.disabled = true;
      checkoutConfirmBtn.textContent = '入账处理中...';

      try {
        if (activeCheckout.type === 'membership') {
          const res = await upgradeMembership({
            days: activeCheckout.membershipDays,
            giftQuota: activeCheckout.gift,
            tier: activeCheckout.membershipTier
          });

          // Update balances & VIP status
          if (typeof res.newBalance === 'number') {
            updateUserBalance(res.newBalance);
          }
          updateUserVipUI();

          // Show success state
          if (checkoutMainBody) checkoutMainBody.hidden = true;
          if (checkoutActionsBar) checkoutActionsBar.hidden = true;
          if (checkoutSuccessView) {
            checkoutSuccessView.hidden = false;
            if (checkoutSuccessDesc) {
              checkoutSuccessDesc.textContent = `🎉 恭喜！已成功开通【${activeCheckout.title}】，赠送 ${activeCheckout.gift} 积分已入账，VIP 尊享特权与满血并发已全面生效！`;
            }
          }

          // Dispatch event
          window.dispatchEvent(new CustomEvent('zora:vip-updated', { detail: res }));

          if (typeof onRechargeSuccess === 'function') {
            onRechargeSuccess();
          }

          setTimeout(() => {
            closeCheckout();
          }, 1800);
        } else {
          const totalPoints = currentRecharge.quota + currentRecharge.gift;
          const res = await topupDemoQuota(totalPoints);

          // Update balances everywhere
          updateUserBalance(res.newBalance);

          // Show success state
          if (checkoutMainBody) checkoutMainBody.hidden = true;
          if (checkoutActionsBar) checkoutActionsBar.hidden = true;
          if (checkoutSuccessView) {
            checkoutSuccessView.hidden = false;
            if (checkoutSuccessDesc) {
              checkoutSuccessDesc.textContent = `已成功充值 ${totalPoints} 积分，当前可用余额：${res.newBalance} 积分。`;
            }
          }

          // Trigger parent ledger refresh
          if (typeof onRechargeSuccess === 'function') {
            onRechargeSuccess();
          }

          // Auto close after 1.6s
          setTimeout(() => {
            closeCheckout();
          }, 1600);
        }
      } catch (err) {
        alert(err.message || '模拟支付处理失败，请检查服务连接');
        checkoutConfirmBtn.disabled = false;
        checkoutConfirmBtn.textContent = '模拟完成支付 (确认入账)';
      }
    });
  }

  // Update wallet dialog status if opened
  const walletDialog = document.querySelector('#wallet');
  if (walletDialog) {
    const statusEl = walletDialog.querySelector('#wallet-user-status');
    const updateWalletStatus = () => {
      const u = getUser();
      if (statusEl) {
        if (u) {
          statusEl.textContent = `当前账户：${u.username || u.email} · 余额：${u.quotaBalance} 积分`;
        } else {
          statusEl.textContent = '当前未登录，暂无余额和消费记录。';
        }
      }
    };
    document.querySelectorAll('#wallet-open').forEach((wBtn) => {
      wBtn.addEventListener('click', updateWalletStatus);
    });
  }
}

/**
 * Synchronize VIP status across Membership view, Account center, and Header toolbar
 */
export function updateUserVipUI(user = getUser()) {
  const isVip = Boolean(user && user.isVip);
  const vipExpiresAt = Number(user && user.vipExpiresAt) || 0;
  const now = Date.now();
  const isExpired = isVip && vipExpiresAt > 0 && vipExpiresAt < now;
  const isEffectiveVip = isVip && !isExpired;

  // 1. Membership hero user card
  const userNameEl = document.querySelector('#vip-user-name');
  const userAvatarEl = document.querySelector('#vip-user-avatar');
  const statusBadgeEl = document.querySelector('#vip-status-badge');
  const expireTextEl = document.querySelector('#vip-expire-text');
  const concurrencyTextEl = document.querySelector('#vip-concurrency-text');
  const creditsTextEl = document.querySelector('#vip-credits-text');
  const quickActionBtn = document.querySelector('#btn-vip-scroll-tiers');

  if (userNameEl) {
    userNameEl.textContent = user ? (user.username || user.email || '造境创作者') : '演示创作者';
  }
  if (userAvatarEl) {
    const initial = (user && (user.username || user.email) || 'Z').charAt(0).toUpperCase();
    userAvatarEl.textContent = initial;
    userAvatarEl.classList.toggle('vip-avatar', isEffectiveVip);
  }
  if (creditsTextEl) {
    creditsTextEl.textContent = user ? `${user.quotaBalance || 0} 分` : '— 分';
  }

  if (isEffectiveVip) {
    if (statusBadgeEl) {
      statusBadgeEl.textContent = '👑 尊贵 VIP 会员';
      statusBadgeEl.className = 'vip-status-badge vip-active';
    }
    if (expireTextEl) {
      if (vipExpiresAt === -1) {
        expireTextEl.textContent = '终身永久 VIP · 尊享无限';
      } else {
        const d = new Date(vipExpiresAt);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        expireTextEl.textContent = `有效期至 ${ymd}`;
      }
    }
    if (concurrencyTextEl) {
      concurrencyTextEl.textContent = `${user.concurrencyLimit || 4} 任务 (满血并发)`;
    }
    if (quickActionBtn) {
      quickActionBtn.textContent = '续费 VIP';
    }
  } else {
    if (statusBadgeEl) {
      statusBadgeEl.textContent = isExpired ? 'VIP 已过期' : '普通创作者';
      statusBadgeEl.className = 'vip-status-badge';
    }
    if (expireTextEl) {
      expireTextEl.textContent = isExpired ? '会员权益已到期，请续费恢复' : '尚未开通 VIP 会员';
    }
    if (concurrencyTextEl) {
      concurrencyTextEl.textContent = '1 任务 (标准并发)';
    }
    if (quickActionBtn) {
      quickActionBtn.textContent = '立即升级 VIP';
    }
  }

  // 2. Account Center (#account)
  const accountNameEl = document.querySelector('#account-profile-name');
  const accountEmailEl = document.querySelector('#account-profile-email');
  const accountVipDesc = document.querySelector('#account-vip-desc');
  const accountVipBtn = document.querySelector('#account-vip-btn');
  const accountCreditsDesc = document.querySelector('#account-credits-desc');

  if (accountNameEl && user) accountNameEl.textContent = user.username || user.email || '造境创作者';
  if (accountEmailEl && user) accountEmailEl.textContent = user.email || '已登录真实账户';
  if (accountCreditsDesc && user) accountCreditsDesc.textContent = `当前可用积分：${user.quotaBalance || 0} 积分`;

  if (accountVipDesc) {
    if (isEffectiveVip) {
      const exp = vipExpiresAt === -1 ? '终身永久' : `至 ${new Date(vipExpiresAt).toISOString().slice(0, 10)}`;
      accountVipDesc.innerHTML = `<strong style="color: #fbbf24;">👑 造境 VIP 会员</strong> (${exp})`;
    } else {
      accountVipDesc.textContent = isExpired ? 'VIP 会员已到期（普通权益）' : '普通创作者（未开通 VIP）';
    }
  }
  if (accountVipBtn) {
    accountVipBtn.textContent = isEffectiveVip ? '续费 / 管理会员' : '立即开通 VIP';
  }

  // 3. Header toolbar membership link
  const memLink = document.querySelector('.membership-link');
  if (memLink) {
    if (isEffectiveVip) {
      memLink.textContent = '👑 VIP 会员';
      memLink.classList.add('is-vip');
    } else {
      memLink.textContent = '开会员';
      memLink.classList.remove('is-vip');
    }
  }
}

let membershipPanelBound = false;

/**
 * Initialize membership section interactions and pricing tier selection
 */
export function initMembershipPanel() {
  if (membershipPanelBound) return;
  membershipPanelBound = true;

  // Initial state render
  updateUserVipUI();

  let selectedTier = {
    tier: 'yearly',
    days: 365,
    price: 169,
    gift: 1000,
    concurrency: 4,
    title: '年度 VIP (365天)'
  };

  const tierCards = document.querySelectorAll('.membership-tier-card');
  const titleEl = document.querySelector('#membership-selected-title');
  const privilegesEl = document.querySelector('#membership-selected-privileges');
  const priceAmountEl = document.querySelector('#membership-pay-amount');
  const checkoutBtn = document.querySelector('#btn-membership-checkout');
  const scrollTiersBtn = document.querySelector('#btn-vip-scroll-tiers');

  function updateSelectedTier(card) {
    tierCards.forEach((c) => c.classList.remove('active'));
    card.classList.add('active');

    const tier = card.dataset.tier || 'monthly';
    const days = parseInt(card.dataset.days, 10);
    const price = Number(card.dataset.price) || 19;
    const gift = Number(card.dataset.gift) || 0;
    const concurrency = Number(card.dataset.concurrency) || 2;
    const cardTitle = card.querySelector('.tier-name')?.textContent || 'VIP 会员';

    selectedTier = {
      tier,
      days,
      price,
      gift,
      concurrency,
      title: `${cardTitle} (${days === -1 ? '终身永久' : days + '天'})`
    };

    if (titleEl) titleEl.textContent = selectedTier.title;
    if (privilegesEl) {
      privilegesEl.textContent = `赠送 ${gift} 积分 · ${concurrency} 并发 · 解锁全部高阶模型`;
    }
    if (priceAmountEl) {
      priceAmountEl.textContent = `￥${price.toFixed(2)}`;
    }
  }

  tierCards.forEach((card) => {
    card.addEventListener('click', () => {
      updateSelectedTier(card);
    });
  });

  // Scroll to tiers button in hero
  if (scrollTiersBtn) {
    scrollTiersBtn.addEventListener('click', () => {
      const section = document.querySelector('#membership-pricing-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Trigger Checkout
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="membership-payment"]:checked');
      const method = selectedRadio ? selectedRadio.value : 'alipay';

      if (typeof window.__openCheckout === 'function') {
        window.__openCheckout({
          type: 'membership',
          title: selectedTier.title,
          amount: selectedTier.price,
          gift: selectedTier.gift,
          tier: selectedTier.tier,
          days: selectedTier.days,
          concurrency: selectedTier.concurrency,
          method
        });
      } else {
        alert('收银台组件正在准备中，请稍候重试');
      }
    });
  }

  // Tab and hash changes
  document.querySelectorAll('[data-tab="membership"], .membership-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(updateUserVipUI, 100);
    });
  });

  window.addEventListener('zora:vip-updated', () => {
    updateUserVipUI();
  });
}

// Ensure membership panel interactions are initialized on client startup
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initMembershipPanel();
    });
  } else {
    initMembershipPanel();
  }
}
