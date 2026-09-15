import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {createWorkspaceArtifacts} from './workspace-artifacts.mjs';
import {fileURLToPath} from 'node:url';
const runFile=(file,args,options={})=>new Promise((resolve,reject)=>{const {input,...opts}=options;const child=execFile(file,args,opts,(error,stdout,stderr)=>{if(error){Object.assign(error,{stdout,stderr});reject(error);}else resolve({stdout,stderr});});child.stdin?.on('error',()=>{});child.stdin?.end(input||'');});
const MAX_OUTPUT=64*1024;
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sensitive=name=>/^\.env(?:\.|$)|^(?:\.git|node_modules|credentials|secrets|id_rsa|id_ed25519)(?:\.|$)|\.(?:pem|key|p12|pfx)$/i.test(name);
const inside=(parent,child)=>{const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const hash=request=>createHash('sha256').update(JSON.stringify(request)).digest('hex');
const safePath=value=>{
 if(typeof value!=='string'||!value||value.length>1000||value.includes('\0')||value.includes('\\')||path.posix.isAbsolute(value)||/^[A-Za-z]:/.test(value))throw Error('仅允许工作区内相对路径');
 const parts=value.split('/');if(parts.some(p=>!p||p==='.'||p==='..'||sensitive(p)))throw Error('路径包含受限名称或越界片段');return parts.join('/');
};

/** Docker-only, host-approved local operations. No credentials or host shell are forwarded. */
export function createLocalRuntime({directory,workspaceRoot,dockerImage='alpine:3.20',execFileImpl=runFile}={}){
 if(!directory||!workspaceRoot)throw Error('必须配置独立审批目录与独立运行工作区');
 const ledger=path.resolve(directory),workspace=path.resolve(workspaceRoot);
 if(workspace===path.parse(workspace).root||inside(workspace,ledger)||inside(ledger,workspace))throw Error('工作区与审批目录必须独立，禁止挂载根目录');
 if(typeof dockerImage!=='string'||!dockerImage||dockerImage.startsWith('-')||/\s/.test(dockerImage))throw Error('Docker 镜像配置无效');
 fs.mkdirSync(ledger,{recursive:true});fs.mkdirSync(workspace,{recursive:true});
 const records=new Map();
 const persist=record=>{const target=path.join(ledger,record.id+'.json'),tmp=target+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(record),'utf8');fs.renameSync(tmp,target);records.set(record.id,record);};
 const view=r=>{if(!r)return null;const {request,...rest}=r;return {...rest,request:{...request}};};
 function checkWorkspace(){
  for(let current=workspace;;current=path.dirname(current)){if(fs.lstatSync(current).isSymbolicLink())throw Error('运行工作区不能经过符号链接');if(current===path.dirname(current))break;}
  if(path.relative(projectRoot,workspace)==='')throw Error('运行工作区必须是独立目录，不能使用 Zora 项目根目录');
  let count=0;const scan=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(++count>10000)throw Error('运行工作区文件数量超过检查上限');const file=path.join(dir,entry.name);if(sensitive(entry.name)||entry.isSymbolicLink())throw Error('运行工作区包含受限文件或链接，未挂载');if(entry.isDirectory())scan(file);}};scan(workspace);
 }
 checkWorkspace();
 for(const name of fs.readdirSync(ledger)){
  if(!name.endsWith('.json'))continue;
  try{const record=JSON.parse(fs.readFileSync(path.join(ledger,name),'utf8'));if(!validId(record.id)||name!==record.id+'.json'||record.requestHash!==hash(record.request))continue;
   if(record.status==='consumed'){record.status='unknown';record.error='服务中断，执行结果未知；审批已消费，未自动重放';persist(record);}else records.set(record.id,record);
  }catch{/* A damaged approval is never executable. */}
 }
 async function status(){
  try{checkWorkspace();await execFileImpl('docker',['version','--format','{{.Server.Version}}'],{timeout:5000,maxBuffer:MAX_OUTPUT,windowsHide:true});await execFileImpl('docker',['image','inspect',dockerImage],{timeout:5000,maxBuffer:MAX_OUTPUT,windowsHide:true});return {available:true,backend:'docker',dockerImage,workspaceRoot:workspace,network:'none'};}
  catch(e){return {available:false,backend:'docker',dockerImage,workspaceRoot:workspace,network:'none',status:'blocked',error:'Docker 或本地镜像未就绪：'+String(e.message||e)};}
 }
 function propose(input={}){
  if(!['read','write','exec','list','search'].includes(input.kind))throw Error('不支持的本地操作');
  checkWorkspace();
  const request={kind:input.kind,workspaceRoot:workspace,dockerImage};
  if(input.kind==='exec'){if(typeof input.command!=='string'||!input.command.trim()||input.command.length>8000||input.command.includes('\0'))throw Error('命令长度需为 1–8000 字符');request.command=input.command;}
  else {request.path=['list','search'].includes(input.kind)&&(input.path===undefined||input.path==='.')?'.':safePath(input.path);if(input.kind==='write'){if(typeof input.content!=='string'||Buffer.byteLength(input.content)>1024*1024)throw Error('写入内容不能超过 1 MiB');request.content=input.content;}if(input.kind==='search'){if(typeof input.query!=='string'||!input.query||input.query.length>2000||input.query.includes('\0'))throw Error('搜索内容需为 1–2000 字符');request.query=input.query;}}
  const record={messageId:typeof input.messageId==='string'?input.messageId.slice(0,100):undefined,id:randomUUID(),status:'pending',request,requestHash:hash(request),createdAt:new Date().toISOString(),...(typeof input.conversationId==='string'?{conversationId:input.conversationId.slice(0,100)}:{})};persist(record);return view(record);
 }
 function deny(id){const record=records.get(id);if(!record)throw Error('审批不存在');if(record.status!=='pending')return view(record);const next={...record,status:'denied',finishedAt:new Date().toISOString()};persist(next);return view(next);}
 let executing=false;
 async function approve(id){
  if(executing)throw Error('已有本地操作正在执行，请等待完成');
  executing=true;try{return await approveOnce(id);}finally{executing=false;}
 }
 async function approveOnce(id){
  const record=records.get(id);if(!record)throw Error('审批不存在');if(record.status!=='pending')return view(record);
  // Verify the on-disk proposal again; approval never accepts replacement arguments.
  const disk=JSON.parse(fs.readFileSync(path.join(ledger,id+'.json'),'utf8'));
  if(disk.status!=='pending'||disk.requestHash!==record.requestHash||hash(disk.request)!==record.requestHash||disk.request.workspaceRoot!==workspace||disk.request.dockerImage!==dockerImage)throw Error('审批内容已改变，拒绝执行');
  checkWorkspace();
  const next={...record,status:'consumed',consumedAt:new Date().toISOString()};persist(next);
  const ready=await status();if(!ready.available){Object.assign(next,{status:'blocked',error:ready.error,finishedAt:new Date().toISOString()});persist(next);return view(next);}
  let artifacts,before;
  try{artifacts=createWorkspaceArtifacts({workspaceRoot:workspace});before=new Map(artifacts.list().map(file=>[file.id,`${file.size}:${file.modifiedAt}`]));}catch{next.artifactWarning='无法记录文件变化，完成后请查看素材库';}
  const container='zora-runtime-'+id;
  const args=['run','--rm','-i','--pull','never','--name',container,'--network','none','--cap-drop','ALL','--security-opt','no-new-privileges','--read-only','--memory','512m','--cpus','1','--pids-limit','64','--user','1000:1000','--mount',`type=bind,source=${workspace},target=/workspace`,'--workdir','/workspace',dockerImage];
  const request=record.request;
  if(request.kind==='exec')args.push('sh','-lc',request.command);
  else if(request.kind==='read')args.push('sh','-lc','cat -- "$1"','zora-read',request.path);
  else if(request.kind==='list')args.push('sh','-lc','ls -la -- "$1"','zora-list',request.path);
  else if(request.kind==='search')args.push('sh','-lc','grep -r -n -F -I -- "$2" "$1"; code=$?; if [ "$code" -eq 1 ]; then exit 0; fi; exit "$code"','zora-search',request.path,request.query);
  else args.push('sh','-lc','cat > "$1"','zora-write',request.path);
  try{const result=await execFileImpl('docker',args,{timeout:30000,maxBuffer:MAX_OUTPUT,windowsHide:true,...(request.kind==='write'?{input:request.content}:{})});Object.assign(next,{status:'completed',stdout:String(result.stdout||'').slice(0,MAX_OUTPUT),stderr:String(result.stderr||'').slice(0,MAX_OUTPUT)});}
  catch(e){
   // Stopping the CLI alone does not guarantee that its container stopped.
   try{await execFileImpl('docker',['rm','-f',container],{timeout:5000,maxBuffer:MAX_OUTPUT,windowsHide:true});}catch{}
   Object.assign(next,{status:'failed',error:String(e.message||e).slice(0,4000),stdout:String(e.stdout||'').slice(0,MAX_OUTPUT),stderr:String(e.stderr||'').slice(0,MAX_OUTPUT),outputTruncated:e.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'});
  }
  if(next.status==='completed'&&before)try{next.artifacts=artifacts.list().filter(file=>before.get(file.id)!==`${file.size}:${file.modifiedAt}`);}catch{next.artifactWarning='操作完成，但文件清单暂不可用';}
  next.finishedAt=new Date().toISOString();persist(next);return view(next);
 }
 function deleteRecord(id){const record=records.get(id);if(!record)throw Error('记录不存在');if(['pending','consumed','running'].includes(record.status))throw Error('请先处理审批或等待执行结束');persist({...record,deletedAt:new Date().toISOString()});return {ok:true,id};}
 return {list:({includeDeleted=false}={})=>[...records.values()].filter(r=>includeDeleted||!r.deletedAt).map(view),status,propose,approve,deny,deleteRecord};
}
