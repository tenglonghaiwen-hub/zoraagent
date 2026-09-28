import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMediaModelMention,unmatchedExplicitModelRequest} from '../packages/agent/media-model-choice.mjs';
import {selectTaskSkills} from '../packages/agent/skill-selection.mjs';
import {createMediaDelegator} from '../packages/agent/media-subagents.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {getRouteCapabilities} from '../packages/duoyuanx/route-capabilities.mjs';
import {LK_WAN3} from '../packages/duoyuanx/lk-wan3.mjs';

const models=[
 {id:'MiniMax-H3',name:'MiniMax H3',kind:'video',enabled:true},
 {id:'wan3.0',name:'万相 3.0（强哥AI）',kind:'video',enabled:true},
 {id:'doubao-seedance-2.5',name:'Seedance 2.5',kind:'video',enabled:true},
 {id:'veo_3_1',name:'Veo 3.1',kind:'video',enabled:true},
 {id:'grok-video-3-pro',name:'Grok Video 3 Pro',kind:'video',enabled:true},
 {id:'gpt-image-2',name:'GPT Image 2',kind:'image',enabled:true},
].map(model=>({...model,routes:[{operation:'generate',apiRoute:model.kind==='image'?'/v1/images/generations':'/v1/videos'},{operation:'reference',apiRoute:model.kind==='image'?'/v1/images/edits':'/v1/videos'}]}));
const h3Skill={id:'codex:minimax-h3-video-prompt',name:'MiniMax H3 视频提示词'};
const seedanceSkill={id:'codex:seedance-20',name:'Seedance 2.0'};
const genericSkill={id:'custom-storyboard',name:'通用分镜'};

test('model mention resolves the complete named model and later positive choice',()=>{
 assert.equal(resolveMediaModelMention('使用 Grok Video 3 Pro 生成视频',models).model.id,'grok-video-3-pro');
 assert.equal(resolveMediaModelMention('不要用 MiniMax H3，改用万相3.0生成视频',models).model.id,'wan3.0');
 assert.equal(resolveMediaModelMention('使用 GPT Image 2 生成图片',models).model.id,'gpt-image-2');
 assert.equal(unmatchedExplicitModelRequest('使用万相3.0生成视频',models),null);
 assert.equal(unmatchedExplicitModelRequest('使用万相3.0生成视频',[models[0]]),'万相3.0');
 assert.equal(unmatchedExplicitModelRequest('使用参考图1生成视频',models),null);
});

test('provider suffix does not hide an enabled model or silently choose between duplicate names',()=>{
 const wan=models[1];
 assert.equal(resolveMediaModelMention('使用万相3.0参考视频生成',[wan]).model?.id,'wan3.0');
 assert.equal(unmatchedExplicitModelRequest('使用万相3.0参考视频生成',[wan]),null);
 const duplicate={id:'wan3.0-other',name:'万相 3.0（另一服务商）',kind:'video',enabled:true};
 assert.equal(resolveMediaModelMention('使用万相3.0生成视频',[wan,duplicate]).ambiguous,true);
 assert.equal(resolveMediaModelMention('使用万相 3.0（强哥AI）生成视频',[wan,duplicate]).model?.id,'wan3.0');
});

test('selected and automatic model skills apply only to their compatible model',()=>{
 for(const text of ['使用万相3.0复刻视频','使用 Veo 3.1 生成视频','使用 Grok Video 3 Pro 生成视频','使用 Seedance 2.5 生成视频']){
  assert.deepEqual(selectTaskSkills(text,[h3Skill,seedanceSkill,genericSkill],models),[genericSkill]);
  assert(!selectTaskSkills(text,[],models).some(skill=>/minimax-h3|seedance-20/.test(skill.id)));
 }
 assert.deepEqual(selectTaskSkills('使用 GPT Image 2 生成图片',[h3Skill,genericSkill],models),[genericSkill]);
 assert.deepEqual(selectTaskSkills('使用 MiniMax H3 复刻视频',[h3Skill,seedanceSkill,genericSkill],models),[h3Skill,genericSkill]);
 const seedance20={id:'doubao-seedance-2-0-260128',name:'Seedance 2.0',kind:'video',enabled:true};
 assert.deepEqual(selectTaskSkills('使用 Seedance 2.0 生成视频',[h3Skill,seedanceSkill,genericSkill],[...models,seedance20]),[seedanceSkill,genericSkill]);
 const customModel={id:'future-video-9',name:'Future Video 9',kind:'video',enabled:true};
 const customSkill={id:'future-video-9-prompt',name:'Future Video 9 提示词'};
 assert.deepEqual(selectTaskSkills('使用 Veo 3.1 生成视频',[customSkill,genericSkill],[...models,customModel]),[genericSkill]);
 assert.deepEqual(selectTaskSkills('使用万相3.0生成视频',[h3Skill,genericSkill],[models[0]]),[genericSkill]);
 assert.deepEqual(selectTaskSkills('使用万相3.0生成视频',[],[models[0]]),[]);
});

