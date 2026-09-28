import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {LK_WAN3,packLkWan3} from '../packages/duoyuanx/lk-wan3.mjs';
import {publishModelCapability,assertConfiguredOperation} from '../packages/contracts/model-capability.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {previewH3Task,submitH3Task,queryH3Task} from '../apps/cloudflare-worker/src/h3-tasks.mjs';
import {serveWanReference} from '../apps/cloudflare-worker/src/wan-reference-media.mjs';
import {cloudToolApi} from '../apps/server/cloud-agent-api.mjs';
import {cloudAgentContext} from '../apps/server/cloud-agent-context.mjs';
import {applyGenerationReceipt} from '../apps/client/agent-generation-tasks.js';
import worker from '../apps/cloudflare-worker/src/index.mjs';
import {signJwt} from '../apps/cloudflare-worker/src/auth.mjs';

const capability={version:1,template:'lk-wan3',wanVersion:'standard'};
const model=publishModelCapability({id:'wan3.0',kind:'video',provider:'custom',capability});
const draft={modelId:'wan3.0',prompt:'湖面波光粼粼',count:1,duration:5,ratio:'16:9',resolution:'720P',videoMode:'t2v'};
const image=url=>({type:'image/png',contentUrl:url});

test('Wan 3.0 supports documented sizes, durations, version and scoped model identity',()=>{
 assert.equal(model.available,true);assert.equal(model.queryRoute,LK_WAN3.queryRoute);
 assert.deepEqual(packGenerateRequest(draft,model).body,{model:'wan3.0',prompt:draft.prompt,params:{mode:'shouweizhen',version:'standard',resolution:'720P',duration:'5',ratio:'16:9'}});
 for(const duration of LK_WAN3.durations)assert.equal(packLkWan3({...draft,duration},model).body.params.duration,duration===-1?'auto':String(duration));
 for(const resolution of LK_WAN3.resolutions)assert.equal(packLkWan3({...draft,resolution},model).body.params.resolution,resolution);
 const prime=publishModelCapability({id:'wan3.0',kind:'video',provider:'custom',capability:{...capability,wanVersion:'prime',wanAudio:true,wanPromptExtend:false}});
 assert.deepEqual(Object.entries(packLkWan3(draft,prime).body.params).filter(([key])=>['version','audio','prompt_extend'].includes(key)),[['version','prime'],['audio',true],['prompt_extend',false]]);
 assert.equal(publishModelCapability({id:'wan3.0',kind:'video',provider:'duoyuanx',capability}).available,false);
 assert.equal(publishModelCapability({id:'wan3.0',kind:'video',provider:'custom',capability:{...capability,wanVersion:'fast'}}).available,false);
});

test('Wan modes, document/web references and media limits follow the documented payload',()=>{
 const a=image('https://media.test/start.png'),b=image('https://media.test/end.png');
 assert.deepEqual(packLkWan3({...draft,videoMode:'fl',references:[a,b]},model).body.params.images,[a.contentUrl,b.contentUrl]);
 const refs=[a,{type:'video/mp4',contentUrl:'https://media.test/ref.mp4'},{type:'audio/wav',contentUrl:'data:audio/wav;base64,aGVsbG8='},{type:'application/pdf',contentUrl:'https://media.test/slides.pdf'}];
 const params=packLkWan3({...draft,videoMode:'ref',references:refs},model).body.params;
 assert.equal(params.mode,'cankaosheng');assert.deepEqual(params.image_url,[a.contentUrl]);assert.deepEqual(params.video_url,['https://media.test/ref.mp4']);assert.deepEqual(params.audio_url,['data:audio/wav;base64,aGVsbG8=']);assert.equal(params.file_url,'https://media.test/slides.pdf');
 const link={...draft,videoMode:'ref',linkUrl:'https://example.com/article'};
 assertConfiguredOperation(model,link);assert.equal(packGenerateRequest(link,model).body.params.link_url,link.linkUrl);
 assert.throws(()=>packLkWan3({...link,fileUrl:'https://example.com/slides.pdf'},model),/只能选一项/);
 assert.throws(()=>packLkWan3({...draft,videoMode:'ref',references:[{type:'video/mp4',contentUrl:'data:video/mp4;base64,aGVsbG8='}]},model),/公网直链/);
 assert.throws(()=>packLkWan3({...draft,videoMode:'ref',references:Array(11).fill(a)},model),/最多10张/);
 assert.throws(()=>packLkWan3({...draft,videoMode:'fl',references:[a]},model),/2张/);
});

