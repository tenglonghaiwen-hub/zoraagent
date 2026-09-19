import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const authSource = readFileSync(resolve('apps/client/auth.js'), 'utf8');
const indexSource = readFileSync(resolve('apps/client/index.html'), 'utf8');
const appSource = readFileSync(resolve('apps/client/app.js'), 'utf8');
const styleSource = readFileSync(resolve('apps/client/style.css'), 'utf8');

test('auth.js should export gateway config helpers and dynamically resolve apiUrl', async () => {
  assert.match(authSource, /export\s+function\s+getGatewayConfig/);
  assert.match(authSource, /export\s+function\s+setGatewayConfig/);
  assert.match(authSource, /export\s+async\s+function\s+testGatewayConnection/);
  assert.match(authSource, /DEFAULT_LOCAL_GATEWAY\s*=\s*'http:\/\/127\.0\.0\.1:4318'/);
  assert.match(authSource, /DEFAULT_CLOUD_GATEWAY\s*=\s*'https:\/\/zora-api(\.tenglonghaiwen)?\.workers\.dev'/);

  // Mock localStorage and window
  const storage = new Map();
  const mockStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear()
  };
  globalThis.window = {
    localStorage: mockStorage,
    location: {
      origin: 'http://localhost:3000'
    }
  };
  globalThis.localStorage = mockStorage;

  const authModule = await import('../apps/client/auth.js');

  // Default state: cloud mode (global production gateway)
  const defaultConfig = authModule.getGatewayConfig();
  assert.equal(defaultConfig.mode, 'cloud');
  assert.equal(defaultConfig.localUrl, 'http://127.0.0.1:4318');
  assert.equal(defaultConfig.cloudUrl, authModule.DEFAULT_CLOUD_GATEWAY);
  assert.equal(authModule.getApiBase(), authModule.DEFAULT_CLOUD_GATEWAY);
  assert.equal(authModule.apiUrl('/api/models'), `${authModule.DEFAULT_CLOUD_GATEWAY}/api/models`);

  // Auto-migration test: legacy placeholder should be sanitized to DEFAULT_CLOUD_GATEWAY
  mockStorage.setItem('zora.gateway.cloudUrl.v1', 'https://zora-api.workers.dev');
  const migratedConfig = authModule.getGatewayConfig();
  assert.equal(migratedConfig.cloudUrl, authModule.DEFAULT_CLOUD_GATEWAY);

  // Switch to local
  authModule.setGatewayConfig({ mode: 'local' });
  assert.equal(authModule.getApiBase(), 'http://127.0.0.1:4318');
  assert.equal(authModule.apiUrl('/api/auth/login'), 'http://127.0.0.1:4318/api/auth/login');

  // Switch to custom cloud mode
  const customCloud = 'https://custom-worker.example.workers.dev';
  const updated = authModule.setGatewayConfig({
    mode: 'cloud',
    cloudUrl: customCloud
  });
  assert.equal(updated.mode, 'cloud');
  assert.equal(updated.cloudUrl, customCloud);
  assert.equal(authModule.getApiBase(), customCloud);
  assert.equal(authModule.apiUrl('/api/chat'), `${customCloud}/api/chat`);
});

test('index.html should include gateway switch controls and cache buster studio184+', () => {
  assert.match(indexSource, /studio(18[4-9]|19\d)/, 'Static resources must be tagged with studio184 or higher');
  assert.match(indexSource, /class="[^"]*gateway-setting-row/, 'Must contain gateway-setting-row');
  assert.match(indexSource, /data-gateway-mode="local"/, 'Must have local gateway toggle pill');
  assert.match(indexSource, /data-gateway-mode="cloud"/, 'Must have cloud gateway toggle pill');
  assert.match(indexSource, /id="gateway-cloud-url"/, 'Must have cloud worker URL input');
  assert.match(indexSource, /id="gateway-test-btn"/, 'Must have test connection button');
});

test('app.js should bind gateway settings interaction logic', () => {
  assert.match(appSource, /getGatewayConfig/, 'app.js must import getGatewayConfig');
  assert.match(appSource, /setGatewayConfig/, 'app.js must import setGatewayConfig');
  assert.match(appSource, /testGatewayConnection/, 'app.js must import testGatewayConnection');
  assert.match(appSource, /function\s+initGatewaySettings\s*\(/, 'Must declare initGatewaySettings function');
  assert.match(appSource, /initGatewaySettings\(\)/, 'Must invoke initGatewaySettings on initialization');
});

test('style.css should style the gateway toggle bar and status feedback', () => {
  assert.match(styleSource, /\.gateway-setting-row/);
  assert.match(styleSource, /\.gateway-mode-pills/);
  assert.match(styleSource, /\.gateway-pill\.active/);
  assert.match(styleSource, /\.gateway-status-text/);
});
