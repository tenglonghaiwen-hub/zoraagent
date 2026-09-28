import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {LK_SEEDANCE_MEDIA,LK_SEEDANCE_ARK,LK_SEEDANCE_UPSTREAM_MODEL,packLkSeedance,lkSeedanceTaskId,normalizeLkSeedanceResult} from '../packages/duoyuanx/lk-seedance.mjs';
import {publishModelCapability} from '../packages/contracts/model-capability.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import worker from '../apps/cloudflare-worker/src/index.mjs';
import {signJwt} from '../apps/cloudflare-worker/src/auth.mjs';

const model=template=>publishModelCapability({id:template.id,kind:'video',provider:'custom',route:template.route,queryRoute:template.queryRoute,capability:{version:1,template:template.family}});
const draft=template=>({modelId:template.id,prompt:'窗边的女孩缓缓转身',count:1,duration:5,ratio:'16:9',resolution:'720p',videoMode:'t2v'});
const image=url=>({type:'image/png',contentUrl:url});
const video=url=>({type:'video/mp4',contentUrl:url});

test('Seedance seed SQL creates both models closed with editable per-task prices',()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
  sql.exec(fs.readFileSync('apps/cloudflare-worker/lk-seedance-config.sql','utf8'));
  const rows=sql.prepare("SELECT * FROM server_models WHERE id LIKE 'lk-seedance-2.0-%' ORDER BY id").all();
  assert.equal(rows.length,2);
  for(const row of rows){assert.equal(row.enabled,0);assert.equal(row.quota_cost_per_unit,0);assert.equal(publishModelCapability(row).available,true);}
 }finally{sql.close();}
});

test('two isolated Seedance templates reject crossed provider IDs and routes',()=>{
 for(const template of [LK_SEEDANCE_MEDIA,LK_SEEDANCE_ARK]){
  const current=model(template);
  assert.equal(current.available,true);
  assert.equal(current.route,template.route);
  assert.equal(current.queryRoute,template.queryRoute);
  assert.equal(packGenerateRequest(draft(template),current).path,template.route);
  assert.equal(publishModelCapability({...current,route:'/v1/other'}).available,false);
  assert.equal(publishModelCapability({...current,provider:'duoyuanx'}).available,false);
 }
});

test('media protocol packs model/prompt/params, image base64 and explicit mode',()=>{
 const current=model(LK_SEEDANCE_MEDIA),base=draft(LK_SEEDANCE_MEDIA);
 assert.deepEqual(packLkSeedance(base,current).body,{model:LK_SEEDANCE_UPSTREAM_MODEL,prompt:base.prompt,params:{mode:'shouweizhen',version:'标准',duration:'5',aspect_ratio:'16:9',resolution:'720p'}});
 const a=image('data:image/png;base64,aGVsbG8='),b=image('https://example.com/end.png');
 assert.deepEqual(packLkSeedance({...base,videoMode:'fl',references:[a,b]},current).body.params.images,[a.contentUrl,b.contentUrl]);
 const ref=packLkSeedance({...base,videoMode:'ref',references:[a,video('https://example.com/ref.mp4'),{type:'audio/wav',contentUrl:'data:audio/wav;base64,aGVsbG8='}]},current);
 assert.deepEqual(ref.body.params.image_url,[a.contentUrl]);assert.deepEqual(ref.body.params.video_url,['https://example.com/ref.mp4']);
 assert.deepEqual(ref.body.params.audio_url,['data:audio/wav;base64,aGVsbG8=']);
 assert.equal(packLkSeedance({...base,duration:-1,resolution:'4k'},current).body.params.duration,'auto');
 assert.equal(packLkSeedance({...base,duration:-1,resolution:'4k'},current).body.params.resolution,'4K');
 assert.throws(()=>packLkSeedance({...base,videoMode:'ref',references:[video('data:video/mp4;base64,aGVsbG8=')]},current),/公网 URL/);
 assert.throws(()=>packLkSeedance({...base,videoMode:'ref',references:[{type:'audio/wav',contentUrl:'https://example.com/a.wav'}]},current),/搭配图片或视频/);
});

test('Ark format uses content roles, public URLs and numeric duration',()=>{
 const current=model(LK_SEEDANCE_ARK),base=draft(LK_SEEDANCE_ARK);
 const a=image('https://example.com/first.png'),b=image('https://example.com/last.png');
 const body=packLkSeedance({...base,videoMode:'fl',references:[a,b]},current).body;
 assert.equal(body.model,LK_SEEDANCE_UPSTREAM_MODEL);
 assert.deepEqual(body.content,[{type:'text',text:base.prompt},{type:'image_url',role:'first_frame',image_url:{url:a.contentUrl}},{type:'image_url',role:'last_frame',image_url:{url:b.contentUrl}}]);
 assert.equal(body.duration,5);assert.equal(body.resolution,'720p');
 assert.equal(packLkSeedance({...base,duration:-1},current).body.duration,-1);
 assert.throws(()=>packLkSeedance({...base,videoMode:'i2v',references:[image('data:image/png;base64,aGVsbG8=')]},current),/公网 URL/);
 assert.throws(()=>packLkSeedance({...base,videoMode:'i2v',references:[a,b]},current),/首帧需要1张/);
});

