import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEST_DB = path.join(ROOT, 'data', 'zora-test.db');

// Set test database path before loading schema
process.env.DATABASE_PATH = TEST_DB;

import {
  registerUser,
  loginUser,
  deductUserQuota,
  checkUserBalance,
  calculateQuotaCost,
} from '../packages/auth/index.mjs';
import { execute, query, queryOne, closeDatabase } from '../packages/database/schema.mjs';
import { handleGenerationRoutes } from '../apps/server/routes/generation.mjs';

test.before(async () => {
  process.env.DATABASE_PATH = TEST_DB;
  await closeDatabase();
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }

  // Seed default models into test database
  const now = Date.now();
  await execute(`
    INSERT OR REPLACE INTO server_models (id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at)
    VALUES
      ('gpt-5.5', 'GPT 5.5', 'agent', 1, 'openai', 1, null, ?, ?),
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

test('calculateQuotaCost computes correct quota for models and counts', async () => {
  const agentCost = await calculateQuotaCost({ modelId: 'gpt-5.5', kind: 'agent', count: 1 });
  assert.equal(agentCost, 1);

  const imageCost = await calculateQuotaCost({ modelId: 'gpt-image-2', kind: 'image', count: 3 });
  assert.equal(imageCost, 30);

  const videoCost = await calculateQuotaCost({ modelId: 'MiniMax-H3', kind: 'video', count: 2 });
  assert.equal(videoCost, 200);

  // Fallback for unknown model
  const fallbackImage = await calculateQuotaCost({ modelId: 'unknown-image-model', kind: 'image', count: 2 });
  assert.equal(fallbackImage, 20);
});

// Helper to create mock HTTP req/res
function createMockHttp({ method = 'POST', url = '/', headers = {}, body = {} }) {
  const req = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    url,
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
    async readJson() {
      return body;
    },
    taskStore() {
      return {
        get() { return null; },
        submit(id) { return { id, status: 'queued' }; },
      };
    },
    async handleChat(msg) {
      return {
        conversationId: msg.conversationId || 'test-conv',
        reply: '这是测试回复',
        tasks: [],
      };
    },
  };

  return { req, res, ctx, parsedUrl: new URL(url, 'http://localhost') };
}

test('/api/generate rejects unauthenticated requests with 401', async () => {
  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'POST',
    url: '/api/generate',
    body: {
      modelId: 'gpt-image-2',
      prompt: 'a scenic landscape',
      count: 1,
    },
  });

  const handled = await handleGenerationRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /需要登录/);
});

test('/api/generate rejects requests when quota balance is insufficient with 402', async () => {
  const user = await registerUser({
    email: 'poor-user@example.com',
    password: 'password123',
    username: 'Poor User',
  });

  // Drain user quota to 0
  await execute('UPDATE users SET quota_balance = 0 WHERE id = ?', [user.userId]);

  const loginResult = await loginUser({
    email: 'poor-user@example.com',
    password: 'password123',
  });

  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'POST',
    url: '/api/generate',
    headers: {
      authorization: `Bearer ${loginResult.token}`,
    },
    body: {
      modelId: 'gpt-image-2',
      prompt: 'a scenic landscape',
      count: 1,
      concurrency: 1,
      ratio: '1:1',
      resolution: '1K',
    },
  });

  const handled = await handleGenerationRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /积分余额不足/);
});

test('/api/chat rejects unauthenticated requests with 401', async () => {
  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'POST',
    url: '/api/chat',
    body: {
      message: 'Hello Agent',
    },
  });

  const handled = await handleGenerationRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /需要登录/);
});

test('/api/chat deducts 1 quota, returns newBalance and records usage_log', async () => {
  const user = await registerUser({
    email: 'chat-user@example.com',
    password: 'password123',
    username: 'Chat User',
  });

  const initialBalance = await checkUserBalance(user.userId);
  assert.equal(initialBalance, 100);

  const loginResult = await loginUser({
    email: 'chat-user@example.com',
    password: 'password123',
  });

  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'POST',
    url: '/api/chat',
    headers: {
      authorization: `Bearer ${loginResult.token}`,
    },
    body: {
      message: '创作需求测试',
    },
  });

  const handled = await handleGenerationRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, '这是测试回复');
  assert.equal(res.body.newBalance, 99);

  // Check database user balance
  const remaining = await checkUserBalance(user.userId);
  assert.equal(remaining, 99);

  // Check usage_logs table
  const log = await queryOne('SELECT * FROM usage_logs WHERE user_id = ? AND resource_type = ?', [
    user.userId,
    'chat',
  ]);
  assert.ok(log);
  assert.equal(log.quota_cost, 1);
  assert.equal(log.model_id, 'gpt-5.5');
});

test('/api/preview returns estimatedQuota without requiring authentication', async () => {
  const { req, res, ctx, parsedUrl } = createMockHttp({
    method: 'POST',
    url: '/api/preview',
    body: {
      modelId: 'gpt-image-2',
      prompt: 'a scenic landscape',
      count: 2,
      concurrency: 1,
      ratio: '1:1',
      resolution: '1K',
    },
  });

  const handled = await handleGenerationRoutes(req, res, parsedUrl, ctx);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.estimatedQuota, 20); // 10 per image * 2
});
