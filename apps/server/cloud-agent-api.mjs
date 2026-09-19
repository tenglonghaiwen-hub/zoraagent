import {cloudAgentContext,CLOUD_AGENT_GATEWAY} from './cloud-agent-context.mjs';
import {isAllowedAgentApi} from '../../packages/agent/api.mjs';
import {cloudMediaTasks} from './cloud-media-tasks.mjs';
export function cloudToolApi(localCall){
 return async args=>{
  const context=cloudAgentContext.getStore();
  if(context&&args.method==='GET'&&/^\/api\/generation-tasks\/[a-zA-Z0-9_-]{16,100}$/.test(args.path)){
   try{return {ok:true,status:200,data:{task:await cloudMediaTasks.get(context,args.path.split('/').pop())}};}catch(error){return {ok:false,status:error.status||502,data:{error:error.message}};}
  }
  if(context&&args.method==='POST'&&args.path==='/api/generate'&&(args.body?.modelId||args.body?.model)==='gpt-image-2'){
   try{return {ok:true,status:202,data:{task:cloudMediaTasks.submit(context,args.body)}};}catch(error){return {ok:false,status:error.status||400,data:{error:error.message}};}
  }
  if(!context||!['/api/generate','/api/models'].includes(args.path))return localCall(args);
  if(!isAllowedAgentApi(args.method,args.path))return {ok:false,error:'API 不在白名单'};
  const res=await fetch(CLOUD_AGENT_GATEWAY+args.path,{method:args.method,headers:{Authorization:'Bearer '+context.token,'Content-Type':'application/json'},...(args.body?{body:JSON.stringify(args.body)}:{})});
  const data=await res.json();
  if(args.path==='/api/generate'&&res.ok){
   // Preserve the cloud receipt; never issue a second POST to obtain status.
   data.task={id:data.taskId||data.task_id||args.body.requestId,modelId:args.body.modelId,status:data.url?'completed':'submitted',upstreams:[{ok:true,taskId:data.taskId||data.task_id,url:data.url,upstream:data.upstream}],revision:1,createdAt:Date.now()};
  }
  return {ok:res.ok,status:res.status,data};
 };
}
