import {attachGenerationReceipts,applyGenerationReceipt,verifyGenerationRetry} from './agent-generation-tasks.js?v=studio151';
import {recoverTaskReferences} from './task-references.js?v=studio142';
import {prepareMediaReference} from './media-reference.js?v=studio148';
import {saveReference,restoreReference} from './reference-store.js?v=studio137';
import './canvas-dropdown-position.js?v=studio135';
import {normalizeMediaResults} from './media-results.js?v=studio136';
import {nodeKind,connectNodes,mountNodeWorkflow,isNodeRunning} from './node-workflow.js?v=studio136';
import {isAuthenticated, getUser, authFetch, logout, clearAuth} from './auth.js';
import {initLoginPage, initUserMenu, updateUserBalance, clearUserMenu} from './login-handler.js';
function readUIPrefs(){try{return JSON.parse(localStorage.getItem('zora.uiPrefs.v1')||'{}')||{};}catch{return {};}}
function saveUIPref(key,value){try{localStorage.setItem('zora.uiPrefs.v1',JSON.stringify({...readUIPrefs(),[key]:value}));}catch{toast('设置保存失败，请检查本地存储空间');}}
function canvasNodeIcon(type){const paths=type==='res-image'||type==='image'||type==='t2i'||type==='i2i'?'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>':type==='res-video'||type==='video'||type==='t2v'||type==='i2v'?'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m10 8 6 4-6 4Z"/>':'<path d="M5 5h14M5 10h14M5 15h10M5 20h7"/>';return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';}
for(const button of document.querySelectorAll('[data-canvas-node],[data-canvas-gen]')){const icon=button.querySelector('.ccm-icon');if(icon)icon.innerHTML=canvasNodeIcon(button.dataset.canvasNode||button.dataset.canvasGen);}
function ensureBackdrops(){
  const videos=[...document.querySelectorAll('video.backdrop,[data-backdrop="1"]')];
  for(const v of videos){
    v.muted=true;
    v.playsInline=true;
    v.setAttribute('playsinline','');
    const tryPlay=()=>{v.play().catch(()=>{});};
    v.addEventListener('error',()=>{v.dataset.failed='1';const page=v.closest('.page');if(page)page.dataset.backdropFailed='1';}, {once:true});
    if(v.readyState>=2) tryPlay();
    else v.addEventListener('loadeddata',tryPlay,{once:true});
    tryPlay();
  }
}

const $=s=>document.querySelector(s);
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||Error('读取素材失败'));reader.readAsDataURL(file);});}
let models=[],drafts=[],assets=[],generatedAssets=[],assetFilter='upload',toastTimer;
// modelChanged() runs before the picker UI is constructed.
const pickers=[];
function restorePendingMessage(message){
  return message?.pending?{...message,pending:false,recovering:true,error:'页面连接已断开，正在核对后台执行状态，请勿重复发送。'}:message;
}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}

const AUTH_KEY='zora.auth.v1';
const THEME_KEY='zora.theme.v2';
function isAuthed(){try{return isAuthenticated()||localStorage.getItem(AUTH_KEY)==='1';}catch{return false;}}
function setAuthed(on){try{localStorage.setItem(AUTH_KEY,on?'1':'0');if(!on)clearAuth();}catch{}}
function loadTheme(){try{const t=localStorage.getItem(THEME_KEY);if(t==='night')return 'night';return 'day';}catch{return 'day';}}
function applyTheme(theme){
  const t=theme==='night'?'night':'day';
  document.documentElement.dataset.theme=t;
  const btn=document.getElementById('theme-toggle');
  if(btn){
    const sun='<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    const moon='<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/></svg>';
    btn.innerHTML=t==='day'?sun:moon;
    btn.setAttribute('aria-pressed',String(t==='day'));
    btn.title=t==='day'?'切换到夜间模式':'切换到日间模式';
  }
  for(const v of document.querySelectorAll('video.studio-backdrop')){
    const first=v.querySelector('source');
    const want='/media/welcome-backdrop.mp4';
    if(first && !String(first.getAttribute('src')||'').includes('welcome-backdrop')){
      first.setAttribute('src', want);
      v.load();
    }
    v.play().catch(()=>{});
  }
  try{localStorage.setItem(THEME_KEY,t);}catch{}
}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='day'?'night':'day');}


/* Explicit OpenMontage runner on tasks panel */
(function initOmRunPanel(){
  const toolSel=$('#om-tool');
  const projectSel=$('#om-project');
  const instruction=$('#om-instruction');
  const argsEl=$('#om-args');
  const statusEl=$('#om-run-status');
  const runBtn=$('#om-run');
  const refreshBtn=$('#om-refresh');
  if(!toolSel||!projectSel||!runBtn)return;

  const LOCAL_FIRST=['direct_clip_search','video_compose','subtitle_gen','piper_tts','transcriber'];

  const TOOL_ZH={
    direct_clip_search:'智能搜片',
    video_compose:'视频合成',
    subtitle_gen:'字幕生成',
    piper_tts:'语音合成',
    transcriber:'语音转写',
    atlas_3d:'Atlas 三维',
    atlas_image:'Atlas 生图',
    atlas_video:'Atlas 生视频',
    audio_energy:'音频能量分析',
    audio_enhance:'音频增强',
  };
  const CAP_ZH={
    local_studio:'本地工作室',
    analysis:'分析',
    audio_processing:'音频处理',
    clip_acquisition:'搜片',
    video_post:'视频后期',
    subtitle:'字幕',
    tts:'语音合成',
    image_generation:'图片生成',
    video_generation:'视频生成',
    '3d_asset_generation':'三维资产',
  };
  function toolLabel(t, local){
    const name=t.name||'';
    const zh=TOOL_ZH[name]||null;
    const isLocal=local.has(name)||['direct_clip_search','video_compose','subtitle_gen','piper_tts','transcriber'].includes(name);
    const where=isLocal?'本地':'扩展';
    const cap=CAP_ZH[t.capability]||'';
    if(zh) return cap ? `${zh}（${where} · ${cap}）` : `${zh}（${where}）`;
    // fallback: keep id but Chinese wrappers
    return cap ? `${name}（${where} · ${cap}）` : `${name}（${where}）`;
  }

  let loading=false;

  
  const toolTrigger=$('#om-tool-trigger');
  const toolMenu=$('#om-tool-menu');
  const toolMenuList=$('#om-tool-menu-list');
  function closeOmToolMenu(){ if(toolMenu) toolMenu.hidden=true; toolTrigger?.setAttribute('aria-expanded','false'); }
  function openOmToolMenu(){
    if(!toolMenu||!toolTrigger)return;
    const picker=toolTrigger.closest('.om-tool-picker')||toolTrigger.parentElement;
    if(picker && toolMenu.parentElement!==picker) picker.appendChild(toolMenu);
    toolMenu.hidden=false;
    toolTrigger.setAttribute('aria-expanded','true');
    // anchor directly under the trigger box
    toolMenu.style.position='absolute';
    toolMenu.style.left='0';
    toolMenu.style.right='0';
    toolMenu.style.top='calc(100% + 6px)';
    toolMenu.style.bottom='auto';
    toolMenu.style.width='100%';
    toolMenu.style.minWidth='0';
    toolMenu.style.zIndex='40';
    // if near viewport bottom, open upward
    const r=toolTrigger.getBoundingClientRect();
    const mh=Math.min(toolMenu.scrollHeight||280, Math.floor(window.innerHeight*0.5));
    if(r.bottom + 6 + mh > window.innerHeight - 8 && r.top > mh + 20){
      toolMenu.style.top='auto';
      toolMenu.style.bottom='calc(100% + 6px)';
    }
  }
  function paintOmToolMenu(items, local){
    if(!toolMenuList)return;
    toolMenuList.replaceChildren();
    for(const t of items){
      const btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('role','option');
      btn.dataset.value=t.name;
      btn.textContent=toolLabel(t, local);
      if(toolSel.value===t.name) btn.classList.add('is-active');
      btn.addEventListener('click',()=>{
        toolSel.value=t.name;
        if(toolTrigger) toolTrigger.textContent=toolLabel(t, local);
        closeOmToolMenu();
      });
      toolMenuList.append(btn);
    }
  }
  toolTrigger?.addEventListener('click',(e)=>{ e.stopPropagation(); if(toolMenu && !toolMenu.hidden) closeOmToolMenu(); else openOmToolMenu(); });
  document.addEventListener('click',(e)=>{ if(!e.target.closest('#om-tool-menu,#om-tool-trigger')) closeOmToolMenu(); });

  
  const projectTrigger=$('#om-project-trigger');
  const projectMenu=$('#om-project-menu');
  const projectMenuList=$('#om-project-menu-list');
  function closeOmProjectMenu(){ if(projectMenu) projectMenu.hidden=true; projectTrigger?.setAttribute('aria-expanded','false'); }
  function openOmProjectMenu(){
    if(!projectMenu||!projectTrigger)return;
    const picker=projectTrigger.closest('.om-tool-picker')||projectTrigger.parentElement;
    if(picker && projectMenu.parentElement!==picker) picker.appendChild(projectMenu);
    projectMenu.hidden=false;
    projectTrigger.setAttribute('aria-expanded','true');
    // anchor directly under the trigger box
    projectMenu.style.position='absolute';
    projectMenu.style.left='0';
    projectMenu.style.right='0';
    projectMenu.style.top='calc(100% + 6px)';
    projectMenu.style.bottom='auto';
    projectMenu.style.width='100%';
    projectMenu.style.minWidth='0';
    projectMenu.style.zIndex='40';
    // if near viewport bottom, open upward
    const r=projectTrigger.getBoundingClientRect();
    const mh=Math.min(projectMenu.scrollHeight||280, Math.floor(window.innerHeight*0.5));
    if(r.bottom + 6 + mh > window.innerHeight - 8 && r.top > mh + 20){
      projectMenu.style.top='auto';
      projectMenu.style.bottom='calc(100% + 6px)';
    }
  }
  function paintOmProjectMenu(projects){
    if(!projectMenuList)return;
    projectMenuList.replaceChildren();
    if(!projects.length){
      const empty=document.createElement('button');
      empty.type='button'; empty.disabled=true;
      empty.textContent='暂无项目，请先在 OpenMontage 里创建';
      projectMenuList.append(empty);
      if(projectTrigger) projectTrigger.textContent='暂无项目';
      return;
    }
    for(const p of projects){
      const id=p.project_id||p.id||p.projectId||'';
      const title=p.title||p.name||'';
      const label=(title && title!==id) ? (id+' · '+title) : id;
      const btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('role','option');
      btn.dataset.value=id;
      btn.textContent=label;
      if(projectSel.value===id) btn.classList.add('is-active');
      btn.addEventListener('click',()=>{
        projectSel.value=id;
        if(projectTrigger) projectTrigger.textContent=label;
        closeOmProjectMenu();
      });
      projectMenuList.append(btn);
    }
    if(projectTrigger){
      const cur=projects.find(p=>(p.project_id||p.id||p.projectId)===projectSel.value)||projects[0];
      if(cur){
        const id=cur.project_id||cur.id||cur.projectId||'';
        const title=cur.title||cur.name||'';
        projectTrigger.textContent=(title && title!==id) ? (id+' · '+title) : id;
        if(!projectSel.value) projectSel.value=id;
      }
    }
  }
  projectTrigger?.addEventListener('click',(e)=>{ e.stopPropagation(); if(projectMenu && !projectMenu.hidden) closeOmProjectMenu(); else openOmProjectMenu(); });
  document.addEventListener('click',(e)=>{ if(!e.target.closest('#om-project-menu,#om-project-trigger')) closeOmProjectMenu(); });

  function setStatus(text){if(statusEl)statusEl.textContent=text||'';}

  function fillSelect(sel, items, getValue, getLabel, emptyLabel){
    const prev=sel.value;
    sel.replaceChildren();
    if(!items.length){
      const opt=document.createElement('option');
      opt.value='';opt.textContent=emptyLabel||'（无）';
      sel.append(opt);return;
    }
    for(const item of items){
      const opt=document.createElement('option');
      opt.value=getValue(item);
      opt.textContent=getLabel(item);
      sel.append(opt);
    }
    if(prev && [...sel.options].some(o=>o.value===prev)) sel.value=prev;
  }

  async function refreshOmLists(){
    if(loading)return;
    loading=true;setStatus('正在加载…');
    try{
      const [toolsRes, projectsRes, statusRes]=await Promise.all([
        fetch('/api/om/tools',{cache:'no-store'}),
        fetch('/api/om/projects',{cache:'no-store'}),
        fetch('/api/om/status',{cache:'no-store'}),
      ]);
      const toolsJson=await toolsRes.json();
      const projectsJson=await projectsRes.json();
      const statusJson=await statusRes.json();

      const tools=Array.isArray(toolsJson.tools)?toolsJson.tools:[];
      const local=new Set(toolsJson.localStudioTools||LOCAL_FIRST);
      const sorted=[...tools].sort((a,b)=>{
        const al=local.has(a.name)?0:1, bl=local.has(b.name)?0:1;
        if(al!==bl)return al-bl;
        return String(a.name).localeCompare(String(b.name));
      });
      for(const name of [...LOCAL_FIRST].reverse()){
        if(!sorted.some(t=>t.name===name)) sorted.unshift({name, capability:'local_studio', provider:'studio_api'});
      }
      fillSelect(toolSel, sorted,
        t=>t.name,
        t=>toolLabel(t, local),
        '（暂无工具）'
      );
      paintOmToolMenu(sorted, local);
      if(toolTrigger){ const cur=sorted.find(t=>t.name===toolSel.value)||sorted[0]; toolTrigger.textContent=cur?toolLabel(cur,local):'选择工具'; }

      const projects=Array.isArray(projectsJson.projects)?projectsJson.projects:[];
      fillSelect(projectSel, projects,
        p=>p.project_id||p.id||p.projectId||'',
        p=>{
          const id=p.project_id||p.id||p.projectId||'';
          const title=p.title||p.name||'';
          return title && title!==id ? (id+' · '+title) : id;
        },
        '（暂无项目，请先在 OpenMontage 里创建）'
      );
      paintOmProjectMenu(projects);

      const live=!!statusJson.live;
      const nTools=sorted.length, nProj=projects.length;
      setStatus(live
        ? ('服务在线 · '+nTools+' 个工具 · '+nProj+' 个项目')
        : ('服务未启动，请先启动 OpenMontage 后再执行'));
    }catch(e){
      setStatus('加载失败，请点刷新重试');
    }finally{
      loading=false;
    }
  }

  async function runOmTool(){
    const tool=toolSel.value.trim();
    const projectId=projectSel.value.trim();
    if(!tool){toast('请先选择工具');return;}
    if(!projectId){toast('请先选择项目');return;}
    let args={};
    const raw=(argsEl?.value||'').trim();
    if(raw){
      try{args=JSON.parse(raw);}catch{toast('高级参数不是合法 JSON');return;}
      if(!args||typeof args!=='object'||Array.isArray(args)){toast('高级参数需要是 JSON 对象');return;}
    }
    const instr=(instruction?.value||'').trim();
    if(instr) args={...args, instruction:instr};

    runBtn.disabled=true;setStatus('执行中…');
    const draft={
      provider:'openmontage', kind:'om', tool, projectId,
      prompt:instr||(('执行 ')+(TOOL_ZH[tool]||tool)), status:'running',
      fromAgent:false, createdAt:Date.now(), count:1,
    };
    drafts.unshift(draft);
    if(typeof renderTasks==='function')renderTasks();

    try{
      const res=await fetch('/api/om/tools/execute',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId, tool, instruction:instr||undefined, args}),
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok || data.ok===false){
        draft.status='error';
        draft.error=data.error||data.detail||('HTTP '+res.status);
        setStatus('失败：'+draft.error);
        toast('执行失败');
      }else{
        draft.status='done';
        draft.result=data;
        setStatus('完成');
        toast('已执行：'+(TOOL_ZH[tool]||tool));
      }
    }catch(e){
      draft.status='error';
      draft.error=String(e?.message||e);
      setStatus('失败：'+draft.error);
      toast('执行失败');
    }finally{
      runBtn.disabled=false;
      if(typeof renderTasks==='function')renderTasks();
    }
  }

  refreshBtn?.addEventListener('click',()=>refreshOmLists());
  runBtn.addEventListener('click',()=>runOmTool());
  window.__refreshOmRunPanel=refreshOmLists;
})();



/* In-app prompt/confirm for Electron (native prompt is disabled) */
(function(){
  function ensureHost(){
    let host=document.getElementById('zora-dialog-host');
    if(host) return host;
    host=document.createElement('div');
    host.id='zora-dialog-host';
    host.innerHTML='<div class="zora-dialog-backdrop" data-zora-dlg-cancel></div><div class="zora-dialog" role="dialog" aria-modal="true"><p class="zora-dialog-title"></p><input class="zora-dialog-input" type="text" /><div class="zora-dialog-actions"><button type="button" class="zora-dialog-cancel">取消</button><button type="button" class="zora-dialog-ok primary">确定</button></div></div>';
    host.hidden=true; document.body.append(host);
    return host;
  }
  window.__zoraPrompt=function(title, initial, anchorEl){
    return new Promise((resolve)=>{
      const host=ensureHost();
      const dlg=host.querySelector('.zora-dialog');
      const input=host.querySelector('.zora-dialog-input');
      const titleEl=host.querySelector('.zora-dialog-title');
      titleEl.textContent=title||'输入';
      input.value=initial==null?'':String(initial);
      input.style.display='';
      host.hidden=false; host.classList.add('is-open');
      // anchor under button when provided
      if(anchorEl && dlg){
        host.classList.add('is-anchored');
        const r=anchorEl.getBoundingClientRect();
        dlg.style.position='fixed';
        dlg.style.left=Math.min(r.left, innerWidth-320)+'px';
        dlg.style.top=(r.bottom+8)+'px';
        dlg.style.transform='none';
        dlg.style.width=Math.max(r.width, 260)+'px';
      } else {
        host.classList.remove('is-anchored');
        if(dlg){ dlg.style.position=''; dlg.style.left=''; dlg.style.top=''; dlg.style.width=''; dlg.style.transform=''; }
      }
      const close=(val)=>{ host.classList.remove('is-open'); host.hidden=true; resolve(val); };
      const onOk=()=>close(input.value);
      const onCancel=()=>close(null);
      host.querySelector('.zora-dialog-ok').onclick=onOk;
      host.querySelector('.zora-dialog-cancel').onclick=onCancel;
      host.querySelector('[data-zora-dlg-cancel]').onclick=onCancel;
      input.onkeydown=(e)=>{ if(e.key==='Enter'){e.preventDefault();onOk();} if(e.key==='Escape'){e.preventDefault();onCancel();} };
      setTimeout(()=>{ input.focus(); input.select(); }, 0);
    });
  };
  window.__zoraConfirm=function(title){
    return new Promise((resolve)=>{
      const host=ensureHost();
      host.classList.remove('is-anchored');
      Object.assign(host.querySelector('.zora-dialog').style,{position:'',left:'',top:'',width:'',transform:''});
      const input=host.querySelector('.zora-dialog-input');
      const titleEl=host.querySelector('.zora-dialog-title');
      titleEl.textContent=title||'确认？';
      input.style.display='none';
      host.hidden=false; host.classList.add('is-open');
      const close=(val)=>{ host.classList.remove('is-open'); host.hidden=true; resolve(val); };
      host.querySelector('.zora-dialog-ok').onclick=()=>close(true);
      host.querySelector('.zora-dialog-cancel').onclick=()=>close(false);
      host.querySelector('[data-zora-dlg-cancel]').onclick=()=>close(false);
    });
  };
})();


