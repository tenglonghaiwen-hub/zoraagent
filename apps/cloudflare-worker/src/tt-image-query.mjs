import {resolveProviderConfig} from './proxy.mjs';
// Called only for an upstream task ID persisted by this account's durable job.
export async function queryTtImageTask({env,provider,taskId},fetchImpl=fetch){
 const {apiKey,baseUrl}=await resolveProviderConfig(env,provider);
 if(!apiKey||!baseUrl)throw Error('未配置图片渠道');
 const response=await fetchImpl(baseUrl.replace(/\/v1$/,'')+'/v1/skills/task-status?task_id='+encodeURIComponent(taskId),{headers:{Authorization:'Bearer '+apiKey},redirect:'manual',signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok)throw Error('上游任务查询暂不可用：'+response.status);
 if(data.is_final!==true)return {final:false};
 if(data.state==='failed')throw Object.assign(Error(typeof data.error==='string'?data.error:'上游图片生成失败'),{status:400,terminal:true});
 if(data.state!=='success'||typeof data.result_url!=='string'||!/^https?:\/\//.test(data.result_url))throw Error('上游终态缺少可用图片地址');
 return {final:true,data:[{url:data.result_url}]};
}
