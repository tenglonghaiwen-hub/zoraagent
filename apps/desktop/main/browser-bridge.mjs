import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export function isPublicBrowserAddress(address){
 const value=String(address).replace(/^\[|\]$/g,'').toLowerCase();
 if(isIP(value)===4){const [a,b,c]=value.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));}
 if(isIP(value)===6)return /^[23]/.test(value)&&!/^2001:(?:db8|0)(?=:)|^2002:/.test(value);
 return false;
}
function basicURL(value){
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('浏览器只允许无凭据的公网 HTTP/HTTPS 地址');
 const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(!host||host==='localhost'||/\.(?:localhost|local|internal|lan)$/.test(host)||(!host.includes('.')&&!isIP(host)))throw Error('禁止本机或内部地址');
 if(isIP(host)&&!isPublicBrowserAddress(host))throw Error('禁止私网或保留地址');return url;
}
export async function validateBrowserURL(value,{lookupImpl=lookup}={}){
 const url=basicURL(value),host=url.hostname.replace(/^\[|\]$/g,'');
 if(!isIP(host)){
  let timer;try{const records=await Promise.race([lookupImpl(host,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS 查询超时')),4000);})]);if(!records.length||records.some(r=>!isPublicBrowserAddress(r.address)))throw Error('地址解析到私网或保留网络，已阻止');}finally{clearTimeout(timer);}
 }
 return url.href;
}
const READ_SCRIPT=`(()=>({title:document.title.slice(0,500),url:location.href,text:(document.body?.innerText||'').slice(0,20000),links:Array.from(document.querySelectorAll('a[href]')).map(a=>({text:(a.innerText||a.textContent||'').trim().slice(0,200),url:a.href})).filter(a=>/^https?:\\/\\//.test(a.url)).slice(0,40)}))()`;

export async function startBrowserBridge({directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../data'),electronImpl,lookupImpl=lookup}={}){
 const {BrowserWindow,session}=electronImpl||await import('electron');
 const token=randomBytes(32).toString('hex'),partition='zora-browser-'+randomUUID();
 const isolated=session.fromPartition(partition,{cache:false});let browser=null,busy=false,closed=false;
 isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
 isolated.on('will-download',event=>event.preventDefault());
 isolated.webRequest.onBeforeRequest({urls:['<all_urls>']},(details,callback)=>{validateBrowserURL(details.url,{lookupImpl}).then(()=>callback({cancel:false}),()=>callback({cancel:true}));});
 function window(){
  if(browser&&!browser.isDestroyed())return browser;
  browser=new BrowserWindow({width:1100,height:800,title:'Zora 独立浏览器',webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
  browser.setMenu?.(null);browser.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  browser.webContents.on('will-attach-webview',event=>event.preventDefault());
  for(const eventName of ['will-navigate','will-redirect'])browser.webContents.on(eventName,(event,url)=>{try{basicURL(url);}catch{event.preventDefault();}});
  browser.on('closed',()=>{browser=null;});return browser;
 }
 async function readPage(target){await validateBrowserURL(target.webContents.getURL(),{lookupImpl});let timer;try{return await Promise.race([target.webContents.executeJavaScript(READ_SCRIPT,true),new Promise((_,reject)=>{timer=setTimeout(()=>{if(!target.isDestroyed())target.destroy();reject(Error('网页读取超过 15 秒'));},15000);})]);}finally{clearTimeout(timer);}}
 async function command(input){
  if(!['open','search','read'].includes(input.action))throw Error('不支持的浏览器动作');
  if(input.action==='read'){if(!browser||browser.isDestroyed())throw Error('请先打开网页');return readPage(browser);}
  let url=input.url;
  if(input.action==='search'){if(typeof input.query!=='string'||!input.query.trim()||input.query.length>2000)throw Error('搜索内容需为 1–2000 字符');url='https://www.bing.com/search?q='+encodeURIComponent(input.query);}
  if(typeof url!=='string'||url.length>8000)throw Error('网页地址无效');
  url=await validateBrowserURL(url,{lookupImpl});const target=window();let timer;
  try{await Promise.race([target.loadURL(url),new Promise((_,reject)=>{timer=setTimeout(()=>{target.webContents.stop();reject(Error('网页导航超过 30 秒'));},30000);})]);}catch(e){if(!target.isDestroyed())target.destroy();throw Error('网页打开失败，旧页面已关闭：'+String(e.message||e));}finally{clearTimeout(timer);}
  target.show();return readPage(target);
 }
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const server=http.createServer(async(req,res)=>{
  const supplied=Buffer.from(String(req.headers.authorization||'')),expected=Buffer.from('Bearer '+token);
  if(req.headers.origin!==undefined||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send(res,403,{ok:false,error:'拒绝未授权浏览器请求'});
  if(req.method!=='POST'||req.url!=='/command')return send(res,404,{ok:false,error:'接口不存在'});
  if(busy||closed)return send(res,409,{ok:false,error:'浏览器正在处理另一条命令'});
  busy=true;
  try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw Error('命令体过大');chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!input||typeof input!=='object')throw Error('命令无效');const page=await command(input);send(res,200,{ok:true,page});}
  catch(e){send(res,400,{ok:false,error:String(e.message||e).slice(0,1000)});}finally{busy=false;}
 });
 server.requestTimeout=35000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'browser-bridge.json'),tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({port,token,pid:process.pid}),'utf8');fs.renameSync(tmp,file);
 return {port,close(){closed=true;server.close();if(browser&&!browser.isDestroyed())browser.destroy();},file};
}
