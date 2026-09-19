import {calculateQuotaCost,deductUserQuota} from './billing.mjs';
import {proxyGeneration} from './proxy.mjs';
import {imageRequest} from './image-request.mjs';
export async function readImageReceipt(env,userId,requestId){
 const row=await env.DB.prepare('SELECT task_json FROM generation_receipts WHERE user_id = ? AND request_id = ?').bind(userId,requestId).first();
 if(!row)return null;
 const task=JSON.parse(row.task_json);
 if(task.executor==='durable-object'&&env.IMAGE_JOBS){
  const saved=await env.IMAGE_JOBS.getByName(userId+'/'+requestId).receipt();
  if(saved)return saved;
 }
 if(task.status==='running'&&Date.now()-task.createdAt>15*60*1000)return {...task,status:'unknown',submissionUnknown:true,pollError:'生成连接中断，结果待确认；未重新提交'};
 return task;
}
export async function generateImages(body,user,env,deps={}){
 const packed=imageRequest(body),requestId=body.requestId||crypto.randomUUID();
 if(!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))throw Object.assign(Error('无效生成请求编号'),{status:400});
 const model=await env.DB.prepare('SELECT * FROM server_models WHERE id = ?').bind(packed.model).first();
 if(!model||!model.enabled||model.kind!=='image')throw Object.assign(Error('图片模型未开放'),{status:403});
 if(model.vip_only&&(!user.isVip||user.vipExpiresAt&&Number(user.vipExpiresAt)<Date.now()))throw Object.assign(Error('此模型需要 VIP'),{status:403});
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(packed))));
 const fingerprint=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const price=deps.price||calculateQuotaCost,deduct=deps.deduct||deductUserQuota,generate=deps.generate||proxyGeneration;
 const existing=await env.DB.prepare('SELECT fingerprint, task_json FROM generation_receipts WHERE user_id = ? AND request_id = ?').bind(user.id,requestId).first();
 if(existing){
  if(existing.fingerprint!==fingerprint)throw Object.assign(Error('请求编号已用于其他参数'),{status:409});
  const prior=JSON.parse(existing.task_json);
  // Only new durable jobs can be scheduled on retry. Legacy unknown jobs are never replayed.
  if(prior.executor==='durable-object'&&prior.status==='running'&&env.IMAGE_JOBS)await env.IMAGE_JOBS.getByName(user.id+'/'+requestId).enqueue({input:packed,task:prior,userId:user.id,fingerprint,provider:model.provider||'duoyuanx',route:model.route||'/v1/images/generations'});
  return {ok:true,task:await readImageReceipt(env,user.id,requestId)};
 }
 const cost=await price(env.DB,{modelId:packed.model,kind:'image',count:packed.n});
 if(user.quotaBalance<cost)throw Object.assign(Error('积分不足'),{status:402});
 const task={id:requestId,modelId:packed.model,status:'running',count:packed.n,revision:1,createdAt:Date.now(),upstreams:[],requests:[{method:'POST',path:model.route||'/v1/images/generations',body:{...packed,...packed.image?{image:'[参考图片已省略]'}:{}}}]};
 const insert=await env.DB.prepare('INSERT OR IGNORE INTO generation_receipts (user_id,request_id,fingerprint,task_json,updated_at) VALUES (?,?,?,?,?)').bind(user.id,requestId,fingerprint,JSON.stringify(task),Date.now()).run();
 if(!insert.meta?.changes)return {ok:true,task:await readImageReceipt(env,user.id,requestId)};
 const save=()=>env.DB.prepare('UPDATE generation_receipts SET task_json = ?, updated_at = ? WHERE user_id = ? AND request_id = ?').bind(JSON.stringify(task),Date.now(),user.id,requestId).run();
 if(env.IMAGE_JOBS){
  task.executor='durable-object';
  await save();
  return {ok:true,task:await env.IMAGE_JOBS.getByName(user.id+'/'+requestId).enqueue({input:packed,task,userId:user.id,fingerprint,provider:model.provider||'duoyuanx',route:model.route||'/v1/images/generations'})};
 }
 try{
  const upstream=await generate({body:packed,env,provider:model.provider||'duoyuanx',route:model.route||'/v1/images/generations'});
  const items=(upstream.data||[]).filter(x=>x?.url||x?.b64_json);
  task.upstreams=items.map(item=>({ok:true,upstream:item}));
  task.status=items.length>=packed.n?'completed':items.length?'partial':'unknown';
  if(items.length<packed.n){task.pollError=`请求 ${packed.n} 张，上游返回 ${items.length} 张；未自动补发`;task.submissionUnknown=!items.length;}
  task.revision++;
  await save(); // Persist generated media before billing or returning the HTTP response.
  const actualCost=items.length===packed.n?cost:items.length?await price(env.DB,{modelId:packed.model,kind:'image',count:items.length}):0;
  try{if(actualCost)await deduct(env.DB,user.id,actualCost,{resourceType:'generation',modelId:packed.model,requestId});}
  catch{task.pollError=(task.pollError?task.pollError+'；':'')+'结果已保存，积分记账待核对';task.revision++;await save();}
  return {ok:true,task,url:items[0]?.url,data:items,taskId:requestId,status:task.status};
 }catch(error){
  // Keep any stored output even if the database/billing response was interrupted.
  if(!task.upstreams.length){task.status=error.status>=400&&error.status<500?'failed':'unknown';task.submissionUnknown=task.status==='unknown';task.pollError=error.message;task.revision++;if(task.status==='failed')task.upstreams=[{ok:false,error:error.message}];await save();}
  return {ok:true,task};
 }
}
