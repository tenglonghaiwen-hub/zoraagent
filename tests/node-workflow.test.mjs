import test from 'node:test';
import assert from 'node:assert/strict';
import {connectNodes,collectNodeInput} from '../apps/client/node-workflow.js';
test('multiple sources preserve text and media, and connections reject cycles',()=>{
 const nodes=[{id:'a',type:'text',prompt:'原始指令'},{id:'b',type:'text',outputText:'模型回复'},{id:'c',type:'res-image',imageData:'data:image/png;base64,AA=='},{id:'d',type:'res-video',prompt:'镜头向前'}];
 for(const id of ['a','b','c','a'])connectNodes(nodes,id,'d');
 assert.equal(nodes[3].inputs.length,3);
 assert.deepEqual(collectNodeInput(nodes,nodes[3]),{prompt:'原始指令\n\n模型回复\n\n镜头向前',references:[{name:'c',type:'image/png',contentUrl:'data:image/png;base64,AA==',role:'agent-auto-infer'}]});
 assert.throws(()=>connectNodes(nodes,'d','a'),/循环/);assert.throws(()=>connectNodes(nodes,'a','a'),/循环/);
 nodes[2].runState='failed';assert.throws(()=>collectNodeInput(nodes,nodes[3]),/上游/);
 nodes.splice(2,1);assert.throws(()=>collectNodeInput(nodes,nodes[2]),/已删除/);
});
