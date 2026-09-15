import test from 'node:test';
import assert from 'node:assert/strict';
import {getModels} from '../apps/server/catalog.mjs';
// Explicitly disable providers before the production server's .env loader.
for(const key of ['DUOYUANX_API_KEY','ZORA_AGENT_API_KEY','RUNNINGHUB_API_KEY'])process.env[key]='';
for(const key of ['ZORA_AGENT_ENABLED','RUNNINGHUB_ENABLED','OM_ENABLED','OM_AUTO_SIDECAR'])process.env[key]='false';
const {server}=await import('../apps/server/server.mjs');
test('local HTTP contracts, private-file protection and honest stub failures',async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    assert.deepEqual((await fetch(base+'/api/models').then(r=>r.json())).models,getModels());
    for(const url of ['/.env','/package.json','/config/agent.json'])assert.equal((await fetch(base+url)).status,404,url);
    assert.equal((await fetch(base+'/')).status,200);const catalog=await fetch(base+'/api/local-runtime/tools').then(r=>r.json());assert.ok(catalog.tools.some(t=>t.name==='delegate_media_task'));assert.equal((await fetch(base+'/api/local-runtime/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const invalid=await fetch(base+'/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({modelId:'invented'})});assert.equal(invalid.status,400);
    for(const [url,method] of [['/api/rh/status','GET'],['/api/rh/workflows','GET'],['/api/rh/tasks','POST'],['/api/rh/tasks/fixture','GET']])assert.equal((await fetch(base+url,{method})).status,404);
    const unavailable=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'local test'})});assert.equal(unavailable.status,503);
  }finally{await new Promise(r=>server.close(r));}
});

