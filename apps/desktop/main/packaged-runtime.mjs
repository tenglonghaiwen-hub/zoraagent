import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export function configurePackagedRuntime(root,userData,env=process.env){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime/runtime-manifest.json'),'utf8'));
  env.ZORA_DATA_DIR=path.join(userData,'data');
  env.ZORA_WORKSPACE_ROOT=path.join(userData,'workspace');
  env.ZORA_BRIDGE_DIRECTORY=env.ZORA_DATA_DIR;
  env.DATABASE_PATH=path.join(env.ZORA_DATA_DIR,'zora.db');
  env.ZORA_CODEX_BIN=path.join(root,manifest.codexRelativePath);
  env.ZORA_AGENT_ENABLED='true';
  env.OM_AUTO_SIDECAR='false';
  env.OM_VENDOR_ROOT=path.join(root,'vendor/openmontage');
  const bundleFile=path.join(env.OM_VENDOR_ROOT,'bundle.json');
  if(fs.existsSync(bundleFile)){
    const bundle=JSON.parse(fs.readFileSync(bundleFile,'utf8'));
    if(!/^[a-f0-9]{64}$/.test(bundle.engineDigest))throw Error('OpenMontage 包清单无效');
    const omData=path.join(userData,'openmontage');
    const configDirectory=path.join(omData,'config');fs.mkdirSync(configDirectory,{recursive:true});
    const configFile=path.join(configDirectory,'config.yaml');
    if(!fs.existsSync(configFile))fs.copyFileSync(path.join(env.OM_VENDOR_ROOT,'engine/config.yaml'),configFile);
    const engine=path.join(omData,'engines',bundle.engineDigest);
    if(!fs.existsSync(path.join(engine,'.zora-bundle-ready.json'))){
      const temporary=engine+'.staging-'+randomUUID();
      fs.mkdirSync(path.dirname(engine),{recursive:true});
      // Writable engine working copy is versioned; never migrate personal projects here.
      const engineSource=path.join(env.OM_VENDOR_ROOT,'engine');
      if(process.platform==='win32'){
        const copied=spawnSync(path.join(process.env.SystemRoot||'C:/Windows','System32/robocopy.exe'),[engineSource,temporary,'/E','/MT:16','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XF',path.join(engineSource,'config.yaml')],{windowsHide:true,encoding:'utf8'});
        if(copied.error||copied.status>=8)throw Error('OpenMontage 首次初始化失败：'+(copied.error?.message||copied.stdout));
      }else fs.cpSync(engineSource,temporary,{recursive:true,filter:source=>path.relative(engineSource,source)!=='config.yaml'});
      // Same-profile hard link keeps the config file stable across versioned engines.
      fs.linkSync(configFile,path.join(temporary,'config.yaml'));
      fs.writeFileSync(path.join(temporary,'.zora-bundle-ready.json'),JSON.stringify({engineDigest:bundle.engineDigest}));
      fs.renameSync(temporary,engine);
    }
    env.OM_ENGINE_ROOT=engine;
    env.OM_STATE_DIR=path.join(omData,'state');
    env.OM_PROJECTS_ROOT=path.join(omData,'projects');
    env.XDG_CACHE_HOME=path.join(omData,'cache');
    env.HF_HOME=path.join(omData,'cache','huggingface');
    env.OM_ENABLED='true';env.OM_AUTO_SIDECAR='true';
    env.OPENMONTAGE_REVISION=bundle.sourceRevision;
    env.OPENMONTAGE_BUNDLE_VERSION=bundle.version;
    for(const directory of [env.OM_STATE_DIR,env.OM_PROJECTS_ROOT,env.XDG_CACHE_HOME])fs.mkdirSync(directory,{recursive:true});
    // Never inherit a developer sidecar's origin or authentication into an installed build.
    for(const key of ['OM_API_BASE','OM_API_TOKEN','OM_LOCAL_TOOL_AUTHORITY','OM_API_PORT'])delete env[key];
  }
  env.PATH=path.dirname(path.join(root,manifest.nodeRelativePath))+path.delimiter+(env.PATH||'');
  for(const directory of [env.ZORA_DATA_DIR,env.ZORA_WORKSPACE_ROOT])fs.mkdirSync(directory,{recursive:true});
}

export async function packagedPort(userData){
  const file=path.join(userData,'local-port.json');
  if(fs.existsSync(file)){
    const {port}=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!Number.isInteger(port)||port<1024||port>65535)throw Error('本地端口配置无效');
    return port;
  }
  // Persist the first free loopback port so browser storage keeps a stable origin.
  const port=await new Promise((resolve,reject)=>{
    const probe=net.createServer();probe.once('error',reject);
    probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>resolve(port));});
  });
  fs.mkdirSync(userData,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({port}));
  return port;
}
