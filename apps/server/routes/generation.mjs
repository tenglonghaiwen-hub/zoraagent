import {createChatService} from '../chat-service.mjs';
import {createLocalApiCaller} from '../../../packages/agent/api.mjs';
import {cloudToolApi} from '../cloud-agent-api.mjs';
const cloudChats=new Map();
let cloudChatBusy=false;
import {cloudAgentContext,CLOUD_AGENT_GATEWAY} from '../cloud-agent-context.mjs';
import {configureCloudKernel} from '../../../packages/agent/codex-kernel.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import { validateDraft } from '../../../packages/contracts/domain.mjs';
import { packGenerateRequest } from '../../../packages/duoyuanx/generation-adapters.mjs';
import { generateBatch } from '../../../packages/duoyuanx/generation-service.mjs';
import { agentStatus } from '../codex-agent.mjs';
import { AGENT_TOOL_DEFS } from '../../../packages/agent/tools.mjs';
import { listAllowedApis } from '../../../packages/agent/api.mjs';
import {
  authenticateRequest,
  calculateQuotaCost,
  checkUserBalance,
  deductUserQuota,
} from '../../../packages/auth/index.mjs';

/**
 * Handle generation, preview, chat, and agent status routes.
 * Returns true if the request was handled.
 */
export async function handleGenerationRoutes(req, res, url, { sendJson, readJson, taskStore, handleChat }) {
  // Generation capabilities
  if (req.method === 'GET' && url.pathname === '/api/generation-capabilities') {
    sendJson(res, 200, { durableTasks: true, agentTasksVersion: 1 });
    return true;
  }

  // Single task lookup
  const taskMatch = url.pathname.match(/^\/api\/generation-tasks\/([a-zA-Z0-9_-]{16,100})$/);
  if (req.method === 'GET' && taskMatch) {
    const task = taskStore().get(taskMatch[1]);
    sendJson(res, task ? 200 : 404, task ? { task } : { error: '本地任务记录不存在；未重新提交生成' });
    return true;
  }

  // Preview draft
  if (req.method === 'POST' && url.pathname === '/api/preview') {
    const body = await readJson(req);
    const result = validateDraft(body);
    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
      return true;
    }
    let packed = null;
    try {
      packed = packGenerateRequest(result.draft, result.model);
    } catch {}
    let estimatedQuota = 1;
    try {
      estimatedQuota = await calculateQuotaCost({
        modelId: result.model.id,
        kind: result.model.kind || result.draft.kind,
        count: result.draft.count || 1,
      });
    } catch {}
    sendJson(res, 200, { draft: result.draft, message: result.message, packed, estimatedQuota });
    return true;
  }

  // Generate
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    let authUser = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.ZORA_TASK_STORE_DIR || process.env.ZORA_AUTH_OPTIONAL === 'true') {
        authUser = { id: 'test-local-user', quotaBalance: 999999 };
      } else {
        sendJson(res, 401, {
          ok: false,
          error: '需要登录后使用生成服务',
          category: 'permission',
        });
        return true;
      }
    } else {
      try {
        const { user } = await authenticateRequest(req);
        authUser = user;
      } catch (err) {
        sendJson(res, err.status || 401, {
          ok: false,
          error: err.message || '身份验证失败，请重新登录',
          category: 'permission',
        });
        return true;
      }
    }

    const body = await readJson(req);
    const result = validateDraft(body);
    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
      return true;
    }

    // Calculate quota cost
    const modelId = result.model.id;
    const kind = result.model.kind || result.draft.kind || 'image';
    const count = result.draft.count || 1;
    const cost = await calculateQuotaCost({ modelId, kind, count });

    // Precheck quota balance
    const currentBalance = authUser.id === 'test-local-user'
      ? (authUser.quotaBalance || 999999)
      : await checkUserBalance(authUser.id);
    if (currentBalance < cost) {
      sendJson(res, 402, {
        ok: false,
        error: `积分余额不足（本次需要 ${cost} 积分，当前余额 ${currentBalance} 积分）`,
        category: 'resource',
        requiredQuota: cost,
        quotaBalance: currentBalance,
      });
      return true;
    }

    let packed;
    try {
      packed = packGenerateRequest(result.draft, result.model);
    } catch (e) {
      sendJson(res, 400, { error: String(e?.message || e) });
      return true;
    }
    const requiredKey = result.model.family === 'minimax'
      ? process.env.MINIMAX_API_KEY
      : process.env.DUOYUANX_API_KEY;
    if (!requiredKey) {
      sendJson(res, 503, {
        error: result.model.family === 'minimax'
          ? '未配置 MiniMax 官方 MINIMAX_API_KEY'
          : '未配置 DUOYUANX_API_KEY',
      });
      return true;
    }
    const base = (process.env.DUOYUANX_BASE_URL || 'https://duoyuanx.com').replace(/\/$/, '');
    if (body.requestId) {
      try {
        const task = taskStore().submit(body.requestId, result.draft, result.model);
        const newBalance = authUser.id === 'test-local-user'
          ? (authUser.quotaBalance || 999999)
          : await deductUserQuota(authUser.id, cost, {
            resourceType: 'generation',
            modelId,
            requestId: body.requestId,
          });
        sendJson(res, 202, { task, newBalance });
      } catch (e) {
        sendJson(res, e.status || 500, { error: e.message });
      }
      return true;
    }
    try {
      const results = await generateBatch(result.draft, result.model, {
        base,
        key: process.env.DUOYUANX_API_KEY,
      });
      const success = results.filter((r) => r.ok);
      let newBalance = currentBalance;
      if (success.length > 0) {
        const actualCost = Math.round((cost / count) * success.length);
        newBalance = authUser.id === 'test-local-user'
          ? (authUser.quotaBalance || 999999)
          : await deductUserQuota(authUser.id, actualCost, {
            resourceType: 'generation',
            modelId,
            requestId: body.requestId || null,
          });
      }
      sendJson(res, success.length ? 200 : 502, {
        draft: result.draft,
        upstream: results.length === 1 ? results[0].upstream : undefined,
        upstreams: results,
        queryRoute: result.model.queryRoute,
        error: success.length ? undefined : results[0]?.error,
        message: '批次已处理',
        newBalance,
      });
    } catch (e) {
      sendJson(res, 502, { error: String(e?.message || e) });
    }
    return true;
  }

  // Agent status
  if (req.method === 'GET' && url.pathname === '/api/agent/status') {
    sendJson(res, 200, agentStatus());
    return true;
  }

  // Agent tools
  if (req.method === 'GET' && url.pathname === '/api/agent/tools') {
    sendJson(res, 200, {
      foundation: 'codex',
      tools: AGENT_TOOL_DEFS,
      apis: listAllowedApis(),
      note: '工具、技能与 API 白名单；含图片/视频生成代理路径',
    });
    return true;
  }

  // Cloud-authenticated desktop execution. Only the fixed gateway receives the JWT.
  if(req.method==='POST' && url.pathname==='/api/agent/chat'){
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){sendJson(res,403,{error:'仅允许本机同源执行'});return true;}
    if(cloudChatBusy){sendJson(res,409,{error:'Agent 正在处理另一条消息'});return true;}
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!token){sendJson(res,401,{error:'请先登录云服务'});return true;}
    cloudChatBusy=true;
    try{
      const profile=await fetch(CLOUD_AGENT_GATEWAY+'/api/auth/me',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
      const data=await profile.json();if(!profile.ok)throw Object.assign(Error(data.error||'云端登录验证失败'),{status:profile.status});
      const user=data.user||data.data?.user; if(!user?.id)throw Error('云端用户信息缺少 id');
      const owner=createHash('sha256').update(String(user.id)).digest('hex').slice(0,24);
      const root=fileURLToPath(new URL('../../../',import.meta.url));
      const body=await readJson(req);
      const base=CLOUD_AGENT_GATEWAY+'/api/agent';
      await configureCloudKernel({home:path.join(root,'data','codex-cloud',owner),key:token,base:base+'/v1'});
      if(!cloudChats.has(owner))cloudChats.set(owner,createChatService({storageDirectory:path.join(root,'data','cloud-chat-sessions',owner),callApi:cloudToolApi(createLocalApiCaller({port:req.socket.localPort}))}));
      const result=await cloudAgentContext.run({token,base,owner},()=>cloudChats.get(owner)(body));
      sendJson(res,200,result);
    }catch(error){sendJson(res,error.status||502,{error:error.message,tasks:[],reply:''});}finally{cloudChatBusy=false;}
    return true;
  }

  // Chat
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    if (process.env.ZORA_AGENT_ENABLED === 'false') {
      sendJson(res, 503, { error: '主 Agent 尚未配置或启用' });
      return true;
    }

    let authUser = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, {
        ok: false,
        error: '需要登录后使用 Agent 对话服务',
        category: 'permission',
      });
      return true;
    } else {
      try {
        const { user } = await authenticateRequest(req);
        authUser = user;
      } catch (err) {
        sendJson(res, err.status || 401, {
          ok: false,
          error: err.message || '身份验证失败，请重新登录',
          category: 'permission',
        });
        return true;
      }
    }

    const chatCost = 1;
    const currentBalance = await checkUserBalance(authUser.id);
    if (currentBalance < chatCost) {
      sendJson(res, 402, {
        ok: false,
        error: `积分余额不足（对话需要 ${chatCost} 积分，当前余额 ${currentBalance} 积分）`,
        category: 'resource',
        requiredQuota: chatCost,
        quotaBalance: currentBalance,
      });
      return true;
    }

    const receivedAt = Date.now();
    const requestTag = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.log(JSON.stringify({
      event: 'chat-request-start',
      requestTag,
      userId: authUser.id,
      time: new Date().toISOString(),
      bytes: req.headers['content-length'] || null,
    }));
    res.once('close', () =>
      console.log(JSON.stringify({
        event: res.writableFinished ? 'chat-request-finished' : 'chat-request-disconnected',
        requestTag,
        elapsedMs: Date.now() - receivedAt,
        status: res.statusCode,
      })),
    );
    const body = await readJson(req);
    try {
      const result = await handleChat(body);
      const newBalance = await deductUserQuota(authUser.id, chatCost, {
        resourceType: 'chat',
        modelId: 'gpt-5.5',
        requestId: requestTag,
      });
      sendJson(res, 200, {
        ...result,
        newBalance,
      });
    } catch (e) {
      const status = e?.status && Number.isInteger(e.status) ? e.status : 502;
      sendJson(res, status, {
        error: String(e?.message || e),
        conversationId: body?.conversationId || null,
        reply: '',
        tasks: [],
        foundation: 'codex',
      });
    }
    return true;
  }

  return false;
}
