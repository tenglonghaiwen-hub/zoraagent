import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/conversation-view-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),OM_AUTO_SIDECAR:'false',ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges')};
delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let status='running',progress='初始执行信息';
 await page.route('**/api/local-runtime',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:true,requests:[],codexActivities:[{conversationId:'backend-fixture',messageId:'m13',threadId:'thread-fixture',turnId:'turn-fixture',createdAt:new Date().toISOString(),status,text:progress,tools:{tool:{name:'fixture_tool',status}}}]})}));
 await page.route('https://zora-api.tenglonghaiwen.workers.dev/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
 await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{
  localStorage.setItem('zora.auth.v1','1');
  const now=Date.now();const messages=Array.from({length:14},(_,i)=>({id:'m'+i,createdAt:now-(i<7?86400000:0),completedAt:now,kind:'agent',text:'用户需求 '+i,answer:('这是第 '+i+' 条回复。阅读旧消息时应保持位置。\n').repeat(10),liveAgent:true,pending:false,count:0,references:[],toolTrace:i===13?[{name:'fixture_tool',args:{title:'本地验收'},result:{ok:true}}]:[]}));
  localStorage.setItem('zora.session.v1',JSON.stringify({conversations:[{id:'view-fixture',title:'对话显示验收',backendId:'backend-fixture',messages}],currentConversationId:'view-fixture'}));
  location.hash='studio';
 });
 await page.reload();await page.locator('#studio').waitFor({state:'visible'});await page.locator('[data-work-mode="agent"]').click();
 const log=page.locator('.conversation-log');await log.waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('.thinking-execution'));
 assert.deepEqual(await page.locator('.conversation-date').allTextContents(),['昨天','今天']);
 const distance=()=>log.evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight);
 await page.waitForFunction(()=>{const e=document.querySelector('.conversation-log');return e.scrollHeight-e.scrollTop-e.clientHeight<3;});
 assert(await distance()<3);
 // A new runtime rendering must follow the bottom while reading the newest content.
 progress='更新后的执行信息\n'.repeat(45);
 await page.locator('#local-runtime-panel button').filter({hasText:'刷新记录'}).evaluate(e=>e.click());
 await page.waitForFunction(()=>document.querySelector('.thinking-execution')?.textContent.includes('更新后的执行信息'));
 assert(await distance()<3);
 // Reading an older message survives both runtime updates and a full conversation repaint.
 await log.evaluate(e=>{e.scrollTop=250;});
 await page.waitForFunction(()=>!document.querySelector('.conversation-latest').hidden);
 const before=await log.evaluate(e=>e.scrollTop);
 progress='再次更新执行信息\n'.repeat(60);
 await page.locator('#local-runtime-panel button').filter({hasText:'刷新记录'}).evaluate(e=>e.click());
 await page.waitForFunction(()=>document.querySelector('.thinking-execution')?.textContent.includes('再次更新执行信息'));
 assert(Math.abs(await log.evaluate(e=>e.scrollTop)-before)<3);
 const readingAnchor=await log.evaluate(e=>{const top=e.getBoundingClientRect().top;const child=[...e.children].find(n=>n.dataset.chatKey&&n.getBoundingClientRect().bottom>top+1);return {key:child.dataset.chatKey,offset:child.getBoundingClientRect().top-top};});
 await log.evaluate(e=>e.querySelector('.conversation-user').style.paddingBottom='180px');
 await page.waitForFunction(({key,offset})=>{const log=document.querySelector('.conversation-log'),node=[...log.children].find(n=>n.dataset.chatKey===key);return Math.abs(node.getBoundingClientRect().top-log.getBoundingClientRect().top-offset)<3;},readingAnchor);
 assert(await log.evaluate(e=>e.scrollTop)>before+150);
 await page.locator('.conversation-reply button[title="不喜欢"]').first().evaluate(e=>e.click());
 assert(Math.abs(await log.evaluate(e=>e.scrollTop)-before)<3);
 await page.locator('.conversation-latest').click();assert(await distance()<3);
 // Expanding an execution summary is a reading action, not a request to jump down.
 await page.locator('.thinking-execution textarea').fill('保留正在输入的补充要求');
 await page.locator('#local-runtime-panel button').filter({hasText:'刷新记录'}).evaluate(e=>e.click());
 await page.waitForFunction(()=>document.activeElement?.value==='保留正在输入的补充要求');
 assert.equal(await page.locator('.thinking-execution textarea').inputValue(),'保留正在输入的补充要求');
 // Runtime is the single outer execution group; final tool details are nested.
 assert.equal(await page.locator('.conversation-reply > .agent-execution-process').count(),0);
 assert.equal(await page.locator('.thinking-execution .agent-execution-process').count(),1);
 status='completed';
 await page.locator('#local-runtime-panel button').filter({hasText:'刷新记录'}).evaluate(e=>e.click());
 await page.waitForFunction(()=>document.querySelector('.thinking-execution summary')?.textContent.includes('已完成'));
 assert.equal(await page.locator('.thinking-execution').getAttribute('open'),null);
 await page.locator('.thinking-execution>summary').click();
 await page.locator('#local-runtime-panel button').filter({hasText:'刷新记录'}).evaluate(e=>e.click());
 await page.waitForFunction(()=>document.querySelector('.thinking-execution')?.open);
 assert.equal(await page.locator('.thinking-execution').evaluate(e=>e.open),true);
 await page.screenshot({path:path.join(output,'conversation.png')});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,output,checks:['real date groups','follow bottom','preserve reading position','async layout growth','input focus retained','return to latest','one execution group','manual expansion retained']}));
}finally{await app.close();await fixture.close();}
