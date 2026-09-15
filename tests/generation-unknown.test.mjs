import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {generateBatch} from '../packages/duoyuanx/generation-service.mjs';
import {createGenerationTaskStore} from '../packages/duoyuanx/task-store.mjs';
import {getModel} from '../packages/duoyuanx/catalog.mjs';
const model=getModel('gpt-image-2'),draft={modelId:model.id,prompt:'mock',count:1,concurrency:1,ratio:'1:1',resolution:'1K',references:[]};
const flush=()=>new Promise(r=>setImmediate(r));
const directory=()=>fs.mkdtempSync(path.join(os.tmpdir(),'zora-unknown-'));
test('POST timeout, transport failure, invalid JSON and HTTP 5xx are unknown without retry',async()=>{
 for(const fetchImpl of [async()=>{throw Error('The operation was aborted due to timeout');},async()=>{throw Error('fetch failed');},async()=>({ok:true,status:200,json:async()=>{throw Error('Unexpected end of JSON');}}),async()=>({ok:false,status:502,json:async()=>({error:'gateway error'})}),async()=>({ok:true,status:200,json:async()=>({})})]){
  let calls=0;const result=await generateBatch(draft,model,{base:'https://mock.invalid',key:'dummy',fetchImpl:async(...args)=>{calls++;return fetchImpl(...args);}});
  assert.equal(calls,1);assert.equal(result[0].submissionUnknown,true);assert.equal(result[0].ok,false);
 }
});
test('explicit HTTP 4xx and local packing errors are definite failures',async()=>{
 const result=await generateBatch(draft,model,{base:'https://mock.invalid',key:'dummy',fetchImpl:async()=>({ok:false,status:400,json:async()=>{throw Error('not JSON');}})});assert.equal(result[0].submissionUnknown,false);
 let calls=0;const local=await generateBatch({...draft,operation:'reference'},model,{fetchImpl:async()=>{calls++;}});assert.equal(calls,0);assert.equal(local[0].submissionUnknown,false);assert.equal(local[0].errorPhase,'pre_submission');
});
test('unknown store status and top-level flag survive restart and same-ID lookup does not resubmit',async()=>{
 const dir=directory();let calls=0;const options={directory:dir,getModel,generate:async()=>{calls++;return [{ok:false,error:'timeout',submissionUnknown:true}];}};
 let store=createGenerationTaskStore(options);const id=randomUUID();store.submit(id,draft,model);await flush();assert.equal(store.get(id).status,'unknown');assert.equal(store.get(id).submissionUnknown,true);assert.equal(store.get(id).upstreams[0].submissionUnknown,true);store.close();
 store=createGenerationTaskStore(options);store.submit(id,draft,model);await store.tick();assert.equal(calls,1);assert.equal(store.get(id).status,'unknown');store.close();
});
test('legacy timeout and null slots migrate to unknown while clear 4xx errors remain failed',()=>{
 const dir=directory(),ids=[randomUUID(),randomUUID(),randomUUID()];
 const results=[[{ok:false,error:'The operation was aborted due to timeout'}],[null],[{ok:false,error:'timeout text in rejection',httpStatus:400}]];
 ids.forEach((id,i)=>fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({id,modelId:model.id,results:results[i],status:'failed',createdAt:Date.now()})));
 const store=createGenerationTaskStore({directory:dir,getModel,generate:async()=>{throw Error('must not submit');}});assert.equal(store.get(ids[0]).status,'unknown');assert.equal(store.get(ids[1]).status,'unknown');assert.equal(store.get(ids[2]).status,'failed');store.close();
});
test('empty success is unknown; explicit upstream error remains failed',async()=>{
 for(const [upstream,status] of [[{},'unknown'],[{status:'completed',id:'remote'},'unknown'],[{error:'rejected'},'failed']]){
  const store=createGenerationTaskStore({directory:directory(),getModel,generate:async()=>[{ok:true,upstream}]});const id=randomUUID();store.submit(id,draft,model);await flush();assert.equal(store.get(id).status,status);store.close();
 }
});
