import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {prepareMediaReference} from '../apps/client/media-reference.js';

const source=readFileSync(new URL('../apps/client/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function prepareAgentReferences(');
const end=source.indexOf('async function submitMediaGeneration(',start);
assert.ok(start>=0&&end>start,'Agent reference preparation must exist');
const functionSource=source.slice(start,end);

function prepareWith(overrides={}){
 const failures=[];
 const failedReferenceFiles=new WeakSet();
 const context=createContext({
  Blob,
  models:[{id:'test-model',family:'gpt-image'}],
  $:()=>({value:'test-model'}),
  failedReferenceFiles,
  restoreReference:async()=>false,
  saveReference:async()=>{},
  reportReferenceCacheFailure:(ref,error)=>{failedReferenceFiles.add(ref.file);failures.push(error);},
  durableMediaUrl:url=>/^(https?:|data:)/.test(url||''),
  prepareMediaReference,
  fileToDataUrl:async file=>file.text(),
  ...overrides,
 });
 runInContext(`${functionSource}\nglobalThis.prepareAgentReferences=prepareAgentReferences;`,context);
 return {prepare:context.prepareAgentReferences,failures};
}

test('an IndexedDB cache failure does not block sending an attached original',async()=>{
 const file=new File(['original pixels'],'portrait.png',{type:'image/png'});
 let rejectCache;
 const {prepare,failures}=prepareWith({saveReference:()=>new Promise((_,reject)=>{rejectCache=reject;})});
 const result=await prepare([{reference:'图片1',file}]);
 assert.equal(result.length,1);
 assert.equal(result[0].contentUrl,'original pixels');
 assert.equal(result[0].reference,'图片1');
 rejectCache(Error('Internal error.'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(failures.length,1);
});

test('a missing original still stops submission before the API request',async()=>{
 const {prepare}=prepareWith();
 await assert.rejects(prepare([{reference:'图片1',storageId:'missing',file:{name:'portrait.png'}}]),/本机未找到已保存的原素材/);
});

test('a durable reference URL remains usable when the local cache cannot be opened',async()=>{
 const {prepare}=prepareWith({restoreReference:async()=>{throw Error('Internal error.');}});
 const result=await prepare([{reference:'图片1',storageId:'unreadable',file:{name:'portrait.png',type:'image/png'},url:'https://example.test/portrait.png'}]);
 assert.equal(result[0].contentUrl,'https://example.test/portrait.png');
});
