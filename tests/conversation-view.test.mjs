import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationDay,nearConversationBottom} from '../apps/client/conversation-view.js';
test('conversation dates show today, yesterday and real historic dates',()=>{
 const now=new Date(2026,8,20,12).getTime();
 assert.equal(conversationDay(now,now),'今天');
 assert.equal(conversationDay(new Date(2026,8,19,2).getTime(),now),'昨天');
 assert.equal(conversationDay(new Date(2026,0,1).getTime(),now),'2026/1/1');
 assert.equal(conversationDay(null,now),'历史记录');assert.equal(conversationDay('invalid',now),'历史记录');
});
test('follow threshold distinguishes bottom reading from history reading',()=>{
 assert(nearConversationBottom(1000,450,500));assert(!nearConversationBottom(1000,300,500));assert(nearConversationBottom(200,0,500));
});
