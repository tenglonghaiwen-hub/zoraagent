import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeResultContext} from '../packages/agent/runtime-result-context.mjs';

test('resume includes actual completed results only from this conversation', () => {
  const context = runtimeResultContext({data:{requests:[
    {id:'mine',conversationId:'a',status:'completed',request:{kind:'read',path:'empty'},metadata:{empty:true,size:0}},
    {id:'other',conversationId:'b',status:'pending',stdout:'private-other-data'},
  ]}}, 'a');
  assert.match(context, /completed/);
  assert.match(context, /"empty":true/);
  assert.doesNotMatch(context, /private-other-data|"other"/);
  assert.match(runtimeResultContext({requests:[]},'a'),/没有本地操作记录/);
});

test('context bounds records and output and prefers latest results', () => {
  const requests=Array.from({length:15},(_,i)=>({id:String(i),conversationId:'a',finishedAt:String(i).padStart(2,'0'),stdout:'x'.repeat(2000)}));
  const context=runtimeResultContext({requests},'a');
  const records=JSON.parse(context.slice(context.indexOf('[{')));
  assert.equal(records.length,12);
  assert.equal(records[0].id,'14');
  assert.equal(records[0].stdout.length,1500);
});
