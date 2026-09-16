import {loadStoredMinimaxKey} from './minimax-credentials.mjs';
import {disabledTools,setToolEnabled} from '../../packages/agent/tool-preferences.mjs';
import {MAIN_AGENT_TOOL_DEFS} from '../../packages/agent/media-subagents.mjs';
import {loadStoredAgentKey} from './agent-credentials.mjs';
import {startCodexKernel} from './codex-agent.mjs';
import {peekKernel} from '../../packages/agent/codex-kernel.mjs';
import { generateBatch } from '../../packages/duoyuanx/generation-service.mjs';
import {createLocalRuntime} from '../../packages/agent/local-runtime.mjs';
import {createWorkspaceArtifacts} from '../../packages/agent/workspace-artifacts.mjs';
import {createWorkflowStore} from '../../packages/agent/workflow-store.mjs';
import { createGenerationTaskStore } from '../../packages/duoyuanx/task-store.mjs';
import { packGenerateRequest } from '../../packages/duoyuanx/generation-adapters.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleDuoyuanxRequest } from '../../packages/duoyuanx/proxy.mjs';
import { validateDraft } from '../../packages/contracts/domain.mjs';
import { getModel } from '../../packages/duoyuanx/catalog.mjs';
import { agentStatus } from './codex-agent.mjs';
import { createChatService } from './chat-service.mjs';
import { AGENT_TOOL_DEFS } from '../../packages/agent/tools.mjs';
import { createLocalApiCaller, listAllowedApis } from '../../packages/agent/api.mjs';
import { openMontageStatus, listProjects as omListProjects, getProject as omGetProject, executeTool as omExecuteTool, startSidecar as omStartSidecar, stopSidecar as omStopSidecar, healthCheck as omHealth, listOmTools, listOmSkills, getOmSkill } from '../../packages/adapters/openmontage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

/** Load DUOYUANX_API_KEY (and friends) from D:\zora\.env / project .env without printing secrets. */
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    return true;
  } catch {
    return false;
  }
}

