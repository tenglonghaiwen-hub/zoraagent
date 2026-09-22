import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {handleOpenMontageRoutes} from '../apps/server/routes/openmontage.mjs';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
process.env.OM_STATE_DIR=path.resolve('outputs','om-ui-state-'+Date.now());
const html=fs.readFileSync('apps/client/index.html','utf8');
const panel=html.slice(html.indexOf('<details id="om-capabilities">'),html.indexOf('<details class="gateway-debug-fold">'));
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://'+req.headers.host);
 if(await handleOpenMontageRoutes(req,res,url,{sendJson:(r,s,b)=>{r.writeHead(s,{'Content-Type':'application/json'});r.end(JSON.stringify(b));},readJson:async r=>{let text='';for await(const c of r)text+=c;return JSON.parse(text);}}))return;
 if(['/om-settings.js','/om-settings.css','/style.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync('apps/client'+url.pathname));return;}
 res.setHeader('Content-Type','text/html');res.end(`<html lang="zh-CN" data-theme="day"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/om-settings.css"><body><div class="studio" style="display:block;min-height:100vh;height:auto;padding:32px"><h1>设置</h1>${panel}</div><script type="module" src="/om-settings.js"></script></body></html>`);
 }catch{res.writeHead(500);res.end('{}');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:path.resolve('vendor/openmontage/runtime/hyperframes/browser/chrome-headless-shell-win64/chrome-headless-shell.exe'),headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#om-capabilities>summary').click();await page.getByText('已读取此设备设置。',{exact:false}).waitFor();
 await page.getByRole('button',{name:'默认转录模型',exact:true}).click();
 await page.getByRole('option',{name:'Small',exact:true}).click();
 await page.locator('[name="pexelsKey"]').fill('fixture-ui-not-a-real-key');
 await page.locator('[name="sources"][value="pexels"]').check();
 await page.getByRole('button',{name:'保存媒体设置'}).click();await page.getByText('已保存，下次工具调用生效。',{exact:true}).waitFor();
 assert.equal(await page.locator('[name="pexelsKey"]').inputValue(),'');
 await page.reload();await page.locator('#om-capabilities>summary').click();await page.getByText('已读取此设备设置。',{exact:false}).waitFor();
 assert.equal(await page.locator('[name="transcriptModel"]').inputValue(),'small');
 assert.match(await page.locator('[data-key-state="pexels"]').textContent(),/已保存/);
 await page.getByRole('button',{name:'默认转录模型',exact:true}).click();
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
 assert.equal(await page.locator('[name="transcriptModel"]').inputValue(),'small');
 await page.getByRole('button',{name:'默认转录模型',exact:true}).click();
 await page.screenshot({path:'outputs/om-settings-desktop.png',fullPage:true});
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 await page.screenshot({path:'outputs/om-settings-mobile.png',fullPage:true});
 await page.locator('[name="pexelsClear"]').check();await page.getByRole('button',{name:'保存媒体设置'}).click();await page.getByText('已保存，下次工具调用生效。',{exact:true}).waitFor();assert.match(await page.locator('[data-key-state="pexels"]').textContent(),/尚未配置/);
 await page.route('**/api/om/capabilities',route=>route.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'}));
 await page.reload();await page.locator('#om-capabilities>summary').click();await page.getByText('后台版本未更新：',{exact:false}).waitFor();
 assert.equal(await page.locator('[name=editing]').isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'重新检查'}).isEnabled(),true);
 await page.unroute('**/api/om/capabilities');await page.getByRole('button',{name:'重新检查'}).click();await page.getByText('已读取此设备设置。',{exact:false}).waitFor();
 assert.equal(await page.locator('[name=editing]').isDisabled(),false);
 assert.deepEqual(errors,[]);console.log('PASS: actual local settings HTTP, DPAPI save/reload/clear, no key echo, desktop/mobile layout');
}finally{await browser.close();await new Promise(r=>server.close(r));}
