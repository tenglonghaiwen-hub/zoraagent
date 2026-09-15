import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createGenerationTaskStore} from '../packages/duoyuanx/task-store.mjs';
import {getModel} from '../packages/duoyuanx/catalog.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
const m=getModel('doubao-seedance-2-0-mini');
const draft={modelId:m.id,prompt:'private test prompt',count:1,concurrency:1,ratio:'16:9',resolution:'720P',duration:5,videoMode:'t2v'};
const flush=()=>new Promise(r=>setImmediate(r));
const setup=extra=>createGenerationTaskStore({directory:fs.mkdtempSync(path.join(os.tmpdir(),'zora-tasks-')),getModel,base:'https://mock.test',key:'test-secret',...extra});
test('batch completion does not overwrite a result already obtained by background polling',async()=>{
 let time=0,finish;const queued={ok:true,upstream:{task_id:'early-job'}};
 const store=setup({now:()=>time,generate:async(d,m,{onResult})=>{onResult(0,queued);return new Promise(r=>{finish=()=>r([queued,{ok:false,error:'second failed'}]);});},fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',url:'https://mock.test/early'})})});
 const id=randomUUID();store.submit(id,{...draft,count:2},m);await flush();time=5000;await store.tick();finish();await flush();assert.equal(store.get(id).status,'partial');assert(JSON.stringify(store.get(id)).includes('https://mock.test/early'));store.close();
});
test('2.5 canonical ID and 2-5 alias produce identical requests; Mini keeps gateway ID',()=>{
 for(const id of ['doubao-seedance-2-5','doubao-seedance-2.5','doubao-seedance-2-0-mini']){
  const result=validateDraft({...draft,modelId:id});assert(result.ok);const packed=packGenerateRequest(result.draft,result.model);assert.equal(packed.path,'/v1/video/generations');assert.equal(packed.body.model,id.replace('2-5','2.5'));assert.equal(packed.body.content[0].text,draft.prompt);
 }
});
test('durable receipt deduplicates retries and restart polls without a second generation POST',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-restart-'));let posts=0,queries=0,time=0;
 const options={directory,now:()=>time,generate:async(d,m,{onResult})=>{posts++;const r={ok:true,upstream:{task_id:'remote-job'}};await onResult(0,r);return [r];},fetchImpl:async()=>{queries++;return {ok:true,json:async()=>({status:'succeeded',content:{video_url:'https://mock.test/result.mp4'}})};}};
 let store=setup(options);const id=randomUUID();assert.equal(store.submit(id,draft,m).status,'running');await flush();store.submit(id,{...draft,id:'new-id',createdAt:'other-time'},m);assert.equal(posts,1);
 assert.throws(()=>store.submit(id,{...draft,prompt:'different'},m),/其他参数/);
 store.close();store=setup(options);time=6000;await store.tick();assert.equal(posts,1);assert.equal(queries,1);assert.equal(store.get(id).status,'completed');
 const raw=fs.readFileSync(path.join(directory,id+'.json'),'utf8');assert(!raw.includes('private test prompt'));assert(!raw.includes('test-secret'));assert(raw.includes('result.mp4'));store.close();
});
test('network failure backs off, then pending task recovers',async()=>{
 let time=0,calls=0;const store=setup({now:()=>time,generate:async()=>[{ok:true,upstream:{task_id:'job'}}],fetchImpl:async()=>{if(++calls===1)throw Error('offline');return {ok:true,json:async()=>({status:'completed',video_url:'https://mock.test/done'})};}});const id=randomUUID();store.submit(id,draft,m);await flush();time=5000;await store.tick();assert.equal(store.get(id).status,'running');assert.match(store.get(id).pollError,/offline/);time=6000;await store.tick();assert.equal(calls,1);time=16000;await store.tick();assert.equal(store.get(id).status,'completed');store.close();
});
test('partial batch resumes known receipt but interrupted submissions are never repeated',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-partial-'));let posts=0;const id=randomUUID();let store=setup({directory,generate:async(d,m,{onResult})=>{posts++;onResult(0,{ok:true,upstream:{task_id:'known'}});return new Promise(()=>{});}});store.submit(id,{...draft,count:2},m);await flush();store.close();
 store=setup({directory,generate:async()=>{posts++;},fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',url:'https://mock.test/one'})})});await store.tick();assert.equal(posts,1);assert.equal(store.get(id).status,'unknown');assert.equal(store.get(id).submissionUnknown,true);assert.match(store.get(id).upstreams[1].error,/未自动重提/);store.close();
});
test('expired and failed tasks terminate, and malformed success cannot claim completion',async()=>{
 for(const response of [{ok:false,status:404,json:async()=>({})},{ok:true,json:async()=>({status:'failed',error:{message:'rejected'}})},{ok:true,json:async()=>({status:'completed'})}]){
  let time=0;const store=setup({now:()=>time,generate:async()=>[{ok:true,upstream:{task_id:'job'}}],fetchImpl:async()=>response});const id=randomUUID();store.submit(id,draft,m);await flush();time=5000;await store.tick();assert.equal(store.get(id).status,(await response.json()).status==='completed'?'unknown':'failed');store.close();
 }
 const store=setup({generate:async()=>[{ok:true,upstream:{}}]});const id=randomUUID();store.submit(id,draft,m);await flush();assert.equal(store.get(id).status,'unknown');assert.equal(store.get(id).submissionUnknown,true);store.close();
});
