/**
 * Zora desktop host: starts or reuses the local server and optional OM sidecar.
 * Hosts the studio, browser/desktop bridges and controlled media downloads.
 * Backend and main/preload updates have separate restart requirements.
 */
import { app, BrowserWindow, shell, Menu, session, dialog, ipcMain } from 'electron';
import {editContextItems} from './edit-context-menu.mjs';
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
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
let mainWindow = null;
let startedServer = false;
let startedSidecar = false;
let browserBridge;
let desktopBridge;

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

async function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
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
  child.stdout?.on('data', (c) => {
    if (process.env.ZORA_DESKTOP_VERBOSE === '1') process.stdout.write(`[${tag}] ${c}`);
  });
  child.stderr?.on('data', (c) => {
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
  spawnLogged(node, [serverEntry], {
    tag: 'server',
    env: {
      PORT: String(port),
      OM_ENABLED: process.env.OM_ENABLED || 'true',
    },
  });
  startedServer = true;
  await waitForUrl(models, 45000);
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

async function boot() {
  loadEnvFile(path.join(REPO_ROOT, '.env'));
  const port = Number(process.env.PORT || 4317);

  const server = await ensureAppServer(port);
  const om = await ensureOmSidecar();
  console.log(
    `[zora-desktop] server=${server.reused ? 'reused' : 'started'} port=${port} om=${JSON.stringify(om?.origin || om?.skipped || om?.error || om)}`,
  );
  createWindow(port);
  browserBridge=await startBrowserBridge({directory:process.env.ZORA_BRIDGE_DIRECTORY||path.join(REPO_ROOT,'data')});
  desktopBridge=await startDesktopBridge({directory:process.env.ZORA_BRIDGE_DIRECTORY||path.join(REPO_ROOT,'data'),dialog});
}

app.whenReady().then(() => {
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

app.on('before-quit', () => {
  browserBridge?.close();
  desktopBridge?.close();
  // fire and forget; Electron won't await async here reliably
  void stopChildren();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const port = Number(process.env.PORT || 4317);
    createWindow(port);
  }
});
