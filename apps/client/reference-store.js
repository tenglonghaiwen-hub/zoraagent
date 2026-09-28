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
 const file=ref.file;
 const storageId=ref.storageId||crypto.randomUUID();
 ref.storageId=storageId;
 const cached=pending.get(storageId);
 const work=cached?.file===file?cached.promise:(async()=>{if(cached)await cached.promise.catch(()=>{});const db=await open();await new Promise((resolve,reject)=>{
  const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,storageId);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });})();
 if(cached?.file!==file)pending.set(storageId,{file,promise:work});
 try{await work;}catch(error){const current=pending.get(storageId);if(current?.promise===work)pending.delete(storageId);if((!current||current.promise===work)&&ref.storageId===storageId&&ref.file===file)delete ref.storageId;throw error;}
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