/* Agent / Canvas work mode */
(function initWorkModeCanvas(){
  const KEY='zora.workMode.v1';
  const NODE_KEY='zora.canvasNodes.v1';
  const switchEl=$('#work-mode-switch');
  const creation=$('.creation')||$('#create')?.querySelector('.creation');
  const agentWs=$('#agent-workspace');
  const canvasWs=$('#canvas-workspace');
  const board=$('#canvas-board');
  const nodesEl=$('#canvas-nodes');
  const ctxMenu=$('#canvas-context-menu');
  const addMenu=$('#canvas-add-menu');
  const delMenu=$('#canvas-delete-menu');
  const quick=$('#canvas-quick-actions');
  const uploadInput=$('#canvas-upload-input');
  const saveStatus=$('#canvas-save-status');
  if(!switchEl||!creation||!canvasWs||!board)return;

  const NODE_LABELS={
    'novel-input':'输入小说',
    'extract-cast':'提取角色和场景',
    'char-desc':'角色描述',
    'smart-board':'智能分镜',
    'storyboard':'分镜',
    'preview-3d':'3D预览',
    'oneclick-ad':'一键出商业广告',
    'oneclick-novel':'一键拆解小说',
    'novel-drama':'小说转剧',
    'oneclick-film':'一键成片',
    'res-image':'图片',
    'res-video':'视频',
    'res-audio':'音频',
    'upload':'上传资源',
    'free':'自由节点',
    'text':'文本','storyboard-node':'故事板','video-merge':'视频合并','video-redraw':'视频转绘','stage':'站位台',
  };
  const GEN_LABELS={t2i:'文生图',t2v:'文生视频',i2i:'图生图',i2v:'图生视频'};

  let mode='agent';
  let zoom=1;
  let panX=0, panY=0;
  const restoreView=()=>{const view=readUIPrefs()['view:'+localStorage.getItem('zora.canvasCurrent.v1')]||{};zoom=Number.isFinite(view.zoom)?Math.max(.2,Math.min(3,view.zoom)):1;panX=Number.isFinite(view.x)?view.x:0;panY=Number.isFinite(view.y)?view.y:0;};restoreView();
  let tool='select'; // select | pan
  let nodes=[];
  let selected=new Set();
  let menuPos={x:0,y:0};
  let history=[];
  let future=[];
  let saveTimer=null;
  let nodeProjectId=localStorage.getItem('zora.canvasCurrent.v1');
  try{nodes=JSON.parse(localStorage.getItem(NODE_KEY)||'[]'); if(!Array.isArray(nodes)) nodes=[];}catch{nodes=[];}
  for(const n of nodes)if(n.runState==='running'){n.runState=n.genBatchId?'submitted':'failed';n.error=n.genBatchId?'':'请求因刷新中断，请重试';}

  // marquee lives on board (NOT inside nodesEl — renderNodes() replaceChildren would wipe it)
  let marquee=board.querySelector('.canvas-marquee');
  if(!marquee){
    marquee=document.createElement('div');
    marquee.className='canvas-marquee';
    board.append(marquee);
  } else if(marquee.parentElement!==board){
    board.append(marquee);
  }

  function saveNodes(){try{localStorage.setItem(NODE_KEY,JSON.stringify(nodes));}catch{toast('画布保存失败：本地空间不足，请减少上传素材');}}
  function pushHistory(){
    history.push(JSON.stringify(nodes));
    if(history.length>40) history.shift();
    future.length=0;
  }
  function showSaveStatus(text){
    if(!saveStatus)return;
    saveStatus.hidden=false;
    const t=saveStatus.querySelector('.css-text');
    if(t) t.textContent=text||'正在保存中…';
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{saveStatus.hidden=true;},1200);
  }
  function persist(show=true){
    saveNodes();
    if(show) showSaveStatus('正在保存中…');
  }

  function applyZoom(){
    saveUIPref('view:'+localStorage.getItem('zora.canvasCurrent.v1'),{zoom,x:panX,y:panY});
    const label=$('#canvas-zoom-label');
    if(nodesEl){
      nodesEl.style.transformOrigin='0 0';
      nodesEl.style.transform='translate('+panX+'px,'+panY+'px) scale('+zoom+')';
    }
    // keep quick actions centered on viewport (not panned)
    if(quick) quick.style.transform='translate(-50%,-50%)';
    if(label) label.textContent=Math.round(zoom*100)+'%';
    board.style.setProperty('--canvas-zoom', String(zoom));
    board.style.setProperty('--canvas-pan-x', panX+'px');
    board.style.setProperty('--canvas-pan-y', panY+'px');
    // move dot grid with pan
    board.style.backgroundPosition = panX+'px '+panY+'px';
  }
  function toContent(e){
    const br=board.getBoundingClientRect();
    return {x:(e.clientX-br.left-panX)/zoom, y:(e.clientY-br.top-panY)/zoom};
  }
  function setTool(next){
    tool = next==='pan' ? 'pan' : 'select';
    board.classList.toggle('tool-pan', tool==='pan');
    board.classList.toggle('tool-select', tool==='select');
    const btn=$('#canvas-tool-toggle');
    if(btn){
      btn.dataset.tool=tool;
      const lab=btn.querySelector('.tool-label');
      if(lab) lab.textContent = tool==='pan' ? '抓手' : '鼠标';
      const sel=btn.querySelector('.tool-ico-select');
      const pan=btn.querySelector('.tool-ico-pan');
      if(sel) sel.hidden = tool==='pan';
      if(pan) pan.hidden = tool!=='pan';
      btn.title = tool==='pan' ? '抓手：拖动画布（点击切换为鼠标框选）' : '鼠标：框选（点击切换为抓手）';
      btn.setAttribute('aria-pressed', tool==='pan' ? 'true' : 'false');
    }
  }

  let cancelWireDrag=null;
  const wireCurve=(a,b)=>{const d=Math.max(30,Math.min(120,Math.abs(b.x-a.x)/2));return `M ${a.x} ${a.y} C ${a.x+d} ${a.y}, ${b.x-d} ${b.y}, ${b.x} ${b.y}`;};
  function portPoint(port){const r=port.getBoundingClientRect();return toContent({clientX:r.left+r.width/2,clientY:r.top+r.height/2});}
  function drawWires(){
    const svg=nodesEl.querySelector('.canvas-wires');if(!svg)return;svg.replaceChildren();
    const port=(id,side)=>[...nodesEl.querySelectorAll('.canvas-node')].find(e=>e.dataset.id===id)?.querySelector('.port-'+side);
    for(const target of nodes)for(const id of target.inputs||[]){const a=port(id,'right'),b=port(target.id,'left');if(!a||!b)continue;const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',wireCurve(portPoint(a),portPoint(b)));svg.append(line);}
  }
  function startWireDrag(e,port,n){
    if(e.button!==0||port.disabled)return;e.preventDefault();e.stopPropagation();cancelWireDrag?.();
    const right=port.classList.contains('port-right'),origin=portPoint(port),svg=nodesEl.querySelector('.canvas-wires');
    const preview=document.createElementNS(svg.namespaceURI,'path');preview.classList.add('wire-preview');svg.append(preview);
    let target=null;const id=e.pointerId;port.setPointerCapture(id);board.classList.add('is-connecting');
    const move=ev=>{if(ev.pointerId!==id)return;ev.stopPropagation();target?.classList.remove('port-drop-target');target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.canvas-node-port');if(target?.disabled||!nodesEl.contains(target)||target===port||target.classList.contains('port-right')===right)target=null;target?.classList.add('port-drop-target');const end=target?portPoint(target):toContent(ev);preview.setAttribute('d',wireCurve(right?origin:end,right?end:origin));};
    const cleanup=()=>{target?.classList.remove('port-drop-target');preview.remove();board.classList.remove('is-connecting');window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cleanup);port.removeEventListener('lostpointercapture',cleanup);cancelWireDrag=null;if(port.hasPointerCapture(id))port.releasePointerCapture(id);};
    const up=ev=>{if(ev.pointerId!==id)return;move(ev);ev.preventDefault();const dest=target?.closest('.canvas-node')?.dataset.id;cleanup();if(!dest)return;try{pushHistory();connectNodes(nodes,right?n.id:dest,right?dest:n.id);persist();renderNodes();}catch(err){toast(err.message);}};
    const cancel=ev=>{if(ev.pointerId===id)cleanup();};const key=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();cleanup();}};
    cancelWireDrag=cleanup;window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('keydown',key,true);window.addEventListener('blur',cleanup);port.addEventListener('lostpointercapture',cleanup);move(e);
  }
  function renderNodes(){
    if(!nodesEl)return;
    cancelWireDrag?.();
    nodesEl.replaceChildren();
    const wires=document.createElementNS('http://www.w3.org/2000/svg','svg');wires.classList.add('canvas-wires');nodesEl.append(wires);
    for(const n of nodes){
      const el=document.createElement('div');
      el.className='canvas-node'+(selected.has(n.id)?' is-selected':'');
      el.style.left=(n.x||40)+'px';
      el.style.top=(n.y||40)+'px';
      el.innerHTML='<div class="canvas-node-heading"><span aria-hidden="true">☰</span><strong></strong></div><div class="canvas-node-body"><small></small></div><button type="button" class="canvas-node-port port-left" aria-label="输入连接（待接入）" title="节点连接待接入" disabled>+</button><button type="button" class="canvas-node-port port-right" aria-label="输出连接（待接入）" title="节点连接待接入" disabled>+</button>';
      el.querySelector('strong').textContent=n.label||NODE_LABELS[n.type]||n.type;
      el.querySelector('.canvas-node-heading>span').innerHTML=canvasNodeIcon(n.type);
      const note=n.note&&!/^\d{1,2}:\d{2}:\d{2}/.test(n.note)?n.note:'';
      el.querySelector('small').textContent=n.outputText||n.prompt||note||'开启你的创作…';
      el.dataset.id=n.id;
      for(const port of el.querySelectorAll('.canvas-node-port')){
        port.disabled=!nodeKind(n);port.title=port.classList.contains('port-right')?'拖动输出连接到另一节点的输入':'拖动输入连接到另一节点的输出';port.setAttribute('aria-label',port.title);
        port.addEventListener('pointerdown',e=>startWireDrag(e,port,n));port.onclick=e=>e.stopPropagation();
      }
      if(['res-image','t2i','i2i','res-video','t2v','i2v'].includes(n.type)){
        const videoNode=['res-video','t2v','i2v'].includes(n.type);
        el.classList.add('canvas-image-node');
        if(videoNode)el.classList.add('canvas-video-node');
        const body=el.querySelector('.canvas-node-body');
        body.replaceChildren();
        if(videoNode&&n.mediaData&&!n.outputUrl){const media=document.createElement(n.mediaType?.startsWith('video/')?'video':n.mediaType?.startsWith('audio/')?'audio':'img');media.src=n.mediaData;if(media.tagName!=='IMG'){media.controls=true;media.addEventListener('pointerdown',e=>{e.stopPropagation();if(!selected.has(n.id)){selected.clear();selected.add(n.id);renderNodes();}});}else media.alt='视频参考图片';body.append(media);}
        else if(n.outputUrl||n.imageData){const img=document.createElement(n.outputUrl&&videoNode?'video':'img');img.src=n.outputUrl||n.imageData;img.alt='节点素材';if(img.tagName==='VIDEO'){img.controls=true;img.onpointerdown=e=>{e.stopPropagation();if(!selected.has(n.id)){selected.clear();selected.add(n.id);renderNodes();}};}body.append(img);}
        else body.textContent='点击展开工具栏';
        if(selected.has(n.id)){
          const toolbar=document.createElement('div');toolbar.className='image-node-toolbar';
          toolbar.innerHTML='<button type="button" disabled title="资产库选择待接入">▱ 从资产库选择</button><button type="button" data-upload>↥ 上传图片</button><button type="button" data-copy>▢ 复制节点</button>';
          const panel=document.createElement('div');panel.className='image-node-editor';
          panel.innerHTML='<div class="image-node-reference"><button type="button" aria-label="上传参考图片">+</button></div><textarea placeholder="描述你想要的图片效果…" aria-label="图片节点描述"></textarea><div class="image-node-footer"><span>模型待接入</span><span>2K · 16:9</span><button type="button" disabled>生成待接入</button></div>';
          if(videoNode){
            toolbar.querySelector('[data-upload]').textContent='↥ 上传素材';
            panel.classList.add('video-node-editor');
            panel.querySelector('textarea').placeholder='根据图片生成视频（可选补充描述）…';
            panel.querySelector('textarea').setAttribute('aria-label','视频节点描述');
            panel.querySelector('.image-node-reference button').textContent='↥';
            panel.querySelector('.image-node-reference button').setAttribute('aria-label','上传视频参考素材');
            const mode=document.createElement('div');mode.className='video-node-mode';
            mode.innerHTML='<label>模式 <select data-setting="referenceMode" aria-label="视频参考模式"><option value="combined">组合参考</option><option value="first-frame">首帧参考</option></select></label><small>参考素材与参数仅保存在本地，生成待接入</small>';
            panel.insertBefore(mode,panel.querySelector('.image-node-footer'));
            panel.querySelector('.image-node-footer').innerHTML='<span>视频模型待接入</span><select data-setting="aspect" aria-label="视频比例"><option>16:9</option><option>9:16</option><option>1:1</option></select><select data-setting="resolution" aria-label="视频分辨率"><option>720P</option><option>1080P</option></select><select data-setting="duration" aria-label="视频时长"><option value="15">15s</option><option value="10">10s</option><option value="5">5s</option></select><label><input type="checkbox" data-setting="sound"> 有声</label><button type="button" disabled>生成待接入</button>';
            for(const field of panel.querySelectorAll('[data-setting]')){const key=field.dataset.setting;if(field.type==='checkbox')field.checked=n.videoSettings?.[key]??true;else if(n.videoSettings?.[key])field.value=n.videoSettings[key];field.onchange=()=>{n.videoSettings={...n.videoSettings,[key]:field.type==='checkbox'?field.checked:field.value};persist();};}
          }
          const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;
          if(videoNode)input.accept='image/*,video/*,audio/*';
          const upload=()=>input.click();
          toolbar.querySelector('[data-upload]').onclick=upload;panel.querySelector('.image-node-reference button').onclick=upload;
          input.onchange=()=>{const file=input.files[0];if(!file)return;if(!file.type.startsWith('image/')){toast('请选择图片文件');return;}if(file.size>2*1024*1024){toast('本地节点图片暂限 2 MB');return;}const reader=new FileReader();reader.onload=()=>{pushHistory();n.imageData=reader.result;n.outputUrl='';n.runState='';persist();renderNodes();};reader.readAsDataURL(file);};
          if(videoNode)input.onchange=()=>{const file=input.files[0];if(!file)return;if(!/^(image|video|audio)\//.test(file.type)){toast('请选择图片、视频或音频');return;}if(file.size>2*1024*1024){toast('本地参考素材暂限 2 MB');return;}const reader=new FileReader();reader.onload=()=>{pushHistory();n.mediaData=reader.result;n.mediaType=file.type;n.outputUrl='';n.runState='';persist();renderNodes();};reader.readAsDataURL(file);};
          toolbar.querySelector('[data-copy]').onclick=()=>addNode(n.type,{x:n.x+330,y:n.y},{label:n.label,note:n.note,prompt:n.prompt||'',imageData:n.imageData||'',mediaData:n.mediaData||'',mediaType:n.mediaType||'',videoSettings:{...n.videoSettings},params:{...n.params},modelId:n.modelId,outputText:n.outputText||'',outputUrl:n.outputUrl||''});
          const textarea=panel.querySelector('textarea');textarea.value=n.prompt||'';
          textarea.addEventListener('input',()=>{n.prompt=textarea.value;persist();});
          for(const control of [toolbar,panel]){control.addEventListener('pointerdown',e=>e.stopPropagation());control.addEventListener('dblclick',e=>e.stopPropagation());control.addEventListener('wheel',e=>e.stopPropagation());}
          el.append(toolbar,panel,input);
        }
      }
      if(selected.has(n.id)){
        const projectId=localStorage.getItem('zora.canvasCurrent.v1');
        mountNodeWorkflow(el,n,{nodes,models,persist,render:renderNodes,runMedia:submitMediaGeneration,saveResult:updated=>{
          if(localStorage.getItem('zora.canvasCurrent.v1')===projectId){const current=nodes.find(x=>x.id===updated.id);if(current){Object.assign(current,updated);persist();}return;}
          window.__canvasSaveNodeResult?.(projectId,updated);
        }});
      }
      let dragging=false, moved=false, sx=0, sy=0, ox=0, oy=0;
      el.addEventListener('pointerdown',(e)=>{
        if(e.button!==0)return;
        e.stopPropagation();
        if(!e.shiftKey && !selected.has(n.id)){
          selected.clear(); selected.add(n.id); renderNodes(); return;
        }
        if(e.shiftKey){ if(selected.has(n.id)) selected.delete(n.id); else selected.add(n.id); renderNodes(); return; }
        dragging=true; moved=false; sx=e.clientX; sy=e.clientY;
        ox=n.x||0; oy=n.y||0;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove',(e)=>{
        if(!dragging)return;
        const dx=e.clientX-sx, dy=e.clientY-sy;
        if(Math.hypot(dx,dy)>3) moved=true;
        const rect=board.getBoundingClientRect();
        const nx=Math.max(8, Math.min(rect.width/zoom-48, (ox+dx/zoom)));
        const ny=Math.max(8, Math.min(rect.height/zoom-48, (oy+dy/zoom)));
        // move all selected
        const ddx=nx-(n.x||0), ddy=ny-(n.y||0);
        for(const m of nodes){
          if(!selected.has(m.id) && m.id!==n.id) continue;
          if(m.id===n.id || selected.has(m.id)){
            if(m.id===n.id){ m.x=nx; m.y=ny; }
            else { m.x=(m.x||0)+ddx; m.y=(m.y||0)+ddy; }
          }
        }
        // simpler: only drag this node group by delta from original positions snapshot
        n.x=nx; n.y=ny;
        el.style.left=n.x+'px'; el.style.top=n.y+'px';drawWires();
      });
      el.addEventListener('pointerup',()=>{
        if(!dragging)return;
        dragging=false;
        if(moved){ pushHistory(); persist(); renderNodes(); }
        else { selected.clear(); selected.add(n.id); renderNodes(); }
      });
      nodesEl.append(el);
      const editor=el.querySelector('.image-node-editor');
      if(editor){const br=board.getBoundingClientRect(),nr=el.getBoundingClientRect();const width=Math.min(editor.offsetWidth,(br.width-20)/zoom);editor.style.width=width+'px';editor.style.maxHeight=Math.max(180,(br.height-20)/zoom)+'px';editor.style.overflowY='auto';const er=editor.getBoundingClientRect();const left=Math.max(br.left+10,Math.min(er.left,br.right-width*zoom-10));const top=Math.max(br.top+10,Math.min(er.top,br.bottom-er.height-10));editor.style.transform='none';editor.style.left=(left-nr.left)/zoom+'px';editor.style.top=(top-nr.top)/zoom+'px';}
    }
    drawWires();
    if(quick) quick.hidden=nodes.length>0;
  }

  function addNode(type, at, extra={}){
    if(nodes.length>=120){toast('每个画布最多 120 个节点，已保留现有内容');return;}
    pushHistory();
    const label=NODE_LABELS[type]||GEN_LABELS[type]||type;
    const rect=board.getBoundingClientRect();
    const x=at?.x ?? (rect.width/2/zoom-80+(Math.random()*40-20));
    const y=at?.y ?? (rect.height/2/zoom-20+(Math.random()*40-20));
    const node={id:'n'+Date.now()+Math.random().toString(16).slice(2,6), type, label, x, y, note:extra.note||new Date().toLocaleTimeString(), ...extra};
    nodes.push(node);
    selected.clear(); selected.add(node.id);
    persist(); renderNodes();
    toast('已添加：'+label);
    return node;
  }

  function hidePop(el){ if(el){ el.hidden=true; } }
  function hideAllMenus(){
    hidePop(ctxMenu); hidePop(addMenu); hidePop(delMenu);
    $('#canvas-add-node')?.setAttribute('aria-expanded','false');
    $('#canvas-clear')?.setAttribute('aria-expanded','false');
  }
  function placeMenu(el, clientX, clientY){
    if(!el)return;
    el.hidden=false;
    const pad=8;
    const mw=el.offsetWidth||240;
    const mh=el.offsetHeight||320;
    let left=clientX, top=clientY;
    if(left+mw>innerWidth-pad) left=innerWidth-mw-pad;
    if(top+mh>innerHeight-pad) top=innerHeight-mh-pad;
    if(left<pad) left=pad; if(top<pad) top=pad;
    el.style.left=left+'px'; el.style.top=top+'px';
  }
  function showCtx(clientX, clientY){
    hideAllMenus();
    const br=board.getBoundingClientRect();
    menuPos={x:(clientX-br.left-panX)/zoom, y:(clientY-br.top-panY)/zoom};
    placeMenu(ctxMenu, clientX, clientY);
  }
  function showAddMenu(anchorBtn){
    hidePop(ctxMenu); hidePop(delMenu);
    $('#canvas-clear')?.setAttribute('aria-expanded','false');
    const r=anchorBtn.getBoundingClientRect();
    placeMenu(addMenu, r.left, r.top-8);
    // open upward
    const mh=addMenu.offsetHeight||300;
    addMenu.style.top=Math.max(8, r.top-mh-10)+'px';
    addMenu.style.left=Math.max(8, r.left + r.width/2 - (addMenu.offsetWidth||220)/2)+'px';
    addMenu.hidden=false;
    anchorBtn.setAttribute('aria-expanded','true');
  }
  function showDelMenu(anchorBtn){
    hidePop(ctxMenu); hidePop(addMenu);
    $('#canvas-add-node')?.setAttribute('aria-expanded','false');
    const r=anchorBtn.getBoundingClientRect();
    placeMenu(delMenu, r.left, r.top-8);
    const mh=delMenu.offsetHeight||160;
    delMenu.style.top=Math.max(8, r.top-mh-10)+'px';
    delMenu.style.left=Math.max(8, r.left + r.width/2 - (delMenu.offsetWidth||220)/2)+'px';
    delMenu.hidden=false;
    anchorBtn.setAttribute('aria-expanded','true');
  }

  function setWorkMode(next,{persistMode=true}={}){
    mode=next==='canvas'?'canvas':'agent';
    switchEl.dataset.mode=mode;
    for(const btn of switchEl.querySelectorAll('[data-work-mode]')){
      const on=btn.dataset.workMode===mode;
      btn.setAttribute('aria-selected', on?'true':'false');
    }
    creation.classList.toggle('work-mode-canvas', mode==='canvas');
    creation.classList.toggle('work-mode-agent', mode==='agent');
    if(agentWs) agentWs.hidden=mode==='canvas';
    if(canvasWs){
      canvasWs.hidden = mode!=='canvas';
      canvasWs.style.display = mode==='canvas' ? '' : 'none';
    }
    const demo=$('.center-demo'); if(demo) demo.hidden=mode==='canvas';
    const studioEl=$('#studio');
    if(mode!=='canvas'){
      studioEl?.classList.remove('canvas-fullscreen');
      document.documentElement.classList.remove('zora-canvas-lock');
      document.body.classList.remove('zora-canvas-lock');
    }
    // prevent page scroll while on canvas
    const lock = mode==='canvas' && !$('#studio')?.hidden;
    document.documentElement.classList.toggle('zora-canvas-lock', lock);
    document.body.classList.toggle('zora-canvas-lock', lock);
    try{ window.__syncCanvasChrome?.(); }catch{}
    if(mode==='canvas'){
      const t=$('#canvas-project-time');
      if(t && !t.textContent) t.textContent=new Date().toLocaleString();
      renderNodes(); applyZoom(); hideAllMenus();
    } else {
      hideAllMenus();
    }
    if(persistMode){try{localStorage.setItem(KEY,mode);}catch{}}
  }

  for(const btn of switchEl.querySelectorAll('[data-work-mode]')){
    btn.addEventListener('click',()=>{
      const m=btn.dataset.workMode;
      setWorkMode(m);
      if(m==='canvas'){
        // 点击画布：默认确保有一个画布项目（没有则新建）
        window.__canvasEnsureProject?.({forceNew:false});
      }
    });
  }
  // canvas-rail-to-agent removed; canvas agent is independent


  // Wheel = zoom only on canvas page
  function onWheel(e){
    if(mode!=='canvas')return;
    // allow scroll inside agent rail / menus / inputs
    if(e.target.closest('.canvas-agent-rail, .canvas-agent-model-menu, .canvas-agent-skill-menu, .canvas-pop-menu, .canvas-context-menu, #om-tool-menu, #om-project-menu, textarea, input, select, .canvas-topbar'))return;
    if(!board.contains(e.target) && e.target!==board)return;
    e.preventDefault();
    const delta=e.deltaY>0?-0.08:0.08;
    zoom=Math.min(1.8, Math.max(0.4, +(zoom+delta).toFixed(2)));
    applyZoom();
  }
  // zoom only from board, not whole canvas workspace (rail needs wheel scroll)
  board.addEventListener('wheel', onWheel, {passive:false});

  // Right-click context (legacy node menu still useful)
  board.addEventListener('contextmenu',(e)=>{
    e.preventDefault();
    showCtx(e.clientX,e.clientY);
  });
  board.addEventListener('dblclick',(e)=>{
    if(e.target.closest('.canvas-node,.canvas-quick-actions,.canvas-marquee'))return;
    e.preventDefault();
    showCtx(e.clientX,e.clientY);
  });

  // Pointer tool: select (marquee) or pan (hand)
  let selecting=false, panning=false, s0={x:0,y:0}, panLast={x:0,y:0}, s0Client={x:0,y:0};
  setTool(readUIPrefs().canvasTool||'select');
  $('#canvas-tool-toggle')?.addEventListener('click',()=>{
    setTool(tool==='pan'?'select':'pan');
    saveUIPref('canvasTool',tool);
  });
  function showMarqueeBox(x0,y0,x1,y1){
    const left=Math.min(x0,x1), top=Math.min(y0,y1);
    const w=Math.abs(x1-x0), h=Math.abs(y1-y0);
    marquee.style.display='block';
    marquee.style.left=left+'px';
    marquee.style.top=top+'px';
    marquee.style.width=w+'px';
    marquee.style.height=h+'px';
  }
  function hideMarquee(){
    marquee.style.display='none';
    marquee.style.width='0px';
    marquee.style.height='0px';
  }
  board.addEventListener('pointerdown',(e)=>{
    if(e.button!==0)return;
    if(e.target.closest('.canvas-node,.canvas-quick-actions,button,a,textarea,input,select,.canvas-bottom,.canvas-topbar,.canvas-agent-rail'))return;
    hideAllMenus();
    if(tool==='pan'){
      panning=true;
      selecting=false;
      panLast={x:e.clientX,y:e.clientY};
      board.classList.add('is-panning');
      board.setPointerCapture(e.pointerId);
      return;
    }
    selecting=true;
    panning=false;
    board.classList.add('is-selecting');
    const br=board.getBoundingClientRect();
    s0Client={x:e.clientX-br.left, y:e.clientY-br.top};
    s0=toContent(e);
    showMarqueeBox(s0Client.x, s0Client.y, s0Client.x, s0Client.y);
    board.setPointerCapture(e.pointerId);
    if(!e.shiftKey){ selected.clear(); renderNodes(); }
    // re-show after renderNodes (safe even though marquee is on board)
    showMarqueeBox(s0Client.x, s0Client.y, s0Client.x, s0Client.y);
  });
  board.addEventListener('pointermove',(e)=>{
    if(panning){
      const dx=e.clientX-panLast.x, dy=e.clientY-panLast.y;
      panLast={x:e.clientX,y:e.clientY};
      panX+=dx; panY+=dy;
      applyZoom();
      return;
    }
    if(!selecting)return;
    const br=board.getBoundingClientRect();
    const x=e.clientX-br.left, y=e.clientY-br.top;
    showMarqueeBox(s0Client.x, s0Client.y, x, y);
  });
  board.addEventListener('pointerup',(e)=>{
    if(panning){
      panning=false;
      board.classList.remove('is-panning');
      return;
    }
    if(!selecting)return;
    selecting=false;
    board.classList.remove('is-selecting');
    const br=board.getBoundingClientRect();
    const x=e.clientX-br.left, y=e.clientY-br.top;
    const left=Math.min(s0Client.x,x), top=Math.min(s0Client.y,y);
    const w=Math.abs(x-s0Client.x), h=Math.abs(y-s0Client.y);
    hideMarquee();
    if(w<4 && h<4){ if(!e.shiftKey){ selected.clear(); renderNodes(); } return; }
    // content-space rect for hit test
    const c0=s0;
    const c1=toContent(e);
    const cl=Math.min(c0.x,c1.x), ct=Math.min(c0.y,c1.y);
    const cr=Math.max(c0.x,c1.x), cb=Math.max(c0.y,c1.y);
    for(const n of nodes){
      const nx=n.x||0, ny=n.y||0;
      if(nx+40>=cl && nx<=cr && ny+24>=ct && ny<=cb) selected.add(n.id);
    }
    renderNodes();
  });


  document.addEventListener('click',(e)=>{
    if(e.target.closest('#canvas-add-menu,#canvas-delete-menu,#canvas-context-menu,#canvas-add-node,#canvas-clear'))return;
    hideAllMenus();
  });
  document.addEventListener('keydown',(e)=>{
    if(mode!=='canvas')return;
    if(e.key==='Escape') hideAllMenus();
    if(e.code==='Space' && !e.repeat && !e.target.closest('input,textarea')){ e.preventDefault(); if(tool!=='pan'){ board.dataset.prevTool=tool; setTool('pan'); } }
    if((e.key==='Delete'||e.key==='Backspace') && selected.size && !e.target.closest('input,textarea')){
      e.preventDefault();
      pushHistory();
      nodes=nodes.filter(n=>!selected.has(n.id));
      selected.clear(); persist(); renderNodes(); toast('已删除选中节点');
    }
  });
  document.addEventListener('keyup',(e)=>{
    if(mode!=='canvas')return;
    if(e.code==='Space' && board.dataset.prevTool){ setTool(board.dataset.prevTool); delete board.dataset.prevTool; }
  }); // canvas-tool-space-up

  ctxMenu?.addEventListener('click',(e)=>{
    const btn=e.target.closest('[data-canvas-node]');
    if(!btn)return;
    addNode(btn.dataset.canvasNode, menuPos);
    hideAllMenus();
  });
  addMenu?.addEventListener('click',(e)=>{
    const up=e.target.closest('[data-canvas-upload]');
    if(up){ uploadInput?.click(); hideAllMenus(); return; }
    const btn=e.target.closest('[data-canvas-node]');
    if(!btn)return;
    const br=board.getBoundingClientRect();
    addNode(btn.dataset.canvasNode, {x:br.width/2/zoom-60, y:br.height/2/zoom-20});
    hideAllMenus();
  });
  delMenu?.addEventListener('click',(e)=>{
    const btn=e.target.closest('[data-canvas-delete]');
    if(!btn)return;
    const kind=btn.dataset.canvasDelete;
    if(kind==='region'){
      if(!selected.size){ toast('请先框选要删除的节点'); hideAllMenus(); return; }
      pushHistory();
      nodes=nodes.filter(n=>!selected.has(n.id));
      selected.clear(); persist(); renderNodes(); toast('已删除选中区域');
    } else if(kind==='all'){
      if(!nodes.length){ toast('画布还没有节点'); hideAllMenus(); return; }
      pushHistory(); nodes=[]; selected.clear(); persist(); renderNodes(); toast('已全部删除');
    }
    hideAllMenus();
  });

  function handleGen(kind){
    addNode(kind, {x:120+Math.random()*80, y:120+Math.random()*80});
    const ck=$('#creation-kind');
    if(ck && (kind==='t2i'||kind==='i2i')){ck.value='image';ck.dispatchEvent(new Event('change',{bubbles:true}));}
    if(ck && (kind==='t2v'||kind==='i2v')){ck.value='video';ck.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  canvasWs.addEventListener('click',(e)=>{
    const gen=e.target.closest('[data-canvas-gen]');
    if(gen){handleGen(gen.dataset.canvasGen);return;}
    const nodeBtn=e.target.closest('.canvas-rail-tiles [data-canvas-node]');
    if(nodeBtn){addNode(nodeBtn.dataset.canvasNode);return;}
  });

  $('#canvas-add-node')?.addEventListener('click',(e)=>{
    e.stopPropagation();
    const btn=$('#canvas-add-node');
    if(addMenu && !addMenu.hidden){ hideAllMenus(); return; }
    showAddMenu(btn);
  });
  $('#canvas-clear')?.addEventListener('click',(e)=>{
    e.stopPropagation();
    const btn=$('#canvas-clear');
    if(delMenu && !delMenu.hidden){ hideAllMenus(); return; }
    showDelMenu(btn);
  });
  $('#canvas-save')?.addEventListener('click',()=>{
    persist(true);
    toast('进度已保存');
  });
  const saveBtn=$('#canvas-save');
  const tip=$('#canvas-save-tip');
  saveBtn?.addEventListener('mouseenter',()=>{ if(tip) tip.hidden=false; });
  saveBtn?.addEventListener('mouseleave',()=>{ if(tip) tip.hidden=true; });
  saveBtn?.addEventListener('focus',()=>{ if(tip) tip.hidden=false; });
  saveBtn?.addEventListener('blur',()=>{ if(tip) tip.hidden=true; });

  $('#canvas-undo')?.addEventListener('click',()=>{
    if(!history.length){toast('没有可撤销的操作');return;}
    future.push(JSON.stringify(nodes));
    nodes=JSON.parse(history.pop()||'[]');
    selected.clear(); persist(false); renderNodes(); toast('已撤销');
  });
  $('#canvas-redo')?.addEventListener('click',()=>{
    if(!future.length){toast('没有可重做的操作');return;}
    history.push(JSON.stringify(nodes));
    nodes=JSON.parse(future.pop()||'[]');
    selected.clear(); persist(false); renderNodes(); toast('已重做');
  });
  $('#canvas-zoom-in')?.addEventListener('click',()=>{zoom=Math.min(1.8,+(zoom+0.1).toFixed(2));applyZoom();});
  $('#canvas-zoom-out')?.addEventListener('click',()=>{zoom=Math.max(0.4,+(zoom-0.1).toFixed(2));applyZoom();});
  $('#canvas-rename')?.addEventListener('click',(e)=>{
    e.preventDefault(); e.stopPropagation();
    if(typeof window.__canvasRenameCurrent==='function'){ window.__canvasRenameCurrent(); return; }
    // fallback inline/app prompt
    (async()=>{
      const el=$('#canvas-project-name');
      const cur=el?.textContent||'新建项目';
      const name= await (window.__zoraPrompt?window.__zoraPrompt('修改画布名称', cur, document.getElementById('canvas-rename')):null);
      if(name==null)return;
      const next=String(name).trim()||'新建项目';
      if(el) el.textContent=next;
      try{
        const STORE='zora.canvases.v1', CUR='zora.canvasCurrent.v1';
        const items=JSON.parse(localStorage.getItem(STORE)||'[]');
        const id=localStorage.getItem(CUR);
        const it=Array.isArray(items)?items.find(x=>x.id===id):null;
        if(it){ it.name=next; it.updatedAt=Date.now(); localStorage.setItem(STORE, JSON.stringify(items)); }
      }catch{}
      try{ toast?.('已改名'); }catch{}
    })();
  });
  uploadInput?.addEventListener('change',()=>{
    const files=[...(uploadInput.files||[])];
    if(!files.length)return;
    const br=board.getBoundingClientRect();
    files.forEach((f,i)=>{
      addNode('upload', {x:br.width/2/zoom-60+i*24, y:br.height/2/zoom-20+i*24}, {note:f.name});
    });
    uploadInput.value='';
  });
  // canvas agent send moved to initCanvasAgentPanel (separate session)


  // lock page scroll CSS helper
  if(!document.getElementById('zora-canvas-lock-style')){
    const st=document.createElement('style');
    st.id='zora-canvas-lock-style';
    st.textContent='html.zora-canvas-lock,body.zora-canvas-lock{overflow:hidden !important;overscroll-behavior:none;}';
    document.head.append(st);
  }

  let saved='agent';
  try{saved=localStorage.getItem(KEY)||'agent';}catch{}
  setWorkMode(saved,{persistMode:false});
  
  window.__reloadCanvasNodes=function(nextNodes){
    const nextProjectId=localStorage.getItem('zora.canvasCurrent.v1');
    if(nextProjectId!==nodeProjectId){history=[];future=[];nodeProjectId=nextProjectId;}
    nodes=Array.isArray(nextNodes)?JSON.parse(JSON.stringify(nextNodes)):[];
    restoreView();
    for(const n of nodes)if(n.runState==='running'&&!isNodeRunning(n.id)){n.runState=n.genBatchId?'submitted':'failed';n.error=n.genBatchId?'':'请求因刷新中断，请重试';}
    selected.clear();
    try{localStorage.setItem(NODE_KEY, JSON.stringify(nodes));}catch{}
    renderNodes(); applyZoom();
  };
  const _persistCanvas=persist;
  persist=function(show){ _persistCanvas(show!==false); try{window.__canvasAutosave?.();}catch{} };

  window.__canvasCurrentNodes=()=>nodes;
  window.__canvasApplyMedia=(projectId,nodeId,batchId,patch)=>{if(projectId!==nodeProjectId)return false;const n=nodes.find(n=>n.id===nodeId);if(!n||n.genBatchId!==batchId)return true;if(Object.entries(patch).every(([key,value])=>JSON.stringify(n[key])===JSON.stringify(value)))return true;Object.assign(n,patch);persist(false);renderNodes();return true;};
  window.__setWorkMode=setWorkMode;
})();


/* Multi-canvas library + fullscreen + autosave */
(function initCanvasLibrary(){
  const STORE_KEY='zora.canvases.v1';
  const CUR_KEY='zora.canvasCurrent.v1';
  const studio=$('#studio');
  const panel=$('#canvas-library-panel');
  const listEl=$('#canvas-lib-list');
  const railBtn=$('#rail-canvases');
  if(!listEl){console.warn('[canvas-library] #canvas-lib-list missing');return;}

  function loadStore(){
    try{const raw=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(raw)?raw:[];}catch{return [];}
  }
  function saveStore(items){try{localStorage.setItem(STORE_KEY,JSON.stringify(items));}catch{}}
  function uid(){return 'c'+Date.now().toString(36)+Math.random().toString(16).slice(2,6);}
  function readNodesFromLegacy(){try{const n=JSON.parse(localStorage.getItem('zora.canvasNodes.v1')||'[]');return Array.isArray(n)?n:[];}catch{return [];}}
  function writeNodesToBoard(nodes){try{localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(nodes||[]));}catch{}}

  let items=loadStore();
  let currentId=null;
  try{currentId=localStorage.getItem(CUR_KEY);}catch{}
  if(!items.length){
    const legacy=readNodesFromLegacy();
    items=[{id:uid(),name:'新建项目',nodes:legacy,updatedAt:Date.now(),createdAt:Date.now()}];
    currentId=items[0].id; saveStore(items); try{localStorage.setItem(CUR_KEY,currentId);}catch{}
  }
  if(!currentId||!items.some(x=>x.id===currentId)){currentId=items[0].id;try{localStorage.setItem(CUR_KEY,currentId);}catch{}}

  function current(){return items.find(x=>x.id===currentId)||items[0];}
  function applyMeta(){
    const c=current(); if(!c)return;
    const nameEl=$('#canvas-project-name'); const timeEl=$('#canvas-project-time');
    if(nameEl) nameEl.textContent=c.name||'新建项目';
    if(timeEl) timeEl.textContent=new Date(c.updatedAt||Date.now()).toLocaleString();
  }
  function openLib(v){
    if(v===false){ return; }
    if(typeof tab==='function') tab('canvases');
    const page=$('#canvases'); if(page) page.hidden=false;
    renderList();
  }
  function closeLib(){
    // full page: closing returns to create/agent
    if(typeof tab==='function') tab('create');
  }

  function renderList(){
    listEl.replaceChildren();
    const q=($('#canvas-lib-filter')?.value||'').trim().toLowerCase();
    let sorted=[...items].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    if(q) sorted=sorted.filter(it=>String(it.name||'').toLowerCase().includes(q));
    for(const it of sorted){
      const row=document.createElement('div');
      row.className='canvas-lib-item'+(it.id===currentId?' active':'');
      row.innerHTML='<strong></strong><small></small><div class="cli-row"><button type="button" data-act="open">打开</button><button type="button" data-act="rename">改名</button><button type="button" data-act="dup">复制</button><button type="button" data-act="del">删除</button></div>';
      row.querySelector('strong').textContent=it.name||'未命名画布';
      row.querySelector('small').textContent='更新于 '+new Date(it.updatedAt||Date.now()).toLocaleString()+' · 节点 '+(it.nodes?.length||0);
      row.addEventListener('click',(e)=>{
        const act=e.target.closest('[data-act]')?.dataset?.act;
        if(act==='rename'){renameCanvas(it.id,e.target.closest('[data-act]'));return;}
        if(act==='dup'){duplicateCanvas(it.id);return;}
        if(act==='del'){deleteCanvas(it.id);return;}
        openCanvas(it.id);
      });
      listEl.append(row);
    }
  }

  function persistCurrentNodesFromLegacy(){
    const c=current(); if(!c)return;
    c.nodes=readNodesFromLegacy();
    c.updatedAt=Date.now();
    saveStore(items); applyMeta(); renderList();
  }
  let autosaveTimer=null;
  function scheduleAutosave(){
    // Commit the project synchronously: reload/duplicate/switch may happen before the timer.
    persistCurrentNodesFromLegacy();
    clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(()=>{
      const st=$('#canvas-save-status');
      if(st){st.hidden=false;const t=st.querySelector('.css-text');if(t)t.textContent='正在保存中…';setTimeout(()=>{st.hidden=true;},900);}
    },450);
  }

  function openCanvas(id,{savePrevious=true}={}){
    if(savePrevious) persistCurrentNodesFromLegacy();
    const next=items.find(x=>x.id===id); if(!next)return;
    currentId=next.id; try{localStorage.setItem(CUR_KEY,currentId);}catch{}
    writeNodesToBoard(next.nodes||[]);
    window.__reloadCanvasNodes?.(next.nodes||[]);
    applyMeta(); renderList();
    window.__setWorkMode?.('canvas');
    studio?.classList.add('canvas-fullscreen');
    toast('已打开：'+(next.name||'画布'));
  }
  function newCanvas(){
    if(items.length>=40){toast('最多保留 40 个画布，已保留现有项目');return;}
    persistCurrentNodesFromLegacy();
    const it={id:uid(),name:'新建项目',nodes:[],updatedAt:Date.now(),createdAt:Date.now()};
    items.unshift(it); currentId=it.id; saveStore(items); try{localStorage.setItem(CUR_KEY,currentId);}catch{}
    writeNodesToBoard([]); window.__reloadCanvasNodes?.([]);
    applyMeta(); renderList(); window.__setWorkMode?.('canvas'); studio?.classList.add('canvas-fullscreen');
    toast('已新建画布');
  }
  async function renameCanvas(id,anchor=document.getElementById('canvas-rename')){
    const it=items.find(x=>x.id===id); if(!it)return;
    const name = await (window.__zoraPrompt ? window.__zoraPrompt('修改画布名称', it.name||'新建项目', anchor?.getClientRects().length?anchor:null) : Promise.resolve(null));
    if(name==null)return;
    it.name=String(name).trim()||'新建项目'; it.updatedAt=Date.now();
    saveStore(items); applyMeta(); renderList(); toast('已改名');
  }
  function duplicateCanvas(id){
    if(items.length>=40){toast('最多保留 40 个画布，已保留现有项目');return;}
    if(id===currentId) persistCurrentNodesFromLegacy();
    const it=items.find(x=>x.id===id); if(!it)return;
    items.unshift({id:uid(),name:(it.name||'画布')+' 副本',nodes:JSON.parse(JSON.stringify(it.nodes||[])),updatedAt:Date.now(),createdAt:Date.now()});
    saveStore(items); renderList(); toast('已复制画布');
  }
  async function deleteCanvas(id){
    if(items.length<=1){toast('至少保留一个画布');return;}
    const ok = await (window.__zoraConfirm ? window.__zoraConfirm('删除这个画布？') : Promise.resolve(false));
    if(!ok)return;
    items=items.filter(x=>x.id!==id);
    if(currentId===id){saveStore(items);openCanvas(items[0].id,{savePrevious:false});return;}
    saveStore(items); renderList(); toast('已删除');
  }
  function enterCanvasFullscreen(){
    if(location.hash!=='#studio'){ location.hash='studio'; }
    if(studio){ studio.hidden=false; }
    document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!=='studio');
    if(typeof tab==='function') tab('create');
    window.__setWorkMode?.('canvas');
    studio?.classList.add('canvas-fullscreen');
    applyMeta();
  }

  $('#canvas-project-new')?.addEventListener('click',()=>newCanvas());
  $('#canvas-project-del')?.addEventListener('click',()=>deleteCanvas(currentId));
  $('#canvas-lib-new')?.addEventListener('click',()=>newCanvas());
  $('#canvas-lib-filter')?.addEventListener('input',()=>renderList());
  $('#canvas-lib-close')?.addEventListener('click',()=>closeLib());
  /* canvas library is a full page now */

  /* rail canvases uses data-tab=canvases */


  function ensureCanvasProject({forceNew=false}={}){
    if(forceNew&&items.length>=40){toast('最多保留 40 个画布，已保留现有项目');return current();}
    if(forceNew || !items.length){
      if(forceNew && items.length) persistCurrentNodesFromLegacy();
      const it={id:uid(),name:'新建项目',nodes:forceNew?[]:readNodesFromLegacy(),updatedAt:Date.now(),createdAt:Date.now()};
      if(forceNew || !items.length){
        if(!items.length){ items=[it]; }
        else { items.unshift(it); }
        currentId=it.id; saveStore(items); try{localStorage.setItem(CUR_KEY,currentId);}catch{}
        writeNodesToBoard(it.nodes||[]); window.__reloadCanvasNodes?.(it.nodes||[]);
      }
    }
    if(!currentId||!items.some(x=>x.id===currentId)){currentId=items[0].id;try{localStorage.setItem(CUR_KEY,currentId);}catch{}}
    applyMeta();
    return current();
  }

  const prevSet=window.__setWorkMode;
  window.__setWorkMode=function(mode, opts){
    const prevMode=document.querySelector('.creation')?.classList.contains('work-mode-canvas')?'canvas':'agent';
    prevSet?.(mode, opts);
    const studioVisible = studio && !studio.hidden;
    if(mode==='canvas' && studioVisible){
      // 从 Agent 点到画布：若尚无项目则默认新建一个
      const createdFresh = !items.length;
      ensureCanvasProject({forceNew:false});
      if(createdFresh){ /* already created */ }
      else if(prevMode!=='canvas' && opts?.createProject){ ensureCanvasProject({forceNew:true}); }
      writeNodesToBoard(current()?.nodes||[]);
      window.__reloadCanvasNodes?.(current()?.nodes||[]);
      studio.classList.add('canvas-fullscreen');
      applyMeta(); renderList();
      if(typeof tab==='function') tab('create');
    } else {
      studio?.classList.remove('canvas-fullscreen');
      const cws=$('#canvas-workspace');
      if(cws){ cws.hidden=true; cws.style.display='none'; }
      if(mode!=='canvas'){ closeLib(); persistCurrentNodesFromLegacy(); }
    }
  };
  window.__canvasRenameCurrent=()=>{ if(window.__zoraRenaming)return; window.__zoraRenaming=true; Promise.resolve(renameCanvas(currentId)).finally(()=>{window.__zoraRenaming=false;}); };
  window.__canvasNewProject=()=>newCanvas();
  window.__canvasDeleteCurrent=()=>deleteCanvas(currentId);
  window.__canvasEnsureProject=ensureCanvasProject;
  window.__syncCanvasChrome=function(){
    const studioVisible = studio && !studio.hidden;
    const onCanvas = document.querySelector('.creation')?.classList.contains('work-mode-canvas');
    const active=!!(studioVisible && onCanvas && !$('#create')?.hidden);
    studio?.classList.toggle('canvas-fullscreen',active);
    const workspace=$('#canvas-workspace');
    if(workspace){workspace.hidden=!active;workspace.style.display=active?'':'none';}
    document.documentElement.classList.toggle('zora-canvas-lock',active);
    document.body.classList.toggle('zora-canvas-lock',active);
  };

  window.__canvasPendingMedia=()=>items.flatMap(project=>(project.id===currentId?(window.__canvasCurrentNodes?.()||project.nodes):project.nodes||[]).filter(n=>(n.runState==='submitted'||(n.runState==='running'&&!isNodeRunning(n.id)))&&(n.genBatchId||n.taskId)).map(n=>({projectId:project.id,node:n})));
  window.__canvasApplyStoredMedia=(projectId,nodeId,batchId,patch)=>{if(window.__canvasApplyMedia?.(projectId,nodeId,batchId,patch))return;const project=items.find(p=>p.id===projectId),n=project?.nodes?.find(n=>n.id===nodeId);if(!n||n.genBatchId!==batchId)return;if(Object.entries(patch).every(([key,value])=>JSON.stringify(n[key])===JSON.stringify(value)))return;Object.assign(n,patch);saveStore(items);};
  window.__canvasAutosave=scheduleAutosave;
  window.__canvasSaveNodeResult=(id,node)=>{const project=items.find(x=>x.id===id);const index=project?.nodes?.findIndex(x=>x.id===node.id);if(index>=0){project.nodes[index]=JSON.parse(JSON.stringify(node));project.updatedAt=Date.now();saveStore(items);}};
  window.__canvasOpenLibrary=()=>{openLib(true);};
  $('#canvas-save')?.addEventListener('click',()=>persistCurrentNodesFromLegacy());

  let lastSnap='';
  setInterval(()=>{
    if(!studio?.classList.contains('canvas-fullscreen'))return;
    const snap=localStorage.getItem('zora.canvasNodes.v1')||'';
    if(snap!==lastSnap){lastSnap=snap;scheduleAutosave();}
  },800);

  try {
    applyMeta(); renderList();
    if(studio && !studio.hidden && document.querySelector('.creation.work-mode-canvas')){
      studio.classList.add('canvas-fullscreen');
      window.__reloadCanvasNodes?.(current()?.nodes||[]);
    } else {
      studio?.classList.remove('canvas-fullscreen');
    }
  } catch (err) {
    console.error('[canvas-library]', err);
  }
})();

