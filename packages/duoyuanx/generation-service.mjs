import {packGenerateRequest} from './generation-adapters.mjs';
import {normalizeMediaResults} from '../../apps/client/media-results.js';

// A shared limiter covers concurrent HTTP callers as well as one batch.
const active=new Map();
let total=0;
const waiting=[];
function drain(){for(let i=0;i<waiting.length;){const q=waiting[i];if(total>=4||(active.get(q.id)||0)>=q.limit){i++;continue;}waiting.splice(i,1);total++;active.set(q.id,(active.get(q.id)||0)+1);q.resolve(()=>{total--;active.set(q.id,active.get(q.id)-1);drain();});}}
function acquire(model){return new Promise(resolve=>{waiting.push({id:model.id,limit:Math.max(1,model.maxConcurrency||1),resolve});drain();});}

export async function generateBatch(draft,model,{fetchImpl=fetch,base,key,timeout=300000,onResult=()=>{},onRequest=()=>{}}={}){
 try{packGenerateRequest({...draft,count:1},model);}catch(e){const results=Array.from({length:draft.count},()=>({ok:false,error:e.message,submissionUnknown:false,errorPhase:'pre_submission'}));for(let i=0;i<results.length;i++)await onResult(i,results[i]);return results;} // Reject before upload without changing the receipt contract.
 if(model.family==='seedance'||model.family==='minimax'){
  const references=[];
  for(const reference of draft.references||[]){if(!reference.contentUrl.startsWith('data:')){references.push(reference);continue;}
   const match=reference.contentUrl.match(/^data:([^;]+);base64,(.+)$/);if(!match)throw Error('素材格式错误');
   const response=await fetchImpl(base+'/v1/file/upload',{method:'PUT',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({headers:{'Content-Type':match[1]},params:{}}),signal:AbortSignal.timeout(timeout)});
   const signed=await response.json();if(!response.ok||!/^https:\/\//.test(signed.upload_url||'')||!/^https:\/\//.test(signed.download_url||''))throw Error('素材上传地址申请失败');
   const uploaded=await fetchImpl(signed.upload_url,{method:'PUT',headers:{'Content-Type':match[1]},body:Buffer.from(match[2],'base64'),signal:AbortSignal.timeout(timeout)});if(!uploaded.ok)throw Error('参考素材上传失败');references.push({...reference,contentUrl:signed.download_url});
  }
  draft={...draft,references};
 }
 const results=Array(draft.count);let next=0;
 async function worker(){while(next<draft.count){const index=next++;const release=await acquire(model);let postStarted=false,httpStatus;try{
  const packed=packGenerateRequest({...draft,count:1,concurrency:1},model);
  const headers={Authorization:packed.authorizationScheme==='raw'?key:`Bearer ${key}`};let body;
  if(packed.contentType==='multipart'){body=new FormData();for(const [k,values] of Object.entries(packed.fields||{}))for(const v of Array.isArray(values)?values:[values]){if(v==null||v==='')continue;const match=String(v).match(/^data:([^;]+);base64,(.+)$/);if(k===packed.fileField){if(!match)throw Error('文件参考需先转换为内嵌素材');body.append(k,new Blob([Buffer.from(match[2],'base64')],{type:match[1]}),'reference.'+match[1].split('/')[1]);}else body.append(k,String(v));}}
  else{headers['Content-Type']='application/json';body=JSON.stringify(packed.body);}
  await onRequest(index,{method:'POST',path:packed.path,contentType:packed.contentType,body:JSON.parse(JSON.stringify(packed.body||packed.fields,(k,v)=>typeof v==='string'&&v.startsWith('data:')?'[内嵌素材已省略]':v)),recordedAt:Date.now()});
  postStarted=true;
  const response=await fetchImpl(base+packed.path,{method:'POST',headers,body,signal:AbortSignal.timeout(timeout)});
  httpStatus=response.status;
  const data=await response.json();if(!response.ok){const message=String(data.error?.message||data.error||data.message||`上游错误 ${response.status}`);if(packed.path==='/v2/video_generation'&&/prompt.*required/i.test(message))throw Error('H3 官方格式通道不兼容：请求已包含 content.text，但上游仍要求兼容格式的顶层 prompt。未自动改格式或重复提交。原始错误：'+message);throw Error(message);}
  const normalized=normalizeMediaResults(data);
  results[index]=normalized.urls.length||normalized.taskIds.length||normalized.errors.some(error=>error!=='任务已结束但未返回可用素材')
   ?{ok:true,upstream:data,queryRoute:packed.queryRoute,...(packed.authorizationScheme?{authorizationScheme:packed.authorizationScheme}:{})}
   :{ok:false,submissionUnknown:true,error:'上游响应没有可识别素材或任务编号，生成结果未知，请勿重复提交',errorPhase:'submission',httpStatus};
 }catch(e){results[index]={ok:false,error:e.message||'上游请求失败',submissionUnknown:postStarted&&!(httpStatus>=400&&httpStatus<500),errorPhase:postStarted?'submission':'pre_submission',...(httpStatus!==undefined?{httpStatus}:{})};}finally{release();}await onResult(index,results[index]);}}
 await Promise.all(Array.from({length:Math.min(draft.count,draft.concurrency,model.maxConcurrency||1)},worker));
 return results;
}
