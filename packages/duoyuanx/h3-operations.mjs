import {packGenerateRequest} from './generation-adapters.mjs';

export const H3_OPERATION_ROUTES={enhance:'/v2/h3_context_ir',generate:'/v2/video_generation',remix:'/v2/video_regeneration'};
export const H3_QUERY_ROUTE='/v2/query/video_generation/{task_id}';
const invalid=message=>Object.assign(Error(message),{status:400});

// Pure request construction. The server resolves sourceReceiptId to an owned upstream id.
export function packH3Operation(input,model,sourceTaskId){
 const operation=input.h3Operation||'generate';
 if(!Object.hasOwn(H3_OPERATION_ROUTES,operation))throw invalid('不支持的 H3 操作');
 for(const key of ['provider','route','apiRoute','queryRoute','source_task_id','content']){
  if(input[key]!==undefined)throw invalid('H3 专用操作不能自行覆盖 '+key);
 }
 if(model.id!=='MiniMax-H3'||model.provider!=='duoyuanx'||model.family!=='minimax')throw invalid('此操作需要多元 MiniMax 官方格式模板');
 let body;
 if(operation==='remix'){
  if(input.resolution!==undefined&&input.resolution!=='2K')throw invalid('再生成固定输出 2K');
  if(input.duration!==undefined||input.ratio!==undefined)throw invalid('再生成不接受 duration 或 ratio');
  const refs=input.references||[];
  if(sourceTaskId){
   if(refs.length||input.prompt)throw invalid('源任务和源视频方式必须二选一；源任务方式不接受新提示词');
   body={model:model.id,source_task_id:sourceTaskId,resolution:'2K',aigc_watermark:false};
  }else{
   if(input.sourceReceiptId)throw invalid('未找到源任务');
   if(refs.length!==1||!refs[0].type?.startsWith('video/'))throw invalid('按源视频再生成需要选择一个视频素材');
   if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>7000)throw invalid('按源视频再生成需要 1–7000 字的提示词');
   body={model:model.id,content:[{type:'text',text:input.prompt},{type:'video_url',video_url:{url:refs[0].contentUrl}}],resolution:'2K',aigc_watermark:false};
  }
 }else{
  if(!Number.isInteger(input.duration)||input.duration<4||input.duration>15)throw invalid('H3 时长必须为 4–15 秒整数');
  if(!['768P','2K'].includes(input.resolution||'2K'))throw invalid('H3 仅支持 768P 和 2K');
  const draft={...input,modelId:model.id,count:1,resolution:input.resolution||'2K',ratio:input.ratio||'16:9'};
  const packed=packGenerateRequest(draft,model);
  body=operation==='enhance'?{model:model.id,content:packed.body.content,duration:input.duration,ratio:draft.ratio}:packed.body;
 }
 if(input.count!==undefined&&input.count!==1)throw invalid('H3 每次仅提交一个任务');
 for(const item of body.content||[]){
  if(item.type==='text')continue;
  const value=item[item.type]?.url;
  if(typeof value!=='string'||!value)throw invalid('素材内容不可用');
  if(value.startsWith('data:')){if(!/^data:(image|video|audio)\/[\w.+-]+;base64,[A-Za-z0-9+/]+=*$/.test(value))throw invalid('内嵌素材格式无效');continue;}
  let url;try{url=new URL(value);}catch{throw invalid('素材地址无效');}
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||url.hostname.endsWith('.local')||url.hostname.endsWith('.localhost')||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':'))throw invalid('素材需要公网 HTTPS 地址');
 }
 if(new TextEncoder().encode(JSON.stringify(body)).length>64*1024*1024)throw invalid('H3 请求体超过 64 MB');
 return {operation,path:H3_OPERATION_ROUTES[operation],queryRoute:H3_QUERY_ROUTE,body};
}

export function normalizeH3Result(data,operation){
 const task=data?.task;
 if(!task||typeof task.id!=='string')throw invalid('上游未返回有效任务结果');
 const status=String(task.status).toLowerCase();
 if(['failed','fail'].includes(status))return {status:'failed',error:String(task.error?.message||task.error||data.error?.message||'上游任务失败')};
 if(!['succeeded','success','completed'].includes(status))return {status:'processing'};
 if(operation==='enhance'){
  const prompt=task.content?.prompt;
  if(typeof prompt!=='string'||!prompt.trim())throw invalid('增强任务成功但未返回提示词，保留原任务继续核对');
  return {status:'completed',prompt};
 }
 const url=task.content?.url;
 if(typeof url!=='string'||!/^https?:\/\//.test(url))throw invalid('视频任务成功但未返回结果地址，保留原任务继续核对');
 return {status:'completed',url};
}
