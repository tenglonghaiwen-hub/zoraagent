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
 const result=await page.evaluate(async()=>{
  const {interactionForm,pruneInteractionForms}=await import('/codex-interactions.js');const calls=[];
  const record={id:'ui-test',status:'pending',interaction:'questions',params:{questions:[{id:'q',question:'Choose',options:[{label:'A',description:'First'},{label:'B',description:'Second'}],isOther:false}]}};
  const form=interactionForm(record,async(...args)=>calls.push(args));document.body.append(form);form.querySelector('select').value='B';
  if(interactionForm(record,()=>{})!==form)throw Error('form replaced');
  form.querySelector('button').click();await Promise.resolve();
  pruneInteractionForms([]);if(interactionForm(record,()=>{})===form)throw Error('form not pruned');
  const mcp=interactionForm({id:'json',interaction:'mcp',params:{mode:'form',requestedSchema:{type:'object',properties:{data:{type:'object'}},required:['data']}}},async(...args)=>calls.push(args));document.body.append(mcp);mcp.querySelector('textarea').value='{"nested":1}';mcp.querySelector('button').click();await Promise.resolve();
  const {mountRuntimePanel}=await import('/runtime-panel.js');const root=document.createElement('div');document.body.append(root);window.__zoraConversationContext=()=>({conversationId:'dock-test'});let log=document.querySelector('.conversation-log');if(!log){log=document.createElement('div');log.className='conversation-log';document.body.append(log);}
  const panel=mountRuntimePanel(root,{fetchImpl:async url=>({ok:true,json:async()=>url.includes('approval-mode')?{mode:'smart'}:url.includes('workspace-files')?{files:[]}:{requests:[{...record,engine:'codex',conversationId:'dock-test',params:{...record.params,reason:'需要确认操作'},request:{kind:'Codex command',command:'C:/long/private/path'}}]}})});await panel.refresh();await new Promise(r=>setTimeout(r,100));const dock=[...document.querySelectorAll('#approval-dock')].at(-1);if(dock.hidden||getComputedStyle(dock).position!=='fixed'||!dock.textContent.includes('需要确认操作'))throw Error('Approval dock not fixed and visible');if(dock.closest('.conversation-log'))throw Error('Dock inside scrolling history');panel.dispose();
  await import('/appearance.js');const chooser=document.querySelector('#settings [data-choose]');if(!chooser)throw Error('Wallpaper setting missing');const motion=document.getElementById('reduce-motion');document.documentElement.classList.add('reduce-motion');await new Promise(r=>setTimeout(r,50));if([...document.querySelectorAll('video.backdrop')].some(v=>!v.paused))throw Error('Background still playing with reduced motion');
  return calls.map(c=>({action:c[1],payload:c[2]}));
 });
 assert.equal(result[0].payload.answers.q.answers[0],'B');assert.deepEqual(result[1].payload.content,{data:{nested:1}});console.log(JSON.stringify({ok:true,ui:'Electron',checks:['form preserved','answers submitted','resolved form cleared','nested JSON input']}));
}finally{await app.close();await fixture.close();}
