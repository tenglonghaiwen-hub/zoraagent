import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../apps/cloudflare-worker/src/index.mjs';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../apps/cloudflare-worker/src/auth.mjs';

/**
 * Creates an in-memory Mock D1 Database conforming to Cloudflare D1 API.
 */
function createMockD1() {
  const users = new Map();
  const sessions = new Map();
  const usageLogs = [];
  const systemConfigs = new Map([
    ['ADMIN_PASSWORD', { key: 'ADMIN_PASSWORD', value: 'admin123456', description: 'Admin Password', isSecret: 1, updatedAt: Date.now() }],
    ['DUOYUANX_BASE_URL', { key: 'DUOYUANX_BASE_URL', value: 'https://duoyuanx.com', description: 'Base URL', isSecret: 0, updatedAt: Date.now() }],
    ['DUOYUANX_API_KEY', { key: 'DUOYUANX_API_KEY', value: '', description: 'API Key', isSecret: 1, updatedAt: Date.now() }]
  ]);
  const serverModels = [
    { id: 'flux-schnell', name: 'Flux Schnell', kind: 'image', enabled: 1, provider: 'duoyuanx', quota_cost_per_unit: 10, max_concurrency: 4, created_at: Date.now(), updated_at: Date.now() },
    { id: 'flux-dev', name: 'Flux Dev', kind: 'image', enabled: 1, provider: 'duoyuanx', quota_cost_per_unit: 20, max_concurrency: 2, created_at: Date.now(), updated_at: Date.now() },
    { id: 'gpt-5.5', name: 'GPT 5.5', kind: 'agent', enabled: 1, provider: 'openai', quota_cost_per_unit: 1, max_concurrency: 1, created_at: Date.now(), updated_at: Date.now() }
  ];

  function createStatement(query, boundArgs = []) {
    return {
      bind(...args) {
        return createStatement(query, args);
      },
      async first() {
        const res = await this.all();
        return res.results && res.results.length > 0 ? res.results[0] : null;
      },
      async run() {
        await executeQuery(query, boundArgs);
        return { success: true, meta: { changes: 1 } };
      },
      async all() {
        const results = await executeQuery(query, boundArgs);
        return { results: results || [] };
      }
    };
  }

  async function executeQuery(query, args) {
    const q = query.trim();

    // 1. SELECT user by email or username
    if (q.includes('FROM users WHERE email = ? OR username = ?')) {
      const [email, username] = args;
      for (const u of users.values()) {
        if (u.email === email || u.username === username) return [{ ...u }];
      }
      return [];
    }

    // 2. SELECT user by id
    if (q.includes('FROM users WHERE id = ?')) {
      const id = args[0];
      const u = users.get(id);
      return u ? [{ ...u }] : [];
    }

    // 3. INSERT user
    if (q.startsWith('INSERT INTO users')) {
      const [id, email, password_hash, username, role, quota_balance, created_at, updated_at, status] = args;
      const user = {
        id,
        email,
        password_hash,
        username,
        role: role || 'user',
        quota_balance,
        quotaBalance: quota_balance,
        created_at,
        updated_at,
        status: status || 'active'
      };
      users.set(id, user);
      return [];
    }

    // 4. SELECT quota_balance
    if (q.includes('SELECT quota_balance FROM users WHERE id = ?')) {
      const id = args[0];
      const u = users.get(id);
      return u ? [{ quota_balance: u.quota_balance }] : [];
    }

    // 5. UPDATE users quota_balance - ?
    if (q.includes('UPDATE users SET quota_balance = quota_balance -')) {
      const [deduct, now, id] = args;
      const u = users.get(id);
      if (u) {
        u.quota_balance -= deduct;
        u.quotaBalance = u.quota_balance;
        u.updated_at = now;
      }
      return [];
    }

    // 6. UPDATE users quota_balance + ?
    if (q.includes('UPDATE users SET quota_balance = quota_balance +')) {
      const [add, now, id] = args;
      const u = users.get(id);
      if (u) {
        u.quota_balance += add;
        u.quotaBalance = u.quota_balance;
        u.updated_at = now;
      }
      return [];
    }

    // 7. INSERT usage_logs
    if (q.startsWith('INSERT INTO usage_logs')) {
      const [id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at] = args;
      const log = {
        id,
        user_id,
        resource_type,
        resourceType: resource_type,
        model_id,
        modelId: model_id,
        tokens_used,
        tokensUsed: tokens_used,
        quota_cost,
        quotaCost: quota_cost,
        request_id,
        requestId: request_id,
        created_at,
        createdAt: created_at
      };
      usageLogs.push(log);
      return [];
    }

    // 8. SELECT * FROM usage_logs
    if (q.includes('FROM usage_logs') && q.includes('LIMIT ? OFFSET ?')) {
      const [userId, limit, offset] = args;
      const userLogs = usageLogs.filter(l => l.user_id === userId);
      return userLogs.slice(offset, offset + limit);
    }

    if (q.includes('FROM usage_logs') && q.includes('ORDER BY created_at DESC') && q.includes('LIMIT ?')) {
      const [limit] = args;
      return usageLogs.slice(0, limit);
    }

    // 9. Aggregation on usage_logs
    if (q.includes('totalConsumed') && q.includes('FROM usage_logs')) {
      if (args.length > 0) {
        const [userId] = args;
        const userLogs = usageLogs.filter(l => l.user_id === userId);
        const totalConsumed = userLogs.reduce((acc, l) => acc + (l.quota_cost > 0 ? l.quota_cost : 0), 0);
        return [{ count: userLogs.length, totalConsumed }];
      }
      const totalConsumed = usageLogs.reduce((acc, l) => acc + (l.quota_cost > 0 ? l.quota_cost : 0), 0);
      return [{ totalRequests: usageLogs.length, totalConsumed }];
    }

    // 10. Sessions
    if (q.startsWith('INSERT INTO sessions')) {
      const [id, user_id, token, expires_at, created_at, last_used_at] = args;
      sessions.set(token, { id, user_id, token, expires_at, created_at, last_used_at });
      return [];
    }

    if (q.startsWith('DELETE FROM sessions WHERE token = ?')) {
      sessions.delete(args[0]);
      return [];
    }

    // 11. Server models
    if (q.includes('FROM server_models') && q.includes('WHERE enabled = 1')) {
      return serverModels.filter(m => m.enabled === 1).map(m => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        enabled: m.enabled,
        provider: m.provider,
        quotaCostPerUnit: m.quota_cost_per_unit,
        maxConcurrency: m.max_concurrency,
        updatedAt: m.updated_at
      }));
    }

    if (q.includes('FROM server_models') && !q.includes('WHERE enabled = 1') && q.includes('ORDER BY kind ASC')) {
      return serverModels.map(m => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        enabled: m.enabled,
        provider: m.provider,
        quotaCostPerUnit: m.quota_cost_per_unit,
        maxConcurrency: m.max_concurrency,
        updatedAt: m.updated_at
      }));
    }

    if (q.startsWith('INSERT INTO server_models')) {
      const [id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at] = args;
      const existingIdx = serverModels.findIndex(m => m.id === id);
      const model = { id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at };
      if (existingIdx >= 0) {
        serverModels[existingIdx] = model;
      } else {
        serverModels.push(model);
      }
      return [];
    }

    if (q.startsWith('DELETE FROM server_models WHERE id = ?')) {
      const idx = serverModels.findIndex(m => m.id === args[0]);
      if (idx >= 0) serverModels.splice(idx, 1);
      return [];
    }

    if (q.includes('SELECT quota_cost_per_unit as unitCost, enabled FROM server_models WHERE id = ?')) {
      const m = serverModels.find(item => item.id === args[0]);
      return m ? [{ unitCost: m.quota_cost_per_unit, enabled: m.enabled }] : [];
    }

    // 12. System configs
    if (q.includes('SELECT value FROM system_configs WHERE key = ?')) {
      const c = systemConfigs.get(args[0]);
      return c ? [{ value: c.value }] : [];
    }

    if (q.includes('FROM system_configs ORDER BY key ASC')) {
      return Array.from(systemConfigs.values());
    }

    if (q.startsWith('INSERT INTO system_configs')) {
      const [key, value, description, isSecret, now] = args;
      systemConfigs.set(key, { key, value, description, isSecret, updatedAt: now });
      return [];
    }

    // 13. Admin stats & users
    if (q.includes('COUNT(*) as userCount')) {
      return [{ userCount: users.size, totalBalance: Array.from(users.values()).reduce((a, b) => a + b.quota_balance, 0) }];
    }
    if (q.includes('COUNT(*) as modelCount FROM server_models')) {
      return [{ modelCount: serverModels.filter(m => m.enabled === 1).length }];
    }
    if (q.includes('FROM users') && q.includes('ORDER BY created_at DESC LIMIT ? OFFSET ?')) {
      const [limit, offset] = args;
      const allUsers = Array.from(users.values());
      return allUsers.slice(offset, offset + limit);
    }
    if (q.includes('COUNT(*) as count FROM users')) {
      return [{ count: users.size }];
    }

    return [];
  }

  return {
    prepare(query) {
      return createStatement(query);
    }
  };
}

