import {createHash} from 'node:crypto';

const properties={modelId:{type:'string'},expectedCost:{type:'integer',minimum:0,description:'实际提交必须填写用户确认过的预览 cost；价格变化时停止并重新报价'},prompt:{type:'string'},duration:{type:'integer',minimum:4,maximum:15},ratio:{type:'string'},videoMode:{type:'string',enum:['t2v','i2v','fl','ref']},sourceReceiptId:{type:'string',description:'query_h3_task 返回的本账号视频回执 id，不是上游 task_id'},referenceIndexes:{type:'array',items:{type:'integer',minimum:1},description:'当前会话素材的序号，从 1 开始；源任务方式不传素材'},requestId:{type:'string',description:'复用原请求编号查询恢复，未知状态不得换编号重提'}};
export const H3_TOOLS=[
 {type:'function',name:'enhance_video_prompt',description:'按用户意图选择：用户要求增强视频提示词时调用 H3-Context-IR；只返回异步文本任务，不生成视频。需要多元 minimax 官方格式与后台 enhance 定价。preview=true 只校验和报价。实际提交前确认用户授权本次扣费；查询完成后的 enhancedPrompt 才是增强结果。不得把“只优化提示词”扩大成生成视频。',parameters:{type:'object',properties:{...properties,preview:{type:'boolean'}},required:['modelId','prompt','duration'],additionalProperties:false}},
 {type:'function',name:'remix_video',description:'按用户指令对已有视频再生成，输出固定 2K。支持本账号已完成的 sourceReceiptId（不传新提示词/素材），或 referenceIndexes 选择一个源视频并提供 prompt。不要猜源任务编号，不是任意剪辑器；不支持的要求应说明。需要后台 remix 定价；preview=true 报价，实际提交须有本次扣费授权。失败/未知不得自动重提。',parameters:{type:'object',properties:Object.fromEntries(Object.entries({...properties,preview:{type:'boolean'}}).filter(([key])=>!['duration','ratio','videoMode'].includes(key))),required:['modelId'],additionalProperties:false}},
 {type:'function',name:'query_h3_task',description:'查询已有 H3 回执，不新建任务、不重复扣费。增强任务完成返回 enhancedPrompt；生成/再生成完成返回视频。只能使用已返回的回执 id，按 5–10 秒间隔查询。',parameters:{type:'object',properties:{requestId:{type:'string'}},required:['requestId'],additionalProperties:false}}
];
export async function runH3Tool(name,args,{callApi,references,conversationId,messageId,generationTasks}){
 if(name==='query_h3_task'){
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(args.requestId||''))return {ok:false,error:'请使用原任务回执编号'};
  return callApi({method:'GET',path:'/api/h3/tasks/'+args.requestId});
 }
 let selected=[];
 if(!args.sourceReceiptId){
  if(args.referenceIndexes){
   if(!Array.isArray(args.referenceIndexes)||new Set(args.referenceIndexes).size!==args.referenceIndexes.length||args.referenceIndexes.some(i=>!Number.isInteger(i)||i<1||i>references.length))return {ok:false,error:'素材序号无效'};
   selected=args.referenceIndexes.map(i=>references[i-1]);
  }else selected=references;
 }
 if(selected.some(r=>!r?.contentUrl))return {ok:false,error:'原素材不可用，未提交'};
 const {preview,referenceIndexes,requestId,...input}=args;
 const body={...input,h3Operation:name==='enhance_video_prompt'?'enhance':'remix',references:selected.map(r=>({name:r.name,type:r.type,contentUrl:r.contentUrl}))};
 const stable=requestId||createHash('sha256').update(JSON.stringify([conversationId,messageId,body])).digest('hex');
 let result;
 try{result=await callApi({method:'POST',path:preview?'/api/h3/preview':'/api/h3/tasks',body:{...body,requestId:stable}});}catch(error){result={ok:false,error:error.message};}
 if(!preview&&!result?.data?.task&&(result?.status==null||result.status>=500)){
  try{result=await callApi({method:'GET',path:'/api/h3/tasks/'+stable});}catch(error){result={ok:false,error:error.message};}
 }
 if(!preview){
  let task=result?.data?.task;
  if(!task&&(result?.status==null||result.status>=500||result.status===404)){
   task={id:stable,modelId:args.modelId,outputKind:body.h3Operation==='enhance'?'text':'video',status:'unknown',submissionUnknown:true,revision:0,createdAt:Date.now(),upstreams:[],pollError:'提交结果待核对，未重新提交'};
   result={...result,data:{...result?.data,task}};
  }
  if(task?.outputKind==='video')generationTasks.push({task,draft:{modelId:args.modelId,kind:'video',prompt:args.prompt||'已有视频再生成 · 2K',count:1,resolution:'2K',h3Operation:'remix'}});
  return {...result,requestId:stable,...!task?{next:'保留此 requestId 查询，禁止换编号自动重提'}:{}};
 }
 return result;
}
