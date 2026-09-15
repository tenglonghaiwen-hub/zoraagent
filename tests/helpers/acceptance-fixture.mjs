import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getModels } from '../../packages/duoyuanx/catalog.mjs';
import { createChatService } from '../../apps/server/chat-service.mjs';

// Local-only test service. Never imports server.mjs (which loads the real .env).
export async function startAcceptanceFixture() {
  process.env.ZORA_AGENT_API_KEY = 'acceptance-dummy-not-a-key';
  process.env.ZORA_AGENT_ENABLED = 'true';
  const requests = [], prompts = [];
  let nextFailure = null, delay = 0;
  const makeChat = () => createChatService({run: async (prompt, options) => {
    prompts.push({prompt, modelId: options.modelId, images: options.images});
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    return {reply: '【本地验收模拟】回复 ' + prompts.length, tasks: []};
  }});
  let chat = makeChat();
  const root = fileURLToPath(new URL('../../apps/client/', import.meta.url));
  const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4'};
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const json = (status, data) => {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      if (pathname === '/api/models') return json(200,{models:getModels()});
      if (pathname === '/api/generation-capabilities') return json(200,{durableTasks:true,agentTasksVersion:1});
      if (pathname === '/api/duoyuanx/status') return json(200,{configured:false,routesCount:0});
      if (pathname === '/api/om/status') return json(200,{ok:true,stub:true,origin:'acceptance-mock',localStudioTools:['video_compose']});
      if (pathname === '/api/om/tools') return json(200,{tools:Array.from({length:30},(_,i)=>({name:i?'fixture_tool_'+i:'video_compose',capability:'local_studio'}))});
      if (pathname === '/api/om/projects') return json(200,{projects:Array.from({length:20},(_,i)=>({id:'fixture-'+i,title:'验收项目 '+i}))});
      if (pathname === '/api/chat' && req.method === 'POST') {
        const chunks=[]; for await (const c of req) chunks.push(c);
        const body=JSON.parse(Buffer.concat(chunks)); requests.push(body);
        if (nextFailure) {const f=nextFailure;nextFailure=null;return json(f.status,{error:f.error});}
        try {return json(200,await chat(body));} catch(e) {return json(e.status||502,{error:e.message});}
      }
      if (pathname.startsWith('/api/')) return json(501,{ok:false,stub:true,error:'验收环境禁止真实工具及生成调用'});
      const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
      if (!file.startsWith(root)) return json(404,{});
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    } catch(e) {json(404,{error:'fixture: unavailable'});}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server, port:server.address().port, requests, prompts,
    failNext(status,error) {nextFailure={status,error};},
    setDelay(ms) {delay=ms;}, restartChat() {chat=makeChat();},
    close:()=>new Promise(resolve=>server.close(resolve))};
}