const envCandidates = [
  process.env.ZORA_ENV_PATH,
  path.join(ROOT, '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '..', '.env'),
].filter(Boolean);

for (const p of envCandidates) loadEnvFile(p);
loadStoredAgentKey(ROOT);
loadStoredMinimaxKey(ROOT);

const PORT = Number(process.env.PORT || 8787);
const CLIENT_DIR = process.env.ZORA_CLIENT_DIR
  || path.resolve(__dirname, '..', 'client')
  || path.resolve(ROOT, 'apps', 'client');

const callApi = createLocalApiCaller({ port: PORT });
const handleChat = createChatService({ callApi, storageDirectory:process.env.ZORA_CHAT_STORE_DIR || path.join(ROOT,'data','chat-sessions') });
let localRuntime,localWorkflows;
function runtime(){return localRuntime ||= createLocalRuntime({directory:path.join(ROOT,'data','local-approvals'),workspaceRoot:process.env.ZORA_WORKSPACE_ROOT||path.join(ROOT,'workspace'),dockerImage:process.env.ZORA_SANDBOX_IMAGE||'node:24-bookworm-slim'});}
function workflows(){return localWorkflows ||= createWorkflowStore({directory:path.join(ROOT,'data','local-workflows'),runtime:runtime()});}
let generationTasks;
function taskStore(){
 if(!generationTasks){const base=(process.env.DUOYUANX_BASE_URL||'https://duoyuanx.com').replace(/\/$/,'');const key=process.env.DUOYUANX_API_KEY||'';
  generationTasks=createGenerationTaskStore({directory:process.env.ZORA_TASK_STORE_DIR||path.join(ROOT,'data','generation-tasks'),getModel,base,key,generate:(draft,model,options)=>generateBatch(draft,model,{base,key,...options})});generationTasks.start();}
 return generationTasks;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}


/** Map catalog resolution labels to exact WIDTHxHEIGHT for OpenAI-style image models. */
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(CLIENT_DIR, rel));
  if (!filePath.startsWith(path.normalize(CLIENT_DIR))) {
    sendJson(res, 403, { error: '禁止访问' });
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if(req.method==='GET'&&(url.pathname==='/api/workspace-files'||url.pathname.startsWith('/api/workspace-files/'))){
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`))return sendJson(res,403,{error:'文件库仅允许本机同源访问'});
      try{
        const artifacts=createWorkspaceArtifacts({workspaceRoot:process.env.ZORA_WORKSPACE_ROOT||path.join(ROOT,'workspace')});
        if(url.pathname==='/api/workspace-files'){
          const ownership=new Map();for(const record of runtime().list({includeDeleted:true}))for(const artifact of record.artifacts||[]){const ids=ownership.get(artifact.id)||new Set();if(record.conversationId)ids.add(record.conversationId);ownership.set(artifact.id,ids);}
          const conversationId=url.searchParams.get('conversationId');
          const files=artifacts.list().map(file=>({...file,conversationIds:[...(ownership.get(file.id)||[])],origins:runtime().list({includeDeleted:true}).filter(r=>(r.artifacts||[]).some(a=>a.id===file.id)).map(r=>({conversationId:r.conversationId,messageId:r.messageId,createdAt:r.createdAt}))}));
          return sendJson(res,200,{files:conversationId?files.filter(file=>file.conversationIds.includes(conversationId)):files});
        }
        const file=artifacts.open(url.pathname.slice('/api/workspace-files/'.length));
        const inline=['image','video','audio','pdf'].includes(file.kind),encoded=encodeURIComponent(file.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
        let start=0,end=file.size-1,status=200;
        if(req.headers.range){const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!range||(!range[1]&&!range[2])){fs.closeSync(file.fd);res.writeHead(416,{'Content-Range':`bytes */${file.size}`});return res.end();}if(!range[1])start=Math.max(0,file.size-Number(range[2]));else start=Number(range[1]);if(range[1]&&range[2])end=Math.min(end,Number(range[2]));if(start>end||start>=file.size){fs.closeSync(file.fd);res.writeHead(416,{'Content-Range':`bytes */${file.size}`});return res.end();}status=206;}
        res.writeHead(status,{'Content-Type':file.mimeType,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encoded}`,'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status===206?{'Content-Range':`bytes ${start}-${end}/${file.size}`}:{})});
        const stream=fs.createReadStream(null,{fd:file.fd,autoClose:true,...(file.size?{start,end}:{})});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
      }catch(e){return sendJson(res,e.status||500,{error:String(e.message||e)});}
    }
    if(url.pathname.startsWith('/api/local-runtime')){
      const address=req.socket.remoteAddress||'';
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))return sendJson(res,403,{error:'本机执行仅允许本机访问'});
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return sendJson(res,403,{error:'拒绝跨来源执行请求'});
      if(url.pathname==='/api/local-runtime/tools'){
        const catalog=[...new Map([...AGENT_TOOL_DEFS,...MAIN_AGENT_TOOL_DEFS].map(t=>[t.name,t])).values()];
        if(req.method==='POST'){if(req.headers['x-zora-approval']!=='user')return sendJson(res,403,{error:'需要用户设置工具'});const body=await readJson(req);setToolEnabled(body.name,body.enabled,catalog.map(t=>t.name));peekKernel()?.loaded.clear();}
        const disabled=disabledTools();return sendJson(res,200,{tools:catalog.map(t=>({name:t.name,description:t.description,enabled:!disabled.has(t.name)}))});
      }
      if(url.pathname==='/api/local-runtime/codex/approval-mode'){
        const kernel=peekKernel();if(!kernel)return sendJson(res,503,{error:'Codex 尚未初始化'});
        if(req.method==='GET')return sendJson(res,200,{mode:kernel.getApprovalMode()});
        if(req.method==='POST'){if(req.headers['x-zora-approval']!=='user')return sendJson(res,403,{error:'需要用户选择审批模式'});const body=await readJson(req);return sendJson(res,200,kernel.setApprovalMode(body.mode));}
      }
      if(req.method==='POST'&&url.pathname==='/api/local-runtime/codex/steer'){const body=await readJson(req);return sendJson(res,200,await peekKernel()?.steer(body.conversationId,body.text));}
      if(req.method==='POST'&&url.pathname==='/api/local-runtime/codex/interrupt'){const body=await readJson(req);return sendJson(res,200,await peekKernel()?.interrupt(body.conversationId));}
      if(req.method==='GET'&&url.pathname==='/api/local-runtime')return sendJson(res,200,{...(await runtime().status()),codexActivities:peekKernel()?.listActivities()||[],requests:[...runtime().list(),...(peekKernel()?.listApprovals()||[])],workflows:workflows().list()});
      if(req.method==='POST'&&url.pathname==='/api/local-runtime/propose')return sendJson(res,200,runtime().propose(await readJson(req)));
      if(req.method==='POST'&&url.pathname==='/api/local-runtime/workflows'){const r=workflows().create(await readJson(req));await workflows().tick();return sendJson(res,200,r);}
      const action=url.pathname.match(/^\/api\/local-runtime\/requests\/([\w-]+)\/(approve|deny|delete|respond|cancel|approve-session)$/);
      if(req.method==='POST'&&action){
        if(req.headers['x-zora-approval']!=='user')return sendJson(res,403,{error:'操作需要用户在审批面板确认'});
        if(action[1].startsWith('codex-'))return sendJson(res,200,peekKernel().decide(action[1],action[2],await readJson(req)));
        if(!['approve','deny','delete'].includes(action[2]))return sendJson(res,400,{error:'此记录不支持该操作'});
        const result=action[2]==='delete'?runtime().deleteRecord(action[1]):action[2]==='approve'?await runtime().approve(action[1]):runtime().deny(action[1]);await workflows().tick();return sendJson(res,200,result);
      }
      return sendJson(res,404,{error:'执行接口不存在'});
    }

    if (await handleDuoyuanxRequest(req, res, url)) return;
    if(req.method==='GET'&&url.pathname==='/api/generation-capabilities')return sendJson(res,200,{durableTasks:true,agentTasksVersion:1});
    const taskMatch=url.pathname.match(/^\/api\/generation-tasks\/([a-zA-Z0-9_-]{16,100})$/);
    if(req.method==='GET'&&taskMatch){const task=taskStore().get(taskMatch[1]);return sendJson(res,task?200:404,task?{task}:{error:'本地任务记录不存在；未重新提交生成'});}

    if (req.method === 'POST' && url.pathname === '/api/preview') {
      const body = await readJson(req);
      const result = validateDraft(body);
      if (!result.ok) return sendJson(res, 400, { error: result.error });
      let packed = null;
      try { packed = packGenerateRequest(result.draft, result.model); } catch {}
      return sendJson(res, 200, {
        draft: result.draft,
        message: result.message,
        packed,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const body = await readJson(req);
      const result = validateDraft(body);
      if (!result.ok) return sendJson(res, 400, { error: result.error });
      let packed;
      try {
        packed = packGenerateRequest(result.draft, result.model);
      } catch (e) {
        return sendJson(res, 400, { error: String(e?.message || e) });
      }
      if (!(result.model.family==='minimax'?process.env.MINIMAX_API_KEY:process.env.DUOYUANX_API_KEY)) {
        return sendJson(res, 503, { error: result.model.family==='minimax'?'未配置 MiniMax 官方 MINIMAX_API_KEY':'未配置 DUOYUANX_API_KEY' });
      }
      const base = (process.env.DUOYUANX_BASE_URL || 'https://duoyuanx.com').replace(/\/$/, '');
      if(body.requestId){try{return sendJson(res,202,{task:taskStore().submit(body.requestId,result.draft,result.model)});}catch(e){return sendJson(res,e.status||500,{error:e.message});}}
      try {
        const results=await generateBatch(result.draft,result.model,{base,key:process.env.DUOYUANX_API_KEY});
        const success=results.filter(r=>r.ok);
        return sendJson(res,success.length?200:502,{draft:result.draft,upstream:results.length===1?results[0].upstream:undefined,upstreams:results,queryRoute:result.model.queryRoute,error:success.length?undefined:results[0]?.error,message:'批次已处理'});      } catch (e) {
        return sendJson(res, 502, { error: String(e?.message || e) });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/agent/status') {
      return sendJson(res, 200, agentStatus());
    }

    if (req.method === 'GET' && url.pathname === '/api/agent/tools') {
      return sendJson(res, 200, {
        foundation: 'codex',
        tools: AGENT_TOOL_DEFS,
        apis: listAllowedApis(),
        note: '工具、技能与 API 白名单；含图片/视频生成代理路径',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const receivedAt=Date.now(),requestTag=`chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      console.log(JSON.stringify({event:'chat-request-start',requestTag,time:new Date().toISOString(),bytes:req.headers['content-length']||null}));
      res.once('close',()=>console.log(JSON.stringify({event:res.writableFinished?'chat-request-finished':'chat-request-disconnected',requestTag,elapsedMs:Date.now()-receivedAt,status:res.statusCode})));
      const body = await readJson(req);
      try {
        const result = await handleChat(body);
        return sendJson(res, 200, result);
      } catch (e) {
        const status = e?.status && Number.isInteger(e.status) ? e.status : 502;
        return sendJson(res, status, {
          error: String(e?.message || e),
          conversationId: body?.conversationId || null,
          reply: '',
          tasks: [],
          foundation: 'codex',
        });
      }
    }


    // --- OpenMontage live sidecar bridge ---
    if (req.method === 'GET' && url.pathname === '/api/om/status') {
      return sendJson(res, 200, openMontageStatus());
    }
    if (req.method === 'GET' && url.pathname === '/api/om/tools') {
      return sendJson(res, 200, listOmTools({
        capability: url.searchParams.get('capability') || undefined,
        q: url.searchParams.get('q') || undefined,
        limit: url.searchParams.get('limit') || undefined,
      }));
    }
    if (req.method === 'GET' && url.pathname === '/api/om/skills') {
      return sendJson(res, 200, listOmSkills({
        category: url.searchParams.get('category') || undefined,
        q: url.searchParams.get('q') || undefined,
        limit: url.searchParams.get('limit') || undefined,
      }));
    }
    {
      const sm = url.pathname.match(/^\/api\/om\/skills\/(.+)$/);
      if (req.method === 'GET' && sm) {
        const result = getOmSkill(decodeURIComponent(sm[1]));
        return sendJson(res, result.ok ? 200 : 404, result);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/om/health') {
      const result = await omHealth();
      return sendJson(res, result.ok ? 200 : 503, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/om/sidecar/start') {
      const body = await readJson(req).catch(() => ({}));
      const result = await omStartSidecar({ force: Boolean(body?.force) });
      return sendJson(res, result.ok ? 200 : 500, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/om/sidecar/stop') {
      const result = await omStopSidecar();
      return sendJson(res, 200, result);
    }
    if (req.method === 'GET' && url.pathname === '/api/om/projects') {
      const result = await omListProjects();
      return sendJson(res, result.ok === false ? (result.status || 503) : 200, result);
    }
    {
      const m = url.pathname.match(/^\/api\/om\/projects\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const result = await omGetProject(decodeURIComponent(m[1]));
        return sendJson(res, result.ok === false ? (result.status || 404) : 200, result);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/om/tools/execute') {
      const body = await readJson(req);
      const result = await omExecuteTool(body?.projectId, body);
      return sendJson(res, result.ok === false ? (result.status || 500) : 200, result);
    }


    if (req.method === 'GET' && serveStatic(req, res, url)) return;

    sendJson(res, 404, { error: '未找到' });
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message || err) });
  }
});

server.on('listening',()=>{if(process.env.DUOYUANX_API_KEY)taskStore();});
let workflowTimer;
server.on('listening',()=>{
 if(fs.existsSync(path.join(ROOT,'data','local-workflows')))workflows();
 workflowTimer=setInterval(()=>{localWorkflows?.tick().catch(e=>console.error('Workflow scheduler:',e.message));},1000);workflowTimer.unref();
});
server.on('listening',()=>{startCodexKernel().catch(e=>console.error('Codex kernel startup:',e.message));});
server.on('close',()=>{peekKernel()?.close();generationTasks?.close();clearInterval(workflowTimer);});
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    const configured = Boolean(process.env.DUOYUANX_API_KEY);
    const agent = agentStatus();
    console.log(`Zora server listening on http://127.0.0.1:${PORT}`);
    console.log(`DUOYUANX_API_KEY configured: ${configured}`);
    console.log(`Agent Codex: configured=${agent.configured} enabled=${agent.enabled} backend=${agent.backend}`);
    console.log(`client dir: ${CLIENT_DIR}`);
  });
}

export { server, loadEnvFile, packGenerateRequest };
