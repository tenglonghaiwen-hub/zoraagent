import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/credits-page-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),OM_AUTO_SIDECAR:'false',ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges')};
delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();
 await page.route('https://zora-api.tenglonghaiwen.workers.dev/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'isolated acceptance'})}));
 await page.waitForLoadState('networkidle');
 await page.evaluate(async()=>{
  // This isolated profile has no login; mount the credits component explicitly.
  const {initCreditsPanel}=await import('/login-handler.js?v=studio203');initCreditsPanel();
  document.querySelectorAll('body>.page').forEach(p=>p.hidden=p.id!=='studio');
  document.querySelectorAll('.workspace .content').forEach(p=>p.hidden=p.id!=='credits');
  document.getElementById('create').hidden=true;document.getElementById('credits').hidden=false;
 });
 await page.waitForFunction(()=>document.querySelector('.recharge-tier-card')?.hasAttribute('aria-pressed'));
 const card=page.locator('.recharge-tier-card[data-amount="50"]');await card.click();
 assert.equal(await card.getAttribute('aria-pressed'),'true');assert.match(await page.locator('#recharge-custom-calc').textContent(),/520/);
 await page.locator('.recharge-tier-card[data-amount="100"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('.recharge-tier-card[data-amount="100"]').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#recharge-custom-calc').textContent(),/1050/);
 await page.locator('#recharge-custom-input').fill('75');
 assert.equal(await page.locator('.recharge-tier-card[aria-pressed="true"]').count(),0);
 assert.match(await page.locator('#recharge-custom-calc').textContent(),/770/);
 await card.click();
 const states=[];
 for(const [theme,performance,width] of [['day',false,1440],['night',false,1440],['day',true,1100]]){
  await app.evaluate(({BrowserWindow},w)=>BrowserWindow.getAllWindows()[0].setSize(w,1000),width);
  await page.evaluate(({theme,performance})=>{document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('low-memory-mode',performance);},{theme,performance});
  await page.locator('#credits h1').scrollIntoViewIfNeeded();
  const result=await page.evaluate(()=>{const card=document.querySelector('.recharge-tier-card.active'),style=getComputedStyle(card),grid=document.querySelector('.recharge-tier-grid');return {radius:style.borderRadius,background:style.backgroundColor,overflow:grid.scrollWidth>grid.clientWidth+2,columns:getComputedStyle(grid).gridTemplateColumns};});
  assert.equal(result.radius,'20px');assert.equal(result.overflow,false);states.push(result);
  await page.screenshot({path:path.join(output,`${theme}-${performance?'performance':'normal'}.png`)});
 }
 console.log(JSON.stringify({ok:true,output,states}));
}finally{await app.close();await fixture.close();}
