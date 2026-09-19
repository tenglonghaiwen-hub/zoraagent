// Keep actionable provider diagnostics without serializing arbitrary RPC payloads.
export function rpcError(error,method,key) {
 const clean=value=>{
  let text=String(value??'');
  if(key)text=text.split(key).join('[redacted]');
  return text.replace(/Bearer\s+[^\s"',;}]+/gi,'Bearer [redacted]')
   .replace(/\b(?:sk-|ghp_)[A-Za-z0-9_-]+/g,'[redacted]')
   .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi,'$1[redacted]').slice(0,2000);
 };
 const data=error?.data;
 const detail=typeof data==='string'?data:data?.message||data?.error?.message||data?.reason||data?.additionalDetails;
 const code=typeof error?.code==='number'?error.code:undefined;
 const message=[`Codex ${method||'请求'}失败${code===undefined?'':`（${code}）`}`,clean(error?.message||'Internal error'),detail?clean(detail):''].filter(Boolean).join('：');
 return Object.assign(Error(message),{code,rpcMethod:method});
}
