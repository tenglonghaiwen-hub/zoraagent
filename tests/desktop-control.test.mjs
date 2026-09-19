import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeDesktop} from '../packages/desktop/windows-driver.mjs';
import {desktopToolContent} from '../packages/agent/desktop-tool-content.mjs';
import {AGENT_TOOL_DEFS} from '../packages/agent/tools.mjs';
test('desktop supports named app launch without user supplied installation ID',async()=>{
 let command;const r=await invokeDesktop({action:'openApp',name:'微信',scope:'desktop'},{execFileImpl:async(_file,_args,options)=>{command=JSON.parse(options.input);return {stdout:'{"ok":true,"windowVerified":false}'};}});
 assert.deepEqual(command,{action:'openApp',scope:'desktop',name:'微信'});assert.equal(r.windowVerified,false);
 assert(AGENT_TOOL_DEFS.find(t=>t.name==='desktop_control').parameters.properties.action.enum.includes('captureWindow'));
});
test('desktop inputs remain targeted and validate coordinates and keys',async()=>{
 let calls=0;const execFileImpl=async()=>{calls++;return {stdout:'{"ok":true}'};};
 assert.equal((await invokeDesktop({action:'click',scope:'desktop',x:1,y:2},{execFileImpl})).ok,false);
 assert.equal((await invokeDesktop({action:'click',windowId:'12',x:-1,y:2},{execFileImpl})).ok,false);
 assert.equal(calls,0);
 assert.equal((await invokeDesktop({action:'keys',scope:'desktop',windowId:'12',key:'Win'},{execFileImpl})).ok,true);
});
test('screenshots become native image inputs and are omitted from saved trace',()=>{
 const r={ok:true,data:{ok:true,imageUrl:'data:image/png;base64,AAAA',width:800,height:600}};
 const c=desktopToolContent('desktop_control',r);assert.equal(c.contentItems[1].type,'inputImage');assert.equal(c.contentItems[1].imageUrl,r.data.imageUrl);assert.equal(c.trace.data.imageUrl,undefined);assert.equal(c.trace.data.width,800);
 assert.equal(desktopToolContent('other_tool',r).contentItems.length,1);
 assert.equal(desktopToolContent('desktop_control',{ok:false,data:r.data}).contentItems.length,1);
});
