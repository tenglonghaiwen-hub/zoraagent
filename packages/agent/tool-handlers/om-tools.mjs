/**
 * OpenMontage tool handlers
 */

export async function handleOMTool(name, args, callApi) {
  if (typeof callApi !== 'function') {
    return { error: 'API 层未就绪' };
  }
  if(name==='om_list_pipelines')return callApi({method:'GET',path:'/api/om/pipelines'});
  if(name==='om_get_pipeline')return callApi({method:'GET',path:'/api/om/pipelines/'+encodeURIComponent(args.pipelineId||'')});
  if(name==='om_describe_tool')return callApi({method:'GET',path:'/api/om/tools/'+encodeURIComponent(args.tool||'')});

  if (name === 'om_status') {
    return callApi({ method: 'GET', path: '/api/om/status' });
  }

  if (name === 'om_list_projects') {
    return callApi({ method: 'GET', path: '/api/om/projects' });
  }

  if (name === 'om_execute_tool') {
    return callApi({
      method: 'POST',
      path: '/api/om/tools/execute',
      body: {
        projectId: args.projectId,
        tool: args.tool,
        args: args.args || {},
        idempotencyKey: args.idempotencyKey,
      },
    });
  }

  if (name === 'om_start_sidecar') {
    return callApi({ method: 'POST', path: '/api/om/sidecar/start', body: { force: Boolean(args.force) } });
  }

  if (name === 'om_stop_sidecar') {
    return callApi({ method: 'POST', path: '/api/om/sidecar/stop', body: {} });
  }

  if (name === 'om_get_project') {
    const id = encodeURIComponent(String(args.projectId || ''));
    return callApi({ method: 'GET', path: `/api/om/projects/${id}` });
  }

  if (name === 'om_list_tools') {
    const q = new URLSearchParams();
    if (args.capability) q.set('capability', String(args.capability));
    if (args.q) q.set('q', String(args.q));
    if (args.limit != null) q.set('limit', String(args.limit));
    const qs = q.toString();
    return callApi({ method: 'GET', path: '/api/om/tools' + (qs ? '?' + qs : '') });
  }

  if (name === 'om_list_skills') {
    const q = new URLSearchParams();
    if (args.category) q.set('category', String(args.category));
    if (args.q) q.set('q', String(args.q));
    if (args.limit != null) q.set('limit', String(args.limit));
    const qs = q.toString();
    return callApi({ method: 'GET', path: '/api/om/skills' + (qs ? '?' + qs : '') });
  }

  if (name === 'om_get_skill') {
    const id = encodeURIComponent(String(args.skillId || ''));
    return callApi({ method: 'GET', path: `/api/om/skills/${id}` });
  }

  return undefined;
}
