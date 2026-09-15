// User-mediated app-server interaction replies. Never accept implicitly.
export const interactionMethods=new Map([
 ['item/commandExecution/requestApproval','command'],['item/fileChange/requestApproval','file'],
 ['item/tool/requestUserInput','questions'],['mcpServer/elicitation/request','mcp'],
 ['item/permissions/requestApproval','permissions'],['execCommandApproval','legacy-command'],['applyPatchApproval','legacy-file']
]);
export function validateForm(schema,value){
 if(!schema||typeof schema!=='object')throw Error('表单结构无效');
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('请输入表单对象');
  for(const key of schema.required||[])if(value[key]===undefined)throw Error('缺少必填项：'+key);
  for(const [key,v] of Object.entries(value)){if(!Object.hasOwn(schema.properties||{},key))throw Error('表单包含未知字段：'+key);validateForm(schema.properties[key],v);}return;
 }
 if(schema.type==='array'){if(!Array.isArray(value))throw Error('请选择列表');if(schema.minItems!=null&&value.length<schema.minItems||schema.maxItems!=null&&value.length>schema.maxItems)throw Error('选择数量不符合要求');for(const v of value)validateForm(schema.items,v);return;}
 const options=schema.oneOf||schema.anyOf;if(options){if(!options.some(s=>{try{validateForm(s,value);return true;}catch{return false;}}))throw Error('选项无效');return;}
 if(Object.hasOwn(schema,'const')&&value!==schema.const)throw Error('选项无效');
 if(schema.enum&&!schema.enum.includes(value))throw Error('选项无效');
 if(schema.type==='string'){if(typeof value!=='string')throw Error('请输入文字');if(schema.minLength!=null&&value.length<schema.minLength||schema.maxLength!=null&&value.length>schema.maxLength)throw Error('文字长度不符合要求');}
 if(schema.type==='boolean'&&typeof value!=='boolean')throw Error('请选择是或否');
 if(['number','integer'].includes(schema.type)){if(typeof value!=='number'||!Number.isFinite(value)||schema.type==='integer'&&!Number.isInteger(value))throw Error('请输入有效数字');if(schema.minimum!=null&&value<schema.minimum||schema.maximum!=null&&value>schema.maximum)throw Error('数字超出范围');}
}
export function interactionReply(record,action,payload={}){
 const p=record.params,kind=record.interaction;
 if(!['approve','deny','cancel','respond','approve-session'].includes(action))throw Error('不支持的交互操作');
 const accept=action==='approve'||action==='approve-session'||action==='respond';
 if(kind==='questions'){
  if(!accept)return {answers:{}};
  const answers={};for(const q of p.questions||[]){const values=payload.answers?.[q.id]?.answers;if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='string'||!v.trim()))throw Error('请回答：'+q.question);if(q.options?.length&&!q.isOther&&values.some(v=>!q.options.some(o=>o.label===v)))throw Error('请选择有效选项');answers[q.id]={answers:values};}return {answers};
 }
 if(kind==='permissions')return {permissions:accept?p.permissions:{},scope:action==='approve-session'?'session':'turn'};
 if(kind==='mcp'){
  if(!accept)return {action:action==='cancel'?'cancel':'decline',content:null};
  if(p.mode==='openai/userVerification')throw Error('此验证需要受支持的身份验证宿主，不能手动伪造验证结果');
  if(p.mode==='url')return {action:'accept',content:null};
  validateForm(p.requestedSchema,payload.content);return {action:'accept',content:payload.content};
 }
 if(kind.startsWith('legacy-'))return {decision:action==='cancel'?'abort':accept?(action==='approve-session'?'approved_for_session':'approved'):{denied:{rejection:'用户拒绝'}}};
 return {decision:action==='cancel'?'cancel':accept?(action==='approve-session'?'acceptForSession':'accept'):'decline'};
}
