import {selectH3} from './h3-routing.mjs';
import {selectMinimaxOpenAI} from './minimax-openai.mjs';
/** Only routes backed by the existing generation adapters; not provider discovery. */
const implementedFamilies=new Set(['openai-image','gpt-image','grok-image','seedream','qwen-image','gemini-image','grok-video','veo','minimax','minimax-openai','omni','seedance']);
export function getRouteCapabilities(model){
 if(!model||!['image','video'].includes(model.kind)||!implementedFamilies.has(model.family)||!model.route)return [];
 const modes=model.modes?.filter(m=>m.enabled!==false).map(m=>m.id);
 const allows=ids=>!modes||modes.some(m=>ids.includes(m));
 return [
  ...(allows(['t2i','t2v'])?[{operation:'generate',apiRoute:model.route,requiresReferences:false}]:[]),
  ...(allows(['i2i','i2v','fl','ref','v2v'])?[{operation:'reference',apiRoute:model.family==='qwen-image'?'/v1/images/edits':model.route,requiresReferences:true}]:[]),
 ];
}

export function validateRouteSelection(input,model){
 const hasOperation=input.operation!==undefined,hasRoute=input.apiRoute!==undefined;
 if(model?.family==='minimax')return selectH3(input);
 if(model?.family==='minimax-openai')return selectMinimaxOpenAI(input);
 if(!hasOperation&&!hasRoute)return {ok:true};
 if(hasOperation&&!['generate','reference'].includes(input.operation))return {ok:false,error:'operation 仅支持 generate 或 reference'};
 if(hasRoute&&(typeof input.apiRoute!=='string'||!input.apiRoute))return {ok:false,error:'apiRoute 必须是当前模型目录中的相对路由'};
 const hasReferences=Array.isArray(input.references)&&input.references.length>0;
 const operation=hasOperation?input.operation:(hasReferences?'reference':'generate');
 if((operation==='reference')!==hasReferences)return {ok:false,error:operation==='reference'?'reference 操作需要原始参考素材':'generate 操作不能携带参考素材，请明确选择 reference'};
 if((operation==='reference'&&['t2i','t2v'].includes(input.videoMode))||(operation==='generate'&&['i2i','i2v','fl','ref','v2v'].includes(input.videoMode)))return {ok:false,error:'operation 与所选生成模式冲突'};
 const capability=getRouteCapabilities(model).find(r=>r.operation===operation&&(hasRoute?r.apiRoute===input.apiRoute:r.apiRoute===(model.family==='minimax'&&input.videoMode==='ref'?'/v2/video_generation':model.family==='qwen-image'&&operation==='reference'?'/v1/images/edits':model.route)));
 if(!capability||(hasRoute&&capability.apiRoute!==input.apiRoute))return {ok:false,error:'所选 apiRoute 不支持当前模型、操作或参考素材'};
 return {ok:true,selected:capability};
}
