import fs from 'node:fs';
import path from 'node:path';
export function validateNetwork(value){
 if(!value||!['environment','direct','proxy'].includes(value.mode))throw Error('网络模式无效');
 let proxy='';
 if(value.mode==='proxy'){
  const url=new URL(value.proxy);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('请输入不含账号密码的 HTTP/HTTPS 代理地址，例如 http://127.0.0.1:7890');
  proxy=url.origin;
 }
 return {mode:value.mode,proxy};
}
export function readNetwork(directory){const file=path.join(directory,'network.json');return fs.existsSync(file)?validateNetwork(JSON.parse(fs.readFileSync(file,'utf8'))):{mode:'environment',proxy:''};}
export function saveNetwork(directory,value){const config=validateNetwork(value);fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'network.json');fs.writeFileSync(file+'.tmp',JSON.stringify(config));fs.renameSync(file+'.tmp',file);return config;}
export function applyNetwork(config,env){
 if(config.mode!=='environment')for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])delete env[key];
 if(config.mode==='proxy')env.HTTP_PROXY=env.HTTPS_PROXY=config.proxy;
 env.NO_PROXY=[env.NO_PROXY||env.no_proxy||'','localhost','127.0.0.1','::1'].filter(Boolean).join(',');
}
