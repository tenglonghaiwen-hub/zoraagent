import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatService} from '../apps/server/chat-service.mjs';
import {createMediaDelegator,MAIN_AGENT_TOOL_DEFS} from '../packages/agent/media-subagents.mjs';
import {getModels} from '../packages/duoyuanx/catalog.mjs';
process.env.ZORA_AGENT_API_KEY='unit-test-dummy';process.env.ZORA_AGENT_ENABLED='true';
const imageArgs={modelId:'gpt-image-2',prompt:'glasses',count:1,concurrency:1,ratio:'1:1',resolution:'1K'};
test('main delegates to independent image model invocation and retains durable receipt with original',async()=>{
 const calls=[],runs=[];const ref={name:'original',type:'image/png',contentUrl:'data:image/png;base64,aGVsbG8='};
 const run=async(p,o)=>{runs.push(o);if(o.roleInstructions){assert.match(o.roleInstructions,/图片专业/);assert.equal(o.maxRounds,4);assert.deepEqual(o.tools.map(t=>t.name),['list_media_models','preview_task','submit_generation']);await o.toolRunner('submit_generation',imageArgs);return {reply:'任务已提交',tasks:[]};}assert.equal(o.tools.some(t=>t.name==='submit_generation'),false);await o.toolRunner('delegate_media_task',{kind:'image',task:'添加墨镜'});return {reply:'已委派',tasks:[]};};
 const chat=createChatService({run,callApi:async c=>{calls.push(c);return {ok:true,status:202,data:{task:{id:c.body.requestId,status:'running',upstreams:[]}}};}});
 const result=await chat({message:'添加墨镜',modelId:'custom-text-model',references:[ref]});
 assert.equal(runs.length,2);assert.equal(runs[1].modelId,'custom-text-model');assert.equal(runs[1].images[0].url,ref.contentUrl);assert.equal(calls[0].body.references[0].contentUrl,ref.contentUrl);assert.equal(result.generationTasks.length,1);
});
test('kind boundary, recursion prevention, main bypass rejection and delegate limit are enforced',async()=>{
 let executions=0,submissions=0;
 const runner=createMediaDelegator({run:async(p,o)=>{executions++;assert.equal((await o.toolRunner('delegate_media_task',{})).ok,false);assert.equal((await o.toolRunner('submit_generation',{modelId:'MiniMax-H3'})).ok,false);return {reply:'ok',tasks:[]};},sharedRunner:async()=>{submissions++;},mediaModels:getModels(),context:{},generationTasks:[]});
 assert.equal((await runner('submit_generation',imageArgs)).ok,false);
 for(let i=0;i<4;i++)await runner('delegate_media_task',{kind:'image',task:'plan only'});
 assert.equal((await runner('delegate_media_task',{kind:'image',task:'fifth'})).ok,false);assert.equal(executions,4);assert.equal(submissions,0);
 assert.ok(MAIN_AGENT_TOOL_DEFS.some(t=>t.name==='delegate_media_task'));
});
test('plain conversation does not launch child models',async()=>{
 let calls=0;const chat=createChatService({run:async()=>{calls++;return {reply:'你好',tasks:[]};}});await chat({message:'你好'});assert.equal(calls,1);
});

test('empty child reply cannot claim successful delegation',async()=>{
 const runner=createMediaDelegator({run:async()=>({reply:'无法生成',tasks:[]}),sharedRunner:async()=>{throw Error('must not submit');},mediaModels:getModels(),context:{},generationTasks:[]});
 const result=await runner('delegate_media_task',{kind:'video',task:'实际生成'});assert.equal(result.ok,false);assert.equal(result.status,'not_submitted');assert.deepEqual(result.toolTrace,[]);assert.match(result.error,/未调用/);
});
