// Runtime UI may show all activities. Model tools must only see their own session.
export function scopeRuntimeState(response, conversationId) {
  const wrapped = response?.data && typeof response.data === 'object';
  const data = wrapped ? response.data : response;
  if (!data || typeof data !== 'object' || response?.ok === false) return response;
  const own = record => Boolean(conversationId) && record?.conversationId === conversationId;
  const scoped = {
    ...data,
    requests: (data.requests || []).filter(own),
    workflows: (data.workflows || []).filter(own),
    codexActivities: (data.codexActivities || []).filter(own),
    scope: {conversationId: conversationId || null, note: '仅本会话记录；空列表表示没有本会话执行证据，不能推断工程已写入、校验失败或有待审批。其他会话的工程必须重新检查文件。'},
  };
  return wrapped ? {...response, data: scoped} : scoped;
}
