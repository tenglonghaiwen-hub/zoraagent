import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGenerationInput,assertConfiguredOperation} from '../packages/contracts/model-capability.mjs';
const model={id:'tt-image-2.5',kind:'image',provider:'custom',route:'/v1/images/generations',capability:{version:1,template:'gpt-image',modes:['t2i'],maxCount:1}};
test('legacy image request with stale duration remains an image',()=>{
 const input={modelId:model.id,prompt:'portrait',duration:5,ratio:'1:1',resolution:'1K'};
 const normalized=normalizeGenerationInput(model,input);
 assert.equal(normalized.kind,'image');assert.equal(normalized.duration,undefined);assert.equal(input.duration,5);
 assert.equal(assertConfiguredOperation(model,normalized).status,'ready');
});
test('explicit wrong kind remains rejected',()=>{
 for(const input of [{kind:'video'},{type:'video'},{kind:'image',type:'video'}])assert.throws(()=>normalizeGenerationInput(model,input),/请求类型/);
});
test('video model without duration remains video and keeps supplied duration',()=>{
 assert.equal(normalizeGenerationInput({kind:'video'},{}).kind,'video');
 assert.equal(normalizeGenerationInput({kind:'video'},{duration:5}).duration,5);
});
