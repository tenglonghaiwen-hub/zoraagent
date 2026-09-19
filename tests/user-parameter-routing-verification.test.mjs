import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validateDraft } from '../packages/contracts/domain.mjs';
import { getModels, getModel } from '../packages/duoyuanx/catalog.mjs';
import { proxyGeneration } from '../apps/cloudflare-worker/src/proxy.mjs';
import { attachModelCapabilities } from '../apps/cloudflare-worker/src/billing.mjs';

test('1. Server Models /api/models capability enrichment', async () => {
  // Test Cloudflare Worker attachment
  const rawDbModel = {
    id: 'MiniMax-H3',
    name: 'MiniMax Hailuo-02',
    kind: 'video',
    provider: 'minimax',
    quotaCostPerUnit: 100,
    maxConcurrency: 2
  };
  const enrichedWorker = attachModelCapabilities(rawDbModel);
  assert.ok(Array.isArray(enrichedWorker.modes) && enrichedWorker.modes.length > 0, 'Worker model should have modes');
  assert.ok(enrichedWorker.modes.some(m => m.id === 't2v'), 'Should include text-to-video mode');
  assert.ok(enrichedWorker.modes.some(m => m.id === 'fl'), 'Should include first-last frame mode');
  assert.ok(Array.isArray(enrichedWorker.ratios) && enrichedWorker.ratios.length > 0, 'Worker model should have ratios');
  assert.ok(enrichedWorker.ratios.includes('16:9'), 'Should include 16:9 ratio');
  assert.ok(enrichedWorker.ratios.includes('9:16'), 'Should include 9:16 ratio');
  assert.ok(Array.isArray(enrichedWorker.durations) && enrichedWorker.durations.length > 0, 'Worker model should have durations');

  // Test Image Model attachment
  const rawImageModel = {
    id: 'doubao-image',
    name: 'Doubao Image',
    kind: 'image',
    provider: 'duoyuanx',
    quotaCostPerUnit: 10,
    maxConcurrency: 2
  };
  const enrichedImage = attachModelCapabilities(rawImageModel);
  assert.ok(Array.isArray(enrichedImage.modes) && enrichedImage.modes.length > 0, 'Image model should have modes');
  assert.ok(enrichedImage.modes.some(m => m.id === 't2i'), 'Should include text-to-image mode');
  assert.ok(enrichedImage.modes.some(m => m.id === 'i2i'), 'Should include image-to-image mode');
  assert.ok(enrichedImage.ratios.includes('1:1'), 'Should include 1:1 ratio');
});

test('2. Client normalizeModel and refreshModelCatalog integrity', () => {
  const appJs = readFileSync(resolve('apps/client/app.js'), 'utf-8');
  assert.match(appJs, /models\s*=\s*\(data\.models\s*\|\|\s*\[\]\)\.map\(normalizeModel\)/, 'refreshModelCatalog must normalize models');
  assert.match(appJs, /function\s+normalizeModel/, 'normalizeModel function must be defined');
  assert.doesNotMatch(appJs, /p\.label\.textContent\s*=\s*value\s*\|\|\s*'暂无模型'/, 'syncPickers must not default all pickers to 暂无模型');
});

test('3. Parameter validation via /api/preview with customized user inputs', () => {
  // Simulate user changing parameters: ratio -> 9:16, resolution -> 720P, duration -> 5, mode -> t2v
  const userCustomizedInput = {
    modelId: 'MiniMax-H3',
    prompt: 'A cinematic drone shot of cyberpunk cityscape at midnight',
    count: 1,
    concurrency: 1,
    ratio: '9:16',
    resolution: '720P',
    duration: 5,
    videoMode: 't2v',
    references: []
  };

  const result = validateDraft(userCustomizedInput);
  assert.ok(result.ok, `validateDraft should succeed for customized parameters: ${result.error}`);
  assert.equal(result.draft.ratio, '9:16', 'Draft ratio should match user customized selection');
  assert.equal(result.draft.resolution, '720P', 'Draft resolution should match user customized selection');
  assert.equal(result.draft.duration, 5, 'Draft duration should match user customized selection');
  assert.equal(result.draft.videoMode, 't2v', 'Draft videoMode should match user customized selection');
});

