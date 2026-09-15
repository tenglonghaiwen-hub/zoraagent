import {normalizeMediaResults} from './media-results.js?v=studio136';

export function applyGenerationReceipt(message,task){
 const result=normalizeMediaResults(task.upstreams||[]);
 message.genBatchId=task.id;message.genRevision=task.revision;
 message.genPending=task.status==='running'||task.status==='unknown';message.genPollError=task.pollError||'';
 message.genUnknown=task.status==='unknown'||!!task.submissionUnknown;
 message.genUrls=[...new Set([...(message.genUrls||[]),...result.urls])];
 message.genUrl=message.genUrls[0]||null;
 message.genTaskIds=message.genPending?[...new Set([...(message.genUnknown?message.genTaskIds||[]:[]),...result.taskIds])]:[];message.genTaskId=message.genTaskIds[0]||(message.genUnknown?message.genTaskId:null)||null;
 message.genError=result.errors.join('；');
 message.genStatus=message.genUnknown?'结果待确认':message.genPending?'生成中':task.status==='partial'?'部分失败':task.status==='failed'?'生成失败':message.genUrl?'已完成':'生成失败';
 if(!message.genPending&&!message.genUrl&&!message.genError)message.genError='任务已结束，但没有返回可用素材';
 return message;
}

// Reconcile the original receipt before any user-requested paid retry.
export async function verifyGenerationRetry(message,{fetchImpl=fetch,confirmImpl=globalThis.confirm}={}){
 if(message.genBatchId){
  const wasComplete=message.genStatus==='已完成';
  let data;
  try{
   const response=await fetchImpl('/api/generation-tasks/'+encodeURIComponent(message.genBatchId),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   data=await response.json();
   if(!response.ok||data.task?.id!==message.genBatchId||!['running','unknown','completed','partial','failed'].includes(data.task.status))throw Error(data.error||'无法核对原任务');
  }catch(e){message.genUnknown=true;message.genStatus='结果待确认';message.genPollError='无法核对原任务，已阻止重复提交：'+e.message;return false;}
  applyGenerationReceipt(message,data.task);
  if(message.genPending||message.genUnknown)return false;
  if(data.task.status==='completed'&&!wasComplete){message.genPollError='已恢复原任务结果；如需新生成，请再次点击并确认费用。';return false;}
 }else if(message.genUnknown||message.genPending||message.genTaskId||message.genTaskIds?.length){return false;}
 return !!confirmImpl('这会创建新的生成任务，可能再次收费。是否确认重新生成？');
}

export function attachGenerationReceipts(messages,source,receipts,models=[]){
 source.id ||= crypto.randomUUID();
 const linked=[];
 for(const receipt of receipts||[]){
  const task=receipt?.task,draft=receipt?.draft||{};
  if(!task?.id)continue;
  let message=messages.find(m=>m.genBatchId===task.id);
  if(!message){
   const model=models.find(m=>m.id===(task.modelId||draft.modelId));
   message={id:crypto.randomUUID(),sourceAgentMessageId:source.id,kind:draft.kind||model?.kind||'image',modelId:task.modelId||draft.modelId,text:draft.prompt||'',count:Number(draft.count)||1,concurrency:Number(draft.concurrency)||1,ratio:draft.ratio||'1:1',resolution:draft.resolution,duration:draft.duration,videoMode:draft.videoMode,operation:draft.operation,apiRoute:draft.apiRoute,references:[...(source.references||[])],createdAt:task.createdAt||Date.now()};
   message.meta=[message.modelId,message.ratio,message.resolution].filter(Boolean).join(' · ');
   messages.push(message);
  }
  // A repeated chat render/receipt must not roll a polled task back to running.
  if(message.genRevision==null||task.revision>=message.genRevision)applyGenerationReceipt(message,task);
  linked.push(task.id);
 }
 source.generationTaskIds=[...new Set([...(source.generationTaskIds||[]),...linked])];
 return linked;
}
