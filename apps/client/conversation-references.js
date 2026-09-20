// Only current explicit selections or previously sent conversation references.
// Unselected library uploads are never considered here.
export function selectConversationReferences({text='',explicit=[],messages=[],inherit=false}={}){
 const tokens=[...new Set((text.match(/[@＠](?:图片|视频|音频)\d+/g)||[]).map(t=>t.slice(1)))];
 const history=messages.filter(m=>m.kind==='agent'||m.role==='user'||m.liveAgent);
 const byName=new Map();
 for(const message of history)for(const ref of message.references||[])if(ref.reference)byName.set(ref.reference,ref);
 for(const ref of explicit)if(ref.reference)byName.set(ref.reference,ref);
 if(tokens.length){
  const missing=tokens.filter(token=>!byName.has(token));
  if(missing.length)throw Error('当前会话找不到 '+missing.map(t=>'@'+t).join('、')+'，请核对素材编号');
  return {references:tokens.map(token=>byName.get(token)),inherited:false};
 }
 if(explicit.length)return {references:[...explicit],inherited:false};
 if(inherit){
  for(let i=history.length-1;i>=0;i--){
   if(history[i].references?.length)return {references:[...history[i].references],inherited:true};
  }
 }
 return {references:[],inherited:false};
}
