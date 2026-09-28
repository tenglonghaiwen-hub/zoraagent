import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRunner} from '../packages/agent/tools.mjs';
import {scopeRuntimeState} from '../packages/agent/runtime-scope.mjs';
import {branchMessage,canRecoverConversation} from '../apps/client/conversation-runtime.js';

const state={ok:true,data:{available:true,requests:[{id:'foreign-request',conversationId:'old',status:'completed'}],workflows:[{id:'foreign-failed-workflow',conversationId:'old',steps:[{status:'failed'}]}],codexActivities:[{conversationId:'old',text:'private old reply'}]}};
test('new conversation status cannot consume another conversation failure via either tool',async()=>{
 const runner=createToolRunner({conversationId:'new',callApi:async()=>state});
 for(const [name,args] of [['local_runtime_status',{}],['call_api',{method:'GET',path:'/api/local-runtime'}]]){
  const result=await runner(name,args);
  assert.equal(result.data.available,true);
  assert.deepEqual(result.data.requests,[]);
  assert.deepEqual(result.data.workflows,[]);
  assert.deepEqual(result.data.codexActivities,[]);
  assert.doesNotMatch(JSON.stringify(result),/foreign-|private old reply/);
 }
 assert.equal(state.data.workflows.length,1);
});
test('scope retains own status and excludes ownerless records',()=>{
 const result=scopeRuntimeState({requests:[{conversationId:'new',status:'completed'},{status:'pending'}]},'new');
 assert.equal(result.requests.length,1);
 assert.equal(result.requests[0].status,'completed');
 assert.deepEqual(scopeRuntimeState(state,undefined).data.requests,[]);
});
test('branch messages never recover parent backend identity; running own requests still recover',()=>{
 const parent={id:'original',answer:'old reply',pending:false};
 const copied=branchMessage(parent,'new-message');
 assert.equal(copied.answer,parent.answer);
 assert.equal(canRecoverConversation({},copied,{messageId:'original',conversationId:'parent'}),false);
 assert.equal(canRecoverConversation({},parent,{messageId:'original',conversationId:'parent'}),false);
 assert.equal(canRecoverConversation({backendId:'new'},{id:'m',recovering:true},{messageId:'m',conversationId:'old'}),false);
 assert.equal(canRecoverConversation({},{id:'m',recovering:true},{messageId:'m',conversationId:'new'}),true);
});
