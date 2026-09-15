import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatService} from '../apps/server/chat-service.mjs';
process.env.ZORA_AGENT_API_KEY='unit-test-dummy';
process.env.ZORA_AGENT_ENABLED='true';
test('video frames and timestamps reach actual chat runner',async()=>{
 const original={name:'clip.mp4',type:'video/mp4',contentUrl:'data:video/mp4;base64,AAAA'};
 let seen;
 const chat=createChatService({analyzeVideos:async(refs,opts)=>{assert.equal(refs[0].contentUrl,original.contentUrl);assert.equal(opts.maxFrames,6);return {images:[{name:'clip.mp4 1.0s',url:'data:image/jpeg;base64,AAAA'}],summary:'clip.mp4 1.0s 音频未转写'};},run:async(p,o)=>{seen={p,o};return {reply:'已查看抽样画面',tasks:[]};}});
 await chat({message:'分析视频',references:[original]});
 assert.match(seen.p,/1.0s 音频未转写/);assert.equal(seen.o.images.length,1);assert.match(seen.o.images[0].url,/image\/jpeg/);
});
test('decoder failure prevents model call and releases chat lock',async()=>{
 let fail=true,calls=0;
 const chat=createChatService({analyzeVideos:async()=>{if(fail)throw Error('视频解码失败');return {images:[],summary:''};},run:async()=>{calls++;return {reply:'正常',tasks:[]};}});
 await assert.rejects(chat({message:'读取视频'}),/视频解码失败/);assert.equal(calls,0);
 fail=false;await chat({message:'继续'});assert.equal(calls,1);
});
test('audio transcript reaches the model and transcription errors remain explicit',async()=>{
 let fail=false,seen='';
 const chat=createChatService({analyzeVideos:async()=>({images:[{name:'timeline',url:'data:image/jpeg;base64,AAAA'}],audioFiles:[{path:'test.wav'}],summary:'每0.5秒采样'}),transcribeAudio:async()=>{if(fail)throw Error('音频转写失败');return {summary:'台词：你好',status:'completed'};},run:async p=>{seen=p;return {reply:'分析结果',tasks:[]};}});
 await chat({message:'分析'});assert.match(seen,/台词：你好/);
 fail=true;await chat({message:'分析'});assert.match(seen,/音频转写失败/);assert.doesNotMatch(seen,/台词：你好/);
});
