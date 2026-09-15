import {importedSkills,readImportedSkill} from './imported-skills.mjs';
/** Zora Agent tool registry: skills + preview/generate control + APIs. */
import {createHash, randomUUID} from 'node:crypto';
import {validateDraft} from '../contracts/domain.mjs';
import {getRouteCapabilities} from '../duoyuanx/route-capabilities.mjs';
import {callBrowser} from './browser-client.mjs';
import {callDesktop} from './desktop-client.mjs';

export const AGENT_TOOL_DEFS = [
  {type:'function',name:'desktop_jianying',description:'查看或操作本机剪映。先listWindows再readWindow，只有确认可访问元素与坐标后才操作；操作会弹出用户确认。无法读取界面时说明受阻，不能猜坐标。',parameters:{type:'object',properties:{action:{type:'string',enum:['listWindows','launchJianying','readWindow','click','type','keys']},windowId:{type:'string'},x:{type:'number'},y:{type:'number'},text:{type:'string'},key:{type:'string'}},required:['action'],additionalProperties:false}},
  {type:'function',name:'browser_open',description:'在 Zora 独立窗口打开公开网页并读取可见文字与链接。仅用于浏览，不提交表单或执行交易。',parameters:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false}},
  {type:'function',name:'browser_search',description:'在独立浏览器搜索公开互联网信息，返回当前结果页面文字与链接。',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
  {type:'function',name:'browser_read',description:'读取独立浏览器当前页面的可见文字与链接，动态页面可稍后再次读取。',parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'local_runtime_status',description:'查看本机隔离执行环境、审批和工作流结果。',parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'propose_local_action',description:'申请授权工作区内列目录、搜索文本、读文件、写文件或容器命令。必须等待用户审批，不代表已执行。路径仅工作区相对路径；list/search 可省略路径表示工作区根目录。search.query 是纯文本匹配。',parameters:{type:'object',properties:{kind:{type:'string',enum:['read','write','exec','list','search']},path:{type:'string'},query:{type:'string'},content:{type:'string'},command:{type:'string'}},required:['kind'],additionalProperties:false}},
  {type:'function',name:'plan_local_workflow',description:'规划本机任务依赖，依赖完成后产生下一步审批，不自动批准。不能用于付费生成或任意远程操作。',parameters:{type:'object',properties:{steps:{type:'array',items:{type:'object',properties:{id:{type:'string'},dependsOn:{type:'array',items:{type:'string'}},request:{type:'object',properties:{kind:{type:'string',enum:['read','write','exec','list','search']},path:{type:'string'},query:{type:'string'},content:{type:'string'},command:{type:'string'}},required:['kind'],additionalProperties:false}},required:['id','request'],additionalProperties:false}}},required:['steps'],additionalProperties:false}},
  {
    type: 'function',
    name: 'list_skills',
    description: '列出当前会话可用的创作技能（名称、分类、说明）。',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'get_skill',
    description: '读取某个技能的完整提示词与说明。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { skillId: { type: 'string' }, name: { type: 'string' }, resource: {type:'string',description:'读取技能列出的相对资料路径；默认 SKILL.md'} },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'list_media_models',
    description: '列出可用的图片/视频生成模型及比例、分辨率、时长、模式等参数能力。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['image', 'video', 'all'], description: '筛选类型，默认 all' },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'preview_task',
    description:
      '校验一条图片/视频生成任务参数，效果等同侧栏「预览任务清单」：返回合法草稿，可进入本地任务清单。不会真正扣费生成。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        modelId: { type: 'string' },
        prompt: { type: 'string' },
        count: { type: 'number' },
        concurrency: { type: 'number' },
        ratio: { type: 'string' },
        resolution: { type: 'string' },
        duration: { type: ['number', 'null'] },
        videoMode: { type: 'string' },
        operation: {type:'string',enum:['generate','reference'],description:'从模型 routes 选择操作；用户明确要求优先，其次上下文与专业判断。'},
        apiRoute: {type:'string',description:'从模型 routes 选择实际生成相对路径，不得编造路由。'},
      },
      required: ['modelId', 'prompt'],
    },
  },
  {
    type: 'function',
    name: 'submit_generation',
    description:
      '提交一条图片/视频生成任务到上游（会预扣费）。参数需合法；可用 preview_task 先校验。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        modelId: { type: 'string' },
        prompt: { type: 'string' },
        count: { type: 'number' },
        concurrency: { type: 'number' },
        ratio: { type: 'string' },
        resolution: { type: 'string' },
        duration: { type: ['number', 'null'] },
        videoMode: { type: 'string' },
        operation: {type:'string',enum:['generate','reference'],description:'从模型 routes 选择操作；用户明确要求优先，其次上下文与专业判断。'},
        apiRoute: {type:'string',description:'从模型 routes 选择实际生成相对路径，不得编造路由。'},
      },
      required: ['modelId', 'prompt'],
    },
  },

  {
    type: 'function',
    name: 'rh_list_workflows',
    description: '列出已配置的 RunningHub/Comfy 工作流（当前为空置接口，返回占位）。',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'rh_run_workflow',
    description: '提交 RunningHub Comfy 工作流任务（空置：尚未接入真实 API）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workflowId: { type: 'string' },
        nodeInfoList: { type: 'array', items: { type: 'object' } },
        prompt: { type: 'string' },
      },
      required: ['workflowId'],
    },
  },
  {
    type: 'function',
    name: 'rh_get_task',
    description: '查询 RunningHub 任务状态与输出（空置：尚未接入）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
  },
  {
    type: 'function',
    name: 'om_status',
    description: '查询 OpenMontage 工具桥与 sidecar 状态（含 runtime 探针）。',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'om_list_projects',
    description: '列出 OpenMontage 本地项目（需 sidecar 已启动）。',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'om_execute_tool',
    description: '执行 OpenMontage 工具。studio_api 本地五件套（direct_clip_search/video_compose/subtitle_gen/piper_tts/transcriber）走 sidecar；其它注册表子工具走本地 Python registry（先 om_list_tools 选名）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        projectId: { type: 'string' },
        tool: { type: 'string', description: '工具名：本地五件套或 om_list_tools 返回的 name' },
        args: { type: 'object', description: '可含 instruction / attachments；instruction 为工具自然语言指令' },
        idempotencyKey: { type: 'string' },
      },
      required: ['projectId', 'tool'],
    },
  },
  {
    type: 'function',
    name: 'om_start_sidecar',
    description: '启动本机 OpenMontage studio_api sidecar（已运行则复用）。',
    parameters: { type: 'object', additionalProperties: false, properties: { force: { type: 'boolean' } }, required: [] },
  },
  {
    type: 'function',
    name: 'om_stop_sidecar',
    description: '停止本机 OpenMontage studio_api sidecar。',
    parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'om_get_project',
    description: '获取单个 OpenMontage 项目详情。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
  },
  {
    type: 'function',
    name: 'om_list_tools',
    description: '列出 OpenMontage 注册表中的全部子工具（按 capability/关键词筛选）。含 TTS、视频生成、分析、增强等。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        capability: { type: 'string' },
        q: { type: 'string', description: '关键词' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'om_list_skills',
    description: '列出 OpenMontage Layer2 技能（core/creative/pipelines/meta 等）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: { type: 'string' },
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'om_get_skill',
    description: '读取一条 OpenMontage 技能全文（skillId 形如 om:core/ffmpeg）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { skillId: { type: 'string' } },
      required: ['skillId'],
    },
  },
  {
    type: 'function',
    name: 'call_api',
    description:
      '调用造境本地白名单 API：模型目录、状态、预览校验、生成提交，以及图片/视频上游代理路径。优先使用 preview_task / submit_generation。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        method: { type: 'string', enum: ['GET', 'POST'] },
        path: { type: 'string', description: '以 /api/ 开头的本地白名单路径' },
        body: { type: 'object' },
      },
      required: ['method', 'path'],
    },
  },
];

