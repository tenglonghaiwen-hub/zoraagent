import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startAcceptanceFixture } from '../tests/helpers/acceptance-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.env.ZORA_ACCEPTANCE_OUTPUT||path.join(root,'outputs','acceptance-'+Date.now()));
await mkdir(output,{recursive:true});
const require=createRequire(path.join(process.env.ZORA_TEST_NODE_MODULES||'C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules','../package.json'));
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const launchEnv={...process.env,PORT:String(fixture.port),OM_AUTO_SIDECAR:'false',ZORA_AGENT_API_KEY:'acceptance-dummy-not-a-key',DUOYUANX_API_KEY:'',RUNNINGHUB_API_KEY:''};
delete launchEnv.ELECTRON_RUN_AS_NODE;
let app=await _electron.launch({executablePath:path.join(root,'apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.join(root,'apps/desktop'),'--user-data-dir='+path.join(output,'profile-'+Date.now())],env:launchEnv});
let page=await app.firstWindow();
page.setDefaultTimeout(5000);
const errors=[],results=[],blocked=[];
page.on('pageerror',e=>errors.push(e.message));
await page.context().route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&Number(u.port)===fixture.port||['data:','blob:'].includes(u.protocol))return route.continue();blocked.push(u.origin);return route.abort();});
const readStore=key=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
const test=async(name,fn)=>{
  if(process.env.ZORA_ACCEPTANCE_ONLY&&!new RegExp(process.env.ZORA_ACCEPTANCE_ONLY).test(name))return;
  try{await fn();results.push({name,status:'passed'});console.log('PASS '+name);}
  catch(e){
    const layout=await page.evaluate(()=>['#studio','.workspace','#create','.create-layout','.creation','#agent-workspace','.conversation-log','#work-mode-switch','#prompt-card'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return {s,rect:e.getBoundingClientRect().toJSON(),scrollTop:e.scrollTop,height:c.height,minHeight:c.minHeight,flex:c.flex,overflow:c.overflow,position:c.position,justify:c.justifyContent,padding:c.padding};}));
    results.push({name,status:'failed',error:e.message,layout});console.log('FAIL '+name+' '+e.message.split('\n').slice(0,3).join(' '));await page.screenshot({path:path.join(output,'failure-'+results.length+'.png')}).catch(()=>{});
  }
};
const canvas=()=>page.locator('[data-work-mode="canvas"]').click();
const agent=()=>page.locator('[data-work-mode="agent"]').click();
const seed=async()=>{
  await page.evaluate(()=>{
    const prefs=JSON.parse(localStorage.getItem('zora.uiPrefs.v1')||'{}');prefs['canvas-lib-filter']='';localStorage.setItem('zora.uiPrefs.v1',JSON.stringify(prefs));
    const a={id:'fixture-a',name:'验收 A',nodes:[{id:'node-a',type:'free',x:50,y:70,title:'A'}]};
    const b={id:'fixture-b',name:'验收 B',nodes:[{id:'node-b',type:'free',x:70,y:90,title:'B'}]};
    localStorage.setItem('zora.canvases.v1',JSON.stringify([a,b]));
    localStorage.setItem('zora.canvasCurrent.v1',a.id);
    localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(a.nodes));
    localStorage.setItem('zora.workMode.v1','canvas');
  });
  await page.reload();await canvas();
};
const addNode=async()=>{const b=await page.locator('#canvas-board').boundingBox();await page.mouse.dblclick(b.x+600,b.y+400);await page.locator('#canvas-context-menu [data-canvas-node="text"]').click();};
const canvasSend=async text=>{await page.locator('#canvas-agent-input').fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#canvas-agent-send').click();await response;await page.waitForFunction(()=>!document.querySelector('#canvas-agent-send').disabled);};
const mainSend=async text=>{await page.locator('#prompt').fill(text);if(await page.locator('#creation-kind').inputValue()!=='agent'){await page.getByRole('button',{name:'创作类型',exact:true}).click();await page.getByRole('option',{name:'Agent 模式',exact:true}).click();}const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#send-prompt').click();await response;await page.waitForFunction(()=>!document.querySelector('#send-prompt').disabled);};
const {createGenerationTaskStore}=await import('../packages/duoyuanx/task-store.mjs');
const {getModel}=await import('../packages/duoyuanx/catalog.mjs');
const {randomUUID}=await import('node:crypto');
const profile=await app.evaluate(({app})=>app.getPath('userData'));
let submissions=0,ready=false;
const storeOptions={directory:path.join(output,'ledger'),getModel,base:'https://mock.invalid',key:'fake',pollInterval:100,
 generate:async(d,m,{onResult})=>{submissions++;const result={ok:true,upstream:{task_id:'mock-'+submissions}};onResult(0,result);return [result];},
 fetchImpl:async url=>({ok:true,json:async()=>ready?{status:'succeeded',content:{video_url:'data:video/mp4;base64,'+Buffer.from(url).toString('base64')}}:{status:'running'}})};
let store=createGenerationTaskStore(storeOptions);store.start();
const install=async()=>{
 page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();});
 await page.route('**/api/generate',async route=>{const body=route.request().postDataJSON();const task=store.submit(body.requestId,body,getModel(body.modelId));await route.fulfill({status:202,json:{task}});});
 await page.route('**/api/generation-tasks/*',route=>{const task=store.get(route.request().url().split('/').at(-1));return route.fulfill({status:task?200:404,json:task?{task}:{error:'missing'}});});
};
try{
 await install();await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','1');location.hash='studio';});await page.reload();await seed();
 await page.evaluate(()=>{const projects=JSON.parse(localStorage.getItem('zora.canvases.v1'));projects[0].nodes=[{id:'recover-node',type:'res-video',label:'恢复测试',x:100,y:100,prompt:'本地模拟视频',modelId:'doubao-seedance-2-0-mini',params:{videoMode:'t2v',duration:5,resolution:'720P'}}];localStorage.setItem('zora.canvases.v1',JSON.stringify(projects));localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(projects[0].nodes));});await page.reload();await canvas();
 await page.locator('.canvas-node[data-id="recover-node"] .canvas-node-body').click();await page.locator('.canvas-node[data-id="recover-node"] .node-run').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[0].runState==='submitted');
 const mainId=randomUUID(),inactiveId=randomUUID();const draft={modelId:'doubao-seedance-2-0-mini',prompt:'mock',count:1,concurrency:1};store.submit(mainId,draft,getModel(draft.modelId));store.submit(inactiveId,draft,getModel(draft.modelId));
 await page.evaluate(({mainId,inactiveId})=>{const projects=JSON.parse(localStorage.getItem('zora.canvases.v1'));projects[1].nodes=[{id:'inactive-node',type:'res-video',modelId:'doubao-seedance-2-0-mini',runState:'submitted',genBatchId:inactiveId}];localStorage.setItem('zora.canvases.v1',JSON.stringify(projects));localStorage.setItem('zora.session.v1',JSON.stringify({v:1,projects:[{id:'p',name:'测试'}],currentProjectId:'p',currentConversationId:'conversation-recovery',conversations:[{id:'conversation-recovery',projectId:'p',title:'恢复测试',messages:[{kind:'video',modelId:'doubao-seedance-2-0-mini',text:'恢复测试',count:1,genBatchId:mainId,genPending:true,genStatus:'生成中'}]}]}));},{mainId,inactiveId});
 await page.reload();await page.waitForLoadState('domcontentloaded');
 // Close the entire isolated Electron process, rebuild the backend ledger, and reopen the same profile.
 await app.close();store.close();ready=true;store=createGenerationTaskStore(storeOptions);store.start();
 app=await _electron.launch({executablePath:path.join(root,'apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.join(root,'apps/desktop'),'--user-data-dir='+profile],env:launchEnv});page=await app.firstWindow();await install();await page.reload();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.session.v1')).conversations[0].messages[0].genStatus==='已完成',null,{timeout:15000});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvases.v1')).every(p=>p.nodes[0].runState==='complete'),null,{timeout:15000});
 assert.equal(submissions,3);const saved=await readStore('zora.canvases.v1');assert(saved.every(p=>p.nodes[0].outputUrl?.startsWith('data:video')));assert.equal(errors.length,0);
 await page.screenshot({path:path.join(output,'recovered.png')});await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,submissions,errors,mainRecovered:true,currentCanvasRecovered:true,inactiveCanvasRecovered:true,fullElectronRestart:true},null,2));console.log('PASS full Electron restart, current/inactive canvas and conversation recover with no resubmission');
}catch(e){await writeFile(path.join(output,'failure-state.json'),JSON.stringify({error:e.message,canvases:await readStore('zora.canvases.v1'),nodes:await readStore('zora.canvasNodes.v1'),session:await readStore('zora.session.v1'),errors},null,2));throw e;}finally{store.close();await app.close();await fixture.close();}
