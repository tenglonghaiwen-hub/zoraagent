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
    results.push({name,status:'failed',error:e.message,layout});console.log('FAIL '+name+' '+e.message.split('\n').slice(0,3).join(' '));assert.equal(await page.getByLabel('视频比例',{exact:true}).inputValue(),'9:16');await page.screenshot({path:path.join(output,'failure-'+results.length+'.png')}).catch(()=>{});
  }
};
const canvas=()=>page.locator('[data-work-mode="canvas"]').click();
const agent=()=>page.locator('[data-work-mode="agent"]').click();
const seed=async()=>{
  await page.evaluate(()=>{
    const a={id:'fixture-a',name:'验收 A',nodes:[{id:'node-a',type:'free',x:50,y:70,title:'A'}]};
    const b={id:'fixture-b',name:'验收 B',nodes:[{id:'node-b',type:'free',x:70,y:90,title:'B'}]};
    localStorage.setItem('zora.canvases.v1',JSON.stringify([a,b]));
    localStorage.setItem('zora.canvasCurrent.v1',a.id);
    localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(a.nodes));
    localStorage.setItem('zora.workMode.v1','canvas');
  });
  await page.reload();await canvas();
};
const addNode=async()=>{const b=await page.locator('#canvas-board').boundingBox();await page.mouse.dblclick(b.x+320,b.y+180);};
const canvasSend=async text=>{await page.locator('#canvas-agent-input').fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#canvas-agent-send').click();await response;await page.waitForFunction(()=>!document.querySelector('#canvas-agent-send').disabled);};
const mainSend=async text=>{await page.locator('#prompt').fill(text);if(await page.locator('#creation-kind').inputValue()!=='agent'){await page.getByRole('button',{name:'创作类型',exact:true}).click();await page.getByRole('option',{name:'Agent 模式',exact:true}).click();}const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#send-prompt').click();await response;await page.waitForFunction(()=>!document.querySelector('#send-prompt').disabled);};
try {
 await page.waitForLoadState('domcontentloaded');await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','1');location.hash='studio';});await page.reload();await seed();
 await page.evaluate(()=>{const nodes=[{id:'image-test',type:'res-video',label:'图片',x:340,y:110}];const list=JSON.parse(localStorage.getItem('zora.canvases.v1'));list[0].nodes=nodes;localStorage.setItem('zora.canvases.v1',JSON.stringify(list));localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(nodes));});await page.reload();await canvas();
 await page.locator('.canvas-node-body').click();await page.getByRole('textbox',{name:'视频节点描述'}).fill('本地图片描述保存验证');
 assert.equal((await readStore('zora.canvasNodes.v1'))[0].prompt,'本地图片描述保存验证');
 await page.locator('.canvas-image-node input[type=file]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=','base64')});await page.locator('.canvas-node-body img').waitFor();
 await page.getByLabel('视频比例',{exact:true}).selectOption('9:16'); await page.locator('[data-copy]').click();assert.equal(await page.locator('.canvas-image-node').count(),2);await page.reload();await canvas();assert.equal(await page.locator('.canvas-image-node').count(),2);await page.locator('.canvas-node-body').first().click();assert.equal(await page.getByRole('textbox',{name:'视频节点描述'}).inputValue(),'本地图片描述保存验证');assert.equal(await page.getByLabel('视频比例',{exact:true}).inputValue(),'9:16');await page.screenshot({path:path.join(output,'image-node.png')});console.log(JSON.stringify({passed:true,errors,blocked}));
} finally {await app.close();await fixture.close();}