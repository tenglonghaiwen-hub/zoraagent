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
const app=await _electron.launch({executablePath:path.join(root,'apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.join(root,'apps/desktop'),'--user-data-dir='+path.join(output,'profile-'+Date.now())],env:launchEnv});
const page=await app.firstWindow();
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
try{
 await page.waitForLoadState('domcontentloaded');await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','1');location.hash='studio';});await page.reload();await seed();
 assert(await page.evaluate(()=>CSS.supports('appearance','base-select')),'Electron must support customizable native select');
 await page.evaluate(()=>{const list=JSON.parse(localStorage.getItem('zora.canvases.v1'));list[0].nodes=[{id:'dropdown-node',type:'res-video',label:'视频',modelId:'grok-video-3',x:330,y:30,prompt:'下拉框样式验收'}];localStorage.setItem('zora.canvases.v1',JSON.stringify(list));localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(list[0].nodes));});await page.reload();await canvas();
 const node=page.locator('.canvas-node[data-id="dropdown-node"]');await node.locator('.canvas-node-body').click();
 const checkTheme=async theme=>{
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').click();
  const native=page.getByLabel('节点模型',{exact:true});await native.click();
  const values=await native.evaluate(el=>({native:getComputedStyle(el).backgroundColor,menu:getComputedStyle(el,'::picker(select)').backgroundColor,radius:getComputedStyle(el).borderRadius,height:getComputedStyle(el).height,appearance:getComputedStyle(el).appearance}));
  assert.equal(values.appearance,'base-select');assert.equal(values.radius,'9px');assert.equal(values.height,'34px');
  await page.screenshot({path:path.join(output,theme+'-node-dropdown.png')});
  const zoom=await page.locator('#canvas-zoom-label').textContent();await page.mouse.wheel(0,300);assert.equal(await page.locator('#canvas-zoom-label').textContent(),zoom);await page.keyboard.press('Escape');
  await page.locator('#canvas-agent-model-trigger').click();
  const custom=await page.locator('#canvas-agent-model-trigger').evaluate(el=>({control:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius,height:getComputedStyle(el).height,menu:getComputedStyle(document.querySelector('#canvas-agent-model-menu')).backgroundColor}));
  assert.equal(custom.control,values.native);assert.equal(custom.menu,values.menu);assert.equal(custom.radius,values.radius);assert.equal(custom.height,values.height);
  await page.screenshot({path:path.join(output,theme+'-agent-dropdown.png')});await node.locator('textarea').click();return {theme,...values};
 };
 const themes=[await checkTheme('day'),await checkTheme('night')];assert.notEqual(themes[0].menu,themes[1].menu);
 const ratio=page.getByLabel('节点比例',{exact:true});await ratio.click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');const chosen=await ratio.inputValue();assert.equal(chosen,'9:16');
 await page.reload();await canvas();await node.locator('.canvas-node-body').click();assert.equal(await page.getByLabel('节点比例',{exact:true}).inputValue(),chosen);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,760));await page.getByLabel('节点模型',{exact:true}).click();await page.screenshot({path:path.join(output,'compact-dropdown.png')});await page.keyboard.press('Escape');
 assert.equal(errors.length,0);await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,themes,keyboardSelection:chosen,persisted:true,errors},null,2));console.log('PASS dropdown palette, day/night, keyboard selection, persistence and wheel isolation');
}finally{await app.close();await fixture.close();}
