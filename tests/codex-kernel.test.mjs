import test from 'node:test';
import assert from 'node:assert/strict';
import {CodexKernel} from '../packages/agent/codex-kernel.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
test('Codex approval waits for a user decision and cannot be consumed twice',async()=>{
 const k=new CodexKernel({home:fs.mkdtempSync(path.join(os.tmpdir(),'zora-kernel-'))});const sent=[];k.send=m=>sent.push(m);k.active.set('t',{conversationId:'c',messageId:'m'});
 await k.receive({id:99,method:'item/commandExecution/requestApproval',params:{threadId:'t',command:'echo test'}});assert.equal(sent.length,0);const [r]=k.listApprovals();assert.equal(r.status,'pending');assert.equal(r.rpcId,undefined);k.decide(r.id,'deny');assert.deepEqual(sent[0],{id:99,result:{decision:'decline'}});assert.throws(()=>k.decide(r.id,'approve'));
});
test('Codex never executes a dynamic tool absent from the active turn allowlist',async()=>{
 const k=new CodexKernel({home:fs.mkdtempSync(path.join(os.tmpdir(),'zora-kernel-'))});let executed=0;const sent=[];k.send=m=>sent.push(m);k.active.set('t',{names:new Set(),toolRunner:()=>executed++,toolTrace:[]});await k.receive({id:1,method:'item/tool/call',params:{threadId:'t',tool:'unknown',arguments:{}}});assert.equal(executed,0);assert.equal(sent[0].result.success,false);
});

test('invalid credential is rejected before spawning Codex',async()=>{let spawned=false;const k=new CodexKernel({key:'bad\u0001key',home:fs.mkdtempSync(path.join(os.tmpdir(),'zora-key-check-')),spawnImpl:()=>{spawned=true;}});await assert.rejects(k.start(),/Key/);assert.equal(spawned,false);});
