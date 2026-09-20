import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/day-theme-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),OM_AUTO_SIDECAR:'false',ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges')};
delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{
  document.querySelectorAll('body>.page').forEach(p=>p.hidden=p.id!=='studio');
  document.querySelectorAll('.workspace>.content,.workspace .content').forEach(p=>p.hidden=p.id!=='settings');
  const create=document.getElementById('create');if(create)create.hidden=true;
  document.getElementById('settings').hidden=false;
  document.documentElement.dataset.theme='day';
 });
 const states=[];
 for(const performance of [false,true,false]){
  await page.evaluate(enabled=>document.documentElement.classList.toggle('low-memory-mode',enabled),performance);
  const result=await page.evaluate(()=>{const style=getComputedStyle(document.getElementById('settings'));return {background:style.backgroundColor,blur:style.backdropFilter,color:style.color};});
  if(performance){assert.equal(result.background,'rgb(255, 255, 255)');assert.equal(result.blur,'none');}
  else{assert.match(result.background,/rgba/);assert.notEqual(result.blur,'none');}
  states.push(result);
  if(states.length<3)await page.screenshot({path:path.join(output,performance?'performance-day.png':'normal-day.png')});
 }
 assert.deepEqual(states[0],states[2]);
 console.log(JSON.stringify({ok:true,output,states}));
}finally{await app.close();await fixture.close();}
