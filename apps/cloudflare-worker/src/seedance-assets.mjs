import {resolveProviderConfig} from './proxy.mjs';
import {resolveModelCapability} from '../../../packages/contracts/model-capability.mjs';
const prefix='/v1/seedance/asset/';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
function publicHttps(value){
 let url;try{url=new URL(value);}catch{throw fail('素材需要公网 HTTPS 地址或内嵌文件');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.includes(':')||/^\d+(\.\d+){3}$/.test(host)||!host.includes('.'))throw fail('素材地址必须是公网 HTTPS 域名');
 return value;
}
function normalizeReferences(references){
 if(!Array.isArray(references)||!references.length||references.length>6)throw fail('请提供 1–6 个参考素材');
 if(references.reduce((n,r)=>n+(typeof r?.contentUrl==='string'?r.contentUrl.length:0),0)>28*1024*1024)throw fail('单次素材总大小超过 20 MiB，请使用公网 HTTPS 素材地址');
 return references.map((r,i)=>{
  if(!r||!/^image\/|^video\/|^audio\//.test(r.type||''))throw fail('不支持的素材类型');
  const url=r.contentUrl;
  if(typeof url!=='string')throw fail('参考素材缺失');
  if(url.startsWith('data:')){
   const match=/^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
   if(!match||match[1]!==r.type||match[2].length>28*1024*1024)throw fail('内嵌素材格式错误或超过 20 MiB');
  }else publicHttps(url);
  return {name:String(r.name||'素材'+(i+1)).slice(0,64),type:r.type,contentUrl:url};
 });
}
async function modelConfig(env,user,modelId,deps){
 const model=await env.DB.prepare('SELECT * FROM server_models WHERE id = ?').bind(modelId).first();
 if(!model||!model.enabled||resolveModelCapability(model).assetWorkflow!=='seedance-library-v1')throw fail('此模型尚未开放 Seedance 素材库工作流',403);
 if(model.vip_only&&(!user.isVip||user.vipExpiresAt&&new Date(user.vipExpiresAt).getTime()<Date.now()))throw fail('此模型需要 VIP',403);
 const config=await (deps.config||resolveProviderConfig)(env,model.provider||'duoyuanx');
 if(!config.apiKey)throw fail('服务端未配置素材接口凭据',503);
 return {model,...config,baseUrl:config.baseUrl.replace(/\/+$/,'').replace(/\/v1$/,'')};
}
const view=state=>({id:state.id,modelId:state.modelId,status:state.status,groupId:state.groupId,error:state.error,updatedAt:state.updatedAt,assets:state.assets.map(a=>({name:a.name,type:a.type,id:a.id,taskId:a.taskId,status:a.status,error:a.error})),next:state.status==='preparing'?'使用相同 requestId 继续 prepare_seedance_assets':state.status==='processing'?'使用 query_seedance_assets 查询，未全部 Active 前不要生成':state.status==='ready'?'submit_generation 携带 assetReceiptId':null});
async function read(env,userId,requestId){
 if(!id(requestId)||requestId.length<16)throw fail('无效素材请求编号');
 return env.DB.prepare('SELECT * FROM seedance_asset_receipts WHERE user_id = ? AND request_id = ?').bind(userId,requestId).first();
}
async function runLocked(env,userId,row,work){
 const token=crypto.randomUUID(),now=Date.now();
 const claim=await env.DB.prepare('UPDATE seedance_asset_receipts SET lease_token = ?, lease_until = ? WHERE user_id = ? AND request_id = ? AND lease_until < ?').bind(token,now+60000,userId,JSON.parse(row.state_json).id,now).run();
 if(!claim.meta?.changes)return view(JSON.parse((await read(env,userId,JSON.parse(row.state_json).id)).state_json));
 const current=await read(env,userId,JSON.parse(row.state_json).id),state=JSON.parse(current.state_json);
 const save=async()=>{state.updatedAt=Date.now();await env.DB.prepare('UPDATE seedance_asset_receipts SET state_json = ?, updated_at = ? WHERE user_id = ? AND request_id = ? AND lease_token = ?').bind(JSON.stringify(state),state.updatedAt,userId,state.id,token).run();};
 try{await work(state,save);await save();return view(state);}
 finally{await env.DB.prepare('UPDATE seedance_asset_receipts SET lease_until = 0, lease_token = NULL WHERE user_id = ? AND request_id = ? AND lease_token = ?').bind(userId,state.id,token).run();}
}
async function request(config,action,body,deps){
 const response=await (deps.fetch||fetch)(config.baseUrl+prefix+action,{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
 const data=await response.json();
 if(!response.ok||data.error||data.state!==1)throw fail(String(data.error?.message||data.error||'素材接口失败 '+response.status),response.ok?502:response.status);
 if(!data.data||typeof data.data!=='object')throw fail('素材接口返回格式无效',502);
 return data.data;
}
export async function prepareSeedanceAssets(body,user,env,deps={}){
 const references=normalizeReferences(body.references),requestId=body.requestId;
 if(!id(requestId)||requestId.length<16)throw fail('素材操作需要稳定的 requestId');
 const config=await modelConfig(env,user,body.modelId,deps);
 const fingerprint=await hash({modelId:body.modelId,references});
 let row=await read(env,user.id,requestId);
 if(!row){
  const state={id:requestId,modelId:body.modelId,provider:config.model.provider||'duoyuanx',baseUrl:config.baseUrl,status:'preparing',assets:references.map(r=>({name:r.name,type:r.type,url:r.contentUrl.startsWith('data:')?null:r.contentUrl,status:'pending'})),updatedAt:Date.now()};
  await env.DB.prepare('INSERT OR IGNORE INTO seedance_asset_receipts (user_id,request_id,fingerprint,state_json,updated_at) VALUES (?,?,?,?,?)').bind(user.id,requestId,fingerprint,JSON.stringify(state),Date.now()).run();
  row=await read(env,user.id,requestId);
 }
 if(row.fingerprint!==fingerprint)throw fail('此请求编号已用于其他素材，请保留原编号查询',409);
 return runLocked(env,user.id,row,async(state,save)=>{
  if(state.status!=='preparing')return;
  if(state.baseUrl!==config.baseUrl||state.provider!==(config.model.provider||'duoyuanx'))throw fail('供应商配置已变化，请先核对原素材任务',409);
  if(state.inflight){state.status='unknown';state.error='上次素材创建结果未知，未重复提交；请核对上游记录';return;}
  try{
   // One mutation per call; mark before sending. A lost response must never cause another create.
   if(!state.groupId){state.inflight='group';await save();const data=await request(config,'CreateAssetGroup',{Name:('Zora-'+requestId).slice(0,64),Description:'Zora 参考素材'},deps);if(!id(data.Id))throw fail('素材组未返回有效 Id',502);state.groupId=data.Id;}
   else{
    const index=state.assets.findIndex(a=>!a.taskId);if(index<0){state.status='processing';return;}
    const asset=state.assets[index];state.inflight='asset-'+index;await save();
    if(!asset.url){
     const content=references[index].contentUrl,match=/^data:([^;]+);base64,(.+)$/.exec(content);
     const fetcher=deps.fetch||fetch;
     const response=await fetcher(config.baseUrl+'/v1/file/upload',{method:'PUT',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},body:JSON.stringify({headers:{'Content-Type':match[1]},params:{}}),signal:AbortSignal.timeout(15000),redirect:'error'});
     const signed=await response.json();if(!response.ok)throw fail('申请素材上传地址失败',response.status);publicHttps(signed.upload_url);publicHttps(signed.download_url);
     const uploaded=await fetcher(signed.upload_url,{method:'PUT',headers:{'Content-Type':match[1]},body:Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0)),signal:AbortSignal.timeout(15000),redirect:'error'});
     if(!uploaded.ok)throw fail('素材上传失败',uploaded.status);asset.url=signed.download_url;
    }else{
     const data=await request(config,'CreateAsset',{GroupId:state.groupId,URL:asset.url,AssetType:asset.type.startsWith('image/')?'Image':asset.type.startsWith('video/')?'Video':'Audio',Name:asset.name},deps);
     if(!id(data.Id)||!id(data.task_id))throw fail('素材导入未返回有效 Id/task_id',502);
     asset.id=data.Id;asset.taskId=data.task_id;asset.status='Processing';
     if(state.assets.every(a=>a.taskId))state.status='processing';
    }
   }
   delete state.inflight;delete state.error;
  }catch(error){state.status=error.status>=400&&error.status<500?'failed':'unknown';state.error=error.message;}
 });
}
export async function querySeedanceAssets(requestId,user,env,deps={}){
 const row=await read(env,user.id,requestId);if(!row)throw fail('未找到此用户的素材任务',404);
 const prior=JSON.parse(row.state_json);
 if(prior.status!=='processing')return view(prior);
 const config=await modelConfig(env,user,prior.modelId,deps);
 if(prior.baseUrl!==config.baseUrl||prior.provider!==(config.model.provider||'duoyuanx'))throw fail('供应商配置已变化，不能查询原素材任务',409);
 return runLocked(env,user.id,row,async(state)=>{
  if(state.status!=='processing')return;
  const pending=state.assets.filter(a=>a.status!=='Active');
  const asset=pending[(state.pollIndex||0)%pending.length];if(!asset)return;
  state.pollIndex=(state.pollIndex||0)+1;
  try{
   const data=await request(config,'GetAsset',{task_id:asset.taskId},deps);
   if(data.Id!==asset.id||!['Processing','Active','Failed'].includes(data.Status))throw fail('素材查询返回未知状态或不匹配的 Id',502);
   asset.status=data.Status;asset.error=data.Error||undefined;delete state.error;
   if(data.Status==='Failed'){state.status='failed';state.error=data.Error||'素材审核失败';}
   else if(state.assets.every(a=>a.status==='Active'))state.status='ready';
  }catch(error){state.error=error.message;} // Query is safe to retry; never recreate.
 });
}
export async function resolveSeedanceReferences(body,user,env,deps={}){
 if(body.model&&body.modelId&&body.model!==body.modelId)throw fail('请求中的模型编号不一致');
 const row=await read(env,user.id,body.assetReceiptId);if(!row)throw fail('素材回执不存在',404);
 const state=JSON.parse(row.state_json),references=normalizeReferences(body.references);
 if(state.modelId!==(body.modelId||body.model)||row.fingerprint!==await hash({modelId:state.modelId,references}))throw fail('素材已更换或模型不匹配，请重新准备素材',409);
 if(state.status!=='ready')throw fail('素材尚未全部审核通过，未提交生成',409);
 const config=await modelConfig(env,user,state.modelId,deps);
 if(state.baseUrl!==config.baseUrl||state.provider!==(config.model.provider||'duoyuanx'))throw fail('供应商已变化，不能复用旧素材',409);
 return {...body,references:references.map((r,i)=>({...r,contentUrl:'asset://'+state.assets[i].id}))};
}
