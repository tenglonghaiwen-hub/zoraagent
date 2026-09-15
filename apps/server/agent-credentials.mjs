import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
export function loadStoredAgentKey(root,{env=process.env,platform=process.platform,exists=fs.existsSync,exec=execFileSync}={}){
 if(env.ZORA_AGENT_API_KEY)return 'environment';
 const file=path.join(root,'runtime','agent-key.dpapi');
 if(!exists(file))return 'fallback';
 if(platform!=='win32')throw Error('主 Agent 加密凭据需要 Windows 当前用户解密');
 try{
  const script="$ErrorActionPreference='Stop'; [void][Reflection.Assembly]::LoadWithPartialName('System.Security'); $hex=([IO.File]::ReadAllText($env:ZORA_STORED_KEY_FILE)).Trim(); $bytes=[byte[]]::new($hex.Length/2); for($i=0;$i -lt $bytes.Length;$i++){$bytes[$i]=[Convert]::ToByte($hex.Substring($i*2,2),16)}; $plain=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::Unicode.GetString($plain))";
  const childEnv={...env,ZORA_STORED_KEY_FILE:file};for(const name of Object.keys(childEnv))if(name.toLowerCase()==='psmodulepath')delete childEnv[name];
  const key=exec(path.join(env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:childEnv,windowsHide:true,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim();
  if(!key)throw Error();env.ZORA_AGENT_API_KEY=key;return 'encrypted-store';
 }catch{throw Error('无法解密主 Agent 已保存凭据，请使用原 Windows 用户启动或重新配置凭据');}
}
