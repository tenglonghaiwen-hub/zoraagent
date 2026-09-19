import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEST_DB = path.join(ROOT, 'data', 'zora-test.db');

process.env.DATABASE_PATH = TEST_DB;

import {
  registerUser,
  loginUser,
  deductUserQuota,
  topupUserQuota,
  getUserUsageLogs,
  checkUserBalance,
} from '../packages/auth/index.mjs';
import { execute, closeDatabase } from '../packages/database/schema.mjs';
import { handleAuthRoutes } from '../apps/server/routes/auth.mjs';

test.before(async () => {
  process.env.DATABASE_PATH = TEST_DB;
  await closeDatabase();
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }

  // Seed server_models into test database
  const now = Date.now();
  await execute(`
    INSERT OR REPLACE INTO server_models (id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at)
    VALUES
      ('gpt-5.5', 'GPT 5.5', 'agent', 1, 'openai', 1, 1, ?, ?),
      ('gpt-image-2', 'GPT Image 2', 'image', 1, 'openai', 10, 4, ?, ?),
      ('MiniMax-H3', 'MiniMax H3', 'video', 1, 'minimax', 100, 2, ?, ?)
  `, [now, now, now, now, now, now]);
});

test.after(async () => {
  await closeDatabase();
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
});

function createMockHttp({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    url,
    on(event, handler) {
      if (event === 'data' && body !== null) {
        handler(typeof body === 'string' ? body : JSON.stringify(body));
      }
      if (event === 'end') {
        handler();
      }
      return this;
    },
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    writableFinished: false,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(data) {
      this.body = data ? JSON.parse(data) : null;
      this.writableFinished = true;
    },
    once() {},
  };

  const ctx = {
    sendJson(r, status, data) {
      r.writeHead(status, { 'Content-Type': 'application/json' });
      r.end(JSON.stringify(data));
    },
  };

  return { req, res, ctx, parsedUrl: new URL(url, 'http://localhost') };
}

test('getUserUsageLogs accurately retrieves logs, totals, and enforces user isolation', async () => {
  const userA = await registerUser({
    email: 'usera@example.com',
    password: 'password123',
    username: 'User A',
  });

  const userB = await registerUser({
    email: 'userb@example.com',
    password: 'password123',
    username: 'User B',
  });

  // User A performs 3 operations
  await deductUserQuota(userA.userId, 1, { resourceType: 'chat', modelId: 'gpt-5.5' });
  await deductUserQuota(userA.userId, 20, { resourceType: 'generation', modelId: 'gpt-image-2' });
  await deductUserQuota(userA.userId, 10, { resourceType: 'generation', modelId: 'gpt-image-2' });

  // User B performs 1 operation
  await deductUserQuota(userB.userId, 1, { resourceType: 'chat', modelId: 'gpt-5.5' });

  const usageA = await getUserUsageLogs(userA.userId, { limit: 10 });
  assert.equal(usageA.total, 3);
  assert.equal(usageA.totalConsumed, 31);
  assert.equal(usageA.logs.length, 3);
  assert.equal(usageA.logs[0].quotaCost, 10); // Most recent first

  // Check pagination
  const pagedA = await getUserUsageLogs(userA.userId, { limit: 2, offset: 1 });
  assert.equal(pagedA.logs.length, 2);
  assert.equal(pagedA.logs[0].quotaCost, 20);

  // User B logs isolated
  const usageB = await getUserUsageLogs(userB.userId);
  assert.equal(usageB.total, 1);
  assert.equal(usageB.totalConsumed, 1);
});

test('topupUserQuota increases balance, records topup log, and rejects invalid amounts', async () => {
  const user = await registerUser({
    email: 'topup-user@example.com',
    password: 'password123',
  });

  const initialBalance = await checkUserBalance(user.userId);
  assert.equal(initialBalance, 100);

  const newBalance = await topupUserQuota(user.userId, 200, { channel: 'demo' });
  assert.equal(newBalance, 300);

  const current = await checkUserBalance(user.userId);
  assert.equal(current, 300);

  // Check usage log audit
  const usage = await getUserUsageLogs(user.userId);
  assert.equal(usage.total, 1);
  assert.equal(usage.logs[0].resourceType, 'topup');
  assert.equal(usage.logs[0].quotaCost, -200);

  // Reject non-positive amounts
  await assert.rejects(async () => {
    await topupUserQuota(user.userId, -50);
  }, /充值积分必须大于 0/);
});

