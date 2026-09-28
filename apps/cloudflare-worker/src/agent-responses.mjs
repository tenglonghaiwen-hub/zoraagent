import {authenticateRequest,calculateQuotaCost,deductUserQuota} from './billing.mjs';
import {normalizeCallIdsWeb} from '../../../packages/agent/call-ids-web.mjs';
import {resolveProviderConfig} from './proxy.mjs';
import {toClaude,claudeJson,claudeStream} from './claude-responses.mjs';
import {toChat,chatJson,chatStream} from './chat-responses.mjs';
import {resolveModelCapability} from '../../../packages/contracts/model-capability.mjs';

// Codex owns tool execution and conversation state; this endpoint preserves Responses SSE.
export async function agentResponses(request,env,deps={}){
 const authenticate=deps.authenticate||authenticateRequest, price=deps.price||calculateQuotaCost, deduct=deps.deduct||deductUserQuota, config=deps.config||resolveProviderConfig, upstreamFetch=deps.fetch||fetch;
 const {user}=await authenticate(request,env);
 const body=await normalizeCallIdsWeb(await request.json());
 const model=await env.DB.prepare('SELECT * FROM server_models WHERE id = ?').bind(body.model).first();
 if(!model||!model.enabled||model.kind!=='agent')throw Object.assign(Error('Agent 模型未开放'),{status:403});
 if(model.vip_only && (!user.isVip || user.vipExpiresAt && new Date(user.vipExpiresAt).getTime()<Date.now()))throw Object.assign(Error('此模型需要 VIP'),{status:403});
 const cost=await price(env.DB,{modelId:body.model,kind:'agent',count:1});
 if(user.quotaBalance<cost)throw Object.assign(Error('积分不足'),{status:402});
 const {apiKey,baseUrl}=await config(env,model.provider||'duoyuanx');
 if(!baseUrl)throw Object.assign(Error('服务端未配置上游 Base 地址'),{status:503});
 if(!apiKey)throw Object.assign(Error('服务端未配置模型凭据'),{status:503});
 const capability=resolveModelCapability(model);
 if(capability.status!=='ready'||!('route' in capability))throw Object.assign(Error(capability.reason||'模型协议未就绪'),{status:400});
 const chat=capability.template==='chat-completions';
 const bridge=chat?toChat(body):capability.template==='claude-messages'?toClaude(body):null;
 const endpoint=baseUrl.replace(/\/+$/,'').replace(/\/v1$/,'')+capability.route;
 const response=await upstreamFetch(endpoint,{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',...(bridge&&!chat?{'anthropic-version':'2023-06-01'}:{})},body:JSON.stringify(bridge?.request||body),signal:request.signal});
 if(response.status>=300&&response.status<400)throw Object.assign(Error('上游地址发生重定向，请配置最终 API 地址'),{status:502});
 if(!response.ok)return new Response(await response.text(),{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')||'application/json'}});
 // Match existing gateway per-call pricing. No local/provider-key billing fallback.
 await deduct(env.DB,user.id,cost,{resourceType:'chat',modelId:body.model,requestId:crypto.randomUUID()});
 if(bridge){
  if(body.stream){
   if(!response.body||!response.headers.get('Content-Type')?.includes('text/event-stream'))throw Object.assign(Error('上游文字模型未返回预期的 SSE 流'),{status:502});
   return new Response((chat?chatStream:claudeStream)(response.body,bridge.names),{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store'}});
  }
  return Response.json((chat?chatJson:claudeJson)(await response.json(),bridge.names));
 }
 return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')||'text/event-stream','Cache-Control':'no-store'}});
}