test('each protocol keeps its own task-id and terminal result contract',()=>{
 assert.equal(lkSeedanceTaskId({code:200,data:{task_id:123456}},{ark:false}),'123456');
 assert.equal(lkSeedanceTaskId({id:'99936297'},{ark:true}),'99936297');
 assert.throws(()=>lkSeedanceTaskId({code:500,msg:'failed'},{ark:false}),/failed/);
 assert.deepEqual(normalizeLkSeedanceResult({task_id:123456,is_final:true,state:'success',result_url:'https://example.com/out.mp4'},'123456',{ark:false}),{status:'completed',url:'https://example.com/out.mp4'});
 assert.deepEqual(normalizeLkSeedanceResult({id:'99936297',status:'succeeded',content:{video_url:'https://example.com/out.mp4'},usage:{completion_tokens:42}},'99936297',{ark:true}),{status:'completed',url:'https://example.com/out.mp4',usageTokens:42});
 assert.equal(normalizeLkSeedanceResult({id:'99936297',status:'running'},'99936297',{ark:true}).status,'processing');
 assert.equal(normalizeLkSeedanceResult({id:'99936297',status:'cancelled'},'99936297',{ark:true}).status,'failed');
 assert.equal(normalizeLkSeedanceResult({id:'99936297',status:'expired'},'99936297',{ark:true}).status,'failed');
 assert.throws(()=>normalizeLkSeedanceResult({id:'other',status:'succeeded',content:{video_url:'https://example.com/out.mp4'}},'99936297',{ark:true}),/其他/);
});

function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
 sql.prepare('INSERT INTO users (id,email,password_hash,quota_balance,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('user','test@example.com','test',1000,0,0);
 for(const [template,cost] of [[LK_SEEDANCE_MEDIA,30],[LK_SEEDANCE_ARK,40]])sql.prepare('INSERT INTO server_models (id,name,kind,enabled,provider,route,query_route,quota_cost_per_unit,config,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(template.id,template.id,'video',1,'custom',template.route,template.queryRoute,cost,JSON.stringify({version:1,template:template.family}),0,0);
 const DB={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values);},exec(){return {meta:{changes:sql.prepare(query).run(...values).changes}};},async run(){return this.exec();}};},async batch(statements){sql.exec('BEGIN');try{const out=statements.map(s=>s.exec());sql.exec('COMMIT');return out;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 return {sql,env:{DB,CUSTOM_BASE_URL:'https://upstream.test',CUSTOM_API_KEY:'test',JWT_SECRET:'test-secret'},balance:()=>sql.prepare("SELECT quota_balance FROM users WHERE id='user'").get().quota_balance};
}

test('both HTTP paths submit once, recover by receipt and normalize completed video',async()=>{
 const f=fixture(),original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{
   calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
   if(options.method==='POST')return Response.json(url.endsWith(LK_SEEDANCE_ARK.route)?{id:'99936297'}:{code:200,data:{task_id:123456}});
   return Response.json(url.includes('/api/v3/')?{id:'99936297',status:'succeeded',content:{video_url:'https://example.com/ark.mp4'},usage:{completion_tokens:42}}:{task_id:123456,is_final:true,state:'success',result_url:'https://example.com/media.mp4'});
  };
  const token=await signJwt({userId:'user'},f.env.JWT_SECRET);
  const request=(path,body)=>new Request('https://zora.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  for(const template of [LK_SEEDANCE_MEDIA,LK_SEEDANCE_ARK]){
   const body={...draft(template),kind:'video',requestId:'seedance-'+template.family+'-001'};
   for(let i=0;i<2;i++){const response=await worker.fetch(request('/api/generate',body),f.env,{});assert.equal(response.status,200);assert.equal((await response.json()).task.executor,template.family);}
   const response=await worker.fetch(request('/api/generation-tasks/'+body.requestId),f.env,{});assert.equal(response.status,200);
   const {task}=await response.json();assert.equal(task.status,'completed');assert.match(task.upstreams[0].url,template===LK_SEEDANCE_ARK?/ark.mp4/:/media.mp4/);
  }
  assert.equal(calls.filter(call=>call.method==='POST').length,2);
  assert.equal(f.balance(),930);
  f.sql.prepare("UPDATE server_models SET quota_cost_per_unit = 0 WHERE id = ?").run(LK_SEEDANCE_MEDIA.id);
  const unpriced=await worker.fetch(request('/api/generate',{...draft(LK_SEEDANCE_MEDIA),kind:'video',requestId:'seedance-unpriced-001'}),f.env,{});
  assert.equal(unpriced.status,409);
  assert.equal(calls.filter(call=>call.method==='POST').length,2);
  assert.equal(f.balance(),930);
 }finally{globalThis.fetch=original;f.sql.close();}
});
