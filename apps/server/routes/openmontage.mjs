import {
  openMontageStatus,
  listProjects as omListProjects,
  getProject as omGetProject,
  executeTool as omExecuteTool,
  startSidecar as omStartSidecar,
  stopSidecar as omStopSidecar,
  healthCheck as omHealth,
  listOmTools,
  listOmSkills,
  getOmSkill,
} from '../../../packages/adapters/openmontage.mjs';

/**
 * Handle /api/om/* routes for OpenMontage sidecar bridge.
 * Returns true if the request was handled.
 */
export async function handleOpenMontageRoutes(req, res, url, { sendJson, readJson }) {
  if (!url.pathname.startsWith('/api/om/')) return false;

  if (req.method === 'GET' && url.pathname === '/api/om/status') {
    sendJson(res, 200, openMontageStatus());
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/om/tools') {
    sendJson(res, 200, listOmTools({
      capability: url.searchParams.get('capability') || undefined,
      q: url.searchParams.get('q') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    }));
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/om/skills') {
    sendJson(res, 200, listOmSkills({
      category: url.searchParams.get('category') || undefined,
      q: url.searchParams.get('q') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    }));
    return true;
  }

  const skillMatch = url.pathname.match(/^\/api\/om\/skills\/(.+)$/);
  if (req.method === 'GET' && skillMatch) {
    const result = getOmSkill(decodeURIComponent(skillMatch[1]));
    sendJson(res, result.ok ? 200 : 404, result);
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/om/health') {
    const result = await omHealth();
    sendJson(res, result.ok ? 200 : 503, result);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/om/sidecar/start') {
    const body = await readJson(req).catch(() => ({}));
    const result = await omStartSidecar({ force: Boolean(body?.force) });
    sendJson(res, result.ok ? 200 : 500, result);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/om/sidecar/stop') {
    const result = await omStopSidecar();
    sendJson(res, 200, result);
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/om/projects') {
    const result = await omListProjects();
    sendJson(res, result.ok === false ? (result.status || 503) : 200, result);
    return true;
  }

  const projectMatch = url.pathname.match(/^\/api\/om\/projects\/([^/]+)$/);
  if (req.method === 'GET' && projectMatch) {
    const result = await omGetProject(decodeURIComponent(projectMatch[1]));
    sendJson(res, result.ok === false ? (result.status || 404) : 200, result);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/om/tools/execute') {
    const body = await readJson(req);
    const result = await omExecuteTool(body?.projectId, body);
    sendJson(res, result.ok === false ? (result.status || 500) : 200, result);
    return true;
  }

  return false;
}
