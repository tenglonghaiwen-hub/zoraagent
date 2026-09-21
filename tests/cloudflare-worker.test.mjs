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
  const notifications = [];
  const systemConfigs = new Map([
    ['ADMIN_PASSWORD', { key: 'ADMIN_PASSWORD', value: 'admin123456', description: 'Admin Password', isSecret: 1, updatedAt: Date.now() }],
    ['DUOYUANX_BASE_URL', { key: 'DUOYUANX_BASE_URL', value: 'https://duoyuanx.com', description: 'Base URL', isSecret: 0, updatedAt: Date.now() }],
    ['DUOYUANX_API_KEY', { key: 'DUOYUANX_API_KEY', value: '', description: 'API Key', isSecret: 1, updatedAt: Date.now() }],
    ['MINIMAX_API_KEY', { key: 'MINIMAX_API_KEY', value: '', description: 'MiniMax Key', isSecret: 1, updatedAt: Date.now() }],
    ['MINIMAX_BASE_URL', { key: 'MINIMAX_BASE_URL', value: 'https://api.minimax.cn', description: 'MiniMax Base', isSecret: 0, updatedAt: Date.now() }]
  ]);
  const serverModels = [
    { id: 'flux-schnell', name: 'Flux Schnell', kind: 'image', enabled: 1, provider: 'duoyuanx', quota_cost_per_unit: 10, max_concurrency: 4, vip_only: 0, created_at: Date.now(), updated_at: Date.now() },
    { id: 'flux-dev', name: 'Flux Dev', kind: 'image', enabled: 1, provider: 'duoyuanx', quota_cost_per_unit: 20, max_concurrency: 2, vip_only: 0, created_at: Date.now(), updated_at: Date.now() },
    { id: 'gpt-5.5', name: 'GPT 5.5', kind: 'agent', enabled: 1, provider: 'openai', quota_cost_per_unit: 1, max_concurrency: 1, vip_only: 1, created_at: Date.now(), updated_at: Date.now() },
    { id: 'MiniMax-H3', name: 'MiniMax H3', kind: 'video', enabled: 1, provider: 'minimax', quota_cost_per_unit: 100, max_concurrency: 2, vip_only: 0, created_at: Date.now(), updated_at: Date.now() }
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
        is_vip: 0,
        vip_expires_at: 0,
        concurrency_limit: 2,
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

    // 6.1 UPDATE users VIP
    if (q.includes('UPDATE users SET is_vip = ?')) {
      const [is_vip, vip_expires_at, now, id] = args;
      const u = users.get(id);
      if (u) {
        u.is_vip = is_vip;
        u.isVip = is_vip;
        u.vip_expires_at = vip_expires_at;
        u.vipExpiresAt = vip_expires_at;
        u.updated_at = now;
      }
      return [];
    }

    // 6.2 UPDATE users status
    if (q.includes('UPDATE users SET status = ?')) {
      const [status, now, id] = args;
      const u = users.get(id);
      if (u) {
        u.status = status;
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

    // 11. Notifications
    if (q.startsWith('INSERT INTO notifications')) {
      const [id, user_id, title, content, kind, created_at] = args;
      notifications.push({ id, user_id, userId: user_id, title, content, kind, created_at, createdAt: created_at });
      return [];
    }
    if (q.includes('FROM notifications') && q.includes("user_id = '*' OR user_id = ?")) {
      const [targetUser, limit] = args;
      return notifications.filter(n => n.user_id === '*' || n.user_id === targetUser).slice(0, limit);
    }
    if (q.includes('FROM notifications') && q.includes('ORDER BY created_at DESC') && q.includes('LIMIT ?')) {
      const [limit] = args;
      return notifications.slice(0, limit);
    }
    if (q.startsWith('DELETE FROM notifications WHERE id = ?')) {
      const [id] = args;
      const idx = notifications.findIndex(n => n.id === id);
      if (idx >= 0) notifications.splice(idx, 1);
      return [];
    }

    // 12. Server models
    if (q.includes('FROM server_models') && q.includes('WHERE enabled = 1')) {
      return serverModels.filter(m => m.enabled === 1).map(m => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        enabled: m.enabled,
        provider: m.provider,
        quotaCostPerUnit: m.quota_cost_per_unit,
        maxConcurrency: m.max_concurrency,
        vipOnly: m.vip_only || 0,
        vip_only: m.vip_only || 0,
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
        vipOnly: m.vip_only || 0,
        vip_only: m.vip_only || 0,
        updatedAt: m.updated_at
      }));
    }

    if (q.startsWith('INSERT INTO server_models')) {
      let id, name, kind, enabled, provider, route, queryRoute, quota_cost_per_unit, max_concurrency, vip_only, created_at, updated_at;
      if (args.length >= 10) {
        [id, name, kind, enabled, provider, route, queryRoute, quota_cost_per_unit, max_concurrency, vip_only, created_at, updated_at] = args;
      } else {
        [id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at] = args;
      }
      const existingIdx = serverModels.findIndex(m => m.id === id);
      const model = { id, name, kind, enabled, provider, route, queryRoute, quota_cost_per_unit, max_concurrency, vip_only: vip_only || 0, created_at, updated_at };
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

    if (q.includes('FROM server_models WHERE id = ?')) {
      const m = serverModels.find(item => item.id === args[0]);
      return m ? [{
        id: m.id,
        name: m.name,
        kind: m.kind,
        provider: m.provider,
        enabled: m.enabled,
        unitCost: m.quota_cost_per_unit,
        quota_cost_per_unit: m.quota_cost_per_unit,
        vipOnly: m.vip_only || 0,
        vip_only: m.vip_only || 0
      }] : [];
    }

    // 13. System configs
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

    // 14. Admin stats & users
    if (q.includes('COUNT(*) as userCount')) {
      return [{
        userCount: users.size,
        totalBalance: Array.from(users.values()).reduce((a, b) => a + (b.quota_balance || 0), 0),
        vipCount: Array.from(users.values()).filter(u => u.is_vip === 1).length
      }];
    }
    if (q.includes('COUNT(*) as vips FROM users WHERE is_vip = 1')) {
      return [{ vips: Array.from(users.values()).filter(u => u.is_vip === 1).length }];
    }
    if (q.includes('SUM(quota_balance) as totalQuota FROM users')) {
      return [{ totalQuota: Array.from(users.values()).reduce((acc, u) => acc + (u.quota_balance || 0), 0) }];
    }
    if (q.includes('COUNT(*) as modelCount FROM server_models')) {
      return [{ modelCount: serverModels.filter(m => m.enabled === 1).length }];
    }
    if (q.includes('FROM users') && q.includes('LIMIT ? OFFSET ?')) {
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      let allUsers = Array.from(users.values());
      if (args.length > 2) {
        const s = (args[0] || '').replace(/%/g, '').toLowerCase();
        allUsers = allUsers.filter(u => (u.email && u.email.toLowerCase().includes(s)) || (u.username && u.username.toLowerCase().includes(s)));
      }
      return allUsers.slice(offset, offset + limit).map(u => ({
        ...u,
        quotaBalance: u.quota_balance,
        isVip: u.is_vip || 0,
        vipExpiresAt: u.vip_expires_at || 0,
        concurrencyLimit: u.concurrency_limit || 2,
        createdAt: u.created_at,
        updatedAt: u.updated_at
      }));
    }
    if (q.includes('COUNT(*) as count FROM users')) {
      return [{ count: users.size }];
    }

    return [];
  }

  return {
    async batch(statements) {const results=[];for(const statement of statements)results.push(await statement.run());return results;},
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
      if (url.includes('/responses')) {
        return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Hello from Cloudflare Worker!'}]}]});
      }
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
      capability:{version:1,template:'openai-image'},
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

test('Cloudflare Worker - Multi-Provider & MiniMax Official Direct Routing Test', async () => {
  const mockDb = createMockD1();
  const env = {
    DB: mockDb,
    JWT_SECRET: 'test-jwt-secret-multi-provider',
    MINIMAX_API_KEY: 'official-minimax-jwt-secret-key-12345',
    MINIMAX_BASE_URL: 'https://api.minimax.cn',
    DUOYUANX_API_KEY: 'relay-duoyuanx-key',
    OPENAI_API_KEY: 'sk-openai-official-key'
  };

  // 1. Register a test user with 200 initial points
  const regRes = await worker.fetch(new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'videomaker',
      email: 'videomaker@example.com',
      password: 'StrongPassword123!'
    })
  }), env);
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  const userToken = regData.token;

  // Top up user to have enough balance for MiniMax H3 (cost: 100 points)
  await worker.fetch(new Request('http://localhost/api/user/topup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ amount: 100 })
  }), env);

  // 2. Mock upstream fetch calls
  const originalFetch = globalThis.fetch;
  const interceptedCalls = [];

  globalThis.fetch = async (url, opts = {}) => {
    const urlStr = String(url);
    interceptedCalls.push({ url: urlStr, method: opts.method, headers: opts.headers, body: opts.body });

    // MiniMax Official Video Generation Submission
    if (urlStr === 'https://api.minimax.cn/v2/video_generation') {
      const parsedBody = JSON.parse(opts.body);
      assert.equal(parsedBody.model, 'MiniMax-H3');
      assert.equal(opts.headers.Authorization, 'Bearer official-minimax-jwt-secret-key-12345');
      assert.ok(Array.isArray(parsedBody.content), 'Content must be an array for MiniMax');
      assert.equal(parsedBody.content[0].type, 'text');
      assert.equal(parsedBody.content[1].role, 'reference_image');

      return new Response(JSON.stringify({
        task_id: 'minimax-task-987654321',
        base_resp: { status_code: 0, status_msg: 'success' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // MiniMax Official Video Status Query
    if (urlStr === 'https://api.minimax.cn/v2/query/video_generation/minimax-task-987654321') {
      assert.equal(opts.headers.Authorization, 'Bearer official-minimax-jwt-secret-key-12345');
      return new Response(JSON.stringify({
        task: {
          id: 'minimax-task-987654321',
          status: 'succeeded',
          content: { url: 'https://cdn.minimax.cn/video/result-h3.mp4' }
        },
        file_id: 'file-123456'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return originalFetch(url, opts);
  };

  try {
    // 3. Submit MiniMax-H3 video generation
    const genRes = await worker.fetch(new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        prompt: 'A cybernetic bird soaring across a neon cityscape',
        model: 'MiniMax-H3',
        type: 'video',
        duration: 5,
        resolution: '720P',
        ratio: '16:9',
        references: [
          { type: 'image/png', contentUrl: 'https://cdn.example.com/character.png', role: 'reference_image' }
        ]
      })
    }), env);

    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.equal(genData.ok, true);
    assert.equal(genData.taskId, 'minimax-task-987654321');
    assert.equal(genData.status, 'processing');
    assert.equal(genData.provider, 'minimax-official');
    assert.equal(genData.cost, 100);
    assert.equal(genData.newBalance, 100); // 200 - 100 = 100

    // Verify upstream call was made to MiniMax official, NOT duoyuanx
    assert.ok(interceptedCalls.some(c => c.url === 'https://api.minimax.cn/v2/video_generation'));
    assert.ok(!interceptedCalls.some(c => c.url.includes('duoyuanx.com')));

    // 4. Poll task status via gateway endpoint
    const pollRes = await worker.fetch(new Request('http://localhost/api/tasks/minimax-task-987654321?provider=minimax'), env);
    assert.equal(pollRes.status, 200);
    const pollData = await pollRes.json();
    assert.equal(pollData.ok, true);
    assert.equal(pollData.status, 'succeeded');
    assert.equal(pollData.url, 'https://cdn.minimax.cn/video/result-h3.mp4');

    // 5. Admin can update multi-provider configurations
    const adminToken = await (await import('../apps/cloudflare-worker/src/auth.mjs')).signJwt({ role: 'admin' }, env.JWT_SECRET, 3600);
    const cfgRes = await worker.fetch(new Request('http://localhost/api/admin/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        MINIMAX_API_KEY: 'new-runtime-official-minimax-key',
        MINIMAX_BASE_URL: 'https://api.minimax.cn',
        SILICONFLOW_API_KEY: 'sk-siliconflow-runtime-key',
        DEEPSEEK_API_KEY: 'sk-deepseek-runtime-key'
      })
    }), env);
    assert.equal(cfgRes.status, 200);

    const getCfgRes = await worker.fetch(new Request('http://localhost/api/admin/config', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }), env);
    const getCfgData = await getCfgRes.json();
    assert.equal(getCfgData.ok, true);
    const minimaxCfg = getCfgData.configs.find(c => c.key === 'MINIMAX_API_KEY');
    assert.ok(minimaxCfg.value.includes('••••'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cloudflare Worker - Provider Connectivity Testing & Admin Probe API', async () => {
  const d1 = createMockD1();
  const env = {
    DB: d1,
    JWT_SECRET: 'test-connectivity-secret',
    MINIMAX_API_KEY: 'env-fallback-key',
    OPENAI_API_KEY: ''
  };

  const adminToken = await (await import('../apps/cloudflare-worker/src/auth.mjs')).signJwt(
    { role: 'admin' },
    env.JWT_SECRET,
    3600
  );

  const originalFetch = globalThis.fetch;
  try {
    // Mock upstream probes
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      const authHeader = options?.headers?.Authorization || '';

      // Test 1: MiniMax upstream probe success
      if (urlStr.includes('api.minimax.cn/v1/models')) {
        if (authHeader.includes('valid-minimax-key')) {
          return new Response(JSON.stringify({
            data: [{ id: 'MiniMax-H3' }, { id: 'MiniMax-Text' }]
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          error: { message: 'Invalid API Key' }
        }), { status: 401 });
      }

      // Test 2: DeepSeek upstream probe
      if (urlStr.includes('api.deepseek.com/models')) {
        return new Response(JSON.stringify({
          data: [{ id: 'deepseek-chat' }, { id: 'deepseek-coder' }]
        }), { status: 200 });
      }

      return originalFetch(url, options);
    };

    // 1. Probe with valid key passed in payload
    const testRes1 = await worker.fetch(new Request('http://localhost/api/admin/providers/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        provider: 'minimax',
        apiKey: 'valid-minimax-key'
      })
    }), env);

    assert.equal(testRes1.status, 200);
    const testData1 = await testRes1.json();
    assert.equal(testData1.ok, true);
    assert.equal(testData1.provider, 'minimax');
    assert.equal(testData1.modelCount, 2);
    assert.ok(testData1.latency >= 0);

    // 2. Probe with invalid key (should report error with HTTP 401 status in payload)
    const testRes2 = await worker.fetch(new Request('http://localhost/api/admin/providers/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        provider: 'minimax',
        apiKey: 'bad-minimax-key'
      })
    }), env);

    assert.equal(testRes2.status, 200);
    const testData2 = await testRes2.json();
    assert.equal(testData2.ok, false);
    assert.equal(testData2.status, 401);
    assert.equal(testData2.error, 'Invalid API Key');

    // 3. Probe with no key provided and none in DB or env (e.g. OpenAI)
    const testRes3 = await worker.fetch(new Request('http://localhost/api/admin/providers/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        provider: 'openai'
      })
    }), env);

    assert.equal(testRes3.status, 200);
    const testData3 = await testRes3.json();
    assert.equal(testData3.ok, false);
    assert.equal(testData3.status, 400);
    assert.match(testData3.error, /未配置/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cloudflare Worker - VIP Status, Manual Topup/Refund, Single User Ledger & Notifications Hub', async () => {
  const mockDb = createMockD1();
  const env = {
    DB: mockDb,
    JWT_SECRET: 'test-jwt-secret-vip-notifications-hub-test',
    ADMIN_PASSWORD: 'admin123456'
  };

  // 1. Log in as admin
  const loginRes = await worker.fetch(new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123456' })
  }), env);
  assert.equal(loginRes.status, 200);
  const { token: adminToken } = await loginRes.json();
  assert.ok(adminToken);

  // 2. Register a standard user
  const regRes = await worker.fetch(new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'creator_vip@test.com',
      password: 'StrongPassWord123!',
      username: 'vip_creator'
    })
  }), env);
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  const targetUserId = regData.user.id;
  assert.ok(targetUserId);

  // 3. User initially has default quota (100) and is not VIP
  const usersRes1 = await worker.fetch(new Request('http://localhost/api/admin/users?search=vip_creator', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  assert.equal(usersRes1.status, 200);
  const usersData1 = await usersRes1.json();
  assert.equal(usersData1.users.length, 1);
  assert.equal(usersData1.users[0].isVip, 0);
  assert.equal(usersData1.users[0].quotaBalance, 100);

  // 4. Admin grants VIP (30 days) to user
  const vipRes = await worker.fetch(new Request('http://localhost/api/admin/users/vip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: targetUserId,
      isVip: true,
      days: 30
    })
  }), env);
  assert.equal(vipRes.status, 200);
  const vipData = await vipRes.json();
  assert.equal(vipData.ok, true);
  assert.equal(vipData.isVip, true);
  assert.ok(vipData.vipExpiresAt > Date.now());

  // 5. Admin tops up user quota (+500 points)
  const topupRes = await worker.fetch(new Request('http://localhost/api/admin/users/adjust-balance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: targetUserId,
      delta: 500,
      reason: '新春创作者赠送'
    })
  }), env);
  assert.equal(topupRes.status, 200);
  const topupData = await topupRes.json();
  assert.equal(topupData.ok, true);
  assert.equal(topupData.newBalance, 600);
  assert.equal(topupData.resourceType, 'admin_topup');

  // 6. Admin refunds user quota (-150 points)
  const refundRes = await worker.fetch(new Request('http://localhost/api/admin/users/adjust-balance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: targetUserId,
      delta: -150,
      reason: '错误扣点冲正退款'
    })
  }), env);
  assert.equal(refundRes.status, 200);
  const refundData = await refundRes.json();
  assert.equal(refundData.ok, true);
  assert.equal(refundData.newBalance, 450);
  assert.equal(refundData.resourceType, 'admin_refund');

  // 7. Admin queries single user ledger logs
  const logsRes = await worker.fetch(new Request(`http://localhost/api/admin/users/logs?userId=${targetUserId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  assert.equal(logsRes.status, 200);
  const logsData = await logsRes.json();
  assert.equal(logsData.ok, true);
  assert.ok(logsData.logs.length >= 2);
  assert.ok(logsData.logs.some(l => l.resourceType === 'admin_topup'));
  assert.ok(logsData.logs.some(l => l.resourceType === 'admin_refund'));

  // 8. Admin manages user account status (Freeze & Unfreeze)
  const suspendRes = await worker.fetch(new Request('http://localhost/api/admin/users/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: targetUserId,
      status: 'suspended'
    })
  }), env);
  assert.equal(suspendRes.status, 200);
  const suspendData = await suspendRes.json();
  assert.equal(suspendData.ok, true);
  assert.equal(suspendData.status, 'suspended');

  // Unfreeze
  const activeRes = await worker.fetch(new Request('http://localhost/api/admin/users/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: targetUserId,
      status: 'active'
    })
  }), env);
  assert.equal(activeRes.status, 200);
  const activeData = await activeRes.json();
  assert.equal(activeData.status, 'active');

  // 9. Notifications Hub: Broadcast & Targeted Push
  // 9.1 Send Global Broadcast
  const broadcastRes = await worker.fetch(new Request('http://localhost/api/admin/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: '*',
      kind: 'official',
      title: '造境全网服务升级公告',
      content: '全新全球云端网关上线，支持开箱即用。'
    })
  }), env);
  assert.equal(broadcastRes.status, 200);
  const broadcastData = await broadcastRes.json();
  assert.equal(broadcastData.ok, true);
  const broadcastId = broadcastData.notification.id;
  assert.ok(broadcastId);

  // 9.2 Send Targeted Private Notification to targetUserId
  const privateRes = await worker.fetch(new Request('http://localhost/api/admin/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: targetUserId,
      kind: 'activity',
      title: '恭喜获得尊贵 VIP 体验资格',
      content: '您的 VIP 会员特权已开通，畅享 VIP 专属模型与高并发。'
    })
  }), env);
  assert.equal(privateRes.status, 200);
  const privateData = await privateRes.json();
  assert.equal(privateData.ok, true);

  // 9.3 Client pulls messages
  // Anonymous client should receive broadcast only
  const anonMsgRes = await worker.fetch(new Request('http://localhost/api/messages'), env);
  assert.equal(anonMsgRes.status, 200);
  const anonMsgData = await anonMsgRes.json();
  assert.equal(anonMsgData.ok, true);
  assert.ok(anonMsgData.messages.some(m => m.id === broadcastId));
  assert.ok(!anonMsgData.messages.some(m => m.id === privateData.notification.id));

  // Logged-in user should receive both broadcast and private message
  const userToken = regData.token;
  const userMsgRes = await worker.fetch(new Request('http://localhost/api/messages', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  }), env);
  const userMsgData = await userMsgRes.json();
  assert.equal(userMsgData.ok, true);
  assert.ok(userMsgData.messages.some(m => m.id === broadcastId));
  assert.ok(userMsgData.messages.some(m => m.id === privateData.notification.id));

  // 9.4 Admin revokes/deletes broadcast notification
  const deleteNotifRes = await worker.fetch(new Request(`http://localhost/api/admin/notifications?id=${broadcastId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  assert.equal(deleteNotifRes.status, 200);
  const deleteNotifData = await deleteNotifRes.json();
  assert.equal(deleteNotifData.ok, true);

  // Verify client no longer receives deleted notification
  const anonMsgRes2 = await worker.fetch(new Request('http://localhost/api/messages'), env);
  const anonMsgData2 = await anonMsgRes2.json();
  assert.ok(!anonMsgData2.messages.some(m => m.id === broadcastId));
});

test('Client UI - Out-of-the-Box Setup & Messages Red Dot Integration', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const ROOT = path.resolve(import.meta.dirname, '..');

  const html = fs.readFileSync(path.join(ROOT, 'apps/client/index.html'), 'utf8');
  assert.match(html, /studio(18[7-9]|19\d)/, 'index.html cache buster must be studio187 or higher');
  assert.match(html, /官方云服务畅通/, 'index.html must display official box-ready cloud status');
  assert.match(html, /class="gateway-debug-fold"/, 'index.html must fold custom gateway configuration into developer debug fold');

  const appJs = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  assert.match(appJs, /syncRemoteMessages/, 'app.js must implement syncRemoteMessages');
  assert.match(appJs, /has-unread/, 'app.js must toggle has-unread badge for notification drawer');
  assert.match(appJs, /fetchMessages/, 'app.js must call fetchMessages from auth module');

  const authJs = fs.readFileSync(path.join(ROOT, 'apps/client/auth.js'), 'utf8');
  assert.match(authJs, /export async function fetchMessages/, 'auth.js must export fetchMessages');
});
