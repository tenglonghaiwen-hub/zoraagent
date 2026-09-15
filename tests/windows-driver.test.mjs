import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {invokeDesktop} from '../packages/desktop/windows-driver.mjs';
test('driver uses fixed script and stdin JSON, never interpolates typed text into shell',async()=>{
 let called;const text='中文 $(calc.exe) "quotes"';
 const result=await invokeDesktop({action:'type',windowId:'1234',text,arbitrary:'ignored'},{execFileImpl:async(file,args,options)=>{called={file,args,options};return {stdout:JSON.stringify({ok:true,inputSent:true})};}});
 assert.equal(result.ok,true);assert.ok(called.file.endsWith('powershell.exe'));assert.ok(called.args.includes('-File'));assert.ok(!called.args.includes('-Command'));assert.equal(called.options.shell,undefined);assert.deepEqual(JSON.parse(called.options.input),{action:'type',windowId:'1234',text});assert.ok(!called.args.join(' ').includes(text));assert.equal(called.options.windowsHide,true);
});
test('invalid action, missing handle, invalid coordinate and unsupported keys never invoke host',async()=>{
 let calls=0;const options={execFileImpl:async()=>{calls++;return {stdout:'{}'};}};
 for(const input of [{action:'exec',command:'calc'},{action:'click',x:2,y:3},{action:'click',windowId:'1234',x:-1,y:2},{action:'keys',windowId:'1234',key:'Alt+F4'},{action:'type',windowId:'1234',text:'a\0b'}])assert.equal((await invokeDesktop(input,options)).ok,false);
 assert.equal(calls,0);
});
test('native implementation contains foreground and process guards, Unicode SendInput and no clipboard API',()=>{
 const script=fs.readFileSync(new URL('../scripts/windows-desktop.ps1',import.meta.url),'utf8');
 for(const marker of ['JianyingPro','GetForegroundWindow','WindowFromPoint','GetAncestor','SendInput','UIAutomation','15000'])assert.ok(script.includes(marker));assert.ok(!/SendKeys|Set-Clipboard|Get-Clipboard/.test(script));
});
test('real read-only enumeration returns structured windows on Windows',{skip:process.platform!=='win32'},async()=>{
 const result=await invokeDesktop({action:'listWindows'});assert.equal(result.ok,true,result.error);assert.ok(Array.isArray(result.windows));for(const window of result.windows){assert.ok(window.windowId);assert.ok(Number.isInteger(window.pid));assert.ok(Number.isInteger(window.rect.width));}
});
