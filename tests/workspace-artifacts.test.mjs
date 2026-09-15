import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createWorkspaceArtifacts} from '../packages/agent/workspace-artifacts.mjs';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'zora-artifacts-'));
const id=p=>Buffer.from(p).toString('base64url');
test('lists deliverable extensions with stable Unicode IDs and opens exact bytes',()=>{
 const workspaceRoot=temp();fs.mkdirSync(path.join(workspaceRoot,'成品'));fs.writeFileSync(path.join(workspaceRoot,'成品','报表.xlsx'),'test spreadsheet');fs.writeFileSync(path.join(workspaceRoot,'image.png'),'test png');
 const library=createWorkspaceArtifacts({workspaceRoot}),files=library.list(),sheet=files.find(f=>f.name==='报表.xlsx');assert.equal(files.length,2);assert.equal(sheet.path,'成品/报表.xlsx');assert.equal(sheet.id,id(sheet.path));assert.equal(sheet.url,'/api/workspace-files/'+sheet.id);assert.equal(sheet.kind,'document');assert.ok(sheet.modifiedAt);
 const opened=library.open(sheet.id);try{assert.equal(fs.readFileSync(opened.fd,'utf8'),'test spreadsheet');assert.match(opened.mimeType,/spreadsheet/);}finally{fs.closeSync(opened.fd);}
 assert.equal(createWorkspaceArtifacts({workspaceRoot}).list().find(f=>f.name===sheet.name).id,sheet.id);
});
test('hidden names, scripts, credential names and traversal are inaccessible',()=>{
 const workspaceRoot=temp();for(const name of ['run.ps1','settings.json','.hidden.txt','api_key.txt','password.txt','safe.txt'])fs.writeFileSync(path.join(workspaceRoot,name),'dummy');
 const library=createWorkspaceArtifacts({workspaceRoot});assert.deepEqual(library.list().map(f=>f.name),['safe.txt']);
 for(const relative of ['../safe.txt','/safe.txt','C:/safe.txt','.hidden.txt','api_key.txt','run.ps1','a\\safe.txt'])assert.throws(()=>library.open(id(relative)));
 assert.throws(()=>library.open('not-valid+++'));assert.throws(()=>library.open(id('missing.txt')));
});
test('directory junction cannot list or open external files',()=>{
 const workspaceRoot=temp(),outside=temp();fs.writeFileSync(path.join(outside,'outside.txt'),'external');fs.symlinkSync(outside,path.join(workspaceRoot,'escape'),process.platform==='win32'?'junction':'dir');
 const library=createWorkspaceArtifacts({workspaceRoot});assert.deepEqual(library.list(),[]);assert.throws(()=>library.open(id('escape/outside.txt')),/链接/);assert.throws(()=>createWorkspaceArtifacts({workspaceRoot:path.join(workspaceRoot,'escape')}).list(),/链接/);
});
test('missing workspace is an empty list, and directories never open as files',()=>{
 const workspaceRoot=path.join(temp(),'not-created');assert.deepEqual(createWorkspaceArtifacts({workspaceRoot}).list(),[]);fs.mkdirSync(workspaceRoot);fs.mkdirSync(path.join(workspaceRoot,'fake.pdf'));assert.throws(()=>createWorkspaceArtifacts({workspaceRoot}).open(id('fake.pdf')),/可下载/);
});
test('isolated actual HTTP server lists and streams files with MIME, range and same-origin controls',async()=>{
 const workspaceRoot=temp(),state=temp();fs.writeFileSync(path.join(workspaceRoot,'report.xlsx'),'workbook');fs.writeFileSync(path.join(workspaceRoot,'preview.png'),'image-bytes');
 const source=`process.argv[1]='isolated-artifacts-test.mjs';const {server}=await import(${JSON.stringify(new URL('../apps/server/server.mjs',import.meta.url).href)});const assert=(await import('node:assert/strict')).default;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base='http://127.0.0.1:'+server.address().port;const listing=await(await fetch(base+'/api/workspace-files')).json();assert.equal(listing.files.length,2);const file=listing.files.find(f=>f.name==='report.xlsx');const response=await fetch(base+file.url,{headers:{Range:'bytes=0-3'}});assert.equal(response.status,206);assert.match(response.headers.get('content-type'),/spreadsheet/);assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal(await response.text(),'work');const preview=await fetch(base+listing.files.find(f=>f.name==='preview.png').url);assert.match(preview.headers.get('content-disposition'),/inline/);assert.equal((await fetch(base+'/api/workspace-files',{headers:{Origin:'https://untrusted.example'}})).status,403);console.log('ARTIFACT_HTTP_PASS');}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}`;
 const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',source],{env:{...process.env,ZORA_WORKSPACE_ROOT:workspaceRoot,ZORA_CHAT_STORE_DIR:path.join(state,'chat'),ZORA_TASK_STORE_DIR:path.join(state,'tasks'),DUOYUANX_API_KEY:'',ZORA_AGENT_API_KEY:'',OM_AUTO_SIDECAR:'false'},timeout:20000,maxBuffer:256*1024});assert.match(stdout,/ARTIFACT_HTTP_PASS/);
});
