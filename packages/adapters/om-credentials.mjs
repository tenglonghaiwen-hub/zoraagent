import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
export const STOCK_CREDENTIALS={pexels:'PEXELS_API_KEY',unsplash:'UNSPLASH_ACCESS_KEY'};
function file(){return path.join(process.env.OM_STATE_DIR||process.env.ZORA_DATA_DIR||path.join(os.homedir(),'.zora'),'om-stock-credentials.json');}
function read(){return fs.existsSync(file())?JSON.parse(fs.readFileSync(file(),'utf8')):{};}
function protect(value,decrypt=false){
 if(process.platform!=='win32')throw new Error('当前密钥加密存储仅支持 Windows');
 const command=decrypt?'[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))':'[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))';
 const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const result=spawnSync(executable,['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; [void][Reflection.Assembly]::LoadWithPartialName('System.Security'); $v=[Console]::In.ReadToEnd(); "+command],{input:value,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});
 if(result.error||result.status!==0)throw new Error('Windows 密钥保护失败，请用保存密钥的 Windows 账户重试');
 return result.stdout.trim();
}
export function stockCredentialStatus(){const data=read();return Object.fromEntries(Object.keys(STOCK_CREDENTIALS).map(k=>[k,Boolean(data[k])]));}
export function saveStockCredentials(patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!Object.hasOwn(STOCK_CREDENTIALS,k)))throw new Error('密钥服务无效');
 const data=read();
 for(const [provider,value] of Object.entries(patch)){
  if(value===null){delete data[provider];continue;}
  if(typeof value!=='string'||value.trim().length<8||value.length>512||/\s/.test(value.trim()))throw new Error('密钥格式无效');
  data[provider]=protect(value.trim());
 }
 const target=file();fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(target+'.tmp',target);
 return stockCredentialStatus();
}
export function stockCredentialEnvironment(sources){
 const data=read(),env={};
 for(const source of sources||[]){const key=STOCK_CREDENTIALS[source];if(!key)continue;if(!data[source])throw new Error(`${source} 尚未配置密钥，请打开设置 → 本地媒体能力`);env[key]=protect(data[source],true);}
 return env;
}
