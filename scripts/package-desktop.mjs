import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {bundleOpenMontage} from './bundle-openmontage.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'apps/desktop/package.json'));
const {build,Platform,Arch}=require('electron-builder');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const suppliedStage=process.argv.find(value=>value.startsWith('--from-stage='))?.slice('--from-stage='.length);
const stage=suppliedStage?path.resolve(suppliedStage):path.join(root,'outputs','desktop-package-'+stamp,'stage');
if(suppliedStage && (!stage.startsWith(path.join(root,'outputs')+path.sep)||path.basename(stage)!=='stage'))throw Error('只能使用本项目 outputs 下的打包暂存目录');
const output=path.dirname(stage);
if(!suppliedStage){
fs.mkdirSync(stage,{recursive:true});
function copy(relative,target=relative){
  const source=path.join(root,relative),dest=path.join(stage,target);
  if(fs.lstatSync(source).isSymbolicLink())throw Error('打包拒绝目录链接：'+relative);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
}
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of new Set(files)){
  if(/^(apps\/(client|server)\/|apps\/desktop\/main\/|packages\/|skills\/)/.test(file)||file==='scripts/windows-desktop.ps1'||/^vendor\/openmontage\/(tool-catalog|skill-catalog)\.json$/.test(file)){
    if(/(^|\/)(\.env[^/]*|node_modules|outputs)(\/|$)|\.(dpapi|db|log)$|\.local\./i.test(file))throw Error('不允许的打包文件：'+file);
    copy(file);
  }
}
copy('package-lock.json');copy('docs/THIRD_PARTY_NOTICES.md');copy('vendor/codex-main/LICENSE','licenses/Codex-LICENSE');
copy('docs/OPENMONTAGE-BUNDLE.md');copy('docs/DESKTOP-PACKAGING.md');
copy('apps/cloudflare-worker/src/image-request.mjs');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
pkg.main='apps/desktop/main/main.mjs';pkg.productName='Zora';pkg.author='Zora';delete pkg.scripts;
fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(pkg,null,2));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime/runtime-manifest.json'),'utf8'));
delete manifest.nodePath;
// The historical manifest.sha256 belongs to the downloaded ZIP, not node.exe.
// This binary hash was checked against that ZIP and its valid OpenJS signature.
manifest.nodeSha256='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
fs.mkdirSync(path.join(stage,'runtime'),{recursive:true});
fs.writeFileSync(path.join(stage,'runtime/runtime-manifest.json'),JSON.stringify(manifest,null,2));
copy(manifest.nodeRelativePath.replaceAll('\\','/'));
copy('runtime/node-v24.21.0-win-x64/LICENSE','licenses/Node-LICENSE');
function copyTree(relative,target=relative){
  for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
    const from=relative+'/'+entry.name,to=target+'/'+entry.name;
    if(entry.isSymbolicLink())throw Error('打包拒绝链接：'+from);
    if(entry.isDirectory())copyTree(from,to);else copy(from,to);
  }
}
copyTree('runtime/codex');
copyTree('vendor/openmontage/runtime/ffmpeg','runtime/ffmpeg');
bundleOpenMontage({root,stage});
for(const [rel,hash] of [[manifest.nodeRelativePath,manifest.nodeSha256],[manifest.codexRelativePath,manifest.codexSha256]]){
  const actual=createHash('sha256').update(fs.readFileSync(path.join(stage,rel))).digest('hex');
  if(actual!==hash.toLowerCase())throw Error('运行时校验失败：'+rel);
}
const node=path.join(root,manifest.nodeRelativePath);
const npm=path.join(path.dirname(node),'node_modules/npm/bin/npm-cli.js');
execFileSync(node,[npm,'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,stdio:'inherit',windowsHide:true});
}
if(process.argv.includes('--stage-only')){console.log(JSON.stringify({stage,output}));process.exit(0);}
const artifacts=await build({targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),projectDir:stage,config:{
  appId:'com.zora.agent',productName:'Zora',asar:false,npmRebuild:false,compression:'normal',
  electronVersion:require('electron/package.json').version,
  electronDist:path.join(root,'apps/desktop/node_modules/electron/dist'),
  directories:{output:path.join(output,'release')},
  files:['apps/**/*','packages/**/*','skills/**/*','scripts/**/*','licenses/**/*','docs/**/*','package.json'],
  extraResources:[{from:path.join(stage,'runtime'),to:'app/runtime'},{from:path.join(stage,'vendor/openmontage'),to:'app/vendor/openmontage'}],
  win:{target:['nsis'],signAndEditExecutable:false,artifactName:'Zora-${version}-win-x64-openmontage-setup.${ext}'},
  nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,deleteAppDataOnUninstall:false,runAfterFinish:false,createDesktopShortcut:true},
  publish:null
}});
const hashes=artifacts.filter(file=>fs.statSync(file).isFile()).map(file=>({file:path.basename(file),bytes:fs.statSync(file).size,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(path.join(output,'SHA256SUMS.json'),JSON.stringify(hashes,null,2));
fs.writeFileSync(path.join(root,'outputs/latest-desktop-package.json'),JSON.stringify({output,artifacts,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),containsUncommittedPackagingChanges:true},null,2));
console.log(JSON.stringify({output,artifacts,hashes},null,2));