test('Cloudflare Worker - Web Crypto Auth Unit Test', async () => {
  const password = 'TestSecretPassword123!';
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith('pbkdf2:sha256:100000$'), 'Hash should have pbkdf2 format');

  const valid = await verifyPassword(password, hash);
  assert.equal(valid, true, 'Valid password verification');

  const invalid = await verifyPassword('WrongPassword', hash);
  assert.equal(invalid, false, 'Invalid password verification');

  const secret = 'test-secret-key-at-least-32-chars-long';
  const token = await signJwt({ userId: 'u1', username: 'alice' }, secret, 3600);
  assert.ok(token.split('.').length === 3, 'JWT should have 3 segments');

  const payload = await verifyJwt(token, secret);
  assert.equal(payload.userId, 'u1');
  assert.equal(payload.username, 'alice');

  const badPayload = await verifyJwt(token, 'wrong-secret-key-32-chars-length!!');
  assert.equal(badPayload, null, 'Signature verification with wrong secret must fail');
});

test('Cloudflare Worker - Endpoints & Ledger Integration', async () => {
  const mockDb = createMockD1();
  const env = {
    DB: mockDb,
    JWT_SECRET: 'test-jwt-secret-for-cloudflare-worker-d1',
    DUOYUANX_API_KEY: 'test-mock-api-key',
    DUOYUANX_BASE_URL: 'https://api.chat-plugin.top'
  };

  // 1. CORS OPTIONS preflight
  const optRes = await worker.fetch(new Request('http://localhost/api/auth/login', {
    method: 'OPTIONS',
    headers: { 'Origin': 'http://localhost:3000' }
  }), env);
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');

  // 2. Health check
  const healthRes = await worker.fetch(new Request('http://localhost/health'), env);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.service, 'zora-cloud-gateway');

  // 3. Model catalog
  const modelsRes = await worker.fetch(new Request('http://localhost/api/models'), env);
  assert.equal(modelsRes.status, 200);
  const modelsData = await modelsRes.json();
  assert.ok(modelsData.models.length >= 3);

  // 4. Register new user
  const regRes = await worker.fetch(new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', email: 'test@example.com', password: 'password123' })
  }), env);
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.ok(regData.token);
  assert.equal(regData.user.username, 'testuser');
  assert.equal(regData.user.balance, 100);

  const authToken = regData.token;

  // 5. Auth Me
  const meRes = await worker.fetch(new Request('http://localhost/api/auth/me', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  }), env);
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.username, 'testuser');
  assert.equal(meData.user.balance, 100);

  // 6. Cost Preview
  const prevRes = await worker.fetch(new Request('http://localhost/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'flux-schnell', type: 'image' })
  }), env);
  assert.equal(prevRes.status, 200);
  const prevData = await prevRes.json();
  assert.equal(prevData.cost_per_unit, 10);

  // 7. Mock Upstream Generate Call
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (typeof url === 'string' && (url.includes('api.chat-plugin.top') || url.includes('duoyuanx'))) {
      if (url.includes('/chat/completions')) {
        return new Response(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Hello from Cloudflare Worker!' } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        data: [{ url: 'https://cdn.example.com/generated-art.png' }],
        task_id: 'task-mock-123'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const genRes = await worker.fetch(new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        prompt: 'A futuristic city skyline',
        model: 'flux-schnell',
        type: 'image'
      })
    }), env);

    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.equal(genData.ok, true);
    assert.equal(genData.cost, 10);
    assert.equal(genData.newBalance, 90);
    assert.equal(genData.url, 'https://cdn.example.com/generated-art.png');

    // 8. Usage logs audit check
    const usageRes = await worker.fetch(new Request('http://localhost/api/user/usage?limit=10&offset=0', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    }), env);
    assert.equal(usageRes.status, 200);
    const usageData = await usageRes.json();
    assert.equal(usageData.total, 1);
    assert.equal(usageData.totalConsumed, 10);
    assert.equal(usageData.logs[0].modelId, 'flux-schnell');

    // 9. Topup demo
    const topupRes = await worker.fetch(new Request('http://localhost/api/user/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ amount: 50 })
    }), env);
    assert.equal(topupRes.status, 200);
    const topupData = await topupRes.json();
    assert.equal(topupData.newBalance, 140);

    // 10. Chat proxy with 1-point deduction
    const chatRes = await worker.fetch(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-5.5'
      })
    }), env);
    assert.equal(chatRes.status, 200);
    const chatData = await chatRes.json();
    assert.equal(chatData.reply, 'Hello from Cloudflare Worker!');
    assert.equal(chatData.cost, 1);
    assert.equal(chatData.newBalance, 139);

    // 11. Insufficient Balance 402 Pre-check
    const deductRemaining = 139 - 5;
    await mockDb.prepare('UPDATE users SET quota_balance = quota_balance - ?, updated_at = ? WHERE id = ?')
      .bind(deductRemaining, Date.now(), regData.user.id).run();

    const lowBalanceRes = await worker.fetch(new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        prompt: 'Should fail due to insufficient points',
        model: 'flux-schnell',
        type: 'image'
      })
    }), env);
    assert.equal(lowBalanceRes.status, 402, 'Should reject with 402 Payment Required');
    const lowBalData = await lowBalanceRes.json();
    assert.ok(lowBalData.error.includes('积分不足'));
    assert.equal(lowBalData.currentBalance, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cloudflare Worker - Visual Admin Dashboard & Management APIs', async () => {
  const mockDb = createMockD1();
  const env = {
    DB: mockDb,
    JWT_SECRET: 'test-jwt-secret-for-cloudflare-worker-d1',
    DUOYUANX_API_KEY: 'test-mock-api-key',
    ADMIN_PASSWORD: 'admin123456'
  };

  // 1. GET /admin returns Visual HTML page
  const htmlRes = await worker.fetch(new Request('http://localhost/admin'), env);
  assert.equal(htmlRes.status, 200);
  assert.equal(htmlRes.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const htmlText = await htmlRes.text();
  assert.ok(htmlText.includes('Zora Gateway | 官方云端网关可视化控制台'));

  // 2. Admin Login
  const badLogin = await worker.fetch(new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrongpassword' })
  }), env);
  assert.equal(badLogin.status, 401);

  const goodLogin = await worker.fetch(new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123456' })
  }), env);
  assert.equal(goodLogin.status, 200);
  const loginData = await goodLogin.json();
  assert.ok(loginData.token);
  assert.equal(loginData.role, 'admin');

  const adminToken = loginData.token;

  // 3. Admin Stats
  const statsRes = await worker.fetch(new Request('http://localhost/api/admin/stats', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  assert.equal(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.equal(statsData.ok, true);
  assert.equal(typeof statsData.stats.activeModels, 'number');

  // 4. Admin Models CRUD
  const listModelsRes = await worker.fetch(new Request('http://localhost/api/admin/models', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  assert.equal(listModelsRes.status, 200);
  const listData = await listModelsRes.json();
  assert.ok(listData.models.length >= 3);

  // Upsert new model
  const addModelRes = await worker.fetch(new Request('http://localhost/api/admin/models', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      id: 'custom-flux-ultra',
      name: 'Custom Flux Ultra',
      kind: 'image',
      quotaCostPerUnit: 35,
      provider: 'duoyuanx',
      maxConcurrency: 3,
      enabled: 1
    })
  }), env);
  assert.equal(addModelRes.status, 200);
  const addData = await addModelRes.json();
  assert.equal(addData.model.quotaCostPerUnit, 35);

  // 5. Dynamic API Key & Config Update
  const updateCfgRes = await worker.fetch(new Request('http://localhost/api/admin/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      DUOYUANX_API_KEY: 'sk-new-runtime-key-from-admin-ui'
    })
  }), env);
  assert.equal(updateCfgRes.status, 200);

  // Verify dynamic key is retrieved by getSystemConfig
  const { getSystemConfig } = await import('../apps/cloudflare-worker/src/billing.mjs');
  const storedKey = await getSystemConfig(mockDb, 'DUOYUANX_API_KEY');
  assert.equal(storedKey, 'sk-new-runtime-key-from-admin-ui');

  // 6. Delete model
  const delModelRes = await worker.fetch(new Request('http://localhost/api/admin/models?id=custom-flux-ultra', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  assert.equal(delModelRes.status, 200);
});
