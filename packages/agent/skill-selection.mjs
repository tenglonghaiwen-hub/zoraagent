import {readImportedSkill} from './imported-skills.mjs';
import {firstEnabledMediaModel,resolveMediaModelMention,unmatchedExplicitModelRequest} from './media-model-choice.mjs';

const normalize=value=>String(value||'').toLowerCase().replace(/[\s._．-]+/g,'');
const scopedSkills=new Map([
 ['minimax-h3-video-prompt',model=>normalize(model.id+' '+model.name).includes('h3')],
 ['minimax-h3-action-transfer',model=>normalize(model.id+' '+model.name).includes('h3')],
 ['seedance-20',model=>normalize(model.id+' '+model.name).includes('seedance20')],
 ['gemini-omni-prompt',model=>normalize(model.id+' '+model.name).includes('geminiomni')],
]);
function scopeOf(skill,models){
 const id=String(skill.id||'').replace(/^codex:/,'');
 if(scopedSkills.has(id))return scopedSkills.get(id);
 const label=normalize(`${skill.id||''} ${skill.name||''}`);
 if(label.includes('minimaxh3'))return scopedSkills.get('minimax-h3-video-prompt');
 if(label.includes('seedance20'))return scopedSkills.get('seedance-20');
 if(label.includes('geminiomni'))return scopedSkills.get('gemini-omni-prompt');
 const matches=(Array.isArray(models)?models:[]).flatMap(model=>[model.id,model.name,...(Array.isArray(model.aliases)?model.aliases:[])]
  .map(alias=>({model,length:normalize(alias).length,alias:normalize(alias)}))
  .filter(match=>match.length>=4&&label.includes(match.alias)));
 if(matches.length){
  matches.sort((a,b)=>b.length-a.length);
  const best=matches[0];
  return model=>model.id===best.model.id;
 }
 return null;
}
export function selectTaskSkills(text,explicit=[],models=[]){
 if(/(?:不要|不用|禁止).{0,5}(?:技能|skill)/i.test(text))return [];
 const choice=resolveMediaModelMention(text,models);
 const unmatched=unmatchedExplicitModelRequest(text,models);
 const videoModel=choice.explicit
  ? choice.model?.kind==='video'&&choice.model.enabled!==false&&choice.model.available!==false ? choice.model : null
  : unmatched ? null : firstEnabledMediaModel(models,'video',choice.excludedIds);
 if(explicit.length)return explicit.filter(skill=>{
  const scope=scopeOf(skill,models);
  return !scope||Boolean(videoModel&&scope(videoModel));
 });
 const ids=[];const video=/视频|video|复刻|运镜/i.test(text);
 if(video&&videoModel){for(const [id,applies] of scopedSkills){if(applies(videoModel)&&(id!=='minimax-h3-action-transfer'||/复刻|动作迁移|动作参考/.test(text)))ids.push(id);}}
 if(/原创.{0,8}(人物|角色|面孔)|设计.{0,6}(人物|角色|脸)/.test(text))ids.push('original-ai-character-face');
 if(/一致性|三视图|四视图|人物设定|角色设定/.test(text))ids.push('ai-character-assets');
 return [...new Set(ids)].map(id=>readImportedSkill('codex:'+id)).filter(Boolean).map(s=>({...s,selectionReason:'按本轮任务匹配；用户明确选择优先'}));
}