function draftBody(args = {}) {
  const body = {
    modelId: String(args.modelId || ''),
    prompt: String(args.prompt || ''),
    count: args.count != null ? Number(args.count) : 1,
    concurrency: args.concurrency != null ? Number(args.concurrency) : 1,
    ratio: args.ratio,
    resolution: args.resolution,
    videoMode: args.videoMode,
    ...(args.operation!==undefined?{operation:args.operation}:{}),
    ...(args.apiRoute!==undefined?{apiRoute:args.apiRoute}:{}),
  };
  if (args.duration != null && args.duration !== '') body.duration = Number(args.duration);
  return body;
}

export function createToolRunner({ skills = [], callApi, mediaModels = [], references = [], generationTasks = [], conversationId, messageId } = {}) {
  const withReferences=body=>({...body,references: references.filter(r=>r.contentUrl).map(r=>({name:r.name,type:r.type,contentUrl:r.contentUrl}))});
  const submissions=new Map();
  async function submit(body){
    if(references.some(r=>!r||typeof r.contentUrl!=='string'||!r.contentUrl))return {ok:false,status:400,error:'参考素材未读取成功，请重新添加原始素材'};
    const checked=validateDraft(withReferences(body));
    if(!checked.ok)return {ok:false,status:400,error:checked.error};
    const {id,createdAt,...draft}=checked.draft;
    const fingerprint=createHash('sha256').update(JSON.stringify(draft)).digest('hex');
    if(submissions.has(fingerprint))return submissions.get(fingerprint);
    const requestId=randomUUID();
    const pending=(async()=>{
      let result;
      try{result=await callApi({method:'POST',path:'/api/generate',body:{...draft,requestId}});}catch(error){result={ok:false,error:String(error.message||error)};}
      if(!result?.data?.task && (result?.status==null || result.status>=500)){
        try{result=await callApi({method:'GET',path:'/api/generation-tasks/'+requestId});}catch(error){result={ok:false,error:String(error.message||error)};}
      }
      const {references:refs,...safeDraft}=draft;
      const task=result?.data?.task;
      if(task)generationTasks.push({task,draft:safeDraft});
      else if(result?.status===404 || result?.status==null || result?.status>=500){
        // The POST may have reached the gateway. Preserve its identity; never issue it again.
        const unknown={id:requestId,modelId:draft.modelId,status:'unknown',submissionUnknown:true,revision:0,upstreams:[],pollError:'生成提交结果未知，请查询原任务，勿重复提交',createdAt:Date.now()};
        generationTasks.push({task:unknown,draft:safeDraft,submissionUnknown:true});
        return {ok:false,data:{task:unknown},error:unknown.pollError};
      }
      return result;
    })();
    submissions.set(fingerprint,pending);
    return pending;
  }
  const catalog = [...importedSkills,...(Array.isArray(skills)?skills.filter(s=>!importedSkills.some(i=>i.id===s.id)):[])];
  const media = Array.isArray(mediaModels) ? mediaModels.map(m=>({...m,routes:m.routes||getRouteCapabilities(m)})) : [];

  return async function runTool(name, args = {}) {
    if(name==='desktop_jianying')return callDesktop(args);
    if(['browser_open','browser_search','browser_read'].includes(name))return callBrowser({...args,action:name.slice(8)});
    if(['local_runtime_status','propose_local_action','plan_local_workflow'].includes(name)){
      if(typeof callApi!=='function')return {ok:false,error:'本机执行层未就绪'};
      return callApi({method:name==='local_runtime_status'?'GET':'POST',path:'/api/local-runtime'+(name==='local_runtime_status'?'':name==='propose_local_action'?'/propose':'/workflows'),body:{...args,conversationId,messageId}});
    }
    if (name === 'list_skills') {
      const local = catalog.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category || '',
        description: s.description || '',
        source: s.source || 'zora',
      }));
      let om = [];
      if (typeof callApi === 'function') {
        try {
          const res = await callApi({ method: 'GET', path: '/api/om/skills?limit=300' });
          const list = res?.data?.skills || res?.skills || [];
          if (Array.isArray(list)) om = list;
        } catch {}
      }
      return { skills: [...local, ...om], count: local.length + om.length };
    }
    if (name === 'get_skill') {
      const sid = String(args.skillId || importedSkills.find(s=>s.name===args.name)?.id || '');
      if(sid.startsWith('codex:'))return readImportedSkill(sid,args.resource)||{error:'技能不存在'};
      if (sid.startsWith('om:') && typeof callApi === 'function') {
        return callApi({ method: 'GET', path: '/api/om/skills/' + encodeURIComponent(sid) });
      }
      const hit =
        catalog.find((s) => s.id && s.id === args.skillId) ||
        catalog.find((s) => s.name && s.name === args.name);
      if (!hit) {
        if (sid && typeof callApi === 'function') {
          return callApi({ method: 'GET', path: '/api/om/skills/' + encodeURIComponent(sid) });
        }
        return { error: '技能不存在' };
      }
      return {
        id: hit.id,
        name: hit.name,
        category: hit.category || '',
        description: hit.description || '',
        prompt: hit.prompt || '',
        source: hit.source || 'zora',
      };
    }
    if (name === 'list_media_models') {
      const kind = args.kind && args.kind !== 'all' ? args.kind : null;
      const list = media.filter((m) => !kind || m.kind === kind);
      return { models: list, count: list.length };
    }
    if (name === 'preview_task' || name === 'submit_generation') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      const path = name === 'preview_task' ? '/api/preview' : '/api/generate';
      return name==='submit_generation'?submit(draftBody(args)):callApi({ method: 'POST', path, body: withReferences(draftBody(args)) });
    }

    if (name === 'rh_list_workflows') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      return callApi({ method: 'GET', path: '/api/rh/workflows' });
    }
    if (name === 'rh_run_workflow') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      return callApi({ method: 'POST', path: '/api/rh/tasks', body: args });
    }
    if (name === 'rh_get_task') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      const id = encodeURIComponent(String(args.taskId || ''));
      return callApi({ method: 'GET', path: `/api/rh/tasks/${id}` });
    }
    if (name === 'om_status') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      return callApi({ method: 'GET', path: '/api/om/status' });
    }
    if (name === 'om_list_projects') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      return callApi({ method: 'GET', path: '/api/om/projects' });
    }
    if (name === 'om_execute_tool') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
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
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      return callApi({ method: 'POST', path: '/api/om/sidecar/start', body: { force: Boolean(args.force) } });
    }
    if (name === 'om_stop_sidecar') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      return callApi({ method: 'POST', path: '/api/om/sidecar/stop', body: {} });
    }
    if (name === 'om_get_project') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      const id = encodeURIComponent(String(args.projectId || ''));
      return callApi({ method: 'GET', path: `/api/om/projects/${id}` });
    }
    if (name === 'om_list_tools') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      const q = new URLSearchParams();
      if (args.capability) q.set('capability', String(args.capability));
      if (args.q) q.set('q', String(args.q));
      if (args.limit != null) q.set('limit', String(args.limit));
      const qs = q.toString();
      return callApi({ method: 'GET', path: '/api/om/tools' + (qs ? '?' + qs : '') });
    }
    if (name === 'om_list_skills') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      const q = new URLSearchParams();
      if (args.category) q.set('category', String(args.category));
      if (args.q) q.set('q', String(args.q));
      if (args.limit != null) q.set('limit', String(args.limit));
      const qs = q.toString();
      return callApi({ method: 'GET', path: '/api/om/skills' + (qs ? '?' + qs : '') });
    }
    if (name === 'om_get_skill') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      const id = encodeURIComponent(String(args.skillId || ''));
      return callApi({ method: 'GET', path: `/api/om/skills/${id}` });
    }
    if (name === 'call_api') {
      if (typeof callApi !== 'function') return { error: 'API 层未就绪' };
      if(String(args.method).toUpperCase()==='POST'&&String(args.path).startsWith('/api/duoyuanx/'))return {ok:false,error:'媒体生成必须使用 submit_generation，以保存任务并避免重复扣费'};
      if(String(args.method).toUpperCase()==='POST'&&args.path==='/api/generate')return submit({...draftBody(args.body||{}),...args.body});
      return callApi({
        method: String(args.method || 'GET').toUpperCase(),
        path: String(args.path || ''),
        body: ['/api/generate','/api/preview'].includes(args.path)?withReferences(args.body||{}):args.body,
      });
    }
    return { error: `未知工具: ${name}` };
  };
}
