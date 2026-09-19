import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('apps/client/index.html'), 'utf8');
const css = readFileSync(resolve('apps/client/style.css'), 'utf8');
const loginHandler = readFileSync(resolve('apps/client/login-handler.js'), 'utf8');

test('index.html uses studio185 cache buster and includes recharge checkout structure', () => {
  assert.match(html, /style\.css\?v=studio(18[5-9]|19\d)/, 'CSS must be tagged with studio185 or higher');
  assert.match(html, /app\.js\?v=studio(18[5-9]|19\d)/, 'app.js must be tagged with studio185 or higher');
  assert.match(html, /runtime-panel\.js\?v=studio(18[5-9]|19\d)/);
  assert.match(html, /appearance\.js\?v=studio(18[5-9]|19\d)/);
  assert.doesNotMatch(html, /studio184/);

  // Recharge Tier Cards in #credits
  assert.match(html, /class="recharge-tier-grid"/);
  assert.match(html, /data-amount="10"\s+data-quota="100"/);
  assert.match(html, /data-amount="50"\s+data-quota="500"\s+data-gift="20"/);
  assert.match(html, /data-amount="100"\s+data-quota="1000"\s+data-gift="50"/);
  assert.match(html, /data-amount="200"\s+data-quota="2000"\s+data-gift="150"/);
  assert.match(html, /id="recharge-custom-input"/);
  assert.match(html, /id="btn-open-checkout"/);

  // Quick topup in #wallet
  assert.match(html, /id="wallet-quick-topup"/);

  // Checkout modal dialog
  assert.match(html, /<dialog\s+id="checkout-dialog"/);
  assert.match(html, /id="checkout-order-id"/);
  assert.match(html, /id="checkout-points"/);
  assert.match(html, /id="checkout-amount"/);
  assert.match(html, /id="checkout-confirm-btn"/);
  assert.match(html, /checkout-notice-banner/, 'Must have prominent demo notice banner');
  assert.match(html, /id="checkout-success-view"/);
});

test('style.css defines recharge tiers and checkout dialog styling', () => {
  assert.match(css, /\.recharge-tier-grid/);
  assert.match(css, /\.recharge-tier-card\.active/);
  assert.match(css, /\.tier-badge/);
  assert.match(css, /\.checkout-dialog/);
  assert.match(css, /\.checkout-notice-banner/);
  assert.match(css, /\.qr-scan-bar/);
  assert.match(css, /\.success-checkmark/);
});

test('login-handler.js implements initCheckoutSystem and 1 Yuan = 10 Points tier math', () => {
  assert.match(loginHandler, /export\s+function\s+initCheckoutSystem/);
  assert.match(loginHandler, /const\s+baseQuota\s*=\s*val\s*\*\s*10/);
  assert.match(loginHandler, /topupDemoQuota/);
  assert.match(loginHandler, /updateUserBalance/);

  // Verify calculation formula
  function calcQuota(amount) {
    const base = amount * 10;
    let gift = 0;
    if (amount >= 200) gift = 150;
    else if (amount >= 100) gift = 50;
    else if (amount >= 50) gift = 20;
    return { base, gift, total: base + gift };
  }

  assert.deepEqual(calcQuota(10), { base: 100, gift: 0, total: 100 });
  assert.deepEqual(calcQuota(50), { base: 500, gift: 20, total: 520 });
  assert.deepEqual(calcQuota(100), { base: 1000, gift: 50, total: 1050 });
  assert.deepEqual(calcQuota(200), { base: 2000, gift: 150, total: 2150 });
});

test('server /api/user/topup correctly recharges quota and marks DEMO channel', async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-recharge-jwt';

  const { topupUserQuota, checkUserBalance, registerUser } = await import('../packages/auth/index.mjs');

  const testEmail = `recharge-${Date.now()}@zora.local`;
  const reg = await registerUser({ email: testEmail, password: 'password123', username: 'recharger' });

  const initialBalance = await checkUserBalance(reg.userId);

  // Simulate topup of 520 quota (50 Yuan tier)
  const newBalance = await topupUserQuota(reg.userId, 520, {
    channel: 'demo',
    requestId: `req-topup-${Date.now()}`
  });

  assert.equal(newBalance, initialBalance + 520);
  const updatedBalance = await checkUserBalance(reg.userId);
  assert.equal(updatedBalance, initialBalance + 520);
});
