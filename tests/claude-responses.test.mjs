import test from 'node:test';
import assert from 'node:assert/strict';
import {toClaude,claudeJson,claudeStream} from '../apps/cloudflare-worker/src/claude-responses.mjs';
import {agentResponses} from '../apps/cloudflare-worker/src/agent-responses.mjs';
const tools=[{type:'function',name:'read_file',parameters:{type:'object'}},{type:'namespace',name:'functions',tools:[{type:'custom',name:'apply_patch'}]}];
const encode = events => events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join('');
const events = (block,delta,reason='end_turn') => [{type:'message_start',message:{id:'msg_test',model:'claude-test',usage:{input_tokens:3}}},{type:'content_block_start',index:0,content_block:block},{type:'content_block_delta',index:0,delta},{type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:reason},usage:{output_tokens:4}},{type:'message_stop'}];
async function translate(list,names=new Map()) {
 const bytes=new TextEncoder().encode(encode(list));let offset=0;
 const stream=new ReadableStream({pull(c){if(offset===bytes.length)c.close();else c.enqueue(bytes.slice(offset,offset=Math.min(bytes.length,offset+7)));}});
 return (await new Response(claudeStream(stream,names)).text()).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
}
test('Claude maps system, images, namespace/custom calls and tool results',()=>{
 const converted=toClaude({model:'claude-test',instructions:'policy',tools,input:[{role:'developer',content:'extra'},{role:'user',content:[{type:'input_image',image_url:'data:image/png;base64,AA=='}]},{type:'custom_tool_call',name:'apply_patch',namespace:'functions',call_id:'c1',input:'patch'},{type:'custom_tool_call_output',call_id:'c1',output:'done'}],text:{format:{type:'json_schema',schema:{type:'object'}}}});
 assert.equal(converted.request.system.length,2);assert.equal(converted.request.messages[0].content[0].source.type,'base64');
 assert.deepEqual(converted.request.messages[1].content[0],{type:'tool_use',id:'c1',name:'tool_1',input:{input:'patch'}});
 assert.equal(converted.request.messages[2].content[0].tool_use_id,'c1');assert.equal(converted.request.output_config.format.type,'json_schema');
 assert.throws(()=>toClaude({tools:[{type:'unsupported'}]}),/不支持/);
 assert.throws(()=>toClaude({previous_response_id:'old'}),/完整会话/);
 assert.equal(toClaude({tools:[{type:'web_search'},...tools]}).request.tools.length,2);
});
test('Claude UTF8/chunked SSE produces native Responses text and usage',async()=>{
 const result=await translate(events({type:'text',text:''},{type:'text_delta',text:'中文测试'}));
 assert.equal(result.at(-1).type,'response.completed');assert.equal(result.at(-1).response.output[0].content[0].text,'中文测试');assert.equal(result.at(-1).response.usage.total_tokens,7);
});
test('Claude tool SSE round-trips call id and namespace into tool result',async()=>{
 const {names}=toClaude({tools});
 const result=await translate(events({type:'tool_use',id:'call_1',name:'tool_1',input:{}},{type:'input_json_delta',partial_json:'{"input":"patch"}'},'tool_use'),names);
 const item=result.at(-1).response.output[0];assert.equal(item.type,'custom_tool_call');assert.equal(item.namespace,'functions');assert.equal(item.input,'patch');
 const followup=toClaude({tools,input:[item,{type:'custom_tool_call_output',call_id:item.call_id,output:'applied'}]});
 assert.equal(followup.request.messages[1].content[0].tool_use_id,'call_1');
});
test('Claude failures, malformed tool arguments and truncated streams never complete',async()=>{
 for(const list of [[{type:'error',error:{message:'overloaded'}}],events({type:'text',text:''},{type:'text_delta',text:'partial'}).slice(0,-1),events({type:'tool_use',id:'c',name:'tool_0',input:{}},{type:'input_json_delta',partial_json:'bad'},'tool_use')]){
  const result=await translate(list,toClaude({tools}).names);assert.equal(result.at(-1).type,'response.failed');assert.ok(!result.some(e=>e.type==='response.completed'));
 }
 const incomplete=await translate(events({type:'text',text:''},{type:'text_delta',text:'partial'},'max_tokens'));assert.equal(incomplete.at(-1).type,'response.incomplete');
});
test('Claude cancellation cancels upstream reader',async()=>{
 let cancelled=false;const source=new ReadableStream({cancel(){cancelled=true;}});await claudeStream(source,new Map()).cancel();assert.equal(cancelled,true);
});
test('Claude JSON preserves function tool ids and excludes raw thinking',()=>{
 const result=claudeJson({type:'message',id:'m',content:[{type:'thinking',thinking:'private'},{type:'tool_use',id:'c',name:'tool_0',input:{path:'a'}}],stop_reason:'tool_use'},toClaude({tools}).names);
 assert.equal(result.output.length,1);assert.equal(result.output[0].name,'read_file');assert.equal(result.output[0].call_id,'c');
});
test('gateway routes only configured Messages models and preserves upstream HTTP errors',async()=>{
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>({kind:'agent',enabled:1,route:'/v1/messages',provider:'duoyuanx'})})})}};
 let billed=0;const deps={authenticate:async()=>({user:{id:'u',quotaBalance:10}}),price:async()=>1,deduct:async()=>billed++,config:async()=>({apiKey:'test',baseUrl:'https://upstream/v1/'}),fetch:async(url,options)=>{assert.equal(url,'https://upstream/v1/messages');assert.equal(JSON.parse(options.body).messages[0].content[0].text,'hello');return new Response('{"error":{"message":"overloaded"}}',{status:529});}};
 const result=await agentResponses(new Request('https://local',{method:'POST',body:JSON.stringify({model:'claude',input:'hello'})}),env,deps);assert.equal(result.status,529);assert.equal(billed,0);
});
