import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readOmPreferences,saveOmPreferences,configureOmInputs,validateOmPreferences} from '../packages/adapters/om-preferences.mjs';
import {saveStockCredentials,stockCredentialStatus,stockCredentialEnvironment} from '../packages/adapters/om-credentials.mjs';
import {handleOpenMontageRoutes} from '../apps/server/routes/openmontage.mjs';

test('local settings persist and enforce disabled tools and selected sources',()=>{
 const old=process.env.OM_STATE_DIR;process.env.OM_STATE_DIR=path.resolve('outputs','om-settings-test-'+Date.now());
 try{
  const p=saveOmPreferences({...readOmPreferences(),transcription:false,sources:['nasa'],transcriptModel:'small'});
  assert.equal(readOmPreferences().transcriptModel,'small');
  assert.throws(()=>configureOmInputs('transcriber',{},p),/关闭/);
  assert.deepEqual(configureOmInputs('direct_clip_search',{},p).sources,['nasa']);
  assert.throws(()=>configureOmInputs('direct_clip_search',{sources:['pexels']},p),/未启用/);
  assert.throws(()=>validateOmPreferences({apiKey:'no'}),/不支持/);
  assert.throws(()=>validateOmPreferences({stock:true,sources:[]}),/至少/);
  assert.throws(()=>configureOmInputs('piper_tts',{text:'测试'},p),/音色/);
  for(const args of [{},{instruction:'朗读测试'},{text:' '},{text:42}])assert.throws(()=>configureOmInputs('piper_tts',args,p),/args.text/);
 }finally{if(old===undefined)delete process.env.OM_STATE_DIR;else process.env.OM_STATE_DIR=old;}
});

test('Windows stock keys are encrypted, isolated by provider, and removable without plaintext echo',{skip:process.platform!=='win32'},()=>{
 const old=process.env.OM_STATE_DIR,root=path.resolve('outputs','om-keys-test-'+Date.now());process.env.OM_STATE_DIR=root;
 try{
  const secret='fixture-pexels-not-a-real-key';
  assert.deepEqual(saveStockCredentials({pexels:secret}),{pexels:true,unsplash:false});
  assert(!fs.readFileSync(path.join(root,'om-stock-credentials.json'),'utf8').includes(secret));
  assert.deepEqual(stockCredentialEnvironment(['nasa']),{});
  assert.deepEqual(stockCredentialEnvironment(['pexels']),{PEXELS_API_KEY:secret});
  assert.throws(()=>stockCredentialEnvironment(['unsplash']),/尚未配置/);
  assert(!JSON.stringify(stockCredentialStatus()).includes(secret));
  saveStockCredentials({pexels:null});assert.equal(stockCredentialStatus().pexels,false);
 }finally{if(old===undefined)delete process.env.OM_STATE_DIR;else process.env.OM_STATE_DIR=old;}
});

test('media preferences and credential routes reject cross-origin requests before reading input',async()=>{
 for(const endpoint of ['preferences','credentials','capabilities']){
  let result;await handleOpenMontageRoutes({method:'PUT',socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:4317',origin:'https://untrusted.example'}},{},new URL('http://127.0.0.1/api/om/'+endpoint),{sendJson:(_r,status,body)=>{result={status,body};},readJson:()=>{throw new Error('must not read');}});
  assert.equal(result.status,403);
 }
});


test('Piper output uses the user save directory and unique names instead of agent supplied paths',()=>{
 const root=path.resolve('outputs','piper-path-test-'+Date.now());fs.mkdirSync(root,{recursive:true});
 const model=path.join(root,'voice.onnx');fs.writeFileSync(model,'fixture');fs.writeFileSync(model+'.json','{}');
 const p={voice:true,voiceModel:model,outputDirectory:path.join(root,'saved')};
 const first=configureOmInputs('piper_tts',{text:'你好',output_path:path.join(root,'wrong.wav')},p);
 const second=configureOmInputs('piper_tts',{text:'你好'},p);
 assert.equal(path.dirname(first.output_path),fs.realpathSync(p.outputDirectory));assert.notEqual(first.output_path,second.output_path);assert.equal(first.text,'你好');
});
