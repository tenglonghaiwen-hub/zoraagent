import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {previewH3Task,submitH3Task,queryH3Task} from '../apps/cloudflare-worker/src/h3-tasks.mjs';
import {packH3Operation} from '../packages/duoyuanx/h3-operations.mjs';
import {publishModelCapability} from '../packages/contracts/model-capability.mjs';
import {createToolRunner,AGENT_TOOL_DEFS} from '../packages/agent/tools.mjs';
import {isAllowedAgentApi} from '../packages/agent/api.mjs';
import {applyGenerationReceipt} from '../apps/client/agent-generation-tasks.js';
import {createMediaDelegator,MAIN_AGENT_TOOL_DEFS} from '../packages/agent/media-subagents.mjs';
import worker from '../apps/cloudflare-worker/src/index.mjs';
import {signJwt} from '../apps/cloudflare-worker/src/auth.mjs';

function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
 sql.prepare('INSERT INTO users (id,email,password_hash,quota_balance,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('user','test@example.com','test',1000,0,0);
 const capability={version:1,template:'minimax',resolutions:['768P','2K'],h3OperationCosts:{enhance:3,remix:20}};
 sql.prepare("UPDATE server_models SET provider='duoyuanx',route='/v2/video_generation',query_route='/v2/query/video_generation/{task_id}',config=?,quota_cost_per_unit=10 WHERE id='MiniMax-H3'").run(JSON.stringify(capability));
 const DB={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values);},exec(){const result=sql.prepare(query).run(...values);return {meta:{changes:result.changes}};},async run(){return this.exec();}};},async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>s.exec());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 const calls=[];
 const deps={config:async()=>({apiKey:'test-secret',baseUrl:'https://upstream.example.com'}),fetch:async(url,options)=>{calls.push({url,method:options.method,body:options.body?JSON.parse(options.body):undefined});return Response.json(options.method==='POST'?{task_id:'upstream-'+calls.length}:{task:{id:url.split('/').pop(),status:'succeeded',content:{prompt:'增强后的提示词',url:'https://media.example.com/video.mp4'}}});}};
 const body={modelId:'MiniMax-H3',requestId:'h3-request-test-0001',h3Operation:'enhance',expectedCost:3,prompt:'小猫散步',duration:5,ratio:'16:9',references:[]};
 return {sql,env:{DB},user:{id:'user',quotaBalance:1000},deps,body,calls,balance:()=>sql.prepare("SELECT quota_balance FROM users WHERE id='user'").get().quota_balance,model:()=>publishModelCapability(sql.prepare("SELECT * FROM server_models WHERE id='MiniMax-H3'").get())};
}

