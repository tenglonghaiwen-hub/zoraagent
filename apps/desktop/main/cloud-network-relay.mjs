import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const CLOUD_ORIGIN='https://zora-api.tenglonghaiwen.workers.dev';
// Fixed destination, per-launch secret path; never an arbitrary URL proxy.
export async function startCloudRelay(fetchImpl) {
 const secret=randomBytes(32).toString('hex'), active=new Set();
 const server=http.createServer(async(req,res)=>{
  if(req.headers.origin || !req.url.startsWith('/'+secret+'/api/')) {res.writeHead(403).end();return;}
  const target=new URL(req.url.slice(secret.length+1),CLOUD_ORIGIN);
  if(target.origin!==CLOUD_ORIGIN || !target.pathname.startsWith('/api/')) {res.writeHead(403).end();return;}
  const controller=new AbortController();active.add(controller);
  const abort=()=>controller.abort();res.once('close',abort);
  try {
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>64*1024*1024)throw Error('请求素材超过 64 MiB');chunks.push(chunk);}
   const headers={};for(const key of ['authorization','content-type','accept','x-request-id','idempotency-key'])if(req.headers[key])headers[key]=req.headers[key];
   const response=await fetchImpl(target.href,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),signal:controller.signal,redirect:'manual',credentials:'omit'});
   if(response.status>=300&&response.status<400)throw Error('云服务返回重定向，未转发账号凭据');
   res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
   if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
  }catch(error){
   if(!res.headersSent&&!res.destroyed){const code=String(error.message||'').match(/net::ERR_[A-Z_]+/)?.[0]||'NETWORK_ERROR';res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:`云端连接失败（${code}）。请在设置中检测网络连接。`}));}
   else res.destroy();
  }finally{active.delete(controller);res.off('close',abort);}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}/${secret}`,close(){for(const c of active)c.abort();server.closeAllConnections();server.close();}};
}
