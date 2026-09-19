import { AGENT_TOOL_DEFS } from '../../../packages/agent/tools.mjs';
import { MAIN_AGENT_TOOL_DEFS } from '../../../packages/agent/media-subagents.mjs';
import { disabledTools, setToolEnabled } from '../../../packages/agent/tool-preferences.mjs';
import { peekKernel } from '../../../packages/agent/codex-kernel.mjs';

/**
 * Handle /api/local-runtime/* routes.
 * Returns true if the request was handled.
 */
export async function handleLocalRuntimeRoutes(req, res, url, { sendJson, readJson, runtime, workflows }) {
  if (!url.pathname.startsWith('/api/local-runtime')) return false;

  const address = req.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) {
    sendJson(res, 403, { error: '本机执行仅允许本机访问' });
    return true;
  }
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
    sendJson(res, 403, { error: '拒绝跨来源执行请求' });
    return true;
  }

  // Tool management
  if (url.pathname === '/api/local-runtime/tools') {
    const catalog = [
      ...new Map(
        [...AGENT_TOOL_DEFS, ...MAIN_AGENT_TOOL_DEFS].map((t) => [t.name, t]),
      ).values(),
    ];
    if (req.method === 'POST') {
      if (req.headers['x-zora-approval'] !== 'user') {
        sendJson(res, 403, { error: '需要用户设置工具' });
        return true;
      }
      const body = await readJson(req);
      setToolEnabled(body.name, body.enabled, catalog.map((t) => t.name));
      peekKernel()?.loaded.clear();
    }
    const disabled = disabledTools();
    sendJson(res, 200, {
      tools: catalog.map((t) => ({
        name: t.name,
        description: t.description,
        enabled: !disabled.has(t.name),
      })),
    });
    return true;
  }

  // Approval mode
  if (url.pathname === '/api/local-runtime/codex/approval-mode') {
    const kernel = peekKernel();
    if (!kernel) {
      sendJson(res, 503, { error: 'Codex 尚未初始化' });
      return true;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, { mode: kernel.getApprovalMode() });
      return true;
    }
    if (req.method === 'POST') {
      if (req.headers['x-zora-approval'] !== 'user') {
        sendJson(res, 403, { error: '需要用户选择审批模式' });
        return true;
      }
      const body = await readJson(req);
      sendJson(res, 200, kernel.setApprovalMode(body.mode));
      return true;
    }
  }

  // Steer running task
  if (req.method === 'POST' && url.pathname === '/api/local-runtime/codex/steer') {
    const body = await readJson(req);
    sendJson(res, 200, await peekKernel()?.steer(body.conversationId, body.text));
    return true;
  }

  // Interrupt running task
  if (req.method === 'POST' && url.pathname === '/api/local-runtime/codex/interrupt') {
    const body = await readJson(req);
    sendJson(res, 200, await peekKernel()?.interrupt(body.conversationId));
    return true;
  }

  // Runtime status
  if (req.method === 'GET' && url.pathname === '/api/local-runtime') {
    sendJson(res, 200, {
      ...(await runtime().status()),
      codexActivities: peekKernel()?.listActivities() || [],
      requests: [...runtime().list(), ...(peekKernel()?.listApprovals() || [])],
      workflows: workflows().list(),
    });
    return true;
  }

  // Propose local action
  if (req.method === 'POST' && url.pathname === '/api/local-runtime/propose') {
    sendJson(res, 200, runtime().propose(await readJson(req)));
    return true;
  }

  // Create workflow
  if (req.method === 'POST' && url.pathname === '/api/local-runtime/workflows') {
    const r = workflows().create(await readJson(req));
    await workflows().tick();
    sendJson(res, 200, r);
    return true;
  }

  // Approval actions
  const action = url.pathname.match(
    /^\/api\/local-runtime\/requests\/([\w-]+)\/(approve|deny|delete|respond|cancel|approve-session)$/,
  );
  if (req.method === 'POST' && action) {
    if (req.headers['x-zora-approval'] !== 'user') {
      sendJson(res, 403, { error: '操作需要用户在审批面板确认' });
      return true;
    }
    if (action[1].startsWith('codex-')) {
      sendJson(res, 200, peekKernel().decide(action[1], action[2], await readJson(req)));
      return true;
    }
    if (!['approve', 'deny', 'delete'].includes(action[2])) {
      sendJson(res, 400, { error: '此记录不支持该操作' });
      return true;
    }
    const result = action[2] === 'delete'
      ? runtime().deleteRecord(action[1])
      : action[2] === 'approve'
        ? await runtime().approve(action[1])
        : runtime().deny(action[1]);
    await workflows().tick();
    sendJson(res, 200, result);
    return true;
  }

  sendJson(res, 404, { error: '执行接口不存在' });
  return true;
}
