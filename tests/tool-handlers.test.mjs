import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrowserTool } from '../packages/agent/tool-handlers/browser-tools.mjs';
import { handleSkillTool } from '../packages/agent/tool-handlers/skill-tools.mjs';
import { handleOMTool } from '../packages/agent/tool-handlers/om-tools.mjs';
import { handleRuntimeTool } from '../packages/agent/tool-handlers/runtime-tools.mjs';

test('browser tool handler routes desktop_jianying and browser_* actions', async () => {
  // Mock callDesktop and callBrowser
  const originalCallDesktop = (await import('../packages/agent/desktop-client.mjs')).callDesktop;
  const originalCallBrowser = (await import('../packages/agent/browser-client.mjs')).callBrowser;

  let desktopCalled = false;
  let browserCalled = false;
  let browserAction = null;

  // Test desktop_jianying
  const result1 = await handleBrowserTool('desktop_jianying', { action: 'listWindows' });
  assert.ok(result1 !== undefined, 'desktop_jianying should be handled');

  // Test browser_open
  const result2 = await handleBrowserTool('browser_open', { url: 'https://example.com' });
  assert.ok(result2 !== undefined, 'browser_open should be handled');

  // Test browser_search
  const result3 = await handleBrowserTool('browser_search', { query: 'test' });
  assert.ok(result3 !== undefined, 'browser_search should be handled');

  // Test browser_read
  const result4 = await handleBrowserTool('browser_read', {});
  assert.ok(result4 !== undefined, 'browser_read should be handled');

  // Test unknown tool
  const result5 = await handleBrowserTool('unknown_tool', {});
  assert.equal(result5, undefined, 'unknown tool should return undefined');
});

test('skill tool handler lists and retrieves skills', async () => {
  const catalog = [
    { id: 'test-skill-1', name: '测试技能', category: 'test', description: '测试', prompt: 'TEST_PROMPT', source: 'zora' },
  ];

  const mockCallApi = async ({ method, path }) => {
    if (path === '/api/om/skills?limit=300') {
      return { data: { skills: [{ id: 'om:test', name: 'OM技能' }] } };
    }
    return { error: 'Not found' };
  };

  // Test list_skills
  const result1 = await handleSkillTool('list_skills', {}, { catalog, callApi: mockCallApi });
  assert.ok(Array.isArray(result1.skills), 'should return skills array');
  assert.equal(result1.count, 2, 'should include local and OM skills');
  assert.equal(result1.skills[0].id, 'test-skill-1');

  // Test get_skill by ID
  const result2 = await handleSkillTool('get_skill', { skillId: 'test-skill-1' }, { catalog, callApi: mockCallApi });
  assert.equal(result2.prompt, 'TEST_PROMPT');

  // Test get_skill by name
  const result3 = await handleSkillTool('get_skill', { name: '测试技能' }, { catalog, callApi: mockCallApi });
  assert.equal(result3.id, 'test-skill-1');

  // Test non-existent skill
  const result4 = await handleSkillTool('get_skill', { skillId: 'non-existent' }, { catalog, callApi: mockCallApi });
  assert.ok(result4.error, 'should return error for non-existent skill');
  assert.match(result4.error, /技能不存在|Not found/, 'error message should indicate skill not found');

  // Test unknown tool
  const result5 = await handleSkillTool('unknown_tool', {}, { catalog, callApi: mockCallApi });
  assert.equal(result5, undefined);
});

test('OM tool handler routes OpenMontage operations', async () => {
  const mockCallApi = async ({ method, path, body }) => {
    if (path === '/api/om/status') return { ok: true, status: 'ready' };
    if (path === '/api/om/projects') return { projects: [] };
    if (path === '/api/om/tools/execute') return { ok: true, result: 'executed' };
    if (path.startsWith('/api/om/projects/')) return { project: { id: 'test-project' } };
    if (path.startsWith('/api/om/tools')) return { tools: [] };
    if (path.startsWith('/api/om/skills')) return { skills: [] };
    return { error: 'Not found' };
  };

  // Test om_status
  const result1 = await handleOMTool('om_status', {}, mockCallApi);
  assert.equal(result1.status, 'ready');

  // Test om_list_projects
  const result2 = await handleOMTool('om_list_projects', {}, mockCallApi);
  assert.ok(Array.isArray(result2.projects));

  // Test om_execute_tool
  const result3 = await handleOMTool('om_execute_tool', { projectId: 'p1', tool: 'test' }, mockCallApi);
  assert.equal(result3.ok, true);

  // Test om_get_project
  const result4 = await handleOMTool('om_get_project', { projectId: 'test-project' }, mockCallApi);
  assert.equal(result4.project.id, 'test-project');

  // Test om_list_tools with query params
  const result5 = await handleOMTool('om_list_tools', { capability: 'tts', limit: 10 }, mockCallApi);
  assert.ok(Array.isArray(result5.tools));

  // Test without API layer
  const result6 = await handleOMTool('om_status', {}, null);
  assert.equal(result6.error, 'API 层未就绪');

  // Test unknown tool
  const result7 = await handleOMTool('unknown_tool', {}, mockCallApi);
  assert.equal(result7, undefined);
});

test('runtime tool handler manages local execution and workflows', async () => {
  const mockCallApi = async ({ method, path, body }) => {
    if (path === '/api/local-runtime') return { ok: true, status: 'ready', docker: true };
    if (path === '/api/local-runtime/propose') return { ok: true, approvalId: 'a1', status: 'pending' };
    if (path === '/api/local-runtime/workflows') return { ok: true, workflowId: 'w1' };
    return { error: 'Not found' };
  };

  // Test local_runtime_status
  const result1 = await handleRuntimeTool('local_runtime_status', {}, mockCallApi, {});
  assert.equal(result1.status, 'ready');
  assert.equal(result1.docker, true);

  // Test propose_local_action
  const result2 = await handleRuntimeTool(
    'propose_local_action',
    { kind: 'read', path: 'test.txt' },
    mockCallApi,
    { conversationId: 'c1', messageId: 'm1' }
  );
  assert.equal(result2.status, 'pending');

  // Test plan_local_workflow
  const result3 = await handleRuntimeTool(
    'plan_local_workflow',
    { steps: [{ id: 's1', request: { kind: 'exec', command: 'ls' } }] },
    mockCallApi,
    { conversationId: 'c1', messageId: 'm1' }
  );
  assert.equal(result3.ok, true);

  // Test without API layer
  const result4 = await handleRuntimeTool('local_runtime_status', {}, null, {});
  assert.equal(result4.ok, false);
  assert.match(result4.error, /未就绪/);

  // Test unknown tool
  const result5 = await handleRuntimeTool('unknown_tool', {}, mockCallApi, {});
  assert.equal(result5, undefined);
});

test('all tool handlers return undefined for unrecognized tool names', async () => {
  assert.equal(await handleBrowserTool('unknown', {}), undefined);
  assert.equal(await handleSkillTool('unknown', {}, {}), undefined);
  assert.equal(await handleOMTool('unknown', {}, () => {}), undefined);
  assert.equal(await handleRuntimeTool('unknown', {}, () => {}, {}), undefined);
});
