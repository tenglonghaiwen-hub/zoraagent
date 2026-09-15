import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createChatService} from '../apps/server/chat-service.mjs';
import {createSessionStore} from '../packages/agent/session-store.mjs';
process.env.ZORA_AGENT_API_KEY='unit-test-dummy';process.env.ZORA_AGENT_ENABLED='true';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'zora-chat-persistence-'));
const run=async()=>({reply:'本地测试回复',tasks:[]});
test('a restarted chat service restores ID and prior text, without storing media or configuration',async()=>{
 const directory=temp();const ref={name:'original.png',type:'image/png',contentUrl:'data:image/png;base64,aGVsbG8='};
 const first=await createChatService({run,storageDirectory:directory})({message:'原始要求',references:[ref]});
 let seen;const restarted=createChatService({storageDirectory:directory,run:async p=>{seen=p;return run();}});
 const next=await restarted({message:'继续',conversationId:first.conversationId});
 assert.equal(next.conversationId,first.conversationId);assert.match(seen,/原始要求/);
 const record=fs.readFileSync(path.join(directory,first.conversationId+'.json'),'utf8');assert.doesNotMatch(record,/aGVsbG8|unit-test-dummy|contentUrl/);assert.match(record,/original.png/);
});
test('failed atomic replacement preserves old valid session on disk and latest in memory',()=>{
 const directory=temp(),id='test-session-123456789';
 const first={id,history:[{role:'user',text:'old'},{role:'assistant',reply:'old reply',tasks:[]}]};
 createSessionStore({directory}).save(first);
 const injected=Object.create(fs);injected.renameSync=(from,to)=>{if(to.endsWith('.json'))throw Error('injected rename failure');return fs.renameSync(from,to);};
 const store=createSessionStore({directory,fsImpl:injected});
 const newer={id,history:[...first.history,{role:'user',text:'new'},{role:'assistant',reply:'new reply',tasks:[]}]};
 assert.match(store.save(newer),/保存失败/);assert.equal(store.sessions.get(id).history.length,4);
 assert.equal(createSessionStore({directory}).sessions.get(id).history.length,2);
});
test('corrupt primary recovers valid backup and never overwrites it with bad JSON',()=>{
 const directory=temp(),id='test-session-987654321',store=createSessionStore({directory});
 store.save({id,history:[{role:'user',text:'first'},{role:'assistant',reply:'first',tasks:[]}]});
 store.save({id,history:[{role:'user',text:'second'},{role:'assistant',reply:'second',tasks:[]}]});
 fs.writeFileSync(path.join(directory,id+'.json'),'{broken');
 const restored=createSessionStore({directory});assert.equal(restored.sessions.get(id).history[0].text,'first');assert.match(restored.warnings[0],/恢复/);
 restored.save(restored.sessions.get(id));assert.equal(createSessionStore({directory}).sessions.get(id).history[0].text,'first');
});
test('conversation continues beyond 20 rounds after restart',async()=>{
 const directory=temp();let chat=createChatService({run,storageDirectory:directory}),id;
 for(let i=0;i<20;i++)id=(await chat({message:'轮次'+i,conversationId:id})).conversationId;
 chat=createChatService({run,storageDirectory:directory});assert.equal((await chat({message:'第21轮',conversationId:id})).conversationId,id); chat=createChatService({run,storageDirectory:directory});assert.equal((await chat({message:'第22轮',conversationId:id})).conversationId,id);
 const memory=createChatService({run});assert.ok((await memory({message:'内存测试'})).conversationId);
});
