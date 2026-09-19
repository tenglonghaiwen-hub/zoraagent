import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock environment
process.env.ZORA_AGENT_ENABLED = 'true';
process.env.ZORA_AGENT_API_KEY = 'test-key';
process.env.PORT = '0'; // Random available port

test('server loads all route modules without errors', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zora-routes-test-'));

  try {
    const { serveStatic } = await import('../apps/server/routes/static.mjs');
    assert.ok(serveStatic, 'static routes should be defined');
  } catch (e) {
    assert.fail(`Failed to load static routes: ${e.message}`);
  }

  try {
    const { handleWorkspaceRoutes } = await import('../apps/server/routes/workspace.mjs');
    assert.ok(handleWorkspaceRoutes, 'workspace routes should be defined');
  } catch (e) {
    assert.fail(`Failed to load workspace routes: ${e.message}`);
  }

  try {
    const { handleLocalRuntimeRoutes } = await import('../apps/server/routes/local-runtime.mjs');
    assert.ok(handleLocalRuntimeRoutes, 'local-runtime routes should be defined');
  } catch (e) {
    assert.fail(`Failed to load local-runtime routes: ${e.message}`);
  }

  try {
    const { handleGenerationRoutes } = await import('../apps/server/routes/generation.mjs');
    assert.ok(handleGenerationRoutes, 'generation routes should be defined');
  } catch (e) {
    assert.fail(`Failed to load generation routes: ${e.message}`);
  }

  try {
    const { handleOpenMontageRoutes } = await import('../apps/server/routes/openmontage.mjs');
    assert.ok(handleOpenMontageRoutes, 'openmontage routes should be defined');
  } catch (e) {
    assert.fail(`Failed to load openmontage routes: ${e.message}`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('route modules export valid handler functions', async () => {
  const { serveStatic } = await import('../apps/server/routes/static.mjs');
  const { handleWorkspaceRoutes } = await import('../apps/server/routes/workspace.mjs');
  const { handleLocalRuntimeRoutes } = await import('../apps/server/routes/local-runtime.mjs');
  const { handleGenerationRoutes } = await import('../apps/server/routes/generation.mjs');
  const { handleOpenMontageRoutes } = await import('../apps/server/routes/openmontage.mjs');

  // All should be functions
  assert.equal(typeof serveStatic, 'function', 'static routes should be a function');
  assert.equal(typeof handleWorkspaceRoutes, 'function', 'workspace routes should be a function');
  assert.equal(typeof handleLocalRuntimeRoutes, 'function', 'local-runtime routes should be a function');
  assert.equal(typeof handleGenerationRoutes, 'function', 'generation routes should be a function');
  assert.equal(typeof handleOpenMontageRoutes, 'function', 'om routes should be a function');
});

test('tools registry integrates with refactored tool handlers', async () => {
  const { createToolRunner } = await import('../packages/agent/tools.mjs');

  const mockCallApi = async () => ({ ok: true });
  const runner = createToolRunner({ callApi: mockCallApi, skills: [], mediaModels: [] });

  // Test that runner is created successfully
  assert.equal(typeof runner, 'function', 'should create a tool runner function');

  // Test that unknown tools are rejected
  const unknownResult = await runner('nonexistent_tool', {});
  assert.match(unknownResult.error, /未知工具/, 'should reject unknown tools');
});

test('media subagent uses refactored prompt module', async () => {
  const { createMediaDelegator } = await import('../packages/agent/media-subagents.mjs');

  let capturedPrompt = null;
  const mockRun = async (prompt, options) => {
    capturedPrompt = prompt;
    return { reply: 'test', tasks: [] };
  };

  const mockRunner = async () => ({ ok: true });

  const delegator = createMediaDelegator({
    run: mockRun,
    sharedRunner: mockRunner,
    mediaModels: [
      { id: 'test-image', kind: 'image', routes: [{ operation: 'generate', path: '/test' }] },
    ],
    conversationId: 'c1',
    messageId: 'm1',
    context: { history: [] },
    generationTasks: [],
  });

  // Delegate a task
  await delegator('delegate_media_task', { kind: 'image', task: '生成一张图片' });

  // Check that prompt was built using the refactored module
  assert.ok(capturedPrompt, 'prompt should be captured');
  assert.match(capturedPrompt, /图片专业子 Agent/, 'should use image subagent prompt');
  assert.match(capturedPrompt, /preview_task/, 'should mention preview tool');
});

test('chat service uses refactored prompt builder', async () => {
  const { createChatService } = await import('../apps/server/chat-service.mjs');

  let capturedPrompt = null;
  const mockRun = async (prompt, options) => {
    capturedPrompt = prompt;
    return { reply: 'test', tasks: [] };
  };

  const chat = createChatService({ run: mockRun });

  await chat({ message: '你好' });

  assert.ok(capturedPrompt, 'prompt should be captured');
  assert.match(capturedPrompt, /造境 Zora/, 'should use main agent prompt');
  assert.match(capturedPrompt, /delegate_media_task/, 'should mention delegation');
  assert.doesNotMatch(capturedPrompt, /RunningHub/, 'should not mention removed features');
});