function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
 sql.prepare('INSERT INTO users (id,email,password_hash,quota_balance,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('user','test@example.com','test',1000,0,0);
 sql.prepare('INSERT INTO server_models (id,name,kind,enabled,provider,route,query_route,quota_cost_per_unit,config,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('wan3.0','万相 3.0','video',1,'custom',LK_WAN3.route,LK_WAN3.queryRoute,30,JSON.stringify(capability),0,0);
 const DB={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values);},exec(){return {meta:{changes:sql.prepare(query).run(...values).changes}};},async run(){return this.exec();}};},async batch(statements){sql.exec('BEGIN');try{const out=statements.map(s=>s.exec());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {sql,env:{DB,CUSTOM_BASE_URL:'https://upstream.test',CUSTOM_API_KEY:'test',JWT_SECRET:'test-secret'},user:{id:'user'},balance:()=>sql.prepare("SELECT quota_balance FROM users WHERE id='user'").get().quota_balance};
}
test('known pre-submission failure releases reserved quota once and retains receipt',async()=>{
 const f=fixture();let calls=0;
 const body={...draft,requestId:'pre-submission-wan-0001'};
 const deps={fetch:async()=>{calls++;throw Error('Invalid redirect value, must be one of "follow" or "manual"');}};
 try{
  const first=await submitH3Task(body,f.user,f.env,deps);
  assert.equal(first.task.status,'failed');
  assert.equal(first.task.billing,'released');
  assert.equal(f.balance(),1000);
  await submitH3Task(body,f.user,f.env,deps);
  assert.equal(calls,1);
  assert.equal(f.balance(),1000);
 }finally{f.sql.close();}
});

test('Wan HTTP submit/query restores video once, respects fixed price, refunds failed task',async()=>{
 const f=fixture(),original=globalThis.fetch;let posts=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(options.method==='POST'){posts++;assert.equal(url,'https://upstream.test/v1/media/generate');assert.equal(JSON.parse(options.body).params.version,'standard');return Response.json({task_id:600+posts});}
   const id=Number(new URL(url).searchParams.get('task_id'));
   return Response.json(id===601?{task_id:id,is_final:true,state:'success',result_url:'https://media.test/wan.mp4'}:{task_id:id,is_final:true,state:'failed',error:'provider failed'});
  };
  const token=await signJwt({userId:'user'},f.env.JWT_SECRET);
  const req=(path,body)=>new Request('https://zora.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const body={...draft,kind:'video',requestId:'wan-request-test-0001'};
  for(let i=0;i<2;i++){const response=await worker.fetch(req('/api/generate',body),f.env,{});assert.equal(response.status,200);assert.equal((await response.json()).task.executor,'lk-wan3');}
  assert.equal(posts,1);assert.equal(f.balance(),970);
  const recovered=await worker.fetch(req('/api/generation-tasks/'+body.requestId),f.env,{});const {task}=await recovered.json();
  assert.equal(task.status,'completed');assert.equal(applyGenerationReceipt({},task).genUrl,'https://media.test/wan.mp4');assert.equal(f.balance(),970);
  const second={...body,duration:30,requestId:'wan-request-test-0002'};
  await submitH3Task(second,f.user,f.env);assert.equal(f.balance(),940);
  await queryH3Task(second.requestId,f.user,f.env);await queryH3Task(second.requestId,f.user,f.env);assert.equal(f.balance(),970);
  f.sql.prepare("UPDATE server_models SET quota_cost_per_unit=40 WHERE id='wan3.0'").run();
  await submitH3Task({...body,requestId:'wan-request-test-0003'},f.user,f.env);assert.equal(f.balance(),930);
 }finally{globalThis.fetch=original;f.sql.close();}
});

