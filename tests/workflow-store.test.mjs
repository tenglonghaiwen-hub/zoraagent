import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createWorkflowStore} from '../packages/agent/workflow-store.mjs';
function fixture(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-workflow-'));const requests=[];const runtime={list:()=>requests,propose:request=>{const r={id:String(requests.length+1),status:'pending',request};requests.push(r);return r;}};return {directory,requests,runtime};}
test('dependencies wait for approved completion and restart does not repropose',async()=>{
 const f=fixture();let store=createWorkflowStore(f);
 store.create({steps:[{id:'a',request:{kind:'write',path:'a.txt',content:'a'}},{id:'b',dependsOn:['a'],request:{kind:'read',path:'a.txt'}}]});
 await store.tick();assert.equal(f.requests.length,1);
 store=createWorkflowStore(f);await store.tick();assert.equal(f.requests.length,1);
 f.requests[0].status='completed';await store.tick();assert.equal(f.requests.length,2);
 await store.tick();assert.equal(f.requests.length,2);
});
test('cycles are rejected and denied dependencies block later steps',async()=>{
 const f=fixture(),s=createWorkflowStore(f);
 assert.throws(()=>s.create({steps:[{id:'a',dependsOn:['a']}]}),/循环/);
 s.create({steps:[{id:'a',request:{kind:'read',path:'a'}},{id:'b',dependsOn:['a'],request:{kind:'read',path:'b'}}]});
 await s.tick();f.requests[0].status='denied';await s.tick();assert.equal(f.requests.length,1);assert.equal(s.list()[0].steps[1].status,'blocked');
});
test('interrupted issuance becomes unknown without a duplicate action',async()=>{
 const f=fixture();fs.writeFileSync(path.join(f.directory,'saved.json'),JSON.stringify({id:'saved',steps:[{id:'a',status:'issuing',dependsOn:[],request:{kind:'exec',command:'echo test'}}]}));
 const s=createWorkflowStore(f);await s.tick();assert.equal(f.requests.length,0);assert.equal(s.list()[0].steps[0].status,'unknown');
});
