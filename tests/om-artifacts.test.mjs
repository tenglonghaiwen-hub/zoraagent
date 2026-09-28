import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {handleOmArtifacts} from '../apps/server/routes/om-artifacts.mjs';
import {localMediaPaths} from '../apps/client/om-artifacts.js';

test('local media paths support old replies and successful tool results',()=>{
 assert.deepEqual(localMediaPaths({answer:'[audio](D:\\projects\\voice.wav)'}),['D:\\projects\\voice.wav']);
 assert.deepEqual(localMediaPaths({toolTrace:[{name:'om_execute_tool',result:{ok:false,result:{artifacts:['D:\\bad.wav']}}}]}),[]);
 assert.deepEqual(localMediaPaths({toolTrace:[{name:'om_execute_tool',result:{ok:true,result:{artifacts:['D:\\voice.wav']}}}]}),['D:\\voice.wav']);
});
test('local media resolves real files, streams ranges and rejects escapes and cross origin',async()=>{
 const root=path.resolve('outputs','om-preview-test-'+Date.now());fs.mkdirSync(path.join(root,'project'),{recursive:true});
 const outputRoot=path.join(root,'exports');fs.mkdirSync(outputRoot);const exported=path.join(outputRoot,'saved.wav');fs.writeFileSync(exported,'RIFFsaved');
 const file=path.join(root,'project','voice.wav');fs.writeFileSync(file,Buffer.from('RIFF1234WAVEtest'));
 const server=http.createServer(async(req,res)=>{
  const sendJson=(_res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  const readJson=async()=>{let text='';for await(const chunk of req)text+=chunk;return JSON.parse(text);};
  await handleOmArtifacts(req,res,new URL(req.url,'http://localhost'),{sendJson,readJson,projectsRoot:path.join(root,'project'),outputRoot});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base+'/api/om/artifacts/resolve',{method:'POST',body:JSON.stringify({paths:[file,exported,path.resolve('outside.wav'),path.join(root,'missing.wav')]})});
  const data=await response.json();assert.equal(data.files.length,2);assert.equal(data.errors.length,2);assert.equal(data.files[0].kind,'audio');assert.equal(await (await fetch(base+data.files[1].url)).text(),'RIFFsaved');
  const range=await fetch(base+data.files[0].url,{headers:{Range:'bytes=0-3'}});assert.equal(range.status,206);assert.equal(await range.text(),'RIFF');assert.equal(range.headers.get('content-type'),'audio/wav');
  assert.equal((await fetch(base+data.files[0].url,{headers:{Range:'bytes=999-'}})).status,416);
  const escaped=Buffer.from('../outside.wav').toString('base64url');assert.equal((await fetch(base+'/api/om/artifacts/file/'+escaped)).status,404);
  assert.equal((await fetch(base+data.files[0].url,{headers:{Origin:'https://external.example'}})).status,403);
  fs.renameSync(file,file+'.moved');assert.equal((await fetch(base+data.files[0].url)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
