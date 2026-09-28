import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveProviderConfig} from '../apps/cloudflare-worker/src/proxy.mjs';
import {agentResponses} from '../apps/cloudflare-worker/src/agent-responses.mjs';
test('custom provider never borrows another provider key',async()=>{
 const config=await resolveProviderConfig({CUSTOM_BASE_URL:'https://newapi.example',DUOYUANX_API_KEY:'other-secret'},'custom');
 assert.equal(config.apiKey,'');assert.equal(config.baseUrl,'https://newapi.example');
});
test('custom provider uses its own environment credentials',async()=>{
 const config=await resolveProviderConfig({CUSTOM_BASE_URL:'https://newapi.example/',CUSTOM_API_KEY:'own-secret',DUOYUANX_API_KEY:'other-secret'},'custom');
 assert.equal(config.apiKey,'own-secret');assert.equal(config.baseUrl,'https://newapi.example');
});
const env={DB:{prepare:()=>({bind:()=>({first:async()=>({id:'tt-5.6-sol',kind:'agent',enabled:1,provider:'custom'})})})}};
function request(){const id='x'.repeat(551);return new Request('https://zora.example/api/agent/v1/responses',{method:'POST',body:JSON.stringify({model:'tt-5.6-sol',stream:true,input:[{type:'function_call',call_id:id,name:'read_file',arguments:'{}'},{type:'function_call_output',call_id:id,output:'done'}]})});}
function dependencies(fetch,baseUrl='https://newapi.example/v1'){return {authenticate:async()=>({user:{id:'u',quotaBalance:10}}),price:async()=>1,deduct:async()=>{},config:async()=>({apiKey:'own-secret',baseUrl}),fetch};}
test('New API forwarding normalizes paired IDs and preserves stream',async()=>{
 const response=await agentResponses(request(),env,dependencies(async(url,options)=>{
 assert.equal(url,'https://newapi.example/v1/responses');assert.equal(options.redirect,'manual');
 const body=JSON.parse(options.body);assert.equal(body.model,'tt-5.6-sol');assert.ok(body.input[0].call_id.length<=64);assert.equal(body.input[0].call_id,body.input[1].call_id);
 return new Response('data: {"type":"response.completed"}\n\n',{headers:{'Content-Type':'text/event-stream'}});
 }));assert.match(await response.text(),/response.completed/);
});
test('missing gateway URL never makes an upstream request',async()=>{
 await assert.rejects(agentResponses(request(),env,dependencies(()=>{throw Error('must not fetch');},'')),/Base/);
});
test('redirect is rejected before billing and never followed',async()=>{
 const deps=dependencies(async()=>new Response(null,{status:302,headers:{Location:'https://elsewhere.example'}}));
 deps.deduct=async()=>{throw Error('must not bill');};
 await assert.rejects(agentResponses(request(),env,deps),/重定向/);
});
