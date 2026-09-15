import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRunner} from '../packages/agent/tools.mjs';
import {startAcceptanceFixture} from './helpers/acceptance-fixture.mjs';

const draft={modelId:'gpt-image-2',prompt:'给参考人物戴墨镜',count:1,concurrency:1,ratio:'1:1',resolution:'1K'};

test('acceptance capability announces the contract without enabling generation',async()=>{
  const fixture=await startAcceptanceFixture();
  try {
    const base='http://127.0.0.1:'+fixture.port;
    assert.deepEqual(await (await fetch(base+'/api/generation-capabilities')).json(),{durableTasks:true,agentTasksVersion:1});
    const response=await fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
    assert.equal(response.status,501);
    assert.equal((await response.json()).ok,false);
  } finally {await fixture.close();}
});

test('querying a saved task, including a missing record, never submits generation',async()=>{
  for(const status of [200,404,503]){
    const calls=[],receipts=[];
    const runner=createToolRunner({generationTasks:receipts,callApi:async request=>{
      calls.push(request);
      return {ok:status===200,status,data:status===200?{task:{id:'saved-task-123456',status:'running'}}:{error:'query failed'}};
    }});
    const result=await runner('call_api',{method:'GET',path:'/api/generation-tasks/saved-task-123456'});
    assert.equal(result.status,status);
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,'GET');
    assert.equal(calls[0].path,'/api/generation-tasks/saved-task-123456');
    assert.deepEqual(receipts,[],'a query must not create a new generation receipt');
  }
});

test('lost submission response recovers the same receipt using GET and strips input bytes',async()=>{
  const calls=[],receipts=[];
  const reference={name:'original.png',type:'image/png',contentUrl:'data:image/png;base64,AA=='};
  const runner=createToolRunner({references:[reference],generationTasks:receipts,callApi:async request=>{
    calls.push(request);
    if(request.method==='POST')return {ok:false,status:504,error:'response lost after submission'};
    return {ok:true,status:200,data:{task:{id:request.path.split('/').at(-1),modelId:draft.modelId,status:'completed',revision:2,upstreams:[{ok:true,upstream:{data:[{url:'https://fixture.invalid/result.png'}]}}],pollError:'',createdAt:1}}};
  }});
  const first=await runner('submit_generation',draft);
  const repeated=await runner('submit_generation',draft);
  assert.deepEqual(repeated,first);
  assert.deepEqual(calls.map(call=>call.method),['POST','GET']);
  assert.match(calls[0].body.requestId,/^[A-Za-z0-9_-]{16,100}$/);
  assert.equal(calls[1].path,'/api/generation-tasks/'+calls[0].body.requestId);
  assert.deepEqual(calls[0].body.references,[reference]);
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].task.id,calls[0].body.requestId);
  assert.equal(receipts[0].task.status,'completed');
  assert.equal(receipts[0].draft.prompt,draft.prompt);
  assert.equal(receipts[0].draft.references,undefined);
  assert(!JSON.stringify(receipts).includes('base64'));
});

test('unconfirmed submission preserves its ID without retrying a paid POST or claiming completion',async()=>{
  const calls=[],receipts=[];
  const runner=createToolRunner({generationTasks:receipts,callApi:async request=>{
    calls.push(request);
    return {ok:false,status:request.method==='POST'?504:404,error:'receipt unavailable'};
  }});
  await runner('submit_generation',draft);
  await runner('submit_generation',draft);
  assert.deepEqual(calls.map(call=>call.method),['POST','GET']);
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].task.id,calls[0].body.requestId);
  assert.notEqual(receipts[0].task.status,'completed');
  assert.equal(receipts[0].submissionUnknown||receipts[0].task.submissionUnknown,true);
  assert.deepEqual(receipts[0].task.upstreams,[]);
});
