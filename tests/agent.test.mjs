import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatService} from '../apps/server/chat-service.mjs';
import {getModels} from '../apps/server/catalog.mjs';
// Every runner is mocked; no provider calls or real credentials.
process.env.ZORA_AGENT_API_KEY='unit-test-dummy';
process.env.ZORA_AGENT_ENABLED='true';
const reply=()=>({reply:'本地模拟回复',tasks:[]});
test('conversation IDs isolate main and canvas multi-turn history',async()=>{
  const seen=[];const chat=createChatService({run:async p=>{seen.push(JSON.parse(p.split('\n').at(-1)));return reply();}});
  const main=await chat({message:'MAIN_ONLY'});
  const canvas=await chat({message:'CANVAS_ONLY',channel:'canvas'});
  assert.notEqual(main.conversationId,canvas.conversationId);
  await chat({message:'继续 MAIN_FOLLOWUP',conversationId:main.conversationId});
  assert.match(JSON.stringify(seen.at(-1).history),/MAIN_ONLY/);
  assert.doesNotMatch(JSON.stringify(seen.at(-1).history),/CANVAS_ONLY/);
  await chat({message:'继续 CANVAS_FOLLOWUP',conversationId:canvas.conversationId,channel:'canvas'});
  assert.match(JSON.stringify(seen.at(-1).history),/CANVAS_ONLY/);
  assert.doesNotMatch(JSON.stringify(seen.at(-1).history),/MAIN_ONLY/);
});
test('valid drafts survive and invented models never become executable tasks',async()=>{
  const m=getModels().find(m=>m.kind==='image');
  const draft={modelId:m.id,prompt:'分镜',count:1,concurrency:1,ratio:m.ratios[0],resolution:m.resolutions[0],duration:null};
  const chat=createChatService({run:async()=>({reply:'ok',tasks:[draft,{...draft,modelId:'invented'}]})});
  const result=await chat({message:'test'});
  assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].modelId,m.id);
});
test('server restart expires conversations with a 404 error',async()=>{
  const chat=createChatService({run:async()=>reply()});const first=await chat({message:'first'});
  const restarted=createChatService({run:async()=>reply()});
  await assert.rejects(restarted({message:'next',conversationId:first.conversationId}),e=>e.status===404&&/过期/.test(e.message));
});
test('busy requests return 409 and failure releases the shared lock',async()=>{
  let release,entered,calls=0;const ready=new Promise(r=>entered=r);
  const chat=createChatService({run:async()=>{if(calls++)return reply();entered();await new Promise(r=>release=r);throw Error('offline');}});
  const first=chat({message:'first'});const rejection=assert.rejects(first,/offline/);await ready;
  await assert.rejects(chat({message:'second'}),e=>e.status===409);
  release();await rejection;
  assert.equal((await chat({message:'retry'})).reply,'本地模拟回复');
});
test('model skill and image reach the mock runner',async()=>{
  let seen,options;const chat=createChatService({run:async(p,o)=>{seen=JSON.parse(p.split('\n').at(-1));options=o;return reply();}});
  const model=getModels().find(m=>m.kind==='agent').id;
  await chat({message:'test',modelId:model,skills:[{id:'fixture',name:'验收技能',prompt:'FIXTURE_SKILL'}],references:[{name:'fixture.png',type:'image/png',contentUrl:'data:image/png;base64,AA=='}]});
  assert.equal(options.modelId,model);assert.equal(seen.skills[0].prompt,'FIXTURE_SKILL');assert.equal(options.skills[0].prompt,'FIXTURE_SKILL');assert.equal(options.images.length,1);
  assert.equal(seen.history[0].references[0].contentUrl,undefined);
  assert.equal(seen.history[0].references[0].hasContent,true);
  assert.equal(options.images[0].url,'data:image/png;base64,AA==');
});

