import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {analyzeVideoReferences} from '../packages/agent/video-analysis.mjs';
const ffmpeg='D:/ffmpeg/bin/ffmpeg.exe',run=promisify(execFile);
test('real short uploaded videos yield bounded timestamped frames without modifying originals',{skip:!fs.existsSync(ffmpeg)},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zora-video-analysis-test-')),file=path.join(dir,'original.mp4');
 await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=s=64x64:r=10','-f','lavfi','-i','sine=frequency=440:sample_rate=8000','-t','3','-c:v','mpeg4','-c:a','aac','-y',file],{timeout:15000,maxBuffer:1024*1024,windowsHide:true});
 const original=fs.readFileSync(file),ref={name:'original.mp4',type:'video/mp4',contentUrl:'data:video/mp4;base64,'+original.toString('base64')};
 const result=await analyzeVideoReferences([ref,{...ref,name:'second.mp4'}]);
 assert.equal(result.images.length,6);assert.match(result.summary,/音频未转写/);assert.match(result.summary,/时长 3.00 秒/);assert.match(result.summary,/每 0.5 秒采样/);assert.ok(result.images.every(f=>f.url.startsWith('data:image/jpeg;base64,')&&/秒/.test(f.name)));assert.deepEqual(fs.readFileSync(file),original);
 assert.equal(result.sampling[0].frameCount,6);assert.equal(result.sampling[0].sheets.at(-1).end,2.5);assert.equal(result.audioFiles.length,2);
 const audioProbe=JSON.parse((await run('D:/ffmpeg/bin/ffprobe.exe',['-v','error','-show_entries','stream=sample_rate,channels,codec_name','-of','json',result.audioFiles[0].path],{timeout:10000})).stdout);assert.equal(audioProbe.streams[0].sample_rate,'16000');assert.equal(audioProbe.streams[0].channels,1);assert.equal(audioProbe.streams[0].codec_name,'pcm_s16le');
 const limited=await analyzeVideoReferences([ref,{...ref,name:'second.mp4'}],{maxFrames:2});assert.equal(limited.images.length,2);assert.match(limited.images[1].name,/second/);
 await assert.rejects(analyzeVideoReferences([ref,ref],{maxFrames:1}),/预算/);
});
test('rejects network URLs and disguised playlists before invoking a decoder',async()=>{
 await assert.rejects(analyzeVideoReferences([{type:'video/mp4',contentUrl:'http://127.0.0.1/private'}]),/不下载网络/);
 const playlist='data:video/mp4;base64,'+Buffer.from('#EXTM3U\nhttp://127.0.0.1/private').toString('base64');
 await assert.rejects(analyzeVideoReferences([{type:'video/mp4',contentUrl:playlist}]),/签名/);
 assert.deepEqual(await analyzeVideoReferences([{type:'image/png'}]),{images:[],audioFiles:[],summary:''});
});
test('invalid container with a video signature reports failure instead of fabricated analysis',{skip:!fs.existsSync(ffmpeg)},async()=>{
 const bytes=Buffer.alloc(32);bytes.write('ftyp',4);await assert.rejects(analyzeVideoReferences([{type:'video/mp4',contentUrl:'data:video/mp4;base64,'+bytes.toString('base64')}]),/读取失败|有效时长/);
});
test('videos above duration limit are rejected rather than silently truncated',{skip:!fs.existsSync(ffmpeg)},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zora-video-analysis-long-')),file=path.join(dir,'long.mp4');
 await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=32x32:r=2','-t','121','-c:v','mpeg4','-y',file],{timeout:15000,maxBuffer:1024*1024});
 await assert.rejects(analyzeVideoReferences([{name:'long',type:'video/mp4',contentUrl:'data:video/mp4;base64,'+fs.readFileSync(file).toString('base64')}]),/120 秒/);
});