test('GET /api/models returns enabled server models with pricing and concurrency', async () => {
  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'GET',
    url: '/api/models',
  });

  const handled = await handleAuthRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.models));
  assert.equal(res.body.models.length, 3);

  const imageModel = res.body.models.find(m => m.id === 'gpt-image-2');
  assert.ok(imageModel);
  assert.equal(imageModel.quotaCostPerUnit, 10);
  assert.equal(imageModel.maxConcurrency, 4);
});

test('GET /api/user/usage requires auth and returns logs with total', async () => {
  // 1. Unauthenticated -> 401
  const unauth = createMockHttp({
    method: 'GET',
    url: '/api/user/usage',
  });
  await handleAuthRoutes(unauth.req, unauth.res, unauth.parsedUrl, unauth.ctx);
  assert.equal(unauth.res.statusCode, 401);

  // 2. Authenticated
  const user = await registerUser({
    email: 'route-user@example.com',
    password: 'password123',
  });
  await deductUserQuota(user.userId, 5, { resourceType: 'generation', modelId: 'gpt-image-2' });

  const loginRes = await loginUser({ email: 'route-user@example.com', password: 'password123' });

  const authHttp = createMockHttp({
    method: 'GET',
    url: '/api/user/usage?limit=5',
    headers: { authorization: `Bearer ${loginRes.token}` },
  });

  const handled = await handleAuthRoutes(authHttp.req, authHttp.res, authHttp.parsedUrl, authHttp.ctx);
  assert.equal(handled, true);
  assert.equal(authHttp.res.statusCode, 200);
  assert.equal(authHttp.res.body.ok, true);
  assert.equal(authHttp.res.body.total, 1);
  assert.equal(authHttp.res.body.totalConsumed, 5);
  assert.equal(authHttp.res.body.quotaBalance, 95);
});

test('POST /api/user/topup adds demo quota and returns newBalance', async () => {
  const user = await registerUser({
    email: 'topup-route-user@example.com',
    password: 'password123',
  });
  const loginRes = await loginUser({ email: 'topup-route-user@example.com', password: 'password123' });

  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'POST',
    url: '/api/user/topup',
    headers: { authorization: `Bearer ${loginRes.token}` },
    body: { amount: 100 },
  });

  const handled = await handleAuthRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.newBalance, 200);
  assert.equal(res.body.isDemo, true);
  assert.match(res.body.message, /\[演示充值\]/);
});

test('POST /api/auth/refresh issues new token and invalidates old token', async () => {
  const user = await registerUser({
    email: 'refresh-lifecycle@example.com',
    password: 'password123',
  });
  const loginRes = await loginUser({ email: 'refresh-lifecycle@example.com', password: 'password123' });

  const refreshHttp = createMockHttp({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: { authorization: `Bearer ${loginRes.token}` },
  });

  await handleAuthRoutes(refreshHttp.req, refreshHttp.res, refreshHttp.parsedUrl, refreshHttp.ctx);
  assert.equal(refreshHttp.res.statusCode, 200);
  assert.ok(refreshHttp.res.body.token);
  assert.notEqual(refreshHttp.res.body.token, loginRes.token);

  // Old token should now be rejected
  const oldHttp = createMockHttp({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${loginRes.token}` },
  });
  await handleAuthRoutes(oldHttp.req, oldHttp.res, oldHttp.parsedUrl, oldHttp.ctx);
  assert.equal(oldHttp.res.statusCode, 401);

  // New token succeeds
  const newHttp = createMockHttp({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${refreshHttp.res.body.token}` },
  });
  await handleAuthRoutes(newHttp.req, newHttp.res, newHttp.parsedUrl, newHttp.ctx);
  assert.equal(newHttp.res.statusCode, 200);
  assert.equal(newHttp.res.body.user.email, 'refresh-lifecycle@example.com');
});
