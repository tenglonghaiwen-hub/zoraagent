import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
import {createToolRunner} from '../packages/agent/tools.mjs';
test('completed execution associates only changed deliverables with conversation',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-artifact-flow-')),workspaceRoot=path.join(root,'workspace');
 const runtime=createLocalRuntime({workspaceRoot,directory:path.join(root,'ledger'),execFileImpl:async(_file,args)=>{if(args[0]==='run'){fs.writeFileSync(path.join(workspaceRoot,'report.txt'),'completed');fs.writeFileSync(path.join(workspaceRoot,'builder.js'),'intermediate');}return {};}});
 fs.writeFileSync(path.join(workspaceRoot,'existing.txt'),'existing');
 const r=runtime.propose({kind:'exec',command:'test',conversationId:'conversation-a'});
 const done=await runtime.approve(r.id);assert.equal(done.conversationId,'conversation-a');assert.deepEqual(done.artifacts.map(f=>f.path),['report.txt']);
});
test('tool caller binds local proposal to server conversation rather than model supplied value',async()=>{
 let body;const runner=createToolRunner({conversationId:'real-session',callApi:async r=>{body=r.body;return {};}});
 await runner('propose_local_action',{kind:'read',path:'a.txt',conversationId:'invented'});assert.equal(body.conversationId,'real-session');
});

test('deleting a finished record survives restart and preserves files and ownership',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-record-delete-')),workspaceRoot=path.join(root,'workspace'),directory=path.join(root,'ledger');
 const options={workspaceRoot,directory,execFileImpl:async(_file,args)=>{if(args[0]==='run')fs.writeFileSync(path.join(workspaceRoot,'result.txt'),'kept');return {};}};
 const runtime=createLocalRuntime(options),pending=runtime.propose({kind:'exec',command:'test',conversationId:'session-a'});
 assert.throws(()=>runtime.deleteRecord(pending.id),/审批/);
 await runtime.approve(pending.id);runtime.deleteRecord(pending.id);
 const restored=createLocalRuntime(options);assert.equal(restored.list().length,0);assert.equal(restored.list({includeDeleted:true})[0].conversationId,'session-a');assert.equal(restored.list({includeDeleted:true})[0].artifacts[0].path,'result.txt');assert.equal(fs.readFileSync(path.join(workspaceRoot,'result.txt'),'utf8'),'kept');
});
