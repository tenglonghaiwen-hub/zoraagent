import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {imageRequest} from '../apps/cloudflare-worker/src/image-request.mjs';
import {generateImages,readImageReceipt} from '../apps/cloudflare-worker/src/image-generation.mjs';
import {createCloudMediaTasks} from '../apps/server/cloud-media-tasks.mjs';
import {applyGenerationReceipt} from '../apps/client/agent-generation-tasks.js';
const body={modelId:'gpt-image-2',prompt:'four pages',count:4,ratio:'9:16',resolution:'2K',requestId:'request-1234567890',references:[{type:'image/png',contentUrl:'data:image/png;base64,AAAA'}]};
function database(){
 const rows=new Map();
 return {rows,prepare(sql){let args;return {bind(...values){args=values;return this;},async first(){if(sql.includes('server_models'))return {enabled:1,kind:'image',provider:'duoyuanx',route:'/v1/images/generations'};return rows.get(args.join('/'))||null;},async run(){if(sql.startsWith('INSERT')){const [user,id,fingerprint,task_json]=args,key=user+'/'+id;if(rows.has(key))return {meta:{changes:0}};rows.set(key,{fingerprint,task_json});}else{const [task_json,,user,id]=args;rows.get(user+'/'+id).task_json=task_json;}return {meta:{changes:1}};}};}};
}
test('gpt-image count, reference and exact 2K portrait map to documented fields',()=>{
 const p=imageRequest(body);assert.equal(p.n,4);assert.equal(p.size,'1152x2048');assert.deepEqual(p.image,['AAAA']);assert.equal(p.count,undefined);assert.equal(p.response_format,'url');
 assert.throws(()=>imageRequest({...body,count:0}),/数量/);assert.throws(()=>imageRequest({...body,prompt:''}),/需求/);
 assert.throws(()=>imageRequest({...body,count:5}),/1–4/);
});
test('cloud stores all four results, charges four and replays without paid resubmission',async()=>{
 const env={DB:database()},user={id:'u',quotaBalance:100};let posts=0,billed=0;
 const deps={price:async(db,{count})=>count,deduct:async(db,u,cost)=>billed+=cost,generate:async({body:p})=>{posts++;assert.equal(p.n,4);return {data:Array.from({length:4},(_,i)=>({url:'https://test/'+i+'.png'}))};}};
 const result=await generateImages(body,user,env,deps);assert.equal(result.task.status,'completed');assert.equal(result.task.upstreams.length,4);assert.equal(billed,4);
 const again=await generateImages(body,user,env,deps);assert.deepEqual(again.task,result.task);assert.equal(posts,1);
 assert.equal(await readImageReceipt(env,'other',body.requestId),null);
 await assert.rejects(generateImages({...body,count:2},user,env,deps),/其他参数/);
 const message={count:4};applyGenerationReceipt(message,result.task);assert.equal(message.genUrls.length,4);assert.equal(message.genPending,false);
});
test('cloud missing outputs stay partial; billing errors do not discard images',async()=>{
 const env={DB:database()},user={id:'u',quotaBalance:100};
 const result=await generateImages(body,user,env,{price:async()=>1,deduct:async()=>{throw Error('database error');},generate:async()=>({data:[{url:'https://test/one.png'}]})});
 assert.equal(result.task.status,'partial');assert.match(result.task.pollError,/上游返回 1 张/);assert.match(result.task.pollError,/记账待核对/);assert.equal((await readImageReceipt(env,'u',body.requestId)).upstreams.length,1);
});
test('local receipt returns immediately and recovers cloud result after connection loss without another POST',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-cloud-receipts-')),context={owner:'owner-123456789012',token:'test-only'};
 let rejectRequest,posts=0,queries=0;
 const fetchImpl=async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer test-only');
  if(init.method==='POST'){posts++;return new Promise((resolve,reject)=>{rejectRequest=reject;});}
  queries++;return Response.json({task:{id:body.requestId,status:'completed',revision:2,upstreams:Array.from({length:4},(_,i)=>({ok:true,upstream:{url:'https://test/'+i+'.png'}}))}});
 };
 let store=createCloudMediaTasks({directory,fetchImpl,gateway:'https://test'});
 assert.equal(store.submit(context,body).status,'running');assert.equal(store.submit(context,body).status,'running');assert.equal(posts,1);
 rejectRequest(Error('connection lost'));await new Promise(r=>setImmediate(r));
 store=createCloudMediaTasks({directory,fetchImpl,gateway:'https://test'});
 const recovered=await store.get(context,body.requestId);assert.equal(recovered.status,'completed');assert.equal(recovered.upstreams.length,4);assert.equal(posts,1);assert.equal(queries,1);
 const disk=fs.readFileSync(path.join(directory,context.owner,body.requestId+'.json'),'utf8');assert.ok(!disk.includes('test-only'));assert.ok(!disk.includes('AAAA'));
});
test('unknown upstream outcome keeps original id and is never retried',async()=>{
 const env={DB:database()},user={id:'u',quotaBalance:100};let posts=0;
 const deps={price:async()=>1,deduct:async()=>{},generate:async()=>{posts++;throw Error('upstream timeout');}};
 const result=await generateImages(body,user,env,deps);assert.equal(result.task.status,'unknown');await generateImages(body,user,env,deps);assert.equal(posts,1);
});