test('H3 enhancement preview does not charge; submit/poll restores text with exactly one reservation',async()=>{
 const f=fixture();try{
  assert.equal((await previewH3Task(f.body,f.user,f.env,f.deps)).cost,3);assert.equal(f.calls.length,0);assert.equal(f.balance(),1000);
  const {task}=await submitH3Task(f.body,f.user,f.env,f.deps);assert.equal(task.outputKind,'text');assert.equal(task.status,'running');assert.equal(f.balance(),997);
  assert(f.calls[0].url.endsWith('/v2/h3_context_ir'));assert(!('resolution' in f.calls[0].body));
  await submitH3Task(f.body,f.user,f.env,f.deps);assert.equal(f.calls.length,1);assert.equal(f.balance(),997);
  const completed=await queryH3Task(task.id,f.user,f.env,f.deps);assert.equal(completed.enhancedPrompt,'增强后的提示词');assert.equal(completed.status,'completed');assert.equal(completed.billing,'charged');assert(!completed.upstreams[0].url);
  assert.equal(await queryH3Task(task.id,{id:'other'},f.env,f.deps),null);
  assert(!JSON.stringify(completed).includes('test-secret'));
 }finally{f.sql.close();}
});
test('generation to source-task remix uses owned upstream id, fixed 2K and displayable persistent video receipt',async()=>{
 const f=fixture();try{
  const generated=await submitH3Task({...f.body,h3Operation:'generate',resolution:'768P'},f.user,f.env,f.deps);
  assert.equal(applyGenerationReceipt({},generated.task).genPending,true);
  await queryH3Task(generated.task.id,f.user,f.env,f.deps);
  const body={modelId:'MiniMax-H3',h3Operation:'remix',expectedCost:20,requestId:'h3-remix-task-0001',sourceReceiptId:generated.task.id};
  const remixed=await submitH3Task(body,f.user,f.env,f.deps);
  const sent=f.calls.find(c=>c.url.endsWith('/v2/video_regeneration'));
  assert.deepEqual(sent.body,{model:'MiniMax-H3',source_task_id:generated.task.upstreamTaskId,resolution:'2K',aigc_watermark:false});
  const complete=await queryH3Task(remixed.task.id,f.user,f.env,f.deps);assert.equal(applyGenerationReceipt({},complete).genStatus,'已完成');assert.equal(f.balance(),970);
  await assert.rejects(submitH3Task({...body,requestId:'h3-remix-task-0002'},{id:'other'},f.env,f.deps),/此账号/);
 }finally{f.sql.close();}
});
test('source-video remix packs text/video only and rejects invalid overrides or mixed input',()=>{
 const f=fixture();try{
  const body={h3Operation:'remix',prompt:'调整动作',references:[{type:'video/mp4',contentUrl:'https://media.example.com/source.mp4'}]};
  const packed=packH3Operation(body,f.model());assert.equal(packed.body.resolution,'2K');assert.equal(packed.body.content[1].type,'video_url');assert(!('ratio' in packed.body));
  for(const extra of [{ratio:'9:16'},{duration:5},{resolution:'768P'},{source_task_id:'guessed'},{apiRoute:'/malicious'}])assert.throws(()=>packH3Operation({...body,...extra},f.model()));
  assert.throws(()=>packH3Operation(body,f.model(),'task-source'),/二选一/);
 }finally{f.sql.close();}
});
test('timeout/missing task id/concurrent duplicate submit never replay paid upstream call',async()=>{
 const f=fixture();try{
  f.deps.fetch=async()=>{f.calls.push({});throw Error('timeout');};
  const results=await Promise.all([submitH3Task(f.body,f.user,f.env,f.deps),submitH3Task(f.body,f.user,f.env,f.deps)]);
  assert(results.some(r=>r.task.status==='unknown'));assert.equal(f.calls.length,1);
  await submitH3Task(f.body,f.user,f.env,f.deps);assert.equal(f.calls.length,1);assert.equal(f.balance(),997);
  await assert.rejects(submitH3Task({...f.body,prompt:'different'},f.user,f.env,f.deps),/其他参数/);
  f.deps.fetch=async()=>Response.json({});
  assert.equal((await submitH3Task({...f.body,requestId:'h3-missing-id-0001'},f.user,f.env,f.deps)).task.status,'unknown');
 }finally{f.sql.close();}
});
test('upstream rejection and failed query refund once; insufficient balance never submits',async()=>{
 const f=fixture();try{
  f.deps.fetch=async()=>Response.json({message:'rejected'},{status:400});
  assert.equal((await submitH3Task(f.body,f.user,f.env,f.deps)).task.status,'failed');assert.equal(f.balance(),1000);
  await submitH3Task(f.body,f.user,f.env,f.deps);assert.equal(f.balance(),1000);
  f.deps.fetch=async(url,opt)=>Response.json(opt.method==='POST'?{task_id:'failed-task'}:{task:{id:'failed-task',status:'failed',error:{message:'失败原因'}}});
  const body={...f.body,requestId:'h3-failed-poll-0001'};await submitH3Task(body,f.user,f.env,f.deps);
  const task=await queryH3Task(body.requestId,f.user,f.env,f.deps);assert.equal(task.status,'failed');assert.equal(task.pollError,'失败原因');assert.equal(f.balance(),1000);
  await queryH3Task(body.requestId,f.user,f.env,f.deps);assert.equal(f.balance(),1000);
  f.sql.exec("UPDATE users SET quota_balance=0");let called=false;f.deps.fetch=async()=>{called=true;throw Error('must not call');};
  await submitH3Task({...f.body,requestId:'h3-no-funds-00001'},f.user,f.env,f.deps);assert.equal(called,false);assert.equal(f.balance(),0);
 }finally{f.sql.close();}
});
test('route snapshot blocks changed host; transient/mismatched query cannot erase original task',async()=>{
 const f=fixture();try{
  await submitH3Task(f.body,f.user,f.env,f.deps);
  f.deps.config=async()=>({apiKey:'key',baseUrl:'https://changed.example.com'});
  assert.match((await queryH3Task(f.body.requestId,f.user,f.env,f.deps)).pollError,/地址已变更/);assert.equal(f.calls.length,1);
  f.deps.config=async()=>({apiKey:'key',baseUrl:'https://upstream.example.com'});
  f.deps.fetch=async()=>Response.json({task:{id:'wrong',status:'succeeded',content:{prompt:'wrong'}}});
  const result=await queryH3Task(f.body.requestId,f.user,f.env,f.deps);assert.equal(result.upstreamTaskId,'upstream-1');assert.match(result.pollError,/其他任务/);
 }finally{f.sql.close();}
});
test('operation pricing is explicit; v1 model cannot call v2 tools; tool preview and queries do not generate',async()=>{
 const f=fixture();try{
  assert.equal(f.model().agentOperations.find(o=>o.operation==='enhance').enabled,true);
  f.sql.prepare("UPDATE server_models SET config=? WHERE id='MiniMax-H3'").run(JSON.stringify({version:1,template:'minimax'}));
  await assert.rejects(previewH3Task(f.body,f.user,f.env,f.deps),/价格/);
  f.sql.prepare("UPDATE server_models SET route='/v1/videos',query_route='/v1/videos/{task_id}',config=? WHERE id='MiniMax-H3'").run(JSON.stringify({version:1,template:'minimax-openai'}));
  await assert.rejects(previewH3Task(f.body,f.user,f.env,f.deps),/官方格式/);
  const calls=[],generationTasks=[];
  const run=createToolRunner({conversationId:'c',messageId:'m',generationTasks,references:[{type:'image/png',contentUrl:'https://media.example.com/a.png'},{type:'video/mp4',contentUrl:'https://media.example.com/a.mp4'}],callApi:async args=>{calls.push(args);return {ok:true,data:{}};}});
  await run('remix_video',{modelId:'MiniMax-H3',prompt:'修改视频',referenceIndexes:[2],preview:true});assert.equal(calls[0].path,'/api/h3/preview');assert.equal(calls[0].body.references.length,1);assert.equal(calls[0].body.references[0].type,'video/mp4');assert.equal(generationTasks.length,0);
  await run('query_h3_task',{requestId:'h3-request-test-0001'});assert.equal(calls[1].method,'GET');
  assert(isAllowedAgentApi('POST','/api/h3/tasks'));assert(!isAllowedAgentApi('POST','/api/h3/anything'));
  assert(AGENT_TOOL_DEFS.some(t=>t.name==='enhance_video_prompt'));
 }finally{f.sql.close();}
});

