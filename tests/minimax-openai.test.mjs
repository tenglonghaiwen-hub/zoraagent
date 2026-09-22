import test from 'node:test';
import assert from 'node:assert/strict';
import {publishModelCapability,resolveModelCapability} from '../packages/contracts/model-capability.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {proxyGeneration,proxyQueryTask} from '../apps/cloudflare-worker/src/proxy.mjs';
const config={id:'MiniMax-H3',kind:'video',provider:'duoyuanx',capability:{version:1,template:'minimax-openai'}};
const model=publishModelCapability(config);
const draft={modelId:model.id,prompt:'雨中漫步',videoMode:'t2v',ratio:'9:16',resolution:'768P',duration:5,count:1,concurrency:1,references:[]};
const image=i=>({name:'图'+i,type:'image/png',contentUrl:'https://example.com/'+i+'.png'});
test('MiniMax OpenAI capability chooses v1 defaults and rejects mismatched protocol/configuration',()=>{
 assert.equal(model.available,true);assert.equal(model.family,'minimax-openai');assert.equal(model.route,'/v1/videos');assert.equal(model.queryRoute,'/v1/videos/{task_id}');
 assert.deepEqual(model.resolutions,['768P','2K']);assert.equal(model.maxCount,1);
 for(const change of [{route:'/v2/video_generation'},{queryRoute:'/v2/query/video_generation/{task_id}'},{provider:'minimax'},{id:'another-model'}])assert.throws(()=>resolveModelCapability({...config,...change}),/OpenAI/);
 assert.throws(()=>resolveModelCapability({...config,capability:{...config.capability,resolutions:['720P']}}),/参数/);
 const official=publishModelCapability({...config,capability:{version:1,template:'minimax'}});assert.equal(official.family,'minimax');assert.equal(official.route,'/v2/video_generation');
});
test('validation and packing preserve ratio in metadata, size, duration and bearer format',()=>{
 const checked=validateDraft(draft,()=>model);assert.equal(checked.ok,true);assert.equal(checked.draft.apiRoute,'/v1/videos');
 const packed=packGenerateRequest(checked.draft,model);
 assert.equal(packed.path,'/v1/videos');assert.equal(packed.authorizationScheme,'bearer');
 assert.deepEqual(packed.body,{model:'MiniMax-H3',prompt:'雨中漫步',duration:5,size:'768P',metadata:{ratio:'9:16',aigc_watermark:false}});
 assert(!('content' in packed.body));assert(!('resolution' in packed.body));
});
test('frame and multimodal roles cannot silently switch based on image count',()=>{
 for(const count of [1,2]){
  const references=Array.from({length:count},(_,i)=>image(i));
  const ref={...draft,videoMode:'ref',references};
  assert.equal(validateDraft(ref,()=>model).ok,false);assert.throws(()=>packGenerateRequest(ref,model),/1–2张/);
  const frame={...draft,videoMode:count===1?'i2v':'fl',ratio:'adaptive',references};
  assert.equal(packGenerateRequest(frame,model).body.images.length,count);
  assert.throws(()=>packGenerateRequest({...frame,ratio:'9:16'},model),/adaptive/);
 }
 const references=[image(1),image(2),image(3),{type:'video/mp4',contentUrl:'https://example.com/video.mp4'},{type:'audio/mpeg',contentUrl:'https://example.com/audio.mp3'}];
 const packed=packGenerateRequest({...draft,videoMode:'ref',references},model);
 assert.equal(packed.body.images.length,3);assert.equal(packed.body.metadata.reference_videos.length,1);assert.equal(packed.body.metadata.reference_audios.length,1);
 assert.throws(()=>packGenerateRequest({...draft,ratio:'adaptive'},model),/adaptive/);
});
test('actual gateway proxy sends v1 body and parses queued/completed/failed query responses',async()=>{
 const prior=globalThis.fetch;const env={DUOYUANX_API_KEY:'test-key',DUOYUANX_BASE_URL:'https://relay.example.com/v1'};
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://relay.example.com/v1/videos');assert.equal(options.headers.Authorization,'Bearer test-key');assert.equal(JSON.parse(options.body).metadata.ratio,'9:16');return Response.json({id:'task-openai',status:'queued'});};
  const generated=await proxyGeneration({body:draft,modelInfo:model,provider:'duoyuanx',route:model.route,env});assert.equal(generated.id,'task-openai');
  for(const status of ['queued','in_progress','completed','failed']){
   globalThis.fetch=async(url,options)=>{assert.equal(url,'https://relay.example.com/v1/videos/task-openai');assert.equal(options.method,'GET');return Response.json({id:'task-openai',status,progress:status==='completed'?100:10,...(status==='completed'?{video_url:'https://example.com/result.mp4'}:{}),...(status==='failed'?{error:{code:'rejected',message:'上游审核拒绝'}}:{})});};
   const result=await proxyQueryTask({taskId:'task-openai',provider:'duoyuanx',queryRoute:model.queryRoute,env});assert.equal(result.status,status);if(status==='completed')assert.equal(result.url,'https://example.com/result.mp4');if(status==='failed')assert.equal(result.error,'上游审核拒绝');
  }
  globalThis.fetch=async()=>Response.json({status:'queued'});
  await assert.rejects(proxyGeneration({body:draft,modelInfo:model,provider:'duoyuanx',route:model.route,env}),/结果未知/);
 }finally{globalThis.fetch=prior;}
});
