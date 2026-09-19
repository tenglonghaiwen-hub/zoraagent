import {interactionForm,pruneInteractionForms} from './codex-interactions.js';
// Approvals are shown only inside their originating conversation.
export function mountRuntimePanel(root,{fetchImpl=window.fetch.bind(window)}={}){
 if(!root)return;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);return e;};
 const details=(label,text)=>{const d=el('details'),p=el('pre',text);p.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;font:inherit';d.append(el('summary',label),p);return d;};
 const dock=el('aside');dock.id='approval-dock';dock.setAttribute('aria-label','待审批操作');document.body.append(dock);
 const expandedApprovals=new Set(),expandedExecutions=new Set();
 const positionDock=()=>{const anchor=document.getElementById('prompt-card');if(!anchor)return;const r=anchor.getBoundingClientRect();dock.style.left=Math.max(12,r.left)+'px';dock.style.right='auto';dock.style.width=Math.max(0,Math.min(r.width,window.innerWidth-24))+'px';dock.style.bottom=Math.max(12,window.innerHeight-r.top+10)+'px';dock.style.maxHeight=Math.max(80,r.top-24)+'px';dock.style.visibility=r.width&&r.height&&r.top>0?'visible':'hidden';};
 const anchorObserver=new ResizeObserver(positionDock);const anchor=document.getElementById('prompt-card');if(anchor)anchorObserver.observe(anchor);window.addEventListener('resize',positionDock);window.addEventListener('scroll',positionDock,true);
 const status=el('p'),error=el('p'),list=el('div'),refreshButton=el('button','刷新记录');
 error.setAttribute('role','alert');root.replaceChildren(el('h2','本地执行记录'),status,refreshButton,error,list);
 const steerForms=new Map();
 let data={requests:[]},files=[],busy=false,disposed=false,actionBusy=false;
 const body=r=>r.request||r;
 const owner=r=>r.conversationId||body(r).conversationId;
 const describe=r=>{const b=body(r);return [`类型：${b.kind||'操作'}`,b.path&&`路径：${b.path}`,b.command&&`命令：${b.command}`,b.query&&`搜索：${b.query}`,b.content!=null&&`写入内容：\n${b.content}`,r.error&&`错误：${r.error}`,r.stdout&&`输出：\n${r.stdout}`,r.stderr&&`错误输出：\n${r.stderr}`].filter(Boolean).join('\n');};
 const json=async(url,options={})=>{const response=await fetchImpl(url,{credentials:'same-origin',cache:'no-store',...options});const result=await response.json();if(!response.ok)throw Error(result.error?.message||result.error||'请求失败');return result;};
 const fileLink=file=>{const row=el('p');row.append(el('span',`${file.name||file.path} · ${Number(file.size)||0} 字节 `));try{const u=new URL(file.url,location.origin);if(u.origin===location.origin&&u.protocol===location.protocol){const a=el('a','下载文件');a.href=u.href;a.download=file.name||'';row.append(a);}}catch{}return row;};
 function renderConversation(){
  const log=document.querySelector('.conversation-log');if(!log){dock.hidden=true;return;}
  const position=log.scrollTop;log.querySelector('#conversation-runtime')?.remove();log.querySelectorAll('.runtime-inline').forEach(n=>n.remove());
  const current=window.__zoraConversationContext?.()?.conversationId;
  const matching=(data.requests||[]).filter(r=>(current&&owner(r)===current)||(!owner(r)&&r.engine==='codex'&&r.status==='pending')); dock.replaceChildren();dock.hidden=true;positionDock();
  const sessionFiles=current?files.filter(file=>(file.conversationIds||[]).includes(current)):[];
  const activities=(data.codexActivities||[]).filter(a=>a.conversationId===current);
  if(!matching.length&&!sessionFiles.length&&!activities.length)return;
  const replies=[...log.querySelectorAll('.conversation-reply[data-message-created-at]')];
  const target=r=>replies.find(n=>r.messageId&&n.dataset.messageId===r.messageId)||replies.filter(n=>Number(n.dataset.messageCreatedAt)<=Date.parse(r.createdAt)).at(-1);
  const append=(node,record)=>{const reply=target(record);node.classList.add('runtime-inline');(reply||log).append(node);};
  for(const activity of activities){const card=el('details');card.className='thinking-execution';card.open=expandedExecutions.has(activity.threadId);card.addEventListener('toggle',()=>{if(!card.isConnected)return;if(card.open)expandedExecutions.add(activity.threadId);else expandedExecutions.delete(activity.threadId);});const statusLabels={running:'进行中',completed:'已完成',failed:'失败',interrupted:'已停止',unknown:'状态待确认'};card.append(el('summary','思考与执行 · '+(activity.status==='running'&&activity.retrying?'连接异常，正在重试':statusLabels[activity.status]||activity.status)));if(activity.errors?.length){const recent=activity.errors.at(-1);const retry=el('p');retry.className='execution-retry-notice';retry.setAttribute('role','status');retry.textContent=(activity.status==='running'&&activity.retrying?'正在自动重试 · ':'最近请求错误 · ')+new Date(recent.at).toLocaleTimeString()+' · '+recent.message;card.append(retry);card.append(details('错误与重试记录（'+activity.errors.length+'条）',activity.errors.map(e=>new Date(e.at).toLocaleString()+' · '+(e.willRetry?'上游将自动重试':'上游不会自动重试')+'\n'+e.message+(e.details?'\n'+e.details:'')).join('\n\n')));}
if(activity.skills?.length)card.append(details('选用技能',activity.skills.map(s=>s.name+' · '+s.reason).join('\n')));if(activity.error)card.append(el('p',activity.error));const summaries=Object.values(activity.reasoningSummary||{}).filter(Boolean);if(summaries.length)card.append(details('上游推理摘要',summaries.join('\n\n')));if(activity.plan){const lines=activity.plan.map(p=>(p.status==='completed'?'✓ ':p.status==='inProgress'?'进行中 · ':'待执行 · ')+p.step);card.append(details('执行计划',lines.join('\n')));}if(activity.tools)card.append(details('工具调用',Object.values(activity.tools).map(t=>t.name+' · '+(statusLabels[t.status]||t.status)).join('\n')));if(activity.text)card.append(details('阶段输出',activity.text));if(!summaries.length&&!activity.plan&&!activity.tools&&!activity.text)card.append(el('p',activity.status==='running'?'正在等待上游返回执行信息…':'上游未返回摘要或执行详情。'));if(activity.status!=='running'){append(card,activity);continue;}const stop=el('button','停止执行');stop.type='button';stop.onclick=async()=>{stop.disabled=true;stop.textContent='正在停止…';try{await json('/api/local-runtime/codex/interrupt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:current})});stop.textContent='已请求停止，等待确认';await refresh();}catch(e){error.textContent=e.message;stop.textContent='停止失败，点击重试';stop.title=e.message;stop.disabled=false;}};
   let steer=steerForms.get(current);if(!steer){steer=el('form');const input=el('textarea');input.placeholder='补充当前任务的要求';const submit=el('button','补充指令');submit.type='submit';steer.append(input,submit);steer.onsubmit=async e=>{e.preventDefault();if(!input.value.trim())return;submit.disabled=true;try{await json('/api/local-runtime/codex/steer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:current,text:input.value})});input.value='';}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};steerForms.set(current,steer);}card.append(steer);const runningCard=el('div');runningCard.append(stop,card);append(runningCard,activity);}
  for(const request of matching){
   const card=el('details');card.open=expandedApprovals.has(request.id);card.addEventListener('toggle',()=>{if(!card.isConnected)return;if(card.open)expandedApprovals.add(request.id);else expandedApprovals.delete(request.id);});
   const b=body(request);card.classList.add('approval-card');const reason=request.params?.reason||request.params?.message||({command:'此命令需要你的授权后才能执行。',file:'此文件修改需要你的授权。',permissions:'任务需要额外访问权限。',questions:'需要你提供信息后继续。',mcp:'外部工具需要你确认或填写信息。'}[request.interaction])||'此操作需要你的确认。';const capsule=el('summary');capsule.append(el('span','待审批'),el('span',reason));capsule.title=reason;card.append(capsule,el('p',reason),details('查看操作详情',describe(request)));
   if(['pending','awaiting_approval'].includes(request.status)){
    if(request.engine==='codex'){card.append(interactionForm(request,decide));dock.append(card);dock.hidden=false;continue;}
    const approve=el('button','批准并执行此操作'),deny=el('button','拒绝');approve.type=deny.type='button';approve.disabled=actionBusy||(request.engine!=='codex'&&data.available!==true);deny.disabled=actionBusy;deny.style.marginLeft='8px';
    approve.onclick=()=>void decide(request,'approve');deny.onclick=()=>void decide(request,'deny');card.append(approve,deny);
    if(request.engine!=='codex'&&data.available!==true)card.append(el('p','执行环境未就绪，暂不能批准。'));
   }
   
   if(['pending','awaiting_approval'].includes(request.status)){dock.append(card);dock.hidden=false;}
  }
  for(const file of sessionFiles){const origin=(file.origins||[]).find(r=>r.conversationId===current);if(origin)append(fileLink(file),origin);}
  log.scrollTop=position;
 }
 function render(){
  const backendText = data.backend === 'native' ? '本地安全工作区' : 'Docker 执行环境';
  status.textContent=`工作区：${data.workspaceRoot||'未配置'} · ${data.available?`${backendText}已就绪`:`${backendText}未就绪`}。审批操作请回到发起请求的对话。${data.available?'':' '+(data.error||'请检查运行环境。')}`;
  list.replaceChildren();for(const request of data.requests||[]){const row=details(`${body(request).kind||'操作'} · ${request.status}${owner(request)?'':' · 未关联对话，仅保留记录'}`,describe(request));if(request.engine!=='codex'&&!['pending','consumed','running'].includes(request.status)){const remove=el('button','删除记录');remove.disabled=actionBusy;remove.onclick=()=>{if(window.confirm('删除这条执行记录？实际文件和会话文件关联将保留。'))void decide(request,'delete');};row.append(remove);}list.append(row);}
  const library=document.getElementById('workspace-file-library');if(library){library.replaceChildren(el('h2','工作区文件'),el('p','全部会话的工作区文件；各对话内仅显示关联文件。'));for(const file of files)library.append(fileLink(file));if(!files.length)library.append(el('p','暂无工作区文件。'));}
  renderConversation();
 }
 async function decide(request,action,payload={}){
  if(actionBusy||(action!=='delete'&&owner(request)&&owner(request)!==window.__zoraConversationContext?.()?.conversationId))return;
  actionBusy=true;renderConversation();error.textContent='';
  try{await json('/api/local-runtime/requests/'+encodeURIComponent(request.id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Zora-Approval':'user'},body:JSON.stringify(payload)});}
  catch(e){error.textContent=e.message;}
  finally{actionBusy=false;await refresh();if(error.textContent){const log=document.querySelector('#conversation-runtime');if(log){const alert=el('p',error.textContent);alert.setAttribute('role','alert');log.append(alert);}}}
 }
 async function refresh(){
  if(busy||disposed)return;busy=true;
  const results=await Promise.allSettled([json('/api/local-runtime'),json('/api/workspace-files')]);
  if(results[0].status==='fulfilled')data=results[0].value;else{data={...data,available:false};error.textContent=results[0].reason.message;}
  if(results[1].status==='fulfilled')files=results[1].value.files||[];else error.textContent='工作区文件读取失败：'+results[1].reason.message;
  window.dispatchEvent(new CustomEvent('zora-runtime-state',{detail:data}));pruneInteractionForms(data.requests||[]);render();busy=false;
 }
 const settings=document.getElementById('settings');if(settings){const row=el('div');row.className='setting-row';const text=el('div');text.append(el('h3','Codex 操作审批'),el('p','从下一项任务生效；当前待审批操作仍需单独处理。此设置控制 Codex 原生执行，其他工具保留各自审批。'));const select=el('select');select.setAttribute('aria-label','Codex 操作审批');for(const [value,label] of [['ask','请求批准 · 工作区外写入与网络访问'],['smart','帮我批准 · 自动放行可信命令'],['full','完全访问 · 不请求原生工具审批']]){const option=el('option',label);option.value=value;select.append(option);}select.disabled=true;let saved='smart';json('/api/local-runtime/codex/approval-mode').then(v=>{saved=v.mode;select.value=saved;select.disabled=false;}).catch(e=>error.textContent=e.message);select.onchange=async()=>{const mode=select.value;if(mode==='full'&&!window.confirm('允许 Codex 原生工具访问本机文件和网络，不再逐项审批？付款、发送消息、修改账号权限和批量删除仍需确认。')){select.value=saved;return;}select.disabled=true;try{await json('/api/local-runtime/codex/approval-mode',{method:'POST',headers:{'Content-Type':'application/json','X-Zora-Approval':'user'},body:JSON.stringify({mode})});saved=mode;}catch(e){select.value=saved;error.textContent=e.message;}finally{select.disabled=false;}};const picker=el('div');picker.className='approval-picker';const trigger=el('button');trigger.type='button';trigger.className='approval-picker-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');const menu=el('div');menu.className='approval-picker-menu';menu.hidden=true;menu.setAttribute('role','listbox');menu.setAttribute('aria-label','Codex 操作审批');const choices=[];const sync=()=>{trigger.textContent=select.selectedOptions[0]?.textContent||'加载审批设置…';trigger.disabled=select.disabled;for(const button of choices){button.setAttribute('aria-selected',String(button.dataset.value===select.value));}};const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};for(const option of select.options){const button=el('button');button.type='button';button.setAttribute('role','option');button.dataset.value=option.value;const [title,description]=option.textContent.split(' · ');button.append(el('strong',title),el('small',description));button.onclick=async()=>{close();trigger.focus();if(select.disabled||select.value===option.value)return;select.value=option.value;const pending=select.onchange();sync();await pending;sync();};choices.push(button);menu.append(button);}trigger.onclick=()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)choices.find(b=>b.dataset.value===select.value)?.focus();};picker.onkeydown=e=>{if(e.key==='Escape'){close();trigger.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();menu.hidden=false;trigger.setAttribute('aria-expanded','true');const index=choices.indexOf(document.activeElement);choices[e.key==='Home'?0:e.key==='End'?choices.length-1:(index+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length].focus();}};picker.onfocusout=e=>{if(!picker.contains(e.relatedTarget))close();};document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))close();});new MutationObserver(sync).observe(select,{attributes:true,attributeFilter:['disabled']});select.hidden=true;picker.append(trigger,menu,select);sync();row.append(text,picker);settings.append(row);}
 refreshButton.onclick=()=>void refresh();
 const timer=setInterval(()=>{if(!document.hidden)void refresh();},5000);
 window.addEventListener('zora:conversation-rendered',renderConversation);void refresh();
 return {refresh,dispose(){anchorObserver.disconnect();window.removeEventListener('resize',positionDock);window.removeEventListener('scroll',positionDock,true);dock.remove();disposed=true;clearInterval(timer);window.removeEventListener('zora:conversation-rendered',renderConversation);}};
}
if(typeof document!=='undefined')mountRuntimePanel(document.getElementById('local-runtime-panel'));

import {mountToolSettings} from './tool-settings.js?v=studio181';
mountToolSettings(document.getElementById('settings'));
