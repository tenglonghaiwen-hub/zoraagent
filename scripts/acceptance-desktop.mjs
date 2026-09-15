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
const launchEnv={...process.env,PORT:String(fixture.port),ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges'),OM_AUTO_SIDECAR:'false',ZORA_AGENT_API_KEY:'acceptance-dummy-not-a-key',DUOYUANX_API_KEY:'',RUNNINGHUB_API_KEY:''};
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
try {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','1');location.hash='studio';});
  await page.reload();
  await page.locator('#studio').waitFor({state:'visible'});
  await test('single drop registers once and only explicit mentions are sent',async()=>{
    await agent();await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([1,2,3])],'drop.png',{type:'image/png',lastModified:1}));document.querySelector('#prompt').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));});
    assert.equal(await page.locator('.reference-item').count(),1);assert.equal(await page.locator('#prompt').inputValue(),'');
    let pending=page.waitForRequest(r=>r.url().endsWith('/api/chat'));await mainSend('只发送文字');let body=(await pending).postDataJSON();assert.equal((body.references||[]).length,0);
    pending=page.waitForRequest(r=>r.url().endsWith('/api/chat'));await mainSend('@图片1 查看素材');body=(await pending).postDataJSON();assert.equal(body.references.length,1);
  });
  await test('composer grows before scroll and retains inline mentions',async()=>{
    await agent();const input=page.locator('#prompt');await input.fill('文字 @图片1 后续文字\n第二行');
    const short=await input.evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,top:e.scrollTop}));assert(short.scroll<=short.height+1);await input.hover();await page.mouse.wheel(0,100);assert.equal(await input.evaluate(e=>e.scrollTop),0);assert.match(await input.inputValue(),/文字 @图片1 后续文字/);
    await input.fill(Array(30).fill('一行文字').join('\n'));assert(await input.evaluate(e=>e.scrollHeight>e.clientHeight));await input.fill('');
  });
  await test('startup does not falsely report catalog failure',async()=>{assert(!/模型目录加载失败|模型配置暂不可用/.test(await page.locator('#toast').textContent()));});
  await test('canvas switch and visible toolbar',async()=>{await canvas();assert(await page.locator('#canvas-board').isVisible());assert(await page.locator('.account-toolbar').isVisible());});
  await test('collapse and expand rail',async()=>{await page.locator('#canvas-agent-hide').click();assert(!await page.locator('.canvas-agent-rail').isVisible());await page.locator('#canvas-agent-show').click();assert(await page.locator('.canvas-agent-rail').isVisible());});
  await test('library open enters a visible canvas',async()=>{await seed();await page.locator('#rail-canvases').click();await page.locator('.canvas-lib-item').filter({hasText:'验收 B'}).locator('[data-act="open"]').click();assert(await page.locator('#canvas-board').isVisible());assert.equal(await page.locator('#canvas-project-name').textContent(),'验收 B');});
  await test('library new enters a visible empty canvas',async()=>{await seed();await page.locator('#rail-canvases').click();await page.locator('#canvas-lib-new').click();assert(await page.locator('#canvas-board').isVisible());assert.equal((await readStore('zora.canvasNodes.v1')).length,0);});
  await test('immediate reload preserves latest nodes in project',async()=>{await seed();await addNode();const ids=(await readStore('zora.canvasNodes.v1')).map(n=>n.id);assert.equal(ids.length,2);await page.reload();await canvas();assert.deepEqual((await readStore('zora.canvases.v1')).find(c=>c.id==='fixture-a').nodes.map(n=>n.id),ids);});
  await test('undo after new project cannot import previous project nodes',async()=>{await seed();await addNode();await page.locator('#canvas-project-new').click();await page.locator('#canvas-undo').click();assert.equal((await readStore('zora.canvasNodes.v1')).length,0);});
  await test('deleting active canvas preserves surviving project',async()=>{
    await seed();
    // Only the isolated fixture-a localStorage record is deleted; no files or user data.
    await page.locator('#canvas-project-del').click();
    await page.locator('.zora-dialog-ok').click();
    assert.deepEqual((await readStore('zora.canvases.v1'))[0].nodes.map(n=>n.id),['node-b']);
  });
  await test('rename duplicate search and reload preserve independent canvases',async()=>{
    await seed();await page.locator('#canvas-rename').click();await page.locator('.zora-dialog-input').fill('验收改名');await page.locator('.zora-dialog-ok').click();
    await addNode();await page.locator('#rail-canvases').click();await page.locator('.canvas-lib-item').filter({hasText:'验收改名'}).locator('[data-act="dup"]').click();
    await page.locator('#canvas-lib-filter').fill('副本');assert.equal(await page.locator('.canvas-lib-item').count(),1);
    const list=await readStore('zora.canvases.v1');const copy=list.find(c=>c.name==='验收改名 副本');assert(copy);assert.equal(copy.nodes.length,2);assert.notEqual(copy.id,'fixture-a');
    await page.reload();assert.equal((await readStore('zora.canvases.v1')).find(c=>c.id===copy.id).nodes.length,2);
  });
  await test('library rename anchors to its own button and confirmation resets positioning',async()=>{
    await seed();await page.locator('#rail-canvases').click();const trigger=page.locator('.canvas-lib-item').filter({hasText:'验收 B'}).locator('[data-act="rename"]');await trigger.click();
    const a=await trigger.boundingBox(),b=await page.locator('.zora-dialog').boundingBox();assert(Math.abs(b.y-(a.y+a.height))<15);await page.locator('.zora-dialog-input').fill('验收 B 改名');await page.locator('.zora-dialog-ok').click();
    await page.locator('.canvas-lib-item').filter({hasText:'验收 B 改名'}).locator('[data-act="del"]').click();assert(!await page.locator('#zora-dialog-host').evaluate(e=>e.classList.contains('is-anchored')));await page.locator('.zora-dialog-cancel').click();assert.equal((await readStore('zora.canvases.v1')).length,2);
  });
  await test('return from library restores selected canvas mode',async()=>{await seed();await page.locator('#rail-canvases').click();await page.locator('[data-tab="create"]').first().click();assert(await page.locator('#canvas-board').isVisible());});
  await test('repeated mode switches keep global toolbar above project toolbar',async()=>{
    await seed();for(let i=0;i<4;i++){await agent();assert(await page.locator('.account-toolbar').isVisible());await canvas();const a=await page.locator('.account-toolbar').boundingBox(),b=await page.locator('.canvas-topbar').boundingBox();assert(a&&b);assert(a.y+a.height<=b.y+1,JSON.stringify({a,b}));}
  });
  await test('marquee survives render and selects a node',async()=>{
    await seed();const b=await page.locator('#canvas-board').boundingBox();await page.mouse.move(b.x+10,b.y+20);await page.mouse.down();await page.mouse.move(b.x+210,b.y+165,{steps:6});
    assert(await page.locator('#canvas-board > .canvas-marquee').isVisible());await page.mouse.up();assert.equal(await page.locator('.canvas-node.is-selected').count(),1);
  });
  await test('hand pan and temporary space pan restore mouse tool',async()=>{
    await seed();const b=await page.locator('#canvas-board').boundingBox();const before=await page.locator('#canvas-nodes').getAttribute('style');
    await page.locator('#canvas-tool-toggle').click();await page.mouse.move(b.x+350,b.y+200);await page.mouse.down();await page.mouse.move(b.x+430,b.y+260,{steps:5});await page.mouse.up();assert.notEqual(await page.locator('#canvas-nodes').getAttribute('style'),before);
    await page.locator('#canvas-tool-toggle').click();await page.locator('#canvas-board').focus();await page.keyboard.down('Space');assert.match(await page.locator('#canvas-tool-toggle').textContent(),/抓手/);await page.keyboard.up('Space');assert.match(await page.locator('#canvas-tool-toggle').textContent(),/鼠标/);
  });
  await test('board zoom and model menu scrolling are independent',async()=>{
    await seed();const b=await page.locator('#canvas-board').boundingBox();await page.mouse.move(b.x+350,b.y+220);const initial=await page.locator('#canvas-zoom-label').textContent();await page.mouse.wheel(0,-300);await page.waitForFunction(x=>document.querySelector('#canvas-zoom-label').textContent!==x,initial);
    const zoom=await page.locator('#canvas-zoom-label').textContent();await page.locator('#canvas-agent-model-trigger').click();const menu=page.locator('#canvas-agent-model-menu');const m=await menu.boundingBox();await page.mouse.move(m.x+m.width/2,m.y+m.height/2);await page.mouse.wheel(0,500);await page.waitForFunction(()=>document.querySelector('#canvas-agent-model-menu').scrollTop>0);assert.equal(await page.locator('#canvas-zoom-label').textContent(),zoom);await page.locator('#canvas-agent-input').click();
  });
  await test('rail collapse survives reload',async()=>{await seed();await page.locator('#canvas-agent-hide').click();await page.reload();await canvas();assert(!await page.locator('.canvas-agent-rail').isVisible());await page.locator('#canvas-agent-show').click();});
  await test('canvas model skill and image are sent without entering main history',async()=>{
    await seed();await page.locator('#canvas-agent-new-chat').click();await page.locator('#canvas-agent-model-trigger').click();const selected=page.locator('#canvas-agent-model-menu button').nth(1);await selected.click();const model=await page.locator('#canvas-agent-model').inputValue();
    await page.locator('#canvas-agent-skill-btn').click();await page.locator('#canvas-agent-skill-menu button').first().click();
    await page.locator('#canvas-agent-files').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=','base64')});
    await canvasSend('CANVAS_ONLY');const req=fixture.requests.at(-1);assert.equal(req.channel,'canvas');assert.equal(req.modelId,model);assert.equal(req.skills.length,1);assert.equal(req.references[0].name,'fixture.png');assert.match(req.references[0].contentUrl,/^data:image\/png/);
    assert.doesNotMatch(JSON.stringify(await readStore('zora.session.v1')),/CANVAS_ONLY/);
  });
  await test('main and canvas UI use distinct IDs with isolated follow-ups',async()=>{
    await agent();await page.locator('#prompt').fill('MAIN_ONLY');await page.getByRole('button',{name:'创作类型',exact:true}).click();await page.getByRole('option',{name:'Agent 模式',exact:true}).click();await mainSend('MAIN_ONLY');await mainSend('MAIN_FOLLOWUP');const mainId=fixture.requests.at(-1).conversationId;assert(mainId);
    assert.doesNotMatch(fixture.prompts.at(-1).prompt,/CANVAS_ONLY/);
    await canvas();await canvasSend('CANVAS_FOLLOWUP');const canvasId=fixture.requests.at(-1).conversationId;assert(canvasId);assert.notEqual(mainId,canvasId);assert.doesNotMatch(fixture.prompts.at(-1).prompt,/MAIN_ONLY/);
    assert(!await page.locator('.conversation-log').isVisible());await agent();assert(await page.locator('.conversation-log').isVisible());assert(!await page.locator('#agent-workspace > h1').isVisible());await canvas();
  });
  await test('canvas request failure and busy errors restore send button',async()=>{
    await canvas();for(const [status,error] of [[502,'模拟连接失败'],[409,'模拟 Agent 正忙']]){fixture.failNext(status,error);await canvasSend('模拟异常');assert.match(await page.locator('#canvas-agent-log').textContent(),new RegExp(error));assert(!await page.locator('#canvas-agent-send').isDisabled());}
  });
  await test('expired canvas session can start fresh without touching main history',async()=>{
    fixture.restartChat();const main=await readStore('zora.session.v1');await canvasSend('过期重试');assert.match(await page.locator('#canvas-agent-log').textContent(),/过期/);await page.locator('#canvas-agent-new-chat').click();await canvasSend('全新会话');assert.match(await page.locator('#canvas-agent-log').textContent(),/本地验收模拟/);assert.deepEqual(await readStore('zora.session.v1'),main);
  });
  await test('new canvas conversation cannot replace an in-flight session',async()=>{
    fixture.setDelay(350);await page.locator('#canvas-agent-input').fill('延迟测试');const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await page.locator('#canvas-agent-send').click();
    try{assert(await page.locator('#canvas-agent-new-chat').isDisabled());}finally{await response;fixture.setDelay(0);}
  });
  await test('reloading pending canvas chat displays interruption instead of endless spinner',async()=>{
    await page.evaluate(()=>{const k='zora.canvasAgentSession.v1',s=JSON.parse(localStorage.getItem(k));s.messages.push({role:'assistant',text:'',pending:true});localStorage.setItem(k,JSON.stringify(s));});
    await page.reload();await canvas();assert.match(await page.locator('#canvas-agent-log').textContent(),/中断/);assert(!await page.locator('#canvas-agent-send').isDisabled());
  });
  await test('main errors and server restart allow an explicit fresh conversation',async()=>{
    await agent();for(const [status,error] of [[502,'模拟主会话连接失败'],[409,'模拟主会话正忙']]){fixture.failNext(status,error);await mainSend('主会话异常');assert.match(await page.locator('.conversation-log').textContent(),new RegExp(error));}
    fixture.restartChat();await mainSend('主会话过期');assert.match(await page.locator('.conversation-log').textContent(),/过期/);
    await page.locator('.new-conversation').click();await mainSend('主会话重新开始');assert.match(await page.locator('.conversation-log').textContent(),/本地验收模拟/);
  });
  await test('reloading pending main chat displays interruption',async()=>{
    await page.evaluate(()=>{const k='zora.session.v1',s=JSON.parse(localStorage.getItem(k));const c=s.conversations.find(c=>c.id===s.currentConversationId);c.messages.push({text:'刷新期间发送',kind:'agent',liveAgent:true,pending:true,references:[]});localStorage.setItem(k,JSON.stringify(s));});
    await page.reload();await agent();assert.match(await page.locator('.conversation-log').textContent(),/中断/);
  });
  await test('RunningHub unavailable response is rendered as failure',async()=>{
    await canvas();fixture.failNext(501,'RunningHub 接口已预留，尚未接入真实 API');await canvasSend('验收 RunningHub 未接入');assert.match(await page.locator('#canvas-agent-log .error').last().textContent(),/尚未接入/);
  });
  await test('skill menu scroll leaves canvas zoom unchanged',async()=>{
    await canvas();const zoom=await page.locator('#canvas-zoom-label').textContent();await page.locator('#canvas-agent-skill-btn').click();const menu=page.locator('#canvas-agent-skill-menu');const b=await menu.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,450);
    const scrollable=await menu.evaluate(e=>e.scrollHeight>e.clientHeight);if(scrollable)await page.waitForFunction(()=>document.querySelector('#canvas-agent-skill-menu').scrollTop>0);assert.equal(await page.locator('#canvas-zoom-label').textContent(),zoom);await page.locator('#canvas-agent-input').click();
  });
  await test('minimum desktop width keeps three global toolbar groups separate',async()=>{
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await canvas();
    try{const a=await page.locator('.directory-capsule').boundingBox(),b=await page.locator('#work-mode-switch').boundingBox(),c=await page.locator('.account-toolbar').boundingBox();assert(a.x+a.width<=b.x&&b.x+b.width<=c.x,JSON.stringify({a,b,c}));}
    finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));}
  });
  await test('manual OM execution panel stays hidden',async()=>{await page.locator('[data-tab="tasks"]').first().click();assert.equal(await page.locator('#om-tool-trigger').isVisible(),false);});
  await test('welcome and login have no canvas fullscreen overlay',async()=>{
    await seed();await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','0');location.hash='welcome';});await page.locator('#welcome').waitFor({state:'visible'});assert(!await page.locator('#canvas-board').isVisible());assert(!await page.locator('#studio').evaluate(e=>e.classList.contains('canvas-fullscreen')));
    await page.evaluate(()=>{location.hash='login';});await page.locator('#login').waitFor({state:'visible'});assert(!await page.locator('#canvas-board').isVisible());
    await page.evaluate(()=>{localStorage.setItem('zora.auth.v1','1');location.hash='studio';});await page.locator('#studio').waitFor({state:'visible'});await canvas();
  });
  await test('project capacity never silently evicts an existing canvas',async()=>{
    await page.evaluate(()=>{const list=Array.from({length:40},(_,i)=>({id:'capacity-'+i,name:'容量验收 '+i,nodes:[]}));localStorage.setItem('zora.canvases.v1',JSON.stringify(list));localStorage.setItem('zora.canvasCurrent.v1','capacity-0');localStorage.setItem('zora.canvasNodes.v1','[]');});
    await page.reload();await canvas();const ids=(await readStore('zora.canvases.v1')).map(c=>c.id);await page.locator('#canvas-project-new').click();assert.deepEqual((await readStore('zora.canvases.v1')).map(c=>c.id),ids);assert.match(await page.locator('#toast').textContent(),/40/);
    await page.locator('#rail-canvases').click();await page.locator('.canvas-lib-item').first().locator('[data-act="dup"]').click();assert.deepEqual((await readStore('zora.canvases.v1')).map(c=>c.id),ids);
  });
  await test('node limit rejects new work visibly instead of losing it on reload',async()=>{
    await seed();await page.evaluate(()=>{const nodes=Array.from({length:120},(_,i)=>({id:'limit-'+i,type:'free',x:20+(i%10)*5,y:20+Math.floor(i/10)*5}));localStorage.setItem('zora.canvasNodes.v1',JSON.stringify(nodes));const list=JSON.parse(localStorage.getItem('zora.canvases.v1'));list[0].nodes=nodes;localStorage.setItem('zora.canvases.v1',JSON.stringify(list));});
    await page.reload();await canvas();await addNode();assert.equal(await page.locator('.canvas-node').count(),120);assert.match(await page.locator('#toast').textContent(),/120/);
  });
  await seed();
  await page.screenshot({path:path.join(output,'desktop.png')});
  await page.locator('#theme-toggle').click();await page.screenshot({path:path.join(output,'desktop-night.png')});await page.locator('#theme-toggle').click();
  console.log('ERRORS '+JSON.stringify(errors));
} finally {
  await writeFile(path.join(output,'desktop-results.json'),JSON.stringify({recordedAt:new Date().toISOString(),node:process.version,userAgent:await page.evaluate(()=>navigator.userAgent),isolatedProfile:true,mockedChat:true,results,errors,blocked,requests:fixture.requests,prompts:fixture.prompts},null,2));
  await app.close();await fixture.close();
}
process.exitCode=results.some(r=>r.status==='failed')||errors.length?1:0;
