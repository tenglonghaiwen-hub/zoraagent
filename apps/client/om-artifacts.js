export function localMediaPaths(message){
 const paths=new Set();
 const add=value=>{if(typeof value==='string'&&/^(?:[a-z]:[\\/]|\/)/i.test(value)&&/\.(wav|mp3|m4a|ogg|mp4|webm|mov|png|jpe?g|webp|gif)$/i.test(value))paths.add(value);};
 const walk=(value,depth=0)=>{if(depth>8)return;if(typeof value==='string')add(value);else if(Array.isArray(value))value.forEach(v=>walk(v,depth+1));else if(value&&typeof value==='object')Object.values(value).forEach(v=>walk(v,depth+1));};
 for(const trace of message.toolTrace||[])if(trace.name==='om_execute_tool'&&trace.result?.ok!==false)walk(trace.result);
 // Recover older replies that only contain a Markdown link to the local file.
 for(const match of (message.answer||'').matchAll(/\]\(([^\r\n]+?)\)/g))add(match[1]);
 return [...paths].slice(0,20);
}
export function renderLocalMedia(container,message,localFetch=globalThis.fetch.bind(globalThis)){
 const paths=localMediaPaths(message);if(!paths.length)return;
 const card=document.createElement('section');card.className='conversation-task-card';
 card.textContent='正在检查本地媒体文件…';container.append(card);
 localFetch('/api/om/artifacts/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths})}).then(async response=>{
  if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error('本地媒体读取失败（HTTP '+response.status+'）：'+(detail.error||'请重启更新后的客户端后台'));}return response.json();
 }).then(result=>{
  card.replaceChildren();
  for(const file of result.files||[]){
   const row=document.createElement('div');const title=document.createElement('p');title.textContent=file.name;row.append(title);
   const player=document.createElement(file.kind==='audio'?'audio':file.kind==='video'?'video':'img');
   player.src=file.url;if(file.kind!=='image'){player.controls=true;player.preload='metadata';}else player.alt=file.name;
   player.style.maxWidth='100%';player.style.maxHeight='400px';
   player.addEventListener('error',()=>{title.textContent=file.name+' · 无法播放，请下载查看或检查文件';});
   const download=document.createElement('a');download.href=file.url;download.download=file.name;download.textContent='下载';download.className='secondary';
   row.append(player,download);card.append(row);
  }
  if(result.errors?.length){const error=document.createElement('p');error.textContent='部分本地文件不存在、为空或不可访问，无法预览。';card.append(error);}
 }).catch(error=>{card.textContent=error.message||'本地媒体读取失败';});
}
