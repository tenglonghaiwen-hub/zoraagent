import {readImportedSkill} from './imported-skills.mjs';
export function selectTaskSkills(text,explicit=[]){
 if(explicit.length)return explicit;
 if(/(?:不要|不用|禁止).{0,5}(?:技能|skill)/i.test(text))return [];
 const ids=[];const video=/视频|video|复刻|运镜/i.test(text);
 if(video){ids.push(/omni|gemini/i.test(text)?'gemini-omni-prompt':/seedance|即梦/i.test(text)?'seedance-20':'minimax-h3-video-prompt');if(/复刻|动作迁移|动作参考/.test(text)&&ids[0]==='minimax-h3-video-prompt')ids.push('minimax-h3-action-transfer');}
 if(/原创.{0,8}(人物|角色|面孔)|设计.{0,6}(人物|角色|脸)/.test(text))ids.push('original-ai-character-face');
 if(/一致性|三视图|四视图|人物设定|角色设定/.test(text))ids.push('ai-character-assets');
 return [...new Set(ids)].map(id=>readImportedSkill('codex:'+id)).filter(Boolean).map(s=>({...s,selectionReason:'按本轮任务匹配；用户明确选择优先'}));
}
