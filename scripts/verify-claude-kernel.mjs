// Real packaged Codex, local simulated Claude. No paid/provider requests.
import http from 'node:http';
import assert from 'node:assert/strict';
import {CodexKernel} from '../packages/agent/codex-kernel.mjs';
import {toClaude,claudeStream} from '../apps/cloudflare-worker/src/claude-responses.mjs';
let requests=0,toolCalls=0,failures=[];
const server=http.createServer(async(req,res)=>{
 try {
  let raw='';for await(const chunk of req)raw+=chunk;
  const {request,names}=toClaude(JSON.parse(raw));requests++;
  const probe=[...names].find(([,spec])=>spec.name==='zora_probe');assert.ok(probe);
  if(requests===2)assert.ok(request.messages.some(m=>m.content.some(c=>c.type==='tool_result'&&c.tool_use_id==='probe_call')));
  const first=requests===1;
  const block=first?{type:'tool_use',id:'probe_call',name:probe[0],input:{}}:{type:'text',text:''};
  const delta=first?{type:'input_json_delta',partial_json:'{}'}:{type:'text_delta',text:JSON.stringify({reply:'Claude 协议测试通过',tasks:[]})};
  const events=[{type:'message_start',message:{id:'msg_'+requests,model:request.model,usage:{input_tokens:10}}},{type:'content_block_start',index:0,content_block:block},{type:'content_block_delta',index:0,delta},{type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:first?'tool_use':'end_turn'},usage:{output_tokens:10}},{type:'message_stop'}];
  const source=new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')).body;
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  for await(const chunk of claudeStream(source,names))res.write(chunk);res.end();
 }catch(error){failures.push(error.message);res.writeHead(400);res.end(JSON.stringify({error:{message:error.message}}));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const kernel=new CodexKernel({home:'D:/zora/outputs/claude-kernel-'+Date.now(),base:'http://127.0.0.1:'+server.address().port+'/v1',key:'mock-only'});
try{
 const result=await kernel.run('Call zora_probe then reply as JSON.',{conversationId:'claude-bridge-test',modelId:'claude-opus-5',tools:[{name:'zora_probe',description:'Return a test value.',parameters:{type:'object',properties:{},additionalProperties:false}}],toolRunner:async()=>{toolCalls++;return {ok:true,value:42};}});
 assert.deepEqual(failures,[]);assert.equal(toolCalls,1);assert.equal(result.reply,'Claude 协议测试通过');
 console.log(JSON.stringify({ok:true,realPackagedCodex:true,mockedClaude:true,requests,toolCalls}));
}finally{await kernel.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
