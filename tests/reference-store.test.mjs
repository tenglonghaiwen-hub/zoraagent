import test from 'node:test';
import assert from 'node:assert/strict';

test('failed cache writes clear the uncommitted storage ID and can be retried',async()=>{
 const original=globalThis.indexedDB;
 let shouldFail=true;
 let writes=0;
 const db={transaction(){
  const tx={error:null,objectStore(){return {put(){writes++;queueMicrotask(()=>{
   if(shouldFail){tx.error=Error('Internal error.');tx.onerror();}
   else tx.oncomplete();
  });}};}};
  return tx;
 }};
 globalThis.indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
 try{
  const {saveReference}=await import(`../apps/client/reference-store.js?failure-test=${Date.now()}`);
  const ref={file:new File(['pixels'],'portrait.png',{type:'image/png'})};
  await assert.rejects(saveReference(ref),/Internal error/);
  assert.equal(ref.storageId,undefined);
  shouldFail=false;
  await saveReference(ref);
  assert.ok(ref.storageId);
  await saveReference(ref);
  assert.equal(writes,2,'a successful cached file is not written again');
 }finally{globalThis.indexedDB=original;}
});