﻿/* Canvas Agent panel — separate model/skills/uploads/conversation from main Agent */
(function initCanvasAgentPanel(){
  const STORE='zora.canvasAgentSession.v1';
  const modelEl=document.querySelector('#canvas-agent-model');
  const modelTrigger=document.querySelector('#canvas-agent-model-trigger');
  const modelMenu=document.querySelector('#canvas-agent-model-menu');
  const input=document.querySelector('#canvas-agent-input');
  const sendBtn=document.querySelector('#canvas-agent-send');
  const logEl=document.querySelector('#canvas-agent-log');
  const skillBtn=document.querySelector('#canvas-agent-skill-btn');
  const skillMenu=document.querySelector('#canvas-agent-skill-menu');
  const skillSelected=document.querySelector('#canvas-agent-selected-skills');
  const uploadBtn=document.querySelector('#canvas-agent-upload-btn');
  const filesInput=document.querySelector('#canvas-agent-files');
  const refsEl=document.querySelector('#canvas-agent-refs');
  const newChatBtn=document.querySelector('#canvas-agent-new-chat');
  if(!modelEl||!input||!sendBtn||!logEl)return;

  let session={conversationId:null,modelId:'',messages:[],skills:[],updatedAt:Date.now()};
  let assets=[];
  let sending=false;

  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORE)||'null');
      if(raw&&typeof raw==='object'){
        session.conversationId=raw.conversationId||null;
        session.modelId=raw.modelId||'';
        session.messages=Array.isArray(raw.messages)?raw.messages.slice(-80).map(restorePendingMessage):[];
        session.skills=Array.isArray(raw.skills)?raw.skills:[];
      }
    }catch{}
  }
  function save(){
    try{
      localStorage.setItem(STORE,JSON.stringify({
        conversationId:session.conversationId,
        modelId:session.modelId||modelEl.value,
        messages:session.messages.slice(-80).map(serializeMessage),
        skills:session.skills,
        updatedAt:Date.now()
      }));
    }catch{}
  }
  function agentModels(){
    try{ if(typeof models!=='undefined'&&Array.isArray(models)) return models.filter(m=>m&&m.kind==='agent'); }catch{}
    return [];
  }
  function modelText(m){
    return (typeof modelLabel==='function'?modelLabel(m): (m&&m.name))|| (m&&m.id) || '模型';
  }
  function closeModelMenu(){
    if(modelMenu) modelMenu.hidden=true;
    modelTrigger&&modelTrigger.setAttribute('aria-expanded','false');
  }
  function paintModelMenu(list){
    if(!modelMenu)return;
    modelMenu.replaceChildren();
    const title=document.createElement('div');
    title.className='cpm-title'; title.textContent='选择模型';
    modelMenu.append(title);
    if(!list.length){
      const empty=document.createElement('div');
      empty.className='cpm-title'; empty.textContent='暂无 Agent 模型';
      modelMenu.append(empty); return;
    }
    for(const m of list){
      const b=document.createElement('button');
      b.type='button'; b.setAttribute('role','option');
      b.textContent=modelText(m);
      if(String(m.id)===String(modelEl.value)) b.classList.add('is-active');
      b.onclick=()=>{
        modelEl.value=m.id; session.modelId=m.id;
        if(modelTrigger) modelTrigger.textContent=modelText(m);
        save(); paintModelMenu(list); closeModelMenu();
      };
      modelMenu.append(b);
    }
  }
  function openModelMenu(){
    const list=agentModels();
    paintModelMenu(list);
    if(modelMenu){ modelMenu.hidden=false; }
    modelTrigger&&modelTrigger.setAttribute('aria-expanded','true');
  }
  function refreshModels(){
    const list=agentModels();
    const prev=session.modelId||modelEl.value;
    modelEl.replaceChildren();
    if(!list.length){
      const o=document.createElement('option');
      o.value=''; o.textContent='暂无 Agent 模型';
      modelEl.append(o);
      if(modelTrigger) modelTrigger.textContent='暂无 Agent 模型';
      paintModelMenu([]);
      return;
    }
    for(const m of list){
      const o=document.createElement('option');
      o.value=m.id;
      o.textContent=modelText(m);
      modelEl.append(o);
    }
    if(prev&&[...modelEl.options].some(o=>o.value===prev)) modelEl.value=prev;
    else { modelEl.selectedIndex=0; session.modelId=modelEl.value; }
    const cur=list.find(m=>String(m.id)===String(modelEl.value))||list[0];
    if(modelTrigger) modelTrigger.textContent=modelText(cur);
    paintModelMenu(list);
  }
  function renderSkills(){
    if(!skillSelected)return;
    skillSelected.replaceChildren();
    for(const s of session.skills){
      const tag=document.createElement('button');
      tag.type='button'; tag.className='canvas-agent-skill-tag';
      tag.textContent='◇ '+(s.name||s.id)+' ×';
      tag.onclick=()=>{ session.skills=session.skills.filter(x=>x.id!==s.id); renderSkills(); save(); };
      skillSelected.append(tag);
    }
  }
  function renderRefs(){
    if(!refsEl)return;
    refsEl.replaceChildren();
    assets.forEach((a,i)=>{
      const chip=document.createElement('button');
      chip.type='button'; chip.className='canvas-agent-ref-chip';
      chip.textContent=(a.name||'素材')+' ×';
      chip.onclick=()=>{ assets.splice(i,1); renderRefs(); };
      refsEl.append(chip);
    });
  }
  let logOpened=false;
  function renderLog(){
    const position=logEl.scrollTop;
    logEl.replaceChildren();
    if(!session.messages.length){
      const empty=document.createElement('div');
      empty.className='canvas-agent-empty';
      empty.textContent='画布会话独立于主 Agent。在此选择模型、技能、上传素材后再发送。';
      logEl.append(empty); return;
    }
    for(const m of session.messages){
      if(m.genBatchId){renderMediaTask(m,logEl);continue;}
      const row=document.createElement('article');
      row.className='canvas-agent-msg '+(m.role||'user');
      const bubble=document.createElement('div');
      bubble.className='bubble';
      bubble.textContent=m.text||m.error||(m.pending?'…':'');
      row.append(bubble);
      if(m.error) row.classList.add('error');
      logEl.append(row);
    }
    logEl.scrollTop=logOpened?position:logEl.scrollHeight;logOpened=true;
  }
  function catalogSkills(){
    try{ if(typeof skillCatalog!=='undefined'&&Array.isArray(skillCatalog)) return skillCatalog; }catch{}
    return [];
  }
  function openSkillMenu(){
    if(!skillMenu)return;
    const list=catalogSkills();
    skillMenu.replaceChildren();
    const title=document.createElement('div');
    title.className='cpm-title';
    title.textContent=list.length?'选择技能':'暂无技能，请先在技能中心添加';
    skillMenu.append(title);
    for(const s of list.slice(0,40)){
      const b=document.createElement('button');
      b.type='button'; b.textContent=s.name||s.id;
      b.onclick=()=>{
        if(!session.skills.some(x=>x.id===s.id)){
          session.skills.push({id:s.id,name:s.name,category:s.category,description:s.description,prompt:s.prompt});
        }
        renderSkills(); save(); closeSkillMenu();
      };
      skillMenu.append(b);
    }
    skillMenu.hidden=false;
    skillBtn&&skillBtn.setAttribute('aria-expanded','true');
  }
  function closeSkillMenu(){
    if(skillMenu) skillMenu.hidden=true;
    skillBtn&&skillBtn.setAttribute('aria-expanded','false');
  }
  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=reject;
      r.readAsDataURL(file);
    });
  }
  async function send(){
    const text=(input.value||'').trim();
    if(!text){ typeof toast==='function'&&toast('先写一句给画布 Agent'); return; }
    if(sending)return;
    refreshModels();
    const modelId=modelEl.value||session.modelId;
    if(!modelId){ typeof toast==='function'&&toast('请先选择 Agent 模型'); return; }
    sending=true; sendBtn.disabled=true; if(newChatBtn)newChatBtn.disabled=true;
    session.messages.push({role:'user',text,at:Date.now()});
    const pending={id:crypto.randomUUID(),role:'assistant',text:'',pending:true,references:[...assets],at:Date.now()};
    session.messages.push(pending);
    input.value=''; renderLog(); save();
    try{
      const refs=await prepareAgentReferences(assets);
      const response=await authFetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          conversationId:session.conversationId,
          modelId,
          message:text,
          skills:session.skills.map(s=>({id:s.id,name:s.name,category:s.category,description:s.description,prompt:s.prompt})),
          references:refs,
          channel:'canvas'
        })
      });
      const result=await response.json();
      if(!response.ok) throw Error(result.error||'画布 Agent 请求失败');
      session.conversationId=result.conversationId||session.conversationId;
      pending.pending=false;
      pending.text=result.reply||'(无回复)';
      pending.tasks=result.tasks;
      pending.toolTrace=result.toolTrace;
      attachGenerationReceipts(session.messages,pending,result.generationTasks,models);
    }catch(e){
      pending.pending=false;
      pending.error=e.message||'连接失败';
      pending.text='';
    }finally{
      sending=false; sendBtn.disabled=false; if(newChatBtn)newChatBtn.disabled=false; save(); renderLog();
    }
  }
  function newChat(){
    if(sending){toast('请等待当前回复完成后再新建会话');return;}
    session={conversationId:null,modelId:modelEl.value||session.modelId,messages:[],skills:[],updatedAt:Date.now()};
    assets=[]; renderSkills(); renderRefs(); renderLog(); save();
    typeof toast==='function'&&toast('已新建画布会话');
  }

  
  modelTrigger&&modelTrigger.addEventListener('click',(e)=>{ e.stopPropagation(); modelMenu&&modelMenu.hidden?openModelMenu():closeModelMenu(); });
  document.addEventListener('click',(e)=>{
    if(!e.target.closest('#canvas-agent-model-menu,#canvas-agent-model-trigger,.canvas-agent-model-pill')) closeModelMenu();
  });
  skillBtn&&skillBtn.addEventListener('click',(e)=>{ e.stopPropagation(); skillMenu&&skillMenu.hidden?openSkillMenu():closeSkillMenu(); });
  document.addEventListener('click',(e)=>{
    if(!e.target.closest('#canvas-agent-skill-menu,#canvas-agent-skill-btn')) closeSkillMenu();
  });
  uploadBtn&&uploadBtn.addEventListener('click',()=>filesInput&&filesInput.click());
  filesInput&&filesInput.addEventListener('change',()=>{
    const files=[...(filesInput.files||[])];
    for(const f of files) assets.push({file:f,name:f.name,type:f.type});
    filesInput.value=''; renderRefs();
    if(files.length&&typeof toast==='function') toast('已添加 '+files.length+' 个素材到画布 Agent');
  });
  modelEl.addEventListener('change',()=>{ session.modelId=modelEl.value; save(); });
  sendBtn.addEventListener('click',()=>send());
  input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } });
  newChatBtn&&newChatBtn.addEventListener('click',()=>newChat());
  document.querySelectorAll('[data-canvas-agent-quick]').forEach(btn=>{
    btn.addEventListener('click',()=>{ input.value=btn.getAttribute('data-canvas-agent-quick')||btn.textContent||''; input.focus(); });
  });

  
  // collapse / expand rail
  const KEY_RAIL='zora.canvasAgentRailCollapsed.v1';
  const hideBtn=document.querySelector('#canvas-agent-hide');
  const showBtn=document.querySelector('#canvas-agent-show');
  const railEl=document.querySelector('.canvas-agent-rail');
  const canvasWsEl=document.querySelector('#canvas-workspace');
  function setRailCollapsed(on){
    if(!canvasWsEl)return;
    canvasWsEl.classList.toggle('is-agent-rail-collapsed', !!on);
    if(showBtn) showBtn.hidden = !on;
    if(railEl) railEl.hidden = !!on;
    try{ localStorage.setItem(KEY_RAIL, on?'1':'0'); }catch{}
  }
  hideBtn&&hideBtn.addEventListener('click',()=>setRailCollapsed(true));
  showBtn&&showBtn.addEventListener('click',()=>setRailCollapsed(false));
  try{ setRailCollapsed(localStorage.getItem(KEY_RAIL)==='1'); }catch{ setRailCollapsed(false); }

  window.__canvasAgentMedia=()=>session.messages.filter(m=>m.genBatchId&&m.genPending);
  window.__canvasAgentMediaSaved=()=>{save();renderLog();};
  load(); refreshModels(); renderSkills(); renderRefs(); renderLog();
  const prev=window.__setWorkMode;
  if(typeof prev==='function'){
    window.__setWorkMode=function(mode,opts){
      const r=prev(mode,opts);
      if(mode==='canvas'){ try{ refreshModels(); }catch{} }
      return r;
    };
  }
  window.__refreshCanvasAgentModels=refreshModels;
  let tries=0;
  const t=setInterval(()=>{ tries++; refreshModels(); if(tries>20||agentModels().length) clearInterval(t); },500);
})();



