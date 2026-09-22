import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {handleLocalRuntimeRoutes} from '../apps/server/routes/local-runtime.mjs';
import {CodexKernel,peekKernel} from '../packages/agent/codex-kernel.mjs';
import {saveApprovalMode} from '../packages/agent/approval-policy.mjs';

test('fresh installation can save approval before kernel initialization and new kernels inherit it',async()=>{
 const old=process.env.ZORA_DATA_DIR;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-approval-settings-'));
 process.env.ZORA_DATA_DIR=directory;
 const request=async(method,mode,headers={})=>{
  let result;
  await handleLocalRuntimeRoutes({method,headers:{host:'127.0.0.1:4317',...headers},socket:{remoteAddress:'127.0.0.1'}},{},new URL('http://127.0.0.1:4317/api/local-runtime/codex/approval-mode'),{
   readJson:async()=>({mode}),sendJson:(_,status,body)=>{result={status,body};},
  });
  return result;
 };
 try{
  assert.equal(peekKernel(),undefined);
  assert.deepEqual(await request('GET'),{status:200,body:{mode:'smart'}});
  assert.equal((await request('POST','full')).status,403);
  assert.equal((await request('GET')).body.mode,'smart');
  const legacy=path.join(directory,'legacy');
  saveApprovalMode(path.join(legacy,'zora-approval-policy.json'),'ask');
  const kernel=new CodexKernel({bin:'unused',home:legacy,cwd:path.join(directory,'workspace')});
  assert.equal(kernel.getApprovalMode(),'ask');
  assert.equal((await request('POST','ask',{'x-zora-approval':'user'})).status,200);
  assert.equal(peekKernel(),undefined);
  assert.equal((await request('POST','invalid',{'x-zora-approval':'user'})).status,400);
  const restarted=new CodexKernel({bin:'unused',home:path.join(directory,'new-login'),cwd:path.join(directory,'workspace')});
  assert.equal(restarted.getApprovalMode(),'ask');
  assert.equal((await request('GET')).body.mode,'ask');
  assert.equal((await request('POST','smart',{'x-zora-approval':'user'})).status,200);
  assert.equal(kernel.getApprovalMode(),'smart');
  assert.equal(restarted.getApprovalMode(),'smart');
 }finally{if(old===undefined)delete process.env.ZORA_DATA_DIR;else process.env.ZORA_DATA_DIR=old;}
});
