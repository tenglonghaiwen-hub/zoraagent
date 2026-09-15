import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function createWorkflowStore({directory,runtime}){
 fs.mkdirSync(directory,{recursive:true});const records=new Map();let busy=false;
 const save=r=>{const f=path.join(directory,r.id+'.json');fs.writeFileSync(f+'.tmp',JSON.stringify(r));fs.renameSync(f+'.tmp',f);records.set(r.id,r);};
 for(const f of fs.readdirSync(directory)){if(!f.endsWith('.json'))continue;try{const r=JSON.parse(fs.readFileSync(path.join(directory,f)));if(/^[\w-]+$/.test(r.id)&&Array.isArray(r.steps)){for(const s of r.steps)if(s.status==='issuing'){s.status='unknown';s.error='提交步骤时服务中断，未自动重放';}records.set(r.id,r);}}catch{}}
 function create({steps,conversationId,messageId}){
  if(!Array.isArray(steps)||!steps.length)throw Error('工作流至少需要一个步骤');
  const ids=new Set(steps.map(s=>s.id));if(ids.size!==steps.length||steps.some(s=>typeof s.id!=='string'||!s.id))throw Error('步骤编号无效或重复');
  const seen=new Set(),active=new Set();function visit(id){if(active.has(id))throw Error('工作流存在循环');if(seen.has(id))return;active.add(id);const step=steps.find(s=>s.id===id);for(const d of step.dependsOn||[]){if(!ids.has(d))throw Error('依赖步骤不存在');visit(d);}active.delete(id);seen.add(id);}steps.forEach(s=>visit(s.id));
  const r={messageId:typeof messageId==='string'?messageId.slice(0,100):undefined,id:randomUUID(),createdAt:Date.now(),conversationId:typeof conversationId==='string'?conversationId.slice(0,100):undefined,steps:steps.map(s=>({id:s.id,dependsOn:s.dependsOn||[],request:s.request,status:'pending'}))};save(r);return r;
 }
 async function tick(){if(busy)return;busy=true;try{for(const r of records.values()){
  for(const s of r.steps){
   if(s.requestId){const q=runtime.list({includeDeleted:true}).find(q=>q.id===s.requestId);if(q)s.status=q.status;continue;}
   if(s.status!=='pending')continue;
   const dependencies=s.dependsOn.map(id=>r.steps.find(t=>t.id===id));
   if(dependencies.some(d=>['failed','denied','unknown','blocked'].includes(d.status))){s.status='blocked';s.error='依赖未成功，未执行';continue;}
   if(dependencies.some(d=>d.status!=='completed'))continue;
   // Save the intent first: interrupted issuance is never replayed automatically.
   s.status='issuing';save(r);
   try{const q=runtime.propose({...s.request,conversationId:r.conversationId,messageId:r.messageId});s.requestId=q.id;s.status=q.status;}catch(e){s.status='failed';s.error=e.message;}
  }save(r);
 }}finally{busy=false;}}
 return {create,tick,list:()=>[...records.values()]};
}
