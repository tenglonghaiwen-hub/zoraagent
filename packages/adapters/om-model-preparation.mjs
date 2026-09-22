import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TRANSCRIPT_MODELS} from './om-preferences.mjs';
import {omChildEnvironment} from './om-policy.mjs';
const states=new Map();let running;
export function transcriptionPreparation(model,action='status'){
 if(!TRANSCRIPT_MODELS.includes(model)||!['status','check','download'].includes(action))throw Error('模型或操作无效');
 if(action==='status')return states.get(model)||{phase:'unchecked',message:'尚未检查模型缓存'};
 if(running)throw Error('已有模型准备任务正在执行');
 const vendor=process.env.OM_VENDOR_ROOT||fileURLToPath(new URL('../../vendor/openmontage',import.meta.url));
 const child=spawn(path.join(vendor,'runtime/python/python.exe'),[path.join(vendor,'scripts/prepare_transcription.py'),model,action],{
  windowsHide:true,stdio:['ignore','pipe','ignore'],env:{...omChildEnvironment(process.env),PYTHONUTF8:'1',PYTHONNOUSERSITE:'1',HF_HUB_DISABLE_IMPLICIT_TOKEN:'1'},
 });
 running=child;states.set(model,{phase:action==='download'?'downloading':'checking',message:action==='download'?'连接模型下载服务…':'检查本地缓存…'});
 let buffer='';child.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop().slice(-8192);for(const line of lines){try{const result=JSON.parse(line);if(['downloading','verifying','ready','missing','error'].includes(result.phase))states.set(model,result);}catch{}}});
 const timer=setTimeout(()=>{child.kill();states.set(model,{phase:'error',message:'准备超时，请重试；已下载缓存会保留'});},30*60*1000);timer.unref();
 child.on('error',()=>states.set(model,{phase:'error',message:'无法启动包内模型准备程序'}));
 child.on('close',()=>{clearTimeout(timer);running=null;const state=states.get(model);if(!['ready','missing','error'].includes(state.phase))states.set(model,{phase:'error',message:'模型准备中断，请重试'});});
 return states.get(model);
}
process.once('exit',()=>running?.kill());
