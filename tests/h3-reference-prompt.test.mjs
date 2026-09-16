import test from 'node:test';import assert from 'node:assert/strict';import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
test('official H3 explicit roles preserve one or two reference images and mixed media',()=>{
 const refs=[{type:'image/png',contentUrl:'https://example.com/i.png'},{type:'video/mp4',contentUrl:'https://example.com/v.mp4'},{type:'audio/mp3',contentUrl:'https://example.com/a.mp3'}];
 const d={modelId:'MiniMax-H3',videoMode:'ref',prompt:'test',ratio:'9:16',duration:7,resolution:'768P',references:refs};const r=packGenerateRequest(d);
 assert.equal(r.path,'/v2/video_generation');assert.equal(r.queryRoute,'/v2/query/video_generation/{task_id}');assert.equal(r.body.ratio,'9:16');assert.equal(r.body.resolution,'768P');assert.equal(r.body.prompt,undefined);assert.equal(r.body.metadata,undefined);assert.deepEqual(r.body.content.slice(1).map(x=>x.role),['reference_image','reference_video','reference_audio']);
 for(const references of [[refs[0]],[refs[0],refs[0]]])assert.ok(packGenerateRequest({...d,references}).body.content.slice(1).every(x=>x.role==='reference_image'));
 assert.throws(()=>packGenerateRequest({...d,apiRoute:'/v1/videos'}));
 const frame=packGenerateRequest({...d,videoMode:'i2v',ratio:'adaptive',references:[refs[0]]});assert.equal(frame.body.content[1].role,'first_frame');
});
