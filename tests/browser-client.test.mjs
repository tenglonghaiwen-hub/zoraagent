import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {callBrowser} from '../packages/agent/browser-client.mjs';
test('browser bridge uses only local endpoint and does not return credential',async()=>{
 const descriptorPath=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'zora-browser-test-')),'bridge.json'),token='x'.repeat(40);
 fs.writeFileSync(descriptorPath,JSON.stringify({port:12345,token}));
 const result=await callBrowser({action:'search',query:'test'},{descriptorPath,fetchImpl:async(url,o)=>{assert.equal(url,'http://127.0.0.1:12345/command');assert.equal(o.headers.Authorization,'Bearer '+token);return {ok:true,json:async()=>({page:{text:'result'}})};}});
 assert.equal(result.ok,true);assert(!JSON.stringify(result).includes(token));
});
test('missing browser reports unavailable without fake page content',async()=>{
 const r=await callBrowser({action:'read'},{descriptorPath:'missing-browser-file'});assert.equal(r.ok,false);assert(!r.page);
});
