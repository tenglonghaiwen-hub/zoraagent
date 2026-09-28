import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {LK_H3,packLkH3,normalizeLkH3Result} from '../packages/duoyuanx/lk-minimax-h3.mjs';
import {publishModelCapability,safeRoute} from '../packages/contracts/model-capability.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {submitH3Task,queryH3Task} from '../apps/cloudflare-worker/src/h3-tasks.mjs';
import {applyGenerationReceipt} from '../apps/client/agent-generation-tasks.js';
import worker from '../apps/cloudflare-worker/src/index.mjs';
import {signJwt} from '../apps/cloudflare-worker/src/auth.mjs';
const config={version:1,template:'lk-minimax-h3'};
const model=publishModelCapability({id:'minimax-h3',kind:'video',provider:'custom',capability:config});
const input={modelId:'minimax-h3',prompt:'小猫散步',duration:5,ratio:'16:9',resolution:'768P',count:1,videoMode:'t2v'};
const image=url=>({type:'image/png',contentUrl:url});

test('LK H3 publishes an independent template and only permits its exact query string',()=>{
 assert.equal(model.available,true);assert.equal(model.route,LK_H3.route);assert.equal(model.queryRoute,LK_H3.queryRoute);
 assert.equal(safeRoute(LK_H3.queryRoute,{query:true}),LK_H3.queryRoute);
 for(const route of ['/v1/media/status?task_id={task_id}&url=http://evil','//evil','/v1/media/status?other={task_id}'])assert.throws(()=>safeRoute(route,{query:true}));
 assert.throws(()=>safeRoute(LK_H3.queryRoute));
 assert.equal(publishModelCapability({...model,provider:'duoyuanx'}).available,false);
});
test('mode packing separates first/last frame from references; video requires URL',()=>{
 const a=image('https://media.test/first.png'),b=image('https://media.test/last.png');
 assert.deepEqual(packGenerateRequest(input,model).body,{model:'minimax-h3',prompt:input.prompt,params:{mode:'shouweizhen',duration:'5',resolution:'768P',aspect_ratio:'16:9'}});
 assert.deepEqual(packLkH3({...input,videoMode:'fl',references:[a,b]},model).body.params.images,[a.contentUrl,b.contentUrl]);
 const refs=[a,{type:'audio/wav',contentUrl:'data:audio/wav;base64,aGVsbG8='},{type:'video/mp4',contentUrl:'https://media.test/ref.mp4'}];
 const p=packLkH3({...input,videoMode:'ref',references:refs},model).body.params;
 assert.equal(p.mode,'cankaosheng');assert.deepEqual(p.image_url,[a.contentUrl]);assert.equal(p.images,undefined);assert.equal(p.video_url.length,1);assert.equal(p.audio_url.length,1);
 assert.throws(()=>packLkH3({...input,videoMode:'ref',references:[{type:'video/mp4',contentUrl:'data:video/mp4;base64,aGVsbG8='}]},model),/公网直链/);
 assert.throws(()=>packLkH3({...input,videoMode:'ref',references:Array(10).fill(a)},model),/最多9/);
 assert.throws(()=>packLkH3({...input,videoMode:'fl',references:[a]},model),/2张/);
 for(const resolution of LK_H3.resolutions)assert.equal(packLkH3({...input,resolution},model).body.params.resolution,resolution);
});
test('query uses documented final flag/state, rejects wrong task and missing output',()=>{
 assert.equal(normalizeLkH3Result({task_id:123,is_final:false,state:'running',status:'已完成'},'123').status,'processing');
 assert.equal(normalizeLkH3Result({task_id:123,is_final:true,state:'failed',error:'test'},'123').error,'test');
 assert.throws(()=>normalizeLkH3Result({task_id:124,is_final:true,state:'success',result_url:'https://test/a.mp4'},'123'),/其他任务/);
 assert.throws(()=>normalizeLkH3Result({task_id:123,is_final:true,state:'success'},'123'),/缺少/);
});
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
 sql.prepare('INSERT INTO users (id,email,password_hash,quota_balance,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('user','test@example.com','test',1000,0,0);
 sql.prepare('INSERT INTO server_models (id,name,kind,enabled,provider,route,query_route,quota_cost_per_unit,config,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('minimax-h3','LK H3','video',1,'custom',LK_H3.route,LK_H3.queryRoute,20,JSON.stringify(config),0,0);
 const DB={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values);},exec(){return {meta:{changes:sql.prepare(query).run(...values).changes}};},async run(){return this.exec();}};},async batch(statements){sql.exec('BEGIN');try{const out=statements.map(s=>s.exec());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {sql,env:{DB,CUSTOM_BASE_URL:'https://upstream.test',CUSTOM_API_KEY:'test',JWT_SECRET:'test-secret'},user:{id:'user'},balance:()=>sql.prepare("SELECT quota_balance FROM users WHERE id='user'").get().quota_balance};
}
test('HTTP submit/recover yields playable video, numeric upstream ID, charge once independent of duration',async()=>{
 const f=fixture(),original=globalThis.fetch;let posts=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(options.method==='POST'){posts++;assert.equal(url,'https://upstream.test/v1/media/generate');assert.equal(JSON.parse(options.body).params.duration,'15');return Response.json({task_id:123});}
   assert.equal(url,'https://upstream.test/v1/media/status?task_id=123');return Response.json({task_id:123,is_final:true,state:'success',result_url:'https://media.test/video.mp4'});
  };
  const token=await signJwt({userId:'user'},f.env.JWT_SECRET);
  const req=(path,body)=>new Request('https://zora.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const body={...input,duration:15,kind:'video',requestId:'lk-h3-request-0001'};
  for(let i=0;i<2;i++){const response=await worker.fetch(req('/api/generate',body),f.env,{});assert.equal(response.status,200);assert.equal((await response.json()).task.executor,'lk-h3');}
  assert.equal(posts,1);assert.equal(f.balance(),980);
  const response=await worker.fetch(req('/api/generation-tasks/'+body.requestId),f.env,{});const {task}=await response.json();
  assert.equal(task.status,'completed');assert.equal(applyGenerationReceipt({},task).genUrl,'https://media.test/video.mp4');assert.equal(f.balance(),980);
  assert.equal(await queryH3Task(body.requestId,{id:'other'},f.env),null);
 }finally{globalThis.fetch=original;f.sql.close();}
});
test('failed generation refunds once and new requests use updated per-call price',async()=>{
 const f=fixture();let posts=0;
 const deps={fetch:async(url,options)=>Response.json(options.method==='POST'?{task_id:++posts}:{task_id:Number(new URL(url).searchParams.get('task_id')),is_final:true,state:'failed',error:'provider failed'})};
 try{
  const body={...input,requestId:'lk-h3-refund-0001'};
  await submitH3Task(body,f.user,f.env,deps);assert.equal(f.balance(),980);
  await queryH3Task(body.requestId,f.user,f.env,deps);await queryH3Task(body.requestId,f.user,f.env,deps);assert.equal(f.balance(),1000);
  f.sql.prepare("UPDATE server_models SET quota_cost_per_unit=35 WHERE id='minimax-h3'").run();
  await submitH3Task({...body,requestId:'lk-h3-refund-0002'},f.user,f.env,deps);assert.equal(f.balance(),965);
  await assert.rejects(submitH3Task({...body,requestId:'lk-h3-remix-00003',h3Operation:'remix'},f.user,f.env,deps),/不支持/);
 }finally{f.sql.close();}
});
