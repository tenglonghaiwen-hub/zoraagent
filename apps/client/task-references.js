// Recover only the originating Agent task, never an unrelated recent upload.
export function recoverTaskReferences(message,messages){
 if(message.references?.length)return message.references;
 const index=messages.indexOf(message);
 const candidates=messages.slice(0,index<0?messages.length:index).filter(m=>
  m.references?.length&&m.tasks?.some(t=>t.prompt===message.text&&t.modelId===message.modelId));
 if(candidates.length!==1)return [];
 return [...candidates[0].references];
}
