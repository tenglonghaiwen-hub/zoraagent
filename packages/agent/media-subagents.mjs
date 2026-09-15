import {selectTaskSkills} from './skill-selection.mjs';
import {AGENT_TOOL_DEFS} from './tools.mjs';
import {getRouteCapabilities} from '../duoyuanx/route-capabilities.mjs';

const childNames=new Set(['list_media_models','preview_task','submit_generation']);
const blockedMain=new Set(['preview_task','submit_generation','call_api']);
export const MAIN_AGENT_TOOL_DEFS=[...AGENT_TOOL_DEFS.filter(t=>!blockedMain.has(t.name)),{
 type:'function',name:'delegate_media_task',description:'将图片或视频任务委派给对应专业子 Agent。仅需要媒体规划或生成时调用，普通对话不需要。',
 parameters:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['image','video']},task:{type:'string',description:'完整任务与明确参数，保留用户限制；说明仅规划还是实际生成。'}},required:['kind','task']}
}];

export function createMediaDelegator({run,sharedRunner,mediaModels,modelId,conversationId,messageId,skills=[],images=[],context,generationTasks=[]}){
 let delegates=0,queue=Promise.resolve();
 const execute=async({kind,task})=>{
  const toolTrace=[];
  const before=new Set(generationTasks.map(t=>t.task.id));
  const roleInstructions=`你是 Zora 的${kind==='image'?'图片':'视频'}专业子 Agent。只处理${kind}任务。模型、operation、apiRoute 与参数选择优先级：用户明确要求 > 已有上下文约束 > 你的专业判断 > 默认值。未指定媒体模型时默认使用 ${kind==='image'?'gpt-image-2':'MiniMax-H3'}。从模型 routes 目录明确选择 operation 和 apiRoute 后传给 preview_task/submit_generation，参考生成选 reference、纯文字生成选 generate；已有参考素材不得悄悄丢弃。MiniMax-H3 按用户意图选择 t2v、i2v、fl、ref；图片作为身份参考时必须 ref，不能因数量为1或2改成首尾帧。首尾帧仅支持 adaptive。仅使用 OpenAI 格式 /v1/videos；多模态参考有图片时至少3张实际图片，1–2张不可作为参考图，不得复制凑数、丢弃素材或换用官方格式。不要指定 apiRoute，由宿主依据素材角色选择并校验。保留全部参考素材，不复制素材凑数，不主动换模型或重复提交。明确要求不兼容时解释冲突，不替换。后端只校验选择与打包，不替你猜测任务语义。只能使用已提供的媒体工具，不能继续委派。未实际取得完成素材时不得声称完成。仅规划需求不得提交生成。当任务明确要求实际生成时，先调用 preview_task 检查参数，再调用 submit_generation；工具已经提供，不要在未调用工具且没有具体错误证据时声称无法提交。参考素材由宿主自动注入，不需要你重新上传或在参数里编造素材地址。校验失败时根据返回错误修正；已取得提交回执后不得重复提交。最终只输出 JSON 对象 reply(string) 与 tasks(array)。`;
  const allowedModels=mediaModels.filter(m=>m.kind===kind).map(m=>({...m,routes:m.routes||getRouteCapabilities(m)}));
  const childRunner=async(name,args={})=>{
   if(!childNames.has(name))return {ok:false,error:'此子 Agent 无权调用该工具'};
   if(name==='list_media_models')return {models:allowedModels,count:allowedModels.length};
   const selected=args.modelId|| (kind==='image'?'gpt-image-2':'MiniMax-H3');
   if(!allowedModels.some(m=>m.id===selected))return {ok:false,error:'模型不属于当前子 Agent 的媒体类型或不可用'};
   const startedAt=Date.now();
   try{const result=await sharedRunner(name,{...args,modelId:selected});toolTrace.push({name,args:{...args,modelId:selected},result,startedAt,durationMs:Date.now()-startedAt});return result;}catch(e){const result={ok:false,error:String(e.message||e)};toolTrace.push({name,args,result,startedAt,durationMs:Date.now()-startedAt});return result;}
  };
  let result,error;
  try{result=await run(roleInstructions+'\n'+JSON.stringify({task,context,models:allowedModels}),{modelId,ownerConversationId:conversationId,messageId,skills,roleInstructions,tools:AGENT_TOOL_DEFS.filter(t=>childNames.has(t.name)),toolRunner:childRunner,images,maxRounds:4});}
  catch(e){error=String(e.message||e);}
  const receipts=generationTasks.filter(t=>!before.has(t.task.id));
  if(!error&&!receipts.length&&!toolTrace.length&&!(result?.tasks?.length))error='子 Agent 未调用校验或生成工具，未提交任务；这不是上游生成失败';
  return {ok:!error,status:receipts.length?'submitted':error?'not_submitted':'planned',toolTrace,kind,reply:typeof result?.reply==='string'?result.reply:'子 Agent 回复未完成，请以实际任务状态为准',tasks:Array.isArray(result?.tasks)?result.tasks:[],generationTasks:receipts,...(error?{error}:{})};
 };
 return async(name,args={})=>{
  if(name!=='delegate_media_task'){
   if(blockedMain.has(name))return {ok:false,error:'媒体任务请使用 delegate_media_task 委派给图片或视频子 Agent'};
   return sharedRunner(name,args);
  }
  if(!['image','video'].includes(args.kind)||typeof args.task!=='string'||!args.task.trim()||args.task.length>8000)return {ok:false,error:'委派任务类型或内容无效'};
  if(delegates>=4)return {ok:false,error:'本轮最多委派 4 个媒体子任务'};
  delegates++;
  const pending=queue.then(()=>execute(args));queue=pending.catch(()=>{});return pending;
 };
}
