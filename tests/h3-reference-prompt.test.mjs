import test from 'node:test';
import assert from 'node:assert/strict';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
test('H3 OpenAI reference format keeps all actual references and ratio',()=>{
 const references=[1,2,3].map(i=>({type:'image/png',contentUrl:'https://example.com/'+i+'.png'}));references.push({type:'video/mp4',contentUrl:'https://example.com/v.mp4'});
 const d={modelId:'MiniMax-H3',videoMode:'ref',prompt:'test',ratio:'9:16',duration:7,resolution:'768P',references};
 const r=packGenerateRequest(d);assert.equal(r.path,'/v1/videos');assert.equal(r.queryRoute,'/v1/videos/{task_id}');assert.deepEqual(r.body.images,references.slice(0,3).map(r=>r.contentUrl));assert.equal(r.body.metadata.ratio,'9:16');assert.equal(r.body.metadata.reference_videos[0],references[3].contentUrl);assert.equal(r.body.content,undefined);
 assert.throws(()=>packGenerateRequest({...d,apiRoute:'/v2/video_generation'}));
 for(const n of [1,2])assert.throws(()=>packGenerateRequest({...d,references:references.slice(0,n)}),/1–2/);
});
