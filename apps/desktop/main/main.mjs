import {startCloudRelay,CLOUD_ORIGIN} from './cloud-network-relay.mjs';
import updaterPackage from 'electron-updater';
import {createUpdateChannel} from './updates.mjs';
import {readNetwork,saveNetwork,applyNetwork} from './network-settings.mjs';
import {loopbackHandler} from './loopback-origin.mjs';
import {configurePackagedRuntime,packagedPort} from './packaged-runtime.mjs';
/**
 * Zora desktop host: starts or reuses the local server and optional OM sidecar.
 * Hosts the studio, browser/desktop bridges and controlled media downloads.
 * Backend and main/preload updates have separate restart requirements.
 */
import { app, BrowserWindow, shell, Menu, session, dialog, ipcMain, net as electronNet } from 'electron';
import {editContextItems} from './edit-context-menu.mjs';
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
import {VC_REDIST} from '../../../packages/prerequisites.mjs';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireGenerationCapabilities } from './server-capabilities.mjs';
import {startBrowserBridge} from './browser-bridge.mjs';
import {startDesktopBridge} from './desktop-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..');

const children = [];
let cloudRelay;
let mainWindow = null;
let startedServer = false;
let startedSidecar = false;
let omStartupPromise;
let browserBridge;
let desktopBridge;

const ownsInstance = !app.isPackaged || app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function resolveBundledNode() {
  const manifestPath = path.join(REPO_ROOT, 'runtime', 'runtime-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.nodeRelativePath) {
        const p = path.join(REPO_ROOT, manifest.nodeRelativePath);
        if (fs.existsSync(p)) return p;
      }
    } catch {
      /* fall through */
    }
  }
  const fallback = path.join(REPO_ROOT, 'runtime', 'node-v24.21.0-win-x64', 'node.exe');
  if (fs.existsSync(fallback)) return fallback;
  return process.execPath.includes('electron') ? 'node' : process.execPath;
}

function portListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

async function waitForUrl(url, timeoutMs = 30000, child = null) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    if(child?.startupError)throw new Error(`后台启动失败：${child.startupError}`);
    if(child && child.exitCode !== null)throw new Error(`后台已退出（代码 ${child.exitCode}）。${child.startupStderr||'请检查包内运行时与启动日志。'}`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status === 404) return true;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = String(e?.message || e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`服务未就绪: ${url} (${last})`);
}

