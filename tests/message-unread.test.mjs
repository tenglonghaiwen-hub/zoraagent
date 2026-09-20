import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageReadState,messageBadgeText} from '../apps/client/message-unread.js';
test('badge formats zero, counts and 99+ without counting duplicates',()=>{
 const state=createMessageReadState({getItem:()=>null,setItem(){}},'a');
 assert.equal(state.count([{id:1},{id:1},{id:2}]),2);
 assert.equal(messageBadgeText(0),'');assert.equal(messageBadgeText(1),'');assert.equal(messageBadgeText(2),'2');assert.equal(messageBadgeText(99),'99');assert.equal(messageBadgeText(100),'99+');
});
test('read IDs persist across reloads and remain isolated between accounts',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let state=createMessageReadState(storage,'alice');const messages=[{id:'a'},{id:'b'}];
 assert.equal(state.count(messages),2);state.markRead(messages);assert.equal(state.count(messages),0);
 state=createMessageReadState(storage,'alice');assert.equal(state.count([...messages,{id:'c'}]),1);
 assert.equal(createMessageReadState(storage,'bob').count(messages),2);
});
test('storage errors do not prevent current-window read tracking',()=>{
 const state=createMessageReadState({getItem(){throw Error('unavailable');},setItem(){throw Error('full');}},'a');
 state.markRead([{id:'a'}]);assert.equal(state.count([{id:'a'},{id:'b'}]),1);
});
