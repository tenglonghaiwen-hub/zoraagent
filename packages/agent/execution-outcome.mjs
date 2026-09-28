// Some generated wrappers log spawnSync's result but force their own exit code to 0.
// Interpret only the explicit {status, stdout, stderr} envelope, not arbitrary logs.
export function executionOutcome(result) {
  try {
    const child = JSON.parse(String(result.stdout || '').trim());
    if (child && typeof child === 'object' && !Array.isArray(child)
      && Number.isInteger(child.status) && child.status !== 0
      && typeof child.stdout === 'string' && typeof child.stderr === 'string') {
      return {status: 'failed', error: `子进程退出码：${child.status}；外层脚本结束不代表校验通过`,
        metadata: {childExitCode: child.status}, stdout: child.stdout, stderr: child.stderr};
    }
  } catch { /* Non-envelope output retains the actual outer process result. */ }
  return {status: 'completed', ...result};
}
