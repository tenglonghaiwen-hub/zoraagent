import test from 'node:test';
import assert from 'node:assert/strict';
import {toChat,chatJson,chatStream} from '../apps/cloudflare-worker/src/chat-responses.mjs';
import {agentResponses} from '../apps/cloudflare-worker/src/agent-responses.mjs';
import {proxyChat,proxyGeneration} from '../apps/cloudflare-worker/src/proxy.mjs';
import {publishModelCapability} from '../packages/contracts/model-capability.mjs';

test('legacy chat and media proxy send the configured protocol and preserve cancellation',async()=>{
 const original=globalThis.fetch;const env={CUSTOM_API_KEY:'test',CUSTOM_BASE_URL:'https://example.com/v1'};
 try{
  for(const route of ['/v1/messages','/v1/responses','/v1/chat/completions']){
   globalThis.fetch=async(url,options)=>{assert.equal(url,'https://example.com'+route);const body=JSON.parse(options.body);assert.equal(body.model,'test-model');assert(route==='/v1/responses'?body.input:body.messages);return Response.json(route==='/v1/messages'?{content:[{type:'text',text:'yes'}]}:route==='/v1/responses'?{output:[{content:[{type:'output_text',text:'yes'}]}]}:{choices:[{message:{content:'yes'}}]});};
   assert.equal((await proxyChat({body:{model:'test-model',message:'hello'},env,provider:'custom',route})).reply,'yes');
  }
  const model=publishModelCapability({id:'new-model',kind:'image',provider:'custom',route:'/custom/images',capability:{version:1,template:'gpt-image'}});
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://example.com/custom/images');const body=JSON.parse(options.body);assert.equal(body.n,2);assert.equal(body.model,'new-model');assert(!('modelId' in body));return Response.json({data:[{url:'https://example.com/result.png'}]});};
  await proxyGeneration({body:{model:'new-model',prompt:'product',count:2,ratio:'1:1',resolution:'1K'},env,provider:'custom',route:model.route,modelInfo:model});
 }finally{globalThis.fetch=original;}
 let canceled=false;
 const source=new ReadableStream({cancel(){canceled=true;}});
 const stream=chatStream(source,new Map());await stream.cancel();assert(canceled);
});

test('fragmented Chat tool arguments become one complete executable call',async()=>{
 const {request,names}=toChat({model:'m',input:'hi',tools:[{type:'function',name:'lookup',parameters:{type:'object'}}]});
 const name=request.tools[0].function.name;
 const chunks=[{id:'r',model:'m',choices:[{delta:{tool_calls:[{index:0,id:'c',function:{name,arguments:'{"q":'}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{arguments:'"ok"}'}}]},finish_reason:'tool_calls'}]}];
 const text=chunks.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n';
 const result=await new Response(chatStream(new Response(text).body,names)).text();
 const events=result.split('\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)));
 const completed=events.find(x=>x.type==='response.completed');assert(completed);assert.equal(completed.response.output.length,1);assert.equal(completed.response.output[0].name,'lookup');assert.equal(JSON.parse(completed.response.output[0].arguments).q,'ok');
});
test('Chat bridge preserves tools, tool outputs, images and omits hidden reasoning',()=>{
 const body={model:'chat-test',input:[{role:'user',content:[{type:'input_image',image_url:'https://example.com/a.png'}]},{type:'function_call',call_id:'call-1',name:'lookup',arguments:'{"q":"x"}'},{type:'function_call_output',call_id:'call-1',output:'found'}],tools:[{type:'function',name:'lookup',parameters:{type:'object'}}]};
 const {request,names}=toChat(body);assert.equal(request.messages[0].content[0].type,'image_url');assert.equal(request.messages.at(-1).role,'tool');
 const alias=request.tools[0].function.name;
 const result=chatJson({id:'r',model:'chat-test',choices:[{finish_reason:'tool_calls',message:{reasoning_content:'secret',tool_calls:[{id:'call-2',function:{name:alias,arguments:'{"q":"y"}'}}]}}]},names);
 assert.equal(result.output[0].name,'lookup');assert(!JSON.stringify(result).includes('secret'));
});
test('Chat streaming handles fragmented events and rejects interrupted completion',async()=>{
 const {names}=toChat({model:'m',input:'hi'});
 const events=[{id:'r',model:'m',choices:[{delta:{content:'你好'}}]},{choices:[{delta:{},finish_reason:'stop'}]},{choices:[],usage:{prompt_tokens:3,completion_tokens:2}}];
 const bytes=new TextEncoder().encode(events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join('')+'data: [DONE]\r\n\r\n');
 const source=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}});
 const result=await new Response(chatStream(source,names)).text();assert.match(result,/response.completed/);assert.match(result,/你好/);
 const interrupted=new Response('data: '+JSON.stringify(events[0])+'\n\n').body;
 const failed=await new Response(chatStream(interrupted,names)).text();
 assert.match(failed,/response.failed/);assert.match(failed,/提前中断/);assert.doesNotMatch(failed,/response.completed/);
});
test('Agent sends configured Chat route and rejects unsupported route before upstream',async()=>{
 let route='/v1/chat/completions',calls=0;
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>({id:'m',kind:'agent',enabled:1,route})})})}};
 const deps={authenticate:async()=>({user:{id:'u',quotaBalance:10}}),price:async()=>1,deduct:async()=>{},config:async()=>({apiKey:'test',baseUrl:'https://example.com/v1'}),fetch:async(url,options)=>{calls++;assert.equal(url,'https://example.com/v1/chat/completions');assert(JSON.parse(options.body).messages);return Response.json({id:'r',choices:[{finish_reason:'stop',message:{content:'ok'}}]});}};
 const request=()=>new Request('https://local/',{method:'POST',body:JSON.stringify({model:'m',input:'hello'})});
 assert.equal((await (await agentResponses(request(),env,deps)).json()).output[0].content[0].text,'ok');
 route='/unsupported';await assert.rejects(agentResponses(request(),env,deps),/模板/);assert.equal(calls,1);
});
