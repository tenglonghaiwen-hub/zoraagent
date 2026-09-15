import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRunner} from '../packages/agent/tools.mjs';
import {isAllowedAgentApi} from '../packages/agent/api.mjs';
import {createChatService} from '../apps/server/chat-service.mjs';
process.env.ZORA_AGENT_API_KEY='unit-test-dummy';
process.env.ZORA_AGENT_ENABLED='true';
const args={modelId:'gpt-image-2',prompt:'add glasses',count:1,concurrency:1,ratio:'1:1',resolution:'1K'};
const ref={name:'original.png',type:'image/png',contentUrl:'data:image/png;base64,aGVsbG8='};
test('Agent submissions share durable identity across tools, retain original and omit reference bytes from receipt draft',async()=>{
 const calls=[],generationTasks=[];
 const runner=createToolRunner({references:[ref],generationTasks,callApi:async c=>{calls.push(c);return {ok:true,status:202,data:{task:{id:c.body.requestId,status:'running',upstreams:[]}}};}});
 const first=await runner('submit_generation',args);
 const second=await runner('call_api',{method:'POST',path:'/api/generate',body:args});
 assert.equal(calls.length,1);assert.deepEqual(first,second);assert.equal(calls[0].body.references[0].contentUrl,ref.contentUrl);
 assert.equal(generationTasks.length,1);assert.equal(generationTasks[0].draft.references,undefined);
 await runner('submit_generation',{...args,prompt:'different explicit request'});assert.equal(calls.length,2);assert.notEqual(calls[0].body.requestId,calls[1].body.requestId);
});
test('Agent raw generation routes are blocked; task query allowed',async()=>{
 let calls=0;const runner=createToolRunner({callApi:async()=>{calls++;}});
 assert.equal((await runner('call_api',{method:'POST',path:'/api/duoyuanx/v1/images/generations'})).ok,false);
 assert.equal(calls,0);assert.equal(isAllowedAgentApi('POST','/api/duoyuanx/v1/video/generations'),false);
 assert.equal(isAllowedAgentApi('GET','/api/generation-tasks/1234567890123456'),true);
});
test('unknown POST never resubmits; its ID is retained with explicit uncertainty',async()=>{
 const calls=[],generationTasks=[];const runner=createToolRunner({generationTasks,callApi:async c=>{calls.push(c);return {ok:false,status:c.method==='GET'?404:502};}});
 await runner('submit_generation',args);await runner('submit_generation',args);
 assert.equal(calls.length,2);assert.equal(calls[1].path,'/api/generation-tasks/'+calls[0].body.requestId);
 assert.equal(generationTasks[0].submissionUnknown,true);assert.equal(generationTasks[0].task.status,'unknown');
});
test('missing references block POST and thrown transports preserve unknown identity',async()=>{
 let calls=0;
 const missing=createToolRunner({references:[{name:'missing'}],callApi:async()=>{calls++;}});
 assert.equal((await missing('submit_generation',args)).status,400);assert.equal(calls,0);
 const generationTasks=[];const runner=createToolRunner({generationTasks,callApi:async()=>{calls++;throw Error('socket reset');}});
 await runner('submit_generation',args);await runner('submit_generation',args);
 assert.equal(calls,2);assert.equal(generationTasks.length,1);assert.equal(generationTasks[0].submissionUnknown,true);
});
test('chat returns actual receipt even when model fails after submission and excludes binary from history',async()=>{
 let seen='';const chat=createChatService({callApi:async c=>({ok:true,status:202,data:{task:{id:c.body.requestId,status:'running',upstreams:[]}}}),run:async(p,o)=>{if(o.roleInstructions){await o.toolRunner('submit_generation',args);return {reply:'submitted',tasks:[]};}seen=p;await o.toolRunner('delegate_media_task',{kind:'image',task:'edit original'});throw Error('mock model failure');}});
 const result=await chat({message:'edit original',references:[ref]});
 assert.equal(result.generationTasks.length,1);assert.match(result.agentError,/mock/);assert.ok(result.conversationId);assert.equal(seen.includes(ref.contentUrl),false);
 await assert.rejects(chat({message:'edit',references:[{name:'missing.png'}]}),/参考素材未读取成功/);
});
