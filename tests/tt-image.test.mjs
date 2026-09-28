import test from 'node:test';
import assert from 'node:assert/strict';
import {TT_IMAGE,ttImageSize,packTtImage} from '../packages/duoyuanx/tt-image.mjs';
import {publishModelCapability,assertConfiguredOperation} from '../packages/contracts/model-capability.mjs';
import {packGenerateRequest} from '../packages/duoyuanx/generation-adapters.mjs';
import {proxyGeneration} from '../apps/cloudflare-worker/src/proxy.mjs';
import {queryTtImageTask} from '../apps/cloudflare-worker/src/tt-image-query.mjs';
import {ImageJobCore} from '../apps/cloudflare-worker/src/image-job-core.mjs';
const model=publishModelCapability({id:'tt-image-2.5',kind:'image',provider:'custom',capability:{version:1,template:'tt-image'}});
const draft={modelId:model.id,prompt:'portrait',ratio:'16:9',resolution:'4K',count:1};
test('all 39 TT image size combinations obey upstream limits',()=>{
 for(const ratio of TT_IMAGE.ratios)for(const resolution of TT_IMAGE.resolutions){const [w,h]=ttImageSize(ratio,resolution).split('x').map(Number);assert.equal(w%16,0);assert.equal(h%16,0);assert.ok(w*h>=655360&&w*h<=8294400&&Math.max(w,h)<=3840);}
 assert.equal(ttImageSize('16:9','4K'),'3840x2160');assert.equal(ttImageSize('9:16','4K'),'2160x3840');assert.equal(ttImageSize('1:1','4K'),'2880x2880');
});
test('published TT capability and explicit edit selection agree',()=>{
 assert.equal(model.available,true);assert.deepEqual(model.resolutions,['1K','2K','4K']);
 const input={...draft,operation:'reference',apiRoute:'/v1/images/edits',videoMode:'i2i',references:[{type:'image/png',contentUrl:'https://example.com/a.png'}]};
 assertConfiguredOperation(model,input);const packed=packGenerateRequest(input,model);
 assert.equal(packed.path,'/v1/images/edits');assert.deepEqual(packed.body.images,[{image_url:'https://example.com/a.png'}]);assert.equal(packed.body.image,undefined);
 assert.throws(()=>packTtImage({...draft,count:2},model),/1 张/);
});
test('local reference uses multipart file bytes, never raw base64 JSON',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{assert.equal(url,'https://upstream/v1/images/edits');assert.ok(init.body instanceof FormData);assert.equal(init.headers['Content-Type'],undefined);const file=init.body.get('image[]');assert.equal(file.type,'image/png');assert.equal(await file.text(),'hello');assert.equal(init.body.get('size'),'3840x2160');return Response.json({data:[{url:'https://result/a.png'}]});};
 try{await proxyGeneration({body:{...draft,references:[{type:'image/png',contentUrl:'data:image/png;base64,aGVsbG8='}]},modelInfo:model,provider:'custom',env:{CUSTOM_BASE_URL:'https://upstream',CUSTOM_API_KEY:'test'}});}finally{globalThis.fetch=original;}
});
test('TT upstream timeout preserves task ID for recovery',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:{message:'timeout',task_id:123}},{status:504});
 try{await assert.rejects(proxyGeneration({body:draft,modelInfo:model,provider:'custom',env:{CUSTOM_BASE_URL:'https://upstream',CUSTOM_API_KEY:'test'}}),e=>e.upstreamTaskId==='123');}finally{globalThis.fetch=original;}
});
function storage(){const values=new Map();return {async get(k){return structuredClone(values.get(k));},async put(k,v){values.set(k,structuredClone(v));},async transaction(fn){return fn(this);},async getAlarm(){return null;},async setAlarm(){}};}
test('durable timeout polls persisted upstream task through restart, POST and billing each once',async()=>{
 const ctx={storage:storage()},env={DB:{prepare(){return {bind(){return this;},async run(){return {};}};}}};let posts=0,queries=0,bills=0;
 const deps={generate:async()=>{posts++;throw Object.assign(Error('timeout'),{status:504,upstreamTaskId:'123'});},query:async()=>++queries===1?{final:false}:{final:true,data:[{url:'https://result/a.png'}]},price:async()=>1,deduct:async()=>{bills++;}};
 const core=new ImageJobCore(ctx,env,deps);await core.enqueue({input:{...draft,model:model.id,n:1},modelInfo:model,task:{id:'request-1234567890',status:'running',revision:1,upstreams:[]},provider:'custom',userId:'u',fingerprint:'f'});
 await core.alarm();assert.equal((await core.receipt()).status,'running');const restored=new ImageJobCore(ctx,env,deps);
 await restored.alarm();await restored.alarm();await restored.alarm();assert.equal((await restored.receipt()).status,'completed');assert.equal(posts,1);assert.equal(queries,2);assert.equal(bills,1);
});
test('recovery GET encodes ID and interprets documented final state',async()=>{
 const result=await queryTtImageTask({env:{CUSTOM_BASE_URL:'https://upstream/v1',CUSTOM_API_KEY:'test'},provider:'custom',taskId:'123'},async(url,init)=>{assert.equal(url,'https://upstream/v1/skills/task-status?task_id=123');assert.equal(init.redirect,'manual');return Response.json({is_final:true,state:'success',result_url:'https://result/a.png'});});assert.equal(result.data[0].url,'https://result/a.png');
});
import {generateImages} from '../apps/cloudflare-worker/src/image-generation.mjs';
test('TT request returns durable receipt without invoking paid generation in HTTP handler',async()=>{
 let enqueued;
 const db={prepare(sql){return {bind(){return this;},async first(){return sql.includes('server_models')?{...model,enabled:1}:null;},async run(){return {meta:{changes:1}};}};}};
 const env={DB:db,IMAGE_JOBS:{getByName(name){assert.equal(name,'u/request-1234567890');return {async enqueue(job){enqueued=job;return job.task;}};}}};
 const response=await generateImages({...draft,requestId:'request-1234567890',references:[{type:'image/png',contentUrl:'data:image/png;base64,aGVsbG8='}]},{id:'u',quotaBalance:100},env,{price:async()=>1,generate:async()=>{throw Error('must enqueue');}});
 assert.equal(response.task.status,'running');assert.equal(enqueued.modelInfo.family,'tt-image');assert.equal(enqueued.input.references[0].contentUrl,'data:image/png;base64,aGVsbG8=');assert.ok(!JSON.stringify(response.task).includes('aGVsbG8='));
});
