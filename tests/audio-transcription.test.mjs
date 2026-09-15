import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {transcribeAudioFiles} from '../packages/agent/audio-transcription.mjs';
test('transcription sends multipart audio and caches successful results',async()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'zora-asr-test-')),'audio.wav');fs.writeFileSync(file,'RIFF-test-wave');let calls=0;
 const options={model:'test-asr',key:'dummy',fetchImpl:async(url,o)=>{calls++;assert.equal(url.pathname,'/v1/audio/transcriptions');assert.equal(o.body.get('model'),'test-asr');assert.equal(o.body.get('file').size,14);assert.equal(o.redirect,'error');return {ok:true,json:async()=>({text:'你好'})};}};
 const files=[{path:file,name:'sample',duration:1}];assert.match((await transcribeAudioFiles(files,options)).summary,/你好/);await transcribeAudioFiles(files,options);assert.equal(calls,1);
});
test('unconfigured transcription never calls provider',async()=>{
 const r=await transcribeAudioFiles([{path:'unused'}],{model:'',key:'',fetchImpl:()=>{throw Error('must not call');}});assert.equal(r.status,'blocked');
});
test('provider timing is retained and invalid timing discarded',async()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'zora-asr-timing-')),'audio.wav');fs.writeFileSync(file,'RIFF-timing');
 const r=await transcribeAudioFiles([{path:file,name:'timing',duration:2}],{key:'dummy',fetchImpl:async(u,o)=>{assert.equal(o.body.get('response_format'),'verbose_json');assert.equal(o.body.get('model'),'whisper-1');return {ok:true,json:async()=>({text:'你好',segments:[{start:0,end:1,text:'你好'},{start:7,end:8,text:'invalid'}]})};}});
 assert.match(r.summary,/"start":0/);assert.doesNotMatch(r.summary,/invalid/);
});