test('host pins tool calls to current user model even when delegated text names another',async()=>{
 const calls=[];
 const delegate=createMediaDelegator({mediaModels:models,context:{history:[{role:'user',text:'使用万相3.0生成视频'}]},sharedRunner:async(name,args)=>{calls.push({name,args});return {ok:true};},run:async(prompt,options)=>{
  assert.match(options.roleInstructions,/modelId: wan3\.0/);
  assert.doesNotMatch(options.roleInstructions,/MiniMax-H3 按用户意图/);
  assert.equal((await options.toolRunner('list_media_models',{})).defaultModelId,'wan3.0');
  assert.equal((await options.toolRunner('preview_task',{prompt:'scene'})).ok,true);
  assert.match((await options.toolRunner('preview_task',{modelId:'MiniMax-H3',prompt:'scene'})).error,/不能改用/);
  assert.equal((await options.toolRunner('enhance_video_prompt',{prompt:'scene'})).ok,false);
  return {reply:'planned',tasks:[]};
 }});
 const result=await delegate('delegate_media_task',{kind:'video',task:'使用 MiniMax H3 生成视频'});
 assert.equal(result.ok,true);
 assert.deepEqual(calls.map(call=>call.args.modelId),['wan3.0']);
});

test('remembered task model outlives the shortened text history',async()=>{
 const calls=[];
 const delegate=createMediaDelegator({mediaModels:models,context:{preferredModelId:'veo_3_1',history:[{role:'user',text:'继续生成'}]},sharedRunner:async(name,args)=>{calls.push(args.modelId);return {ok:true};},run:async(prompt,options)=>{
  assert.equal((await options.toolRunner('list_media_models',{})).defaultModelId,'veo_3_1');
  await options.toolRunner('preview_task',{prompt:'scene'});
  return {reply:'planned',tasks:[]};
 }});
 await delegate('delegate_media_task',{kind:'video',task:'使用 MiniMax H3 生成视频'});
 assert.deepEqual(calls,['veo_3_1']);
});

test('media child derives the reference route from the selected Wan model, not a guessed route',async()=>{
 const route='/v1/media/generate';
 const wan={...LK_WAN3,id:'wan3.0',name:'万相 3.0',enabled:true};
 const calls=[];
 const delegate=createMediaDelegator({mediaModels:[models[0],wan],context:{history:[{role:'user',text:'使用万相3.0参考视频生成'}],references:[{name:'picture.png',type:'image/png',hasContent:true},{name:'clip.mp4',type:'video/mp4',hasContent:true}]},sharedRunner:async(name,args)=>{calls.push(args);return {ok:true};},run:async(prompt,options)=>{
  await options.toolRunner('preview_task',{modelId:'wan3.0',prompt:'test',ratio:'9:16',resolution:'720P',duration:13,operation:'generate',apiRoute:'/v1/videos'});
  return {reply:'planned',tasks:[]};
 }});
 const result=await delegate('delegate_media_task',{kind:'video',task:'参考生成'});
 assert.equal(result.ok,true);
 assert.equal(calls[0].modelId,'wan3.0');
 assert.equal(calls[0].operation,'reference');
 assert.equal(calls[0].apiRoute,route);
 assert.equal(validateDraft({...calls[0],count:1,concurrency:1,references:[{type:'image/png',contentUrl:'https://example.com/a.png'},{type:'video/mp4',contentUrl:'https://example.com/a.mp4'}]},id=>wan).ok,true);
 assert.equal(getRouteCapabilities({...wan,modes:['t2v','ref']}).find(item=>item.operation==='reference')?.apiRoute,route);
});

test('host rejects ambiguous, unavailable and wrong-kind explicit choices without falling back',async()=>{
 let calls=0;
 const run=async()=>{calls++};
 for(const [message,catalog,kind,reason] of [
  ['使用 Seedance 2.5 生成视频',[models[0],{...models[2],enabled:false}],'video',/未启用/],
  ['使用 GPT Image 2 生成图片',models,'video',/媒体类型/],
 ['使用 Same Model 生成视频',[models[0],{id:'a',name:'Same Model',kind:'video'},{id:'b',name:'Same Model',kind:'video'}],'video',/多个配置/],
  ['使用万相3.0生成视频',[models[0]],'video',/不在当前模型目录/],
 ]){
  const delegate=createMediaDelegator({mediaModels:catalog,context:{history:[{role:'user',text:message}]},sharedRunner:run,run});
  const result=await delegate('delegate_media_task',{kind,task:message});
  assert.equal(result.ok,false);
  assert.match(result.error,reason);
 }
 assert.equal(calls,0);
});
