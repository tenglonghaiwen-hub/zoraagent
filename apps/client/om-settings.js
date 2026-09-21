const host=document.querySelector('#om-capabilities');
if(host){
 const form=host.querySelector('form'),status=host.querySelector('[role="status"]'),refresh=host.querySelector('[data-refresh]'),save=form.querySelector('[type="submit"]');
 let loaded=false,busy=false;
 const select=form.elements.transcriptModel;
 const picker=document.createElement('div');picker.className='om-cap-picker';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='om-cap-picker-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','默认转录模型');trigger.setAttribute('aria-controls','om-transcript-options');
 const menu=document.createElement('div');menu.id='om-transcript-options';menu.className='om-cap-picker-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label','默认转录模型');menu.hidden=true;
 select.hidden=true;select.tabIndex=-1;select.after(picker);picker.append(trigger,menu);
 const options=[...select.options].map(option=>{const button=document.createElement('button');button.type='button';button.setAttribute('role','option');button.textContent=option.textContent;button.dataset.value=option.value;button.tabIndex=-1;button.addEventListener('click',()=>{select.value=option.value;syncPicker();closePicker(true);});menu.append(button);return button;});
 function syncPicker(){trigger.textContent=select.selectedOptions[0]?.textContent||'选择转录模型';for(const button of options)button.setAttribute('aria-selected',String(button.dataset.value===select.value));}
 function closePicker(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
 function openPicker(){if(trigger.disabled||form.querySelector('fieldset').disabled)return;menu.hidden=false;trigger.setAttribute('aria-expanded','true');options.find(button=>button.dataset.value===select.value)?.focus();}
 trigger.addEventListener('click',()=>menu.hidden?openPicker():closePicker());
 trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openPicker();}});
 menu.addEventListener('keydown',event=>{const index=options.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();closePicker(true);}else if(event.key==='Tab')closePicker();else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}});
 document.addEventListener('click',event=>{if(!picker.contains(event.target))closePicker();});
 picker.addEventListener('focusout',event=>{if(!picker.contains(event.relatedTarget))closePicker();});
 syncPicker();
 const labels={editing:'剪辑与媒体处理',transcription:'语音转录',voice:'本地配音',stock:'公共素材检索'};
 function report(text){status.textContent=text;}
 async function request(url,options){let response;try{response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});}catch(error){throw new Error(error.name==='TimeoutError'?'检查超时，请点击重新检查。':'无法连接本地后台，请启动客户端后重新检查。');}if(response.status===404)throw new Error('后台版本未更新：请完全退出 Zora 客户端后重新启动，再点击“重新检查”。仅刷新页面不会更新后台。');let result;try{result=await response.json();}catch{throw new Error('本地服务未返回有效数据，请重启更新后的客户端。');}if(!response.ok||result.ok===false)throw new Error(result.error||'请求失败');return result;}
 function apply(data){
  const p=data.preferences,d=data.dependencies;
  for(const key of Object.keys(labels))form.elements[key].checked=p[key];
  form.elements.transcriptModel.value=p.transcriptModel;form.elements.voiceModel.value=p.voiceModel;
  syncPicker();
  for(const input of form.querySelectorAll('[name="sources"]'))input.checked=p.sources.includes(input.value);
  const messages={editing:d.ffmpeg&&d.ffprobe?'FFmpeg 已检测到':'缺少 FFmpeg / FFprobe',transcription:d.fasterWhisper?'转录运行库已检测到；模型缓存尚未校验':'缺少 faster-whisper 运行库',voice:!d.piper?'缺少 Piper 程序':d.voiceModel?'程序与音色文件已检测到；尚未试听':'请选择已有音色文件',stock:d.requests?'检索运行库已检测到；来源连通性未检测':'缺少 requests 运行库'};
  for(const [key,text] of Object.entries(messages))host.querySelector(`[data-state="${key}"]`).textContent=text;
  const list=host.querySelector('[data-pipelines]');list.replaceChildren();
  for(const pipeline of data.pipelines){const item=document.createElement('li'),name=document.createElement('strong'),desc=document.createElement('span');name.textContent=pipeline.name;desc.textContent=pipeline.useWhen;item.append(name,desc);list.append(item);}
  for(const provider of ['pexels','unsplash'])host.querySelector(`[data-key-state="${provider}"]`).textContent=data.credentials?.[provider]?'已保存密钥（尚未验证有效性）':'尚未配置密钥';
  loaded=true;form.querySelector('fieldset').disabled=false;
  report(data.diagnosticError||'已读取此设备设置。开关控制后续工具调用，不会中断正在执行的任务。');
 }
 async function load(){if(busy)return;busy=true;refresh.disabled=true;save.disabled=true;report('正在检查本地运行环境…');try{apply(await request('/api/om/capabilities',{cache:'no-store'}));}catch(error){report(error.message);if(!loaded)for(const node of host.querySelectorAll('[data-state]'))node.textContent='未能读取状态，请查看上方提示';}finally{busy=false;refresh.disabled=false;save.disabled=!loaded;}}
 refresh.addEventListener('click',load);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!loaded)return;
  const preferences=Object.fromEntries(Object.keys(labels).map(k=>[k,form.elements[k].checked]));
  preferences.transcriptModel=form.elements.transcriptModel.value;preferences.voiceModel=form.elements.voiceModel.value.trim();preferences.sources=[...form.querySelectorAll('[name="sources"]:checked')].map(el=>el.value);
  busy=true;save.disabled=true;refresh.disabled=true;report('正在保存…');
  try{
   const keys={};for(const provider of ['pexels','unsplash']){const input=form.elements[provider+'Key'];if(form.elements[provider+'Clear'].checked)keys[provider]=null;else if(input.value.trim())keys[provider]=input.value.trim();}
   if(Object.keys(keys).length){const result=await request('/api/om/credentials',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(keys)});for(const provider of ['pexels','unsplash']){form.elements[provider+'Key'].value='';form.elements[provider+'Clear'].checked=false;host.querySelector(`[data-key-state="${provider}"]`).textContent=result.credentials[provider]?'已保存密钥（尚未验证有效性）':'尚未配置密钥';}}
   await request('/api/om/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(preferences)});report('已保存，下次工具调用生效。');}
  catch(error){report(`保存失败：${error.message}`);}finally{busy=false;save.disabled=false;refresh.disabled=false;}
 });
 host.addEventListener('toggle',()=>{if(host.open&&!loaded)load();});
 if(host.open)load();
}