/* studio116: canvas agent rail toggle (delegated, always on) */
(function(){
  const KEY='zora.canvasAgentRailCollapsed.v1';
  function ws(){ return document.querySelector('#canvas-workspace'); }
  function setCollapsed(on){
    const el=ws(); if(!el) return;
    el.classList.toggle('is-agent-rail-collapsed', !!on);
    const show=document.querySelector('#canvas-agent-show');
    const rail=document.querySelector('.canvas-agent-rail');
    if(show){ show.hidden = !on; show.setAttribute('aria-hidden', on?'false':'true'); }
    if(rail){ rail.hidden = !!on; }
    try{ localStorage.setItem(KEY, on?'1':'0'); }catch{}
  }
  document.addEventListener('click', (e)=>{
    const hide=e.target.closest && e.target.closest('#canvas-agent-hide');
    const show=e.target.closest && e.target.closest('#canvas-agent-show');
    if(hide){ e.preventDefault(); e.stopPropagation(); setCollapsed(true); return; }
    if(show){ e.preventDefault(); e.stopPropagation(); setCollapsed(false); return; }
  }, true);
  function boot(){
    try{ setCollapsed(localStorage.getItem(KEY)==='1'); }
    catch{ setCollapsed(false); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__setCanvasAgentRailCollapsed=setCollapsed;
})();

// Initialize authentication
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#login') {
      initLoginPage();
    }
    if (isAuthenticated()) {
      initUserMenu();
    }
  });
} else {
  if (window.location.hash === '#login') {
    initLoginPage();
  }
  if (isAuthenticated()) {
    initUserMenu();
  }
}

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#login') {
    initLoginPage();
  }
  if (isAuthenticated()) {
    initUserMenu();
  } else {
    clearUserMenu();
  }
});

ensureBackdrops();

function route(){
let raw=location.hash.slice(1);
let page=raw;
if(!page){page=isAuthed()?'studio':'welcome';if(location.hash!=='#'+page){location.replace('#'+page);return;}}
if(!['welcome','login','studio'].includes(page))page=isAuthed()?'studio':'welcome';
if(isAuthed()&&(page==='welcome'||page==='login')){location.replace('#studio');return;}
if(!isAuthed()&&page==='studio'){location.replace('#login');return;}
document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page); try{window.__syncCanvasChrome?.();}catch{} document.querySelectorAll('video.backdrop').forEach(v=>{if(v.closest('.page').hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)v.pause();else v.play().catch(()=>{});});
 try{window.__syncCanvasChrome?.();}catch{}
}

window.addEventListener('hashchange',route);
route();

$('#enter-demo').onclick=()=>{setAuthed(true);location.hash='studio';};
function tab(id){
  if(String(id||'')==='tasks'){try{window.__refreshOmRunPanel?.();}catch{}}
  if(String(id||'')==='canvases'){try{window.__canvasRefreshList?.();}catch{}}
  // studio100-tab-guard: leave create/canvas editor when switching tabs
  try{
    const studio=$('#studio');
    const create=$('#create');
    const onCreate = String(id||'')==='create' && create && !create.hidden;
    if(!onCreate){
      studio?.classList.remove('canvas-fullscreen');
      const cws=$('#canvas-workspace');
      if(cws){ cws.hidden=true; cws.style.display='none'; }
      document.documentElement.classList.remove('zora-canvas-lock');
      document.body.classList.remove('zora-canvas-lock');
    }
  }catch{}
document.querySelectorAll('.tab').forEach(el=>el.hidden=el.id!==id);document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===id));if(id==='assets'&&typeof renderAssetsGrid==='function')renderAssetsGrid();window.__syncCanvasChrome?.();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('#wallet-open').onclick=()=>$('#wallet').showModal();$('#wallet-close').onclick=()=>$('#wallet').close();
$('#reduce-motion').onchange=e=>document.documentElement.classList.toggle('reduce-motion',e.target.checked);
function modelLabel(m){if(!m||typeof m!=='object')return String(m);const role=m.textRole||(m.modes&&m.modes[0]&&m.modes[0].id)||'';if(role==='chat')return m.name+'（普通对话）';if(m.kind==='agent')return m.name+'（Agent）';return m.name;}
function options(element,values=[]){element.replaceChildren(...values.map(v=>{const o=document.createElement('option');o.value=typeof v==='object'?v.id:v;o.textContent=typeof v==='object'?modelLabel(v):(element.id==='duration'&&Number(v)===-1?'自动':String(v));return o;}));}
const OPTION_PREFS_KEY='zora.optionPrefs.v1';
function loadOptionPrefs(){try{return JSON.parse(localStorage.getItem(OPTION_PREFS_KEY)||'{}')||{};}catch{return {};}}
function saveOptionPrefsForKind(kind){kind=kind||$('#creation-kind')?.value;if(kind!=='video'&&kind!=='image')return;const p=loadOptionPrefs();p[kind]={model:$('#model')?.value||'',videoMode:$('#video-mode')?.value||'',ratio:$('#ratio')?.value||'',resolution:$('#resolution')?.value||'',duration:$('#duration')?.value||'',concurrency:$('#concurrency')?.value||'',count:$('#count')?.value||''};try{localStorage.setItem(OPTION_PREFS_KEY,JSON.stringify(p));}catch{}}
function setSelectIfPresent(id,val){const el=$(id.startsWith('#')?id:'#'+id);if(!el||val==null||val==='')return false;const want=String(val);if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===want&&!o.disabled)){el.value=want;return true;}return false;}el.value=want;return true;}
function applyOptionPrefs(kind){kind=kind||$('#creation-kind')?.value;if(kind!=='video'&&kind!=='image')return;const pref=loadOptionPrefs()[kind];if(!pref)return;setSelectIfPresent('video-mode',pref.videoMode);setSelectIfPresent('ratio',pref.ratio);setSelectIfPresent('resolution',pref.resolution);if(!$('#duration')?.disabled)setSelectIfPresent('duration',pref.duration);setSelectIfPresent('concurrency',pref.concurrency);setSelectIfPresent('count',pref.count);}
function fillVideoModes(m,preferred){const sel=$('#video-mode');if(!sel)return;const modes=Array.isArray(m?.modes)?m.modes:[];sel.replaceChildren();for(const mode of modes){const o=document.createElement('option');o.value=mode.id;o.textContent=mode.name;o.disabled=mode.enabled===false;sel.append(o);}const kind=$('#creation-kind')?.value;const want=preferred||loadOptionPrefs()[kind]?.videoMode;const pick=modes.find(x=>x.id===want&&x.enabled!==false)||modes.find(x=>x.enabled!==false);if(pick)sel.value=pick.id;sel.disabled=!modes.some(x=>x.enabled!==false);}
function modelChanged(){const m=models.find(x=>x.id===$('#model').value);if(!m)return;const kind=$('#creation-kind').value;const pref=loadOptionPrefs()[kind]||{};options($('#ratio'),m.ratios||[]);options($('#resolution'),m.resolutions||[]);const isVideo=m.kind==='video';const isImage=m.kind==='image';$('#duration-label').hidden=!isVideo;if($('#video-mode-label'))$('#video-mode-label').hidden=!(isVideo||isImage);if(isImage){fillVideoModes(m.modes?.length?m:{modes:[{id:'t2i',name:'文生图',enabled:true},{id:'i2i',name:'图生图',enabled:true}]},pref.videoMode);}else if(isVideo){fillVideoModes(m,pref.videoMode);}else if($('#video-mode')){$('#video-mode').replaceChildren();}$('#duration').disabled=false;let times=[];if(m.fixedSeconds!=null){times=[m.fixedSeconds];options($('#duration'),times);$('#duration').value=String(m.fixedSeconds);$('#duration').disabled=true;}else{const range=m.durationRange;times=m.durations?.length?m.durations:range?Array.from({length:Math.floor((range.max-range.min)/range.step)+1},(_,i)=>Number((range.min+i*range.step).toFixed(6))):m.durations||[];options($('#duration'),times);if(pref.duration!=null)setSelectIfPresent('duration',pref.duration);} $('#concurrency').max=(m.maxConcurrency||1);$('#concurrency').value=Math.min(Number($('#concurrency').value)||1,m.maxConcurrency||1);applyOptionPrefs(kind);if(typeof applyBackendLimits==='function')applyBackendLimits();if(typeof syncPickers==='function')syncPickers();}
const MODEL_PREFS_KEY='zora.modelPrefs.v1';
function loadModelPrefs(){try{return JSON.parse(localStorage.getItem(MODEL_PREFS_KEY)||'{}')||{};}catch{return {};}}
function saveModelPref(kind,id){if(!kind||!id)return;const p=loadModelPrefs();p[kind]=id;try{localStorage.setItem(MODEL_PREFS_KEY,JSON.stringify(p));}catch{}}
function applyPreferredModel(kind){const list=[...$('#model').options].map(o=>o.value);const saved=loadModelPrefs()[kind];const pref=models.find(m=>m.id===saved||m.aliases?.includes(saved))?.id||saved;if(pref&&list.includes(pref))$('#model').value=pref;}
function kindChanged(){const kind=$('#creation-kind').value;let list=models.filter(m=>m.kind===kind);if(kind==='agent'){list=[...list].sort((a,b)=>((a.textRole==='chat')-(b.textRole==='chat'))||String(a.name).localeCompare(String(b.name),'zh'));}options($('#model'),list);applyPreferredModel(kind);modelChanged();}
$('#creation-kind').onchange=()=>{const prev=$('#creation-kind').dataset.prevKind;if(prev==='video'||prev==='image')saveOptionPrefsForKind(prev);kindChanged();saveOptionPrefsForKind($('#creation-kind').value);$('#creation-kind').dataset.prevKind=$('#creation-kind').value;};
$('#model').onchange=()=>{modelChanged();saveModelPref($('#creation-kind').value,$('#model').value);saveOptionPrefsForKind();};
function wireOptionPrefSaves(){for(const id of ['video-mode','ratio','resolution','duration','concurrency','count']){const el=$('#'+id);if(!el||el.dataset.prefWired)continue;el.dataset.prefWired='1';el.addEventListener('change',()=>saveOptionPrefsForKind());}}
wireOptionPrefSaves();
$('#creation-kind').dataset.prevKind=$('#creation-kind').value;
try{const response=await authFetch('/api/models');if(!response.ok)throw Error();models=(await response.json()).models;kindChanged();}catch{toast('模型目录加载失败，请启动本地服务后重试');}
/* legacy files.onchange replaced by incremental handler below */
function renderTasks(){
  $('#task-count').textContent=drafts.reduce((n,d)=>n+(Number(d.count)||1),0);
  const list=$('#task-list');list.replaceChildren();
  if(!drafts.length){list.className='empty';list.textContent='还没有任务。用上方表单执行 OM，或在 Agent 模式下达指令。';return;}
  list.className='';
  for(const draft of drafts){
    const row=document.createElement('div');row.className='task-row';
    const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label','选择任务');
    const text=document.createElement('div');
    const title=document.createElement('strong');title.textContent=draft.prompt||'未命名任务';
    const meta=document.createElement('small');
    const isOm=draft.provider==='openmontage'||draft.kind==='om';
    if(isOm){
      const st=draft.status||'planned';
      const stLabel={planned:'已规划',running:'执行中',done:'已完成',error:'失败'}[st]||st;
      meta.textContent=`OpenMontage · ${draft.tool||'工具'} · 项目 ${draft.projectId||'—'} · ${stLabel}`;
    } else {
      meta.textContent=`${draft.count||1} 条 · ${draft.ratio||'—'} · ${draft.paused?'已暂停草稿':'媒体草稿'} · ${draft.fromAgent?'Agent':'预览'} · 未扣费`;
    }
    text.append(title,meta);
    const button=document.createElement('button');button.className='secondary';
    if(isOm){
      button.textContent='查看';
      button.onclick=()=>{tab('create');toast(draft.projectId?`OpenMontage 项目：${draft.projectId}`:'可在 Agent 对话中继续追问该任务状态');};
    } else {
      button.textContent=draft.paused?'恢复草稿':'暂停草稿';
      button.onclick=()=>{draft.paused=!draft.paused;renderTasks();};
    }
    const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='删除记录';
    remove.setAttribute('aria-label',`删除记录：${draft.prompt||'未命名任务'}`);
    remove.onclick=()=>{
      if(!window.confirm(`确认从任务清单删除这 1 条记录？\n\n${draft.prompt||'未命名任务'}\n\n仅移除清单记录，保留素材和对话，不会取消后台任务。`))return;
      const index=drafts.indexOf(draft);if(index<0)return;
      drafts.splice(index,1);renderTasks();
      if(typeof renderMessages==='function')renderMessages();
      toast('已删除任务清单记录');
    };
    const actions=document.createElement('div');actions.className='task-record-actions';actions.append(button,remove);
    row.append(check,text,actions);list.append(row);
  }
}
async function runPreviewTaskList(){
  const button=$('#preview');
  const kind=$('#creation-kind')?.value;
  const prompt=(typeof buildPackedPrompt==='function'?buildPackedPrompt():($('#prompt')?.value||'')).trim();
  if(kind==='agent'){tab('tasks');toast('Agent 可直接规划并加入任务。要手动校验参数，可切到视频/图片后再点预览');return;}
  if(!prompt){tab('tasks');toast(drafts.length?'已打开任务清单。填写创作需求后，再点预览可校验并加入草稿':'任务清单在这里。先在创作页填写需求，再点预览生成草稿');return;}
  const label=button.querySelector('.rail-text')||button;
  const prevText=label.textContent;
  button.disabled=true;if(label!==button)label.textContent='正在校验…';else button.textContent='正在校验…';
  try{
    const body={modelId:$('#model').value,prompt,count:Number($('#count').value),concurrency:Number($('#concurrency').value),ratio:$('#ratio').value,resolution:$('#resolution').value,duration:Number($('#duration').value),videoMode:$('#video-mode')?.value||undefined};
    const response=await authFetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'参数校验失败');
    drafts.push(result.draft);renderTasks();
    const message=document.createElement('div');message.className='preview-message';message.textContent=`已整理 ${result.draft.count} 条任务草稿。${result.message||''}参考文件只在本地展示，未上传或绑定云端任务。`;
    $('#preview-result')?.replaceChildren(message);
    tab('tasks');
    toast('草稿已加入任务清单');
  }catch(e){toast(e.message||'服务不可用');tab('tasks');}
  finally{button.disabled=false;if(label!==button)label.textContent='预览当前创作参数';else button.textContent='预览当前创作参数';const icon=button.querySelector('.compact-preview-icon,.rail-icon');if(icon&&!button.contains(icon))button.prepend(icon);}
}
$('#preview').onclick=()=>runPreviewTaskList();
$('#preview').title='校验当前视频/图片参数，并打开任务清单';


// Spotlight stays within the settings surface; no polling, global listener or React re-render.
const spotlight=$('.parameters');
spotlight.addEventListener('pointermove',event=>{
 if(matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion'))return;
 const bounds=spotlight.getBoundingClientRect();
 spotlight.style.setProperty('--spot-x',`${event.clientX-bounds.left}px`);
 spotlight.style.setProperty('--spot-y',`${event.clientY-bounds.top}px`);
});
spotlight.addEventListener('pointerleave',()=>{
 spotlight.style.removeProperty('--spot-x');spotlight.style.removeProperty('--spot-y');
});

$('#add-attachment').onclick=()=>$('#files').click();
const studioMenu=$('#studio-menu');
const studioToggle=$('#studio-menu-toggle');
function closeStudioMenu(){studioMenu.classList.remove('is-open');studioToggle.setAttribute('aria-expanded','false');studioToggle.setAttribute('aria-label','打开导航');}
studioToggle.onclick=()=>{const open=studioToggle.getAttribute('aria-expanded')!=='true';studioMenu.classList.toggle('is-open',open);studioToggle.setAttribute('aria-expanded',String(open));studioToggle.setAttribute('aria-label',open?'关闭导航':'打开导航');};
studioMenu.addEventListener('click',e=>{if(e.target.closest('[data-tab]'))closeStudioMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&studioToggle.getAttribute('aria-expanded')==='true'){closeStudioMenu();studioToggle.focus();}});
window.addEventListener('resize',()=>{if(innerWidth>900)closeStudioMenu();});

$('#send-prompt').onclick=()=>{const text=typeof buildInstructionText==='function'?buildInstructionText():$('#prompt').value.trim();if(!text){$('#prompt').focus();toast('请先填写创作需求或 @ 素材');return;}toast('Zora Agent 尚未接入，暂不能发送。可通过顶部预览任务清单。');};

// Shared dark option card. Native controls remain the source of values.
const optionTitles={'creation-kind':'创作类型',model:'选择模型',ratio:'画面比例','video-mode':'视频模式',duration:'视频时长',count:'生成数量',concurrency:'并发数量'};
const optionCard=document.createElement('div');optionCard.className='zora-option-card';optionCard.hidden=true;document.body.append(optionCard);
let activePicker=null;
function closePicker(restore=false){optionCard.hidden=true;if(activePicker){activePicker.button.setAttribute('aria-expanded','false');if(restore)activePicker.button.focus();}activePicker=null;}
function syncPickers(){for(const p of pickers){const value=p.control.tagName==='SELECT'?p.control.selectedOptions[0]?.textContent:p.control.value;p.label.textContent=value||'暂无模型';p.button.disabled=p.control.disabled||(p.control.tagName==='SELECT'&&!p.control.options.length);}}
function placePicker(){if(!activePicker)return;const r=activePicker.button.getBoundingClientRect();const w=Math.min(optionCard.classList.contains('format-option-card')?336:252,innerWidth-24);optionCard.style.width=w+'px';optionCard.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';optionCard.style.maxHeight=Math.min(320,innerHeight-24)+'px';const height=optionCard.offsetHeight;optionCard.style.top=Math.max(12,r.bottom+8+height>innerHeight-12?r.top-height-8:r.bottom+8)+'px';}
function showPicker(p){if(activePicker===p){closePicker(true);return;}closePicker();activePicker=p;p.button.setAttribute('aria-expanded','true');optionCard.replaceChildren();const title=document.createElement('div');title.className='option-card-title';title.textContent=optionTitles[p.control.id];const list=document.createElement('div');list.setAttribute('role','listbox');list.setAttribute('aria-label',title.textContent);list.id='zora-options';optionCard.append(title,list);
 const entries=p.control.tagName==='SELECT'?Array.from(p.control.options).map(o=>({value:o.value,label:o.textContent,disabled:o.disabled})):Array.from({length:Number(p.control.max)-Number(p.control.min)+1},(_,i)=>({value:String(i+Number(p.control.min)),label:String(i+Number(p.control.min))}));
 for(const entry of entries){const row=document.createElement('button');row.type='button';row.className='option-card-row';row.setAttribute('role','option');row.setAttribute('aria-selected',String(entry.value===p.control.value));row.disabled=!!entry.disabled;const label=document.createElement('span');label.textContent=entry.label;const check=document.createElement('span');check.className='option-check';check.setAttribute('aria-hidden','true');check.textContent=entry.value===p.control.value?'✓':'';row.append(label,check);row.onclick=()=>{p.control.value=entry.value;p.control.dispatchEvent(new Event('change',{bubbles:true}));syncPickers();closePicker(true);};list.append(row);}
 optionCard.hidden=false;placePicker();(list.querySelector('[aria-selected="true"]:not(:disabled)')||list.querySelector('button:not(:disabled)'))?.focus();
}
for(const control of document.querySelectorAll('.compact-composer select:not(#resolution),.compact-composer input[type=number]')){
 const button=document.createElement('button');button.type='button';button.className='picker-trigger';button.setAttribute('aria-label',optionTitles[control.id]);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls','zora-options');button.setAttribute('aria-expanded','false');const label=document.createElement('span');const arrow=document.createElement('span');arrow.className='picker-chevron';arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');button.append(label,arrow);control.hidden=true;control.after(button);const p={control,button,label};pickers.push(p);button.onclick=()=>showPicker(p);button.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();showPicker(p);}};control.addEventListener('change',syncPickers);new MutationObserver(syncPickers).observe(control,{childList:true,subtree:true,attributes:true});
}
syncPickers();
optionCard.addEventListener('keydown',e=>{const rows=Array.from(optionCard.querySelectorAll('button:not(:disabled)'));let index=rows.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?rows.length-1:(index+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[index]?.focus();}if(e.key==='Escape'){e.preventDefault();closePicker(true);}if(e.key==='Tab')closePicker(true);});
document.addEventListener('pointerdown',e=>{if(activePicker&&!optionCard.contains(e.target)&&!activePicker.button.contains(e.target))closePicker();});
window.addEventListener('resize',()=>closePicker());window.addEventListener('hashchange',()=>closePicker());document.addEventListener('scroll',e=>{if(!optionCard.contains(e.target))closePicker();},true);

// Unified format panel: aspect-ratio tiles and quantity segments.
const ratioPicker=pickers.find(p=>p.control.id==='ratio');
const quantityPicker=pickers.find(p=>p.control.id==='count');
quantityPicker.button.closest('label').hidden=true;
ratioPicker.button.closest('label').querySelector('.control-caption').textContent='';
const originalShowPicker=showPicker;
function segmentGroup(title,items,value,onSelect,aspect=false){const section=document.createElement('section');section.className='format-group';const heading=document.createElement('div');heading.className='option-card-title';heading.textContent=title;const grid=document.createElement('div');grid.className=aspect?'ratio-segments':'quantity-segments';for(const item of items){const b=document.createElement('button');b.type='button';b.className='format-segment';b.setAttribute('aria-pressed',String(item.value===value));b.setAttribute('aria-label',title+' '+item.label);if(aspect){const icon=document.createElement('span');icon.className='aspect-icon';const [w,h]=item.value.split(':').map(Number);icon.style.width=(16*Math.min(w/h,1))+'px';icon.style.height=(16*Math.min(h/w,1))+'px';icon.setAttribute('aria-hidden','true');b.append(icon);}const text=document.createElement('span');text.textContent=item.label;b.append(text);b.onclick=()=>onSelect(item.value);grid.append(b);}section.append(heading,grid);return section;}
function updateFormatLabel(){ratioPicker.label.textContent=`${$('#ratio').value} · ${$('#resolution').value} · ${$('#count').value} 条`;}
const originalSyncPickers=syncPickers;
syncPickers=function(){originalSyncPickers();updateFormatLabel();};
showPicker=function(p){if(!['ratio','duration'].includes(p.control.id))return originalShowPicker(p);if(activePicker===p){closePicker(true);return;}closePicker();activePicker=p;p.button.setAttribute('aria-expanded','true');optionCard.replaceChildren();optionCard.classList.add('format-option-card');optionCard.setAttribute('role','group');optionCard.setAttribute('aria-label',p.control.id==='ratio'?'画面规格':'视频时长');
 const change=(control,value)=>{control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));syncPickers();};
 if(p.control.id==='ratio'){
 const ratios=Array.from($('#ratio').options).map(o=>({value:o.value,label:o.textContent}));
 optionCard.append(segmentGroup('选择比例',ratios,$('#ratio').value,v=>{change($('#ratio'),v);redraw();},true));
 optionCard.append(segmentGroup('选择分辨率',Array.from($('#resolution').options).map(o=>({value:o.value,label:o.textContent})),$('#resolution').value,v=>{change($('#resolution'),v);redraw();})); const max=Number($('#count').max);const quantities=Array.from({length:Math.min(4,max)},(_,i)=>({value:String(i+1),label:String(i+1)}));
 optionCard.append(segmentGroup('选择生成数量',quantities,$('#count').value,v=>{change($('#count'),v);redraw();}));
 const extra=document.createElement('label');extra.className='custom-quantity';extra.textContent='自定义数量';const input=document.createElement('input');input.type='number';input.min=$('#count').min;input.max=$('#count').max;input.value=$('#count').value;input.setAttribute('aria-label','自定义生成数量');input.onchange=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>max){input.value=$('#count').value;return;}change($('#count'),String(n));redraw();};extra.append(input);optionCard.append(extra);
 }else{optionCard.append(segmentGroup('选择时长',Array.from(p.control.options).map(o=>({value:o.value,label:o.value+' 秒'})),p.control.value,v=>{change(p.control,v);redraw();}));}
 function redraw(){activePicker=null;showPicker(p);}
 optionCard.hidden=false;placePicker();optionCard.querySelector('button[aria-pressed=true]')?.focus();
};
const originalClosePicker=closePicker;
closePicker=function(restore=false){originalClosePicker(restore);optionCard.classList.remove('format-option-card');optionCard.removeAttribute('role');optionCard.removeAttribute('aria-label');};
updateFormatLabel();

