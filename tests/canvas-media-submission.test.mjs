import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeMediaResults} from '../apps/client/media-results.js';
const source=fs.readFileSync(new URL('../apps/client/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function submitMediaGeneration(message){'),source.indexOf('}const sendLocalDraft='))+ '}';
function setup(mode,responses){
 const calls=[];
 const context=vm.createContext({getGatewayConfig:()=>({mode}),models:[{id:'MiniMax-H3',provider:'minimax',queryRoute:'/v2/query/video_generation/{task_id}'}],authFetch:async(url,options)=>{calls.push({url,options});const next=responses.shift();if(next instanceof Error)throw next;return {ok:true,json:async()=>next};},crypto:{randomUUID:()=> 'generated-id'},AbortSignal,Date,saveSession(){},recoverTaskReferences:r=>r.references||[],currentConversation:{messages:[]},prepareMediaReference:async r=>r,fileToDataUrl(){},normalizeMediaResults,addGeneratedAsset(){},autoDownloadGenerated:async()=>{},applyGenerationReceipt(m,t){m.genUrls=[];m.genPending=true;}});
 vm.runInContext(code,context);return {calls,run:context.submitMediaGeneration};
}
test('canvas first submission posts reserved request id rather than querying it',async()=>{
 const {calls,run}=setup('local',[{durableTasks:true},{task:{id:'reserved-id'}}]);
 await run({modelId:'MiniMax-H3',text:'walk',genRequestId:'reserved-id',references:[]});
 assert.equal(calls[0].url,'/api/generation-capabilities');assert.equal(calls[1].url,'/api/generate');assert.equal(JSON.parse(calls[1].options.body).requestId,'reserved-id');assert.equal(calls.length,2);
});
test('cloud submits then polls actual upstream id without local durable APIs',async()=>{
 const {calls,run}=setup('cloud',[{task_id:'upstream-123',status:'processing'},{task_id:'upstream-123',status:'succeeded',url:'https://example.com/result.mp4'}]);
 const m={modelId:'MiniMax-H3',text:'walk',genRequestId:'reserved-id',references:[],ratio:'9:16',duration:4};
 await run(m);assert.equal(calls[0].url,'/api/generate');assert.equal(JSON.parse(calls[0].options.body).ratio,'9:16');assert.equal(m.genBatchId,null);assert.deepEqual(m.genTaskIds,['upstream-123']);
 await run(m);assert.match(calls[1].url,/^\/api\/tasks\/upstream-123\?/);assert.equal(m.genUrl,'https://example.com/result.mp4');assert.equal(m.genTaskIds.length,0);
});
test('cloud transport failure marks receipt unknown without querying invented id',async()=>{
 const {calls,run}=setup('cloud',[new Error('timeout')]);const m={modelId:'MiniMax-H3',text:'walk',references:[]};
 await assert.rejects(run(m),/核对/);assert.equal(m.genUnknown,true);assert.equal(m.genBatchId,null);assert.equal(calls.length,1);
});
