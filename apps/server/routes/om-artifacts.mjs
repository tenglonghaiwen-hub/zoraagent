import fs from 'node:fs';
import path from 'node:path';
import {createWorkspaceArtifacts} from '../../../packages/agent/workspace-artifacts.mjs';
import {omOutputDirectory} from '../../../packages/adapters/om-preferences.mjs';
import {handleWorkspaceRoutes} from './workspace.mjs';

const media = /\.(wav|mp3|m4a|ogg|mp4|webm|mov|png|jpe?g|webp|gif)$/i;
export async function handleOmArtifacts(req,res,url,{sendJson,readJson,projectsRoot,outputRoot=omOutputDirectory()}) {
 if(url.pathname!=='/api/om/artifacts/resolve'&&!url.pathname.startsWith('/api/om/artifacts/file/'))return false;
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){sendJson(res,403,{error:'仅允许本机同源读取媒体'});return true;}
 try {
  // The development engine can be a junction. Canonicalize the configured root,
  // then let the workspace reader reject links and traversal inside that root.
  const roots=[projectsRoot,outputRoot];
  const openRoot=index=>{const root=fs.realpathSync(roots[index]);return {root,artifacts:createWorkspaceArtifacts({workspaceRoot:root})};};
  if(req.method==='POST'&&url.pathname==='/api/om/artifacts/resolve'){
   const body=await readJson(req);
   if(!Array.isArray(body.paths)||body.paths.length>20)throw Error('最多读取 20 个媒体路径');
   const files=[],errors=[];
   for(const candidate of [...new Set(body.paths)]){
    try {
     if(typeof candidate!=='string'||candidate.length>4096||!path.isAbsolute(candidate)||!media.test(candidate))throw Error();
     let found;
     for(let index=0;index<roots.length;index++){try{
     const {root,artifacts}=openRoot(index);
     const relative=path.relative(path.resolve(roots[index]),path.resolve(candidate));
     // Also accept the canonical paths returned by Python when engine is a junction.
     const rel=relative.startsWith('..')||path.isAbsolute(relative)?path.relative(root,path.resolve(candidate)):relative;
     const file=artifacts.open(Buffer.from(rel.split(path.sep).join('/')).toString('base64url'));
     fs.closeSync(file.fd);
     if(!file.size)throw Error();
     found={name:file.name,kind:file.kind,size:file.size,url:'/api/om/artifacts/file/'+file.id+'?location='+index};break;
     }catch{}}
     if(!found)throw Error();files.push(found);
    }catch{errors.push({error:'文件不存在、为空或不在本地媒体项目目录内'});}
   }
   sendJson(res,200,{files,errors});return true;
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/om/artifacts/file/')){
   const index=url.searchParams.get('location')==='1'?1:0;const {root}=openRoot(index);
   const id=url.pathname.slice('/api/om/artifacts/file/'.length);
   if(!media.test(Buffer.from(id,'base64url').toString('utf8')))throw Error('不支持的媒体类型');
   const mapped=new URL(url);mapped.pathname='/api/workspace-files/'+id;
   return handleWorkspaceRoutes(req,res,mapped,{sendJson,workspaceRoot:root});
  }
  sendJson(res,405,{error:'不支持的请求方法'});return true;
 }catch{sendJson(res,404,{error:'本地媒体文件不可用'});return true;}
}
