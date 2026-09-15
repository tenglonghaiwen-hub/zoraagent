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
    const a={id:'fixture-a',name:'验收 A',nodes:[{id:'node-a',type:'free',x:50,y:70,title:'A'}]};
    const b={id:'fixture-b',name:'验收 B',nodes:[{id:'node-b',type:'free',x:70,y:90,title:'B'}]};
    localStorage.setItem('zora.canvases.v1',JSON.stringify([a,b]));
    localStorage.setItem('zora.canvasCurrent.v1',a.id);
    localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(a.nodes));
    localStorage.setItem('zora.workMode.v1','canvas');
  });
  await page.reload();await canvas();
};
const addNode=async()=>{const b=await page.locator('#canvas-board').boundingBox();await page.mouse.dblclick(b.x+320,b.y+180);await page.locator('#canvas-context-menu [data-canvas-node="text"]').click();};
const canvasSend=async text=>{await page.locator('#canvas-agent-input').fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#canvas-agent-send').click();await response;await page.waitForFunction(()=>!document.querySelector('#canvas-agent-send').disabled);};
const mainSend=async text=>{await page.locator('#prompt').fill(text);if(await page.locator('#creation-kind').inputValue()!=='agent'){await page.getByRole('button',{name:'创作类型',exact:true}).click();await page.getByRole('option',{name:'Agent 模式',exact:true}).click();}const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#send-prompt').click();await response;await page.waitForFunction(()=>!document.querySelector('#send-prompt').disabled);};
try{
 await page.waitForLoadState('domcontentloaded');await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','1');location.hash='studio';});await page.reload();await seed();
 await page.evaluate(async()=>{const {models}=await (await fetch('/api/models')).json();const nodes=[{id:'text-a',type:'text',label:'文字',x:70,y:90,prompt:'一只白猫'},{id:'image-b',type:'res-image',label:'图片',x:420,y:90,prompt:'水彩风格',modelId:models.find(m=>m.kind==='image').id,params:{count:2}},{id:'video-c',type:'res-video',label:'视频',x:770,y:90,prompt:'镜头缓慢推进',modelId:'grok-video-3',params:{videoMode:'i2v'}}];const list=JSON.parse(localStorage.getItem('zora.canvases.v1'));list[0].nodes=nodes;localStorage.setItem('zora.canvases.v1',JSON.stringify(list));localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(nodes));});await page.reload();await canvas();
 const at=id=>page.locator('.canvas-node[data-id="'+id+'"]');
 const drag=async(a,b)=>{const x=await a.boundingBox(),y=await b.boundingBox();await page.mouse.move(x.x+x.width/2,x.y+x.height/2);await page.mouse.down();await page.mouse.move(y.x+y.width/2,y.y+y.height/2,{steps:8});assert(await page.locator('.wire-preview').count());await page.mouse.up();};await drag(at('text-a').locator('.port-right'),at('image-b').locator('.port-left'));await drag(at('image-b').locator('.port-right'),at('video-c').locator('.port-left'));assert.equal(await page.locator('.canvas-wires path').count(),2);
 await at('text-a').locator('.canvas-node-body').click();await at('text-a').locator('.node-run').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[0].runState==='complete');assert(fixture.requests.at(-1).channel==='canvas');
 const mediaRequests=[];await page.route('**/api/generate',async route=>{const payload=route.request().postDataJSON();mediaRequests.push(payload);await route.fulfill({json:{upstreams:[{ok:true,upstream:{url:'data:image/png;base64,AA=='}},{ok:true,upstream:{url:payload.modelId==='grok-video-3'?'data:video/mp4;base64,AAAA':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII='}}]}});});
 await at('image-b').locator('.canvas-node-body').click();await at('image-b').locator('.node-run').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[1].runState==='complete');assert.match(mediaRequests[0].prompt,/本地验收模拟/);assert.match(mediaRequests[0].prompt,/水彩/);assert.equal(mediaRequests[0].count,2);const outputs=at('image-b').getByLabel('节点输出素材');assert.equal(await outputs.locator('option').count(),2);await outputs.selectOption({index:1});assert((await readStore('zora.canvasNodes.v1'))[1].outputUrl.includes('iVBOR'));
 await at('video-c').locator('.canvas-node-body').click();await at('video-c').locator('.node-run').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[2].runState==='complete');assert.equal(mediaRequests[1].references.length,1);assert.match(mediaRequests[1].references[0].contentUrl,/^data:image/);
 await page.reload();await canvas();assert.equal(await page.locator('.canvas-wires path').count(),2);assert((await readStore('zora.canvasNodes.v1'))[1].outputUrl);
 await at('text-a').locator('.canvas-node-body').click();fixture.failNext(503,'模拟繁忙');await at('text-a').locator('.node-run').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[0].runState==='failed');assert(!await at('text-a').locator('.node-run').isDisabled());
 await page.route('**/api/generate',route=>route.fulfill({json:{upstream:{id:'mock-video-task',status:'queued'}}}));
 await page.route('**/api/duoyuanx/v1/videos/mock-video-task',route=>route.fulfill({json:{id:'mock-video-task',status:'completed',url:'data:video/mp4;base64,AAAA'}}));
 await at('video-c').locator('.canvas-node-body').click();await at('video-c').locator('.node-run').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[2].runState==='submitted');assert(await at('video-c').locator('.node-run').isDisabled());await at('video-c').getByRole('button',{name:'刷新生成结果'}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[2].runState==='complete'); await at('video-c').locator('.node-run').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[2].runState==='submitted');await page.route('**/api/duoyuanx/v1/videos/mock-video-task',route=>route.fulfill({json:{id:'mock-video-task',status:'failed',error:{message:'模拟远端失败'}}}));await at('video-c').getByRole('button',{name:'刷新生成结果'}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zora.canvasNodes.v1'))[2].runState==='failed');assert(!await at('video-c').locator('.node-run').isDisabled());await page.screenshot({path:path.join(output,'workflow.png')});assert.equal(errors.length,0);console.log(JSON.stringify({passed:true,errors,mediaRequests}));
}finally{await app.close();await fixture.close();}