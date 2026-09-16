import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startAcceptanceFixture} from '../tests/helpers/acceptance-fixture.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {_electron}=require('playwright');
const fixture=await startAcceptanceFixture();
const output=path.resolve('outputs/interaction-ui-'+Date.now());await fs.mkdir(output,{recursive:true});
const env={...process.env,PORT:String(fixture.port),ZORA_BRIDGE_DIRECTORY:path.join(output,'bridges'),OM_AUTO_SIDECAR:'false',ZORA_AGENT_API_KEY:'test-only',DUOYUANX_API_KEY:'',RUNNINGHUB_API_KEY:''};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve('apps/desktop/node_modules/electron/dist/electron.exe'),args:[path.resolve('apps/desktop'),'--user-data-dir='+path.join(output,'profile')],env});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 const {AGENT_TOOL_DEFS}=await import('../packages/agent/tools.mjs');let writes=0;
 await page.route('**/api/local-runtime/tools',route=>{if(route.request().method()==='POST')writes++;return route.fulfill({json:{tools:AGENT_TOOL_DEFS.map(t=>({...t,enabled:true}))}});});
 await page.evaluate(async()=>{document.body.innerHTML='<main class="studio-centered" style="min-height:100vh;background:#182c39;color:#e3edf3;padding:32px"><section id="settings"></section></main>';const {mountToolSettings}=await import('/tool-settings.js');mountToolSettings(document.getElementById('settings'));document.getElementById('zora-tool-settings').open=true;});
 await page.locator('.tool-setting-card').first().waitFor();assert.equal(await page.locator('.tool-setting-card').count(),AGENT_TOOL_DEFS.filter(t=>!t.name.startsWith('rh_')).length);await page.locator('input[type=checkbox]').first().uncheck();assert.equal(writes,1);
 await page.getByRole('button',{name:'网页浏览',exact:true}).click();assert.equal(await page.locator('.tool-setting-card:visible').count(),3);
 await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('searchbox').fill('不存在的工具');assert.equal(await page.locator('.tool-setting-card:visible').count(),0);await page.getByRole('searchbox').fill('');
 await page.screenshot({path:path.join(output,'tools-desktop.png'),fullPage:true});await page.setViewportSize({width:620,height:850});await page.screenshot({path:path.join(output,'tools-narrow.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log(JSON.stringify({ok:true,output,checks:['toggle saved','category','search empty state','narrow layout']}));
}finally{await app.close();await fixture.close();}
