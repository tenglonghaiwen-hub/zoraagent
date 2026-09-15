import test from 'node:test';
import assert from 'node:assert/strict';
import {attachGenerationReceipts,applyGenerationReceipt} from '../apps/client/agent-generation-tasks.js';
test('repeated old Agent receipts cannot duplicate or regress a completed task',()=>{
 const source={id:'source'},messages=[source];
 const receipt={task:{id:'same-task',modelId:'gpt-image-2',revision:1,status:'running',upstreams:[]},draft:{kind:'image',prompt:'test',operation:'reference',apiRoute:'/v1/images/generations'}};
 attachGenerationReceipts(messages,source,[receipt]);
 assert.equal(messages[1].operation,'reference');assert.equal(messages[1].apiRoute,'/v1/images/generations');
 applyGenerationReceipt(messages[1],{...receipt.task,revision:2,status:'completed',upstreams:[{url:'https://example.test/a.png'}]});
 attachGenerationReceipts(messages,source,[receipt]);
 assert.equal(messages.length,2);assert.equal(messages[1].genStatus,'已完成');assert.equal(messages[1].sourceAgentMessageId,'source');
});
test('partial result retains output and error; unknown never claims completion',()=>{
 const message={};
 applyGenerationReceipt(message,{id:'task',revision:2,status:'partial',upstreams:[{url:'https://example.test/a.png'},{error:'second failed'}]});
 assert.equal(message.genStatus,'部分失败');assert.equal(message.genError,'second failed');assert.equal(message.genUrls.length,1);
 const unknown=applyGenerationReceipt({},{id:'unknown',status:'unknown',submissionUnknown:true,revision:0,upstreams:[]});
 assert(unknown.genPending&&unknown.genUnknown);assert.notEqual(unknown.genStatus,'已完成');
});
