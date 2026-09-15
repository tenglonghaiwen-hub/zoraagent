/** Reject old or unrelated services before loading the desktop client. */
export async function requireGenerationCapabilities(origin, { fetchImpl = fetch } = {}) {
  const url = new URL('/api/generation-capabilities', origin).href;
  let capabilities;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    capabilities = await response.json();
  } catch (error) {
    throw new Error(`无法确认 Zora 后端能力（${origin}）：${error.message}。请检查并重启对应的 Zora 后端，再打开软件。现有服务未被停止。`);
  }
  if (capabilities?.durableTasks !== true || !Number.isInteger(capabilities?.agentTasksVersion) || capabilities.agentTasksVersion < 1) {
    throw new Error(`Zora 后端版本不兼容（${origin}）。需要支持持久生成任务及 Agent 任务协议 v1。请更新并重启对应后端后再打开软件；仅重开桌面窗口不会更新已运行的后端。现有服务未被停止。`);
  }
  return capabilities;
}
