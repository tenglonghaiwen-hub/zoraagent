import { pathToFileURL } from 'node:url';

// Read-only capability probe: never loads server code, credentials, or task data.
export async function checkDeploymentReadiness(baseUrl = 'http://127.0.0.1:8787') {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Use an HTTP(S) base URL without credentials, query, or fragment.');
  }
  const endpoint = new URL('/api/generation-capabilities', base);
  try {
    const response = await fetch(endpoint, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, endpoint: endpoint.href, reason: `HTTP ${response.status}: capability endpoint unavailable` };
    const capabilities = await response.json();
    const ok = capabilities?.durableTasks === true && capabilities?.agentTasksVersion === 1;
    return { ok, endpoint: endpoint.href, reason: ok ? 'Task capability contract v1 available; production readiness is not certified.' : 'Expected durableTasks:true and agentTasksVersion:1; backend may be outdated.' };
  } catch (error) {
    return { ok: false, endpoint: endpoint.href, reason: `Capability check failed: ${error.name}` };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: node scripts/check-deployment-readiness.mjs [base-url]');
    const result = await checkDeploymentReadiness(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
