/**
 * Local runtime tool handlers (execution, approval, workflows)
 */

export async function handleRuntimeTool(name, args, callApi, { conversationId, messageId } = {}) {
  if (typeof callApi !== 'function') {
    return { ok: false, error: '本机执行层未就绪' };
  }

  if (name === 'local_runtime_status') {
    return callApi({ method: 'GET', path: '/api/local-runtime' });
  }

  if (name === 'propose_local_action') {
    return callApi({
      method: 'POST',
      path: '/api/local-runtime/propose',
      body: { ...args, conversationId, messageId },
    });
  }

  if (name === 'plan_local_workflow') {
    return callApi({
      method: 'POST',
      path: '/api/local-runtime/workflows',
      body: { ...args, conversationId, messageId },
    });
  }

  return undefined;
}
