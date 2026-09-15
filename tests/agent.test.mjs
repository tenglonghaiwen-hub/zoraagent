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
  await chat({message:'MAIN_FOLLOWUP',conversationId:main.conversationId});
  assert.match(JSON.stringify(seen.at(-1).history),/MAIN_ONLY/);
  assert.doesNotMatch(JSON.stringify(seen.at(-1).history),/CANVAS_ONLY/);
  await chat({message:'CANVAS_FOLLOWUP',conversationId:canvas.conversationId,channel:'canvas'});
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
  assert.equal(options.modelId,model);assert.equal(seen.skills[0].prompt,'FIXTURE_SKILL');assert.equal(options.images.length,1);
  assert.equal(seen.history[0].references[0].contentUrl,undefined);
  assert.equal(seen.history[0].references[0].hasContent,true);
  assert.equal(options.images[0].url,'data:image/png;base64,AA==');
});

test('Agent receives default media model policy without rewriting explicit user choices',async()=>{
 let prompt;
 const chat=createChatService({run:async p=>{prompt=p;return reply();}});
 await chat({message:'用 Seedance 2.5 生成 10 秒视频'});
 assert.match(prompt,/默认使用 GPT Image 2（modelId: gpt-image-2）/);
 assert.match(prompt,/默认使用 MiniMax H3（modelId: MiniMax-H3）/);
 assert.match(prompt,/用户主动指定模型或参数时，严格遵守/);
 assert.equal(JSON.parse(prompt.split('\n').at(-1)).history.at(-1).text,'用 Seedance 2.5 生成 10 秒视频');
});
test('disabled service fails without invoking the runner',async()=>{
  process.env.ZORA_AGENT_ENABLED='false';
  try {await assert.rejects(createChatService({run:async()=>assert.fail('must not run')})({message:'test'}),e=>e.status===503);}
  finally {process.env.ZORA_AGENT_ENABLED='true';}
});