// Duration uses a discrete slider over the selected model's supported values.
const segmentedShowPicker=showPicker;
showPicker=function(p){
 if(p.control.id!=='duration'||[...p.control.options].some(o=>o.value==='-1'))return segmentedShowPicker(p);
 if(activePicker===p){closePicker(true);return;}closePicker();activePicker=p;p.button.setAttribute('aria-expanded','true');optionCard.replaceChildren();optionCard.classList.add('format-option-card');
 const values=Array.from(p.control.options).map(o=>Number(o.value)).filter(Number.isFinite);if(!values.length){closePicker();return;}
 const title=document.createElement('div');title.className='option-card-title';title.textContent='选择视频生成时长';
 const row=document.createElement('div');row.className='duration-row';const track=document.createElement('div');track.className='duration-track';const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=values.length-1;slider.step=1;slider.value=Math.max(0,values.indexOf(Number(p.control.value)));slider.disabled=values.length===1;slider.setAttribute('aria-label','视频生成时长');
 function durationTickIndexes(values){const n=values.length;if(n<=6)return values.map((_,i)=>i);const picks=new Set([0,n-1]);const span=values[n-1]-values[0];for(let i=1;i<n-1;i++){const v=values[i];if(i<2||i>n-3)continue;if(span>=20&&Number.isInteger(v)&&v%5===0)picks.add(i);else if(span>=12&&span<20&&Number.isInteger(v)&&v%2===0)picks.add(i);}if(picks.size<4){const step=Math.max(1,Math.floor((n-1)/5));for(let i=0;i<n;i+=step)picks.add(i);picks.add(n-1);}return [...picks].sort((a,b)=>a-b);}
 const ticks=document.createElement('div');ticks.className='duration-ticks';const tickIdx=durationTickIndexes(values);const last=Math.max(1,values.length-1);for(const i of tickIdx){const t=document.createElement('span');t.textContent=String(values[i]);t.style.left=((i/last)*100)+'%';if(i===0)t.classList.add('is-start');else if(i===values.length-1)t.classList.add('is-end');ticks.append(t);}
 const box=document.createElement('label');box.className='duration-value';const input=document.createElement('input');input.type='number';input.min=Math.min(...values);input.max=Math.max(...values);input.value=p.control.value;input.setAttribute('aria-label','时长秒数');const unit=document.createElement('span');unit.textContent='s';box.append(input,unit);
 const note=document.createElement('p');note.className='duration-note';note.textContent='可选时长由当前模型决定';
 function commit(v){p.control.value=String(v);p.control.dispatchEvent(new Event('change',{bubbles:true}));slider.value=values.indexOf(v);slider.setAttribute('aria-valuetext',v+' 秒');input.value=v;syncPickers();}
 slider.oninput=()=>commit(values[Number(slider.value)]);input.onchange=()=>{const v=Number(input.value);if(values.includes(v)){input.setCustomValidity('');commit(v);}else{input.value=p.control.value;note.textContent='当前模型支持 '+values.join('、')+' 秒';}};
 commit(Number(p.control.value));track.append(slider,ticks);row.append(track,box);optionCard.append(title,row,note);optionCard.hidden=false;placePicker();slider.focus();
};
const durationPicker=pickers.find(p=>p.control.id==='duration');
durationPicker.button.closest('label').querySelector('.control-caption').hidden=true;
durationPicker.button.closest('label').querySelector('.unit').hidden=true;
const syncWithDuration=syncPickers;
syncPickers=function(){syncWithDuration();durationPicker.label.textContent=$('#duration').value==='-1'?'自动':$('#duration').value+'s';const kind=$('#creation-kind').value;$('#video-mode-label').hidden=!(kind==='video'||kind==='image');};
$('#creation-kind').addEventListener('change',syncPickers);
for(const p of pickers){p.button.querySelector('.picker-chevron').textContent='';}
syncPickers();

// Reference stack and @-mentions. Files stay local in this skeleton.
const attachmentButton=$('#add-attachment');attachmentButton.removeAttribute('title');

const stack=document.createElement('div');stack.className='reference-stack';attachmentButton.append(stack);
const mentions=document.createElement('div');mentions.className='zora-option-card mention-card';mentions.hidden=true;mentions.setAttribute('role','listbox');mentions.setAttribute('aria-label','选择参考素材');document.body.append(mentions);
let mentionStart=-1;

function formatBytes(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(n<10240?1:0)+' KB';return (n/1048576).toFixed(n<10485760?1:0)+' MB';}
function assetKind(a){return a.file.type.startsWith('video/')?'视频':(a.file.type.startsWith('image/')?'图片':'文件');}
function assetDetailLine(a){const type=a.file.type&&a.file.type!=='application/octet-stream'?a.file.type.split('/').pop().toUpperCase():assetKind(a);return formatBytes(a.file.size)+' · '+assetKind(a)+' · '+type;}

function addGeneratedAsset(item){
  const entry={
    id:item.id||('gen-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)),
    source:'generated',
    name:(item.name||'生成素材').slice(0,80),
    url:item.url||'',
    kind:item.kind||'image',
    file:item.file||null,
    createdAt:item.createdAt||Date.now(),
    meta:item.meta||'生成结果 · 待接入'
  };
  if(!durableMediaUrl(entry.url)){renderAssetsGrid();return entry;}
  const existing=generatedAssets.find(a=>a.url===entry.url);if(existing)return existing;
  generatedAssets.unshift(entry);
  pruneGeneratedAssets();
  saveGeneratedAssets();
  renderAssetsGrid();
  return entry;
}

const automaticDownloads=new Set();try{for(const id of JSON.parse(localStorage.getItem('zora.autoDownloaded.v1')||'[]'))automaticDownloads.add(id);}catch{}
const autoDownloadSwitch=document.getElementById('auto-download');
if(autoDownloadSwitch){autoDownloadSwitch.checked=localStorage.getItem('zora.autoDownload.v1')==='1';autoDownloadSwitch.onchange=()=>localStorage.setItem('zora.autoDownload.v1',autoDownloadSwitch.checked?'1':'0');}
async function autoDownloadGenerated(message){
  if(!message.genUrl||localStorage.getItem('zora.autoDownload.v1')!=='1')return;
  const bytes=new TextEncoder().encode(message.genUrl);const digest=await crypto.subtle.digest('SHA-256',bytes);const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(automaticDownloads.has(key))return;
  automaticDownloads.add(key);
  try{await downloadGenerated(message.genUrl,message.kind,true);localStorage.setItem('zora.autoDownloaded.v1',JSON.stringify([...automaticDownloads].slice(-2000)));}catch{automaticDownloads.delete(key);toast('自动下载失败，请使用素材的下载按钮重试');}
}
async function downloadGenerated(url,kind='image',automatic=false){
  if(!url){toast('还没有可下载的结果');return;}
  const name=`zora-${automatic?'auto-':''}${Date.now()}-${crypto.randomUUID()}.${kind==='video'?'mp4':'png'}`;
  try{
    if(window.zoraDesktop?.downloadMedia){toast('正在下载…');const result=await window.zoraDesktop.downloadMedia(url,name);toast('已保存到下载目录 Zora 文件夹');return result;}
    const res=await fetch(url);if(!res.ok)throw Error('下载请求失败');const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);toast('已开始下载');
  }catch(e){toast(e.message||'下载失败，请重试；桌面客户端需重新打开以加载下载功能');if(automatic)throw e;}
}

async function useGeneratedAsReference(url,kind='image'){
  if(!url){toast('还没有可引用的结果');return null;}
  if(assets.length>=50){toast('最多添加 50 个参考素材');return null;}
  const existing=assets.find(a=>a.url===url);
  if(existing){
    existing.promptRef=true;drawStack();renderAssetChips();renderAssetsGrid();
    const card=$('#prompt-card')||$('.prompt-card.compact-composer');card?.classList.remove('composer-collapsed');$('#create')?.classList.add('composer-open');
    if(typeof syncComposerChrome==='function')syncComposerChrome();
    toast('素材已添加，输入 @'+existing.reference+' 引用');return existing;
  }
  let file=null;let localUrl=url;
  try{const res=await fetch(url);if(res.ok){const blob=await res.blob();const ext=kind==='video'?'mp4':((blob.type||'').includes('jpeg')||(blob.type||'').includes('jpg')?'jpg':'png');file=new File([blob],`generated-${Date.now()}.${ext}`,{type:blob.type||(kind==='video'?'video/mp4':'image/png')});localUrl=URL.createObjectURL(file);}}catch{}
  if(!file)file={name:`generated-${Date.now()}.${kind==='video'?'mp4':'png'}`,type:kind==='video'?'video/mp4':'image/png',size:0,lastModified:Date.now()};
  const typeLabel=kind==='video'?'视频':'图片';
  const number=assets.filter(a=>a.file&&a.file.type&&a.file.type.startsWith(typeLabel==='图片'?'image/':'video/')).length+1;
  const entry={file,url:localUrl,reference:typeLabel+number,source:'generated',promptRef:true};
  assets.push(entry);drawStack();renderAssetChips();renderAssetsGrid();
  const card=$('#prompt-card')||$('.prompt-card.compact-composer');card?.classList.remove('composer-collapsed');$('#create')?.classList.add('composer-open');
  if(typeof syncComposerChrome==='function')syncComposerChrome();
  toast('素材已添加，输入 @'+entry.reference+' 引用');return entry;
}
function wireComposerDrop(){
  const targets=[...new Set([$('#prompt-card'),$('.prompt-card.compact-composer'),$('#prompt'),document.querySelector('.composer-input-row'),document.querySelector('.prompt-line')].filter(Boolean))];
  const onDragOver=e=>{const types=Array.from(e.dataTransfer?.types||[]);if(types.includes('application/x-zora-gen')||types.includes('Files')||types.includes('text/uri-list')||types.includes('text/plain')){e.preventDefault();e.dataTransfer.dropEffect='copy';e.currentTarget.classList.add('drop-target');}};
  const onDragLeave=e=>e.currentTarget.classList.remove('drop-target');
  const onDrop=async e=>{
    e.preventDefault();e.stopPropagation();for(const target of targets)target.classList.remove('drop-target');
    const raw=e.dataTransfer.getData('application/x-zora-gen');
    if(raw){try{const data=JSON.parse(raw);await useGeneratedAsReference(data.url,data.kind||'image');return;}catch{}}
    const uri=(e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain')||'').trim().split('\n')[0].trim();
    if(uri&&/^https?:\/\//i.test(uri)){await useGeneratedAsReference(uri,/\.(mp4|webm|mov)(\?|$)/i.test(uri)?'video':'image');return;}
    const files=Array.from(e.dataTransfer.files||[]).filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
    if(!files.length)return;
    for(const file of files){if(assets.some(a=>a.file.name===file.name&&a.file.size===file.size&&a.file.lastModified===file.lastModified))continue;if(assets.length>=50){toast('最多添加 50 个参考素材');break;}const type=file.type.startsWith('image/')?'图片':'视频';const number=assets.filter(a=>a.file.type.startsWith(type==='图片'?'image/':'video/')).length+1;assets.push({file,url:URL.createObjectURL(file),reference:type+number,source:'upload',promptRef:true});}
    drawStack();renderAssetChips();renderAssetsGrid();const card=$('#prompt-card')||$('.prompt-card.compact-composer');card?.classList.remove('composer-collapsed');$('#create')?.classList.add('composer-open');if(typeof syncComposerChrome==='function')syncComposerChrome();toast('已加入参考素材');
  };
  for(const t of targets){t.addEventListener('dragover',onDragOver);t.addEventListener('dragleave',onDragLeave);t.addEventListener('drop',onDrop);}
}


function renderAssetsGrid(){const grid=$('#asset-grid');if(!grid)return;grid.replaceChildren();
const items=assetFilter==='generated'?[...new Map(generatedAssets.map(a=>[a.url,a])).values()]:assets.filter(a=>(a.source||'upload')==='upload');
let total=document.getElementById('asset-library-count');if(!total){total=document.createElement('p');total.id='asset-library-count';total.className='muted';grid.before(total);}total.textContent=assetFilter==='generated'?'共 '+items.length+' 个生成结果（相同链接合并展示）':'共 '+items.length+' 个上传素材';
if(!items.length){grid.className='asset-grid asset-grid-empty';grid.textContent=assetFilter==='generated'?'还没有生成素材。完成一次创作后，结果会出现在这里（保留 7 天）。':'还没有本地上传素材。在创作页点左侧 + 添加图片或视频。';return;}
grid.className='asset-grid';
for(const a of items){
  const figure=document.createElement('figure');figure.className='asset';figure.dataset.source=a.source||assetFilter;figure.setAttribute('role','listitem');
  const badge=document.createElement('span');badge.className='asset-badge';badge.textContent=(a.source||assetFilter)==='generated'?'生成':'本地';
  let media;
  if(a.file&&a.file.type&&a.file.type.startsWith('video/')||a.kind==='video'){
    media=document.createElement('video');media.src=a.url;media.controls=true;media.preload='none';
  }else{
    media=document.createElement('img');media.src=a.url;media.alt=a.name||(a.file&&a.file.name)||(a.reference?('@'+a.reference):'素材');
  }
  const caption=document.createElement('figcaption');
  if((a.source||assetFilter)==='generated'){
    const strong=document.createElement('strong');strong.textContent=a.name||'生成素材';
    const small=document.createElement('small');small.textContent=a.meta||'生成结果';
    caption.append(strong,small);
  }else{
    const strong=document.createElement('strong');strong.textContent=a.reference?('@'+a.reference):'本地素材';
    const small=document.createElement('small');small.textContent='本地上传';
    caption.append(strong,small);
  }
  figure.append(badge,media,caption);grid.append(figure);
}
}

function buildInstructionText(){return ($('#prompt')?.value||'').trim();}
function mentionedAssets(){const tokens=new Set(($('#prompt')?.value||'').match(/@(?:图片|视频|音频)\d+/g)||[]);return assets.filter(a=>tokens.has('@'+a.reference));}
function buildPackedPrompt(){const instruction=typeof buildInstructionText==='function'?buildInstructionText():(($('#prompt')&&$('#prompt').value)||'').trim();const skillParts=(typeof selectedSkills!=='undefined'?selectedSkills:[]).map(s=>'【技能：'+s.name+'】'+s.prompt);return [...skillParts,instruction].filter(Boolean).join('\n').trim();}
function resizePrompt(){const ta=$('#prompt');if(!ta)return;const top=ta.scrollTop;ta.style.height='auto';const height=Math.max(40,Math.min(160,ta.scrollHeight));ta.style.height=height+'px';const overflow=ta.scrollHeight>ta.clientHeight+1;ta.style.overflowY=overflow?'auto':'hidden';ta.scrollTop=overflow?top:0;}
function renderAssetChips(){const list=$('#file-list');if(list)list.replaceChildren();const selected=new Set(mentionedAssets());for(const a of assets)a.promptRef=selected.has(a);resizePrompt();if(typeof syncSendVisibility==='function')syncSendVisibility();}
function removeAsset(a){const idx=assets.indexOf(a);if(idx<0)return;try{URL.revokeObjectURL(a.url);}catch{}assets.splice(idx,1);const input=$('#prompt');if(input){const token='@'+a.reference;input.value=input.value.split(token).join('').replace(/\s{2,}/g,' ').trimStart();input.dispatchEvent(new Event('input',{bubbles:true}));}drawStack();renderAssetChips();renderAssetsGrid();if(typeof syncComposerChrome==='function')syncComposerChrome();toast('已移除 @'+a.reference);}
function ensureReferenceTray(){let tray=document.querySelector('.reference-tray');if(tray)return tray;tray=document.createElement('div');tray.className='reference-tray';tray.setAttribute('role','list');tray.setAttribute('aria-label','已选素材');const row=document.querySelector('.composer-input-row');(row||attachmentButton.parentElement).append(tray);let hideTimer=null;const open=()=>{clearTimeout(hideTimer);if(assets.length)tray.classList.add('open');};const scheduleClose=()=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>tray.classList.remove('open'),180);};attachmentButton.addEventListener('mouseenter',open);attachmentButton.addEventListener('focusin',open);attachmentButton.addEventListener('mouseleave',scheduleClose);attachmentButton.addEventListener('focusout',scheduleClose);tray.addEventListener('mouseenter',open);tray.addEventListener('mouseleave',scheduleClose);return tray;}
function drawStack(){const tray=ensureReferenceTray();stack.replaceChildren();tray.replaceChildren();const preview=assets.slice(-3);const layers=preview;layers.forEach((a,i)=>{const thumb=document.createElement(a.file.type.startsWith('image/')?'img':'video');thumb.src=a.url;thumb.style.setProperty('--stack-i',String(i));if(preview.length===1&&i<layers.length-1)thumb.style.opacity=String(0.45+i*0.2);thumb.setAttribute('aria-hidden','true');if(thumb.tagName==='VIDEO'){thumb.muted=true;thumb.preload='metadata';}stack.append(thumb);});assets.forEach((a,i)=>{const item=document.createElement('div');item.className='reference-item';item.setAttribute('role','listitem');item.title='点击引用 @'+a.reference;item.tabIndex=0;item.setAttribute('aria-label','引用 @'+a.reference);const insertReference=()=>{const input=$('#prompt');if(!input)return;const start=input.selectionStart??input.value.length;input.setRangeText('@'+a.reference+' ',start,input.selectionEnd??start,'end');input.dispatchEvent(new Event('input',{bubbles:true}));hideMentions();input.focus({preventScroll:true});};item.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))e.preventDefault();});item.addEventListener('click',e=>{if(!e.target.closest('button'))insertReference();});item.addEventListener('keydown',e=>{if(e.target===item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();insertReference();}});const thumb=document.createElement(a.file.type.startsWith('image/')?'img':'video');thumb.src=a.url;if(thumb.tagName==='VIDEO'){thumb.muted=true;thumb.preload='metadata';}const del=document.createElement('button');del.type='button';del.className='reference-item-remove';del.setAttribute('aria-label','删除素材 @'+a.reference);del.textContent='×';del.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();removeAsset(a);});item.append(thumb,del);tray.append(item);});if(!assets.length)tray.classList.remove('open');attachmentButton.classList.toggle('has-references',assets.length>0);attachmentButton.setAttribute('aria-label',assets.length?`已添加 ${assets.length} 个素材，悬停展开管理，点击继续上传`:'上传参考内容');renderAssetChips();}
// Add files incrementally instead of replacing earlier references.
$('#files').onchange=e=>{const incoming=Array.from(e.target.files).filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));for(const file of incoming){if(assets.length>=50){toast('最多添加 50 个参考素材');break;}if(assets.some(a=>a.file.name===file.name&&a.file.size===file.size&&a.file.lastModified===file.lastModified))continue;const type=file.type.startsWith('image/')?'图片':'视频';const number=assets.filter(a=>a.file.type.startsWith(type==='图片'?'image/':'video/')).length+1;assets.push({file,url:URL.createObjectURL(file),reference:type+number,source:'upload'});}e.target.value='';drawStack();renderAssetChips();renderAssetsGrid();if(typeof syncComposerChrome==='function')syncComposerChrome();};
wireComposerDrop();
function hideMentions(){mentions.hidden=true;$('#prompt').setAttribute('aria-expanded','false');}
function showMentions(){const input=$('#prompt');const before=input.value.slice(0,input.selectionStart);const match=before.match(/@([^@\s]*)$/);if(!match){hideMentions();return;}mentionStart=input.selectionStart-match[0].length;mentions.replaceChildren();const q=match[1]||'';const skillMatches=skillCatalog.filter(s=>!q||s.name.includes(q)||s.category.includes(q)||('技能'+s.name).includes(q));const assetMatches=assets.filter(a=>!q||a.reference.includes(q)||a.file.name.includes(q));const skillTitle=document.createElement('div');skillTitle.className='mention-section-title';skillTitle.textContent='@ 技能';mentions.append(skillTitle);if(!skillMatches.length){const empty=document.createElement('p');empty.className='mention-empty';empty.textContent='没有匹配技能';mentions.append(empty);}for(const s of skillMatches.slice(0,8)){const row=document.createElement('button');row.type='button';row.className='option-card-row';row.setAttribute('role','option');const text=document.createElement('span');text.textContent=`@${s.name} · ${s.category}`;row.append(text);row.onpointerdown=e=>e.preventDefault();row.onclick=()=>{input.setRangeText('',mentionStart,input.selectionStart,'end');hideMentions();useSkill(s);};mentions.append(row);}const assetTitle=document.createElement('div');assetTitle.className='mention-section-title';assetTitle.textContent='@ 参考素材';mentions.append(assetTitle);if(!assetMatches.length){const empty=document.createElement('p');empty.className='mention-empty';empty.textContent=assets.length?'没有匹配素材':'请先点击左侧添加参考素材';mentions.append(empty);}for(const a of assetMatches){const row=document.createElement('button');row.type='button';row.className='option-card-row';row.setAttribute('role','option');const thumb=document.createElement(a.file.type.startsWith('image/')?'img':'video');thumb.src=a.url;thumb.className='mention-thumb';if(thumb.tagName==='IMG')thumb.alt='';else{thumb.muted=true;thumb.preload='metadata';}const text=document.createElement('span');text.textContent='@'+a.reference;row.append(thumb,text);row.title='@'+a.reference;row.onpointerdown=e=>e.preventDefault();row.onclick=()=>{input.setRangeText('@'+a.reference+' ',mentionStart,input.selectionStart,'end');hideMentions();a.promptRef=true;renderAssetChips();drawStack();renderAssetsGrid();if(typeof syncComposerChrome==='function'){const card=$('#prompt-card')||$('.prompt-card.compact-composer');card?.classList.remove('composer-collapsed');$('#create')?.classList.add('composer-open');syncComposerChrome();}input.focus();toast('已加入 @'+a.reference+'，接着写要对它做什么');};mentions.append(row);}const rect=input.getBoundingClientRect();mentions.style.width=Math.min(360,innerWidth-24)+'px';mentions.style.left=Math.max(12,Math.min(rect.left,innerWidth-372))+'px';mentions.hidden=false;mentions.style.top=Math.max(12,rect.top-mentions.offsetHeight-8)+'px';input.setAttribute('aria-expanded','true');}
$('#prompt').addEventListener('input',()=>{resizePrompt();const selected=new Set(mentionedAssets());for(const a of assets)a.promptRef=selected.has(a);showMentions();});
$('#prompt').addEventListener('wheel',e=>{e.stopPropagation();const ta=e.currentTarget;if(ta.scrollHeight<=ta.clientHeight+1){e.preventDefault();ta.scrollTop=0;}},{passive:false});$('#prompt').addEventListener('keydown',e=>{if(mentions.hidden)return;if(e.key==='Escape'){hideMentions();e.preventDefault();}if(e.key==='ArrowDown'){mentions.querySelector('button')?.focus();e.preventDefault();}});
mentions.addEventListener('keydown',e=>{const rows=[...mentions.querySelectorAll('button')];const index=rows.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){rows[(index+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length]?.focus();e.preventDefault();}if(e.key==='Escape'){hideMentions();$('#prompt').focus();}});
document.addEventListener('pointerdown',e=>{if(!mentions.contains(e.target)&&e.target!==$('#prompt'))hideMentions();});window.addEventListener('resize',hideMentions);window.addEventListener('hashchange',hideMentions);
const concurrencyPicker=pickers.find(p=>p.control.id==='concurrency');
const syncWithConcurrency=syncPickers;
syncPickers=function(){syncWithConcurrency();concurrencyPicker.button.title=`后台最大并发 ${$('#concurrency').max}，可在范围内修改`;};syncPickers();
const pickerBeforeLimits=showPicker;
showPicker=function(p){if(p.control.id==='concurrency'){pickerBeforeLimits(p);if(!optionCard.hidden){const title=optionCard.querySelector('.option-card-title');title.textContent=`并发数量 · 最大 ${p.control.max}`;const max=document.createElement('button');max.type='button';max.className='option-card-row';max.textContent='使用最大并发 '+p.control.max;max.onclick=()=>{p.control.value=p.control.max;p.control.dispatchEvent(new Event('change',{bubbles:true}));syncPickers();closePicker(true);};optionCard.append(max);}return;}return pickerBeforeLimits(p);};

// Application-wide navigation surfaces, with a collapsible rail.
$('#rail-toggle').onclick=()=>{const collapsed=$('#studio').classList.toggle('rail-collapsed');$('#rail-toggle').setAttribute('aria-expanded',String(!collapsed));$('#rail-toggle').setAttribute('aria-label',collapsed?'展开侧栏':'收起侧栏');};
$('#wallet-open').onclick=()=>tab('account');
const previousTab=tab;
tab=function(id){closePicker();hideMentions();previousTab(id);$('#studio .workspace').scrollTop=0;};
/* preview opens tasks inside runPreviewTaskList */

let skillCatalog=[
{id:'long-take',name:'电影级长镜头',category:'视频',description:'规划连续镜头中的人物调度、摄影机路径与动作衔接。',prompt:'请以电影级长镜头方式规划镜头，明确摄影机运动、主体动作及衔接。'},
{id:'storyboard',name:'创作分镜',category:'策划',description:'将想法整理成可执行的镜头清单，明确画面、时长和素材。',prompt:'请将以下创作需求整理为分镜清单，包含画面、动作、时长和参考素材。'},
{id:'visual-style',name:'视觉风格设计',category:'图片',description:'梳理色彩、光线、构图和质感，建立统一视觉方向。',prompt:'请为以下需求设计统一视觉风格，说明色彩、光线、构图和质感。'},
{id:'short-film',name:'叙事短片导演',category:'视频',description:'从故事节奏出发，安排开场、发展与情绪落点。',prompt:'请为以下需求策划叙事短片，明确故事节奏、镜头顺序和情绪变化。'},
{id:'expression',name:'微表情指导',category:'视频',description:'细化视线、表情和细微动作，减少笼统的表演描述。',prompt:'请细化人物表演，描述视线、表情和自然细微动作。'},
{id:'product-ad',name:'产品广告',category:'视频',description:'围绕产品卖点规划镜头与素材，保持产品识别一致。',prompt:'请围绕产品卖点规划广告镜头，明确产品外观约束和展示重点。'},
{id:'cover',name:'封面设计',category:'图片',description:'规划主体、标题区域和画面层次，适配不同画面比例。',prompt:'请设计封面构图，明确主体、标题区域、层次与画面比例。'},
{id:'batch',name:'批量变体策划',category:'策划',description:'在共同约束下组织多个版本，让每个版本有清晰差异。',prompt:'请在保持核心约束的前提下规划多个创作变体，逐条列出差异。'}
];
let selectedSkills=[];let skillFilter='全部';
function useSkill(skill){if(!selectedSkills.some(s=>s.id===skill.id))selectedSkills.push(skill);renderSelected();tab('create');if(typeof syncComposerChrome==='function'){const card=$('#prompt-card')||$('.prompt-card.compact-composer');if(card){card.classList.remove('composer-collapsed');card.dataset.composerState='expanded';$('#create')?.classList.add('composer-open');card.classList.add('composer-bounce');setTimeout(()=>card.classList.remove('composer-bounce'),420);}syncComposerChrome();}requestAnimationFrame(()=>{$('#prompt').focus();});toast('已选择「'+skill.name+'」，可继续补充需求 / 也可输入 @ 点选技能');}
function renderSelected(){$('#selected-skills').replaceChildren();for(const s of selectedSkills){const tag=document.createElement('button');tag.className='selected-skill';tag.textContent='◇ '+s.name+' ×';tag.setAttribute('aria-label','移除技能 '+s.name);tag.onclick=()=>{selectedSkills=selectedSkills.filter(x=>x.id!==s.id);renderSelected();};$('#selected-skills').append(tag);}}
function renderSkillShortcuts(){const box=$('#skill-shortcuts');if(!box)return;box.replaceChildren();for(const s of skillCatalog.slice(0,6)){const button=document.createElement('button');button.type='button';button.textContent='/ '+s.name;button.onclick=()=>useSkill(s);box.append(button);}const more=document.createElement('button');more.type='button';more.textContent='更多技能 ›';more.onclick=()=>tab('skills');box.append(more);}
renderSkillShortcuts();
function deleteSkill(skill){skillCatalog=skillCatalog.filter(s=>s.id!==skill.id);selectedSkills=selectedSkills.filter(s=>s.id!==skill.id);renderSelected();renderSkillShortcuts();renderSkills();if(typeof syncComposerChrome==='function')syncComposerChrome();toast('已删除技能「'+skill.name+'」');}
function addSkillFromFields(data){const name=(data.name||'').trim();const prompt=(data.prompt||'').trim();if(!name||!prompt){toast('技能名称和提示词不能为空');return null;}const category=['视频','图片','策划'].includes(data.category)?data.category:'策划';const description=(data.description||'自定义技能').trim().slice(0,120)||'自定义技能';if(data.id){const existing=skillCatalog.find(s=>s.id===data.id);if(existing){existing.name=name.slice(0,40);existing.category=category;existing.description=description;existing.prompt=prompt;existing.custom=true;renderSkillShortcuts();renderSkills();const sel=selectedSkills.find(s=>s.id===data.id);if(sel){sel.name=existing.name;sel.category=existing.category;sel.description=existing.description;sel.prompt=existing.prompt;sel.custom=true;renderSelected();}toast('已更新技能「'+existing.name+'」');return existing;}}const skill={id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:name.slice(0,40),category,description,prompt,custom:true};skillCatalog.unshift(skill);renderSkillShortcuts();renderSkills();toast('已添加技能「'+skill.name+'」');return skill;}
function renderSkills(){const query=$('#skill-search').value.trim();$('#skills-grid').replaceChildren();for(const s of skillCatalog.filter(s=>(skillFilter==='全部'||s.category===skillFilter)&&(s.name+s.description+s.prompt).includes(query))){const card=document.createElement('article');card.className='skill-card'+(s.custom?' custom':'');const art=document.createElement('div');art.className='skill-art';art.dataset.category=s.category;art.textContent=s.category==='视频'?'▷':s.category==='图片'?'▧':'☷';const name=document.createElement('h2');name.textContent=s.name;const description=document.createElement('p');description.textContent=s.description;const button=document.createElement('button');button.textContent='使用技能';button.onclick=()=>useSkill(s);const status=document.createElement('small');status.textContent=s.source==='codex-import'?'Codex 导入技能 · 正文按需读取':s.custom?'自定义技能 · 本地会话':'提示模板 · 执行待接入';const actions=document.createElement('div');actions.className='skill-actions';const edit=document.createElement('button');edit.type='button';edit.className='skill-edit';edit.textContent='修改';edit.setAttribute('aria-label','修改技能 '+s.name);edit.onclick=e=>{e.stopPropagation();openSkillEditor(s);};const del=document.createElement('button');del.type='button';del.className='skill-delete';del.textContent='删除';del.setAttribute('aria-label','删除技能 '+s.name);del.onclick=e=>{e.stopPropagation();deleteSkill(s);};actions.append(edit,del);card.append(art,name,description,status,button,actions);$('#skills-grid').append(card);}if(!$('#skills-grid').children.length){$('#skills-grid').textContent='没有匹配的技能';}}
$('#skill-search').oninput=renderSkills;document.querySelectorAll('[data-skill-filter]').forEach(b=>b.onclick=()=>{skillFilter=b.dataset.skillFilter;document.querySelectorAll('[data-skill-filter]').forEach(x=>x.classList.toggle('active',x===b));renderSkills();});

