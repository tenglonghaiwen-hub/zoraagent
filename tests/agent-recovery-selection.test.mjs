import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {selectTaskSkills} from '../packages/agent/skill-selection.mjs';import {CodexKernel} from '../packages/agent/codex-kernel.mjs';
test('independent media turn starts a new backend thread without resuming the old task',async()=>{
 const k=new CodexKernel({home:fs.mkdtempSync(path.join(os.tmpdir(),'zora-fresh-thread-'))});
 k.threadMap['conversation-test']='old-thread';
 k.start=async()=>{};
 const calls=[];
 k.request=async(method,params)=>{
  calls.push({method,params});
  if(method==='thread/start')return {thread:{id:'new-thread'}};
  if(method==='turn/start'){
   queueMicrotask(()=>k.active.get(params.threadId)?.resolve({text:'{"reply":"ok","tasks":[]}',toolTrace:[]}));
   return {turn:{id:'new-turn'}};
  }
  throw Error('unexpected request: '+method);
 };
 const result=await k.run('new task',{conversationId:'conversation-test',freshThread:true});
 assert.equal(result.codexThreadId,'new-thread');
 assert.equal(k.threadMap['conversation-test'],'new-thread');
 assert.deepEqual(calls.map(call=>call.method),['thread/start','turn/start']);
});
test('skill selection respects explicit models, selected skills and opt out',()=>{const explicit=[{id:'custom'}];assert.deepEqual(selectTaskSkills('复刻视频',explicit),explicit);assert.deepEqual(selectTaskSkills('不用技能，复刻视频'),[]);assert.ok(selectTaskSkills('MiniMax H3 复刻视频',[],[{id:'MiniMax-H3',name:'MiniMax H3',kind:'video',enabled:true}]).some(s=>s.id==='codex:minimax-h3-video-prompt'));assert.deepEqual(selectTaskSkills('复刻视频'),[]);assert.deepEqual(selectTaskSkills('你好'),[]);const h3=[{id:'codex:minimax-h3-video-prompt',name:'MiniMax H3 视频提示词'},{id:'codex:minimax-h3-action-transfer',name:'MiniMax H3 动作迁移'}];assert.deepEqual(selectTaskSkills('使用万相3.0复刻视频',h3,[{id:'wan3.0',name:'万相 3.0',family:'lk-wan3',kind:'video',enabled:true}]),[]);assert.deepEqual(selectTaskSkills('复刻视频',h3,[{id:'wan3.0',name:'万相 3.0',family:'lk-wan3',kind:'video',enabled:true}]),[]);});
test('a later explicit Wan choice wins over a rejected MiniMax mention',()=>{
 const models=[{id:'MiniMax-H3',name:'MiniMax H3',kind:'video',enabled:true},{id:'wan3.0',name:'万相 3.0',kind:'video',enabled:true}];
 const h3=[{id:'codex:minimax-h3-video-prompt',name:'MiniMax H3 视频提示词'}];
 assert.deepEqual(selectTaskSkills('不要用 MiniMax H3，使用万相3.0复刻视频',h3,models),[]);
 assert.deepEqual(selectTaskSkills('使用万相3.0复刻视频',[],models),[]);
});
test('restart restores records without replaying interrupted turns or approvals',async()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'zora-recovery-'));const k=new CodexKernel({home});k.activities.set('t',{threadId:'t',conversationId:'c',messageId:'m',status:'running',text:'progress'});k.approvals.set('a',{id:'a',rpcId:123,status:'pending',threadId:'t'});k.persistExecution();const restored=new CodexKernel({home});assert.equal(restored.listActivities()[0].status,'unknown');assert.equal(restored.listActivities()[0].text,'progress');assert.equal(restored.listApprovals()[0].status,'expired');assert.throws(()=>restored.decide('a','approve'));assert.equal(restored.active.size,0);});

import {disabledTools,setToolEnabled} from '../packages/agent/tool-preferences.mjs';
test('tool preferences persist, reject unknown tools and detect corruption',()=>{const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'zora-tools-')),'prefs.json');setToolEnabled('browser_read',false,['browser_read'],file);assert.ok(disabledTools(file).has('browser_read'));setToolEnabled('browser_read',true,['browser_read'],file);assert.equal(disabledTools(file).size,0);assert.throws(()=>setToolEnabled('unknown',true,['browser_read'],file));fs.writeFileSync(file,'broken');assert.throws(()=>disabledTools(file));});
