import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { upgradeUserMembership, setUserVip } from '../apps/cloudflare-worker/src/billing.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('index.html contains comprehensive VIP membership center and account bindings', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/client/index.html'), 'utf8');

  // 1. Membership Section Root & Hero
  assert.match(html, /<main\s+id="membership"\s+class="[^"]*membership-page/);
  assert.match(html, /id="membership-user-card"/);
  assert.match(html, /id="vip-status-badge"/);
  assert.match(html, /id="vip-expire-text"/);
  assert.match(html, /id="vip-concurrency-text"/);
  assert.match(html, /id="btn-vip-scroll-tiers"/);

  // 2. 4 Pricing Tiers
  assert.match(html, /class="membership-tier-grid"/);
  assert.match(html, /data-tier="monthly"\s+data-days="30"\s+data-price="19"\s+data-gift="50"\s+data-concurrency="2"/);
  assert.match(html, /data-tier="quarterly"\s+data-days="90"\s+data-price="49"\s+data-gift="200"\s+data-concurrency="3"/);
  assert.match(html, /data-tier="yearly"\s+data-days="365"\s+data-price="169"\s+data-gift="1000"\s+data-concurrency="4"/);
  assert.match(html, /data-tier="lifetime"\s+data-days="-1"\s+data-price="399"\s+data-gift="3000"\s+data-concurrency="4"/);

  // 3. Checkout Trigger & Selection Bar
  assert.match(html, /id="membership-selected-title"/);
  assert.match(html, /id="membership-selected-privileges"/);
  assert.match(html, /id="membership-pay-amount"/);
  assert.match(html, /name="membership-payment"/);
  assert.match(html, /id="btn-membership-checkout"/);

  // 4. Privileges Grid & Comparison Table
  assert.match(html, /class="membership-privileges-grid"/);
  assert.match(html, /class="privilege-card"/);
  assert.match(html, /class="membership-compare-table"/);

  // 5. Account Center Linkage
  assert.match(html, /id="account-vip-row"/);
  assert.match(html, /id="account-vip-desc"/);
  assert.match(html, /id="account-vip-btn"/);
});

test('style.css defines luxury dark-gold styling and day mode contrast for membership', () => {
  const css = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');

  assert.match(css, /\.membership-hero-wrap/);
  assert.match(css, /\.membership-tier-grid/);
  assert.match(css, /\.membership-tier-card\.active/);
  assert.match(css, /\.vip-status-badge\.vip-active/);
  assert.match(css, /\.membership-pay-btn/);
  assert.match(css, /\.membership-privileges-grid/);
  assert.match(css, /\.membership-compare-table/);

  // Day theme overrides
  assert.match(css, /html\[data-theme="day"\]\s+\.membership-hero-wrap/);
  assert.match(css, /html\[data-theme="day"\]\s+\.membership-tier-card/);
  assert.match(css, /html\[data-theme="day"\]\s+\.membership-compare-table/);
});

test('login-handler.js implements membership initialization and VIP state sync', () => {
  const code = fs.readFileSync(path.join(ROOT, 'apps/client/login-handler.js'), 'utf8');

  assert.match(code, /export\s+function\s+updateUserVipUI/);
  assert.match(code, /export\s+function\s+initMembershipPanel/);
  assert.match(code, /activeCheckout\.type\s*===\s*'membership'/);
  assert.match(code, /upgradeMembership\(/);
  assert.match(code, /zora:vip-updated/);
});

test('Cloudflare Worker upgradeUserMembership correctly sets expiration, concurrency, and bonus points', async () => {
  const usersTable = new Map([
    ['u-test-1', {
      id: 'u-test-1',
      email: 'vip@test.local',
      username: 'VIP测试员',
      quotaBalance: 50,
      isVip: 0,
      vipExpiresAt: 0,
      concurrencyLimit: 1,
      status: 'active'
    }]
  ]);
  const usageLogs = [];

  const d1Mock = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE id = ?')) {
                const user = usersTable.get(params[0]);
                if (!user) return null;
                return {
                  isVip: user.isVip,
                  vipExpiresAt: user.vipExpiresAt,
                  quotaBalance: user.quotaBalance,
                  concurrencyLimit: user.concurrencyLimit
                };
              }
              return null;
            },
            async run() {
              if (sql.includes('UPDATE users SET is_vip = 1')) {
                // UPDATE users SET is_vip = 1, vip_expires_at = ?, concurrency_limit = ?, quota_balance = ?, updated_at = ? WHERE id = ?
                const [newExpiresAt, newConcurrency, newBalance, now, userId] = params;
                const user = usersTable.get(userId);
                if (user) {
                  user.isVip = 1;
                  user.vipExpiresAt = newExpiresAt;
                  user.concurrencyLimit = newConcurrency;
                  user.quotaBalance = newBalance;
                }
                return { success: true };
              }
              if (sql.includes('INSERT INTO usage_logs')) {
                // INSERT INTO usage_logs (id, user_id, type, amount, balance_after, details, created_at) VALUES (?, ?, 'topup', ?, ?, ?, ?)
                const [id, user_id, amount, balance_after, details, created_at] = params;
                usageLogs.push({ id, user_id, type: 'topup', amount, balance_after, details, created_at });
                return { success: true };
              }
              return { success: true };
            }
          };
        }
      };
    }
  };

  // 1. Initial Upgrade to Monthly (30 days, 50 gift quota, 2 concurrency)
  const res1 = await upgradeUserMembership(d1Mock, 'u-test-1', {
    days: 30,
    giftQuota: 50,
    tier: 'monthly'
  });

  assert.equal(res1.isVip, true);
  assert.equal(res1.concurrencyLimit, 2);
  assert.equal(res1.newBalance, 100); // 50 + 50
  assert.ok(res1.vipExpiresAt > Date.now());

  // Check DB state
  const u1 = usersTable.get('u-test-1');
  assert.equal(u1.isVip, 1);
  assert.equal(u1.concurrencyLimit, 2);
  assert.equal(u1.quotaBalance, 100);

  // 2. Renew with Yearly (365 days, 1000 gift quota, 4 concurrency)
  // Should extend existing expiration
  const originalExpiry = u1.vipExpiresAt;
  const res2 = await upgradeUserMembership(d1Mock, 'u-test-1', {
    days: 365,
    giftQuota: 1000,
    tier: 'yearly'
  });

  assert.equal(res2.isVip, true);
  assert.equal(res2.concurrencyLimit, 4);
  assert.equal(res2.newBalance, 1100); // 100 + 1000
  assert.equal(res2.vipExpiresAt, originalExpiry + (365 * 86400000));

  // 3. Upgrade to Lifetime (-1 days, 3000 gift quota)
  const res3 = await upgradeUserMembership(d1Mock, 'u-test-1', {
    days: -1,
    giftQuota: 3000,
    tier: 'lifetime'
  });

  assert.equal(res3.vipExpiresAt, -1);
  assert.equal(res3.concurrencyLimit, 4);
  assert.equal(res3.newBalance, 4100);

  // Check audit logs
  assert.equal(usageLogs.length, 3);
  assert.match(usageLogs[0].details, /membership_upgrade/);
});

