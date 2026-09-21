import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const engineFileAllowed=file=>/^(services\/studio_api\/|backlot\/|lib\/|tools\/|schemas\/|pipeline_defs\/|styles\/|skills\/|\.agents\/skills\/|remotion-composer\/|assets\/)/.test(file)
  && !/(^|\/)(node_modules|projects|account-data|work|out|renders|__pycache__|\.git|\.tmp[^/]*|\.cache|\.env[^/]*)(\/|$)|\.(pyc|pyo|dpapi|db|log)$|\.local\./i.test(file);
const skipped=name=>name==='__pycache__'||name==='.cache'||name==='direct_url.json'||/^\.env(?:\.|$)/.test(name)||/\.(pyc|pyo|log|dpapi)$/i.test(name);

export function bundleOpenMontage({root,stage}){
  const vendor=path.join(root,'vendor/openmontage');
  execFileSync(path.join(vendor,'runtime/python/python.exe'),['-c','import faster_whisper, piper, onnxruntime, ctranslate2; print("Speech runtime preflight OK")'],{windowsHide:true});
  // Resolve the single explicitly configured development junction, then copy real files.
  const engine=fs.realpathSync(path.join(vendor,'engine'));
  const destination=path.join(stage,'vendor/openmontage');
  const inventory=[];
  function copyFile(source,relative){
    const target=path.join(destination,relative);
    if(fs.lstatSync(source).isSymbolicLink())throw Error('OpenMontage 拒绝嵌套文件链接：'+relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
    inventory.push({file:relative.replaceAll('\\','/'),bytes:fs.statSync(target).size,sha256:createHash('sha256').update(fs.readFileSync(target)).digest('hex')});
  }
  function tree(source,relative){
    const files=[];
    function scan(folder,prefix=''){
      for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
        if(skipped(entry.name))continue;
        if(entry.isSymbolicLink())throw Error('OpenMontage 拒绝嵌套目录链接：'+relative+'/'+prefix+entry.name);
        const sub=prefix+entry.name;
        if(entry.isDirectory())scan(path.join(folder,entry.name),sub+'/');else files.push(sub);
      }
    }
    scan(source);
    const target=path.join(destination,relative);
    console.log('Bundling runtime:',relative,files.length,'files');
    const copied=spawnSync('robocopy.exe',[source,target,'/E','/MT:16','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD','__pycache__','.cache','/XF','*.pyc','*.pyo','*.log','*.dpapi','direct_url.json','.env','.env.*'],{windowsHide:true,encoding:'utf8'});
    if(copied.error||copied.status>=8)throw Error('运行时复制失败：'+relative+' '+(copied.error?.message||copied.stdout));
    const python=path.join(vendor,'runtime/python/python.exe');
    const hashScript="import sys,json,hashlib,os\nfrom concurrent.futures import ThreadPoolExecutor\ndef row(name):\n p=os.path.join(sys.argv[1],name)\n h=hashlib.sha256()\n with open(p,'rb') as f:\n  for block in iter(lambda:f.read(1048576),b''):h.update(block)\n return {'file':sys.argv[2]+'/'+name,'bytes':os.path.getsize(p),'sha256':h.hexdigest()}\nwith ThreadPoolExecutor(max_workers=16) as pool: rows=list(pool.map(row,json.load(sys.stdin)))\nprint(json.dumps(rows))";
    inventory.push(...JSON.parse(execFileSync(python,['-c',hashScript,target,relative],{input:JSON.stringify(files),encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true})));
    console.log('Verified runtime:',relative);
  }
  const names=execFileSync('git',['ls-files','-z'],{cwd:engine,encoding:'utf8'}).split('\0').filter(Boolean);
  const added=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:engine,encoding:'utf8'}).split('\0').filter(Boolean);
  names.push(...added.filter(file=>engineFileAllowed(file)&&!file.startsWith('assets/')&&!file.startsWith('remotion-composer/public/')&&/\.(py|md|json|yaml|yml|tsx|ts|js|mjs|css|html)$/.test(file)));
  const topFiles=new Set(['LICENSE','README.md','AGENT_GUIDE.md','PROJECT_CONTEXT.md','DEVELOPMENT_RULES.md','requirements.txt','requirements-gpu.txt','setup.py']);
  for(const file of names){
    if(!engineFileAllowed(file)&&!topFiles.has(file))continue;
    const source=path.join(engine,file),actual=fs.realpathSync(source),relative=path.relative(engine,actual);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('引擎文件越界：'+file);
    copyFile(source,'engine/'+file);
  }
  // Ship the upstream default configuration, not the developer's working copy.
  const config=execFileSync('git',['show','HEAD:config.yaml'],{cwd:engine});
  fs.writeFileSync(path.join(destination,'engine/config.yaml'),config);
  inventory.push({file:'engine/config.yaml',bytes:config.length,sha256:createHash('sha256').update(config).digest('hex')});
  tree(path.join(engine,'remotion-composer/node_modules'),'engine/remotion-composer/node_modules');
  tree(path.join(vendor,'runtime/python'),'runtime/python');
  tree(path.join(vendor,'runtime/hyperframes'),'runtime/hyperframes');
  for(const file of ['speech-requirements.lock','tool-catalog.json','skill-catalog.json','zora-policy.json','scripts/invoke-registry-tool.py','scripts/probe-local-media.py','scripts/zora_stock_hooks.py','scripts/zora_local_speech.py','scripts/prepare_transcription.py'])copyFile(path.join(vendor,file),file);
  // Embedded Python must not inherit a source checkout through its ._pth file.
  fs.writeFileSync(path.join(destination,'runtime/python/python312._pth'),'python312.zip\nmedia-site\n.\nimport site\n');
  const pythonPth=inventory.find(row=>row.file==='runtime/python/python312._pth');
  const pthBytes=fs.readFileSync(path.join(destination,pythonPth.file));
  pythonPth.bytes=pthBytes.length;pythonPth.sha256=createHash('sha256').update(pthBytes).digest('hex');
  const zoraManifest=JSON.parse(fs.readFileSync(path.join(stage,'runtime/runtime-manifest.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(vendor,'runtime-manifest.json'),'utf8'));
  manifest.node={version:zoraManifest.nodeVersion,executable:'../../'+zoraManifest.nodeRelativePath.replaceAll('\\','/')};
  manifest.ffmpeg={version:'bundled',executable:'../../runtime/ffmpeg/bin/ffmpeg.exe',ffprobe:'../../runtime/ffmpeg/bin/ffprobe.exe'};
  manifest.codex={version:zoraManifest.codexVersion,executable:'../../'+zoraManifest.codexRelativePath};
  manifest.note='Zora bundled runtime: immutable files, writable versioned engine and user projects outside installation.';
  manifest.engine={root:'engine',studio_api:'engine/services/studio_api'};
  fs.writeFileSync(path.join(destination,'runtime-manifest.json'),JSON.stringify(manifest,null,2));
  const engineInventory=inventory.filter(row=>row.file.startsWith('engine/')).sort((a,b)=>a.file.localeCompare(b.file));
  const engineDigest=createHash('sha256').update(JSON.stringify(engineInventory)).digest('hex');
  const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim();
  const bundle={version:'0.1.0-openmontage',source:'https://github.com/calesthio/OpenMontage',sourceRevision,includesWorkingTreeChanges:!!execFileSync('git',['status','--porcelain'],{cwd:engine,encoding:'utf8'}).trim(),engineDigest,files:inventory.length,bytes:inventory.reduce((sum,row)=>sum+row.bytes,0)};
  fs.writeFileSync(path.join(destination,'bundle.json'),JSON.stringify(bundle,null,2));
  fs.writeFileSync(path.join(destination,'bundle-files.json'),JSON.stringify(inventory,null,2));
  console.log('OpenMontage bundled:',JSON.stringify(bundle));
  return bundle;
}
