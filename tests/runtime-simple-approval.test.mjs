import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
import {createWorkflowStore} from '../packages/agent/workflow-store.mjs';
import {handleLocalRuntimeRoutes} from '../apps/server/routes/local-runtime.mjs';
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-simple-'));const runtime=createLocalRuntime({directory:path.join(root,'approvals'),workspaceRoot:path.join(root,'workspace'),backend:'native'});return {root,runtime};}
test('batch validates all owners before executing and excludes future requests',async()=>{
 const {runtime}=fixture();
 const a=runtime.propose({kind:'write',path:'a.txt',content:'a',conversationId:'one'});
 const other=runtime.propose({kind:'write',path:'b.txt',content:'b',conversationId:'two'});
 await assert.rejects(runtime.approveBatch({conversationId:'one',ids:[a.id,other.id]}),/批次已变化/);
 assert.equal(runtime.list()[0].status,'pending');
 const later=runtime.propose({kind:'write',path:'later.txt',content:'later',conversationId:'one'});
 assert.equal((await runtime.approveBatch({conversationId:'one',ids:[a.id]}))[0].status,'completed');
 assert.equal(runtime.list().find(r=>r.id===later.id).status,'pending');
});
test('batch stops on failed script',async()=>{
 const {runtime}=fixture();
 const a=runtime.propose({kind:'exec',runtime:'node',command:"throw Error('bad script')",conversationId:'one'});
 const b=runtime.propose({kind:'write',path:'after.txt',content:'must not run',conversationId:'one'});
 const r=await runtime.approveBatch({conversationId:'one',ids:[a.id,b.id]});
 assert.equal(r.length,1);assert.equal(r[0].status,'failed');assert.equal(runtime.list()[1].status,'pending');
});
test('read-only proposals complete immediately, writes wait, batch requires user header',async()=>{
 const {runtime}=fixture();let response;
 const route=async(url,body,headers={})=>{
  await handleLocalRuntimeRoutes({method:'POST',headers:{host:'127.0.0.1',...headers},socket:{remoteAddress:'127.0.0.1'}},{},new URL('http://127.0.0.1'+url),{runtime:()=>runtime,workflows:()=>({tick:async()=>{}}),readJson:async()=>body,sendJson:(_,status,data)=>{response={status,data};}});return response;
 };
 assert.equal((await route('/api/local-runtime/propose',{kind:'list',conversationId:'one'})).data.status,'completed');
 assert.equal((await route('/api/local-runtime/propose',{kind:'write',path:'x',content:'x',conversationId:'one'})).data.status,'pending');
 assert.equal((await route('/api/local-runtime/approve-batch',{})).status,403);
});
test('workflow read-only checks complete without additional clicks',async()=>{
 const {runtime,root}=fixture();const store=createWorkflowStore({directory:path.join(root,'workflow'),runtime});
 store.create({conversationId:'one',steps:[{id:'list',request:{kind:'list',path:'.'}}]});
 await store.tick();assert.equal(store.list()[0].steps[0].status,'completed');
});
