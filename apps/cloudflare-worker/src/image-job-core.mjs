import {proxyGeneration} from './proxy.mjs';
import {calculateQuotaCost,deductUserQuota} from './billing.mjs';

// Chunk large image payloads instead of placing base64 images in a single D1 row.
export async function putLarge(storage,key,value){
 const text=JSON.stringify(value),chunks=Math.ceil(text.length/32000);
 await storage.transaction(async tx=>{
  for(let i=0;i<chunks;i++)await tx.put(key+':'+i,text.slice(i*32000,(i+1)*32000));
  await tx.put(key+':chunks',chunks);
 });
}
export async function getLarge(storage,key){
 return storage.transaction(async tx=>{
  const count=await tx.get(key+':chunks');if(count===undefined)return null;
  let text='';for(let i=0;i<count;i++)text+=await tx.get(key+':'+i);
  return JSON.parse(text);
 });
}
export class ImageJobCore {
 constructor(ctx,env,deps={}){this.ctx=ctx;this.env=env;this.generate=deps.generate||proxyGeneration;this.price=deps.price||calculateQuotaCost;this.deduct=deps.deduct||deductUserQuota;}
 async enqueue(job){
  if(this.enqueuing)return this.enqueuing;
  this.enqueuing=this.initialize(job);
  try{return await this.enqueuing;}finally{this.enqueuing=null;}
 }
 async initialize(job){
  const existing=await this.ctx.storage.get('job');
  if(existing){if(existing.fingerprint!==job.fingerprint)throw Error('任务参数冲突');if(existing.state==='queued'&&await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+10);return this.receipt();}
  await putLarge(this.ctx.storage,'input',job.input);
  await putLarge(this.ctx.storage,'receipt',job.task);
  const {input,task,...meta}=job;
  await this.ctx.storage.put('job',{...meta,next:0,state:'queued'});
  await this.ctx.storage.setAlarm(Date.now()+10);
  return job.task;
 }
 async receipt(){return getLarge(this.ctx.storage,'receipt');}
 async save(task,job){
  await putLarge(this.ctx.storage,'receipt',task);
  // D1 is an index; the durable object is authoritative for all output bytes.
  const index={...task,upstreams:[],resultCount:task.upstreams.length,executor:'durable-object'};
  try{await this.env.DB.prepare('UPDATE generation_receipts SET task_json = ?, updated_at = ? WHERE user_id = ? AND request_id = ?').bind(JSON.stringify(index),Date.now(),job.userId,task.id).run();}
  catch{console.error(JSON.stringify({event:'image_receipt_index_failed',requestId:task.id}));}
 }
 async alarm(){
  const storage=this.ctx.storage,job=await storage.get('job');if(!job||job.state==='done')return;
  const task=await this.receipt();
  if(['completed','partial','failed','unknown'].includes(task.status)){await storage.put('job',{...job,state:'done'});return;}
  if(job.state==='submitting'){
   task.status='unknown';task.submissionUnknown=true;task.pollError='上次提交后执行中断，未自动重发，已保留现有结果';task.revision++;
   await this.save(task,job);await storage.put('job',{...job,state:'done'});return;
  }
  const input=await getLarge(storage,'input'),n=input.n;
  const batch=input;
  job.state='submitting';await storage.put('job',job);
  // Watchdog does not repeat the POST: submitting is treated as unknown after a crash.
  await storage.setAlarm(Date.now()+12*60*1000);
  let items;
  try{
   const output=await this.generate({body:batch,env:this.env,provider:job.provider,route:job.route});
   items=Array.isArray(output.data)?output.data.filter(item=>item?.url||item?.b64_json):[];
  }catch(error){
   task.status=error.status>=400&&error.status<500?(task.upstreams.length?'partial':'failed'):'unknown';task.submissionUnknown=task.status==='unknown';task.pollError=error.message;task.revision++;
   if(!task.upstreams.length&&task.status==='failed')task.upstreams.push({ok:false,error:error.message});
   await this.save(task,job);await storage.put('job',{...job,state:'done'});return;
  }
  task.upstreams.push(...items.map(item=>({ok:true,upstream:item})));task.revision++;
  const received=task.upstreams.length;
  task.status=items.length===n?'completed':received?'partial':'unknown';
  if(items.length!==n){task.submissionUnknown=!received;task.pollError=`本批请求 ${n} 张，返回 ${items.length} 张；整套已收到 ${received}/${input.n} 张，未自动补发`;}
  await this.save(task,job); // Persist output before any billing or next generation.
  try{
   if(items.length){const cost=await this.price(this.env.DB,{modelId:input.model,kind:'image',count:items.length});await this.deduct(this.env.DB,job.userId,cost,{resourceType:'generation',modelId:input.model,requestId:task.id+'-'+job.next});}
  }catch{task.pollError=(task.pollError?task.pollError+'；':'')+'图片已保存，积分记账待核对';task.revision++;await this.save(task,job);}
  job.state='done';await storage.put('job',job);
 }
}
