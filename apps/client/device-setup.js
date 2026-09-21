const host=document.querySelector('#om-capabilities');
if(host){
 const row=document.createElement('div');row.className='om-cap-row';
 row.innerHTML='<h3>首次使用准备</h3><button type="button" data-vcredist>安装 / 修复 Microsoft C++ 运行库</button><p>若提示 DLL 缺失，可打开包内微软 x64 安装程序；安装需你确认，可能需要管理员权限。</p><p data-startup></p><button type="button" data-retry>重试本地媒体服务</button><p>转录模型会保存到本机缓存；小模型下载更快。下载过程中请保持客户端打开，失败可重试。</p><button type="button" data-model="check">检查所选模型</button> <button type="button" data-model="download">下载 / 重试所选模型</button><p data-model-state role="status"></p><button type="button" data-voice>选择本地音色文件</button><p>请选择获得使用许可的 .onnx 文件，同目录须有同名 .onnx.json。选择后点击“保存媒体设置”。</p>';
 host.append(row);const status=row.querySelector('[data-model-state]');let activeModel;
 async function model(action){const selected=host.querySelector('[name=transcriptModel]').value;const name=action==='status'?activeModel:selected;
  const response=await fetch('/api/om/transcription-model'+(action==='status'?`?model=${encodeURIComponent(name)}`:''),action==='status'?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:name,action})});const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败');activeModel=name;status.textContent=`${name}：${data.message}`+(data.total?`（${Math.round(data.done/data.total*100)}%，当前下载项）`:'');if(['ready','missing','error'].includes(data.phase))activeModel=null;}
 row.addEventListener('click',async event=>{try{
  if(event.target.hasAttribute('data-vcredist')){const result=await window.zoraDesktop?.installVCRuntime?.();status.textContent=result?.message||'请在桌面客户端中安装运行库';}
  if(event.target.dataset.model){if(event.target.dataset.model==='download'&&!confirm('将联网下载所选转录模型，可能占用数百 MB 至数 GB 空间。是否继续？'))return;await model(event.target.dataset.model);}
  if(event.target.hasAttribute('data-voice')){const chosen=await window.zoraDesktop?.chooseVoice?.();if(chosen){host.querySelector('[name=voiceModel]').value=chosen;status.textContent='音色已复制到本机应用数据目录，请保存媒体设置。';}}
  if(event.target.hasAttribute('data-retry')){const result=await window.zoraDesktop?.mediaStartup?.(true);row.querySelector('[data-startup]').textContent=result?.message||'请使用桌面客户端';}
 }catch(error){status.textContent=error.message;}});
 setInterval(()=>{if(!document.hidden&&activeModel)model('status').catch(error=>{status.textContent=error.message;activeModel=null;});},1500);
 window.zoraDesktop?.mediaStartup?.(false).then(result=>row.querySelector('[data-startup]').textContent=result.message);
 if(!window.zoraDesktop?.chooseVoice)row.querySelector('[data-voice]').disabled=true;
}

if(window.zoraDesktop?.network){
 const section=document.createElement('section');section.className='settings-card';
 section.innerHTML='<h2>网络连接</h2><p>配置后完全退出并重新启动客户端。直连或代理设置用于云服务、模型下载和 Agent；本地服务始终直连。跟随环境变量模式需要启动程序的环境已配置代理，不等于所有后台自动使用系统 PAC。</p><label><input type="radio" name="zora-network-mode" value="environment">跟随环境变量</label> <label><input type="radio" name="zora-network-mode" value="direct">直连</label> <label><input type="radio" name="zora-network-mode" value="proxy">指定代理</label><p><input data-proxy type="url" placeholder="http://127.0.0.1:7890" aria-label="代理地址"></p><button type="button">保存网络设置</button><p role="status"></p>';
 document.querySelector('#settings')?.append(section);
 const status=section.querySelector('[role=status]');
 window.zoraDesktop.network().then(config=>{section.querySelector(`[value="${config.mode}"]`).checked=true;section.querySelector('[data-proxy]').value=config.proxy;}).catch(error=>status.textContent=error.message);
 section.querySelector('button').onclick=async()=>{try{await window.zoraDesktop.network({mode:section.querySelector(':checked')?.value,proxy:section.querySelector('[data-proxy]').value});status.textContent='已保存，完全退出并重启后生效。';}catch(error){status.textContent=error.message;}};
}
