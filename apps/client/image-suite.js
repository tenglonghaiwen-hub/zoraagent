import {normalizeMediaResults} from './media-results.js?v=studio136';

export function updateImageSuite(message){
 const items=message.imageSuite.items;
 message.count=items.length;
 // Keep empty slots so a later result never takes an earlier page's place.
 message.genUrls=items.map(item=>normalizeMediaResults(item.task?.upstreams||[]).urls[0]||null);
 message.genUrl=null;
 message.genTaskIds=[];message.genTaskId=null;
 message.genPending=items.some(item=>['running','unknown'].includes(item.task?.status));
 message.genUnknown=items.some(item=>item.task?.status==='unknown'||item.queryError);
 const completed=items.filter((item,index)=>message.genUrls[index]&&item.task?.status==='completed').length;
 message.genStatus=message.genUnknown?'结果待确认':message.genPending?'生成中':completed===items.length?'已完成':completed?'部分失败':'生成失败';
 message.genError=items.flatMap(item=>item.task?.status==='failed'||item.task?.status==='partial'||!item.task
   ? [`${item.title}：${item.task?.pollError||(!item.task?'未提交':'生成失败')}`] : []).join('；');
 message.genPollError=items.filter(item=>item.queryError).map(item=>`${item.title}：${item.queryError}`).join('；');
 return message;
}

export function attachImageSuite(messages,source,receipt,models=[]){
 const {suite,task,draft={}}=receipt;
 let message=messages.find(m=>m.imageSuite?.id===suite.id);
 if(!message){
  message={id:crypto.randomUUID(),sourceAgentMessageId:source.id,kind:'image',modelId:draft.modelId||task.modelId,
    genBatchId:'suite:'+suite.id,ratio:draft.ratio,resolution:draft.resolution,concurrency:1,
    operation:draft.operation,apiRoute:draft.apiRoute,references:[...(source.references||[])],createdAt:task.createdAt||Date.now(),
    imageSuite:{id:suite.id,title:suite.title,sharedStyle:suite.sharedStyle,items:suite.items.map(item=>({...item}))},
    text:[suite.title,suite.sharedStyle,...suite.items.map(item=>`${item.index+1}. ${item.title}\n${item.description||item.prompt}`)].join('\n\n')};
  message.meta=[message.modelId,message.ratio,message.resolution,`${suite.items.length} 张成套图片`].filter(Boolean).join(' · ');
  messages.push(message);
 }
 const item=message.imageSuite.items[suite.index];
 if(item&&(!item.task||Number(task.revision||0)>=Number(item.task.revision||0)))item.task=task;
 return updateImageSuite(message);
}

export async function refreshImageSuite(message,fetchImpl){
 await Promise.all(message.imageSuite.items.map(async item=>{
  if(!item.task?.id||item.task.localRejection)return;
  try{
   const response=await fetchImpl('/api/generation-tasks/'+encodeURIComponent(item.task.id),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok||data.task?.id!==item.task.id)throw Error(data.error||'无法核对原任务');
   if(Number(data.task.revision||0)>=Number(item.task.revision||0))item.task=data.task;
   item.queryError='';
  }catch(error){item.queryError=error.message;}
 }));
 return updateImageSuite(message);
}

export function imageSuitePageStatus(item){
 if(item.queryError)return '结果待确认';
 return ({running:'生成中',unknown:'结果待确认',completed:'已完成',partial:'部分失败',failed:'生成失败'})[item.task?.status]||'未提交';
}
