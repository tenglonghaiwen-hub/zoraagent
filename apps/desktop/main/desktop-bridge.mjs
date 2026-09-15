import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {invokeDesktop} from '../../../packages/desktop/windows-driver.mjs';
export async function startDesktopBridge({directory,dialog,invokeImpl=invokeDesktop}){
 const token=randomBytes(32).toString('hex');let busy=false;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{
  const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(req.headers.origin!==undefined||actual.length!==expected.length||!timingSafeEqual(actual,expected))return send(res,403,{error:'拒绝未授权桌面请求'});
  if(req.method!=='POST'||req.url!=='/command')return send(res,404,{error:'接口不存在'});
  if(busy)return send(res,409,{error:'桌面操作正在等待确认或执行'});
  busy=true;
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>12000)throw Error('请求过长');chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!['listWindows','launchJianying','readWindow','click','type','keys'].includes(input.action))throw Error('桌面操作不支持');
   if(!['listWindows','readWindow'].includes(input.action)){
    const approval=await dialog.showMessageBox({type:'question',title:'Zora 桌面操作确认',message:'Agent 请求操作剪映',detail:JSON.stringify(input,null,2)+'\n\n请确认目标与内容。该操作会作用于本机剪映窗口。',buttons:['取消','允许本次操作'],defaultId:0,cancelId:0,noLink:true});
    if(approval.response!==1)return send(res,200,{ok:false,status:'denied',error:'用户取消了本次桌面操作'});
   }
   send(res,200,await invokeImpl(input));
  }catch(e){send(res,400,{ok:false,error:String(e.message).slice(0,1200)});}finally{busy=false;}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 fs.mkdirSync(directory,{recursive:true});const target=path.join(directory,'desktop-bridge.json');fs.writeFileSync(target,JSON.stringify({port:server.address().port,token,pid:process.pid}));
 return {close(){server.close();}};
}
