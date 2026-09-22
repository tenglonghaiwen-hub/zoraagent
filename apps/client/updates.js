const settings=document.querySelector('#settings');
if(settings){
 const section=document.createElement('section');section.className='settings-card';
 section.innerHTML='<h2>软件更新</h2><p data-version></p><p role="status" aria-live="polite"></p><button type="button" data-action="check">检查更新</button> <button type="button" data-action="download" hidden>下载更新</button> <button type="button" data-action="install" hidden>退出并安装</button><p class="muted">稳定版通道 · 不会自动下载安装；安装前请保存工作并等待任务结束。</p>';
 settings.append(section);
 const api=window.zoraDesktop?.update;
 const status=section.querySelector('[role=status]');
 let pending=false;
 function render(state){
  section.querySelector('[data-version]').textContent=`当前版本：${state.version||'网页模式'}`;
  status.textContent=state.message;
  section.querySelector('[data-action=download]').hidden=state.phase!=='available';
  section.querySelector('[data-action=install]').hidden=state.phase!=='downloaded';
  for(const button of section.querySelectorAll('button'))button.disabled=pending||['disabled','checking','downloading'].includes(state.phase);
 }
 async function run(action){try{render(await api(action));}catch(error){status.textContent=error.message;}}
 section.addEventListener('click',async event=>{const action=event.target.dataset.action;if(!action||pending||!api)return;pending=true;try{await run(action);}finally{pending=false;await run('status');}});
 if(api){run('status');setInterval(()=>{if(!document.hidden&&!settings.hidden)run('status');},1000);}
 else render({phase:'disabled',message:'请在安装版桌面客户端中检查更新'});
}
