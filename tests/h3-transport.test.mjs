import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBatch} from '../packages/duoyuanx/generation-service.mjs';
import {getModel} from '../packages/duoyuanx/catalog.mjs';
const model=getModel('MiniMax-H3');
const draft={modelId:model.id,prompt:'identity and motion',videoMode:'ref',ratio:'9:16',resolution:'768P',duration:7,count:1,concurrency:1,references:[{type:'video/mp4',contentUrl:'data:video/mp4;base64,AA=='}]};
test('H3 uploads real inputs and sends OpenAI references once to V1 with its own polling route',async()=>{
 let uploads=0,posts=0;const result=await generateBatch(draft,model,{base:'https://gateway.test',key:'dummy',fetchImpl:async(url,options)=>{
 if(url.endsWith('/v1/file/upload')){uploads++;return {ok:true,json:async()=>({upload_url:'https://storage.test/put/'+uploads,download_url:'https://storage.test/ref/'+uploads})};}
 if(url.includes('/put/')){assert.equal(options.headers.Authorization,undefined);return {ok:true};}
 posts++;assert.equal(url,'https://gateway.test/v1/videos');const b=JSON.parse(options.body);assert.equal(b.content,undefined);assert.equal(b.metadata.reference_videos.length,1);assert.equal(b.metadata.ratio,'9:16');assert.equal(b.prompt,draft.prompt);assert(!options.body.includes('base64'));return {ok:true,status:200,json:async()=>({task_id:'test-job'})};
 }});assert.equal(uploads,1);assert.equal(posts,1);assert.equal(result[0].queryRoute,'/v1/videos/{task_id}');
});
test('H3 conflicting V1 reference selection makes no upload or generation call',async()=>{
 let calls=0;const r=await generateBatch({...draft,apiRoute:'/v2/video_generation'},model,{fetchImpl:async()=>{calls++;}});assert.equal(calls,0);assert.equal(r[0].errorPhase,'pre_submission');
});
