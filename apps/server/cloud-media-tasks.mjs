import {dataPath} from '../../packages/runtime-paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {CLOUD_AGENT_GATEWAY} from './cloud-agent-context.mjs';
import {imageRequest} from '../cloudflare-worker/src/image-request.mjs';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(id);
export function createCloudMediaTasks({directory,fetchImpl=fetch,gateway=CLOUD_AGENT_GATEWAY}={}){
 const active=new Set();
 const file=(owner,id)=>{if(!validId(owner)||!validId(id))throw Object.assign(Error('无效任务编号'),{status:400});return path.join(directory,owner,id+'.json');};
 const read=(owner,id)=>{const f=file(owner,id);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;};
 const write=(owner,id,record)=>{const current=read(owner,id);if(current&&(current.task.revision||0)>(record.task.revision||0))return current;const f=file(owner,id);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f+'.tmp',JSON.stringify(record));fs.renameSync(f+'.tmp',f);return record;};
 const remote=async(context,route,options={})=>{
  const res=await fetchImpl(gateway+route,{...options,headers:{Authorization:'Bearer '+context.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(options.method==='POST'?600000:15000)});
  const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error?.message||data.error||'云端请求失败'),{status:res.status});return data;
 };
 return {
  submit(context,body){
   const id=body.requestId||randomUUID(),owner=context.owner,packed=imageRequest(body);
   const fingerprint=createHash('sha256').update(JSON.stringify(packed)).digest('hex');
   const existing=read(owner,id);
   if(existing){if(existing.fingerprint!==fingerprint)throw Object.assign(Error('请求编号已用于其他参数'),{status:409});return existing.task;}
   const record={fingerprint,task:{id,modelId:packed.model,count:packed.n,status:'running',revision:0,createdAt:Date.now(),upstreams:[]}};
   write(owner,id,record);active.add(owner+'/'+id);
   // The local service retains the cloud HTTP request when the UI/Agent returns.
   void remote(context,'/api/generate',{method:'POST',body:JSON.stringify({...body,requestId:id})}).then(data=>{
    if(!data.task||data.task.id!==id)throw Error('云端未返回匹配的持久化任务回执');
    record.task=data.task;write(owner,id,record);
   }).catch(error=>{
    record.task={...record.task,revision:1,status:error.status>=400&&error.status<500?'failed':'unknown',submissionUnknown:!(error.status>=400&&error.status<500),pollError:error.message};
    if(record.task.status==='failed')record.task.upstreams=[{ok:false,error:error.message}];
    try{write(owner,id,record);}catch(writeError){console.error('云端生成回执本地保存失败：'+writeError.message);}
   }).finally(()=>active.delete(owner+'/'+id));
   return record.task;
  },
  async get(context,id){
   const owner=context.owner,record=read(owner,id);
   if(record&&(active.has(owner+'/'+id)||['completed','partial','failed'].includes(record.task.status)))return record.task;
   try{
    const data=await remote(context,'/api/generation-tasks/'+encodeURIComponent(id));
    if(data.task?.id!==id)throw Error('云端任务回执不匹配');
    // A recovered receipt can be polled, but can never be resubmitted under this id.
    return write(owner,id,{fingerprint:record?.fingerprint||'recovered',task:data.task}).task;
   }catch(error){
    if(!record)throw error;
    return {...record.task,status:'unknown',submissionUnknown:true,pollError:error.message};
   }
  },
 };
}
export const cloudMediaTasks=createCloudMediaTasks({directory:dataPath('cloud-generation-tasks')});
