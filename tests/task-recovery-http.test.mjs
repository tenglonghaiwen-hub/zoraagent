import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const pause=()=>new Promise(r=>setTimeout(r,75));
async function until(fn){const end=Date.now()+15000;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch{}await pause();}throw Error('local server test timed out');}
test('real server process restart restores durable task and never resubmits',async()=>{
 let submissions=0,completed=false;
 const gateway=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.method==='POST'){let body='';for await(const c of req)body+=c;assert.equal(JSON.parse(body).model,'doubao-seedance-2.5');submissions++;res.end(JSON.stringify({task_id:'fixture-remote-job'}));}else res.end(JSON.stringify(completed?{status:'succeeded',content:{video_url:'https://fixture.invalid/output.mp4'}}:{status:'running',id:'fixture-remote-job'}));});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 const reservation=http.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-http-recovery-'));
 const env={...process.env,PORT:String(port),DUOYUANX_BASE_URL:'http://127.0.0.1:'+gateway.address().port,DUOYUANX_API_KEY:'mock-key',ZORA_TASK_STORE_DIR:directory,ZORA_AGENT_API_KEY:'',ZORA_AGENT_ENABLED:'false',RUNNINGHUB_API_KEY:'',RUNNINGHUB_ENABLED:'false',OM_ENABLED:'false',OM_AUTO_SIDECAR:'false'};
 let child;const boot=async()=>{child=spawn(process.execPath,[new URL('../apps/server/server.mjs',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],{env,windowsHide:true,stdio:'ignore'});await until(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/api/models');return r.ok;});};
 const stop=async()=>{if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}};
 try{
  await boot();const id=randomUUID();const body={requestId:id,modelId:'doubao-seedance-2.5',prompt:'mock only',count:1,concurrency:1,ratio:'16:9',resolution:'720P',duration:5,videoMode:'t2v'};
  const create=()=>fetch('http://127.0.0.1:'+port+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await create()).status,202);
  const read=async()=>await (await fetch('http://127.0.0.1:'+port+'/api/generation-tasks/'+id)).json();
  await until(async()=>(await read()).task.upstreams.length);assert.equal((await create()).status,202);assert.equal(submissions,1);
  await stop();completed=true;await boot();const result=await until(async()=>{const v=await read();return v.task.status==='completed'&&v;});assert.equal(submissions,1);assert(JSON.stringify(result).includes('output.mp4'));
 }finally{await stop();await new Promise(r=>gateway.close(r));}
});
