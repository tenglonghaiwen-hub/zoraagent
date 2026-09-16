import test from 'node:test';
import assert from 'node:assert/strict';
import {getModels} from '../packages/duoyuanx/catalog.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {generateBatch} from '../packages/duoyuanx/generation-service.mjs';
import {normalizeMediaResults} from '../apps/client/media-results.js';
const image={type:'image/png',contentUrl:'data:image/png;base64,AA=='};
const draftFor=m=>({modelId:m.id,prompt:'test',count:1,concurrency:1,ratio:m.ratios[0],resolution:m.resolutions[0],duration:m.fixedSeconds||m.durationRange?.min||5,videoMode:m.family==='minimax'?'ref':m.kind==='image'?'t2i':'t2v',...(m.family==='minimax'?{references:[image,image,image]}:{})});
const model=family=>getModels().find(m=>m.family===family);
test('all 18 media models pack prompt and reference requests',()=>{
 const media=getModels().filter(m=>m.kind!=='agent');assert.equal(media.length,18);
 for(const m of media){const draft=draftFor(m);assert.equal(packGenerateRequest(draft,m).path,m.family==='minimax'?'/v2/video_generation':m.route);const packed=packGenerateRequest({...draft,ratio:m.family==='veo'?'16:9':draft.ratio,videoMode:m.kind==='image'?'i2i':'ref',references:m.family==='minimax'?[image,image,image]:[image]},m);assert(JSON.stringify(packed).includes('AA=='),m.id);}
});
test('family-specific reference fields and constraints',()=>{
 const pack=(family,extra)=>{const m=model(family);return packGenerateRequest({...draftFor(m),videoMode:'ref',references:family==='minimax'?[image,image,image]:[image],...extra},m);};
 assert.equal(pack('qwen-image').path,'/v1/images/edits');
 assert.equal(pack('qwen-image').body.input.messages[0].content[0].image,image.contentUrl);
 assert.deepEqual(pack('gpt-image',{videoMode:'i2i'}).body.image,['AA==']);
 assert.equal(pack('seedance').body.content[1].role,'reference_image');
 assert.equal(pack('seedance',{videoMode:'fl',references:[image,image]}).body.content[2].role,'last_frame');
 assert.equal(pack('minimax',{ratio:'9:16'}).body.ratio,'9:16');assert.throws(()=>pack('minimax',{videoMode:'i2v'}));
 assert.equal(pack('veo',{ratio:'16:9',resolution:'1080P'}).body.size,'1920x1080');
 assert.throws(()=>pack('veo',{ratio:'9:16'}),/16:9/);
 assert.throws(()=>pack('qwen-image',{references:Array(4).fill(image)}),/3/);
});
test('normalization keeps all outputs, queued jobs and partial errors without false pending IDs',()=>{
 assert.deepEqual(normalizeMediaResults([{id:'image-response',data:[{url:'https://example.test/a'},{b64_json:'AA=='}]},{task_id:'pending'},{status:'FAILED',error:{message:'bad'}},{status:'COMPLETED',id:'empty'}]),{urls:['https://example.test/a','data:image/png;base64,AA=='],taskIds:['pending'],errors:['bad','任务已结束但未返回可用素材']});
 assert.deepEqual(normalizeMediaResults({candidates:[{content:{parts:[{inlineData:{mimeType:'image/jpeg',data:'AA=='}}]}}]}).urls,['data:image/jpeg;base64,AA==']);
});
test('batch count creates independent requests, limits HTTP concurrency and preserves partial failures',async()=>{
 const m=model('gpt-image');let active=0,peak=0,calls=0;
 const fetchImpl=async(url,options)=>{active++;peak=Math.max(peak,active);const index=++calls;assert.equal(JSON.parse(options.body).n,1);await new Promise(r=>setTimeout(r,10));active--;return {ok:index!==2,json:async()=>index===2?{error:{message:'mock failure'}}:{data:[{url:'https://example.test/'+index}]}};};
 const results=await generateBatch({...draftFor(m),count:4,concurrency:2},m,{base:'https://mock.test',key:'test',fetchImpl});
 assert.equal(calls,4);assert(peak<=Math.min(2,m.maxConcurrency));assert.equal(results.filter(r=>r.ok).length,3);assert.equal(results[1].error,'mock failure');
});
test('Seedance uploads inline reference once and never sends gateway credentials to signed storage',async()=>{
 const m=model('seedance'),calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.endsWith('/v1/file/upload'))return {ok:true,json:async()=>({upload_url:'https://storage.test/upload',download_url:'https://storage.test/ref'})};if(url==='https://storage.test/upload'){assert.equal(options.headers.Authorization,undefined);return {ok:true};}assert.equal(JSON.parse(options.body).content[1].image_url.url,'https://storage.test/ref');return {ok:true,json:async()=>({task_id:'job-'+calls.length})};};
 const results=await generateBatch({...draftFor(m),count:2,videoMode:'i2v',references:[image]},m,{base:'https://mock.test',key:'test',fetchImpl});
 assert.equal(results.length,2);assert(results.every(r=>r.ok));assert.equal(calls.length,4);
});
test('Grok sends repeated binary reference fields',async()=>{
 const m=model('grok-video');let checked=false;
 await generateBatch({...draftFor(m),videoMode:'ref',references:[image,image]},m,{base:'https://mock.test',key:'test',fetchImpl:async(url,options)=>{assert.equal(options.body.getAll('input_reference').length,2);assert.equal(options.body.get('input_reference').size,1);checked=true;return {ok:true,json:async()=>({id:'job',status:'queued'})};}});assert(checked);
});
