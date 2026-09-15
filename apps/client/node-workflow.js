export const nodeKind=n=>['text','free','novel-input'].includes(n.type)?'agent':['res-image','t2i','i2i'].includes(n.type)?'image':['res-video','t2v','i2v'].includes(n.type)?'video':null;
const activeRequests=new Set();
export const isNodeRunning=id=>activeRequests.has(id);
export function connectNodes(nodes,sourceId,targetId){
 const source=nodes.find(n=>n.id===sourceId),target=nodes.find(n=>n.id===targetId);
 if(!source||!target||!nodeKind(source)||!nodeKind(target))throw Error('请选择文字、图片或视频节点');
 const reaches=(id,seen=new Set())=>{if(id===targetId)return true;if(seen.has(id))return false;seen.add(id);return (nodes.find(n=>n.id===id)?.inputs||[]).some(i=>reaches(i,seen));};
 if(reaches(sourceId))throw Error('不能连接自己或形成循环');
 target.inputs=[...new Set([...(target.inputs||[]),sourceId])];
}
export function collectNodeInput(nodes,node){
 const texts=[],references=[];
 const append=(n,upstream)=>{
  if(upstream&&['running','submitted','failed'].includes(n.runState))throw Error('上游节点尚未提供有效结果：'+(n.label||n.id));
  if(nodeKind(n)==='agent'){const text=n.outputText||n.prompt;if(text)texts.push(text);else if(upstream)throw Error('上游文本为空');}
  else {const url=n.outputUrl||n.mediaData||n.imageData;if(url)references.push({name:n.label||n.id,type:n.outputUrl?(nodeKind(n)==='video'?'video/mp4':'image/png'):(n.mediaType||'image/png'),contentUrl:url});else if(upstream)throw Error('上游素材尚未生成或上传');}
 };
 for(const id of node.inputs||[]){const n=nodes.find(n=>n.id===id);if(!n)throw Error('上游节点已删除，请移除失效连接');append(n,true);}
 if(node.prompt)texts.push(node.prompt);
 if(nodeKind(node)!=='agent'&&(node.mediaData||node.imageData))references.push({name:'当前节点参考',type:node.mediaType||'image/png',contentUrl:node.mediaData||node.imageData});
 return {prompt:texts.join('\n\n'),references};
}
export function mountNodeWorkflow(el,n,{nodes,models,persist,render,runMedia,saveResult}){
 const kind=nodeKind(n);if(!kind)return;
 let panel=el.querySelector('.image-node-editor');
 if(!panel){panel=document.createElement('div');panel.className='image-node-editor text-node-editor';panel.innerHTML='<textarea aria-label="文本节点输入" placeholder="输入指令，或选择文字模型生成内容…"></textarea>';el.append(panel);panel.querySelector('textarea').value=n.prompt||'';panel.querySelector('textarea').oninput=e=>{n.prompt=e.target.value;n.outputText='';n.runState='';persist();};}
 for(const stale of panel.querySelectorAll('.image-node-footer,.video-node-mode'))stale.remove();
 const stop=e=>e.stopPropagation();for(const type of ['pointerdown','dblclick','wheel','keydown'])panel.addEventListener(type,stop);
 const incoming=document.createElement('div');incoming.className='node-incoming';
 for(const id of n.inputs||[]){const source=nodes.find(x=>x.id===id),button=document.createElement('button');button.textContent=(source?.label||'已删除节点')+' ×';button.title='断开这条输入';button.onclick=()=>{n.inputs=n.inputs.filter(x=>x!==id);persist();render();};incoming.append(button);}
 panel.prepend(incoming);
 const controls=document.createElement('div');controls.className='node-generation-controls';
 const select=document.createElement('select');select.setAttribute('aria-label','节点模型');
 const available=models.filter(m=>m.kind===kind&&m.enabled!==false);
 for(const m of available)select.add(new Option(m.name||m.id,m.id));
 const savedModel=available.find(m=>m.id===n.modelId||m.aliases?.includes(n.modelId));if(savedModel)select.value=savedModel.id;
 n.modelId=select.value;select.onchange=()=>{n.modelId=select.value;n.params={};n.conversationId=undefined;persist();render();};controls.append(select);
 const model=available.find(m=>m.id===n.modelId);
 n.params||={};
 const option=(key,label,values)=>{if(!values?.length)return;const field=document.createElement('select');field.setAttribute('aria-label',label);for(const v of values)field.add(new Option(key==='duration'&&Number(v)===-1?'自动':String(v.name??v),String(v.id??v)));if([...field.options].some(o=>o.value===String(n.params[key])))field.value=String(n.params[key]);n.params[key]=field.value;field.onchange=()=>{n.params[key]=field.value;persist();};controls.append(field);};
 if(kind!=='agent'&&model){option('ratio','节点比例',model.ratios);option('resolution','节点分辨率',model.resolutions);option('videoMode','节点生成模式',model.modes?.filter(m=>m.enabled!==false));if(kind==='video'){const r=model.durationRange;option('duration','节点时长',model.fixedSeconds!=null?[model.fixedSeconds]:model.durations?.length?model.durations:r?Array.from({length:Math.floor((r.max-r.min)/r.step)+1},(_,i)=>r.min+i*r.step):model.durations);}option('count','节点数量',Array.from({length:model.maxCount||1},(_,i)=>i+1));option('concurrency','节点并发',Array.from({length:model.maxConcurrency||1},(_,i)=>i+1));}
 const status=document.createElement('div');status.className='node-run-status';status.textContent=n.runState==='running'?'正在请求…':n.runState==='submitted'?(n.error||'生成中，将自动获取结果'):n.error||n.outputText||(n.outputUrl?'素材已生成':'');
 const button=document.createElement('button');button.className='node-run';button.textContent=kind==='agent'?'生成文字':'生成'+(kind==='image'?'图片':'视频');button.disabled=!model||['running','submitted'].includes(n.runState);
 button.onclick=async()=>{
  if(n.runState==='running')return;
  try{
   const input=collectNodeInput(nodes,n);if(!input.prompt.trim())throw Error('请输入指令或连接文本节点');if(input.references.length>6)throw Error('一个节点最多接入 6 个参考素材，请断开多余输入');
   if(kind==='agent'&&input.references.some(r=>!r.type.startsWith('image/')))throw Error('文字节点当前只支持文字与图片输入');
   n.runState='running';activeRequests.add(n.id);n.error='';n.outputText='';n.outputUrl='';persist();render();
   if(kind==='agent'){
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:n.conversationId,channel:'canvas',modelId:n.modelId,message:input.prompt,skills:[],references:input.references})});const result=await response.json();if(!response.ok||!result.reply)throw Error(result.error||'文字模型未返回内容');n.conversationId=result.conversationId;n.outputText=result.reply;n.runState='complete';
   }else{
    n.genBatchId=crypto.randomUUID();persist();const message={kind,modelId:n.modelId,text:input.prompt,...n.params,references:input.references,genBatchId:n.genBatchId};await runMedia(message);n.genBatchId=message.genBatchId;n.genPending=message.genPending;n.outputUrls=message.genUrls;n.outputUrl=message.genUrl||'';n.taskIds=message.genTaskIds;n.taskId=message.genTaskId;n.error=message.genError;n.runState=message.genPending||n.taskIds?.length?'submitted':n.outputUrl?'complete':'failed';
   }
  }catch(e){n.runState=e.submissionUnknown?'submitted':'failed';n.genPending=!!e.submissionUnknown;n.error=e.message||'生成失败';}
  finally{activeRequests.delete(n.id);saveResult(n);render();}
 };
 controls.append(button);panel.append(controls,status);
 if(kind==='agent'){const reset=document.createElement('button');reset.textContent='新文字会话';reset.disabled=n.runState==='running';reset.onclick=()=>{n.conversationId=undefined;n.error='';n.runState='';persist();render();};controls.append(reset);}
 if(['running','submitted'].includes(n.runState))for(const field of el.querySelectorAll('textarea,select,input,[data-upload],[data-copy],.image-node-reference button,.node-incoming button'))field.disabled=true;
 if((n.genBatchId||n.taskId)&&n.runState==='submitted'){const refresh=document.createElement('button');refresh.textContent='刷新生成结果';refresh.onclick=async()=>{refresh.disabled=true;try{const message={kind,modelId:n.modelId,genBatchId:n.genBatchId,genPending:!!n.genBatchId,genTaskId:n.taskId,genTaskIds:n.taskIds,genUrls:n.outputUrls};await runMedia(message);n.genBatchId=message.genBatchId;n.genPending=message.genPending;n.outputUrls=message.genUrls;n.outputUrl=message.genUrl||'';n.taskIds=message.genTaskIds;n.taskId=message.genTaskId;n.error=message.genError;n.runState=message.genPending||n.taskIds?.length?'submitted':n.outputUrl?'complete':'failed';}catch(e){n.error=e.message;if(e.terminal){n.runState='failed';n.taskId=null;n.taskIds=[];}}finally{saveResult(n);render();}};controls.append(refresh);}
 if(n.outputUrls?.length>1){const outputs=document.createElement('select');outputs.setAttribute('aria-label','节点输出素材');n.outputUrls.forEach((url,i)=>outputs.add(new Option('输出素材 '+(i+1),url)));outputs.value=n.outputUrl;outputs.onchange=()=>{n.outputUrl=outputs.value;saveResult(n);render();};controls.append(outputs);}
 if(n.outputText){const preview=el.querySelector('.canvas-node-body small');if(preview)preview.textContent=n.outputText;}
}
