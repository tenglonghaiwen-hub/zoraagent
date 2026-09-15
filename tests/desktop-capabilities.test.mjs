import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGenerationCapabilities } from '../apps/desktop/main/server-capabilities.mjs';

test('desktop accepts current and newer Agent task capability versions', async () => {
  for (const version of [1, 2]) {
    const result = await requireGenerationCapabilities('http://127.0.0.1:4317', { fetchImpl: async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:4317/api/generation-capabilities');
      assert.ok(options.signal);
      return Response.json({ durableTasks: true, agentTasksVersion: version });
    }});
    assert.equal(result.agentTasksVersion, version);
  }
});

test('desktop rejects legacy or malformed capabilities with restart guidance', async () => {
  for (const value of [{}, {durableTasks:true}, {durableTasks:false,agentTasksVersion:1}, {durableTasks:true,agentTasksVersion:0}, {durableTasks:true,agentTasksVersion:'1'}, null]) {
    await assert.rejects(requireGenerationCapabilities('http://127.0.0.1:4317', {
      fetchImpl: async () => Response.json(value),
    }), /后端版本不兼容.*重启.*现有服务未被停止/);
  }
});

test('desktop explains missing endpoint, bad JSON and connection failure', async () => {
  for (const fetchImpl of [async () => new Response('', {status:404}), async () => new Response('not json'), async () => {throw new Error('connection refused');}]) {
    await assert.rejects(requireGenerationCapabilities('http://127.0.0.1:4317', {fetchImpl}), /无法确认 Zora 后端能力.*重启.*现有服务未被停止/);
  }
});