test('Wan 3.0 turn drops stale H3 skills and unrelated prior task payload',async()=>{
 const seen=[];
 const chat=createChatService({run:async(prompt,options)=>{seen.push({prompt,options});return reply();},analyzeVideos:async()=>({summary:'',images:[],audioFiles:[]})});
 const first=await chat({message:'OLD_UNRELATED_SELFIE_TASK '+ 'x'.repeat(4000)});
 const second=await chat({conversationId:first.conversationId,message:'@图片1 @视频1 使用万相3.0复刻视频',skills:[
  {id:'codex:minimax-h3-video-prompt',name:'MiniMax H3 视频提示词',prompt:'STALE_H3_PROMPT'},
  {id:'codex:minimax-h3-action-transfer',name:'MiniMax H3 动作迁移',prompt:'STALE_TRANSFER_PROMPT'},
 ],references:[
  {name:'portrait.png',reference:'图片1',type:'image/png',contentUrl:'data:image/png;base64,AA=='},
  {name:'clip.mp4',reference:'视频1',type:'video/mp4',contentUrl:'data:video/mp4;base64,AA=='},
 ]});
 const current=seen.at(-1);
 assert.equal(current.options.freshThread,true);
 const envelope=JSON.parse(current.prompt.split('\n').find(line=>line.startsWith('{"skills":')));
 assert.deepEqual(envelope.skills,[]);
 assert.deepEqual(current.options.skills,[]);
 assert.equal(envelope.history.length,1);
 assert.equal(envelope.history[0].text,'@图片1 @视频1 使用万相3.0复刻视频');
 assert(current.prompt.length<2000,'standalone media prompt should not replay large prior context');
 assert.match(current.prompt,/"kind":"initial"/);
 assert.doesNotMatch(current.prompt,/"kind":"replaced"/);
 assert.doesNotMatch(current.prompt,/OLD_UNRELATED_SELFIE_TASK|STALE_H3_PROMPT|STALE_TRANSFER_PROMPT/);
 await chat({conversationId:second.conversationId,message:'继续规划万相视频'});
 const continued=seen.at(-1);
 assert.equal(continued.options.freshThread,false);
 assert.match(continued.prompt,/使用万相3.0复刻视频/);
 assert.doesNotMatch(continued.prompt,/OLD_UNRELATED_SELFIE_TASK|STALE_H3_PROMPT|STALE_TRANSFER_PROMPT/);
});

test('each newly named media model starts with only its own task context',async()=>{
 const seen=[];
 const chat=createChatService({run:async(prompt,options)=>{seen.push({prompt,options});return reply();},analyzeVideos:async()=>({summary:'',images:[],audioFiles:[]})});
 let result=await chat({message:'OLD_UNRELATED_SCENE 生成视频'});
 for(const message of ['@图片1 用 Veo 3.1 生成视频','@图片1 用 Grok Video 3 Pro 生成视频','@图片1 用 GPT Image 2 让她生成图片']){
  result=await chat({conversationId:result.conversationId,message,references:[{name:'portrait.png',reference:'图片1',type:'image/png',contentUrl:'data:image/png;base64,AA=='}],skills:[{id:'codex:minimax-h3-video-prompt',name:'MiniMax H3 视频提示词',prompt:'STALE_H3_PROMPT'}]});
  const current=seen.at(-1);
  const envelope=JSON.parse(current.prompt.split('\n').find(line=>line.startsWith('{"skills":')));
  assert.equal(current.options.freshThread,true);
  assert.deepEqual(envelope.skills,[]);
  assert.deepEqual(envelope.history.map(item=>item.text),[message]);
  assert.doesNotMatch(current.prompt,/OLD_UNRELATED_SCENE|STALE_H3_PROMPT/);
 }
});

