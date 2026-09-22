/** Zora Agent tool registry: skills + preview/generate control + APIs. */
import { importedSkills } from './imported-skills.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { validateDraft } from '../contracts/domain.mjs';
import { getRouteCapabilities } from '../duoyuanx/route-capabilities.mjs';
import { handleBrowserTool } from './tool-handlers/browser-tools.mjs';
import { handleSkillTool } from './tool-handlers/skill-tools.mjs';
import { handleOMTool } from './tool-handlers/om-tools.mjs';
import { handleRuntimeTool } from './tool-handlers/runtime-tools.mjs';
import { IMAGE_SUITE_TOOLS, planImageSuite } from './image-suite.mjs';
import {H3_TOOLS,runH3Tool} from './h3-tools.mjs';

export const AGENT_TOOL_DEFS = [
  {type:'function',name:'om_import_media',description:'把已完成的生成结果 URL 或会话原素材复制到所选 OM 项目，返回后期工具可用的真实本地路径；保留原素材。先 query_generation_task 确认生成完成，禁止猜测 URL。url 与 referenceIndex 二选一。',parameters:{type:'object',properties:{projectId:{type:'string'},url:{type:'string'},referenceIndex:{type:'integer',minimum:1}},required:['projectId'],additionalProperties:false}},
  {type:'function',name:'query_generation_task',description:'查询原图片/视频生成回执，获取真实完成结果供后续 OM 管线使用。不会创建任务或重复扣费。使用生成工具返回的回执 id，不猜上游编号。',parameters:{type:'object',properties:{requestId:{type:'string'}},required:['requestId'],additionalProperties:false}},
  {type:'function',name:'om_list_pipelines',description:'列出 Zora 可用的 OM 本地媒体管线。先理解用户指令，自主判断是否需要 OM；需要时选择管线。管线内生成图片/视频统一调用 Zora 已配置 API，OM 只负责本地后期。',parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'om_get_pipeline',description:'读取已选择管线的输入、步骤、允许工具和验收要求。步骤由 Zora Agent 编排，不启动 OM 独立大模型。',parameters:{type:'object',properties:{pipelineId:{type:'string'}},required:['pipelineId'],additionalProperties:false}},
  {type:'function',name:'om_prepare_pipeline',description:'为所选管线建立可恢复的本地项目，返回 projectId/projectPath。只建立计划，不表示执行成功。需要的生成素材经 delegate_media_task 调用 Zora 已配置 API；query_generation_task 完成后才用于本地后期。',parameters:{type:'object',properties:{pipelineId:{type:'string'},instruction:{type:'string'},requestId:{type:'string'}},required:['pipelineId','instruction'],additionalProperties:false}},
  {type:'function',name:'om_describe_tool',description:'读取 OM 本地工具的真实输入 JSON Schema、依赖与副作用，先查看再填写参数，不猜参数名。工具缺少依赖时如实说明，不安装 GPU 或调用 OM 远程模型替代。',parameters:{type:'object',properties:{tool:{type:'string'}},required:['tool'],additionalProperties:false}},
  ...H3_TOOLS,
  {type:'function',name:'prepare_seedance_assets',description:'仅当模型 capability.assetWorkflow 为 seedance-library-v1 时使用。将当前会话原素材导入 Seedance 素材库，不生成视频。首次可省略 requestId；后续必须复用返回的 id。preparing 时用相同 id 继续本工具，processing 时用 query_seedance_assets，ready 后 submit_generation 携带 assetReceiptId。unknown/failed 不得自动更换编号重试。',parameters:{type:'object',properties:{modelId:{type:'string'},requestId:{type:'string'}},required:['modelId'],additionalProperties:false}},
  {type:'function',name:'query_seedance_assets',description:'查询原 Seedance 素材回执的审核进度。只在全部 Active、receipt.status=ready 后才能生成；查询不会重新创建素材。',parameters:{type:'object',properties:{requestId:{type:'string'}},required:['requestId'],additionalProperties:false}},
  ...IMAGE_SUITE_TOOLS,
  {type:'function',name:'desktop_control',description:'通用 Windows 桌面操作。openApp 按 name 打开应用，无需用户提供编号；listWindows 定位窗口，focus 激活，readWindow 读取控件，captureWindow 返回窗口截图。依据真实控件或截图在窗口内 click、type、keys，每步后重新读取核验。不得用网页代替桌面应用。',parameters:{type:'object',properties:{action:{type:'string',enum:['openApp','listWindows','focus','readWindow','captureWindow','click','type','keys']},name:{type:'string'},windowId:{type:'string'},x:{type:'integer'},y:{type:'integer'},text:{type:'string'},key:{type:'string'}},required:['action'],additionalProperties:false}},
  {type:'function',name:'desktop_apps',description:'查找并启动本机已安装的桌面应用（例如微信）。先 listApps 获取真实 appId，再 launchApp。只能在 windowVerified 为 true 时声称窗口已打开；不得使用浏览器替代桌面应用。',parameters:{type:'object',properties:{action:{type:'string',enum:['listApps','launchApp']},query:{type:'string'},appId:{type:'string'}},required:['action'],additionalProperties:false}},
  {type:'function',name:'desktop_jianying',description:'查看或操作本机剪映。先listWindows再readWindow，只有确认可访问元素与坐标后才操作；操作会弹出用户确认。无法读取界面时说明受阻，不能猜坐标。',parameters:{type:'object',properties:{action:{type:'string',enum:['listWindows','launchJianying','readWindow','click','type','keys']},windowId:{type:'string'},x:{type:'number'},y:{type:'number'},text:{type:'string'},key:{type:'string'}},required:['action'],additionalProperties:false}},
  {type:'function',name:'browser_open',description:'在 Zora 独立窗口打开公开网页并读取可见文字与链接。仅用于浏览，不提交表单或执行交易。',parameters:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false}},
  {type:'function',name:'browser_search',description:'在独立浏览器搜索公开互联网信息，返回当前结果页面文字与链接。',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
  {type:'function',name:'browser_read',description:'读取独立浏览器当前页面的可见文字与链接，动态页面可稍后再次读取。',parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'local_runtime_status',description:'查看本机隔离执行环境、审批和工作流结果。',parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'propose_local_action',description:'申请授权工作区内列目录、搜索文本、读文件、写文件或脚本。无 Docker 时 exec 必须指定 runtime=node/python，command 为脚本正文；不指定 runtime 的旧命令仅用于 Docker。必须等待用户审批，不代表已执行。路径仅工作区相对路径；list/search 可省略路径表示工作区根目录。search.query 是纯文本匹配。',parameters:{type:'object',properties:{kind:{type:'string',enum:['read','write','exec','list','search']},path:{type:'string'},query:{type:'string'},content:{type:'string'},command:{type:'string'},runtime:{type:'string',enum:['node','python'],description:'显式选择包内本机脚本环境；command 为完整脚本，不是 shell 命令。需要逐次用户授权，无 Docker 隔离。'}},required:['kind'],additionalProperties:false}},
  {type:'function',name:'plan_local_workflow',description:'规划本机任务依赖，依赖完成后产生下一步审批，不自动批准。不能用于付费生成或任意远程操作。',parameters:{type:'object',properties:{steps:{type:'array',items:{type:'object',properties:{id:{type:'string'},dependsOn:{type:'array',items:{type:'string'}},request:{type:'object',properties:{kind:{type:'string',enum:['read','write','exec','list','search']},path:{type:'string'},query:{type:'string'},content:{type:'string'},command:{type:'string'},runtime:{type:'string',enum:['node','python'],description:'显式选择包内本机脚本环境；command 为完整脚本，不是 shell 命令。需要逐次用户授权，无 Docker 隔离。'}},required:['kind'],additionalProperties:false}},required:['id','request'],additionalProperties:false}}},required:['steps'],additionalProperties:false}},
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
        assetReceiptId: {type:'string',description:'已全部 Active 的 Seedance 素材库回执 id；仍使用会话原素材校验一致性。'},
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
        assetReceiptId: {type:'string',description:'素材库 ready 回执编号；素材必须与准备时一致。'},
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
    description: '执行已开放的 OM 本地媒体后期工具。先选管线、om_describe_tool 读取参数并检查真实素材。GPU 管理、独立大模型与远程生成已移除；图片视频生成必须经 Zora 已配置 API。',
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
    ...(args.assetReceiptId?{assetReceiptId:String(args.assetReceiptId)}:{}),
  };
  if (args.duration != null && args.duration !== '') body.duration = Number(args.duration);
  return body;
}

