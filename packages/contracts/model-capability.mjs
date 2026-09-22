import {getModel,getModels} from '../duoyuanx/catalog.mjs';
import {MINIMAX_OPENAI} from '../duoyuanx/minimax-openai.mjs';
export const CAPABILITY_VERSION=1;
export const MODEL_TEMPLATES=['responses','claude-messages','chat-completions','openai-image','gpt-image','grok-image','seedream','qwen-image','gemini-image','grok-video','veo','minimax','minimax-openai','omni','seedance'];
const genericImage={kind:'image',modes:[{id:'t2i',enabled:true}],ratios:['1:1','16:9','9:16'],resolutions:['1K'],maxCount:1};
const textRoutes={responses:'/v1/responses','claude-messages':'/v1/messages','chat-completions':'/v1/chat/completions'};
const invalid=message=>Object.assign(Error(message),{status:400});
export function safeRoute(value,{query=false}={}){
 if(typeof value!=='string'||!/^\/[A-Za-z0-9_/:.{}-]+$/.test(value)||value.includes('..')||value.startsWith('//'))throw invalid('路由必须是安全的相对路径');
 if(/[{}]/.test(value)&&(!query||!value.includes('{task_id}')||/[{}]/.test(value.replace('{task_id}',''))))throw invalid('查询路由只允许一个 {task_id} 占位符');
 return value;
}
export function resolveModelCapability(model){
 const known=getModel(model.id);
 let configured=model.capability;
 if(!configured&&(model.capability_json||model.config)){try{configured=JSON.parse(model.capability_json||model.config);}catch{throw invalid('模型能力配置不是有效 JSON');}}
 const defaultTemplate=configured?.template==='minimax-openai'?MINIMAX_OPENAI:getModels().find(m=>m.family===configured?.template);
 const route=model.route||(configured?.template==='minimax-openai'?defaultTemplate.route:known?.route)||textRoutes[configured?.template]||defaultTemplate?.route||(model.kind==='agent'?'/v1/responses':model.kind==='image'?'/v1/images/generations':'/v1/videos');
 let template=configured?.template||(model.kind==='agent'?Object.keys(textRoutes).find(k=>textRoutes[k]===route):known?.family)||(['flux-schnell','flux-dev'].includes(model.id)?'openai-image':null);
 if(!MODEL_TEMPLATES.includes(template))return {version:1,status:'unsupported',reason:'尚未配置受支持的协议模板',template:template||null,modes:[]};
 if(configured&&configured.version!==1)throw invalid('不支持的模型能力配置版本');
 safeRoute(route);
 const text=Object.hasOwn(textRoutes,template);
 if(text!== (model.kind==='agent'))throw invalid('协议模板与模型类型不匹配');
 if(text&&route!==textRoutes[template])throw invalid('文字协议模板与路由不一致');
 const base=template==='minimax-openai'?MINIMAX_OPENAI:template==='openai-image'?genericImage:known?.family===template?known:getModels().find(m=>m.family===template);
 if(!text&&base?.kind!==model.kind)throw invalid('协议模板与媒体类型不匹配');
 const queryRoute=model.queryRoute||model.query_route||base?.queryRoute;
 if(queryRoute)safeRoute(queryRoute,{query:true});
 if(template==='minimax-openai'&&(model.id!=='MiniMax-H3'||model.provider!=='duoyuanx'||route!==MINIMAX_OPENAI.route||queryRoute!==MINIMAX_OPENAI.queryRoute))throw invalid('MiniMax OpenAI 模板需要 MiniMax-H3、duoyuanx、/v1/videos 和 /v1/videos/{task_id}');
 const config=configured||{};
 if(config.h3OperationCosts!==undefined){
  if(template!=='minimax'||model.provider!=='duoyuanx'||model.id!=='MiniMax-H3')throw invalid('H3 专用操作仅支持多元官方格式 MiniMax-H3');
  if(!config.h3OperationCosts||typeof config.h3OperationCosts!=='object'||Array.isArray(config.h3OperationCosts)||Object.entries(config.h3OperationCosts).some(([key,value])=>!['enhance','remix'].includes(key)||!Number.isInteger(value)||value<0||value>1000000))throw invalid('H3 操作价格必须为非负整数积分');
 }
 if(config.assetWorkflow!==undefined&&config.assetWorkflow!=='seedance-library-v1')throw invalid('不支持的素材工作流');
 if(config.assetWorkflow&&(template!=='seedance'||model.provider!=='duoyuanx'))throw invalid('素材库工作流仅支持多元 Seedance 模板');
 const modes=text?[]:(config.modes||base?.modes?.filter(m=>m.enabled!==false).map(m=>m.id)||[]);
 if(!text&&!modes.length)throw invalid('至少配置一个已支持的生成模式');
 if(!Array.isArray(modes)||modes.some(m=>typeof m!=='string'||!base?.modes?.some(b=>b.id===m&&b.enabled!==false)))throw invalid('模板不支持所选生成模式');
 const lists={};
 for(const key of ['ratios','resolutions','durations']){
  const values=config[key]??base?.[key];
  if(values!==undefined){if(!Array.isArray(values)||values.length>64||values.some(v=>key==='durations'?(!Number.isFinite(v)||v< -1||v>3600):(typeof v!=='string'||v.length>32)))throw invalid('无效能力参数：'+key);if(template==='minimax-openai'&&(!values.length||values.some(v=>!MINIMAX_OPENAI[key].includes(v))))throw invalid('MiniMax OpenAI 不支持此参数：'+key);lists[key]=values;}
 }
 // Video adapters submit one upstream job per request; do not advertise a batch that is silently ignored.
 const maxCount=config.maxCount??(model.kind==='video'?1:base?.maxCount??1);
 if(!Number.isInteger(maxCount)||maxCount<1||maxCount> (model.kind==='video'?1:template==='gpt-image'?4:20))throw invalid('生成数量超出模板限制');
 return {version:1,status:'ready',template,route,queryRoute,...lists,maxCount,modes,...(config.h3OperationCosts?{h3OperationCosts:config.h3OperationCosts}:{}),...(config.assetWorkflow?{assetWorkflow:config.assetWorkflow}:{}),revision:Number(config.revision||0),minClientVersion:1};
}
export function publishModelCapability(model){
 try{
  const capability=resolveModelCapability(model);
  const known=getModel(model.id)||getModels().find(m=>m.family===capability.template)||{};
  const names={t2i:'文生图',i2i:'图生图',t2v:'文生视频',i2v:'首帧生视频',fl:'首尾帧',ref:'参考生成',v2v:'参考视频'};
  return {...known,...model,capability,capability_json:undefined,config:undefined,family:capability.template,route:capability.route,queryRoute:capability.queryRoute,
   ...(capability.template==='minimax'&&model.provider==='duoyuanx'?{agentOperations:[{operation:'generate',tool:'submit_generation',route:'/v2/video_generation'},{operation:'enhance',tool:'enhance_video_prompt',route:'/v2/h3_context_ir',enabled:Number.isInteger(capability.h3OperationCosts?.enhance),cost:capability.h3OperationCosts?.enhance},{operation:'remix',tool:'remix_video',route:'/v2/video_regeneration',enabled:Number.isInteger(capability.h3OperationCosts?.remix),cost:capability.h3OperationCosts?.remix},{operation:'query',tool:'query_h3_task',route:'/v2/query/video_generation/{task_id}'}]}:{}),
   ...Object.fromEntries(['ratios','resolutions','durations','maxCount'].filter(k=>capability[k]!==undefined).map(k=>[k,capability[k]])),
   modes:capability.modes.map(id=>({id,name:names[id]||id,enabled:true})),available:capability.status==='ready'};
 }catch(error){return {...model,capability_json:undefined,config:undefined,capability:{version:1,status:'invalid',reason:error.message,modes:[]},available:false,modes:[]};}
}
export function assertConfiguredOperation(model,input){
 const capability=resolveModelCapability(model);
 if(capability.status!=='ready')throw invalid(capability.reason);
 if(input.kind!==undefined&&input.kind!==model.kind)throw invalid('请求类型与后台模型不一致');
 const references=!!input.references?.length||!!input.image;
 if(input.operation!==undefined&&input.operation!==(references?'reference':'generate'))throw invalid('操作与参考素材不一致');
 for(const key of ['route','apiRoute','provider','queryRoute','query_route'])if(input[key]!==undefined){
  const expected=key==='provider'?model.provider:key.includes('query')?capability.queryRoute:key==='apiRoute'&&references&&capability.template==='qwen-image'?'/v1/images/edits':capability.route;
  if(input[key]!==expected)throw invalid('请求不能覆盖后台配置：'+key);
 }
 if(model.kind!=='agent'){
  const hasReferences=!!input.references?.length||!!input.image;
  const mode=input.videoMode||(hasReferences?(model.kind==='image'?'i2i':'ref'):(model.kind==='image'?'t2i':'t2v'));
  if(!capability.modes.includes(mode))throw invalid('后台未开放此生成模式：'+mode);
  if(hasReferences&&['t2i','t2v'].includes(mode))throw invalid('有参考素材时不能选择纯文字生成');
  if(!hasReferences&&['i2i','i2v','fl','ref','v2v'].includes(mode))throw invalid('此模式需要参考素材');
  for(const [key,list] of [['ratio','ratios'],['resolution','resolutions'],['duration','durations']])if(input[key]!==undefined&&capability[list]?.length&&!capability[list].includes(input[key]))throw invalid('后台未开放此参数：'+key);
  const count=input.count??input.n??1;if(!Number.isInteger(count)||count<1||count>capability.maxCount)throw invalid('生成数量超出后台配置');
 }
 return capability;
}
