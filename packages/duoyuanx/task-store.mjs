import {minimaxCredentials} from './minimax-official.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeMediaResults} from '../../apps/client/media-results.js';

const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(id);
const fingerprint=draft=>createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([k])=>!['id','createdAt'].includes(k)).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
const ambiguousLegacyFailure=item=>item?.ok===false&&item.submissionUnknown===undefined&&item.errorPhase!=='pre_submission'&&!(item.httpStatus>=400&&item.httpStatus<500)&&/timeout|timed out|aborted|aborterror|fetch failed|socket|ECONNRESET|UND_ERR|terminated|超时|请求中断|结果未知/i.test(item.error||'');

// Only task receipts/results are stored. Prompts, input files and credentials stay out of this ledger.
export function createGenerationTaskStore({directory,getModel,generate,fetchImpl=fetch,base,key,now=Date.now,pollInterval=5000,maxAge=3*24*3600000,minimaxKey=process.env.MINIMAX_API_KEY}){
 const records=new Map(),inflight=new Set();let timer,closed=false,lastStorageError='';
 fs.mkdirSync(directory,{recursive:true});
 const write=record=>{record.updatedAt=now();record.revision=(record.revision||0)+1;const file=path.join(directory,record.id+'.json');fs.writeFileSync(file+'.tmp',JSON.stringify(record));fs.renameSync(file+'.tmp',file);records.set(record.id,record);};
 const view=record=>record?{id:record.id,modelId:record.modelId,status:record.status,requests:record.requests||[],submissionUnknown:!!record.submissionUnknown,revision:record.revision,upstreams:record.results.filter(Boolean).map(r=>({ok:r.ok,upstream:r.upstream,error:r.error,...(r.submissionUnknown?{submissionUnknown:true}:{})})),pollError:record.pollError||'',createdAt:record.createdAt}:null;
 const settle=record=>{
  record.results=record.results.map(r=>{if(!r||r.ok===false)return r;const n=normalizeMediaResults(r.upstream);return n.urls.length||n.taskIds.length||n.errors.some(error=>error!=='任务已结束但未返回可用素材')?r:{ok:false,submissionUnknown:true,error:'上游响应没有可识别素材或任务编号，生成结果未知，请勿重复提交'};});
  const pending=record.results.some(r=>!r||normalizeMediaResults(r.upstream).taskIds.length>0);
  const urls=record.results.flatMap(r=>normalizeMediaResults(r?.upstream).urls);
  const failed=record.results.some(r=>r?.ok===false||normalizeMediaResults(r?.upstream).errors.length);
  record.submissionUnknown=record.results.some(r=>r?.submissionUnknown===true);
  record.status=pending?'running':record.submissionUnknown?'unknown':failed?(urls.length?'partial':'failed'):'completed';
 };
 for(const name of fs.readdirSync(directory)){
  if(!name.endsWith('.json'))continue;
  try{const r=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));if(!validId(r.id)||!Array.isArray(r.results))throw Error('无效任务记录');
   r.results=r.results.map(item=>!item?{ok:false,submissionUnknown:true,error:'提交时服务中断，结果未知；为避免重复扣费，未自动重提'}:ambiguousLegacyFailure(item)?{...item,submissionUnknown:true}:item);settle(r);r.nextPoll=now();write(r);
  }catch(e){lastStorageError='部分任务记录无法恢复：'+e.message;}
 }
 function submit(id,draft,model){
  if(!validId(id))throw Object.assign(Error('无效生成请求编号'),{status:400});
  const hash=fingerprint(draft),existing=records.get(id);
  if(existing){if(existing.fingerprint!==hash)throw Object.assign(Error('请求编号已用于其他参数'),{status:409});return view(existing);}
  if(closed)throw Error('任务服务已关闭');
  const record={id,modelId:model.id,fingerprint:hash,status:'running',createdAt:now(),results:Array(draft.count).fill(null),nextPoll:now()+pollInterval};write(record);
  // Persist the receipt before any paid POST is attempted. A restart never repeats that POST.
  Promise.resolve().then(()=>generate(draft,model,{onRequest:(index,request)=>{record.requests||=[];record.requests[index]=request;write(record);},onResult:(index,result)=>{record.results[index]=result;settle(record);write(record);}})).then(results=>{
   record.results=results.map((result,index)=>record.results[index]||result);settle(record);write(record);
  }).catch(e=>{record.results=record.results.map(r=>r||{ok:false,error:e.message||'提交失败',submissionUnknown:!!e.submissionUnknown});settle(record);try{write(record);}catch(err){lastStorageError=err.message;}});
  return view(record);
 }
 async function poll(record){
  if(inflight.has(record.id)||record.status!=='running')return;
  inflight.add(record.id);
  try{
   let transient=false;record.pollError='';
   for(let i=0;i<record.results.length;i++){
    const result=record.results[i];if(!result)continue;
    const ids=normalizeMediaResults(result.upstream).taskIds;if(!ids.length)continue;
    const model=getModel(record.modelId);
    const queryRoute=result.queryRoute||model?.queryRoute;
    if(!queryRoute){record.pollError='模型缺少任务查询路由';transient=true;continue;}
    if(now()-record.createdAt>maxAge){record.results[i]={ok:false,error:'任务查询超过 3 天，停止自动查询',upstreamTaskIds:ids};continue;}
    const responses=[];
    for(const id of ids){
     try{
      const endpoint=result.provider==='minimax-official'?minimaxCredentials(minimaxKey):{base,key};
      const response=await fetchImpl(endpoint.base+queryRoute.replace('{task_id}',encodeURIComponent(id)),{headers:{Authorization:result.authorizationScheme==='raw'?endpoint.key:`Bearer ${endpoint.key}`},signal:AbortSignal.timeout(30000)});
      const data=await response.json();
      if(response.status===404||response.status===410){responses.push({error:'上游任务不存在或已过期',task_id:id});continue;}
      if(!response.ok)throw Error('任务查询暂不可用（'+response.status+'）');
      const normalized=normalizeMediaResults(data);
      responses.push(normalized.urls.length||normalized.errors.length?data:{...data,task_id:id});
     }catch(e){transient=true;record.pollError=e.message;responses.push({task_id:id});}
    }
    const previous=normalizeMediaResults(result.upstream);
    record.results[i]={ok:true,queryRoute,...(result.provider?{provider:result.provider}:{}),...(result.authorizationScheme?{authorizationScheme:result.authorizationScheme}:{}),upstream:[...previous.urls.map(url=>({url})),...previous.errors.map(error=>({error})),...responses]};
   }
   record.failures=transient?(record.failures||0)+1:0;
   record.nextPoll=now()+Math.min(60000,pollInterval*2**Math.min(record.failures,4));settle(record);write(record);
  }finally{inflight.delete(record.id);}
 }
 async function tick(){if(closed)return;const due=[...records.values()].filter(r=>r.status==='running'&&r.nextPoll<=now()&&!inflight.has(r.id)).slice(0,Math.max(0,4-inflight.size));await Promise.all(due.map(r=>poll(r).catch(e=>{lastStorageError=e.message;})));}
 return {submit,get:id=>validId(id)?view(records.get(id)):null,tick,
  start(){if(!timer){closed=false;timer=setInterval(()=>{void tick();},Math.min(pollInterval,1000));timer.unref?.();void tick();}},
  close(){closed=true;clearInterval(timer);timer=null;},
  get storageError(){return lastStorageError;}
 };
}
