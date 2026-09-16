import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/interaction-ui-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges'),OM_AUTO_SIDECAR:'false',ZORA_AGENT_API_KEY:'test-only',DUOYUANX_API_KEY:'',RUNNINGHUB_API_KEY:''};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 await page.route('**/api/local-runtime/tools',route=>route.fulfill({json:{tools:[{name:'browser_read',description:'读取网页',enabled:true}]}}));await page.locator('#zora-tool-settings > summary').evaluate(e=>e.click());await page.locator('#zora-tool-settings input[type=checkbox]').waitFor({state:'attached'});await page.locator('#zora-tool-settings input[type=checkbox]').evaluate(e=>e.click());assert.equal(await page.locator('#zora-tool-settings input[type=checkbox]').isChecked(),false);
 await page.route('**/api/local-runtime',route=>route.fulfill({json:{requests:[],codexActivities:[{threadId:'retry-test',conversationId:'dock-test',status:'running',retrying:true,errors:[{at:new Date().toISOString(),message:'stream disconnected',willRetry:true}]}]}}));
 await app.evaluate(({app},directory)=>app.setPath('downloads',directory),output);const saved=await page.evaluate(()=>window.zoraDesktop.downloadMedia('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','zora-download-test.png'));assert.equal(saved.ok,true);assert.ok((await fs.stat(saved.path)).size>0);
 const result=await page.evaluate(async()=>{
  const {interactionForm,pruneInteractionForms}=await import('/codex-interactions.js');const calls=[];
  const record={id:'ui-test',status:'pending',interaction:'questions',params:{questions:[{id:'q',question:'Choose',options:[{label:'A',description:'First'},{label:'B',description:'Second'}],isOther:false}]}};
  const form=interactionForm(record,async(...args)=>calls.push(args));document.body.append(form);form.querySelector('select').value='B';
  if(interactionForm(record,()=>{})!==form)throw Error('form replaced');
  form.querySelector('button').click();await Promise.resolve();
  pruneInteractionForms([]);if(interactionForm(record,()=>{})===form)throw Error('form not pruned');
  const mcp=interactionForm({id:'json',interaction:'mcp',params:{mode:'form',requestedSchema:{type:'object',properties:{data:{type:'object'}},required:['data']}}},async(...args)=>calls.push(args));document.body.append(mcp);mcp.querySelector('textarea').value='{"nested":1}';mcp.querySelector('button').click();await Promise.resolve();
  const {mountRuntimePanel}=await import('/runtime-panel.js');const root=document.createElement('div');document.body.append(root);window.__zoraConversationContext=()=>({conversationId:'dock-test'});let log=document.querySelector('.conversation-log');if(!log){log=document.createElement('div');log.className='conversation-log';document.body.append(log);}
  const panel=mountRuntimePanel(root,{fetchImpl:async url=>({ok:true,json:async()=>url.includes('approval-mode')?{mode:'smart'}:url.includes('workspace-files')?{files:[]}:{codexActivities:[{threadId:'retry-test',conversationId:'dock-test',status:'running',retrying:true,errors:[{at:new Date().toISOString(),message:'stream disconnected',willRetry:true}]}],requests:[{...record,engine:'codex',conversationId:'dock-test',params:{...record.params,reason:'需要确认操作'},request:{kind:'Codex command',command:'C:/long/private/path'}}]}})});await panel.refresh();await new Promise(r=>setTimeout(r,100));const dock=[...document.querySelectorAll('#approval-dock')].at(-1);if(dock.hidden||getComputedStyle(dock).position!=='fixed'||!dock.textContent.includes('需要确认操作'))throw Error('Approval dock not fixed and visible');if(dock.closest('.conversation-log'))throw Error('Dock inside scrolling history');if(!log.textContent.includes('连接异常，正在重试')||!log.textContent.includes('stream disconnected'))throw Error('Retry missing: '+log.textContent.slice(-1500)+' context='+JSON.stringify(window.__zoraConversationContext?.()));const stop=[...log.querySelectorAll('button')].find(b=>b.textContent==='停止执行');if(!stop||stop.closest('details'))throw Error('Stop button hidden in details');panel.dispose();
  return calls.map(c=>({action:c[1],payload:c[2]}));
 });
 assert.equal(result[0].payload.answers.q.answers[0],'B');assert.deepEqual(result[1].payload.content,{data:{nested:1}});console.log(JSON.stringify({ok:true,ui:'Electron',checks:['form preserved','answers submitted','resolved form cleared','nested JSON input']}));
}finally{await app.close();await fixture.close();}
