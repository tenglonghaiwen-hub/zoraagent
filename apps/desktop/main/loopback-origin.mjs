// Keep the original browser origin (IndexedDB/localStorage) when its TCP port is busy.
export function loopbackHandler(originPort,backendPort,{forward,external}) {
 const origin=`http://127.0.0.1:${originPort}`,backend=`http://127.0.0.1:${backendPort}`;
 return async request=>{
  const url=new URL(request.url);
  if(url.origin!==origin)return external(request);
  const headers=new Headers(request.headers);
  const source=headers.get('origin');
  if(source&&source!==origin)return new Response('Forbidden',{status:403});
  if(source)headers.set('origin',backend);
  headers.delete('host');headers.delete('content-length');
  // Do not follow redirects carrying account credentials away from loopback.
  return forward(backend+url.pathname+url.search,{method:request.method,headers,
   ...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{}),signal:request.signal,redirect:'manual'});
 };
}
