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
  listOmPipelines,getOmPipeline,prepareOmPipeline,describeOmTool,importOmMedia,localMediaCapabilities,
} from '../../../packages/adapters/openmontage.mjs';
import {transcriptionPreparation} from '../../../packages/adapters/om-model-preparation.mjs';
import {saveOmPreferences} from '../../../packages/adapters/om-preferences.mjs';
import {saveStockCredentials} from '../../../packages/adapters/om-credentials.mjs';

/**
 * Handle /api/om/* routes for OpenMontage sidecar bridge.
 * Returns true if the request was handled.
 */
export async function handleOpenMontageRoutes(req, res, url, { sendJson, readJson }) {
  if (!url.pathname.startsWith('/api/om/')) return false;
  if(['/api/om/transcription-model','/api/om/capabilities','/api/om/preferences','/api/om/credentials'].includes(url.pathname)&&(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)){
    sendJson(res,403,{ok:false,error:'仅允许本机同源访问媒体设置'});return true;
  }
  if(url.pathname==='/api/om/transcription-model'&&['GET','POST'].includes(req.method)){
    try{const input=req.method==='GET'?{model:url.searchParams.get('model'),action:'status'}:await readJson(req);sendJson(res,200,transcriptionPreparation(input.model,input.action));}catch(error){sendJson(res,400,{error:error.message});}return true;
  }
  if(req.method==='PUT'&&url.pathname==='/api/om/credentials'){
    try{sendJson(res,200,{ok:true,credentials:saveStockCredentials(await readJson(req))});}
    catch{sendJson(res,400,{ok:false,error:'无法保存密钥。请检查密钥格式，并使用当前 Windows 账户重试。'});}return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/om/capabilities'){sendJson(res,200,await localMediaCapabilities());return true;}
  if(req.method==='PUT'&&url.pathname==='/api/om/preferences'){
    try{const preferences=saveOmPreferences(await readJson(req));sendJson(res,200,{ok:true,preferences});}
    catch(error){sendJson(res,400,{ok:false,error:error.message});}return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/om/media/import'){const result=await importOmMedia(await readJson(req));sendJson(res,result.ok?200:result.status||400,result);return true;}
  if(req.method==='GET'&&url.pathname==='/api/om/pipelines'){sendJson(res,200,listOmPipelines());return true;}
  if(req.method==='POST'&&url.pathname==='/api/om/pipelines/prepare'){const result=prepareOmPipeline(await readJson(req));sendJson(res,result.ok?200:result.status||400,result);return true;}
  if(req.method==='GET'&&/^\/api\/om\/pipelines\/[a-z0-9-]+$/.test(url.pathname)){const result=getOmPipeline(url.pathname.split('/').pop());sendJson(res,result.ok?200:404,result);return true;}
  if(req.method==='GET'&&/^\/api\/om\/tools\/[a-z0-9_]+$/.test(url.pathname)){const result=await describeOmTool(url.pathname.split('/').pop());sendJson(res,result.ok?200:result.status||400,result);return true;}

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