test('Admin setUserVip correctly configures VIP status, expiration, and concurrency limit', async () => {
  const users = new Map([
    ['u-admin-target', {
      id: 'u-admin-target',
      email: 'target@test.local',
      username: '被设置用户',
      isVip: 0,
      vipExpiresAt: 0,
      concurrencyLimit: 1
    }]
  ]);

  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE id = ?')) {
                const u = users.get(args[0]);
                return u ? { isVip: u.isVip, vipExpiresAt: u.vipExpiresAt } : null;
              }
              return null;
            },
            async run() {
              if (sql.includes('UPDATE users SET is_vip = ?')) {
                const [vipVal, expiresAt, concurrency, now, userId] = args;
                const u = users.get(userId);
                if (u) {
                  u.isVip = vipVal;
                  u.vipExpiresAt = expiresAt;
                  u.concurrencyLimit = concurrency;
                }
                return { success: true };
              }
              return { success: true };
            }
          };
        }
      };
    }
  };

  // 1. Admin grants 30 days VIP
  const res1 = await setUserVip(mockDb, 'u-admin-target', true, 30);
  assert.equal(res1.isVip, true);
  assert.equal(res1.concurrencyLimit, 4);
  assert.ok(res1.vipExpiresAt > Date.now());
  assert.equal(users.get('u-admin-target').concurrencyLimit, 4);

  // 2. Admin revokes VIP
  const res2 = await setUserVip(mockDb, 'u-admin-target', false);
  assert.equal(res2.isVip, false);
  assert.equal(res2.concurrencyLimit, 1);
  assert.equal(res2.vipExpiresAt, 0);
  assert.equal(users.get('u-admin-target').concurrencyLimit, 1);
});

test('auth.js exports refreshUserProfile and normalizes VIP fields', () => {
  const authCode = fs.readFileSync(path.join(ROOT, 'apps/client/auth.js'), 'utf8');
  assert.match(authCode, /export\s+async\s+function\s+refreshUserProfile/);
  assert.match(authCode, /zora:vip-updated/);
  assert.match(authCode, /zora:user-refreshed/);
  assert.match(authCode, /isVip:\s*data\.user\.isVip\s*===\s*1\s*\|\|\s*Boolean\(data\.user\.isVip\)/);
});

test('login-handler.js and app.js listen to focus and tab switches to auto-refresh VIP status', () => {
  const loginHandlerCode = fs.readFileSync(path.join(ROOT, 'apps/client/login-handler.js'), 'utf8');
  assert.match(loginHandlerCode, /refreshUserProfile/);
  assert.match(loginHandlerCode, /window\.addEventListener\('focus'/);
  assert.match(loginHandlerCode, /window\.addEventListener\('zora:vip-updated'/);

  const appCode = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  assert.match(appCode, /refreshUserProfile/);
  assert.match(appCode, /\['membership',\s*'account',\s*'credits'\]\.includes/);
});

test('Cloudflare Worker auth endpoints (/api/auth/login and /api/auth/refresh) return complete VIP fields', () => {
  const workerCode = fs.readFileSync(path.join(ROOT, 'apps/cloudflare-worker/src/index.mjs'), 'utf8');
  // Login query & response
  assert.match(workerCode, /is_vip\s+as\s+isVip,\s*vip_expires_at\s+as\s+vipExpiresAt,\s*concurrency_limit\s+as\s+concurrencyLimit/);
  assert.match(workerCode, /isVip:\s*user\.isVip\s*===\s*1\s*\|\|\s*Boolean\(user\.isVip\)/);
  assert.match(workerCode, /concurrencyLimit:\s*user\.concurrencyLimit\s*\|\|\s*1/);
});

