import {toClaude,claudeJson,claudeStream} from './claude-responses.mjs';
// Reuse the tested namespace/custom-tool mapping without exposing raw reasoning.
export function toChat(body){
 let converted;
 try {converted=toClaude(body);} catch(error) {error.message=error.message.replaceAll('Claude','Chat Completions');throw error;}
 const {request:c,names}=converted;
 const part=p=>p.type==='text'?{type:'text',text:p.text}:p.type==='image'?{type:'image_url',image_url:{url:p.source.type==='base64'?`data:${p.source.media_type};base64,${p.source.data}`:p.source.url}}:(()=>{throw Error('Chat Completions 不支持此内容');})();
 const messages=[];
 if(c.system?.length)messages.push({role:'system',content:c.system.map(p=>p.text).join('\n')});
 for(const m of c.messages){
  let content=[],calls=[];
  for(const b of m.content){
   if(b.type==='tool_use')calls.push({id:b.id,type:'function',function:{name:b.name,arguments:JSON.stringify(b.input)}});
   else if(b.type==='tool_result')messages.push({role:'tool',tool_call_id:b.tool_use_id,content:b.content.map(part)});
   else content.push(part(b));
  }
  if(content.length||calls.length)messages.push({role:m.role,content:content.length?content:null,...(calls.length?{tool_calls:calls}:{})});
 }
 const request={model:c.model,messages,stream:c.stream,max_tokens:c.max_tokens};
 if(c.stream)request.stream_options={include_usage:true};
 if(c.tools?.length)request.tools=c.tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.input_schema}}));
 if(c.tool_choice)request.tool_choice=c.tool_choice.type==='tool'?{type:'function',function:{name:c.tool_choice.name}}:c.tool_choice.type==='any'?'required':c.tool_choice.type;
 if(body.parallel_tool_calls!==undefined)request.parallel_tool_calls=body.parallel_tool_calls;
 for(const key of ['temperature','top_p'])if(c[key]!==undefined)request[key]=c[key];
 if(body.text?.format?.type==='json_schema')request.response_format={type:'json_schema',json_schema:{name:body.text.format.name||'response',schema:body.text.format.schema,strict:body.text.format.strict??true}};
 return {request,names};
}
const usage=u=>({input_tokens:u?.prompt_tokens||0,output_tokens:u?.completion_tokens||0});
const blocks=m=>[
 ...(m.content?[{type:'text',text:typeof m.content==='string'?m.content:m.content.map(p=>p.text||'').join('')}]:[]),
 ...(m.tool_calls||[]).map(t=>({type:'tool_use',id:t.id,name:t.function.name,input:JSON.parse(t.function.arguments||'{}')})),
];
export function chatJson(data,names){
 if(data.error)throw Error(data.error.message||'Chat Completions 返回错误');
 const c=data.choices?.[0];if(!c?.message)throw Error('Chat Completions 未返回消息');
 if(c.finish_reason==='content_filter')throw Error('上游内容审核拒绝');
 return claudeJson({type:'message',id:data.id,model:data.model,content:blocks(c.message),stop_reason:c.finish_reason==='length'?'max_tokens':'end_turn',usage:usage(data.usage)},names);
}
export function chatStream(source,names){
 const reader=source.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();
 let buffer='',queue=[],started=false,textStarted=false,finished=false,done=false,reason,model,responseId;
 const calls=new Map();let tokens={};
 const emit=data=>queue.push(encoder.encode('data: '+JSON.stringify(data)+'\n\n'));
 function chunk(raw){
  if(raw==='[DONE]'){
   if(!finished)throw Error('Chat Completions 流缺少结束状态');
   if(textStarted)emit({type:'content_block_stop',index:0});
   let index=textStarted?1:0;
   for(const t of calls.values()){
    if(!t.id||!t.name)throw Error('上游工具调用缺少标识');
    emit({type:'content_block_start',index,content_block:{type:'tool_use',id:t.id,name:t.name,input:{}}});
    emit({type:'content_block_delta',index,delta:{type:'input_json_delta',partial_json:t.arguments||'{}'}});
    emit({type:'content_block_stop',index:index++});
   }
   emit({type:'message_delta',delta:{stop_reason:reason==='length'?'max_tokens':'end_turn'},usage:tokens});emit({type:'message_stop'});done=true;return;
  }
  const data=JSON.parse(raw);if(data.error)throw Error(data.error.message||'上游流错误');
  if(!started){started=true;model=data.model;responseId=data.id;emit({type:'message_start',message:{id:responseId,model,usage:{}}});}
  if(data.usage)tokens=usage(data.usage);
  const c=data.choices?.[0];if(!c)return;
  if(c.finish_reason){if(c.finish_reason==='content_filter')throw Error('上游内容审核拒绝');reason=c.finish_reason;finished=true;}
  if(c.delta?.content){
   if(!textStarted){textStarted=true;emit({type:'content_block_start',index:0,content_block:{type:'text',text:''}});}
   emit({type:'content_block_delta',index:0,delta:{type:'text_delta',text:c.delta.content}});
  }
  for(const t of c.delta?.tool_calls||[]){const state=calls.get(t.index)||{id:'',name:'',arguments:''};if(t.id)state.id+=t.id;if(t.function?.name)state.name+=t.function.name;if(t.function?.arguments)state.arguments+=t.function.arguments;calls.set(t.index,state);}
 }
 const converted=new ReadableStream({async pull(controller){
  try{
   while(!queue.length&&!done){
    const boundary=buffer.indexOf('\n\n');
    if(boundary>=0){const event=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const raw=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(raw)chunk(raw);continue;}
    const next=await reader.read();if(next.done)throw Error('Chat Completions 流提前中断，未确认完成');buffer+=decoder.decode(next.value,{stream:true}).replace(/\r/g,'');if(buffer.length>4*1024*1024)throw Error('上游单条流事件过大');
   }
   if(queue.length)controller.enqueue(queue.shift());else{controller.close();await reader.cancel();}
  }catch(error){controller.error(error);await reader.cancel(error);}
 },cancel:reason=>reader.cancel(reason)});
 return claudeStream(converted,names);
}
