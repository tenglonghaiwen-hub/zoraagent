import {createHash} from 'node:crypto';

export function describeReferenceChange(references,history=[]){
 const current=references.map(r=>({name:r.name,reference:r.reference,type:r.type,
  fingerprint:createHash('sha256').update(r.contentUrl).digest('hex')}));
 const previous=[...history].reverse().find(m=>m.role==='user'&&m.references?.length)?.references||[];
 const known=previous.length&&previous.every(r=>r.fingerprint);
 const oldIds=new Set(previous.map(r=>r.fingerprint));
 const newIds=new Set(current.map(r=>r.fingerprint));
 const added=current.filter(r=>!oldIds.has(r.fingerprint));
 const removed=previous.filter(r=>!newIds.has(r.fingerprint));
 const sameMapping=known&&previous.length===current.length&&previous.every((r,i)=>r.fingerprint===current[i].fingerprint&&r.reference===current[i].reference);
 const kind=!current.length?'none':!previous.length?'initial':!known?'unverified':sameMapping?'unchanged':!added.length&&!removed.length?'remapped':removed.length?'replaced':'added';
 return {current,change:{kind,requiresPromptReview:current.length>0&&kind!=='unchanged',
  current:current.map(({fingerprint,...r})=>r),added:added.map(r=>r.reference||r.name),removed:removed.map(r=>r.reference||r.name)}};
}

export const REFERENCE_REVIEW_INSTRUCTION='参考素材变更规则：referenceChange 要求复核时，重新观察本轮实际图片，更新主体身份、服装、产品、颜色、结构、文字和细节描述；不得直接复用历史生图提示词。替换素材时清除旧主体描述；追加素材时先明确各图用途，只调整受影响内容；素材顺序或编号变化也要重新绑定角色。保留用户未修改的画幅、分辨率、页面安排及仍适用的风格，但 sharedStyle 中属于旧主体的约束也必须更新。整套图片需复核每一张独立提示词，不能只替换素材地址。看不清的细节不得猜测；说明需要澄清之处。未获实际生成授权时只更新方案；不要覆盖历史任务和成图，也不要擅自再次生成。';
