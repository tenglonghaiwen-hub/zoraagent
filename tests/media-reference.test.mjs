import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMediaReference} from '../apps/client/media-reference.js';
test('large original image is passed unchanged without decoding or compression',async()=>{
 const contentUrl='data:image/png;base64,'+'A'.repeat(4_000_000);
 const result=await prepareMediaReference({contentUrl,type:'image/png'},()=>assert.fail('must not re-encode'));
 assert.equal(result.contentUrl,contentUrl);assert.equal(result.type,'image/png');
});
test('restored URL references do not pass file metadata to FileReader',async()=>{
 const result=await prepareMediaReference({file:{name:'a.png',type:'image/png'},url:'https://example.test/a.png'},()=>assert.fail('metadata is not a Blob'));
 assert.equal(result.contentUrl,'https://example.test/a.png');
});
test('missing original fails before submission; real files retain content',async()=>{
 await assert.rejects(prepareMediaReference({file:{name:'lost.png'}},()=>assert.fail()),/重新添加/);
 const file=new File(['original'],'a.png',{type:'image/png'});
 const result=await prepareMediaReference({file},async blob=>blob.text());assert.equal(result.contentUrl,'original');
});
