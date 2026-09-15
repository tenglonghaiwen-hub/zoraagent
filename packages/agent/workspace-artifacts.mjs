import fs from 'node:fs';
import path from 'node:path';

const types={
 '.xlsx':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','document'],'.xls':['application/vnd.ms-excel','document'],'.docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document','document'],'.doc':['application/msword','document'],'.pptx':['application/vnd.openxmlformats-officedocument.presentationml.presentation','document'],
 '.pdf':['application/pdf','pdf'],'.txt':['text/plain; charset=utf-8','text'],'.csv':['text/csv; charset=utf-8','text'],
 '.png':['image/png','image'],'.jpg':['image/jpeg','image'],'.jpeg':['image/jpeg','image'],'.webp':['image/webp','image'],'.gif':['image/gif','image'],
 '.mp4':['video/mp4','video'],'.webm':['video/webm','video'],'.mov':['video/quicktime','video'],'.mp3':['audio/mpeg','audio'],'.wav':['audio/wav','audio'],'.m4a':['audio/mp4','audio'],'.ogg':['audio/ogg','audio']
};
const blocked=name=>name.startsWith('.')||/^(?:node_modules|secrets?|credentials?)$/i.test(name)||/(?:^|[._-])(?:secrets?|credentials?|api[_-]?keys?|tokens?|passwords?)(?:[._-]|$)|密钥|密码|凭据/i.test(name);
const within=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
const fail=(message,status=404)=>Object.assign(Error(message),{status});
function relativePath(value){
 if(typeof value!=='string'||!value||value.includes('\\')||value.includes('\0')||path.posix.isAbsolute(value)||value.includes(':')||value.split('/').some(p=>!p||p==='.'||p==='..'||blocked(p))||!types[path.posix.extname(value).toLowerCase()])throw fail('文件不可访问');
 return value;
}
export function createWorkspaceArtifacts({workspaceRoot}={}){
 if(!workspaceRoot)throw Error('未配置工作区目录');const root=path.resolve(workspaceRoot);
 function rootPath(){
  if(!fs.existsSync(root))return null;
  for(let current=root;;current=path.dirname(current)){if(fs.lstatSync(current).isSymbolicLink())throw fail('工作区不能使用符号链接',403);if(current===path.dirname(current))break;}
  return fs.realpathSync(root);
 }
 function resolve(relative){
  relativePath(relative);const actualRoot=rootPath();if(!actualRoot)throw fail('文件不存在');
  const file=path.resolve(root,...relative.split('/'));if(!within(root,file))throw fail('文件不可访问');
  let current=root;for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw fail('文件链接不可访问',403);}
  const actual=fs.realpathSync(file);if(!within(actualRoot,actual))throw fail('文件超出工作区',403);
  const stat=fs.statSync(actual);if(!stat.isFile())throw fail('不是可下载文件');return {actual,stat};
 }
 const metadata=(relative,stat)=>{const id=Buffer.from(relative,'utf8').toString('base64url');return {id,name:path.posix.basename(relative),path:relative,size:stat.size,modifiedAt:stat.mtime.toISOString(),url:'/api/workspace-files/'+id,kind:types[path.posix.extname(relative).toLowerCase()][1]};};
 function list(){
  if(!rootPath())return [];const files=[];let visited=0;
  const walk=(directory,relative='',depth=0)=>{if(depth>16)throw fail('工作区目录层级超过文件列表上限',413);if(fs.lstatSync(directory).isSymbolicLink()||(directory!==root&&!within(fs.realpathSync(root),fs.realpathSync(directory))))return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(++visited>20000)throw fail('工作区文件数量超过列表上限',413);if(blocked(entry.name)||entry.isSymbolicLink())continue;const rel=relative?relative+'/'+entry.name:entry.name;if(entry.isDirectory())walk(path.join(directory,entry.name),rel,depth+1);else if(entry.isFile()&&types[path.extname(entry.name).toLowerCase()]){try{const found=resolve(rel);files.push(metadata(rel,found.stat));}catch(e){if(e.status!==404&&e.status!==403&&e.code!=='ENOENT')throw e;}}}};
  walk(root);return files.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)||a.path.localeCompare(b.path));
 }
 function open(id){
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,4096}$/.test(id))throw fail('文件编号无效');
  const relative=Buffer.from(id,'base64url').toString('utf8');if(Buffer.from(relative,'utf8').toString('base64url')!==id)throw fail('文件编号无效');
  let fd;
  try{const found=resolve(relative);fd=fs.openSync(found.actual,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));const stat=fs.fstatSync(fd);const rechecked=resolve(relative);if(!stat.isFile()||stat.ino!==rechecked.stat.ino||stat.dev!==rechecked.stat.dev)throw fail('文件在读取前已改变',409);return {...metadata(relative,stat),fd,mimeType:types[path.extname(relative).toLowerCase()][0]};}
  catch(e){if(fd!==undefined)fs.closeSync(fd);if(e.status)throw e;throw fail(e.code==='ENOENT'?'文件不存在':'文件读取失败');}
 }
 return {list,open};
}
