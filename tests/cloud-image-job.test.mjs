import test from 'node:test';
import assert from 'node:assert/strict';
import {ImageJobCore,getLarge} from '../apps/cloudflare-worker/src/image-job-core.mjs';
function storage(){const values=new Map();let alarm=null;return {async get(k){return structuredClone(values.get(k));},async put(k,v){values.set(k,structuredClone(v));},async transaction(fn){return fn(this);},async getAlarm(){return alarm;},async setAlarm(t){alarm=t;}};}
const makeJob=n=>({input:{model:'gpt-image-2',n,prompt:'details',size:'1152x2048',response_format:'url'},task:{id:'job-123456789012',count:n,executor:'durable-object',status:'running',revision:1,upstreams:[]},userId:'u',fingerprint:'hash',provider:'duoyuanx',route:'/v1/images/generations'});
const env={DB:{prepare(){return {bind(){return this;},async run(){return {meta:{changes:1}};}};}}};
test('durable submit returns before generation; alarm persists all images independent of HTTP lifetime',async()=>{
 const ctx={storage:storage()};let calls=0;
 const job=new ImageJobCore(ctx,env,{generate:async({body})=>{calls++;assert.equal(body.n,4);return {data:Array.from({length:4},(_,i)=>({url:'https://test/'+i+'.png'}))};},price:async()=>4,deduct:async()=>{}});
 assert.equal((await job.enqueue(makeJob(4))).status,'running');assert.equal(calls,0);assert.ok(await ctx.storage.getAlarm());
 await job.alarm();const result=await new ImageJobCore(ctx,env).receipt();assert.equal(result.status,'completed');assert.equal(result.upstreams.length,4);
 await job.enqueue(makeJob(4));await job.alarm();assert.equal(calls,1);
});
test('durable alarm never splits requests or retries a rejected paid POST',async()=>{
 const ctx={storage:storage()};let calls=0;
 const job=new ImageJobCore(ctx,env,{generate:async({body})=>{calls++;assert.equal(body.n,5);throw Object.assign(Error('n must be between 1 and 4'),{status:400});}});
 await job.enqueue(makeJob(5));await job.alarm();assert.equal((await job.receipt()).status,'failed');await job.alarm();assert.equal(calls,1);
});
test('interrupted submit is marked unknown on alarm retry without another upstream POST',async()=>{
 const ctx={storage:storage()};let calls=0;const job=new ImageJobCore(ctx,env,{generate:async()=>{calls++;}});
 await job.enqueue(makeJob(4));await ctx.storage.put('job',{...await ctx.storage.get('job'),state:'submitting'});
 await job.alarm();assert.equal((await job.receipt()).status,'unknown');assert.equal(calls,0);
});
test('large base64 output stays in chunked durable storage even if D1 index write fails',async()=>{
 const ctx={storage:storage()},large='A'.repeat(2300000);
 const badEnv={DB:{prepare(){return {bind(){return this;},async run(){throw Error('D1 unavailable');}};}}};
 const job=new ImageJobCore(ctx,badEnv,{generate:async()=>({data:[{b64_json:large}]}),price:async()=>1,deduct:async()=>{}});
 await job.enqueue(makeJob(1));await job.alarm();const restored=new ImageJobCore(ctx,badEnv);
 assert.equal((await restored.receipt()).upstreams[0].upstream.b64_json.length,2300000);assert.equal((await getLarge(ctx.storage,'receipt')).status,'completed');
});