document.querySelectorAll('[data-asset-filter]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    assetFilter=btn.dataset.assetFilter||'upload';
    document.querySelectorAll('[data-asset-filter]').forEach(b=>b.classList.toggle('active',b===btn));
    renderAssetsGrid();
  });
});
renderSkills();

let skillEditorEditingId=null;
function setSkillCategory(cat){
  const value=['视频','图片','策划'].includes(cat)?cat:'策划';
  const hidden=$('#skill-category');if(hidden)hidden.value=value;
  document.querySelectorAll('.skill-cat-pill').forEach(btn=>btn.classList.toggle('active',btn.dataset.cat===value));
}
function openSkillEditor(seed){
  const dlg=$('#skill-editor');if(!dlg){toast('技能编辑器未就绪');return;}
  skillEditorEditingId=(seed&&seed.id)||null;
  $('#skill-name').value=(seed&&seed.name)||'';
  setSkillCategory((seed&&seed.category)||'策划');
  $('#skill-description').value=(seed&&seed.description)||'';
  $('#skill-prompt').value=(seed&&seed.prompt)||'';
  $('#skill-editor-title').textContent=skillEditorEditingId?'编辑技能':'新建技能';
  const saveBtn=$('#skill-editor-save');if(saveBtn)saveBtn.textContent=skillEditorEditingId?'保存修改':'保存技能';
  if(typeof dlg.showModal==='function')dlg.showModal(); else dlg.setAttribute('open','');
  requestAnimationFrame(()=>{$('#skill-name').focus();$('#skill-name').select&&$('#skill-name').select();});
}
document.querySelectorAll('.skill-cat-pill').forEach(btn=>{
  btn.addEventListener('click',()=>setSkillCategory(btn.dataset.cat));
});
function closeSkillEditor(){const dlg=$('#skill-editor');if(!dlg)return;if(typeof dlg.close==='function')dlg.close();else dlg.removeAttribute('open');}
$('#skill-add').onclick=()=>openSkillEditor();
const skillEditorForm=$('#skill-editor-form');
if(skillEditorForm){
  skillEditorForm.addEventListener('submit',e=>{
    const submitter=e.submitter;const value=submitter&&submitter.value;
    if(value==='cancel'){return;} // method=dialog closes
    if(value==='save'){
      e.preventDefault();
      const name=$('#skill-name').value.trim();
      const category=$('#skill-category').value;
      const description=$('#skill-description').value.trim()||'自定义技能';
      const promptText=$('#skill-prompt').value.trim();
      if(!name||!promptText){toast('请填写技能名称和指令');($('#skill-name').value.trim()?$('#skill-prompt'):$('#skill-name')).focus();return;}
      const skill=addSkillFromFields({id:skillEditorEditingId,name,category,description,prompt:promptText});
      if(skill){closeSkillEditor();if(!skillEditorEditingId)useSkill(skill);else toast('技能已更新');skillEditorEditingId=null;}
    }
  });
  $('#skill-editor')?.addEventListener('cancel',e=>{/* Esc */});
}

$('#skill-upload').onclick=()=>$('#skill-file').click();
$('#skill-file').onchange=async()=>{const file=$('#skill-file').files?.[0];$('#skill-file').value='';if(!file)return;try{const text=await file.text();let data;if(/\.json$/i.test(file.name)||text.trim().startsWith('{')){data=JSON.parse(text);if(Array.isArray(data)){for(const item of data)addSkillFromFields(item);toast('已导入 '+data.length+' 个技能');return;} }else{data={name:file.name.replace(/\.[^.]+$/,'').slice(0,40),category:'策划',description:'上传的提示词技能',prompt:text};}const skill=addSkillFromFields(data);if(skill)toast('已上传技能「'+skill.name+'」');}catch(e){toast(e.message||'上传失败，请检查文件格式');}};

// Non-modal message drawer and account popover; no real notifications fabricated.
const messagePanel=$('#message-panel'), accountMenu=$('#account-menu');let messageKind='activity';let panelReturn=null;
function closeAccount(){accountMenu.hidden=true;$('#account-menu-open').setAttribute('aria-expanded','false');$('#wallet-open').setAttribute('aria-expanded','false');}
function closeMessages(){messagePanel.hidden=true;$('#messages-open').setAttribute('aria-expanded','false');}
function renderMessages(){const feed=$('#message-feed');feed.replaceChildren();if(messageKind==='official'||!drafts.length){const empty=document.createElement('div');empty.className='message-empty';empty.textContent=messageKind==='official'?'暂无官方消息。消息服务尚未接入。':'暂无任务消息。创建任务草稿后可在这里查看本地记录。';feed.append(empty);return;}for(const draft of [...drafts].reverse()){const item=document.createElement('article');item.className='message-item';const icon=document.createElement('span');icon.className='message-icon';icon.textContent='◐';const content=document.createElement('div');const title=document.createElement('h3');title.textContent='任务草稿已整理';const p=document.createElement('p');p.textContent=draft.prompt;const meta=document.createElement('small');meta.textContent=`${draft.count} 条 · ${draft.paused?'已暂停草稿':'未提交生成'} · 本地演示`;content.append(title,p,meta);item.append(icon,content);feed.append(item);}}
$('#messages-open').onclick=()=>{const open=messagePanel.hidden;closeAccount();if(open){renderMessages();messagePanel.hidden=false;$('#messages-open').setAttribute('aria-expanded','true');panelReturn=$('#messages-open');$('#messages-close').focus();}else closeMessages();};
$('#messages-close').onclick=()=>{closeMessages();$('#messages-open').focus();};
document.querySelectorAll('[data-message-kind]').forEach(b=>b.onclick=()=>{messageKind=b.dataset.messageKind;document.querySelectorAll('[data-message-kind]').forEach(x=>x.classList.toggle('active',x===b));renderMessages();});
function toggleAccount(e){const open=accountMenu.hidden;closeMessages();closeAccount();if(open){accountMenu.hidden=false;panelReturn=e.currentTarget;e.currentTarget.setAttribute('aria-expanded','true');accountMenu.querySelector('button').focus();}}
$('#account-menu-open').onclick=toggleAccount;$('#wallet-open').onclick=toggleAccount;
document.querySelectorAll('[data-account-route]').forEach(b=>b.onclick=()=>{closeAccount();tab(b.dataset.accountRoute);});
$('#account-signout').onclick=async()=>{closeAccount();try{await logout();}catch{}setAuthed(false);clearUserMenu();location.hash='welcome';};
document.addEventListener('pointerdown',e=>{if(!accountMenu.hidden&&!accountMenu.contains(e.target)&&!e.target.closest('#account-menu-open,#wallet-open'))closeAccount();if(!messagePanel.hidden&&!messagePanel.contains(e.target)&&!e.target.closest('#messages-open'))closeMessages();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!accountMenu.hidden||!messagePanel.hidden)){closeAccount();closeMessages();panelReturn?.focus();}});
window.addEventListener('hashchange',()=>{closeAccount();closeMessages();});

// Local conversation prototype; no Agent request or billable generation is made.
const conversations=[];let currentConversation=null;let openAtLatest=true;
let projects=[{id:'p-demo',name:'演示项目',createdAt:Date.now()}];
let currentProjectId=projects[0].id;

