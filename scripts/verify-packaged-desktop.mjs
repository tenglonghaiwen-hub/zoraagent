import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const executable=path.resolve(process.argv[2]||'');
assert.ok(process.argv[2],'传入打包后的 Zora.exe 路径');
const dependencies=process.env.ZORA_TEST_NODE_MODULES||'C:/Users/强哥/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require=createRequire(path.join(dependencies,'../package.json'));
const {_electron}=require('playwright');
const output=path.resolve('outputs/package-smoke-'+Date.now());
const profile=path.join(output,'profile');await fs.mkdir(profile,{recursive:true});
const root=path.join(path.dirname(executable),'resources/app');
const env={...process.env};
for(const key of Object.keys(env))if(/^(ZORA_|OM_|DUOYUANX_|MINIMAX_|DATABASE_PATH$|PORT$|ELECTRON_RUN_AS_NODE$|CODEX_HOME$)/i.test(key))delete env[key];
const manifest=JSON.parse(await fs.readFile(path.join(root,'runtime/runtime-manifest.json'),'utf8'));
assert.match(execFileSync(path.join(root,manifest.codexRelativePath),['--version'],{encoding:'utf8',windowsHide:true}),/0\.154\.0/);
const kernelCheck=`import {CodexKernel} from './packages/agent/codex-kernel.mjs';const k=new CodexKernel({home:process.env.PACKAGE_TEST_HOME,cwd:process.env.PACKAGE_TEST_WORKSPACE,key:'package-local-test',base:'http://127.0.0.1:1/v1'});try{const hello=await k.start();console.log(JSON.stringify({ok:true,hello}));}finally{await k.close();}`;
const kernel=JSON.parse(execFileSync(path.join(root,manifest.nodeRelativePath),['--input-type=module','-e',kernelCheck],{cwd:root,env:{...env,PACKAGE_TEST_HOME:path.join(output,'kernel-home'),PACKAGE_TEST_WORKSPACE:path.join(output,'kernel-workspace')},encoding:'utf8',timeout:30000,windowsHide:true}));
assert.equal(kernel.ok,true);await fs.writeFile(path.join(output,'kernel-handshake.json'),JSON.stringify(kernel,null,2));
const ffprobe=path.join(root,'runtime/ffmpeg/bin/ffprobe.exe');
const video=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration','-of','json',path.join(root,'apps/client/media/welcome-backdrop.mp4')],{encoding:'utf8',windowsHide:true}));
assert.ok(Number(video.format.duration)>0);
async function walk(dir){const files=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);assert.ok(!item.isSymbolicLink(),file);if(item.isDirectory())files.push(...await walk(file));else files.push(file);}return files;}
const allFiles=await walk(root);
const privateFiles=allFiles.filter(f=>/(^|[\\/])\.env(?:[.\\/]|$)|\.(dpapi|db|log)$|[\\/]sidecar-state\.json$/i.test(f));
assert.deepEqual(privateFiles,[]);
let app,firstUrl,omOrigin;const errors=[];
try{
  for(let round=0;round<2;round++){
    app=await _electron.launch({executablePath:executable,args:['--user-data-dir='+profile],env,timeout:180000});
    app.process().stderr.on('data',chunk=>errors.push(String(chunk)));
    const page=await app.firstWindow({timeout:180000});await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(()=>document.querySelector('#app')||document.querySelector('main'),{},{timeout:20000});
    assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
    const omDescriptor=JSON.parse(await fs.readFile(path.join(profile,'openmontage/state/sidecar-state.json'),'utf8'));
    omOrigin=omDescriptor.origin;
    if(!round){
      firstUrl=page.url();await page.evaluate(()=>localStorage.setItem('zora.package-smoke','persistent'));
      const checks=await page.evaluate(async()=>{const out={};for(const route of ['/api/models','/api/generation-capabilities','/api/local-runtime']){const r=await fetch(route);out[route]={status:r.status,data:await r.json()};}return out;});
      for(const check of Object.values(checks))assert.equal(check.status,200);
      assert.equal(checks['/api/generation-capabilities'].data.durableTasks,true);
      await fs.writeFile(path.join(output,'api-checks.json'),JSON.stringify(checks,null,2));
      const om=await page.evaluate(async()=>{const r=await fetch('/api/om/health');return {status:r.status,data:await r.json()};});
      assert.equal(om.status,200,JSON.stringify(om));
      await fs.writeFile(path.join(output,'openmontage-health.json'),JSON.stringify(om,null,2));
      await page.screenshot({path:path.join(output,'desktop.png')});
      for(const name of ['browser-bridge.json','desktop-bridge.json'])assert.ok((await fs.stat(path.join(profile,'data',name))).size>0);
      await assert.rejects(fs.stat(path.join(root,'data')),e=>e.code==='ENOENT');
    }else{
      assert.equal(page.url(),firstUrl);
      assert.equal(await page.evaluate(()=>localStorage.getItem('zora.package-smoke')),'persistent');
    }
    await app.close();app=null;
    let stopped=false;
    for(let i=0;i<30;i++){try{await fetch(new URL('/api/models',firstUrl),{signal:AbortSignal.timeout(500)});}catch{stopped=true;break;}await new Promise(r=>setTimeout(r,100));}
    assert.ok(stopped,'退出应用后其自启后台应停止');
    await assert.rejects(fetch(new URL('/api/v1/health',omOrigin),{signal:AbortSignal.timeout(1500)}),'退出应用后 OpenMontage 应停止');
  }
  const result={ok:true,executable,output,files:allFiles.length,checks:['安装版启动','隔离用户目录','模型与执行接口','包内 Codex 版本与真实 app-server 握手','包内视频探测','无个人配置文件','重启端口与本地存储保持','OpenMontage 自动启动','两次退出后 Zora 和 OpenMontage 均停止'],limitations:['未执行真实登录或付费生成','未在另一台无开发环境电脑验收']};
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(app)await app.close();await fs.writeFile(path.join(output,'stderr.txt'),errors.join(''));}
