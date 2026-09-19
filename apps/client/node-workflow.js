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
  else {
   const url=n.outputUrl||n.mediaData||n.imageData;
   if(url){
    // 解析提示词中针对该素材的即梦式约束（如 @图片素材1 人物面部与姿态一致）
    let roleOrConstraint = '';
    const nodeLabel = n.label || n.id;
    const promptText = node.prompt || '';
    const mentionRegex = new RegExp('@' + nodeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s+([^@\\n,，。；]+))?', 'i');
    const match = promptText.match(mentionRegex);
    if(match && match[1]){
      roleOrConstraint = match[1].trim();
    }
    const refItem = {
      name: nodeLabel,
      type: n.outputUrl?(nodeKind(n)==='video'?'video/mp4':'image/png'):(n.mediaType||'image/png'),
      contentUrl: url,
      role: roleOrConstraint ? 'user-constraint' : 'agent-auto-infer'
    };
    if (roleOrConstraint) {
      refItem.constraint = roleOrConstraint;
    }
    references.push(refItem);
   }
   else if(upstream)throw Error('上游素材尚未生成或上传');
  }
 };
 for(const id of node.inputs||[]){const n=nodes.find(n=>n.id===id);if(!n)throw Error('上游节点已删除，请移除失效连接');append(n,true);}
 if(node.prompt)texts.push(node.prompt);
 if(nodeKind(node)!=='agent'&&(node.mediaData||node.imageData))references.push({name:'当前节点参考',type:node.mediaType||'image/png',contentUrl:node.mediaData||node.imageData,role:'self-reference'});
 return {prompt:texts.join('\n\n'),references};
}
export function mountNodeWorkflow(el,n,{nodes,models,persist,render,runMedia,saveResult}){
 const kind=nodeKind(n);if(!kind)return;
 let panel=el.querySelector('.image-node-editor');
 if(!panel){panel=document.createElement('div');panel.className='image-node-editor text-node-editor';panel.innerHTML='<textarea aria-label="文本节点输入" placeholder="输入指令，可键入 @ 约束已连接素材…"></textarea>';el.append(panel);panel.querySelector('textarea').value=n.prompt||'';panel.querySelector('textarea').oninput=e=>{n.prompt=e.target.value;n.outputText='';n.runState='';persist();};}
 for(const stale of panel.querySelectorAll('.image-node-footer,.video-node-mode'))stale.remove();
 const stop=e=>e.stopPropagation();for(const type of ['pointerdown','dblclick','wheel','keydown'])panel.addEventListener(type,stop);
 
 const incoming=document.createElement('div');incoming.className='node-incoming';
 for(const id of n.inputs||[]){const source=nodes.find(x=>x.id===id),button=document.createElement('button');button.textContent=(source?.label||'已删除节点')+' ×';button.title='断开这条输入';button.onclick=()=>{n.inputs=n.inputs.filter(x=>x!==id);persist();render();};incoming.append(button);}
 panel.prepend(incoming);

 // ----------------------------------------------------
 // 即梦式 @素材引用 智能提示（支持已连接素材约束与自动连线）
 // ----------------------------------------------------
 const textarea = panel.querySelector('textarea');
 if(textarea){
   // 显式快捷工具栏：[@ 引用素材] 按钮（双保险）
   let triggerBar = panel.querySelector('.node-mention-trigger-bar');
   if(!triggerBar){
     triggerBar = document.createElement('div');
     triggerBar.className = 'node-mention-trigger-bar';
     triggerBar.innerHTML = '<span class="node-mention-hint">💡 输入 <b>@</b> 或 <b>＠</b> 引用素材约束</span><button type="button" class="node-mention-trigger-btn" title="点击立即选择并引用画布素材">@ 引用素材</button>';
     textarea.parentNode.insertBefore(triggerBar, textarea);
   }

   let mentionPop = document.querySelector('.node-mention-pop');
   if(!mentionPop){
     mentionPop = document.createElement('div');
     mentionPop.className = 'node-mention-pop';
     mentionPop.hidden = true;
     document.body.append(mentionPop);
   }

   const hideMentionPop = () => {
     if(mentionPop){
       mentionPop.hidden = true;
       mentionPop.replaceChildren();
     }
   };

   const updatePopPosition = () => {
     if(!mentionPop || mentionPop.hidden) return;
     const rect = textarea.getBoundingClientRect();
     mentionPop.style.position = 'fixed';
     mentionPop.style.zIndex = '999999';
     mentionPop.style.width = Math.min(420, Math.max(280, rect.width)) + 'px';
     mentionPop.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - 440)) + 'px';
     const popHeight = 240;
     if(rect.bottom + popHeight + 12 <= window.innerHeight){
       mentionPop.style.top = (rect.bottom + 6) + 'px';
       mentionPop.style.bottom = 'auto';
     } else {
       mentionPop.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
       mentionPop.style.top = 'auto';
     }
   };

   const checkMentions = (forceOpen = false) => {
     const textBefore = textarea.value.slice(0, textarea.selectionStart);
     const match = textBefore.match(/[@\uff20]([^@\uff20\s]*)$/);
     if(!match && !forceOpen){
       hideMentionPop();
       return;
     }
     const query = (match ? match[1] : '').toLowerCase();
     const queryLen = match ? match[0].length : 0;
     const startPos = textarea.selectionStart - queryLen;

     // 已连接素材与画布其他素材
     const connected = (n.inputs || []).map(id => nodes.find(x => x.id === id)).filter(Boolean);
     const otherMedia = nodes.filter(x => x.id !== n.id && !(n.inputs || []).includes(x.id) && (x.imageData || x.mediaData || x.outputUrl || nodeKind(x)));

     const filterList = (list) => list.filter(c => {
       const label = c.label || c.id || '';
       return !query || label.toLowerCase().includes(query);
     });

     const matchedConnected = filterList(connected);
     const matchedOther = filterList(otherMedia);
     mentionPop.replaceChildren();

     if(!matchedConnected.length && !matchedOther.length){
       const empty = document.createElement('div');
       empty.className = 'mention-empty-hint';
       empty.textContent = '画布上暂无匹配的素材节点。可先在画布创建图片/视频素材节点。';
       mentionPop.append(empty);
       mentionPop.hidden = false;
       updatePopPosition();
       return;
     }

     const appendItem = (item, isConn) => {
       const row = document.createElement('button');
       row.type = 'button';
       row.className = 'mention-item-row';
       const labelText = item.label || item.id;

       const thumbUrl = item.outputUrl || item.imageData || item.mediaData;
       let thumbEl = null;
       if(thumbUrl){
         thumbEl = document.createElement('img');
         thumbEl.src = thumbUrl;
         thumbEl.className = 'mention-thumb';
       } else {
         thumbEl = document.createElement('span');
         thumbEl.className = 'mention-thumb-placeholder';
         thumbEl.textContent = nodeKind(item) === 'video' ? '🎬' : '🖼️';
       }

       const meta = document.createElement('div');
       meta.className = 'mention-meta';
       const name = document.createElement('strong');
       name.textContent = '@' + labelText;
       const desc = document.createElement('small');
       desc.textContent = isConn
         ? (nodeKind(item) === 'video' ? '已连接 · 可约束动作/运镜' : '已连接 · 可约束面部/构图/风格')
         : '未连接 · 点击自动连线并引用该素材';
       meta.append(name, desc);

       const badge = document.createElement('span');
       badge.className = 'mention-item-badge ' + (isConn ? 'mention-badge-connected' : 'mention-badge-connectable');
       badge.textContent = isConn ? '已连接' : '+ 自动连线';

       row.append(thumbEl, meta, badge);

       row.onpointerdown = e => e.preventDefault();
       row.onclick = e => {
         e.stopPropagation();
         if(!isConn){
           try{ connectNodes(nodes, item.id, n.id); }catch{}
         }
         const insertText = `@${labelText} `;
         textarea.setRangeText(insertText, startPos, textarea.selectionStart, 'end');
         n.prompt = textarea.value;
         persist();
         hideMentionPop();
         render();
         textarea.focus();
       };
       mentionPop.append(row);
     };

     if(matchedConnected.length){
       const title = document.createElement('div');
       title.className = 'mention-pop-title';
       title.textContent = '已连接素材（赋予约束）：';
       mentionPop.append(title);
       matchedConnected.forEach(item => appendItem(item, true));
     }

     if(matchedOther.length){
       const title = document.createElement('div');
       title.className = 'mention-pop-title';
       title.textContent = matchedConnected.length ? '其他画布素材（点击自动连线并引用）：' : '画布素材（点击自动连接到本节点）：';
       mentionPop.append(title);
       matchedOther.forEach(item => appendItem(item, false));
      }
      mentionPop.hidden = false;
      updatePopPosition();
    };

    const triggerBtn = triggerBar.querySelector('.node-mention-trigger-btn');
    if(triggerBtn){
      triggerBtn.onclick = (e) => {
        e.stopPropagation();
        textarea.focus();
        checkMentions(true);
      };
    }

    const onInputOrComp = () => checkMentions(false);
    textarea.addEventListener('input', onInputOrComp);
    textarea.addEventListener('compositionend', onInputOrComp);
    textarea.addEventListener('click', onInputOrComp);
    textarea.addEventListener('keyup', e => {
      if(e.key === 'Escape') hideMentionPop();
      else checkMentions(false);
    });

    const docPointerHandler = (e) => {
      if(!mentionPop.contains(e.target) && e.target !== textarea && !e.target.closest('.node-mention-trigger-btn')){
        hideMentionPop();
      }
    };
    document.addEventListener('pointerdown', docPointerHandler);
    window.addEventListener('resize', updatePopPosition);
    window.addEventListener('scroll', updatePopPosition, true);
  }

  // ----------------------------------------------------
  // 高级参数控制面板：模式选择、比例、画质、时长、并发、数量
  // ----------------------------------------------------
  const controls=document.createElement('div');controls.className='node-generation-controls';

  const available=models.filter(m=>m.kind===kind&&m.enabled!==false);
  const savedModel=available.find(m=>m.id===n.modelId||m.aliases?.includes(n.modelId))||available[0];
  if(savedModel)n.modelId=savedModel.id;
  const model=savedModel;
  n.params||={};

  // 1. 顶部胶囊工具条：类型标识 + 模型选择 + 生成模式 (文生/图生/参考生/首尾帧)
  const pillBar=document.createElement('div');pillBar.className='node-pill-bar';

  // 类型标识胶囊
  const typePill=document.createElement('div');typePill.className='node-pill pill-type';
  const typeLabel=kind==='video'?'视频生成':kind==='image'?'图片生成':'文本生成';
  typePill.innerHTML=`<span class="pill-accent">${typeLabel}</span>`;
  pillBar.append(typePill);

  // 模型选择胶囊
  const modelPill=document.createElement('div');modelPill.className='node-pill pill-model';
  const select=document.createElement('select');select.setAttribute('aria-label','节点模型');
  for(const m of available)select.add(new Option(m.name||m.id,m.id));
  if(model)select.value=model.id;
  select.onchange=()=>{n.modelId=select.value;n.params={};n.conversationId=undefined;persist();render();};
  const modelText=document.createElement('span');modelText.className='pill-text';modelText.textContent=model?.name||model?.id||'选择模型';
  const modelChevron=document.createElement('span');modelChevron.className='pill-chevron';modelChevron.textContent='⌄';
  modelPill.append(modelText,modelChevron,select);
  pillBar.append(modelPill);

  // 模式选择胶囊 (文生图/图生图/参考生/文生视频/首帧/首尾帧)
  let modeHintText='';
  if(kind!=='agent'){
    const modePill=document.createElement('div');modePill.className='node-pill pill-mode';
    const defaultModes=kind==='video'?[
      {id:'t2v',name:'文生视频'},
      {id:'i2v',name:'首帧生视频'},
      {id:'fl',name:'首尾帧'},
      {id:'ref',name:'全能参考'},
      {id:'v2v',name:'参考视频'}
    ]:[
      {id:'t2i',name:'文生图'},
      {id:'i2i',name:'图生图'},
      {id:'ref',name:'全能参考'}
    ];
    const rawModes=Array.isArray(model?.modes)&&model.modes.length?model.modes:defaultModes;
    const activeModes=rawModes.filter(m=>m.enabled!==false);
    const modeSelect=document.createElement('select');modeSelect.setAttribute('aria-label','生成模式');
    for(const m of activeModes)modeSelect.add(new Option(m.name,m.id));
    
    if(n.params.videoMode&&activeModes.some(m=>m.id===n.params.videoMode)){
      modeSelect.value=n.params.videoMode;
    }else{
      n.params.videoMode=modeSelect.value||activeModes[0]?.id;
    }
    const currentModeName=activeModes.find(m=>m.id===n.params.videoMode)?.name||'生成模式';
    const modeText=document.createElement('span');modeText.className='pill-text';modeText.innerHTML=`<span class="pill-diamond">◇</span> ${currentModeName}`;
    const modeChevron=document.createElement('span');modeChevron.className='pill-chevron';modeChevron.textContent='⌄';
    modeSelect.onchange=()=>{
      n.params.videoMode=modeSelect.value;
      persist();
      render();
    };
    modePill.append(modeText,modeChevron,modeSelect);
    pillBar.append(modePill);

    if(n.params.videoMode==='fl')modeHintText='◇ 首尾帧：请在画板连接 2 张图片，分别作为首帧与尾帧';
    else if(['i2v','i2i'].includes(n.params.videoMode))modeHintText='◇ 图生模式：请在画板连接 1 张图片素材';
    else if(['ref','v2v'].includes(n.params.videoMode))modeHintText='◇ 参考模式：连接素材将作为风格或动作参考';
  }

  controls.append(pillBar);

  if(kind!=='agent'){
    // 2. 核心规格参数网格：比例、画质、数量、并发
    const paramGrid=document.createElement('div');paramGrid.className='node-param-grid';

    // 比例 Ratio
    const ratioCol=document.createElement('div');ratioCol.className='node-param-col';
    ratioCol.innerHTML='<label>比例</label>';
    const ratioSelect=document.createElement('select');ratioSelect.setAttribute('aria-label','节点比例');
    const ratioOptions=model?.ratios?.length?model.ratios:['16:9','9:16','1:1','4:3','3:4','21:9'];
    for(const r of ratioOptions) ratioSelect.add(new Option(r, r));
    if(n.params.ratio && ratioOptions.includes(n.params.ratio)) ratioSelect.value=n.params.ratio;
    else n.params.ratio=ratioSelect.value;
    ratioSelect.onchange=()=>{n.params.ratio=ratioSelect.value;persist();};
    ratioCol.append(ratioSelect);
    paramGrid.append(ratioCol);

    // 画质 / 分辨率 Resolution
    const resCol=document.createElement('div');resCol.className='node-param-col';
    resCol.innerHTML='<label>画质</label>';
    const resSelect=document.createElement('select');resSelect.setAttribute('aria-label','节点画质');
    const resOptions=model?.resolutions?.length?model.resolutions:['720P','1080P','1K','2K','4K'];
    for(const r of resOptions) resSelect.add(new Option(r, r));
    if(n.params.resolution && resOptions.includes(n.params.resolution)) resSelect.value=n.params.resolution;
    else n.params.resolution=resSelect.value;
    resSelect.onchange=()=>{n.params.resolution=resSelect.value;persist();};
    resCol.append(resSelect);
    paramGrid.append(resCol);

    // 一次性生成数量 Count
    const countCol=document.createElement('div');countCol.className='node-param-col';
    countCol.innerHTML='<label>数量</label>';
    const countSelect=document.createElement('select');countSelect.setAttribute('aria-label','生成数量');
    const maxCount=model?.maxCount||4;
    for(let i=1; i<=Math.min(maxCount, 4); i++) countSelect.add(new Option(`${i} 张`, i));
    if(n.params.count) countSelect.value=String(n.params.count);
    else n.params.count=1;
    countSelect.onchange=()=>{n.params.count=Number(countSelect.value);persist();};
    countCol.append(countSelect);
    paramGrid.append(countCol);

    // 并发上限 Concurrency
    const concCol=document.createElement('div');concCol.className='node-param-col';
    concCol.innerHTML='<label>并发</label>';
    const concSelect=document.createElement('select');concSelect.setAttribute('aria-label','并发上限');
    const maxConcurrency=model?.maxConcurrency||2;
    for(let c=1; c<=Math.min(maxConcurrency, 4); c++) concSelect.add(new Option(`${c} 路`, c));
    if(n.params.concurrency) concSelect.value=String(n.params.concurrency);
    else n.params.concurrency=1;
    concSelect.onchange=()=>{n.params.concurrency=Number(concSelect.value);persist();};
    concCol.append(concSelect);
    paramGrid.append(concCol);

    controls.append(paramGrid);

    // 3. 视频专属：时长滑杆 Duration Slider
    if(kind==='video'){
      const sliderRow=document.createElement('div');sliderRow.className='node-slider-row';
      const range=model?.durationRange||{min:4,max:15,step:1};
      const minD=range.min||3, maxD=range.max||15, stepD=range.step||1;
      const durationVal=Number(n.params.duration)||minD||5;
      sliderRow.innerHTML=`<div class="slider-header"><label><span class="duration-clock">⏱</span> 生成时长</label><span class="slider-badge">${durationVal} 秒</span></div><input type="range" min="${minD}" max="${maxD}" step="${stepD}" value="${durationVal}" aria-label="视频时长滑杆">`;
      const rangeInput=sliderRow.querySelector('input[type="range"]');
      const badge=sliderRow.querySelector('.slider-badge');
      rangeInput.oninput=()=>{
        const val=rangeInput.value;
        badge.textContent=`${val} 秒`;
        n.params.duration=Number(val);
        persist();
      };
      controls.append(sliderRow);
    }

    // 4. 模式辅助提示
    if(modeHintText){
      const hint=document.createElement('div');hint.className='node-mode-hint';
      hint.textContent=modeHintText;
      controls.append(hint);
    }
  }

 const status=document.createElement('div');status.className='node-run-status';status.textContent=n.runState==='running'?'正在请求…':n.runState==='submitted'?(n.error||'生成中，将自动获取结果'):n.error||n.outputText||(n.outputUrl?'素材已生成':'');
 const button=document.createElement('button');button.className='node-run';button.textContent=kind==='agent'?'生成文字':'生成'+(kind==='image'?'图片':'视频');button.disabled=!model||['running','submitted'].includes(n.runState);
 button.onclick=async()=>{
  if(n.runState==='running')return;
  try{
   const input=collectNodeInput(nodes,n);if(!input.prompt.trim())throw Error('请输入指令或连接文本节点');if(input.references.length>6)throw Error('一个节点最多接入 6 个参考素材，请断开多余输入');
   if(kind==='agent'&&input.references.some(r=>!r.type.startsWith('image/')))throw Error('文字节点当前只支持文字与图片输入');
   n.runState='running';activeRequests.add(n.id);n.error='';n.outputText='';n.outputUrl='';persist();render();
    if(kind==='agent'){
     const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:n.conversationId,channel:'canvas',modelId:n.modelId,message:input.prompt,skills:[],references:input.references})});const result=await response.json();if(!response.ok||!result.reply)throw Error(result.error||'文字模型未返回内容');n.conversationId=result.conversationId;
     const isIdQ = /^(你|您)?是(谁|什么|哪位|哪个ai|什么ai|什么模型|哪个模型)|(你|您)(是|叫|基于|用的?(是)?)(什么|哪个|哪款|哪家|谁家的?)(模型|ai|大模型)|(模型|身份)等?相关问题/i.test(String(input.prompt||'').trim());
     const leaksId = /(chatgpt|openai|由\s*openai|anthropic|claude|deepseek|我是.*(?:人工智能助手|语言模型))/i.test(result.reply);
     n.outputText = (isIdQ || leaksId) ? '我是zora agent，我可以帮你回答问题、解释概念、写作、翻译、编程、制作图片和视频以及一起分析和解决问题。你想进行什么工作？' : result.reply;
     n.runState='complete';
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