test('4. Upstream proxy routing & payload transformation for MiniMax Official', async () => {
  let capturedFetch = null;
  const mockEnv = {
    MINIMAX_API_KEY: 'test-minimax-key',
    MINIMAX_BASE_URL: 'https://mock-minimax.test'
  };

  // Temporarily mock global fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedFetch = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        task_id: 'task-test-route-888'
      })
    };
  };

  try {
    // Case 4.1: User customized ratio = 9:16, duration = 6, resolution = 1080P
    const userPayload = {
      model: 'MiniMax-H3',
      prompt: 'A neon cyberpunk car speeding in rain',
      duration: 6,
      ratio: '9:16',
      resolution: '1080P',
      videoMode: 't2v',
      count: 1,
      concurrency: 1
    };

    const res = await proxyGeneration({
      body: userPayload,
      env: mockEnv,
      provider: 'minimax'
    });

    assert.equal(res.task_id, 'task-test-route-888');
    assert.ok(capturedFetch.url.endsWith('/v2/video_generation'), 'Must route to MiniMax official /v2/video_generation');
    assert.equal(capturedFetch.body.ratio, '9:16', 'Must route user modified ratio 9:16 to upstream');
    assert.equal(capturedFetch.body.resolution, '1080P', 'Must route user modified resolution 1080P to upstream');
    assert.equal(capturedFetch.body.duration, 6, 'Must route user modified duration 6 to upstream');
    assert.deepEqual(capturedFetch.body.content, [{ type: 'text', text: userPayload.prompt }], 'Content should contain user prompt');

    // Case 4.2: First-last frame mode (fl) with 2 references
    const flPayload = {
      model: 'MiniMax-H3',
      prompt: 'Morphing from day to night',
      duration: 5,
      ratio: 'adaptive',
      resolution: '720P',
      videoMode: 'fl',
      references: [
        { type: 'image/png', contentUrl: 'https://example.com/first.png', role: 'first_frame' },
        { type: 'image/png', contentUrl: 'https://example.com/last.png', role: 'last_frame' }
      ]
    };

    await proxyGeneration({
      body: flPayload,
      env: mockEnv,
      provider: 'minimax'
    });

    assert.equal(capturedFetch.body.content.length, 3, 'Must contain 1 text + 2 image frames');
    assert.equal(capturedFetch.body.content[1].image_url.url, 'https://example.com/first.png');
    assert.equal(capturedFetch.body.content[2].image_url.url, 'https://example.com/last.png');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('5. Upstream proxy routing for Duoyuanx / General models', async () => {
  let capturedFetch = null;
  const mockEnv = {
    DUOYUANX_API_KEY: 'test-dyx-key',
    DUOYUANX_BASE_URL: 'https://mock-dyx.test'
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedFetch = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'dyx-task-123',
        url: 'https://mock-dyx.test/output.png'
      })
    };
  };

  try {
    const userPayload = {
      model: 'doubao-image',
      prompt: 'A cute astronaut cat on Mars',
      ratio: '3:4',
      resolution: '2K',
      videoMode: 't2i',
      count: 2,
      concurrency: 2
    };

    const res = await proxyGeneration({
      body: userPayload,
      env: mockEnv,
      provider: 'duoyuanx'
    });

    assert.equal(res.id, 'dyx-task-123');
    assert.ok(capturedFetch.url.endsWith('/v1/images/generations'), 'Should route image generation to /v1/images/generations');
    assert.equal(capturedFetch.body.ratio, '3:4', 'Should preserve user modified ratio 3:4');
    assert.equal(capturedFetch.body.resolution, '2K', 'Should preserve user modified resolution 2K');
    assert.equal(capturedFetch.body.count, 2, 'Should preserve user modified count 2');
    assert.equal(capturedFetch.body.concurrency, 2, 'Should preserve user modified concurrency 2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
