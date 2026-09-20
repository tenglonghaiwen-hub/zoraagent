import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/message-badge-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),OM_AUTO_SIDECAR:'false',ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges')};
delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();
 let messages=Array.from({length:105},(_,i)=>({id:'public-'+i,userId:'*',kind:'official',title:'验收消息 '+i,content:'本地模拟系统通知',createdAt:Date.now()-i}));
 let failed=false;
 await page.route('https://zora-api.tenglonghaiwen.workers.dev/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/messages'&&!failed){const offset=Number(url.searchParams.get('offset'));const batch=messages.slice(offset,offset+100);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,messages:batch,hasMore:batch.length===100})});}
  return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'isolated acceptance'})});
 });
 await page.waitForLoadState('networkidle');
 async function show(){await page.evaluate(()=>{
  document.querySelectorAll('body>.page').forEach(p=>p.hidden=p.id!=='studio');
  window.dispatchEvent(new Event('focus'));
 });}
 await show();
 const badge=page.locator('#messages-unread-badge'),button=page.locator('#messages-open');
 await page.waitForFunction(()=>document.querySelector('#messages-unread-badge')?.textContent==='99+');
 assert.match(await button.getAttribute('aria-label'),/105/);
 await page.locator('.account-toolbar').screenshot({path:path.join(output,'99-plus.png')});
 await button.click();assert.equal(await badge.isVisible(),false);
 assert.equal(await page.locator('#message-feed .message-item').count(),105);
 await page.locator('#messages-close').click();
 await page.reload();await page.waitForLoadState('networkidle');await show();
 await page.waitForFunction(()=>document.querySelector('#messages-open')?.getAttribute('aria-label')==='消息，无未读消息');
 assert.equal(await badge.isVisible(),false);
 messages=[{id:'new-1',kind:'official',title:'新通知一'},{id:'new-2',kind:'official',title:'新通知二'},...messages];
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.querySelector('#messages-unread-badge')?.textContent==='2');
 await page.locator('.account-toolbar').screenshot({path:path.join(output,'two-new.png')});
 const geometry=await page.evaluate(()=>{const icon=document.querySelector('#messages-open .tb-icon').getBoundingClientRect(),badge=document.querySelector('#messages-unread-badge').getBoundingClientRect();return {noOverlap:badge.bottom<=icon.top,height:badge.height};});
 assert(geometry.noOverlap);assert.equal(geometry.height,14);

 failed=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 assert.equal(await badge.textContent(),'2');failed=false;
 await button.click();assert.equal(await badge.isVisible(),false);await page.locator('#messages-close').click();
 await page.evaluate(async()=>{const {storeUser}=await import('/auth.js');storeUser({id:'another-local-test-user',quotaBalance:0});window.dispatchEvent(new CustomEvent('zora:user-refreshed'));});
 await page.waitForFunction(()=>document.querySelector('#messages-unread-badge')?.textContent==='99+');
 assert.match(await button.getAttribute('aria-label'),/107/);
 await button.click();await page.locator('#messages-close').click();
 messages=[{id:'single-new',title:'一条新消息',kind:'official'},...messages];
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.querySelector('#messages-unread-badge')?.classList.contains('is-dot'));
 assert.equal(await badge.textContent(),'');assert.equal(await badge.isVisible(),true);
 const dot=await badge.boundingBox();assert.equal(dot.width,6);assert.equal(dot.height,6);
 await page.locator('.account-toolbar').screenshot({path:path.join(output,'one-dot.png')});
 console.log(JSON.stringify({ok:true,output,checked:['105 shows 99+','view clears','reload preserves reads','two new messages','failed refresh retains count','account isolation']}));
}finally{await app.close();await fixture.close();}
