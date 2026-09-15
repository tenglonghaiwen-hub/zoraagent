import test from 'node:test';
import assert from 'node:assert/strict';
import {applyGenerationReceipt,verifyGenerationRetry} from '../apps/client/agent-generation-tasks.js';
const response=status=>async()=>({ok:true,json:async()=>({task:{id:'original',status,revision:2,upstreams:status==='completed'?[{url:'https://example.test/image.png'}]:[]}})});
test('unknown receipt retains remote id and displays confirmation state',()=>{
 const m={genTaskIds:['remote'],genTaskId:'remote'};
 applyGenerationReceipt(m,{id:'original',status:'unknown',submissionUnknown:true,upstreams:[]});
 assert.equal(m.genStatus,'结果待确认');assert.equal(m.genTaskId,'remote');assert.equal(m.genUnknown,true);
});
test('historical failed card restores completed task before any paid confirmation',async()=>{
 const m={genBatchId:'original',genStatus:'生成失败'};let confirms=0;
 const options={fetchImpl:response('completed'),confirmImpl:()=>{confirms++;return true;}};
 assert.equal(await verifyGenerationRetry(m,options),false);assert.equal(confirms,0);assert.equal(m.genStatus,'已完成');assert.ok(m.genUrl);
 assert.equal(await verifyGenerationRetry(m,options),true);assert.equal(confirms,1);
});
test('running unknown and offline prohibit retry without discarding receipt',async()=>{
 for(const fetchImpl of [response('running'),response('unknown'),async()=>{throw Error('offline');}]){
  const m={genBatchId:'original',genStatus:'生成失败'};
  assert.equal(await verifyGenerationRetry(m,{fetchImpl,confirmImpl:()=>{throw Error('must not ask');}}),false);assert.equal(m.genBatchId,'original');
 }
});
test('confirmed failed task still requires explicit confirmation',async()=>{
 const m={genBatchId:'original'};let confirms=0;
 assert.equal(await verifyGenerationRetry(m,{fetchImpl:response('failed'),confirmImpl:()=>{confirms++;return false;}}),false);assert.equal(confirms,1);
});
