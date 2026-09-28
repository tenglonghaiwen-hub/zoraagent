import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TRANSCRIPT_MODELS} from './om-preferences.mjs';
import {omChildEnvironment} from './om-policy.mjs';
const states=new Map();let running;
export async function transcriptionPreparation(model,action='status'){
 if(!TRANSCRIPT_MODELS.includes(model)||!['status','check','download'].includes(action))throw Error('模型或操作无效');
 if(action==='status')return states.get(model)||{phase:'unchecked',message:'尚未检查模型缓存'};
 if(running)throw Error('已有模型准备任务正在执行');
 running={kill(){}};
 let proxyEnv={};
 try{if(action==='download'&&process.env.ZORA_CLOUD_RELAY){const res=await fetch(process.env.ZORA_CLOUD_RELAY+'/api/_local/model-proxy',{signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('无法读取模型下载代理，请重启客户端');const {proxy}=await res.json();proxyEnv=modelProxyEnvironment(proxy);}}catch(error){running=null;states.set(model,{phase:'error',message:error.message});return states.get(model);}
 const vendor=process.env.OM_VENDOR_ROOT||fileURLToPath(new URL('../../vendor/openmontage',import.meta.url));
 const child=spawn(path.join(vendor,'runtime/python/python.exe'),[path.join(vendor,'scripts/prepare_transcription.py'),model,action],{
  windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...omChildEnvironment(process.env),PYTHONUTF8:'1',PYTHONNOUSERSITE:'1',HF_HUB_DISABLE_IMPLICIT_TOKEN:'1',HF_HUB_DISABLE_XET:'1',...proxyEnv},
 });
 let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4096);});
 running=child;states.set(model,{phase:action==='download'?'downloading':'checking',message:action==='download'?'连接模型下载服务…':'检查本地缓存…'});
 let buffer='';child.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop().slice(-8192);for(const line of lines){try{const result=JSON.parse(line);if(['downloading','verifying','ready','missing','error'].includes(result.phase))states.set(model,result);}catch{}}});
 const timer=setTimeout(()=>{child.kill();states.set(model,{phase:'error',message:'准备超时，请重试；已下载缓存会保留'});},30*60*1000);timer.unref();
 child.on('error',()=>states.set(model,{phase:'error',message:'无法启动包内模型准备程序'}));
 child.on('close',()=>{clearTimeout(timer);running=null;const state=states.get(model);if(!['ready','missing','error'].includes(state.phase))states.set(model,{phase:'error',message:'模型准备中断：'+(stderr.match(/(?:ModuleNotFoundError|ImportError|PermissionError|OSError|RuntimeError|SyntaxError)/)?.[0]||'程序未返回结果')+'；请检查包内运行库后重试'});});
 return states.get(model);
}
process.once('exit',()=>running?.kill());

export function modelProxyEnvironment(value){
 const first=String(value||'DIRECT').split(';')[0].trim();
 const cleared=Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'].map(k=>[k,'']));
 if(first==='DIRECT')return cleared;
 const match=/^(PROXY|HTTPS) ([a-zA-Z0-9.\-]+:\d+)$/.exec(first);
 if(!match)throw Error('当前模型下载代理类型不受支持，请在网络设置中使用 HTTP 混合代理端口');
 const proxy=(match[1]==='HTTPS'?'https':'http')+'://'+match[2];
 return {...cleared,HTTP_PROXY:proxy,HTTPS_PROXY:proxy};
}