test('cloud chat reconstruction keeps only the latest named media task on follow-up',async()=>{
 const {cloudAgentContext}=await import('../apps/server/cloud-agent-context.mjs');
 let envelope;
 const chat=createChatService({callApi:async({path})=>path==='/api/models'?{ok:true,data:{models:getModels()}}:{ok:true,data:{}},run:async(prompt)=>{envelope=JSON.parse(prompt.split('\n').find(line=>line.startsWith('{"skills":')));return reply();}});
 await cloudAgentContext.run({token:'mock-token',base:'https://example.com/api/agent',owner:'fixture'},()=>chat({message:'继续调整画幅',history:[
  {role:'user',message:'OLD_UNRELATED_SCENE 生成视频'},
  {role:'assistant',reply:'old result'},
  {role:'user',message:'使用 Veo 3.1 生成新视频'},
  {role:'assistant',reply:'new result'},
 ]}));
 assert.deepEqual(envelope.history.map(item=>item.text||item.reply),['使用 Veo 3.1 生成新视频','new result','继续调整画幅']);
});

test('task model ID survives multiple brief follow-ups without replaying the original instruction',async()=>{
 const seen=[];
 const chat=createChatService({run:async(prompt)=>{seen.push(JSON.parse(prompt.split('\n').find(line=>line.startsWith('{"skills":'))));return reply();}});
 let result=await chat({message:'使用 Veo 3.1 生成视频'});
 for(const message of ['继续调整分镜','继续调整时长','继续生成'])result=await chat({conversationId:result.conversationId,message});
 const latest=seen.at(-1);
 assert.equal(latest.taskModelId,'veo_3_1');
 assert.equal(latest.history.at(-1).text,'继续生成');
 assert(!latest.history.some(item=>item.text==='使用 Veo 3.1 生成视频'));
});

test('media generation does not open a browser unless the user requests web research',async()=>{
 const seen=[];
 const chat=createChatService({run:async(prompt,options)=>{seen.push(await options.toolRunner('discover_agent_tools',{group:'browser'}));return reply();}});
 await chat({message:'使用 Veo 3.1 生成视频'});
 await chat({message:'搜索官方文档，核对 Veo 3.1 参数'});
 assert.equal(seen[0].ok,false);
 assert.equal(seen[1].ok,true);
});

test('generation failure question retains the current task thread and brief history',async()=>{
 const seen=[];
 const chat=createChatService({run:async(prompt,options)=>{seen.push({prompt,options});return reply();}});
 const first=await chat({message:'生成一段测试视频'});
 await chat({message:'为什么生成失败？',conversationId:first.conversationId});
 assert.equal(seen.at(-1).options.freshThread,false);
 const envelope=JSON.parse(seen.at(-1).prompt.split('\n').at(-1));
 assert(envelope.history.some(item=>item.text==='生成一段测试视频'));
});

test('Agent passes the explicit user model request while child defaults follow the enabled catalog',async()=>{
 let mainPrompt,childPrompt,childTask;
 const instruction='用 Seedance 2.5 生成 10 秒视频';
 const chat=createChatService({run:async(p,o)=>{
  if(o.roleInstructions){childPrompt=o.roleInstructions;childTask=JSON.parse(p.split('\n').at(-1)).task;return reply();}
  mainPrompt=p;await o.toolRunner('delegate_media_task',{kind:'video',task:instruction});return reply();
 }});
 await chat({message:instruction});
 assert.equal(JSON.parse(mainPrompt.split('\n').at(-1)).history.at(-1).text,instruction);
 assert.equal(childTask,instruction);
 assert.match(childPrompt,/modelId: doubao-seedance-2\.5/);
 assert.doesNotMatch(childPrompt,/MiniMax-H3 按用户意图/);
});
test('disabled service fails without invoking the runner',async()=>{
  process.env.ZORA_AGENT_ENABLED='false';
  try {await assert.rejects(createChatService({run:async()=>assert.fail('must not run')})({message:'test'}),e=>e.status===503);}
  finally {process.env.ZORA_AGENT_ENABLED='true';}
});

