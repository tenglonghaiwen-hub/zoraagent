import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname.slice(1);
 if(!name){res.setHeader('Content-Type','text/html');res.end('<div id="settings"></div><div id="local-runtime-panel"></div><script type="module" src="/runtime-panel.js"></script>');return;}
 if(!/^[\w-]+\.js$/.test(name)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.resolve('apps/client',name)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:path.resolve('vendor/openmontage/runtime/hyperframes/browser/chrome-headless-shell-win64/chrome-headless-shell.exe'),headless:true});
try{
 const page=await browser.newPage();let fail=true,mode='smart',writes=0;
 await page.route('**/api/**',async route=>{
  const approval=route.request().url().endsWith('/codex/approval-mode');
  if(approval&&route.request().method()==='POST'){mode=route.request().postDataJSON().mode;writes++;}
  await route.fulfill({status:approval&&fail?503:200,contentType:'application/json',body:JSON.stringify(approval?(fail?{error:'模拟服务暂不可用'}:{mode}):{requests:[],files:[]})});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 const trigger=page.locator('.approval-picker-trigger');
 await page.getByRole('button',{name:'重新加载审批设置'}).waitFor();
 assert(await trigger.isDisabled());
 assert(await page.getByText('审批设置加载失败：模拟服务暂不可用').isVisible());
 fail=false;await page.getByRole('button',{name:'重新加载审批设置'}).click();
 await page.waitForFunction(()=>!document.querySelector('.approval-picker-trigger').disabled);
 await trigger.click();await page.getByRole('option').filter({hasText:'请求批准'}).click();
 await page.getByText('已保存，从下一项任务生效').waitFor();
 assert.equal(mode,'ask');assert.equal(writes,1);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('.approval-picker-trigger').disabled);
 assert.match(await trigger.innerText(),/请求批准/);
 page.on('dialog',dialog=>dialog.dismiss());
 await trigger.click();await page.getByRole('option').filter({hasText:'完全访问'}).click();
 assert.equal(writes,1);assert.equal(mode,'ask');
 console.log('PASS: failed load is visible, retry enables selection, save survives reload, full-access cancellation does not save');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
