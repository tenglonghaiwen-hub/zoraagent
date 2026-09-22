import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {getUserMessages} from '../apps/cloudflare-worker/src/billing.mjs';
import {fetchMessages} from '../apps/client/auth.js';
test('notification pagination includes all public and own messages without another user messages',async()=>{
 const SQL=await initSqlJs(),raw=new SQL.Database();raw.run('CREATE TABLE notifications(id TEXT,user_id TEXT,title TEXT,content TEXT,kind TEXT,created_at INTEGER)');
 for(let i=0;i<108;i++)raw.run('INSERT INTO notifications VALUES(?,?,?,?,?,?)',[String(i),i<105?'*':i===105?'alice':'bob','title','content','official',1000-i]);
 const db={prepare(sql){return {bind(...args){return {async all(){const q=raw.prepare(sql);q.bind(args);const results=[];while(q.step())results.push(q.getAsObject());q.free();return {results};}};}};}};
 try{const first=await getUserMessages(db,'alice',{limit:100,offset:0}),second=await getUserMessages(db,'alice',{limit:100,offset:100});assert.equal(first.length,100);assert.equal(second.length,6);assert.equal(new Set([...first,...second].map(m=>m.id)).size,106);assert([...first,...second].every(m=>m.userId!=='bob'));}finally{raw.close();}
});
test('client retrieves multiple pages and never treats a partial failure as a complete inbox',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async url=>{calls++;const offset=Number(new URL(url).searchParams.get('offset'));return new Response(JSON.stringify({ok:true,messages:Array.from({length:offset?5:100},(_,i)=>({id:offset+i})),hasMore:offset===0}));};
  assert.equal((await fetchMessages()).messages.length,105);assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(calls===1?{ok:true,messages:[{id:1}],hasMore:true}:{ok:false}),{status:calls===1?200:503});};
  assert.equal((await fetchMessages()).ok,false);
 }finally{globalThis.fetch=original;}
});
