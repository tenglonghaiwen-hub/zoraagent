import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
import {createWorkflowStore} from '../packages/agent/workflow-store.mjs';

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zora-native-script-'));
  const config = {directory: path.join(root, 'approvals'), workspaceRoot: path.join(root, 'workspace'), backend: 'native', ...options};
  return {root, config, runtime: createLocalRuntime(config)};
}
test('script requires explicit approval, delivers real file and cannot replay', async () => {
  const {config, runtime} = fixture();
  const request = runtime.propose({kind: 'exec', runtime: 'node', command: "require('fs').writeFileSync('result.txt','created'); console.log('done')"});
  const target = path.join(config.workspaceRoot, 'result.txt');
  assert.equal(fs.existsSync(target), false);
  assert.equal(request.request.isolation, 'none');
  const result = await runtime.approve(request.id);
  assert.equal(result.status, 'completed', result.error);
  assert.equal(fs.readFileSync(target, 'utf8'), 'created');
  assert.match(result.stdout, /done/);
  assert.ok(result.artifacts.some(file => file.name === 'result.txt' || file.path === 'result.txt'));
  fs.writeFileSync(target, 'keep');
  await createLocalRuntime(config).approve(request.id);
  assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
});
test('deny and changed runtime cannot execute', async () => {
  const {config, runtime} = fixture();
  const r = runtime.propose({kind: 'exec', runtime: 'node', command: "throw Error('should not run')"});
  runtime.deny(r.id); assert.equal((await runtime.approve(r.id)).status, 'denied');
  const p = runtime.propose({kind: 'exec', runtime: 'node', command: 'console.log(1)'});
  await assert.rejects(createLocalRuntime({...config, nativeTimeout: 200}).approve(p.id), /配置已改变/);
  assert.throws(() => runtime.propose({kind: 'exec', runtime: 'powershell', command: 'x'}));
});
test('timeout is failed and diagnostics are retained; child environment excludes API secrets', async () => {
  const {runtime} = fixture({nativeTimeout: 300});
  const p = runtime.propose({kind: 'exec', runtime: 'node', command: "console.log('started');setInterval(()=>{},1000)"});
  const result = await runtime.approve(p.id);
  assert.equal(result.status, 'failed'); assert.match(result.error, /超时/); assert.match(result.stdout, /started/);
  process.env.ZORA_TEST_API_SECRET = 'must-not-forward';
  try {
    const q = runtime.propose({kind: 'exec', runtime: 'node', command: "console.log(process.env.ZORA_TEST_API_SECRET || 'absent');process.exitCode=7"});
    const error = await runtime.approve(q.id); assert.equal(error.status, 'failed'); assert.match(error.stdout, /absent/); assert.match(error.error, /7/);
  } finally { delete process.env.ZORA_TEST_API_SECRET; }
});
test('user cancel terminates a running script and its spawned child', async () => {
  const {config, runtime} = fixture();
  const p = runtime.propose({kind: 'exec', runtime: 'node', command: "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true});require('fs').writeFileSync('child.txt',String(c.pid));setInterval(()=>{},1000)"});
  const running = runtime.approve(p.id);
  const file = path.join(config.workspaceRoot, 'child.txt');
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) await new Promise(r => setTimeout(r, 25));
  assert.ok(fs.existsSync(file)); const pid = Number(fs.readFileSync(file, 'utf8'));
  runtime.cancel(p.id); const result = await running;
  assert.equal(result.status, 'failed'); assert.match(result.error, /中止/);
  assert.throws(() => process.kill(pid, 0));
});
test('workflow exposes each next step only after prior approval succeeds', async () => {
  const {root, runtime} = fixture();
  const store = createWorkflowStore({directory: path.join(root, 'workflows'), runtime});
  store.create({steps: [{id:'one',request:{kind:'exec',runtime:'node',command:'console.log(1)'}},{id:'two',dependsOn:['one'],request:{kind:'exec',runtime:'node',command:'console.log(2)'}}]});
  await store.tick(); assert.equal(runtime.list().length,1);
  await runtime.approve(runtime.list()[0].id); await store.tick();
  assert.equal(runtime.list().length,2); assert.equal(runtime.list()[1].status,'pending');
});
test('bundled Python executes without system Python', async () => {
  const {runtime} = fixture();
  const p = runtime.propose({kind:'exec',runtime:'python',command:"print('python-ready')"});
  const result = await runtime.approve(p.id);
  assert.equal(result.status,'completed',result.error); assert.match(result.stdout,/python-ready/);
});
test('auto backend explicitly requested native script needs no Docker and bounds output', async () => {
  const {runtime} = fixture({backend:'auto',execFileImpl:async()=>{throw Error('Docker must not be invoked');}});
  const p=runtime.propose({kind:'exec',runtime:'node',command:"console.log('x'.repeat(100000));setInterval(()=>{},1000)"});
  const r=await runtime.approve(p.id);assert.equal(r.status,'failed');assert.match(r.error,/输出超过/);assert.ok(r.stdout.length<=32768);
});
