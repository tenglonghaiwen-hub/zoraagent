import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {prepareSeedanceAssets,querySeedanceAssets,resolveSeedanceReferences} from '../apps/cloudflare-worker/src/seedance-assets.mjs';
import {publishModelCapability} from '../packages/contracts/model-capability.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {createToolRunner,AGENT_TOOL_DEFS} from '../packages/agent/tools.mjs';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));sql.exec(fs.readFileSync('apps/cloudflare-worker/seedance-assets.sql','utf8'));
 const model={id:'test-seedance',kind:'video',enabled:1,provider:'duoyuanx',route:'/v1/videos',capability:{version:1,template:'seedance',assetWorkflow:'seedance-library-v1'}};
 sql.prepare('INSERT INTO server_models (id,name,kind,provider,route,enabled,config,created_at,updated_at,quota_cost_per_unit) VALUES (?,?,?,?,?,?,?,?,?,?)').run(model.id,'test','video',model.provider,model.route,1,JSON.stringify(model.capability),0,0,1);
 const DB={prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args);},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:r.changes}};}};}};
 const user={id:'u'},body={requestId:'seedance-request-0001',modelId:model.id,references:[{name:'参考',type:'image/png',contentUrl:'https://media.example.com/a.png'}]};
 const calls=[];let active=false;
 const deps={config:async()=>({apiKey:'never-expose',baseUrl:'https://provider.example.com'}),fetch:async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return Response.json({state:1,data:url.endsWith('CreateAssetGroup')?{Id:'group-1'}:url.endsWith('CreateAsset')?{Id:'asset-1',task_id:'task-1'}:{Id:'asset-1',Status:active?'Active':'Processing'},error:null});
 }};
 return {sql,env:{DB},user,body,deps,calls,model,activate:()=>{active=true;}};
}
test('asset group/import/poll persist, isolate accounts, reject changed source, and pack asset reference only when Active',async()=>{
 const f=setup();try{
  let receipt=await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);assert.equal(receipt.status,'preparing');
  receipt=await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);assert.equal(receipt.status,'processing');
  const input={...f.body,assetReceiptId:f.body.requestId,prompt:'walk',ratio:'9:16',resolution:'720P',duration:5,count:1,videoMode:'ref'};
  await assert.rejects(resolveSeedanceReferences(input,f.user,f.env,f.deps),/审核/);
  receipt=await querySeedanceAssets(f.body.requestId,f.user,f.env,f.deps);assert.equal(receipt.status,'processing');
  f.activate();receipt=await querySeedanceAssets(f.body.requestId,f.user,f.env,f.deps);assert.equal(receipt.status,'ready');
  await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);assert.equal(f.calls.filter(c=>c.url.endsWith('CreateAsset')).length,1);
  const resolved=await resolveSeedanceReferences(input,f.user,f.env,f.deps);assert.equal(resolved.references[0].contentUrl,'asset://asset-1');
  const packed=packGenerateRequest(resolved,publishModelCapability(f.model));assert(JSON.stringify(packed).includes('asset://asset-1'));assert(!JSON.stringify(receipt).includes('never-expose'));
  await assert.rejects(querySeedanceAssets(f.body.requestId,{id:'other'},f.env,f.deps),/未找到/);
  await assert.rejects(resolveSeedanceReferences({...input,references:[{...input.references[0],contentUrl:'https://media.example.com/new.png'}]},f.user,f.env,f.deps),/更换/);
 }finally{f.sql.close();}
});
test('lost mutation response stays unknown and concurrent preparation cannot duplicate creation',async()=>{
 const f=setup();try{
  let count=0;f.deps.fetch=async()=>{count++;throw Error('连接中断');};
  const receipts=await Promise.all([prepareSeedanceAssets(f.body,f.user,f.env,f.deps),prepareSeedanceAssets(f.body,f.user,f.env,f.deps)]);
  assert(receipts.some(r=>r.status==='unknown'));await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);assert.equal(count,1);
  await assert.rejects(prepareSeedanceAssets({...f.body,references:[{...f.body.references[0],contentUrl:'https://127.0.0.1/a'}]},f.user,f.env,f.deps),/公网/);
 }finally{f.sql.close();}
});
test('inline file is uploaded without bearer credential on storage and never stored in D1',async()=>{
 const f=setup();try{
  f.body.references[0].contentUrl='data:image/png;base64,YQ==';const original=f.deps.fetch;
  f.deps.fetch=async(url,options)=>{
   if(url.endsWith('/v1/file/upload'))return Response.json({upload_url:'https://storage.example.com/upload',download_url:'https://storage.example.com/download'});
   if(url==='https://storage.example.com/upload'){assert(!options.headers.Authorization);assert.equal(options.body.length,1);return new Response('');}
   return original(url,options);
  };
  await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);
  const receipt=await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);assert.equal(receipt.status,'processing');
  assert(!f.sql.prepare('SELECT state_json FROM seedance_asset_receipts').get().state_json.includes('base64'));
 }finally{f.sql.close();}
});
test('restart after inflight creation never recreates; audit failure and transient query errors remain visible',async()=>{
 const f=setup();try{
  await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);
  const row=f.sql.prepare('SELECT state_json FROM seedance_asset_receipts').get();const interrupted=JSON.parse(row.state_json);interrupted.inflight='asset-0';
  f.sql.prepare('UPDATE seedance_asset_receipts SET state_json=?').run(JSON.stringify(interrupted));
  const result=await prepareSeedanceAssets(f.body,f.user,f.env,f.deps);assert.equal(result.status,'unknown');assert.equal(f.calls.length,1);
  const body={...f.body,requestId:'seedance-request-0002'};
  await prepareSeedanceAssets(body,f.user,f.env,f.deps);await prepareSeedanceAssets(body,f.user,f.env,f.deps);
  f.deps.fetch=async()=>{throw Error('查询暂时断开');};
  const retry=await querySeedanceAssets(body.requestId,f.user,f.env,f.deps);assert.equal(retry.status,'processing');assert.match(retry.error,/暂时断开/);assert.equal(retry.assets[0].taskId,'task-1');
  f.deps.fetch=async()=>Response.json({state:1,data:{Id:'asset-1',Status:'Failed',Error:'审核未通过'}});
  const failed=await querySeedanceAssets(body.requestId,f.user,f.env,f.deps);assert.equal(failed.status,'failed');assert.equal(failed.error,'审核未通过');
 }finally{f.sql.close();}
});
test('Agent reuses preparation identity and forwards asset receipt with original references',async()=>{
 const f=setup();try{
  const calls=[];const run=createToolRunner({mediaModels:[publishModelCapability(f.model)],references:f.body.references,conversationId:'c',messageId:'m',callApi:async req=>{calls.push(req);return {ok:true,status:200,data:{task:{id:'generated'}}};}});
  await run('prepare_seedance_assets',{modelId:f.model.id});await run('prepare_seedance_assets',{modelId:f.model.id});assert.equal(calls[0].body.requestId,calls[1].body.requestId);
  const result=await run('submit_generation',{modelId:f.model.id,assetReceiptId:f.body.requestId,prompt:'walk',ratio:'9:16',resolution:'720P',duration:5,videoMode:'ref'});
  assert.equal(result.ok,true);assert.equal(calls.at(-1).body.assetReceiptId,f.body.requestId);assert.equal(calls.at(-1).body.references[0].contentUrl,f.body.references[0].contentUrl);
  assert(AGENT_TOOL_DEFS.find(t=>t.name==='submit_generation').parameters.properties.assetReceiptId);
 }finally{f.sql.close();}
});
