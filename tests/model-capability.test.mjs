import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {resolveModelCapability,publishModelCapability,assertConfiguredOperation} from '../packages/contracts/model-capability.mjs';
import {upsertServerModel,getServerModels} from '../apps/cloudflare-worker/src/billing.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';

test('new model uses configured template, shares public capability and actual request route',()=>{
 const model=publishModelCapability({id:'new-image',kind:'image',enabled:1,provider:'custom',route:'/v1/images/generations',capability:{version:1,template:'gpt-image',modes:['t2i','i2i'],ratios:['9:16'],resolutions:['2K'],maxCount:2}});
 const body={modelId:model.id,prompt:'产品图',ratio:'9:16',resolution:'2K',count:1,concurrency:1,videoMode:'t2i'};
 assert.equal(model.available,true);
 assertConfiguredOperation(model,body);
 assert.equal(validateDraft(body,id=>id===model.id?model:null).ok,true);
 const packed=packGenerateRequest(body,model);assert.equal(packed.path,model.capability.route);assert.equal(packed.body.model,'new-image');
 assert.throws(()=>assertConfiguredOperation(model,{...body,route:'/v1/videos'}),/覆盖/);
 assert.throws(()=>assertConfiguredOperation(model,{...body,videoMode:'ref'}),/模式/);
 assert.equal(publishModelCapability({id:'unknown',kind:'video'}).available,false);
 assert.throws(()=>resolveModelCapability({...model,capability:{version:99,template:'gpt-image'}}),/版本/);
 assert.throws(()=>resolveModelCapability({...model,route:'//evil.test'}),/路径/);
});
test('configuration saves transactionally with history, revision conflict and rollback by republishing',async()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
 sql.exec(fs.readFileSync('apps/cloudflare-worker/model-capabilities.sql','utf8'));
 const db={prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args);},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return sql.prepare(query).run(...args);}};},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 try{
  const model={id:'config-test',name:'配置测试',kind:'image',provider:'custom',route:'/v1/images/generations',capability:{version:1,template:'gpt-image',modes:['t2i'],maxCount:2},expectedRevision:0};
  const first=await upsertServerModel(db,model);assert.equal(first.capability.revision,1);
  assert.equal((await getServerModels(db)).find(m=>m.id===model.id).capability.maxCount,2);
  await assert.rejects(upsertServerModel(db,{...model,capability:{...model.capability,maxCount:1}}),/其他管理员/);
  await upsertServerModel(db,{...model,expectedRevision:1,capability:{...model.capability,maxCount:1}});
  const snapshot=JSON.parse(sql.prepare('SELECT snapshot_json FROM model_config_history WHERE model_id=? AND revision=1').get(model.id).snapshot_json);
  const restored=await upsertServerModel(db,{...snapshot,expectedRevision:2});assert.equal(restored.capability.revision,3);assert.equal(restored.maxCount,2);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM model_config_history').get().n,3);
 }finally{sql.close();}
});
