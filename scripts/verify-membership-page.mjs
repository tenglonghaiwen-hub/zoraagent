import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/membership-page-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),OM_AUTO_SIDECAR:'false',ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges')};
delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();
 await page.route('https://zora-api.tenglonghaiwen.workers.dev/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'isolated acceptance'})}));
 await page.waitForLoadState('networkidle');
 await page.evaluate(async()=>{
  document.querySelectorAll('body>.page').forEach(p=>p.hidden=p.id!=='studio');
  document.querySelectorAll('.workspace .content').forEach(p=>p.hidden=p.id!=='membership');
  document.getElementById('create').hidden=true;
  document.getElementById('membership').hidden=false;
  const auth=await import('/auth.js');
  const user={id:'fixture',username:'界面验收',isVip:true,membershipTier:'quarterly',membershipScheduling:true,vipExpiresAt:Date.parse('2027-03-31T05:30:00Z'),quotaBalance:100,concurrencyLimit:3};
  auth.storeUser(user);
  window.dispatchEvent(new CustomEvent('zora:vip-updated',{detail:user}));
 });
 const labels=await page.locator('.tier-action-label').allTextContents();
 assert.match(labels[0],/预约降级/);assert.match(labels[1],/续费/);assert.match(labels[2],/购买/);
 await page.locator('.membership-tier-card[data-tier="monthly"]').click();
 assert.match(await page.locator('#membership-action-note').textContent(),/2027\/4\/1/);
 const states=[];
 for(const [theme,performance,width] of [['day',false,1440],['night',false,1440],['day',true,1100]]){
  await app.evaluate(({BrowserWindow},w)=>BrowserWindow.getAllWindows()[0].setSize(w,1000),width);
  await page.evaluate(({theme,performance})=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('low-memory-mode',performance);},{theme,performance});
  await page.locator('#membership-pricing-section').scrollIntoViewIfNeeded();
  const result=await page.evaluate(()=>{const card=document.querySelector('.membership-tier-card.active'),style=getComputedStyle(card),grid=document.querySelector('.membership-tier-grid');return {background:style.backgroundColor,radius:style.borderRadius,color:style.color,border:style.borderColor,gridOverflow:grid.scrollWidth>grid.clientWidth+2,columns:getComputedStyle(grid).gridTemplateColumns};});
  assert.equal(result.radius,'20px');assert.equal(result.gridOverflow,false);assert.notEqual(result.background,'rgb(255, 255, 255)');states.push(result);
  await page.screenshot({path:path.join(output,`${theme}-${performance?'performance':'normal'}.png`)});
 }
 await page.evaluate(async()=>{
  const auth=await import('/auth.js');const user={...auth.getUser(),pendingMembership:{tier:'monthly',effectiveAt:Date.parse('2027-03-31T16:00:00Z')}};auth.storeUser(user);window.dispatchEvent(new CustomEvent('zora:vip-updated',{detail:user}));
 });
 assert.equal(await page.locator('#btn-membership-checkout').isDisabled(),true);
 assert.match(await page.locator('#membership-action-note').textContent(),/已预约降级/);
 console.log(JSON.stringify({ok:true,output,labels,states}));
}finally{await app.close();await fixture.close();}
