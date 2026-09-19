// Codex speaks Responses; models configured with /v1/messages use this bridge.
const invalid = message => Object.assign(new Error(message), {status:400});
const id = prefix => prefix + crypto.randomUUID().replaceAll('-', '');
function content(value) {
 if (typeof value === 'string') return [{type:'text',text:value || '(empty)'}];
 return (value || []).map(part => {
  if (['text','input_text','output_text'].includes(part.type)) return {type:'text',text:part.text};
  if (part.type === 'input_image') {
   const url = part.image_url;
   const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(url);
   return {type:'image',source:match ? {type:'base64',media_type:match[1],data:match[2]} : {type:'url',url}};
  }
  throw invalid('Claude 不支持此输入内容类型：' + part.type);
 });
}
export function toClaude(body) {
 if (body.previous_response_id) throw invalid('Claude 需要完整会话历史，不支持 previous_response_id');
 const names = new Map(), tools = [], system = [], messages = [];
 function addTools(items, namespace) {
  for (const tool of items || []) {
   // OpenAI-hosted search cannot execute on Messages. Zora supplies browser_search/read
   // as ordinary local tools; retain those instead of inventing a paid hosted tool.
   if (tool.type === 'web_search' || tool.type === 'web_search_preview') continue;
   if (tool.type === 'namespace') {addTools(tool.tools, tool.name); continue;}
   if (!['function','custom'].includes(tool.type)) throw invalid('Claude 暂不支持此工具类型：' + tool.type);
   const alias = 'tool_' + tools.length;
   names.set(alias, {name:tool.name,namespace,type:tool.type});
   tools.push({name:alias,description:(namespace ? namespace+'.' : '')+tool.name+'\n'+(tool.description || ''),
    input_schema:tool.type === 'custom' ? {type:'object',properties:{input:{type:'string'}},required:['input'],additionalProperties:false} : tool.parameters || {type:'object',properties:{}}});
  }
 }
 addTools(body.tools);
 const aliasFor = item => {
  for (const [alias, spec] of names) if (spec.name === item.name && spec.namespace === item.namespace) return alias;
  throw invalid('Claude 会话中的工具已不可用：' + item.name);
 };
 const push = (role, blocks) => {
  if (!blocks.length) return;
  const last = messages.at(-1);
  if (last?.role === role) last.content.push(...blocks); else messages.push({role,content:blocks});
 };
 if (body.instructions) system.push({type:'text',text:body.instructions});
 for (const item of typeof body.input === 'string' ? [{role:'user',content:body.input}] : body.input || []) {
  if (item.type === 'reasoning') continue; // Provider-specific encrypted state is not portable.
  if (item.type === 'function_call' || item.type === 'custom_tool_call') {
   let input;
   try { input = item.type === 'custom_tool_call' ? {input:item.input} : JSON.parse(item.arguments); }
   catch { throw invalid('工具调用参数不是有效 JSON：' + item.name); }
   push('assistant',[{type:'tool_use',id:item.call_id,name:aliasFor(item),input}]);
  } else if (['function_call_output','custom_tool_call_output'].includes(item.type)) {
   push('user',[{type:'tool_result',tool_use_id:item.call_id,content:content(item.output)}]);
  } else if (['system','developer'].includes(item.role)) system.push(...content(item.content));
  else if (['user','assistant'].includes(item.role)) push(item.role,content(item.content));
  else throw invalid('Claude 不支持此会话项：' + item.type);
 }
 const request = {model:body.model,max_tokens:body.max_output_tokens || 8192,messages,stream:!!body.stream};
 if (system.length) request.system = system;
 if (tools.length) request.tools = tools;
 if (body.temperature !== undefined) request.temperature = body.temperature;
 if (body.top_p !== undefined) request.top_p = body.top_p;
 if (body.tool_choice) {
  const choice = body.tool_choice;
  request.tool_choice = typeof choice === 'string' ? {type:choice === 'required' ? 'any' : choice} : {type:'tool',name:aliasFor(choice)};
 }
 if (body.parallel_tool_calls === false && tools.length) request.tool_choice = {...request.tool_choice || {type:'auto'},disable_parallel_tool_use:true};
 if (body.text?.format?.type === 'json_schema') request.output_config = {format:{type:'json_schema',schema:body.text.format.schema}};
 return {request,names};
}
function outputItem(block, names, itemId = id('item_')) {
 if (block.type === 'text') return {type:'message',id:itemId,role:'assistant',status:'completed',content:[{type:'output_text',text:block.text,annotations:[]}]};
 if (block.type !== 'tool_use') return null; // Never publish raw thinking as a reasoning summary.
 const spec = names.get(block.name);
 if (!spec) throw Error('Claude 返回了未知工具：' + block.name);
 const common = {id:itemId,call_id:block.id,name:spec.name,...spec.namespace ? {namespace:spec.namespace} : {},status:'completed'};
 if (spec.type === 'custom') {
  if (typeof block.input?.input !== 'string') throw Error('Claude 返回的自定义工具参数无效');
  return {...common,type:'custom_tool_call',input:block.input.input};
 }
 return {...common,type:'function_call',arguments:JSON.stringify(block.input)};
}
function usage(value = {}) {
 const input = (value.input_tokens || 0) + (value.cache_read_input_tokens || 0) + (value.cache_creation_input_tokens || 0);
 return {input_tokens:input,output_tokens:value.output_tokens || 0,total_tokens:input + (value.output_tokens || 0),input_tokens_details:{cached_tokens:value.cache_read_input_tokens || 0}};
}
export function claudeJson(message, names) {
 if (message.type === 'error' || message.error) throw Error(message.error?.message || 'Claude 返回错误');
 if (message.type !== 'message' || !Array.isArray(message.content)) throw Error('Claude 返回的消息格式无效');
 return {id:message.id,object:'response',model:message.model,status:message.stop_reason === 'max_tokens' ? 'incomplete' : 'completed',
  output:message.content.map(b=>outputItem(b,names)).filter(Boolean),usage:usage(message.usage),
  ...(message.stop_reason === 'max_tokens' ? {incomplete_details:{reason:'max_output_tokens'}} : {})};
}
// Pull-driven SSE translation preserves backpressure and propagates downstream cancellation.
export function claudeStream(source, names) {
 const reader = source.getReader(), decoder = new TextDecoder(), encoder = new TextEncoder();
 let buffer = '', ended = false, sequence = 0, responseId = id('resp_'), model, tokens = {}, stopReason;
 const blocks = new Map(), output = [];
 const event = (type, data) => encoder.encode('event: '+type+'\ndata: '+JSON.stringify({type,sequence_number:sequence++,...data})+'\n\n');
 const snapshot = status => ({id:responseId,object:'response',model,status,output:[...output],usage:usage(tokens)});
 function convert(data) {
  const events = [];
  if (data.type === 'error') throw Error(data.error?.message || 'Claude 流式响应错误');
  if (data.type === 'message_start') {
   responseId = data.message.id; model = data.message.model; tokens = {...data.message.usage};
   events.push(event('response.created',{response:snapshot('in_progress')}));
  } else if (data.type === 'content_block_start') {
   const block = {...data.content_block};
   const state = {block,id:id('item_'),json:'',index:output.length}; blocks.set(data.index,state);
   if (block.type === 'text' || block.type === 'tool_use') {
    const initial = outputItem(block.type === 'tool_use' && names.get(block.name)?.type === 'custom' ? {...block,input:{input:''}} : block,names,state.id);
    output.push(initial);
    events.push(event('response.output_item.added',{output_index:state.index,item:{...initial,status:'in_progress'}}));
    if (block.type === 'text') events.push(event('response.content_part.added',{item_id:state.id,output_index:state.index,content_index:0,part:{type:'output_text',text:'',annotations:[]}}));
   }
  } else if (data.type === 'content_block_delta') {
   const state = blocks.get(data.index); if (!state) throw Error('Claude 流缺少内容块起始事件');
   if (data.delta.type === 'text_delta') {
    state.block.text += data.delta.text;
    events.push(event('response.output_text.delta',{item_id:state.id,output_index:state.index,content_index:0,delta:data.delta.text}));
   } else if (data.delta.type === 'input_json_delta') state.json += data.delta.partial_json;
  } else if (data.type === 'content_block_stop') {
   const state = blocks.get(data.index); if (!state) throw Error('Claude 流缺少内容块');
   if (state.block.type === 'tool_use' && state.json) state.block.input = JSON.parse(state.json);
   const item = outputItem(state.block,names,state.id);
   if (item) {
    output[state.index] = item;
    events.push(event('response.output_item.done',{output_index:state.index,item}));
   }
   blocks.delete(data.index);
  } else if (data.type === 'message_delta') {tokens = {...tokens,...data.usage};stopReason = data.delta?.stop_reason;}
  else if (data.type === 'message_stop') {
   if (blocks.size) throw Error('Claude 流在内容块完成前结束');
   if (!stopReason) throw Error('Claude 流缺少终止原因');
   ended = true;
   const incomplete = stopReason === 'max_tokens';
   events.push(event(incomplete ? 'response.incomplete' : 'response.completed',{response:{...snapshot(incomplete ? 'incomplete' : 'completed'),...(incomplete ? {incomplete_details:{reason:'max_output_tokens'}} : {})}}));
  }
  return events;
 }
 return new ReadableStream({
  async pull(controller) {
   try {
    while (!ended) {
     const boundary = /\r?\n\r?\n/.exec(buffer);
     if (boundary) {
      const frame = buffer.slice(0,boundary.index); buffer = buffer.slice(boundary.index+boundary[0].length);
      const data = frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') continue;
      const events = convert(JSON.parse(data));
      for (const item of events) controller.enqueue(item);
      if (ended) {await reader.cancel();controller.close();return;}
      if (events.length) return;
     } else {
      const chunk = await reader.read();
      if (chunk.done) throw Error('Claude 连接提前关闭，未收到 message_stop');
      buffer += decoder.decode(chunk.value,{stream:true});
      if (buffer.length > 8*1024*1024) throw Error('Claude SSE 单事件超过大小限制');
     }
    }
   } catch (error) {
    ended = true; await reader.cancel().catch(()=>{});
    controller.enqueue(event('response.failed',{response:{...snapshot('failed'),error:{code:'upstream_error',message:error.message}}}));controller.close();
   }
  },
  async cancel(reason) {ended = true;await reader.cancel(reason);}
 });
}
