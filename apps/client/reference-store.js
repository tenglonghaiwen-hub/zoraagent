let database;
const pending=new Map();
function open(){
 return database||=(new Promise((resolve,reject)=>{
  const request=indexedDB.open('zora.referenceFiles.v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 })).catch(error=>{database=null;throw error;});
}
export async function saveReference(ref){
 if(!(ref.file instanceof Blob))return;
 ref.storageId||=crypto.randomUUID();
 if(pending.has(ref.storageId))return pending.get(ref.storageId);
 const work=(async()=>{const db=await open();await new Promise((resolve,reject)=>{
  const tx=db.transaction('files','readwrite');tx.objectStore('files').put(ref.file,ref.storageId);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });})();
 pending.set(ref.storageId,work);
 try{await work;}catch(error){pending.delete(ref.storageId);throw error;}
}
export async function restoreReference(ref){
 if(!ref.storageId)return false;
 const db=await open();const blob=await new Promise((resolve,reject)=>{
  const request=db.transaction('files').objectStore('files').get(ref.storageId);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 if(!(blob instanceof Blob))return false;
 ref.file=new File([blob],ref.file?.name||'reference',{type:blob.type});
 ref.url=URL.createObjectURL(ref.file);return true;
}
