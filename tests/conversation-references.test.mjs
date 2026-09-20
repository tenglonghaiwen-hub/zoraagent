import test from 'node:test';
import assert from 'node:assert/strict';
import {selectConversationReferences as select} from '../apps/client/conversation-references.js';
const image={reference:'图片1',storageId:'original-photo',file:{name:'product.png',type:'image/png'}};
const video={reference:'视频1',storageId:'original-video'};
const initial={kind:'agent',references:[image,video]};
test('continuation retains the previously selected originals beyond ten turns and after serialization',()=>{
 const messages=JSON.parse(JSON.stringify([initial,...Array.from({length:25},()=>({kind:'agent',text:'继续修改',references:[]}))]));
 const result=select({messages,text:'按这个方案生成',inherit:true});
 assert(result.inherited);assert.deepEqual(result.references,[image,video]);
});
test('explicit current selection replaces old references and historical @ works without upload tray',()=>{
 const replacement={...image,storageId:'new-photo'};
 assert.deepEqual(select({messages:[initial],text:'使用 @图片1',explicit:[replacement],inherit:true}).references,[replacement]);
 assert.deepEqual(select({messages:[initial],text:'沿用 ＠视频1',inherit:false}).references,[video]);
});
test('disabled inheritance and a new conversation send no old or unselected assets',()=>{
 assert.deepEqual(select({messages:[initial],inherit:false}).references,[]);
 assert.deepEqual(select({messages:[],inherit:true}).references,[]);
 assert.deepEqual(select({messages:[{kind:'image',references:[image]}],inherit:true}).references,[]);
});
test('last selected set wins; generated media never changes originals; unknown @ is explicit error',()=>{
 const second={kind:'agent',references:[video]};
 assert.deepEqual(select({messages:[initial,second,{kind:'image',references:[image]}],inherit:true}).references,[video]);
 assert.throws(()=>select({messages:[initial],text:'@图片9'}),/找不到/);
});
