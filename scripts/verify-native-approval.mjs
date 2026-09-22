import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
import {createWorkflowStore} from '../packages/agent/workflow-store.mjs';
import {handleLocalRuntimeRoutes} from '../apps/server/routes/local-runtime.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-approval-ui-'));
const runtime=createLocalRuntime({directory:path.join(root,'approvals'),workspaceRoot:path.join(root,'workspace'),backend:'native'});
const workflows=createWorkflowStore({directory:path.join(root,'workflows'),runtime});
const sendJson=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/local-runtime')) return void await handleLocalRuntimeRoutes(req,res,url,{sendJson,readJson:async r=>{let s='';for await(const c of r)s+=c;return JSON.parse(s||'{}');},runtime:()=>runtime,workflows:()=>workflows});
  if(url.pathname==='/api/workspace-files') return sendJson(res,200,{files:[]});
  if(url.pathname==='/') {res.setHeader('Content-Type','text/html');res.end('<div class="conversation-log"></div><div id="prompt-card" style="height:100px"></div><div id="panel"></div><script type="module">window.__zoraConversationContext=()=>({conversationId:"test"});const {mountRuntimePanel}=await import("/runtime-panel.js");window.panel=mountRuntimePanel(document.querySelector("#panel"));</script>');return;}
  const name=url.pathname.slice(1);if(!/^[\w-]+\.js$/.test(name))return res.writeHead(404).end();
  res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.resolve('apps/client',name)));
 } catch(e) {sendJson(res,500,{error:e.message});}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:path.resolve('vendor/openmontage/runtime/hyperframes/browser/chrome-headless-shell-win64/chrome-headless-shell.exe'),headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const propose=command=>runtime.propose({kind:'exec',runtime:'node',command,conversationId:'test'});
 const denied=propose("require('fs').writeFileSync('denied.txt','bad')");
 await page.goto('http://127.0.0.1:'+server.address().port);
 const modal=page.locator('dialog');await modal.waitFor({state:'visible'});
 await modal.getByRole('button',{name:'拒绝',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog').open);
 await page.waitForTimeout(300);assert.equal(runtime.list().find(r=>r.id===denied.id).status,'denied');assert.equal(fs.existsSync(path.join(root,'workspace/denied.txt')),false);
 const pending=propose("console.log('approved')");await page.evaluate(()=>window.panel.refresh());
 await modal.getByRole('button',{name:'稍后处理'}).click();await page.evaluate(()=>window.panel.refresh());assert.equal(await modal.isVisible(),false);assert.equal(runtime.list().find(r=>r.id===pending.id).status,'pending');
 await page.getByRole('button',{name:'批准并执行此操作',exact:true}).click();await page.waitForTimeout(500);assert.equal(runtime.list().find(r=>r.id===pending.id).status,'completed');
 const running=propose('setInterval(()=>{},1000)');await page.evaluate(()=>window.panel.refresh());await modal.getByRole('button',{name:'允许本次'}).click();
 await page.waitForTimeout(200);await page.evaluate(()=>window.panel.refresh());await page.getByRole('button',{name:'中止脚本',exact:true}).click();await page.waitForTimeout(600);
 assert.equal(runtime.list().find(r=>r.id===running.id).status,'failed');assert.match(runtime.list().find(r=>r.id===running.id).error,/中止/);
 const other=propose('console.log(9)');await page.evaluate(()=>{window.__zoraConversationContext=()=>({conversationId:'other'});return window.panel.refresh();});assert.equal(await modal.isVisible(),false);assert.equal(runtime.list().find(r=>r.id===other.id).status,'pending');
 assert.deepEqual(errors,[]);console.log('PASS: real HTTP approval, deny, dismiss, inline approve, cancel, conversation isolation');
} finally {await browser.close();await new Promise(r=>server.close(r));}
