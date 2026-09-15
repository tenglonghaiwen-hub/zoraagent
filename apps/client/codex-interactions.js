// Keep form nodes across status refreshes so typing is never erased.
const forms=new Map();
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
function field(schema,label){
 const row=el('label',label||schema.title||'填写内容');row.style.display='block';let input;
 const choices=schema.enum?.map((v,i)=>({value:v,label:schema.enumNames?.[i]||String(v)}))||(schema.oneOf||schema.anyOf)?.map(o=>({value:o.const,label:o.title||o.const}));
 if(choices){input=el('select');input.append(el('option','请选择'));input.firstChild.value='';for(const c of choices){const o=el('option',c.label);o.value=String(c.value);input.append(o);}}
 else if(schema.type==='boolean'){input=el('select');for(const [v,t] of [['','请选择'],['true','是'],['false','否']]){const o=el('option',t);o.value=v;input.append(o);}}
 else if(schema.type==='object'||(schema.type==='array'&&!schema.items?.enum&&!schema.items?.anyOf&&!schema.items?.oneOf)){input=el('textarea');input.dataset.json='true';input.placeholder='JSON';}
 else if(schema.type==='array'){input=el('select');input.multiple=true;const choices=schema.items?.enum?.map(v=>({const:v,title:v}))||schema.items?.anyOf||schema.items?.oneOf||[];for(const c of choices){const o=el('option',c.title||c.const);o.value=c.const;input.append(o);}}
 else{input=el('input');input.type=schema.isSecret?'password':['number','integer'].includes(schema.type)?'number':'text';if(schema.type==='integer')input.step='1';input.autocomplete='off';}
 row.append(input);if(schema.description)row.append(el('small',schema.description));
 return {row,read(){if(input.dataset.json)return input.value.trim()?JSON.parse(input.value):undefined;if(schema.type==='array')return Array.from(input.selectedOptions,o=>o.value);if(input.value==='')return undefined;if(schema.type==='boolean')return input.value==='true';if(['number','integer'].includes(schema.type))return Number(input.value);return input.value;}};
}
export function interactionForm(record,decide){
 if(forms.has(record.id))return forms.get(record.id);
 const form=el('form'),p=record.params||{},readers=[];form.onsubmit=e=>e.preventDefault();const kind=record.interaction;
 const button=(label,action,payload=()=>({}))=>{const b=el('button',label);b.type='button';b.onclick=async()=>{try{form.querySelector('[role=alert]')?.remove();await decide(record,action,payload());}catch(e){const error=el('p',e.message);error.setAttribute('role','alert');form.append(error);}};form.append(b);};
 if(kind==='questions'){
  for(const q of p.questions||[]){const spec=q.options?.length&&!q.isOther?{enum:q.options.map(o=>o.label),description:q.options.map(o=>o.label+'：'+o.description).join('；')}:{type:'string',isSecret:q.isSecret,description:q.options?.map(o=>o.label+'：'+o.description).join('；')};const f=field(spec,q.question);form.append(f.row);readers.push([q.id,f]);}
  button('提交回答','respond',()=>({answers:Object.fromEntries(readers.map(([id,f])=>[id,{answers:f.read()===undefined?[]:[String(f.read())]}]))}));button('取消提问','cancel');
 }else if(kind==='mcp'){
  form.append(el('p',p.message||p.description||'MCP 请求'));
  if(p.mode==='url'){try{const url=new URL(p.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();const link=el('a','打开授权页面');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';form.append(link,el('p','完成外部操作后，再确认继续。'));button('已完成，继续','respond');}catch{form.append(el('p','授权链接无效'));}}
  else if(p.mode==='openai/userVerification')form.append(el('p','当前客户端没有该身份验证宿主，请取消或改用支持此验证的客户端。'));
  else{for(const [name,schema] of Object.entries(p.requestedSchema?.properties||{})){const f=field(schema,(schema.title||name)+((p.requestedSchema.required||[]).includes(name)?'（必填）':''));form.append(f.row);readers.push([name,f]);}button('提交表单','respond',()=>({content:Object.fromEntries(readers.map(([id,f])=>[id,f.read()]).filter(([,v])=>v!==undefined))}));}
  button('拒绝','deny');button('取消','cancel');
 }else{button('仅批准本次','approve');button('批准本会话','approve-session');button('拒绝','deny');button('取消任务','cancel');}
 forms.set(record.id,form);return form;
}
export function pruneInteractionForms(records){const pending=new Set(records.filter(r=>r.status==='pending').map(r=>r.id));for(const id of forms.keys())if(!pending.has(id))forms.delete(id);}