const ZORA_SESSION_KEY='zora.session.v1';
const ZORA_ASSETS_KEY='zora.generatedAssets.v1';
const ASSET_TTL_MS=7*24*60*60*1000;
function durableMediaUrl(url){return typeof url==='string'&&/^(https?:|data:)/i.test(url);}
function serializeRef(a){if(!a)return null;if(a.file instanceof Blob)saveReference(a).catch(()=>toast("参考素材保存失败，请保留原文件并重新添加"));const file=a.file||{name:a.name||'asset',type:a.kind==='video'?'video/mp4':'image/png',size:0};return{reference:a.reference||'',source:a.source||'upload',promptRef:!!a.promptRef,storageId:a.storageId,url:durableMediaUrl(a.url)?a.url:'',file:{name:file.name||'asset',type:file.type||'application/octet-stream',size:Number(file.size)||0},kind:a.kind||(String(file.type||'').startsWith('video/')?'video':'image')};}
function serializeMessage(m){if(!m||typeof m!=='object')return m;const copy={...m,references:(m.references||[]).map(serializeRef).filter(Boolean)};try{return JSON.parse(JSON.stringify(copy));}catch{return{text:m.text||'',kind:m.kind||'agent',count:m.count||0,meta:m.meta||'',references:[],answer:m.answer,error:m.error,pending:false,liveAgent:!!m.liveAgent,genUrl:durableMediaUrl(m.genUrl)?m.genUrl:undefined,genStatus:m.genStatus,genError:m.genError,genTaskId:m.genTaskId,modelId:m.modelId,ratio:m.ratio,resolution:m.resolution,duration:m.duration,concurrency:m.concurrency,videoMode:m.videoMode,cancelled:m.cancelled};}}
function ensureConversationId(c){if(c&&!c.id)c.id='c-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);return c;}
function pruneGeneratedAssets(){const now=Date.now();generatedAssets=generatedAssets.filter(a=>a&&durableMediaUrl(a.url)&&Number(a.createdAt||0)>0&&(now-Number(a.createdAt))<=ASSET_TTL_MS);}
function saveGeneratedAssets(){try{pruneGeneratedAssets();localStorage.setItem(ZORA_ASSETS_KEY,JSON.stringify(generatedAssets.map(a=>({id:a.id,source:'generated',name:a.name,url:a.url,kind:a.kind||'image',createdAt:a.createdAt||Date.now(),meta:a.meta||''}))));}catch{}}
function loadGeneratedAssets(){try{const list=JSON.parse(localStorage.getItem(ZORA_ASSETS_KEY)||'[]');generatedAssets=Array.isArray(list)?list:[];pruneGeneratedAssets();}catch{generatedAssets=[];}}
function saveSession(){try{for(const c of conversations)ensureConversationId(c);const payload={v:1,savedAt:Date.now(),projects,currentProjectId,currentConversationId:currentConversation?.id||null,conversations:conversations.map(c=>({id:c.id,title:c.title,projectId:c.projectId,createdAt:c.createdAt,updatedAt:c.updatedAt,backendId:c.backendId,branchedFrom:c.branchedFrom,branchRootTitle:c.branchRootTitle,messages:(c.messages||[]).map(serializeMessage)}))};localStorage.setItem(ZORA_SESSION_KEY,JSON.stringify(payload));saveGeneratedAssets();saveModelPref($('#creation-kind')?.value,$('#model')?.value);}catch(e){console.warn('zora saveSession',e);}}
function hydrateRef(r){const file=r?.file||{name:'asset',type:'image/png',size:0};return{reference:r.reference||'',source:r.source||'upload',promptRef:!!r.promptRef,storageId:r.storageId,url:r.url||'',file:{name:file.name||'asset',type:file.type||'image/png',size:Number(file.size)||0},kind:r.kind||(String(file.type||'').startsWith('video/')?'video':'image')};}
function loadSession(){try{const raw=localStorage.getItem(ZORA_SESSION_KEY);if(!raw)return;const data=JSON.parse(raw);if(Array.isArray(data.projects)&&data.projects.length){projects=data.projects;currentProjectId=data.currentProjectId&&projects.some(p=>p.id===data.currentProjectId)?data.currentProjectId:projects[0].id;}if(Array.isArray(data.conversations)){conversations.length=0;for(const c of data.conversations){conversations.push({id:c.id||('c-'+Date.now()),title:c.title||'未命名对话',projectId:c.projectId,createdAt:c.createdAt||Date.now(),updatedAt:c.updatedAt||c.createdAt||Date.now(),backendId:c.backendId,branchedFrom:c.branchedFrom,branchRootTitle:c.branchRootTitle,messages:(c.messages||[]).map(m=>({...restorePendingMessage(m),references:(m.references||[]).map(hydrateRef)}))});}currentConversation=data.currentConversationId?conversations.find(c=>c.id===data.currentConversationId)||null:null;}loadGeneratedAssets();}catch(e){console.warn('zora loadSession',e);}}

loadSession();

const directoryMenu=$('#directory-menu');
const projectsPanel=$('#projects-panel');
function projectById(id){return projects.find(p=>p.id===id);}
function ensureConversationProject(c){if(!c.projectId||!projectById(c.projectId))c.projectId=currentProjectId;return c;}
function conversationStamp(c){return c.updatedAt||c.createdAt||0;}
function touchConversation(c){c.updatedAt=Date.now();if(!c.createdAt)c.createdAt=c.updatedAt;}
function closeDirectory(){directoryMenu.hidden=true;$('#directory-open').setAttribute('aria-expanded','false');}
function closeProjects(){projectsPanel.hidden=true;$('#directory-more').setAttribute('aria-expanded','false');}
function openConversation(c){openAtLatest=true;ensureConversationProject(c);currentConversation=c;currentProjectId=c.projectId;closeDirectory();closeProjects();tab('create');renderConversation();renderDirectory();renderProjects();}
function deleteConversation(c){const i=conversations.indexOf(c);if(i<0)return;conversations.splice(i,1);if(currentConversation===c){currentConversation=null;$('#create').classList.remove('conversation-active');conversationLog.hidden=true;conversationLog.replaceChildren();}saveSession();renderConversation();renderDirectory();renderProjects();toast('已删除对话');}
function deleteProject(project){if(projects.length<=1){toast('至少保留一个项目');return;}const idx=projects.indexOf(project);if(idx<0)return;for(const c of [...conversations]){if(c.projectId===project.id)conversations.splice(conversations.indexOf(c),1);}projects.splice(idx,1);if(currentProjectId===project.id)currentProjectId=projects[0].id;if(currentConversation&&!conversations.includes(currentConversation)){currentConversation=null;$('#create').classList.remove('conversation-active');conversationLog.hidden=true;conversationLog.replaceChildren();}saveSession();renderConversation();renderDirectory();renderProjects();toast('已删除项目');}
function conversationSynopsis(c){
 if(!c)return '最近对话';
 const msgs=(c.messages||[]).filter(m=>m&&(m.text||m.answer));
 const first=msgs[0];
 const last=msgs[msgs.length-1];
 const bits=[];
 if(c.title)bits.push(c.title);
 const body=(last?.text||first?.text||'').replace(/\s+/g,' ').trim();
 if(body&&body!==c.title)bits.push(body);
 else if(last?.answer)bits.push(String(last.answer).replace(/\s+/g,' ').trim().slice(0,40));
 const text=bits.join(' · ').replace(/\s+/g,' ').trim()||'未命名对话';
 return text.length>36?text.slice(0,36)+'…':text;
}
function renderDirectory(){const recent=$('#directory-recent');const empty=$('#directory-empty');recent.replaceChildren();const sorted=[...conversations].sort((a,b)=>conversationStamp(b)-conversationStamp(a)).slice(0,8);const label=$('#directory-label');const active=currentConversation||null;const synopsis=conversationSynopsis(active);label.textContent=synopsis;label.title=active?(active.title+(active.messages?.length?` · ${active.messages.length} 条`:'')):'还没有当前对话，点击查看最近记录';empty.hidden=sorted.length>0;for(const c of sorted){ensureConversationProject(c);const row=document.createElement('div');row.className='directory-item'+(c===currentConversation?' active':'');row.setAttribute('role','menuitem');const main=document.createElement('button');main.type='button';main.className='directory-item-main';main.onclick=()=>openConversation(c);const title=document.createElement('span');title.className='directory-item-title';title.textContent=c.title;const meta=document.createElement('span');meta.className='directory-item-meta';const proj=projectById(c.projectId);meta.textContent=(proj?proj.name:'项目')+' · '+(c.messages?.length||0)+' 条';main.append(title,meta);const del=document.createElement('button');del.type='button';del.className='directory-item-delete';del.setAttribute('aria-label','删除对话 '+c.title);del.textContent='×';del.onclick=e=>{e.stopPropagation();deleteConversation(c);};row.append(main,del);recent.append(row);}}
function renderProjects(){const list=$('#projects-list');list.replaceChildren();if(!projects.length){list.append(chatNode('p','project-empty','还没有项目。'));return;}for(const project of projects){const card=chatNode('article','project-card'+(project.id===currentProjectId?' active':''));const head=chatNode('div','project-card-head');const main=document.createElement('button');main.type='button';main.className='project-card-main';const chats=conversations.filter(c=>c.projectId===project.id);main.onclick=()=>{currentProjectId=project.id;currentConversation=null;tab('create');renderConversation();renderDirectory();renderProjects();closeProjects();toast('已切换到项目：'+project.name);};main.append(chatNode('strong','',project.name),chatNode('small','',`${chats.length} 个对话 · 本地演示`));const delP=document.createElement('button');delP.type='button';delP.className='project-card-delete';delP.setAttribute('aria-label','删除项目 '+project.name);delP.textContent='×';delP.onclick=e=>{e.stopPropagation();deleteProject(project);};head.append(main,delP);card.append(head);const nest=chatNode('div','project-conversations');if(!chats.length)nest.append(chatNode('p','project-empty','暂无对话'));else{for(const c of [...chats].sort((a,b)=>conversationStamp(b)-conversationStamp(a))){const row=chatNode('div','project-chat-row');const open=document.createElement('button');open.type='button';open.className='open'+(c===currentConversation?' active':'');open.textContent=c.title;open.onclick=()=>openConversation(c);const del=document.createElement('button');del.type='button';del.className='del';del.setAttribute('aria-label','删除对话');del.textContent='×';del.onclick=()=>deleteConversation(c);row.append(open,del);nest.append(row);}}card.append(nest);list.append(card);}}
$('#directory-open').onclick=()=>{const open=directoryMenu.hidden;closeAccount();closeMessages();closeProjects();if(open){renderDirectory();directoryMenu.hidden=false;$('#directory-open').setAttribute('aria-expanded','true');}else closeDirectory();};
$('#directory-more').onclick=()=>{const open=projectsPanel.hidden;closeAccount();closeMessages();closeDirectory();if(open){renderProjects();projectsPanel.hidden=false;$('#directory-more').setAttribute('aria-expanded','true');}else closeProjects();};
$('#directory-new').onclick=()=>{currentConversation=null;$('#prompt').value='';$('#preview-result').replaceChildren();closeDirectory();tab('create');renderConversation();renderDirectory();$('#prompt').focus();};
$('#projects-close').onclick=()=>{closeProjects();$('#directory-more').focus();};
$('#project-create').onclick=()=>{const name=prompt('新项目名称','未命名项目');if(name===null)return;const trimmed=name.trim()||'未命名项目';const project={id:'p-'+Date.now(),name:trimmed.slice(0,40),createdAt:Date.now()};projects.unshift(project);currentProjectId=project.id;currentConversation=null;saveSession();renderProjects();renderDirectory();toast('已创建项目：'+project.name);};

const conversationRail=document.createElement('section');conversationRail.className='conversation-rail';conversationRail.innerHTML='<div class="rail-text conversation-label">对话</div><div class="conversation-links"></div>';
$('.rail-bottom').before(conversationRail);
const conversationLog=document.createElement('section');conversationLog.className='conversation-log';conversationLog.hidden=true;conversationLog.setAttribute('aria-label','创作对话');$('#agent-workspace').prepend(conversationLog);
function chatNode(tag,className,text){const n=document.createElement(tag);n.className=className;if(text)n.textContent=text;return n;}

function deepCloneMessage(m){try{return JSON.parse(JSON.stringify(serializeMessage(m)));}catch{return serializeMessage(m);}}
function branchConversationFrom(message){
  if(!currentConversation){toast('没有可分支的对话');return;}
  const msgs=currentConversation.messages||[];
  let idx=msgs.indexOf(message);
  if(idx<0){idx=msgs.findIndex(m=>m===message||(message&&m.createdAt&&m.createdAt===message.createdAt&&m.text===message.text));}
  if(idx<0){toast('找不到要分支的消息');return;}
  const sliced=msgs.slice(0,idx+1).map(m=>{const raw=deepCloneMessage(m);return{...raw,references:(raw.references||[]).map(hydrateRef),pending:false};});
  ensureConversationId(currentConversation);
  const titleBase=String(currentConversation.title||'对话').replace(/\s*·\s*分支\d*$/,'').trim()||'对话';
  const n=conversations.filter(c=>c.branchedFrom===currentConversation.id).length+1;
  const branched={id:'c-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:(titleBase+' · 分支'+n).slice(0,48),projectId:currentConversation.projectId||currentProjectId,createdAt:Date.now(),updatedAt:Date.now(),branchedFrom:currentConversation.id,branchRootTitle:titleBase,messages:sliced};
  conversations.unshift(branched);
  currentConversation=branched;
  saveSession();
  tab('create');
  renderConversation();
  if(typeof renderDirectory==='function')renderDirectory();
  toast('已创建会话分支，可继续往下聊');
}
function formatMsgTime(ts){const d=new Date(ts||Date.now());if(Number.isNaN(d.getTime()))return '';const weeks=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];const hh=String(d.getHours()).padStart(2,'0');const mm=String(d.getMinutes()).padStart(2,'0');return weeks[d.getDay()]+hh+':'+mm;}
async function copyTextToClipboard(text){const value=String(text||'').trim();if(!value){toast('没有可复制的内容');return false;}try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);toast('已复制');return true;}}catch{}try{const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.left='-9999px';document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();toast('已复制');return true;}catch{toast('复制失败');return false;}}
function msgIconSvg(kind){const svgs={branch:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="6" cy="5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="19" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 7.2v9.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8.2 6.2c4.2 0 7.6 2.6 7.6 5.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',copy:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="4" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',dislike:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10 15v5a2 2 0 0 0 2 2l5-11V3H7.2a2 2 0 0 0-2 1.7L4 11.2A2 2 0 0 0 6 14h4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M17 3h2.5A1.5 1.5 0 0 1 21 4.5v6A1.5 1.5 0 0 1 19.5 12H17" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',share:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 4h6v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M20 4 11 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',edit:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',trash:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',regen:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M21 3v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M3 21v-5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',like:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 9V4a2 2 0 0 0-2-2l-5 11v8h9.8a2 2 0 0 0 2-1.7L20 12.8A2 2 0 0 0 18 10h-4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 21H4.5A1.5 1.5 0 0 1 3 19.5v-6A1.5 1.5 0 0 1 4.5 12H7" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>'};return svgs[kind]||'';}
function msgActionBtn(kind,label,onClick,active){const b=document.createElement('button');b.type='button';b.className='msg-action-btn'+(active?' active':'');b.setAttribute('aria-label',label);b.title=label;b.innerHTML=msgIconSvg(kind);b.onclick=e=>{e.preventDefault();e.stopPropagation();onClick?.(b);};return b;}
function buildUserMsgBar(message){if(!message.createdAt)message.createdAt=Date.now();const bar=chatNode('div','msg-action-bar user-msg-bar');const time=chatNode('span','msg-action-time',formatMsgTime(message.createdAt));const copy=msgActionBtn('copy','复制',()=>copyTextToClipboard(message.text||''));bar.append(time,copy);return bar;}
function buildAgentMsgBar(message){if(!message.completedAt&&!message.createdAt)message.createdAt=Date.now();const bar=chatNode('div','msg-action-bar agent-msg-bar');const text=message.error||message.answer||'';const branch=msgActionBtn('branch','从此分支',()=>branchConversationFrom(message));const copy=msgActionBtn('copy','复制',()=>copyTextToClipboard(text));const dislike=msgActionBtn('dislike','不喜欢',()=>{message.feedback=message.feedback==='down'?null:'down';if(typeof saveSession==='function')saveSession();toast(message.feedback==='down'?'已记录反馈':'已取消反馈');renderConversation();},message.feedback==='down');const share=msgActionBtn('share','分享',async()=>{const ok=await copyTextToClipboard(text);if(ok&&navigator.share){try{await navigator.share({text});}catch{}}});const time=chatNode('span','msg-action-time',formatMsgTime(message.completedAt||message.createdAt));bar.append(branch,copy,dislike,share,time);return bar;}
function renderConversationRail(){const links=conversationRail.querySelector('.conversation-links');links.replaceChildren();for(const c of conversations){ensureConversationId(c);const row=chatNode('div','conversation-link-row');const b=chatNode('button','conversation-link',c.title);b.title=c.branchedFrom?((c.branchRootTitle||c.title)+' · 会话分支'):c.title;if(c.branchedFrom)b.classList.add('is-branch');b.setAttribute('aria-label','打开对话 '+c.title);b.classList.toggle('active',c===currentConversation);b.onclick=()=>{openAtLatest=true;currentConversation=c;saveSession();tab('create');renderConversation();};const del=document.createElement('button');del.type='button';del.className='conversation-link-delete';del.textContent='×';del.title='删除对话';del.setAttribute('aria-label','删除对话 '+c.title);del.onclick=e=>{e.preventDefault();e.stopPropagation();if(!confirm('确定删除对话「'+c.title+'」？此操作不可恢复。'))return;deleteConversation(c);};row.append(b,del);links.append(row);}}
function renderConversation(){const open=!!currentConversation;$('#create').classList.toggle('conversation-active',open);conversationLog.hidden=!open;conversationLog.replaceChildren();renderConversationRail();if(!open)return;conversationLog.append(chatNode('h2','conversation-date','今天'));for(const message of currentConversation.messages){if(message.kind && message.kind!=='agent'){renderMediaTask(message);continue;}const user=chatNode('article','conversation-user');if(message.references&&message.references.length){const refs=chatNode('div','conversation-references');for(const a of message.references){const mime=(a.file&&a.file.type)||'';const media=document.createElement(mime.startsWith('video/')||a.kind==='video'?'video':'img');if(!a.url){refs.append(chatNode('span','reference-unavailable','原素材不可用，请重新添加'));continue;}media.src=a.url;media.onerror=()=>media.replaceWith(chatNode('span','reference-unavailable','素材加载失败，请重新添加'));media.setAttribute('aria-label',(a.file&&a.file.name)||a.reference||'参考');if(media.tagName==='IMG')media.alt=(a.file&&a.file.name)||'参考';else media.controls=true;refs.append(media);}user.append(refs);}if(!message.createdAt)message.createdAt=Date.now();user.append(chatNode('p','conversation-bubble',message.text),buildUserMsgBar(message));conversationLog.append(user);const reply=chatNode('article','conversation-reply');reply.append(chatNode('strong','conversation-agent','Zora Agent · 界面演示'));reply.append(chatNode('p','','已记录你的创作需求。以下为根据所选参数整理的本地任务草稿，尚未经过 Agent 规划或提交生成。'));const card=chatNode('section','conversation-task-card');card.append(chatNode('h3','',`任务清单（${message.count}）`));for(let i=0;i<message.count;i++){const row=chatNode('label','conversation-task');const check=document.createElement('input');check.type='checkbox';check.checked=true;check.disabled=message.cancelled;check.setAttribute('aria-label',`选择任务 ${i+1}`);row.append(check,chatNode('span','',`${i+1}. ${message.text}`));card.append(row);}card.append(chatNode('p','conversation-meta',message.meta));const actions=chatNode('div','conversation-actions');const cancel=chatNode('button','secondary',message.cancelled?'已取消草稿':'取消草稿');cancel.disabled=!!message.cancelled;cancel.onclick=()=>{message.cancelled=true;renderConversation();};const generate=chatNode('button','','生成服务待接入');generate.disabled=true;actions.append(chatNode('span','','积分待报价'),cancel,generate);card.append(actions);reply.append(card);const suggestions=chatNode('div','conversation-suggestions');for(const text of ['补充分镜细节','调整画面风格','继续添加参考素材']){const b=chatNode('button','',text);b.onclick=()=>{if(text==='继续添加参考素材')$('#files').click();else{$('#prompt').value=text;$('#prompt').focus();}};suggestions.append(b);}reply.append(suggestions,chatNode('small','conversation-meta','本地界面演示 · 消息已保存 · 素材保留 7 天'));if(!message.liveAgent){if(!message.answer)message.answer=message.text||'';reply.append(buildAgentMsgBar(message));}conversationLog.append(reply);}}
$('#send-prompt').title='发送到本地演示对话';
$('#send-prompt').onclick=()=>{const text=buildInstructionText();if(!text){toast('请先填写创作需求或 @ 素材');$('#prompt').focus();return;}const count=Number($('#count').value);if(!Number.isInteger(count)||count<1||count>Number($("#count").max)){toast('生成数量超过当前模型上限');return;}if(!currentConversation){currentConversation={id:'c-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:text.slice(0,24),messages:[],projectId:currentProjectId,createdAt:Date.now(),updatedAt:Date.now()};conversations.unshift(currentConversation);}else{touchConversation(currentConversation);ensureConversationId(currentConversation);}const meta=[$('#model').selectedOptions[0]?.textContent,$('#ratio').value,$('#resolution').value,$('#creation-kind').value==='video'?(Number($('#duration').value)===-1?'自动时长':$('#duration').value+' 秒'):'', '并发 '+$('#concurrency').value,...selectedSkills.map(s=>s.name)].filter(Boolean).join(' · ');currentConversation.messages.push({text,count,meta,kind:$("#creation-kind").value,ratio:$("#ratio").value,resolution:$("#resolution").value,modelId:$("#model").value,duration:$("#duration").value,concurrency:$("#concurrency").value,videoMode:$("#video-mode")?.value,references:[...(mentionedAssets())],createdAt:Date.now()});$('#prompt').value='';$('#preview-result').replaceChildren();closePicker();saveSession();renderConversation();requestAnimationFrame(()=>{$('#prompt').focus({preventScroll:true});});};
const newChat=chatNode('button','new-conversation','新建对话');newChat.title='新建对话';newChat.onclick=()=>{currentConversation=null;$('#prompt').value='';$('#preview-result').replaceChildren();tab('create');renderConversation();$('#prompt').focus();};conversationRail.prepend(newChat);
// A consistent 24px SVG family for workspace navigation.
const railIconPaths={
create:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z"/><path d="m19 3 .6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6Z"/>',
canvases:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8" cy="9.5" r="1.2"/><circle cx="15.5" cy="9" r="1.2"/><circle cx="12" cy="15" r="1.2"/><path d="M9.1 10.2 14.4 9.6M8.7 10.7 11.2 14M14.8 10.2 12.8 14"/>',
tasks:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m7 8 1 1 2-2m-3 8 1 1 2-2m3-6h4m-4 7h4"/>',
assets:'<path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="m7 16 3-3 3 3 2-2 3 3"/><circle cx="15.5" cy="10.5" r=".5"/>',
skills:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M17.5 3v7M14 6.5h7"/>',
settings:'<path d="m9 3-.6 2-2 .9-2-.4-2 3.5 1.4 1.6v2.8L2.4 15l2 3.5 2-.4 2 .9.6 2h4l.6-2 2-.9 2 .4 2-3.5-1.4-1.6v-2.8L19.6 9l-2-3.5-2 .4-2-.9-.6-2Z"/><circle cx="11" cy="12" r="3"/>',
credits:'<circle cx="12" cy="12" r="9"/><path d="m12 6 4 6-4 6-4-6Z"/>',
membership:'<path d="m3 6 4.5 4L12 4l4.5 6L21 6l-2 12H5Z"/><path d="M7 21h10"/>',
account:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.6 18.2a6.5 6.5 0 0 1 12.8 0"/>',
panel:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-11-3 3 3 3"/>',
newchat:'<path d="M12 4H6a3 3 0 0 0-3 3v11l4-3h11a3 3 0 0 0 3-3v-1M18 2v6m-3-3h6"/>',
chat:'<path d="M21 12a8 8 0 0 1-8 8H7l-4 2V10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M8 8h8m-8 5h5"/>',
preview:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>'};
function railIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('rail-icon');svg.innerHTML=railIconPaths[name];return svg;}
for(const b of document.querySelectorAll('.studio-rail [data-tab]')){const name=b.dataset.tab;if(railIconPaths[name])b.firstElementChild.replaceWith(railIcon(name));}
$('#wallet-open').firstElementChild.replaceWith(railIcon('account'));
$('#rail-toggle').replaceChildren(railIcon('panel'));
const newChatLabel=chatNode('span','rail-text','新建对话');newChat.replaceChildren(railIcon('newchat'),newChatLabel);
const compactPreviewIcon=railIcon('preview');compactPreviewIcon.classList.add('compact-preview-icon');$('#preview').prepend(compactPreviewIcon);
const renderRailWithText=renderConversationRail;
renderConversationRail=function(){renderRailWithText();for(const b of conversationRail.querySelectorAll('.conversation-link')){const text=b.textContent;b.replaceChildren(railIcon('chat'),chatNode('span','conversation-title',text));}};

// Direct image/video tasks use a media feed; Agent keeps its planning dialogue.
function openGeneratedPreview(url,kind){
 const previous=document.querySelector('#generated-media-preview');if(previous)previous.close();
 const dialog=document.createElement('dialog');dialog.id='generated-media-preview';dialog.setAttribute('aria-label',kind==='video'?'视频预览':'图片预览');
 dialog.style.cssText='position:fixed;inset:0;margin:auto;max-width:96vw;max-height:94vh;padding:16px;border:1px solid #777;border-radius:14px;background:#17191e;color:white;overflow:auto;';
 const close=document.createElement('button');close.type='button';close.textContent='关闭预览';close.style.cssText='display:block;margin:0 0 12px auto;';
 const media=document.createElement(kind==='video'?'video':'img');media.src=url;media.style.cssText='display:block;max-width:90vw;max-height:80vh;object-fit:contain;';
 if(kind==='video'){media.controls=true;media.autoplay=false;media.preload='metadata';media.setAttribute('controlsList','nodownload');}else media.alt='生成图片大图预览';
 dialog.append(close,media);document.body.append(dialog);
 const dismiss=()=>dialog.close();close.addEventListener('click',dismiss);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss();});
 dialog.addEventListener('close',()=>{if(kind==='video'){media.pause();media.removeAttribute('src');media.load();}dialog.remove();},{once:true});
 dialog.showModal();close.focus();
}
function renderMediaTask(message,target=conversationLog){
 const redraw=()=>{if(target===conversationLog)renderConversation();else window.__canvasAgentMediaSaved?.();};
 const article=chatNode('article','media-task-entry');
 const header=chatNode('header','media-task-header');const refs=chatNode('div','media-task-references');
 let missingReferences=0;const reportMissing=()=>{missingReferences++;let notice=refs.querySelector('.reference-unavailable');if(!notice){notice=chatNode('span','reference-unavailable');refs.append(notice);}notice.textContent=missingReferences+' 项参考素材不可用，请重新添加';};
 for(const a of (message.references||[]).slice(0,5)){const mime=(a.file&&a.file.type)||'';const media=document.createElement(mime.startsWith('video/')||a.kind==='video'?'video':'img');if(!a.url){reportMissing();continue;}media.src=a.url;media.onerror=()=>{media.remove();reportMissing();};media.title=(a.file&&a.file.name)||a.reference||'';if(media.tagName==='IMG')media.alt=(a.file&&a.file.name)||'参考';refs.append(media);}
 const heading=chatNode('div','media-task-heading');const prompt=chatNode('p','media-task-prompt',message.text);heading.append(prompt);if((message.text||'').length>220){prompt.classList.add('is-collapsed');const expand=chatNode('button','media-prompt-expand','展开提示词');expand.type='button';expand.setAttribute('aria-expanded','false');expand.onclick=()=>{const collapsed=prompt.classList.toggle('is-collapsed');expand.textContent=collapsed?'展开提示词':'收起提示词';expand.setAttribute('aria-expanded',String(!collapsed));};heading.append(expand);}heading.append(chatNode('span','conversation-meta',message.meta));const details=document.createElement('details');details.className='media-task-details';details.append(chatNode('summary','','详细信息'),chatNode('p','',`${message.kind==='video'?'视频':'图片'}任务 · ${message.count} 个结果 · ${message.meta} · ${message.genError||message.genStatus||'待发送'}`));{let requestLoading=false,requestLoaded=false;const loadRequest=async()=>{details.open=true;if(requestLoading||requestLoaded)return;requestLoading=true;try{if(!message.genBatchId){let pre=details.querySelector('.request-body');if(!pre){pre=chatNode('pre','request-body');details.append(pre);}pre.textContent='此记录没有本地生成任务编号，无法查询实际提交请求体。';return;}const r=await authFetch('/api/generation-tasks/'+encodeURIComponent(message.genBatchId));const j=await r.json();if(!r.ok)throw Error(j.error||'读取失败');let pre=details.querySelector('.request-body');if(!pre){pre=chatNode('pre','request-body');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto';details.append(pre);}pre.textContent=j.task?.requests?.length?JSON.stringify(j.task.requests,null,2):'此任务未保存提交请求体；旧任务不能追溯还原。';requestLoaded=true;}catch(e){let note=details.querySelector('.request-error');if(!note){note=chatNode('p','request-error');details.append(note);}note.textContent=e.message;}finally{requestLoading=false;}};details.addEventListener('mouseenter',loadRequest);details.addEventListener('focusin',loadRequest);details.addEventListener('mouseleave',()=>{if(!details.contains(document.activeElement))details.open=false;});details.addEventListener('toggle',()=>{if(details.open)void loadRequest();});}heading.append(details);header.append(refs,heading);article.append(header);
 const results=chatNode('div','media-task-results');
 for(let i=0;i<message.count;i++){const resultUrl=message.genUrls?.[i]||(i===0?message.genUrl:null);const frame=chatNode('div','media-task-frame');const [w,h]=(message.ratio||'16:9').split(':').map(Number);frame.style.aspectRatio=`${w} / ${h}`;frame.style.width=`min(100%, ${Math.min(280,220*w/h)}px)`;const st=message.cancelled?'已取消':(message.genStatus||'待生成');frame.append(chatNode('span','media-task-status',st));if(message.genUrls?.[i]||(i===0&&message.genUrl)){const media=Object.assign(document.createElement(message.kind==='video'?'video':'img'),{src:message.genUrls?.[i]||message.genUrl,controls:false,className:'media-task-result',draggable:true});if(media.tagName==='IMG')media.alt='生成结果';media.title='点击放大预览，拖到输入框可当参考';media.tabIndex=0;media.setAttribute('role','button');media.setAttribute('aria-label','打开生成素材预览');media.style.cursor='zoom-in';media.addEventListener('dragstart',e=>{try{e.dataTransfer.setData('application/x-zora-gen',JSON.stringify({url:resultUrl,kind:message.kind||'image'}));e.dataTransfer.setData('text/uri-list',resultUrl);e.dataTransfer.setData('text/plain',resultUrl);e.dataTransfer.effectAllowed='copy';}catch{}});media.addEventListener('click',()=>openGeneratedPreview(resultUrl,message.kind||'image'));media.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openGeneratedPreview(resultUrl,message.kind||'image');}});frame.append(media);}else{frame.append(chatNode('span','media-task-placeholder',`${message.kind==='video'?'视频':'图片'}预览${message.count>1?' '+(i+1):''}`));}results.append(frame);}article.append(results);
 const actions=chatNode('div','media-task-actions');
 if(message.genUrl){const dl=chatNode('button','','下载');dl.onclick=()=>downloadGenerated(message.genUrl,message.kind||'image');const useRef=chatNode('button','','加入参考');useRef.onclick=()=>useGeneratedAsReference(message.genUrl,message.kind||'image');actions.append(dl,useRef);}
 const edit=chatNode('button','','重新编辑');edit.onclick=()=>{$('#creation-kind').value=message.kind;kindChanged();$('#model').value=message.modelId;modelChanged();for(const id of ['ratio','resolution','duration','concurrency','video-mode']){const el=$('#'+id);if(!el)continue;const key=id==='video-mode'?'videoMode':id;if(message[key]!=null)el.value=message[key];}$('#count').value=message.count;$('#prompt').value=message.text;syncPickers();$('#prompt').focus();toast('已恢复文字和参数；参考素材请在输入栏核对');};
 const retry=chatNode('button','','再次生成');retry.disabled=!!message.cancelled||message.genUnknown||message.genPending||message.genStatus==='生成中';retry.onclick=async()=>{retry.disabled=true;const allowed=await verifyGenerationRetry(message);saveSession();redraw();if(!allowed)return;message.genUnknown=false;message.referenceError=message.genError||message.referenceError;message.genBatchId=null;message.genPending=false;message.genRevision=null;message.genTaskIds=[];message.genTaskId=null;message.genUrls=[];message.genUrl=null;message.genStatus='生成中';message.genError='';redraw();try{await submitMediaGeneration(message);}catch(e){message.genError=e.submissionUnknown?'':e.message||'生成失败';message.genPollError=e.submissionUnknown?e.message:'';message.genStatus=e.submissionUnknown?'结果待确认':'生成失败';}redraw();};
 if(message.genBatchId||message.genPending||message.genTaskIds?.length||message.genTaskId){const refresh=chatNode('button','','刷新生成结果');refresh.onclick=async()=>{refresh.disabled=true;try{await submitMediaGeneration(message);}catch(e){message.genError=e.message;}finally{saveSession();redraw();}};actions.append(refresh);}
 const cancel=chatNode('button','',message.cancelled?'已取消':'取消草稿');cancel.disabled=!!message.cancelled;cancel.onclick=()=>{message.cancelled=true;redraw();};actions.append(edit,retry,cancel);const foot=message.cancelled?'已取消草稿':message.genUnknown||message.genStatus==='结果待确认'?'结果待确认 · '+(message.genPollError||'保留原任务编号，不会自动重新生成'): (message.genError||message.genStatus==='生成失败'?('失败原因：'+(message.genError||message.genPollError||'未保留详细错误，请展开详细信息核对任务')):(message.genStatus==='已完成'?'生成完成 · 可下载或拖进输入框当参考':(message.genStatus==='已提交'||message.genStatus==='生成中'?(message.genPollError|| (message.genTaskId?'生成中 · 自动查询任务 '+message.genTaskId:'正在提交任务 · 自动查询中')):'本地任务草稿 · 等待发送')));article.append(actions,chatNode('p','conversation-meta',foot));target.append(article);
}
const agentOption=$('#creation-kind').querySelector('[value="agent"]');agentOption.disabled=false;agentOption.textContent='Agent 模式';
function updateModeControls(){const kind=$('#creation-kind').value;const agent=kind==='agent';const video=kind==='video';const image=kind==='image';for(const id of ['ratio','count','concurrency']){const lab=$('#'+id)?.closest('label');if(lab)lab.hidden=agent||id==='count';}$('#duration-label').hidden=agent||!video;$('#video-mode-label').hidden=agent||!(video||image);optionTitles['video-mode']=image?'参考模式':'视频模式';const vmPicker=pickers.find(p=>p.control.id==='video-mode');if(vmPicker)vmPicker.button.setAttribute('aria-label',optionTitles['video-mode']);}
$('#creation-kind').addEventListener('change',updateModeControls);updateModeControls();syncPickers();

// Refresh backend-owned capabilities on focus; retain only still-supported values.
async function refreshModelCatalog(){
 try{const response=await authFetch('/api/models',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();const before={};for(const id of ['creation-kind','model','ratio','resolution','duration','count','concurrency','video-mode'])before[id]=$('#'+id)?.value;models=data.models;
 options($('#creation-kind'),[{id:'agent',name:'Agent 模式'},{id:'video',name:'视频生成'},{id:'image',name:'图片生成'}]);
 if([...$('#creation-kind').options].some(o=>o.value===before['creation-kind']))$('#creation-kind').value=before['creation-kind'];kindChanged();if(models.some(m=>m.id===before.model&&m.kind===$('#creation-kind').value)){$('#model').value=before.model;modelChanged();}
 for(const id of ['ratio','resolution','duration','video-mode'])if($('#'+id)&&[...$('#'+id).options].some(o=>o.value===before[id]))$('#'+id).value=before[id];applyOptionPrefs($('#creation-kind').value);applyBackendLimits();syncPickers();updateModeControls();saveOptionPrefsForKind();$('#send-prompt').disabled=!models.length;$('#preview').disabled=!models.length;$('#preview').title=models.some(m=>m.kind!=='agent')?'校验当前视频/图片参数，并打开任务清单':'模型目录异常时仍可打开任务页；视频/图片预览需有效模型';
 }catch{$('#send-prompt').disabled=true;$('#preview').disabled=false;toast('模型配置暂不可用，请稍后重新切回窗口刷新');}
}
function applyBackendLimits(){const m=models.find(m=>m.id===$('#model').value);$('#count').max=m?.maxCount||1;$('#count').value=Math.max(1,Math.min(Number($('#count').value)||1,Number($('#count').max)));$('#concurrency').max=m?.maxConcurrency||1;$('#concurrency').value=Math.max(1,Math.min(Number($('#concurrency').value)||1,Number($('#concurrency').max)));}
$('#model').addEventListener('change',applyBackendLimits);$('#creation-kind').addEventListener('change',applyBackendLimits);window.addEventListener('focus',refreshModelCatalog);await refreshModelCatalog();

async function refreshDuoyuanxStatus(){const el=$('#duoyuanx-status');if(!el)return;try{const r=await authFetch('/api/duoyuanx/status',{cache:'no-store'});const s=await r.json();el.textContent=s.configured?`多元探索 API：已配置 · 代理路由 ${s.routesCount||0} 条`:`多元探索 API：未配置 DUOYUANX_API_KEY · 目录仍可加载`;}catch{el.textContent='多元探索 API：状态不可用';}}
refreshDuoyuanxStatus();window.addEventListener('focus',refreshDuoyuanxStatus);


function applyDraftToControls(draft){
  if(!draft||!draft.modelId){toast('没有可应用的任务参数');return false;}
  const m=models.find(x=>x.id===draft.modelId);
  if(!m){toast('任务模型当前目录不可用：'+draft.modelId);return false;}
  $('#creation-kind').value=m.kind;kindChanged();
  $('#model').value=m.id;modelChanged();
  if(draft.ratio!=null)setSelectIfPresent('ratio',draft.ratio);
  if(draft.resolution!=null)setSelectIfPresent('resolution',draft.resolution);
  if(draft.duration!=null&&draft.duration!==''&&!$('#duration')?.disabled)setSelectIfPresent('duration',draft.duration);
  if(draft.videoMode!=null)setSelectIfPresent('video-mode',draft.videoMode);
  if(draft.count!=null)$('#count').value=String(draft.count);
  if(draft.concurrency!=null)$('#concurrency').value=String(draft.concurrency);
  if(typeof applyBackendLimits==='function')applyBackendLimits();
  if(typeof saveOptionPrefsForKind==='function')saveOptionPrefsForKind(m.kind);
  if(typeof syncPickers==='function')syncPickers();
  if(typeof updateModeControls==='function')updateModeControls();
  toast('已将 Agent 参数同步到创作栏（'+m.kind+'）');
  return true;
}
function ingestAgentTasks(message, {openTasks=false, applyFirst=true}={}){
  const tasks=message?.tasks;if(!Array.isArray(tasks)||!tasks.length)return 0;
  if(message.added)return tasks.length;
  for(const t of tasks){drafts.push({...t, fromAgent:true, createdAt:t.createdAt||Date.now(), count:Number(t.count)||1});}
  message.added=true;
  if(typeof renderTasks==='function')renderTasks();
  if(applyFirst)applyDraftToControls(tasks[0]);
  if(openTasks&&typeof tab==='function')tab('tasks');
  toast(`Agent 已加入 ${tasks.length} 条任务（可在任务页查看）`);
  return tasks.length;
}

async function prepareAgentReferences(references=[]){
 if(references.length>6)throw Error('最多支持 6 个参考素材，请减少后发送');
 return Promise.all(references.map(async reference=>{
  await saveReference(reference);const item=await prepareMediaReference(reference,fileToDataUrl);
  if(!item.contentUrl)throw Error('参考素材不可读取，请重新添加');
  return {...item,reference:reference.reference||true};
 }));
}
async function submitMediaGeneration(message){
 if(!message.genBatchId&&!message.genTaskId&&!message.genTaskIds?.length){
  const capability=await authFetch('/api/generation-capabilities',{cache:'no-store'});
  const supported=capability.ok&&await capability.json().catch(()=>null);
  if(!supported?.durableTasks)throw Error('后端版本过旧，尚未支持生成结果恢复。请重启后端服务后再提交；本次未调用生成模型。');
 }
 const model=models.find(m=>m.id===message.modelId||m.aliases?.includes(message.modelId)),queryIds=message.genTaskIds||(message.genTaskId?[message.genTaskId]:[]);
 let result;
 if(message.genBatchId){const response=await authFetch('/api/generation-tasks/'+encodeURIComponent(message.genBatchId),{signal:AbortSignal.timeout(15000)});result=await response.json();if(!response.ok){if(response.status===404){message.genPending=false;message.genUnknown=true;message.genStatus='结果待确认';}throw Object.assign(Error(result.error||'任务查询暂不可用'),{terminal:response.status===404});}}
 else if(queryIds.length){if(!model?.queryRoute)throw Error('当前模型未提供查询接口');const upstreams=[];for(const id of queryIds){const r=await authFetch('/api/duoyuanx'+model.queryRoute.replace('{task_id}',encodeURIComponent(id)),{signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok)throw Error(data.error?.message||data.error||'任务查询失败');if(!data.id&&!data.task_id&&!data.url&&!data.video_url)data.id=id;upstreams.push(data);}result={upstreams};}
 else{
 message.references=recoverTaskReferences(message,currentConversation?.messages||[]);
 if(!message.references.length&&(/请上传.*(?:图片|参考)|ask_user_files/.test(message.genError||message.referenceError||'')||message.videoMode==='i2i'))throw Error('此旧任务没有保存原图。请重新编辑并重新添加原图，再发送新任务；本次未调用上游。');
  message.genBatchId||=crypto.randomUUID();message.genStartedAt=Date.now();saveSession();
  const body={requestId:message.genBatchId,modelId:model?.id||message.modelId,prompt:message.text,count:Number(message.count)||1,concurrency:Number(message.concurrency)||1,ratio:message.ratio,resolution:message.resolution,duration:message.duration?Number(message.duration):undefined,videoMode:message.videoMode||undefined,operation:message.operation,apiRoute:message.apiRoute};
  body.references=await Promise.all((message.references||[]).map(async r=>{let ref=await prepareMediaReference(r,fileToDataUrl);if(/^https?:/.test(ref.contentUrl)&&['grok-video','gemini-image','gpt-image','grok-image','seedream'].includes(model?.family)){const response=await fetch(ref.contentUrl);if(!response.ok)throw Error('参考素材读取失败');const blob=await response.blob();ref={...ref,type:blob.type||ref.type,contentUrl:await fileToDataUrl(blob)};}return ref;}));
  message.genPending=true;saveSession();let response;try{response=await authFetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});result=await response.json();}catch(e){throw Object.assign(Error('提交回执暂未取得，正在查询原任务'),{submissionUnknown:true});}if(!response.ok){message.genPending=false;message.genBatchId=null;throw Error(result.error||'生成提交失败');}
 }
 if(result.stub||result.ok===false)throw Error(result.error||'生成未接入');
 if(result.task){applyGenerationReceipt(message,result.task);saveSession();for(const url of message.genUrls){try{addGeneratedAsset({kind:message.kind,url,meta:message.modelId});}catch{}await autoDownloadGenerated({...message,genTaskId:null,genUrl:url});}return result;}else{message.genPending=false;message.genBatchId=null;}
 const normalized=normalizeMediaResults(result.task?.upstreams||result.upstreams||result.upstream||result);
 message.genUrls=[...new Set([...((queryIds.length||result.task)?message.genUrls||[]:[]),...normalized.urls])];message.genTaskIds=normalized.taskIds;message.genTaskId=normalized.taskIds[0]||null;message.genUrl=message.genUrls[0]||null;message.genError=normalized.errors.join('；');message.genPollError=result.task?.pollError||'';
 if(!message.genPending&&!message.genUrls.length&&!message.genTaskIds.length)throw Object.assign(Error(message.genError||'上游没有返回素材或任务编号'),{terminal:true});
 message.genStatus=message.genPending||message.genTaskIds.length?'生成中':message.genError?'部分失败':'已完成';
 for(const url of message.genUrls){try{addGeneratedAsset({kind:message.kind,url,meta:message.modelId});}catch{}await autoDownloadGenerated({...message,genTaskId:null,genUrl:url});}
 saveSession();return result;
}const sendLocalDraft=$('#send-prompt').onclick;
$('#send-prompt').onclick=async()=>{if($('#creation-kind').value==='agent')return sendLocalDraft();const button=$('#send-prompt');button.disabled=true;try{const payload={modelId:$('#model').value,prompt:buildPackedPrompt(),count:Number($('#count').value),concurrency:Number($('#concurrency').value),ratio:$('#ratio').value,resolution:$('#resolution').value,duration:Number($('#duration').value),videoMode:$('#video-mode')?.value||undefined,references:await prepareAgentReferences(mentionedAssets())};const response=await authFetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error||'参数校验失败');sendLocalDraft();const msg=currentConversation?.messages?.[currentConversation.messages.length-1];if(msg&&(msg.kind==='video'||msg.kind==='image')){msg.genStatus='生成中';renderConversation();try{await submitMediaGeneration(msg);toast(msg.genStatus);}catch(e){msg.genStatus=e.submissionUnknown?'结果待确认':'生成失败';msg.genError=e.submissionUnknown?'':e.message||'生成失败';msg.genPollError=e.submissionUnknown?e.message:'';toast(e.message);}saveSession();renderConversation();}}catch(e){toast(e.message);}finally{button.disabled=false;}};

// Agent replies come exclusively from the backend; media demo flow is unchanged.
const renderBeforeLiveAgent=renderConversation;
renderConversation=function(){renderBeforeLiveAgent();if(!currentConversation)return;const agentMessages=currentConversation.messages.filter(m=>!m.kind||m.kind==='agent');const replies=conversationLog.querySelectorAll('.conversation-reply');agentMessages.forEach((m,i)=>{if(!m.liveAgent)return;const reply=replies[i];reply.dataset.messageId=m.id||'';reply.dataset.messageCreatedAt=m.createdAt||0;reply.replaceChildren(chatNode('strong','conversation-agent','Zora Agent'),chatNode('p','agent-response-text',m.pending?'正在整理创作方案…':m.error||m.answer));renderAgentProcess(reply,m);if(m.tasks?.length){const card=chatNode('section','conversation-task-card');card.append(chatNode('h3','',`创作任务清单（${m.tasks.length}）`));for(const task of m.tasks){const row=chatNode('div','agent-plan-task');row.append(chatNode('p','',task.prompt),chatNode('small','conversation-meta',`${task.modelId} · ${task.ratio} · ${task.resolution} · ${task.count} 条${task.duration?' · '+task.duration+' 秒':''}`));card.append(row);}if(!m.added)ingestAgentTasks(m,{openTasks:false,applyFirst:true});
const hasReceipt=!!m.generationTaskIds?.length;
const completedUrls=normalizeMediaResults((m.toolTrace||[]).filter(t=>t.name==='submit_generation'||t.name==='call_api').map(t=>t.result)).urls;
for(const url of completedUrls){const isVideo=models.find(model=>model.id===m.tasks?.[0]?.modelId)?.kind==='video';const media=document.createElement(isVideo?'video':'img');if(isVideo)media.controls=true;media.src=url;media.alt='生成结果';media.style.maxWidth='320px';media.style.maxHeight='400px';media.style.objectFit='contain';card.append(media);}
const add=chatNode('button','',m.added?'已加入任务草稿':'加入任务草稿');add.disabled=!!m.added;add.onclick=()=>{ingestAgentTasks(m,{openTasks:true,applyFirst:true});renderConversation();};
const apply=chatNode('button','','应用到创作栏');apply.onclick=()=>{if(m.tasks?.[0])applyDraftToControls(m.tasks[0]);};
const openTasks=chatNode('button','','打开任务清单');openTasks.onclick=()=>{if(!m.added)ingestAgentTasks(m,{openTasks:true,applyFirst:false});else tab('tasks');};
const gen=chatNode('button','',completedUrls.length?'已生成':'按首条任务生成');gen.disabled=hasReceipt||completedUrls.length>0;if(hasReceipt)gen.textContent='已提交 · 结果见生成卡片';gen.onclick=async()=>{const t=m.tasks?.[0];if(!t)return;applyDraftToControls(t);const kind=(models.find(x=>x.id===t.modelId)||{}).kind||'image';const msg={references:[...(m.references||[])],text:t.prompt,kind,modelId:t.modelId,count:t.count,concurrency:t.concurrency,ratio:t.ratio,resolution:t.resolution,duration:t.duration,videoMode:t.videoMode,operation:t.operation,apiRoute:t.apiRoute,genStatus:'生成中'};currentConversation?.messages.push(msg);saveSession();try{await submitMediaGeneration(msg);toast(msg.genStatus);m.genNote=msg.genStatus+(msg.genError?(' · '+msg.genError):'');}catch(e){toast(e.message||'生成失败');}renderConversation();};
card.append(add,apply,openTasks,gen);reply.append(card);}reply.append(chatNode('small','conversation-meta',m.pending?'请等待本次回复完成':m.error?'本次请求未完成，可修改后重试':(m.added?'任务已同步到清单 · 可应用到创作栏或直接生成':'可继续对话 · Agent 可预览任务并提交生成')));if(!m.pending){if(!m.completedAt)m.completedAt=Date.now();reply.append(buildAgentMsgBar(m));}});};
const sendBeforeAgent=$('#send-prompt').onclick;let agentSending=false;
$('#send-prompt').onclick=async()=>{
 if($('#creation-kind').value!=='agent')return sendBeforeAgent();if(agentSending)return;const text=buildInstructionText();if(!text){toast('请先填写创作需求或 @ 素材');return;}
 if(!currentConversation){currentConversation={id:'c-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:text.slice(0,24),messages:[],projectId:currentProjectId,createdAt:Date.now(),updatedAt:Date.now()};conversations.unshift(currentConversation);}else{touchConversation(currentConversation);ensureConversationId(currentConversation);}const conversation=currentConversation;const message={id:crypto.randomUUID(),text,kind:'agent',count:0,meta:'',references:[...(mentionedAssets())],liveAgent:true,pending:true,createdAt:Date.now()};conversation.messages.push(message);$('#prompt').value='';agentSending=true;$('#send-prompt').disabled=true;saveSession();renderConversation();
 try{await Promise.all(message.references.map(r=>saveReference(r)));saveSession();const refs=await prepareAgentReferences(message.references);const response=await authFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:message.id,conversationId:conversation.backendId,modelId:$('#model').value,message:text,skills:selectedSkills.map(s=>({id:s.id,name:s.name,category:s.category,description:s.description,prompt:s.prompt})),references:refs})});const result=await response.json();if(!response.ok)throw Error(result.error||'Agent 请求失败');conversation.backendId=result.conversationId;message.answer=result.reply;message.tasks=result.tasks;message.toolTrace=result.toolTrace;message.reasoningSummary=result.reasoningSummary;attachGenerationReceipts(conversation.messages,message,result.generationTasks,models);}catch(e){message.error=(/failed to fetch|networkerror|load failed/i.test(e.message||'')?'与后端的连接中断，暂未取得任务结果。请先查看任务记录，确认状态后再重试，避免重复提交。':/not implemented/i.test(e.message||'')?'当前模型暂不支持该调用方式，已可切换其他 Agent 模型或重试':(e.message||'连接失败，请重试'));}finally{message.pending=false;message.completedAt=Date.now();agentSending=false;$('#send-prompt').disabled=false;saveSession();renderConversation();}
};
/* directory-capsule-hooks */
const _renderConversationForDirectory=renderConversation;
renderConversation=function(){_renderConversationForDirectory();if(typeof renderDirectory==='function'){renderDirectory();if(!projectsPanel.hidden)renderProjects();}};
document.addEventListener('pointerdown',e=>{
 if(!directoryMenu.hidden&&!directoryMenu.contains(e.target)&&!e.target.closest('#directory-capsule'))closeDirectory();
 if(!projectsPanel.hidden&&!projectsPanel.contains(e.target)&&!e.target.closest('#directory-more'))closeProjects();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDirectory();closeProjects();}});