function spawnLogged(command, args, opts = {}) {
  const child = spawn(command, args, {
    cwd: opts.cwd || REPO_ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  const tag = opts.tag || 'child';
  child.startupStderr='';
  child.on('error',error=>{child.startupError=error.message;});
  child.stdout?.on('data', (c) => {
    if (process.env.ZORA_DESKTOP_VERBOSE === '1') process.stdout.write(`[${tag}] ${c}`);
  });
  child.stderr?.on('data', (c) => {
    child.startupStderr=(child.startupStderr+String(c)).slice(-3000);
    process.stderr.write(`[${tag}] ${c}`);
  });
  children.push(child);
  return child;
}

async function ensureAppServer(port) {
  const origin = `http://127.0.0.1:${port}`;
  const models = `http://127.0.0.1:${port}/api/models`;
  if (await portListening(port)) {
    // Do not replace, kill, or bypass an existing service on this port.
    await requireGenerationCapabilities(origin);
    await waitForUrl(models, 5000);
    return { reused: true };
  }

  const node = resolveBundledNode();
  const serverEntry = path.join(REPO_ROOT, 'apps', 'server', 'server.mjs');
  const child=spawnLogged(node, [serverEntry], {
    tag: 'server',
    env: {
      PORT: String(port),
      NODE_USE_ENV_PROXY:'1',
      NO_PROXY:[process.env.NO_PROXY||process.env.no_proxy||'','127.0.0.1','localhost','::1'].filter(Boolean).join(','),
      OM_ENABLED: process.env.OM_ENABLED || 'true',
    },
  });
  startedServer = true;
  await waitForUrl(models, 45000, child);
  await requireGenerationCapabilities(origin);
  return { reused: false };
}

async function ensureOmSidecar() {
  if (process.env.OM_AUTO_SIDECAR === 'false') return { skipped: true };
  try {
    const adapterUrl = pathToFileURL(
      path.join(REPO_ROOT, 'packages', 'adapters', 'openmontage.mjs'),
    ).href;
    const { startSidecar, openMontageStatus } = await import(adapterUrl);
    const before = openMontageStatus();
    if (before.live) return { reused: true, origin: before.baseUrl };
    const result = await startSidecar({ force: false });
    if (result.ok) {
      startedSidecar = !result.alreadyRunning;
      return result;
    }
    return { ok: false, error: result.error || 'sidecar start failed' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '造境 Zora',
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(DESKTOP_ROOT, 'main', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.webContents.on('context-menu',(_event,params)=>{
    if(!params.isEditable&&!params.selectionText)return;
    const contents=mainWindow.webContents;
    Menu.buildFromTemplate(editContextItems(contents,params)).popup({window:mainWindow});
  });

  const url = `http://127.0.0.1:${port}/`;
  mainWindow.webContents.on('will-navigate',(event,target)=>{if(new URL(target).origin!==new URL(url).origin)event.preventDefault();});
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function stopChildren() {
  cloudRelay?.close();
  // Only stop processes we started this session
  for (const child of children) {
    if (!child.killed && child.exitCode == null) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  }
  children.length = 0;

  if(omStartupPromise)await omStartupPromise.catch(()=>{});
  if (startedSidecar) {
    try {
      const adapterUrl = pathToFileURL(
        path.join(REPO_ROOT, 'packages', 'adapters', 'openmontage.mjs'),
      ).href;
      const { stopSidecar } = await import(adapterUrl);
      await stopSidecar();
    } catch {
      /* ignore */
    }
  }
}

let mediaStartup={ok:false,message:'本地媒体尚未启动'};
async function boot() {
  let originPort;
  const network=readNetwork(app.getPath('userData'));applyNetwork(network,process.env);
  if(network.mode!=='environment')await session.defaultSession.setProxy(network.mode==='system'?{mode:'system'}:network.mode==='direct'?{mode:'direct'}:{mode:'fixed_servers',proxyRules:network.proxy,proxyBypassRules:'<local>;127.0.0.1;localhost;[::1]'});
  if(app.isPackaged){
    configurePackagedRuntime(REPO_ROOT,app.getPath('userData'));
    process.env.PORT=String(await packagedPort(app.getPath('userData')));
    originPort=Number(process.env.PORT);
    if(await portListening(originPort)){
      process.env.PORT=String(await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>resolve(port));});}));
      session.defaultSession.protocol.handle('http',loopbackHandler(originPort,Number(process.env.PORT),{forward:fetch,external:request=>electronNet.fetch(request,{bypassCustomProtocolHandlers:true})}));
    }
  }else loadEnvFile(path.join(REPO_ROOT, '.env'));
  const port = Number(process.env.PORT || 4317);

  if(network.mode!=='environment'){cloudRelay=await startCloudRelay((url,options)=>session.defaultSession.fetch(url,options));process.env.ZORA_CLOUD_RELAY=cloudRelay.url;}
  const server = await ensureAppServer(port);
  createWindow(originPort||port);
  if(process.env.ZORA_OM_INIT_ERROR)mediaStartup={ok:false,message:process.env.ZORA_OM_INIT_ERROR};
  else omStartupPromise=ensureOmSidecar().then(result=>{mediaStartup={ok:result.ok!==false,message:result.ok===false?'本地媒体启动失败：'+result.error:'本地媒体启动检查完成'};}).catch(error=>{mediaStartup={ok:false,message:error.message};});
  try{browserBridge=await startBrowserBridge({directory:process.env.ZORA_BRIDGE_DIRECTORY||path.join(REPO_ROOT,'data')});}catch(error){console.error('浏览器桥启动失败',error);}
  try{desktopBridge=await startDesktopBridge({directory:process.env.ZORA_BRIDGE_DIRECTORY||path.join(REPO_ROOT,'data'),dialog});}catch(error){console.error('桌面桥启动失败',error);}

}

app.whenReady().then(() => {
  if (!ownsInstance) return;
  const updates=createUpdateChannel({updater:updaterPackage.autoUpdater,version:app.getVersion(),enabled:app.isPackaged,
    confirmInstall:async()=> (await dialog.showMessageBox(mainWindow,{type:'question',buttons:['暂不安装','退出并安装'],defaultId:0,cancelId:0,title:'安装更新',message:'请确认已保存工作且任务已结束。安装将关闭客户端及其本地后台，已提交的云端任务不会因此取消。'})).response===1,
    prepareInstall:async()=>{browserBridge?.close();desktopBridge?.close();await stopChildren();cleanupFinished=true;}
  });
  ipcMain.handle('zora:install-vcredist',async event=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('来源无效');
    const answer=await dialog.showMessageBox(mainWindow,{type:'question',buttons:['取消','打开微软安装程序'],defaultId:0,cancelId:0,message:'将打开包内 Microsoft C++ x64 运行库安装程序，Windows 可能要求管理员确认。请按安装程序提示操作，完成后重新检查媒体能力。'});
    if(answer.response!==1)return {message:'已取消'};
    const file=path.join(REPO_ROOT,VC_REDIST.file);if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==VC_REDIST.sha256)throw Error('运行库安装程序校验失败，请重新下载安装包');
    const error=await shell.openPath(file);if(error)throw Error(error);return {message:'已打开微软安装程序；请完成安装后重新检查。'};
  });
  ipcMain.handle('zora:network',async(event,value)=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('来源无效');
    return value?saveNetwork(app.getPath('userData'),value):readNetwork(app.getPath('userData'));
  });
  ipcMain.handle('zora:network-test',async event=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('来源无效');
    try {
      const response=await fetch((cloudRelay?.url||CLOUD_ORIGIN)+'/api/models',{signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok)throw Error(typeof data.error==='string'?data.error:`HTTP ${response.status}`);
      if(!Array.isArray(data.models))throw Error('模型目录格式无效');
      return {ok:true,message:'当前后台云服务连接正常。若刚修改设置，请重启后再检测。'};
    }catch(error){return {ok:false,message:'后台网络检测失败：'+String(error.message).slice(0,300)};}
  });
  ipcMain.handle('zora:choose-voice',async event=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('来源无效');
    const result=await dialog.showOpenDialog(mainWindow,{title:'选择已有 Piper 音色',properties:['openFile'],filters:[{name:'Piper 音色',extensions:['onnx']}]});
    if(result.canceled)return null;const source=result.filePaths[0];
    if(!source.toLowerCase().endsWith('.onnx')||!fs.existsSync(source+'.json'))throw Error('需要同目录的 .onnx.json 配置文件');
    if(fs.statSync(source+'.json').size>1024*1024)throw Error('音色配置文件过大');
    JSON.parse(fs.readFileSync(source+'.json','utf8'));
    const directory=path.join(app.getPath('userData'),'openmontage','voices',randomUUID());fs.mkdirSync(directory,{recursive:true});
    const target=path.join(directory,path.basename(source));fs.copyFileSync(source,target);fs.copyFileSync(source+'.json',target+'.json');return target;
  });
  ipcMain.handle('zora:media-startup',async(event,retry)=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('来源无效');
    if(retry&&process.env.ZORA_OM_INIT_ERROR){
      const answer=await dialog.showMessageBox(mainWindow,{type:'question',buttons:['暂不重启','重启并重新初始化'],defaultId:0,cancelId:0,message:'本地媒体初始化失败。重试需要重启客户端，请先保存工作并结束任务。'});
      if(answer.response===1){app.relaunch();app.quit();}return mediaStartup;
    }
    if(retry&&!process.env.ZORA_OM_INIT_ERROR){const result=await ensureOmSidecar();mediaStartup={ok:result.ok!==false,message:result.ok===false?'启动失败：'+result.error:'启动检查完成'};}
    return mediaStartup;
  });
  ipcMain.handle('zora:update',async(event,action)=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('更新来源无效');
    const url=new URL(event.senderFrame.url);
    if(url.origin!==new URL(mainWindow.webContents.getURL()).origin||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('更新来源无效');
    return updates(action);
  });
  ipcMain.handle('zora:download-media',async(event,{url,name}={})=>{
    if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('下载来源无效');
    if(typeof url!=='string'||!(/^(https?:\/\/|blob:|data:(image|video)\/)/.test(url))||!/^zora-(auto-)?[\w-]+\.(png|mp4)$/.test(name||''))throw Error('下载参数无效');
    const contents=event.sender;const sess=contents.session;
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);sess.removeListener('will-download',receive);};
      const receive=(_event,item,owner)=>{
        if(owner!==contents||!(item.getURLChain().includes(url)||item.getURL()===url))return;
        cleanup();
        try{const directory=path.join(app.getPath('downloads'),'Zora');fs.mkdirSync(directory,{recursive:true});item.setSavePath(path.join(directory,name));}
        catch{item.cancel();reject(Error('无法写入下载目录'));return;}
        item.once('done',(_e,state)=>state==='completed'?resolve({ok:true,path:item.getSavePath()}):reject(Error(state==='cancelled'?'下载已取消':'下载中断，请重试')));
      };
      const timer=setTimeout(()=>{cleanup();reject(Error('下载启动超时'));},60000);
      sess.on('will-download',receive);
      try{contents.downloadURL(url);}catch(e){cleanup();reject(Error('无法启动下载'));}
    });
  });

  session.defaultSession.on('will-download',(_event,item)=>{
    if(!/^zora-auto-[\w-]+\.(png|mp4)$/.test(item.getFilename()))return;
    const directory=path.join(app.getPath('downloads'),'Zora');
    try{fs.mkdirSync(directory,{recursive:true});item.setSavePath(path.join(directory,item.getFilename()));}catch(error){console.error('[zora-desktop] auto download directory unavailable',error);}
  });
  // Mic / media for voice dictation in the renderer
  try {
    const sess = session.defaultSession;
    sess.setPermissionRequestHandler((_wc, permission, callback) => {
      const allow = permission === 'media' || permission === 'microphone' || permission === 'audioCapture';
      callback(allow);
    });
    sess.setPermissionCheckHandler((_wc, permission) => {
      return permission === 'media' || permission === 'microphone' || permission === 'audioCapture';
    });
  } catch (e) {
    console.warn('[zora-desktop] permission handlers failed', e);
  }
  boot().catch((err) => {
    console.error('[zora-desktop] boot failed', err);
    dialog.showErrorBox('Zora 启动失败', String(err?.message || err));
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let cleanupFinished=false;
let cleanupStarted=false;
app.on('before-quit', event => {
  if(cleanupFinished)return;
  event.preventDefault();
  if(cleanupStarted)return;
  cleanupStarted=true;
  browserBridge?.close();
  desktopBridge?.close();
  void stopChildren().finally(()=>{cleanupFinished=true;app.quit();});
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const port = Number(process.env.PORT || 4317);
    createWindow(port);
  }
});
