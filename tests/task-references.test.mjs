import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverTaskReferences} from '../apps/client/task-references.js';
test('old Agent task retry recovers only an unambiguous originating reference',()=>{
 const ref={storageId:'original'};
 const origin={references:[ref],tasks:[{prompt:'戴墨镜',modelId:'gpt-image-2'}]};
 const task={text:'戴墨镜',modelId:'gpt-image-2'};
 assert.deepEqual(recoverTaskReferences(task,[origin,task]),[ref]);
 assert.deepEqual(recoverTaskReferences(task,[{references:[ref]},task]),[]);
 assert.deepEqual(recoverTaskReferences(task,[origin,origin,task]),[]);
 assert.deepEqual(recoverTaskReferences({...task,references:[ref]},[]),[ref]);
});