window.addEventListener('hashchange',()=>{closeDirectory();closeProjects();});
renderDirectory();
if(currentConversation){renderConversation();}

/* composer-collapse-hooks */
(function(){
 const card=$('#prompt-card')||$('.prompt-card.compact-composer');
 if(!card)return;
 const prompt=$('#prompt');
 let manualOpen=false;
 function hasComposerContent(){
  return !!(prompt.value.trim() || (typeof assets!=='undefined' && assets.length>0) || (typeof selectedSkills!=='undefined' && selectedSkills.length));
 }
 function hasConversationMessages(){
  return !!(currentConversation && currentConversation.messages && currentConversation.messages.length);
 }
 function composerPinned(){return hasComposerContent()||hasConversationMessages();}
 function setComposerExpanded(open){
  const expand=open||composerPinned();
  const wasCollapsed=card.classList.contains('composer-collapsed');
  card.classList.toggle('composer-collapsed',!expand);
  card.dataset.composerState=expand?'expanded':'collapsed';
  $('#create')?.classList.toggle('composer-open',expand);
  if(expand&&wasCollapsed){card.classList.add('composer-bounce');setTimeout(()=>card.classList.remove('composer-bounce'),420);}
  if(!expand)manualOpen=false;
 }
 function expandComposer(focusPrompt){
  manualOpen=true;setComposerExpanded(true);
  if(focusPrompt!==false)requestAnimationFrame(()=>prompt.focus({preventScroll:true}));
 }
 function collapseComposer(){if(composerPinned()){setComposerExpanded(true);return;}manualOpen=false;setComposerExpanded(false);}
 window.syncComposerChrome=function(){setComposerExpanded(manualOpen||composerPinned());};
 card.addEventListener('click',e=>{
  if(!card.classList.contains('composer-collapsed'))return;
  if(e.target.closest('#send-prompt')){e.preventDefault();expandComposer(true);return;}
  expandComposer(true);
 });
 prompt.addEventListener('focus',()=>expandComposer(false));
 prompt.addEventListener('input',()=>window.syncComposerChrome());
 document.addEventListener('pointerdown',e=>{
  if(card.classList.contains('composer-collapsed'))return;
  if(card.contains(e.target))return;
  if(e.target.closest('.zora-option-card,.picker-menu,#directory-menu,#projects-panel,#message-panel,#account-menu,#wallet'))return;
  collapseComposer();
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')collapseComposer();});
 const prev=window.renderConversation;
 // keep expanded state in sync when conversation rendering changes
 const wrap=function(){if(typeof prev==='function')prev.apply(this,arguments);window.syncComposerChrome();};
 // only wrap if renderConversation exists
 if(typeof renderConversation==='function'){
  const current=renderConversation;
  renderConversation=function(){current.apply(this,arguments);window.syncComposerChrome();};
 }
 // also sync after asset/skill changes if helpers exist later via MutationObserver on file-list/skills
 const mo=new MutationObserver(()=>window.syncComposerChrome());
 const skills=$('#selected-skills');const files=$('#file-list');
 if(skills)mo.observe(skills,{childList:true,subtree:true});
 if(files)mo.observe(files,{childList:true,subtree:true});
 window.syncComposerChrome();
})();

/* voice-send-logic */
(function(){
 const prompt=$('#prompt');
 const send=$('#send-prompt');
 const voice=$('#voice-prompt');
 const tip=$('#voice-tip');
 if(!prompt||!send||!voice)return;
 function syncSendVisibility(){
  const hasText=!!(typeof buildInstructionText==='function'?buildInstructionText():prompt.value.trim());
  const expanded=!($('#prompt-card')||$('.prompt-card.compact-composer'))?.classList.contains('composer-collapsed');
  // Send when chips and/or typed instruction exist; collapsed never shows send.
  if(!expanded||!hasText) send.hidden=true; else send.hidden=false;
 }
 window.syncSendVisibility=syncSendVisibility;
 prompt.addEventListener('input',()=>{syncSendVisibility();if(typeof syncComposerChrome==='function')syncComposerChrome();});
 const _set=window.syncComposerChrome;
 window.syncComposerChrome=function(){if(typeof _set==='function')_set();syncSendVisibility();};
 // tip on hover/focus
 let tipTimer;
 function showTip(){tip.hidden=false;clearTimeout(tipTimer);tipTimer=setTimeout(()=>{tip.hidden=true;},2400);}
 function hideTip(){tip.hidden=true;clearTimeout(tipTimer);}
 voice.addEventListener('mouseenter',showTip);
 voice.addEventListener('focus',showTip);
 voice.addEventListener('mouseleave',hideTip);
 voice.addEventListener('blur',hideTip);
 // Speech recognition; request mic first, surface real error codes.
 let recognition=null; let listening=false; let stopIntentional=false; let micStream=null;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 function stopListen(){
  listening=false;voice.classList.remove('listening');stopIntentional=true;
  try{recognition?.stop();}catch{}
  if(micStream){try{micStream.getTracks().forEach(t=>t.stop());}catch{} micStream=null;}
  setTimeout(()=>{stopIntentional=false;},80);
 }
 function speechErrorMessage(err){
  const code=String(err||'');
  if(code==='not-allowed'||code==='service-not-allowed')return '麦克风权限被拒绝，请在系统/应用设置中允许麦克风';
  if(code==='no-speech')return '没有听到声音，请靠近麦克风再试';
  if(code==='audio-capture')return '找不到麦克风设备';
  if(code==='network')return '云端听写不可用（Electron/网络限制）。可改用系统输入法语音，或稍后接本地转写';
  if(code==='aborted')return null;
  if(code==='language-not-supported')return '当前环境不支持中文听写';
  return '听写中断（'+code+'），请重试';
 }
 async function ensureMic(){
  if(!navigator.mediaDevices?.getUserMedia)return true;
  try{
   micStream=await navigator.mediaDevices.getUserMedia({audio:true});
   return true;
  }catch(e){
   const name=String(e?.name||e);
   if(/NotAllowed|Permission/i.test(name))toast('麦克风权限被拒绝，请允许后重试');
   else if(/NotFound|DevicesNotFound/i.test(name))toast('找不到麦克风设备');
   else toast('无法打开麦克风：'+name);
   return false;
  }
 }
 async function startListen(){
  if(!SR){toast('当前环境不支持语音听写');showTip();return;}
  if(listening){stopListen();return;}
  if(!(await ensureMic())){showTip();return;}
  if(!recognition){
   recognition=new SR();recognition.lang='zh-CN';recognition.interimResults=true;recognition.continuous=false;
   recognition.onresult=(e)=>{
    let text='';
    for(let i=e.resultIndex;i<e.results.length;i++){text+=e.results[i][0].transcript;}
    if(!text)return;
    const start=prompt.selectionStart??prompt.value.length;
    const end=prompt.selectionEnd??prompt.value.length;
    prompt.setRangeText(text,start,end,'end');
    prompt.dispatchEvent(new Event('input',{bubbles:true}));
    if(typeof syncComposerChrome==='function'){
     const card=$('#prompt-card')||$('.prompt-card.compact-composer');
     card?.classList.remove('composer-collapsed');
     $('#create')?.classList.add('composer-open');
     syncComposerChrome();
    }
    syncSendVisibility();
   };
   recognition.onerror=(ev)=>{
    const code=ev?.error||'unknown';
    if(stopIntentional||code==='aborted'){stopListen();return;}
    stopListen();
    const msg=speechErrorMessage(code);
    if(msg)toast(msg);
   };
   recognition.onend=()=>stopListen();
  }
  listening=true;voice.classList.add('listening');
  try{recognition.start();toast('正在听写…');}catch{stopListen();toast('无法启动听写');}
 }
 voice.addEventListener('click',e=>{e.stopPropagation();startListen();});
 document.addEventListener('keydown',e=>{
  if(e.ctrlKey && (e.key==='d'||e.key==='D')){
   // only when studio visible
   if($('#studio')?.hidden)return;
   e.preventDefault();
   showTip();
   startListen();
  }
 });
 syncSendVisibility();
})();
ensureBackdrops();
window.addEventListener('hashchange',ensureBackdrops);

applyTheme(loadTheme());
const themeBtn=document.getElementById('theme-toggle');
if(themeBtn&&!themeBtn.dataset.wired){themeBtn.dataset.wired='1';themeBtn.onclick=()=>toggleTheme();}

// Restore choices after catalogs and scoped generation parameters are ready.
{
 const prefs=readUIPrefs();
 if(['agent','image','video'].includes(prefs.creationKind)){$('#creation-kind').value=prefs.creationKind;kindChanged();syncPickers();updateModeControls();$('#creation-kind').dataset.prevKind=prefs.creationKind;}
 $('#creation-kind').addEventListener('change',()=>saveUIPref('creationKind',$('#creation-kind').value));
 const motion=$('#reduce-motion');motion.checked=!!prefs.reduceMotion;document.documentElement.classList.toggle('reduce-motion',motion.checked);motion.addEventListener('change',()=>saveUIPref('reduceMotion',motion.checked));
 if(!!prefs.railCollapsed!==$('#studio').classList.contains('rail-collapsed'))$('#rail-toggle').click();
 $('#rail-toggle').addEventListener('click',()=>saveUIPref('railCollapsed',$('#studio').classList.contains('rail-collapsed')));
 for(const id of ['om-tool','om-project']){const field=$('#'+id);if(!field)continue;let restored=false;const restore=()=>{if(restored||!prefs[id]||![...field.options].some(o=>o.value===prefs[id]))return;restored=true;field.value=prefs[id];field.dispatchEvent(new Event('change',{bubbles:true}));};field.addEventListener('change',()=>{restored=true;saveUIPref(id,field.value);});restore();new MutationObserver(restore).observe(field,{childList:true});}
 for(const attr of ['skill-filter','asset-filter']){const buttons=[...document.querySelectorAll('[data-'+attr+']')];buttons.find(b=>b.getAttribute('data-'+attr)===prefs[attr])?.click();for(const button of buttons)button.addEventListener('click',()=>saveUIPref(attr,button.getAttribute('data-'+attr)));}
 for(const id of ['skill-search','canvas-lib-filter']){const field=$('#'+id);if(!field)continue;if(typeof prefs[id]==='string'){field.value=prefs[id];field.dispatchEvent(new Event('input',{bubbles:true}));}field.addEventListener('input',()=>saveUIPref(id,field.value));}
 const radios=[...document.querySelectorAll('input[type=radio][name]')];for(const radio of radios){const group=radios.filter(r=>r.name===radio.name);if(prefs['radio:'+radio.name]===group.indexOf(radio))radio.checked=true;radio.addEventListener('change',()=>{if(radio.checked)saveUIPref('radio:'+radio.name,group.indexOf(radio));});}
 const skillIds=prefs.selectedSkills||[];selectedSkills=skillCatalog.filter(s=>skillIds.includes(s.id));renderSelected();new MutationObserver(()=>saveUIPref('selectedSkills',selectedSkills.map(s=>s.id))).observe($('#selected-skills'),{childList:true});
 for(const id of ['count','concurrency'])$('#'+id).addEventListener('input',()=>saveOptionPrefsForKind());
}

let mediaSyncBusy=false;
async function syncPendingMedia(){
 if(mediaSyncBusy)return;mediaSyncBusy=true;
 try{
  for(const conversation of conversations)for(const message of conversation.messages||[]){
   if(!['image','video'].includes(message.kind)||!(message.genPending||message.genTaskIds?.length||message.genTaskId||(message.genBatchId&&message.genStatus==='生成中')))continue;
   const before=JSON.stringify([message.genStatus,message.genError,message.genPollError,message.genUrls,message.genTaskIds]);
   if(message.genBatchId)message.genPending=true;
   try{await submitMediaGeneration(message);}catch(e){message.genPollError=e.message;if(e.terminal){message.genStatus=message.genUnknown?'结果待确认':'生成失败';message.genError=message.genUnknown?'':e.message;message.genPending=false;}}
   saveSession();if(conversation===currentConversation&&before!==JSON.stringify([message.genStatus,message.genError,message.genPollError,message.genUrls,message.genTaskIds]))renderConversation();
  }
  for(const message of window.__canvasAgentMedia?.()||[]){
   const before=JSON.stringify(message);
   try{await submitMediaGeneration(message);}catch(e){message.genPollError=e.message;if(e.terminal){message.genPending=false;message.genStatus=message.genUnknown?'结果待确认':'生成失败';message.genError=message.genUnknown?'':e.message;}}
   if(before!==JSON.stringify(message))window.__canvasAgentMediaSaved?.();
  }
  for(const {projectId,node:n} of window.__canvasPendingMedia?.()||[]){
   const batchId=n.genBatchId;const message={kind:nodeKind(n),modelId:n.modelId,genBatchId:batchId,genPending:!!batchId,genTaskIds:n.taskIds,genTaskId:n.taskId,genUrls:n.outputUrls};
   try{await submitMediaGeneration(message);const patch={genBatchId:message.genBatchId,genPending:message.genPending,taskIds:message.genTaskIds,taskId:message.genTaskId,outputUrls:message.genUrls,outputUrl:message.genUrls.includes(n.outputUrl)?n.outputUrl:message.genUrl,error:message.genError||message.genPollError,runState:message.genPending||message.genTaskIds.length?'submitted':message.genUrl?'complete':'failed'};window.__canvasApplyStoredMedia?.(projectId,n.id,batchId,patch);}
   catch(e){window.__canvasApplyStoredMedia?.(projectId,n.id,batchId,{error:e.message,...(e.terminal?{runState:'failed',taskId:null,taskIds:[],genPending:false}:{})});}
  }
 }finally{mediaSyncBusy=false;}
}
setInterval(()=>void syncPendingMedia(),5000);
setTimeout(()=>void syncPendingMedia(),1000);
window.addEventListener('online',()=>void syncPendingMedia());

// Opening a conversation jumps instantly to its latest message. Subsequent paints
// preserve the reader's position, including background task and attachment updates.
const renderWithConversationPosition=renderConversation;
window.__zoraConversationContext=()=>({id:currentConversation?.id,conversationId:currentConversation?.backendId});
let lastPositionConversation;
renderConversation=function(...args){
 const position=conversationLog.scrollTop;
 const opening=openAtLatest||lastPositionConversation!==currentConversation?.id;
 renderWithConversationPosition(...args);
 window.dispatchEvent(new Event('zora:conversation-rendered'));
 lastPositionConversation=currentConversation?.id;
 if(!currentConversation)return;
 if(conversationLog.clientHeight===0){openAtLatest=true;return;}
 openAtLatest=false;
 conversationLog.scrollTo({top:opening?conversationLog.scrollHeight:position,behavior:'instant'});
};
renderConversation();

function renderAgentProcess(reply,message){
 const trace=message.toolTrace||[],summaries=message.reasoningSummary||[];
 if(!trace.length&&!summaries.length&&!message.pending)return;
 const panel=chatNode('details','agent-execution-process');
 panel.append(chatNode('summary','',message.pending?'正在处理请求…':`执行过程 · ${trace.length} 次工具调用`));
 if(message.pending)panel.append(chatNode('p','','等待模型回复；工具记录将在本次回复完成后显示。'));
 if(summaries.length){panel.append(chatNode('strong','','思路摘要'));for(const text of summaries)panel.append(chatNode('p','',text));}
 const safe=(value,key='',depth=0)=>{
  if(/token|secret|password|authorization|api.?key/i.test(key))return '[已隐藏]';
  if(depth>5)return '[嵌套内容已省略]';
  if(typeof value==='string')return value.startsWith('data:')?'[原始素材内容已省略]':value.slice(0,1800);
  if(Array.isArray(value))return value.slice(0,12).map(v=>safe(v,'',depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,24).map(([k,v])=>[k,safe(v,k,depth+1)]));
  return value;
 };
 for(const [index,entry] of trace.entries()){
  const item=chatNode('details','agent-tool-step'),failed=entry.result?.ok===false||!!entry.result?.error;
  item.append(chatNode('summary','',`${index+1}. ${entry.name} · ${failed?'返回错误':'已返回'}${Number.isFinite(entry.durationMs)?' · '+(entry.durationMs/1000).toFixed(1)+' 秒':''}`));
  const pre=chatNode('pre','',JSON.stringify(safe({parameters:entry.args,result:entry.result}),null,2));pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto';item.append(pre);panel.append(item);
 }
 reply.append(panel);
}

// Imported personal skills: names in the UI, full documents read by the Agent tool.
fetch('/imported-skills.json').then(r=>{if(!r.ok)throw Error('技能目录读取失败');return r.json();}).then(list=>{for(const skill of list){const index=skillCatalog.findIndex(s=>s.id===skill.id);if(index<0)skillCatalog.push(skill);else skillCatalog[index]=skill;}renderSkills();renderSkillShortcuts();}).catch(e=>console.warn(e.message));

window.addEventListener('zora-runtime-state',event=>{
 const activities=event.detail?.codexActivities||[];let changed=false;
 for(const conversation of conversations){for(const message of conversation.messages||[]){
  const activity=activities.find(a=>a.messageId&&a.messageId===message.id);if(!activity)continue;
  if(conversation.backendId!==activity.conversationId){conversation.backendId=activity.conversationId;changed=true;}
  if(!message.recovering&&!String(message.error||'').includes('上次请求因页面刷新'))continue;
  const text=activity.status==='running'?(activity.retrying?'后台连接异常，正在重试；可使用停止执行按钮。':'后台任务仍在执行，请勿重复发送。'):activity.status==='completed'?'后台执行已完成，请查看下方执行记录和素材结果。':activity.status==='interrupted'?'任务已停止。':activity.error||'后台执行状态待核对，请查看执行记录。';
  if(message.error!==text){message.error=text;message.recovering=activity.status==='running';changed=true;}
 }}
 if(changed){saveSession();renderConversation();}
});

// Reattach persisted source files after the complete UI has initialized.
(async()=>{
 let restored=0,missing=0;
 const references=conversations.flatMap(c=>(c.messages||[]).flatMap(m=>m.references||[]));
 for(const ref of references){if(ref.storageId&&!(ref.file instanceof Blob)){try{if(await restoreReference(ref))restored++;else missing++;}catch{missing++;}}}
 if(restored){renderConversation();}
 if(missing)toast('部分历史原素材未保存在本机；已保存的素材已恢复。');
})();
