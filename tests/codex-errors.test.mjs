import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {rpcError} from '../packages/agent/codex-errors.mjs';
import {CodexKernel} from '../packages/agent/codex-kernel.mjs';
test('RPC diagnostics retain method, code and safe detail, not arbitrary payload',()=>{
 const e=rpcError({code:-32603,message:'Internal error',data:{message:'Bad token Bearer abc key-secret',input:'private prompt'}},'thread/resume','key-secret');
 assert.match(e.message,/thread\/resume.*-32603.*Bad token/);
 for(const secret of ['abc','key-secret','private prompt'])assert(!e.message.includes(secret));
});
test('RPC receive preserves diagnostic and clears pending request',async()=>{
 const k=new CodexKernel({home:fs.mkdtempSync(path.join(os.tmpdir(),'zora-rpc-'))});
 let error;k.pending.set(1,{method:'turn/start',timer:setTimeout(()=>{},10000),reject:e=>error=e});
 await k.receive({id:1,error:{code:-32603,message:'Internal error',data:{reason:'session unavailable'}}});
 assert.match(error.message,/turn\/start.*session unavailable/);assert.equal(k.pending.size,0);
});
test('thread setup failures persist for their message without submitting a turn',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'zora-setup-'));const k=new CodexKernel({home});k.start=async()=>{};
 const methods=[];k.request=async method=>{methods.push(method);throw rpcError({code:-32603,message:'Internal error',data:'cannot resume'},method);};
 k.threadMap.c='existing';
 await assert.rejects(k.run('hello',{conversationId:'c',messageId:'m'}),/thread\/resume.*cannot resume/);
 assert.deepEqual(methods,['thread/resume']);assert.equal(k.active.size,0);
 const a=new CodexKernel({home}).listActivities()[0];assert.equal(a.status,'failed');assert.equal(a.messageId,'m');assert.equal(a.phase,'thread-setup');
});
