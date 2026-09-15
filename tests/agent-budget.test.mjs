import test from 'node:test';
import assert from 'node:assert/strict';
import {runCodex} from '../apps/server/codex-agent.mjs';
import {getModels} from '../packages/duoyuanx/catalog.mjs';

test('Agent bounds output on both protocols and never retries quota failures',async()=>{
 const original=globalThis.fetch;
 const env={...process.env};
 process.env.ZORA_AGENT_API_KEY='mock-only';process.env.ZORA_AGENT_ENABLED='true';process.env.ZORA_AGENT_BACKEND='responses';
 try{
  for(const route of ['/v1/responses','/v1/chat/completions']){
   const model=getModels().find(m=>m.kind==='agent'&&m.route===route);assert(model);
   let calls=0;
   globalThis.fetch=async(url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.equal(body[route.endsWith('responses')?'max_output_tokens':'max_tokens'],4096);return {ok:false,status:400,json:async()=>({error:{message:'预扣费额度失败，用户剩余额度不足'}})};};
   await assert.rejects(runCodex('测试',{modelId:model.id}),/预扣/);assert.equal(calls,1);
  }
 }finally{globalThis.fetch=original;for(const key of ['ZORA_AGENT_API_KEY','ZORA_AGENT_ENABLED','ZORA_AGENT_BACKEND']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