test('local MP4 is staged privately after quota reservation and exposed only through an expiring signed URL',async()=>{
 const f=fixture(),objects=new Map();
 const bucket={
  async put(key,bytes,options){objects.set(key,{bytes:Uint8Array.from(bytes),size:bytes.byteLength,customMetadata:options.customMetadata});return {key};},
  async get(key){const object=objects.get(key);return object?{...object,body:new Blob([object.bytes]).stream()}:null;},
  async head(key){return objects.get(key)||null;}
 };
 f.env.REFERENCE_MEDIA=bucket;
 const bytes=Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
 const contentUrl='data:video/mp4;base64,'+Buffer.from(bytes).toString('base64');
 const body={...draft,videoMode:'ref',references:[{type:'video/mp4',contentUrl}],requestId:'wan-inline-video-0001'};
 let signedUrl;
 try{
  assert.equal((await previewH3Task(body,f.user,f.env)).ok,true);
  const result=await submitH3Task(body,f.user,f.env,{publicOrigin:'https://zora.test',fetch:async(_url,options)=>{
   signedUrl=JSON.parse(options.body).params.video_url[0];
   assert.match(signedUrl,/^https:\/\/zora\.test\/api\/wan-reference\//);
   assert(!options.body.includes('data:video/'));
   return Response.json({task_id:811});
  }});
  assert.equal(result.task.status,'running');assert.equal(f.balance(),970);assert.equal(objects.size,1);
  const served=await serveWanReference(new Request(signedUrl),f.env);
  assert.equal(served.status,200);assert.deepEqual(new Uint8Array(await served.arrayBuffer()),bytes);
  const bad=new URL(signedUrl);bad.searchParams.set('sig','0'.repeat(64));
  assert.equal((await serveWanReference(new Request(bad),f.env)).status,404);
  assert.equal((await serveWanReference(new Request(signedUrl,{method:'HEAD'}),f.env)).status,200);
  assert.equal((await submitH3Task(body,f.user,f.env)).task.id,body.requestId);assert.equal(objects.size,1);
 }finally{f.sql.close();}
});

test('Agent preview accepts a local Wan MP4 without uploading or submitting it',async()=>{
 const original=globalThis.fetch;
 const bytes=Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
 const reference={type:'video/mp4',contentUrl:'data:video/mp4;base64,'+Buffer.from(bytes).toString('base64')};
 try{
  globalThis.fetch=async url=>{assert.match(String(url),/\/api\/models$/);return Response.json({models:[{...model,maxConcurrency:2}]});};
  const api=cloudToolApi(()=>{throw Error('本地 API 不应被调用');});
  const result=await cloudAgentContext.run({token:'test'},()=>api({method:'POST',path:'/api/preview',body:{...draft,concurrency:1,videoMode:'ref',references:[reference]}}));
  assert.equal(result.ok,true);assert.equal(result.data.packed.path,LK_WAN3.route);
  assert.equal(result.data.draft.referenceCount,1);
 }finally{globalThis.fetch=original;}
});

test('missing private storage rejects local video before upstream submission and restores quota',async()=>{
 const f=fixture();
 const bytes=Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
 const body={...draft,videoMode:'ref',references:[{type:'video/mp4',contentUrl:'data:video/mp4;base64,'+Buffer.from(bytes).toString('base64')}],requestId:'wan-no-bucket-0001'};
 try{
  const result=await submitH3Task(body,f.user,f.env,{publicOrigin:'https://zora.test',fetch:async()=>{throw Error('上游不得被调用');}});
  assert.equal(result.task.status,'failed');assert.equal(result.task.billing,'released');assert.equal(f.balance(),1000);
 }finally{f.sql.close();}
});
