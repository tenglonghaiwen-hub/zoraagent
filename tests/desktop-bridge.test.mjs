import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startDesktopBridge} from '../apps/desktop/main/desktop-bridge.mjs';
test('desktop mutation requires explicit consent and rejects browser origins',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-desktop-test-'));let calls=0,response=0;
 const bridge=await startDesktopBridge({directory,dialog:{showMessageBox:async()=>({response})},invokeImpl:async()=>{calls++;return {ok:true};}});
 try{
  const {port,token}=JSON.parse(fs.readFileSync(path.join(directory,'desktop-bridge.json')));
  const call=async(action,extra={})=>fetch(`http://127.0.0.1:${port}/command`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify({action})});
  assert.equal((await call('readWindow',{Origin:'https://example.com'})).status,403);assert.equal(calls,0);
  assert.equal((await(await call('click')).json()).status,'denied');assert.equal(calls,0);
  response=1;await call('click');assert.equal(calls,1);
  response=0;await call('listWindows');assert.equal(calls,2);
 }finally{bridge.close();}
});
