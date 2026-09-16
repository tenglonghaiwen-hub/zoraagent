import test from 'node:test';
import assert from 'node:assert/strict';
import {getModels} from '../packages/duoyuanx/catalog.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {createToolRunner} from '../packages/agent/tools.mjs';
const ref={name:'original',type:'image/png',contentUrl:'data:image/png;base64,AA=='};
const base=m=>({modelId:m.id,prompt:'test',count:1,concurrency:1,ratio:m.ratios[0],resolution:m.resolutions[0],duration:m.fixedSeconds??m.durations?.[0]??m.durationRange?.min});
test('explicit supported generation routes reach actual packer for every media model',()=>{
 for(const m of getModels().filter(m=>['image','video'].includes(m.kind))){
  const checked=validateDraft({...base(m),operation:m.family==='minimax'?'reference':'generate',...(m.family==='minimax'?{videoMode:'ref',references:[ref,ref,ref]}:{}),apiRoute:m.family==='minimax'?'/v2/video_generation':m.route});assert(checked.ok,m.id+': '+checked.error);
  assert.equal(checked.draft.apiRoute,m.family==='minimax'?'/v2/video_generation':m.route);assert.equal(packGenerateRequest(checked.draft).path,checked.draft.apiRoute);
  const legacy=validateDraft({...base(m),...(m.family==='minimax'?{videoMode:'ref',references:[ref,ref,ref]}:{})});assert(legacy.ok);assert.equal(legacy.draft.operation,m.family==='minimax'?'reference':undefined);assert.equal(legacy.draft.apiRoute,m.family==='minimax'?'/v2/video_generation':undefined);
 }
});
test('reference routing rejects missing images, wrong endpoints and conflicting operations',()=>{
 const m=getModels().find(m=>m.family==='qwen-image'),draft={...base(m),references:[ref,ref,ref],operation:'reference',apiRoute:'/v1/images/edits'};
 const valid=validateDraft(draft);assert(valid.ok);assert.equal(packGenerateRequest(valid.draft).path,'/v1/images/edits');
 for(const change of [{references:[]},{operation:'generate'},{apiRoute:'/v1/videos'},{apiRoute:'https://evil.test/api'},{operation:'invented'},{videoMode:'t2i'}])assert.equal(validateDraft({...draft,...change}).ok,false,JSON.stringify(change));
 assert.throws(()=>packGenerateRequest({...valid.draft,apiRoute:'/v1/videos'}));
});
test('Agent explicit selection survives tools and durable receipt without raw route bypass',async()=>{
 const m=getModels().find(m=>m.family==='qwen-image'),generationTasks=[],calls=[];
 const run=createToolRunner({references:[ref,ref,ref],generationTasks,callApi:async c=>{calls.push(c);return {ok:true,status:202,data:{task:{id:c.body.requestId,status:'running'}}};}});
 await run('submit_generation',{...base(m),operation:'reference',apiRoute:'/v1/images/edits'});
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/generate');assert(calls[0].body.requestId);
 assert.equal(calls[0].body.operation,'reference');assert.equal(generationTasks[0].draft.apiRoute,'/v1/images/edits');
});
