import {resolveProviderConfig} from './proxy.mjs';
import {publishModelCapability,assertConfiguredOperation} from '../../../packages/contracts/model-capability.mjs';
import {packH3Operation,normalizeH3Result} from '../../../packages/duoyuanx/h3-operations.mjs';

const fail=(message,status=400)=>Object.assign(Error(message),{status});
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(id);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
async function rowFor(env,userId,id){return env.DB.prepare('SELECT * FROM generation_receipts WHERE user_id = ? AND request_id = ?').bind(userId,id).first();}
async function modelFor(env,user,modelId){
 const row=await env.DB.prepare('SELECT * FROM server_models WHERE id = ?').bind(modelId).first();
 if(!row?.enabled)throw fail('模型未开放',403);
 if(row.vip_only&&(!user.isVip||user.vipExpiresAt&&new Date(user.vipExpiresAt).getTime()<Date.now()))throw fail('此模型需要 VIP',403);
 const model=publishModelCapability(row);
 if(!model.available||model.provider!=='duoyuanx'||model.family!=='minimax'||model.id!=='MiniMax-H3'||model.route!=='/v2/video_generation'||model.queryRoute!=='/v2/query/video_generation/{task_id}')throw fail('请配置多元 MiniMax 官方格式及 v2 生成/查询路由',403);
 return model;
}
async function configuration(env,deps){
 const config=await (deps.config||resolveProviderConfig)(env,'duoyuanx');
 if(!config.apiKey)throw fail('服务端未配置多元密钥',503);
 return {...config,baseUrl:config.baseUrl.replace(/\/+$/,'').replace(/\/v[12]$/,'')};
}
async function prepare(body,user,env,deps){
 const model=await modelFor(env,user,body.modelId||body.model);
 const config=await configuration(env,deps);
 let sourceTaskId;
 if(body.sourceReceiptId){
  if(!validId(body.sourceReceiptId))throw fail('源任务回执编号无效');
  const sourceRow=await rowFor(env,user.id,body.sourceReceiptId),source=sourceRow&&JSON.parse(sourceRow.task_json);
  if(!source||source.executor!=='h3-v2'||source.modelId!==model.id||source.outputKind!=='video'||source.status!=='completed'||source.baseUrl!==config.baseUrl)throw fail('请选择此账号已完成的同供应商视频任务；旧任务请使用源视频方式',409);
  sourceTaskId=source.upstreamTaskId;
 }
 const operation=body.h3Operation||'generate';
 if(operation!=='remix'&&body.sourceReceiptId)throw fail('只有再生成可以使用源任务');
 if(operation==='generate'||operation==='enhance')assertConfiguredOperation(model,body);
 if(operation==='remix'&&!model.resolutions.includes('2K'))throw fail('后台未开放 2K 输出',403);
 const input={...body};
 // Existing generate drafts already contain validated canonical routing fields.
 if(operation==='generate')for(const key of ['route','apiRoute','queryRoute','provider'])delete input[key];
 const packed=packH3Operation(input,model,sourceTaskId);
 const cost=operation==='generate'?Number(model.quota_cost_per_unit):model.capability.h3OperationCosts?.[operation];
 if(!Number.isInteger(cost)||cost<0)throw fail('后台尚未配置此操作的积分价格，请管理员配置 h3OperationCosts.'+operation,409);
 return {model,config,packed,cost};
}
export async function previewH3Task(body,user,env,deps={}){
 const {packed,cost}=await prepare(body,user,env,deps);
 return {ok:true,operation:packed.operation,route:packed.path,cost,outputKind:packed.operation==='enhance'?'text':'video',requiresSubmission:true};
}
const publicTask=task=>{const {baseUrl,...rest}=task;return rest;};
async function save(env,userId,task){task.revision++;await env.DB.prepare('UPDATE generation_receipts SET task_json = ?, updated_at = ? WHERE user_id = ? AND request_id = ?').bind(JSON.stringify(task),Date.now(),userId,task.id).run();}
async function refund(env,userId,task){
 const predicate="user_id = ? AND request_id = ? AND json_extract(task_json,'$.billing') = 'reserved' AND json_extract(task_json,'$.status') != 'completed'";
 await env.DB.batch([
  env.DB.prepare(`UPDATE users SET quota_balance = quota_balance + ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM generation_receipts WHERE ${predicate})`).bind(task.cost,Date.now(),userId,userId,task.id),
  env.DB.prepare(`INSERT INTO usage_logs (id,user_id,resource_type,model_id,quota_cost,request_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM generation_receipts WHERE ${predicate})`).bind(crypto.randomUUID(),userId,'h3-refund',task.modelId,-task.cost,task.id,Date.now(),userId,task.id),
  env.DB.prepare(`UPDATE generation_receipts SET task_json = json_set(task_json,'$.billing','released') WHERE ${predicate}`).bind(userId,task.id)
 ]);
 task.billing='released';
}
export async function submitH3Task(body,user,env,deps={}){
 const requestId=body.requestId;
 if(!validId(requestId))throw fail('需要稳定的 requestId，未知结果不得换编号重试');
 // Identity is independent of later model/price/host changes, so retries recover the original receipt.
 const fingerprint=await digest({...body,requestId:undefined});
 const existing=await rowFor(env,user.id,requestId);
 if(existing){if(existing.fingerprint!==fingerprint)throw fail('请求编号已用于其他参数',409);return {ok:true,task:publicTask(JSON.parse(existing.task_json))};}
 const {model,config,packed,cost}=await prepare(body,user,env,deps);
 if(packed.operation!=='generate'&&body.expectedCost!==cost)throw fail('请先预览报价并确认本次费用；价格变化后需重新确认',409);
 const task={id:requestId,executor:'h3-v2',modelId:model.id,operation:packed.operation,outputKind:packed.operation==='enhance'?'text':'video',status:'running',revision:1,createdAt:Date.now(),upstreams:[],provider:'duoyuanx',baseUrl:config.baseUrl,route:packed.path,queryRoute:packed.queryRoute,cost,billing:'pending',resolution:packed.body.resolution,sourceReceiptId:body.sourceReceiptId};
 const inserted=await env.DB.prepare('INSERT OR IGNORE INTO generation_receipts (user_id,request_id,fingerprint,task_json,updated_at) VALUES (?,?,?,?,?)').bind(user.id,requestId,fingerprint,JSON.stringify(task),Date.now()).run();
 if(!inserted.meta?.changes)return submitH3Task(body,user,env,deps);
 const reserved={...task,billing:'reserved'};
 // D1 batch is transactional. Reserve before any upstream side effect, with a balance guard.
 // Only the INSERT winner reaches this block; a retried request only reads the receipt.
 const limit=Math.max(1,Number(model.max_concurrency)||2),userLimit=Math.max(1,Number(user.concurrencyLimit)||2);
 await env.DB.batch([
  env.DB.prepare("UPDATE users SET quota_balance = quota_balance - ?, updated_at = ? WHERE id = ? AND quota_balance >= ? AND (SELECT COUNT(*) FROM generation_receipts WHERE json_extract(task_json,'$.modelId') = ? AND json_extract(task_json,'$.billing') = 'reserved') < ? AND (SELECT COUNT(*) FROM generation_receipts WHERE user_id = ? AND json_extract(task_json,'$.billing') = 'reserved') < ?").bind(cost,Date.now(),user.id,cost,model.id,limit,user.id,userLimit),
  env.DB.prepare('UPDATE generation_receipts SET task_json = ? WHERE user_id = ? AND request_id = ? AND changes() = 1').bind(JSON.stringify(reserved),user.id,requestId),
  env.DB.prepare("INSERT INTO usage_logs (id,user_id,resource_type,model_id,quota_cost,request_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM generation_receipts WHERE user_id = ? AND request_id = ? AND json_extract(task_json,'$.billing') = 'reserved')").bind(crypto.randomUUID(),user.id,'h3-'+packed.operation,model.id,cost,requestId,Date.now(),user.id,requestId)
 ]);
 Object.assign(task,JSON.parse((await rowFor(env,user.id,requestId)).task_json));
 if(task.billing!=='reserved'){task.status='failed';task.pollError='积分不足或模型并发已满；未请求上游';task.upstreams=[{ok:false,error:task.pollError}];await save(env,user.id,task);return {ok:true,task:publicTask(task)};}
 try{
  const response=await (deps.fetch||fetch)(config.baseUrl+packed.path,{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},body:JSON.stringify(packed.body),signal:AbortSignal.timeout(30000),redirect:'error'});
  const data=await response.json();
  if(!response.ok)throw fail(String(data.error?.message||data.message||'上游请求失败'),response.status);
  if(typeof data.task_id!=='string'||!data.task_id)throw fail('未返回 task_id，提交结果未知',502);
  task.upstreamTaskId=data.task_id;task.status='running';task.upstreams=[{ok:true,taskId:data.task_id}];
  await save(env,user.id,task);
 }catch(error){
  if(!task.upstreamTaskId){task.status=error.status>=400&&error.status<500?'failed':'unknown';task.submissionUnknown=task.status==='unknown';task.pollError=error.message;if(task.status==='failed'){await refund(env,user.id,task);task.upstreams=[{ok:false,error:error.message}];}await save(env,user.id,task);}
  else throw error; // Never hide receipt persistence failure or replay the POST.
 }
 return {ok:true,task:publicTask(task)};
}
export async function queryH3Task(requestId,user,env,deps={}){
 if(!validId(requestId))throw fail('任务编号无效');
 const row=await rowFor(env,user.id,requestId);if(!row)return null;
 const task=JSON.parse(row.task_json);if(task.executor!=='h3-v2')return null;
 if(['completed','failed'].includes(task.status))return publicTask(task);
 if(!task.upstreamTaskId){return publicTask({...task,...Date.now()-task.createdAt>60000?{status:'unknown',submissionUnknown:true,pollError:'提交结果待核对，未重复提交'}:{}});}
 const config=await configuration(env,deps);
 if(config.baseUrl!==task.baseUrl)return publicTask({...task,pollError:'供应商地址已变更，不能将原任务发往新地址'});
 try{
  const response=await (deps.fetch||fetch)(task.baseUrl+task.queryRoute.replace('{task_id}',encodeURIComponent(task.upstreamTaskId)),{headers:{Authorization:'Bearer '+config.apiKey},signal:AbortSignal.timeout(10000),redirect:'error'});
  const data=await response.json();if(!response.ok)throw fail(data.error?.message||data.message||'查询失败',response.status);
  if(data.task?.id!==task.upstreamTaskId)throw fail('查询返回了其他任务，拒绝覆盖原任务',502);
  const result=normalizeH3Result(data,task.operation);
  task.status=result.status==='processing'?'running':result.status;task.pollError=result.error;task.enhancedPrompt=result.prompt;
  task.upstreams=[result.url?{ok:true,taskId:task.upstreamTaskId,url:result.url}:result.status==='failed'?{ok:false,taskId:task.upstreamTaskId,error:result.error}:{ok:true,taskId:task.upstreamTaskId}];
  if(task.status==='failed')await refund(env,user.id,task);
  if(task.status==='completed')task.billing='charged';
  task.revision++;
  // A late concurrent poll may not overwrite a newer/terminal receipt.
  await env.DB.prepare('UPDATE generation_receipts SET task_json = ?, updated_at = ? WHERE user_id = ? AND request_id = ? AND task_json = ?').bind(JSON.stringify(task),Date.now(),user.id,task.id,task.billing==='released'?JSON.stringify({...JSON.parse(row.task_json),billing:'released'}):row.task_json).run();
  return publicTask(JSON.parse((await rowFor(env,user.id,requestId)).task_json));
 }catch(error){return publicTask({...task,pollError:error.message});}
}