test('video Agent receives H3 tools and routes instruction-selected preview through shared runner',async()=>{
 const f=fixture();try{
  const calls=[];
  assert(!MAIN_AGENT_TOOL_DEFS.some(t=>t.name==='remix_video'));
  assert(MAIN_AGENT_TOOL_DEFS.some(t=>t.name==='query_h3_task'));
  const delegator=createMediaDelegator({mediaModels:[f.model()],generationTasks:[],sharedRunner:async(name,args)=>{calls.push({name,args});return {ok:true,data:{cost:3}};},run:async(prompt,options)=>{
   assert(options.tools.some(t=>t.name==='enhance_video_prompt'));assert(options.tools.some(t=>t.name==='remix_video'));
   assert(prompt.includes('先理解用户指令'));
   await options.toolRunner('enhance_video_prompt',{modelId:'MiniMax-H3',prompt:'猫',duration:5,preview:true});
   return {reply:'预览报价',tasks:[]};
  }});
  const result=await delegator('delegate_media_task',{kind:'video',task:'只优化视频提示词，先报价，不生成'});
  assert(result.ok);assert.equal(calls.length,1);assert.equal(calls[0].name,'enhance_video_prompt');assert.equal(calls[0].args.preview,true);
 }finally{f.sql.close();}
});

test('HTTP auth -> H3 submission -> generic receipt recovery -> client video result, without real upstream',async()=>{
 const f=fixture(),original=globalThis.fetch;try{
  const env={...f.env,JWT_SECRET:'isolated-test-secret',DUOYUANX_API_KEY:'test-key',DUOYUANX_BASE_URL:'https://upstream.example.com'};
  globalThis.fetch=f.deps.fetch;
  const token=await signJwt({userId:'user'},env.JWT_SECRET,3600);
  const request=(path,body)=>new Request('https://zora.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await worker.fetch(new Request('https://zora.test/api/h3/tasks/x'),env,{})).status,401);
  const submitted=await worker.fetch(request('/api/generate',{...f.body,h3Operation:undefined,kind:'video',resolution:'768P'}),env,{});
  assert.equal(submitted.status,200);const data=await submitted.json();assert.equal(data.task.id,f.body.requestId);
  const recovered=await worker.fetch(request('/api/generation-tasks/'+data.task.id),env,{});assert.equal(recovered.status,200);
  const {task}=await recovered.json();assert.equal(task.status,'completed');assert.equal(applyGenerationReceipt({},task).genUrl,'https://media.example.com/video.mp4');
 }finally{globalThis.fetch=original;f.sql.close();}
});

test('stale quote is rejected before reservation, new requests use updated price',async()=>{
 const f=fixture();try{
  const config={version:1,template:'minimax',h3OperationCosts:{enhance:5,remix:5}};
  f.sql.prepare("UPDATE server_models SET config=? WHERE id='MiniMax-H3'").run(JSON.stringify(config));
  await assert.rejects(submitH3Task(f.body,f.user,f.env,f.deps),/价格变化/);assert.equal(f.calls.length,0);assert.equal(f.balance(),1000);
  await submitH3Task({...f.body,expectedCost:5},f.user,f.env,f.deps);assert.equal(f.balance(),995);
 }finally{f.sql.close();}
});
