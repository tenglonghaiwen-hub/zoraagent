import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {generateBatch} from '../packages/duoyuanx/generation-service.mjs';
import {normalizeMediaResults} from '../apps/client/media-results.js';
const draft={modelId:'doubao-seedance-2.5',prompt:'介绍这款口红',count:1,concurrency:1,ratio:'16:9',resolution:'720P',duration:4,videoMode:'ref',references:[{type:'image/png',contentUrl:'asset://asset-example-image'},{type:'video/mp4',contentUrl:'asset://asset-example-video'},{type:'audio/mpeg',contentUrl:'asset://asset-example-audio'}]};
test('supplied document limits apply to Seedance variants including 2.5 and Mini',()=>{
 for(const modelId of ['doubao-seedance-2.5','doubao-seedance-2-0-mini','doubao-seedance-2-0-260128','doubao-seedance-2-0-fast-260128']){
  for(const duration of [4,15,-1])assert(validateDraft({...draft,modelId,duration}).ok);
  for(const change of [{duration:30},{duration:16},{resolution:'4K'},{ratio:'21:9'}])assert.equal(validateDraft({...draft,modelId,...change}).ok,false);
 }
});
test('asset references preserve media types/roles and audio requires generate_audio true',async()=>{
 const valid=validateDraft(draft);assert(valid.ok);const packed=packGenerateRequest(valid.draft,valid.model);
 assert.equal(packed.body.model,'doubao-seedance-2.5');assert.deepEqual(packed.body.content.slice(1).map(c=>c.role),['reference_image','reference_video','reference_audio']);assert.equal(packed.body.metadata.generate_audio,true);assert.equal(packed.body.metadata.resolution,'720p');assert(!Object.keys(packed.body).some(k=>k.includes('.')));
 let calls=0;await generateBatch(valid.draft,valid.model,{base:'https://mock.invalid',key:'dummy',fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://mock.invalid/v1/video/generations');assert.equal(JSON.parse(options.body).content[1].image_url.url,draft.references[0].contentUrl);return {ok:true,json:async()=>({task_id:'task-example'})};}});assert.equal(calls,1);
 assert.equal(validateDraft({...draft,modelId:'grok-video-3'}).ok,false);
 assert.equal(validateDraft({...draft,references:[{type:'image/png',contentUrl:'asset://../bad'}]}).ok,false);
});
test('document nested processing/completed envelopes normalize correctly',()=>{
 const response=(status,content,outer)=>({code:'success',data:{data:{id:'task-example',model:'doubao-seedance-2.5',status,content},status:outer,task_id:'task-example',progress:outer==='SUCCESS'?'100%':'50%'}});
 assert.deepEqual(normalizeMediaResults(response('processing',{},'IN_PROGRESS')),{urls:[],taskIds:['task-example'],errors:[]});
 assert.deepEqual(normalizeMediaResults(response('completed',{video_url:'https://example.test/video'},'SUCCESS')),{urls:['https://example.test/video'],taskIds:[],errors:[]});
 const failed=response('failed',{},'IN_PROGRESS');failed.data.data.error={message:'生成失败'};assert.deepEqual(normalizeMediaResults(failed),{urls:[],taskIds:[],errors:['生成失败']});
});
