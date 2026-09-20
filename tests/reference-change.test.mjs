import test from 'node:test';
import assert from 'node:assert/strict';
import {describeReferenceChange} from '../packages/agent/reference-change.mjs';
const a={name:'product.png',reference:'图片1',type:'image/png',contentUrl:'data:image/png;base64,YQ=='};
const b={...a,contentUrl:'data:image/png;base64,Yg=='};
const history=refs=>[{role:'user',references:describeReferenceChange(refs).current}];
test('same filename with new image content requires prompt review; metadata contains no image bytes',()=>{
 const result=describeReferenceChange([b],history([a]));
 assert.equal(result.change.kind,'replaced');assert(result.change.requiresPromptReview);
 assert(!JSON.stringify(result).includes('base64'));
 assert.equal(describeReferenceChange([a],history([a])).change.kind,'unchanged');
});
test('added references and changed reference roles are distinguished',()=>{
 assert.equal(describeReferenceChange([a,{...b,reference:'图片2'}],history([a])).change.kind,'added');
 assert.equal(describeReferenceChange([{...a,reference:'图片2'}],history([a])).change.kind,'remapped');
 assert.equal(describeReferenceChange([],history([a])).change.kind,'none');
});
test('legacy history lacking fingerprints requires review rather than assuming unchanged',()=>{
 const old=[{role:'user',references:[{name:a.name,reference:a.reference,hasContent:true}]}];
 assert.equal(describeReferenceChange([a],old).change.kind,'unverified');
 assert(describeReferenceChange([a],old).change.requiresPromptReview);
});
