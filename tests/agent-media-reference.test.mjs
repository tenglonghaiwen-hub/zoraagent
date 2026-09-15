import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRunner} from '../packages/agent/tools.mjs';
test('Agent generation tools forward uploaded originals without model-generated base64',async()=>{
 const reference={name:'original.png',type:'image/png',contentUrl:'data:image/png;base64,AA=='};
 const calls=[];const run=createToolRunner({references:[reference],callApi:async request=>{calls.push(request);return {ok:true,status:202,data:{task:{id:request.body.requestId,status:'running'}}};}});
 const draft={modelId:'gpt-image-2',prompt:'戴墨镜',ratio:'1:1',resolution:'1K'};
 await run('preview_task',draft);
 await run('submit_generation',draft);
 await run('call_api',{method:'POST',path:'/api/generate',body:draft});
 assert.equal(calls.length,2,'preview plus one deduplicated generation');
 assert.deepEqual(calls.map(call=>call.path),['/api/preview','/api/generate']);
 for(const call of calls)assert.deepEqual(call.body.references,[reference]);
});
