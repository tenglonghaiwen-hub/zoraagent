import {execFile} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../../scripts/windows-desktop.ps1',import.meta.url));
const actions=new Set(['focus','openApp','captureWindow','listApps','launchApp','listWindows','launchJianying','readWindow','click','type','keys']);
const keys=new Set(['Enter','Escape','Tab','Backspace','Delete','Space','Up','Down','Left','Right','Home','End','PageUp','PageDown','Win','Ctrl+Escape','Ctrl+A','Ctrl+Z','Ctrl+Y','Ctrl+S']);
const execute=(file,args,options)=>new Promise((resolve,reject)=>{const {input,...opts}=options;const child=execFile(file,args,opts,(error,stdout,stderr)=>{if(error){reject(Error(String(stderr||error.message).slice(0,2000)));return;}resolve({stdout,stderr});});child.stdin.on('error',()=>{});child.stdin.end(input);});

export async function invokeDesktop(input={}, {execFileImpl=execute}={}){
 if(!actions.has(input.action))return {ok:false,error:'不支持的桌面操作'};
 const command={action:input.action};
 if(input.scope==='desktop')command.scope='desktop';
 if(input.action==='openApp'){if(typeof input.name!=='string'||!input.name.trim()||input.name.length>200)return {ok:false,error:'请提供应用名称'};command.name=input.name.trim();}
 if(input.action==='listApps'&&input.query!==undefined){if(typeof input.query!=='string'||input.query.length>100)return {ok:false,error:'应用搜索词无效'};command.query=input.query;}
 if(input.action==='launchApp'){if(typeof input.appId!=='string'||!input.appId||input.appId.length>500||/[\r\n\0]/.test(input.appId))return {ok:false,error:'请选择已枚举的应用编号'};command.appId=input.appId;}
 if(!['openApp','listApps','launchApp','listWindows','launchJianying'].includes(input.action)){
  if(typeof input.windowId!=='string'||!/^\d{1,20}$/.test(input.windowId)||BigInt(input.windowId)===0n)return {ok:false,error:'请先读取桌面窗口，定位真实目标'};
  command.windowId=input.windowId;
 }
 if(input.action==='click'){
  if(!Number.isInteger(input.x)||!Number.isInteger(input.y)||input.x<0||input.y<0||input.x>20000||input.y>20000)return {ok:false,error:'点击坐标必须是窗口内非负整数'};
  command.x=input.x;command.y=input.y;
 }
 if(input.action==='type'){
  if(typeof input.text!=='string'||!input.text||input.text.length>8000||input.text.includes('\0'))return {ok:false,error:'输入文字需为 1–8000 字符'};
  command.text=input.text;
 }
 if(input.action==='keys'){
  if(!keys.has(input.key))return {ok:false,error:'不支持该按键组合'};
  command.key=input.key;
 }
 try{
  const executable=path.join(process.env.SystemRoot||'C:/Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const result=await execFileImpl(executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,timeout:20000,maxBuffer:8*1024*1024,encoding:'utf8',input:JSON.stringify(command)});
  const output=JSON.parse(String(result.stdout||'').replace(/^\uFEFF/,''));
  if(!output||typeof output.ok!=='boolean')throw Error('桌面驱动响应无效');return output;
 }catch(e){return {ok:false,error:'桌面驱动失败：'+String(e.message||e).slice(0,2000)};}
}
