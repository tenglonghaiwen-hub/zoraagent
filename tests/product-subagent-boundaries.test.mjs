import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaDelegator,MAIN_AGENT_TOOL_DEFS} from '../packages/agent/media-subagents.mjs';
import {createChatService} from '../apps/server/chat-service.mjs';
const mediaModels=[{id:'gpt-image-2',kind:'image'},{id:'MiniMax-H3',kind:'video'}];
test('child kind, recursion and main bypass boundaries reject before executing tools',async()=>{
 let executed=0;
 const delegate=createMediaDelegator({mediaModels,sharedRunner:async()=>{executed++;},run:async(p,o)=>{
  assert.equal(o.maxRounds,4);
  for(const [name,args] of [['delegate_media_task',{kind:'video',task:'x'}],['call_api',{}],['submit_generation',{modelId:'MiniMax-H3'}]])assert.equal((await o.toolRunner(name,args)).ok,false);
  return {reply:'rejected',tasks:[]};
 }});
 assert(!MAIN_AGENT_TOOL_DEFS.some(t=>t.name==='submit_generation'));
 assert.equal((await delegate('submit_generation',{})).ok,false);
 await delegate('delegate_media_task',{kind:'image',task:'image'});
 assert.equal(executed,0);
});
test('delegation serializes child calls and enforces a host-side four-call budget',async()=>{
 let active=0,maxActive=0,calls=0;
 const delegate=createMediaDelegator({mediaModels,sharedRunner:async()=>{},run:async()=>{calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;return {reply:'ok',tasks:[]};}});
 const results=await Promise.all(Array.from({length:5},()=>delegate('delegate_media_task',{kind:'video',task:'plan only'})));
 assert.equal(calls,4);assert.equal(maxActive,1);assert.equal(results[4].ok,false);
});
test('video child defaults to H3 and preserves a single receipt through child failures and repeated delegation',async()=>{
 process.env.ZORA_AGENT_API_KEY='mock-only';process.env.ZORA_AGENT_ENABLED='true';
 let posts=0;
 const chat=createChatService({callApi:async request=>{posts++;assert.equal(request.body.modelId,'MiniMax-H3');return {ok:true,status:202,data:{task:{id:request.body.requestId,modelId:'MiniMax-H3',status:'running',revision:1,upstreams:[]}}};},run:async(prompt,options)=>{
  if(options.roleInstructions){await options.toolRunner('submit_generation',{prompt:'测试视频',count:1,concurrency:1,ratio:'16:9',resolution:'768P',duration:5});throw Error('child summary failed');}
  for(let i=0;i<2;i++){const result=await options.toolRunner('delegate_media_task',{kind:'video',task:'生成视频'});assert.equal(result.ok,false);}
  return {reply:'任务状态待查询',tasks:[]};
 }});
 const result=await chat({message:'生成视频',references:[1,2,3].map(i=>({type:'image/png',name:'reference'+i,contentUrl:'data:image/png;base64,AA=='}))});assert.equal(posts,1);assert.equal(result.generationTasks.length,1);assert.equal(result.generationTasks[0].task.status,'running');
});