export function createToolRunner({ skills = [], callApi, mediaModels = [], references = [], generationTasks = [], conversationId, messageId } = {}) {
  const withReferences=body=>({...body,references: references.filter(r=>r.contentUrl).map(r=>({name:r.name,type:r.type,contentUrl:r.contentUrl}))});
  const submissions=new Map();
  const suites=new Map();
  async function submit(body,suite){
    if(references.some(r=>!r||typeof r.contentUrl!=='string'||!r.contentUrl))return {ok:false,status:400,error:'参考素材未读取成功，请重新添加原始素材'};
    const checked=validateDraft(withReferences(body),mediaModels.length?id=>mediaModels.find(m=>m.id===id):undefined);
    if(!checked.ok)return {ok:false,status:400,error:checked.error};
    const {id,createdAt,...draft}=checked.draft;
    if(body.assetReceiptId)draft.assetReceiptId=body.assetReceiptId;
    const fingerprint=createHash('sha256').update(JSON.stringify([draft,suite?.id||null])).digest('hex');
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
      if(task)generationTasks.push({task,draft:safeDraft,...(suite?{suite}:{})});
      else if(result?.status===404 || result?.status==null || result?.status>=500){
        // The POST may have reached the gateway. Preserve its identity; never issue it again.
        const unknown={id:requestId,modelId:draft.modelId,status:'unknown',submissionUnknown:true,revision:0,upstreams:[],pollError:'生成提交结果未知，请查询原任务，勿重复提交',createdAt:Date.now()};
        generationTasks.push({task:unknown,draft:safeDraft,submissionUnknown:true,...(suite?{suite}:{})});
        return {ok:false,data:{task:unknown},error:unknown.pollError};
      }
      else if(suite){
        generationTasks.push({task:{id:requestId,modelId:draft.modelId,status:'failed',revision:0,upstreams:[],localRejection:true,pollError:result?.error||'提交被拒绝'},draft:safeDraft,suite});
      }
      return result;
    })();
    submissions.set(fingerprint,pending);
    return pending;
  }
  const catalog = [...importedSkills,...(Array.isArray(skills)?skills.filter(s=>!importedSkills.some(i=>i.id===s.id)):[])];
  const media = Array.isArray(mediaModels) ? mediaModels.map(m=>({...m,routes:m.routes||getRouteCapabilities(m)})) : [];

  return async function runTool(name, args = {}) {
    if(name==='om_import_media'){
      if(Boolean(args.url)===Boolean(args.referenceIndex))return {ok:false,error:'url 与 referenceIndex 必须二选一'};
      const url=args.url||(Number.isInteger(args.referenceIndex)&&references[args.referenceIndex-1]?.contentUrl);
      if(!url)return {ok:false,error:'素材不可用'};
      return callApi({method:'POST',path:'/api/om/media/import',body:{projectId:args.projectId,url}});
    }
    if(name==='query_generation_task'){
      if(!/^[a-zA-Z0-9_-]{16,100}$/.test(args.requestId||''))return {ok:false,error:'需要有效原任务回执 id'};
      return callApi({method:'GET',path:'/api/generation-tasks/'+args.requestId});
    }
    if(name==='om_prepare_pipeline'){
      const requestId=args.requestId||createHash('sha256').update(JSON.stringify([conversationId,messageId,args.pipelineId,args.instruction])).digest('hex');
      return callApi({method:'POST',path:'/api/om/pipelines/prepare',body:{...args,requestId}});
    }
    if(H3_TOOLS.some(tool=>tool.name===name))return runH3Tool(name,args,{callApi,references,conversationId,messageId,generationTasks});
    if(name==='prepare_seedance_assets'){
      const model=media.find(m=>m.id===args.modelId);
      if(model?.capability?.assetWorkflow!=='seedance-library-v1')return {ok:false,error:'模型未开放素材库工作流'};
      const requestId=args.requestId||createHash('sha256').update(JSON.stringify([conversationId,args.modelId,references.map(r=>[r.name,r.type,r.contentUrl])])).digest('hex');
      return callApi({method:'POST',path:'/api/seedance/assets/prepare',body:{modelId:args.modelId,requestId,references:withReferences({}).references}});
    }
    if(name==='query_seedance_assets'){
      if(!/^[a-zA-Z0-9_-]{16,100}$/.test(args.requestId||''))return {ok:false,error:'素材回执编号无效'};
      return callApi({method:'GET',path:'/api/seedance/assets/'+args.requestId});
    }
    if(name==='preview_image_suite'||name==='submit_image_suite'){
      if(references.some(r=>!r?.contentUrl))return {ok:false,error:'参考素材未读取成功，请重新添加原始素材'};
      const plan=planImageSuite(args,withReferences({}).references);
      if(!plan.ok)return plan;
      if(name==='preview_image_suite')return {...plan,drafts:plan.drafts.map(({references,...draft})=>draft)};
      if(typeof callApi!=='function')return {ok:false,error:'API 层未就绪'};
      const key=createHash('sha256').update(JSON.stringify(plan)).digest('hex');
      if(suites.has(key))return suites.get(key);
      const pending=(async()=>{
        const suite={id:randomUUID(),title:plan.title,sharedStyle:plan.sharedStyle,items:plan.items};
        const results=[];
        for(let index=0;index<plan.drafts.length;index++){
          const result=await submit(plan.drafts[index],{...suite,index});
          results.push(result);
          if(!result?.data?.task||result.data.task.status==='unknown'||result.data.task.status==='failed')break;
        }
        return {ok:results.length===plan.drafts.length&&results.every(r=>r.ok!==false),suite,results,
          message:'每张独立提交；请以任务收据为准。未提交或结果未知的页面不会自动补交。'};
      })();
      suites.set(key,pending);return pending;
    }
    // Browser & Desktop tools
    const browserResult = await handleBrowserTool(name, args);
    if (browserResult !== undefined) return browserResult;

    // Runtime & workflow tools
    const runtimeTools = ['local_runtime_status', 'propose_local_action', 'plan_local_workflow'];
    if (runtimeTools.includes(name)) {
      return handleRuntimeTool(name, args, callApi, { conversationId, messageId });
    }

    // Skill tools
    const skillTools = ['list_skills', 'get_skill'];
    if (skillTools.includes(name)) {
      return handleSkillTool(name, args, { catalog, callApi });
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

    // OpenMontage tools
    const omTools = ['om_list_pipelines','om_get_pipeline','om_describe_tool','om_status', 'om_list_projects', 'om_execute_tool', 'om_start_sidecar', 'om_stop_sidecar', 'om_get_project', 'om_list_tools', 'om_list_skills', 'om_get_skill'];
    if (omTools.includes(name)) {
      return handleOMTool(name, args, callApi);
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
