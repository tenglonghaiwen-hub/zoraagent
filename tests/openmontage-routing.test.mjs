import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {getProject,executeTool} from '../packages/adapters/openmontage.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';

test('OM project read and local structured options reach sidecar',async()=>{
 const requests=[];
 const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;requests.push({url:req.url,body:body?JSON.parse(body):null});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,id:'test'}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const old={...process.env};
 process.env.OM_API_BASE=`http://127.0.0.1:${server.address().port}`;process.env.OM_API_TOKEN='fixture';process.env.OM_LOCAL_TOOL_AUTHORITY='fixture';
 try{
  assert.equal((await getProject('project-test')).ok,true);
  assert.equal((await executeTool('project-test',{tool:'transcriber',args:{language:'zh',diarize:false,attachments:[{path:'clip.mp4'}]},idempotencyKey:'same-task'})).ok,true);
  assert.equal(requests[0].url,'/api/v1/projects/project-test');
  assert.equal(requests[1].body.instruction,'@transcriber {"language":"zh","diarize":false}');
  assert.equal(requests[1].body.idempotency_key,'same-task');
  assert.deepEqual(requests[1].body.attachments,[{path:'clip.mp4'}]);
 }finally{for(const k of ['OM_API_BASE','OM_API_TOKEN','OM_LOCAL_TOOL_AUTHORITY']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}await new Promise(r=>server.close(r));}
});

test('registry receives full arguments without sidecar',async()=>{
 const root=path.resolve('outputs','om-regression-'+Date.now());fs.mkdirSync(path.join(root,'scripts'),{recursive:true});fs.mkdirSync(path.join(root,'engine'));
 fs.writeFileSync(path.join(root,'engine','fixture.txt'),'fixture');
 const python=path.resolve('vendor/openmontage/runtime/python/python.exe');
 fs.writeFileSync(path.join(root,'runtime-manifest.json'),JSON.stringify({python:{executable:path.relative(root,python)}}));
 fs.writeFileSync(path.join(root,'scripts','invoke-registry-tool.py'),'import sys,json\np=json.load(sys.stdin)\nprint(json.dumps({"ok":True,"echo":p}))\n');
 const old=process.env.OM_VENDOR_ROOT;process.env.OM_VENDOR_ROOT=root;
 try{const r=await executeTool('project-test',{tool:'video_trimmer',args:{input_path:'original.mp4',start:0,end:3}});assert.equal(r.ok,true);assert.equal(r.echo.tool,'video_trimmer');assert.deepEqual(r.echo.inputs,{input_path:'original.mp4',start:0,end:3,project_id:'project-test'});}
 finally{if(old===undefined)delete process.env.OM_VENDOR_ROOT;else process.env.OM_VENDOR_ROOT=old;}
});

test('original references above 30 MiB are not rejected by draft size gate',()=>{
 const r=validateDraft({modelId:'gpt-image-2',prompt:'edit',count:1,concurrency:1,references:[{contentUrl:'data:image/png;base64,'+'A'.repeat(42*1024*1024),type:'image/png'}]});
 assert.ok(!String(r.error||'').includes('素材'),JSON.stringify(r));
});
