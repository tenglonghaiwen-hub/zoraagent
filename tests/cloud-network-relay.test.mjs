import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startCloudRelay,CLOUD_ORIGIN} from '../apps/desktop/main/cloud-network-relay.mjs';
import {readNetwork,saveNetwork} from '../apps/desktop/main/network-settings.mjs';
test('fresh install uses system proxy; manual settings and UTF8 BOM survive reload',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zora-network-'));
 assert.equal(readNetwork(dir).mode,'system');saveNetwork(dir,{mode:'proxy',proxy:'http://127.0.0.1:10808'});
 assert.equal(readNetwork(dir).proxy,'http://127.0.0.1:10808');
 fs.writeFileSync(path.join(dir,'network.json'),'\uFEFF'+JSON.stringify({mode:'system'}));assert.equal(readNetwork(dir).mode,'system');
});
test('relay keeps request identity and streamed response, refuses browser and arbitrary paths',async()=>{
 let calls=0;
 const relay=await startCloudRelay(async(url,init)=>{calls++;assert.equal(url,CLOUD_ORIGIN+'/api/agent/responses');assert.equal(init.headers.authorization,'Bearer test');assert.equal(init.body.toString(),'{}');return new Response('data: test\n\n',{headers:{'content-type':'text/event-stream'}});});
 try{
  const r=await fetch(relay.url+'/api/agent/responses',{method:'POST',headers:{Authorization:'Bearer test'},body:'{}'});assert.equal(await r.text(),'data: test\n\n');
  assert.equal((await fetch(relay.url+'/api/models',{headers:{Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await fetch(new URL('/api/models',relay.url))).status,403);assert.equal(calls,1);
 }finally{relay.close();}
});
test('relay does not retry POST and sanitizes network errors',async()=>{
 let calls=0;const relay=await startCloudRelay(async()=>{calls++;throw Error('net::ERR_PROXY_CONNECTION_FAILED private-token');});
 try{const r=await fetch(relay.url+'/api/generate',{method:'POST',body:'{}'});const text=await r.text();assert.equal(r.status,502);assert.match(text,/ERR_PROXY_CONNECTION_FAILED/);assert(!text.includes('private-token'));assert.equal(calls,1);}finally{relay.close();}
});
