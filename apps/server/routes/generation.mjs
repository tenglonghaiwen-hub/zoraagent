import { validateDraft } from '../../../packages/contracts/domain.mjs';
import { packGenerateRequest } from '../../../packages/duoyuanx/generation-adapters.mjs';
import { generateBatch } from '../../../packages/duoyuanx/generation-service.mjs';
import { agentStatus } from '../codex-agent.mjs';
import { AGENT_TOOL_DEFS } from '../../../packages/agent/tools.mjs';
import { listAllowedApis } from '../../../packages/agent/api.mjs';

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
    sendJson(res, 200, { draft: result.draft, message: result.message, packed });
    return true;
  }

  // Generate
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    const body = await readJson(req);
    const result = validateDraft(body);
    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
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
        sendJson(res, 202, { task: taskStore().submit(body.requestId, result.draft, result.model) });
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
      sendJson(res, success.length ? 200 : 502, {
        draft: result.draft,
        upstream: results.length === 1 ? results[0].upstream : undefined,
        upstreams: results,
        queryRoute: result.model.queryRoute,
        error: success.length ? undefined : results[0]?.error,
        message: '批次已处理',
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

  // Chat
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    const receivedAt = Date.now();
    const requestTag = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.log(JSON.stringify({
      event: 'chat-request-start',
      requestTag,
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
      sendJson(res, 200, result);
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
