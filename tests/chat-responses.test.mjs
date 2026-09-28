import test from 'node:test';
import assert from 'node:assert/strict';
import {toChat,chatJson,chatStream} from '../apps/cloudflare-worker/src/chat-responses.mjs';
import {agentResponses} from '../apps/cloudflare-worker/src/agent-responses.mjs';
import {proxyChat,proxyGeneration} from '../apps/cloudflare-worker/src/proxy.mjs';
import {publishModelCapability} from '../packages/contracts/model-capability.mjs';
import {toClaude,claudeJson} from '../apps/cloudflare-worker/src/claude-responses.mjs';

test('client tool search round trips through both bridges and exposes discovered tools',async()=>{
 const search={type:'tool_search',execution:'client',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}};
 for(const convert of [toChat,toClaude]){
  const first=convert({model:'gpt-5.5',input:'hi',tools:[search]});
  const alias=[...first.names.keys()][0];
  const result=claudeJson({type:'message',content:[{type:'tool_use',id:'search-1',name:alias,input:{query:'files'}}]},first.names).output[0];
  assert.equal(result.type,'tool_search_call');assert.equal(result.execution,'client');assert.deepEqual(result.arguments,{query:'files'});
  const discovered={type:'namespace',name:'files',tools:[{type:'function',name:'read',parameters:{type:'object'}}]};
  const next=convert({model:'gpt-5.5',tools:[search,discovered],input:[{role:'user',content:'find files'},result,{type:'tool_search_output',call_id:'search-1',execution:'client',status:'completed',tools:[discovered]}]});
  assert.equal(next.names.size,2);assert.ok([...next.names.values()].some(x=>x.name==='read'&&x.namespace==='files'));
  assert.throws(()=>convert({input:'x',tools:[{...search,execution:'server'}]}),/服务端工具搜索/);
 }
 const {request,names}=toChat({model:'gpt-5.5',input:'hi',tools:[search]});
 const data={choices:[{delta:{tool_calls:[{index:0,id:'s',function:{name:request.tools[0].function.name,arguments:'{"query":"files"}'}}]},finish_reason:'tool_calls'}]};
 const stream=await new Response(chatStream(new Response('data: '+JSON.stringify(data)+'\n\ndata: [DONE]\n\n').body,names)).text();
 assert.match(stream,/tool_search_call/);assert.match(stream,/"execution":"client"/);
});

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


test('hosted web search history survives switching to Chat and Messages without replay',()=>{
 for(const convert of [toChat,toClaude])for(const status of ['completed','failed','in_progress',undefined]){
  const input=[{role:'user',content:'查找说明'},
   {type:'web_search_call',id:'ws_1',status,action:{type:'search',queries:['Piper 文档'],sources:[{type:'url',url:'https://example.com/docs'}]}},
   {type:'web_search_call',id:'ws_2',status:'completed',action:{type:'open_page',url:'https://example.com/docs'}},
   {type:'web_search_call',id:'ws_3',status:'completed',action:{type:'find_in_page',url:'https://example.com/docs',pattern:'text'}},
   {role:'assistant',content:[{type:'output_text',text:'历史回答和引用 https://example.com/docs',annotations:[]}]},
   {role:'user',content:'现在用本地 Piper 配音'}];
  const before=structuredClone(input);
  const {request}=convert({model:'test',input,tools:[{type:'web_search'}]});
  const history=JSON.stringify(request.messages);
  assert.match(history,/Piper 文档/);assert.match(history,/open_page/);assert.match(history,/find_in_page/);
  assert.match(history,/历史回答和引用/);assert.match(history,/现在用本地 Piper 配音/);
  assert.match(history,/没有正文时不能推断搜索结果/);
  assert.equal(request.tools,undefined);assert(!history.includes('tool_use'));assert(!history.includes('tool_calls'));
  assert.deepEqual(input,before);
 }
 for(const convert of [toChat,toClaude]){
  assert.doesNotThrow(()=>convert({input:[{type:'web_search_call'},{role:'user',content:'继续'}]}));
  assert.throws(()=>convert({input:[{type:'unknown_call'}]}),/不支持此会话项/);
 }
});


test('gateway forwards a resumed web-search conversation through either configured protocol',async()=>{
 for(const route of ['/v1/chat/completions','/v1/messages']){
  let calls=0;
  const env={DB:{prepare:()=>({bind:()=>({first:async()=>({id:'m',kind:'agent',enabled:1,route})})})}};
  const deps={authenticate:async()=>({user:{id:'u',quotaBalance:10}}),price:async()=>1,deduct:async()=>{},config:async()=>({apiKey:'fixture',baseUrl:'https://example.com/v1'}),fetch:async(url,options)=>{
   calls++;assert.equal(url,'https://example.com'+route);
   const body=JSON.parse(options.body);assert.match(JSON.stringify(body.messages),/历史网页搜索记录/);
   assert.match(JSON.stringify(body.messages),/继续配音/);
   return Response.json(route==='/v1/messages'?{type:'message',id:'r',content:[{type:'text',text:'继续处理'}],stop_reason:'end_turn'}:{id:'r',choices:[{finish_reason:'stop',message:{content:'继续处理'}}]});
  }};
  const request=new Request('https://local/',{method:'POST',body:JSON.stringify({model:'m',input:[{role:'user',content:'查文档'},{type:'web_search_call',status:'completed',action:{type:'search',query:'Piper'}},{role:'user',content:'继续配音'}]})});
  const result=await (await agentResponses(request,env,deps)).json();
  assert.equal(calls,1);assert.equal(result.output[0].content[0].text,'继续处理');
 }
});


test('removed history tools and missing outputs remain context without executable calls',()=>{
 for(const convert of [toChat,toClaude]){
  const input=[{role:'user',content:'继续'}, {type:'function_call',name:'local_runtime_status',call_id:'old',arguments:'{}'},{type:'function_call_output',call_id:'old',output:'{"status":"pending"}'},{type:'custom_tool_call',name:'removed',call_id:'missing',input:'data'},{type:'function_call_output',call_id:'orphan',output:'old output'}];
  const before=structuredClone(input);const {request,names}=convert({input,tools:[]});const text=JSON.stringify(request.messages);
  assert.match(text,/local_runtime_status/);assert.match(text,/pending/);assert.match(text,/未取得结果/);assert.match(text,/old output/);assert.doesNotMatch(text,/tool_use|tool_result|tool_calls/);assert.equal(names.size,0);assert.deepEqual(input,before);
  assert.throws(()=>convert({input:'new',tools:[],tool_choice:{type:'function',name:'removed'}}),/不可用/);
 }
});
test('removed history coexists with currently callable tools and namespace stays exact',()=>{
 for(const convert of [toChat,toClaude]){
  const {request,names}=convert({tools:[{type:'function',name:'lookup',parameters:{type:'object'}}],input:[{type:'function_call',name:'lookup',namespace:'old_namespace',call_id:'old',arguments:'{}'},{type:'function_call_output',call_id:'old',output:'old result'},{type:'function_call',name:'lookup',call_id:'new',arguments:'{}'},{type:'function_call_output',call_id:'new',output:'new result'},{role:'user',content:'继续'}]});
  assert.equal(names.size,1);const text=JSON.stringify(request.messages);assert.match(text,/历史工具调用/);assert.match(text,/old result/);assert.match(text,/tool_use|tool_calls/);assert.match(text,/new result/);
 }
});
