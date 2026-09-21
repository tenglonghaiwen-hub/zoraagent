/**
 * Agent-facing API whitelist: control plane + generation proxies.
 */

const ALLOWED = [
  { method: 'POST', pattern: /^\/api\/h3\/(preview|tasks)$/ },
  { method: 'GET', pattern: /^\/api\/h3\/tasks\/[a-zA-Z0-9_-]{16,100}$/ },
  { method: 'GET', pattern: /^\/api\/local-runtime$/ },
  { method: 'POST', pattern: /^\/api\/local-runtime\/(propose|workflows)$/ },
  { method: 'GET', pattern: /^\/api\/models$/ },
  { method: 'POST', pattern: /^\/api\/seedance\/assets\/prepare$/ },
  { method: 'GET', pattern: /^\/api\/seedance\/assets\/[a-zA-Z0-9_-]{16,100}$/ },
  { method: 'GET', pattern: /^\/api\/agent\/status$/ },
  { method: 'GET', pattern: /^\/api\/agent\/tools$/ },
  { method: 'GET', pattern: /^\/api\/duoyuanx\/status$/ },
  { method: 'POST', pattern: /^\/api\/preview$/ },
  { method: 'POST', pattern: /^\/api\/generate$/ },
  { method: 'GET', pattern: /^\/api\/generation-tasks\/[a-zA-Z0-9_-]{16,100}$/ },
  // RunningHub stubs + OpenMontage live sidecar bridge
  { method: 'GET', pattern: /^\/api\/rh\/status$/ },
  { method: 'GET', pattern: /^\/api\/rh\/workflows$/ },
  { method: 'POST', pattern: /^\/api\/rh\/tasks$/ },
  { method: 'GET', pattern: /^\/api\/rh\/tasks\/[^/]+$/ },
  { method: 'GET', pattern: /^\/api\/om\/status$/ },
  { method: 'GET', pattern: /^\/api\/om\/tools$/ },
  { method: 'GET', pattern: /^\/api\/om\/tools\/[a-z0-9_]+$/ },
  { method: 'GET', pattern: /^\/api\/om\/pipelines(?:\/[a-z0-9-]+)?$/ },
  { method: 'POST', pattern: /^\/api\/om\/pipelines\/prepare$/ },
  { method: 'POST', pattern: /^\/api\/om\/media\/import$/ },
  { method: 'GET', pattern: /^\/api\/om\/skills$/ },
  { method: 'GET', pattern: /^\/api\/om\/skills\/.+$/ },
  { method: 'GET', pattern: /^\/api\/om\/projects$/ },
  { method: 'GET', pattern: /^\/api\/om\/projects\/[^/]+$/ },
  { method: 'POST', pattern: /^\/api\/om\/tools\/execute$/ },
  { method: 'POST', pattern: /^\/api\/om\/sidecar\/start$/ },
  { method: 'POST', pattern: /^\/api\/om\/sidecar\/stop$/ },
  { method: 'GET', pattern: /^\/api\/om\/health$/ },
  // Generation / media upstream via local proxy
  { method: 'POST', pattern: /^\/api\/duoyuanx\/v1\/videos$/ },
  { method: 'GET', pattern: /^\/api\/duoyuanx\/v1\/videos\/[^/]+$/ },
  { method: 'POST', pattern: /^\/api\/duoyuanx\/v1\/images\/generations$/ },
  { method: 'POST', pattern: /^\/api\/duoyuanx\/v1\/video\/generations$/ },
  { method: 'GET', pattern: /^\/api\/duoyuanx\/v1\/video\/generations\/[^/]+$/ },
  { method: 'POST', pattern: /^\/api\/duoyuanx\/v1beta\/models\/[^:]+:generateContent$/ },
];

export function isAllowedAgentApi(method, path) {
  const m = String(method || '').toUpperCase();
  const p = String(path || '');
  if (!p.startsWith('/api/')) return false;
  if(m==='POST'&&p.startsWith('/api/duoyuanx/'))return false;
  const target=m==='GET'&&/^\/api\/om\/(tools|skills)\?/.test(p)?p.split('?')[0]:p;
  return ALLOWED.some((rule) => rule.method === m && rule.pattern.test(target));
}

export function createLocalApiCaller({ port, host = '127.0.0.1' }) {
  return async function callApi({ method, path, body }) {
    if (!isAllowedAgentApi(method, path)) {
      return { ok: false, error: '该 API 不在 Agent 白名单' };
    }
    const url = `http://${host}:${port}${path}`;
    const init = {
      method,
      headers: { Accept: 'application/json' },
    };
    if (method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body || {});
    }
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 4000) };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  };
}

export function listAllowedApis() {
  return ALLOWED.map((r) => ({ method: r.method, path: String(r.pattern) }));
}
