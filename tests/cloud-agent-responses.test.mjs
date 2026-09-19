import test from 'node:test';
import assert from 'node:assert/strict';
import {agentResponses} from '../apps/cloudflare-worker/src/agent-responses.mjs';
import {sanitizeAgentReply} from '../apps/cloudflare-worker/src/proxy.mjs';
const env={DB:{prepare:()=>({bind:()=>({first:async()=>({id:'gpt-test',kind:'agent',enabled:1,provider:'custom'})})})}};
test('Responses preserves tools, images, tool results and SSE without exposing provider key',async()=>{
 const body={model:'gpt-test',stream:true,input:[{role:'user',content:[{type:'input_image',image_url:'data:image/png;base64,AA=='}]},{type:'function_call_output',call_id:'1',output:'done'}],tools:[{type:'function',name:'read_file',parameters:{type:'object'}}]};
 let billed=0;const response=await agentResponses(new Request('https://gateway/api/agent/v1/responses',{method:'POST',body:JSON.stringify(body)}),env,{
 authenticate:async()=>({user:{id:'u',quotaBalance:100}}),price:async()=>1,deduct:async()=>billed++,config:async()=>({apiKey:'provider-secret',baseUrl:'https://upstream/v1'}),fetch:async(url,options)=>{assert.equal(url,'https://upstream/v1/responses');assert.deepEqual(JSON.parse(options.body),body);assert.equal(options.headers.Authorization,'Bearer provider-secret');return new Response('data: {"type":"response.completed"}\n\n',{headers:{'Content-Type':'text/event-stream'}});}});
 assert.equal(billed,1);assert.match(response.headers.get('Content-Type'),/event-stream/);assert.match(await response.text(),/response.completed/);
});
test('unauthenticated requests cannot reach upstream',async()=>{
 let called=false;await assert.rejects(agentResponses(new Request('https://gateway',{method:'POST',body:'{}'}),env,{authenticate:async()=>{throw Error('401');},fetch:async()=>{called=true;}}),/401/);assert.equal(called,false);
});
test('ordinary API troubleshooting answer is not replaced with identity text',()=>{
 const answer='检查 OpenAI 接口的工具参数和错误码。';assert.equal(sanitizeAgentReply('帮我检查接口',answer),answer);assert.match(sanitizeAgentReply('你是谁',answer),/^我是zora agent/);
});
