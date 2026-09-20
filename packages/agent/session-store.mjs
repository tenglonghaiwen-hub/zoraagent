import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(id);
const text=value=>String(value??'').replace(/data:[^\s"']+;base64,[A-Za-z0-9+/=]+/gi,'[素材内容已省略]');
const taskFields=['modelId','kind','family','route','queryRoute','contentType','prompt','count','concurrency','ratio','resolution','duration','videoMode','operation','apiRoute','provider','projectId','tool','status','createdAt','paused','fromAgent'];
function safeHistory(history){
 return history.map(m=>{
  if(m.role==='user')return {role:'user',text:text(m.text),skills:Array.isArray(m.skills)?m.skills.map(text):[],references:Array.isArray(m.references)?m.references.map(r=>({name:text(r.name),type:text(r.type),reference:text(r.reference),hasContent:!!r.hasContent,...(/^[a-f0-9]{64}$/.test(r.fingerprint||'')?{fingerprint:r.fingerprint}:{})})):[]};
  if(m.role==='assistant')return {role:'assistant',reply:text(m.reply),tasks:Array.isArray(m.tasks)?m.tasks.map(t=>Object.fromEntries(taskFields.filter(k=>['string','number','boolean'].includes(typeof t[k])).map(k=>[k,typeof t[k]==='string'?text(t[k]):t[k]]))):[]};
  throw Error('会话历史角色无效');
 });
}
function parseSession(raw,id){
 const data=JSON.parse(raw);
 if(!validId(data.id)||data.id!==id||!Array.isArray(data.history))throw Error('会话记录格式无效');
 return {id:data.id,history:safeHistory(data.history)};
}

/** Per-session atomic JSON. Only whitelisted conversational data, never API configuration or media bytes. */
export function createSessionStore({directory,fsImpl=fs}={}){
 const sessions=new Map(),warnings=[];
 if(!directory)return {sessions,save:session=>{sessions.set(session.id,session);return '';},warnings};
 fsImpl.mkdirSync(directory,{recursive:true});
 const ids=new Set(fsImpl.readdirSync(directory).filter(n=>/\.json(?:\.bak)?$/.test(n)).map(n=>n.replace(/\.json(?:\.bak)?$/,'')));
 for(const id of ids){
  if(!validId(id))continue;
  const file=path.join(directory,id+'.json');
  try{sessions.set(id,parseSession(fsImpl.readFileSync(file,'utf8'),id));}
  catch{
   try{sessions.set(id,parseSession(fsImpl.readFileSync(file+'.bak','utf8'),id));warnings.push(`会话 ${id} 已从上一份有效记录恢复`);}
   catch{warnings.push(`会话 ${id} 记录损坏，未覆盖原文件`);}
  }
 }
 function save(session){
  sessions.set(session.id,session);
  try{
   if(!validId(session.id))throw Error('会话编号无效');
   const file=path.join(directory,session.id+'.json');
   const serialized=JSON.stringify({version:1,id:session.id,history:safeHistory(session.history),updatedAt:new Date().toISOString()});
   const tmp=file+'.'+randomUUID()+'.tmp';
   fsImpl.writeFileSync(tmp,serialized,'utf8');
   // Preserve only a valid old version; a corrupt primary must not replace a usable backup.
   if(fsImpl.existsSync(file)){
    let valid=false;try{parseSession(fsImpl.readFileSync(file,'utf8'),session.id);valid=true;}catch{}
    if(valid){const backupTmp=file+'.'+randomUUID()+'.bak.tmp';fsImpl.copyFileSync(file,backupTmp);fsImpl.renameSync(backupTmp,file+'.bak');}
   }
   fsImpl.renameSync(tmp,file);
   return '';
  }catch(e){const warning='会话保存失败；当前回复仍保留在内存，重启后可能恢复到上一轮：'+String(e.message||e);warnings.push(warning);return warning;}
 }
 return {sessions,save,warnings};
}
