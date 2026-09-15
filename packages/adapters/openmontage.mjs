/**
 * OpenMontage studio_api bridge — live loopback sidecar + vendor runtime probe.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const STATE_FILE = 'sidecar-state.json';
const HEALTH_PATH = '/api/v1/health';
const PROJECTS_PATH = '/api/v1/projects';
const LOCAL_TOOL_HEADER = 'X-OpenMontage-Local-Tool-Authority';
const ALLOWED_TOOLS = new Set([
  'direct_clip_search',
  'video_compose',
  'subtitle_gen',
  'piper_tts',
  'transcriber',
]);

function vendorRoot() {
  return process.env.OM_VENDOR_ROOT
    ? path.resolve(process.env.OM_VENDOR_ROOT)
    : path.join(REPO_ROOT, 'vendor', 'openmontage');
}

function statePath() {
  return path.join(vendorRoot(), STATE_FILE);
}

function exists(p) {
  try {
    return Boolean(p) && fs.existsSync(p);
  } catch {
    return false;
  }
}

function readManifest(root) {
  const p = path.join(root, 'runtime-manifest.json');
  if (!exists(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function tryVersion(exe, args = ['--version']) {
  if (!exists(exe)) return null;
  try {
    const r = spawnSync(exe, args, { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split(/\r?\n/)[0] || '';
    return out.slice(0, 120) || (r.status === 0 ? 'ok' : null);
  } catch {
    return null;
  }
}

function resolveTool(root, rel, fallbacks = []) {
  const primary = rel ? path.join(root, rel) : null;
  for (const c of [primary, ...fallbacks].filter(Boolean)) {
    if (exists(c)) return c;
  }
  return primary;
}

export function probeOpenMontageRuntime() {
  const root = vendorRoot();
  const manifest = readManifest(root) || {};
  const zoraRuntime = path.join(REPO_ROOT, 'runtime');
  const zoraNodeDir = path.join(zoraRuntime, 'node-v24.21.0-win-x64');

  const node = resolveTool(root, manifest.node?.executable || 'runtime/node/node.exe', [
    path.join(zoraNodeDir, 'node.exe'),
    path.join(zoraRuntime, 'node', 'node.exe'),
  ]);
  const python = resolveTool(root, manifest.python?.executable || 'runtime/python/python.exe', []);
  const ffmpeg = resolveTool(root, manifest.ffmpeg?.executable || 'runtime/ffmpeg/bin/ffmpeg.exe', []);
  const ffprobe = resolveTool(root, manifest.ffmpeg?.ffprobe || 'runtime/ffmpeg/bin/ffprobe.exe', []);
  const hyperframesCli = resolveTool(
    root,
    manifest.hyperframes?.cli || 'runtime/hyperframes/node_modules/hyperframes/bin/hyperframes.mjs',
    [],
  );
  const hyperframesBrowser = resolveTool(
    root,
    manifest.hyperframes?.browser ||
      'runtime/hyperframes/browser/chrome-headless-shell-win64/chrome-headless-shell.exe',
    [],
  );
  // Reuse Zora's existing Codex — do not require a second copy under vendor/openmontage/runtime/codex
  const zoraCodex = path.join(
    REPO_ROOT,
    'runtime',
    'codex',
    'node_modules',
    '@openai',
    'codex-win32-x64',
    'vendor',
    'x86_64-pc-windows-msvc',
    'bin',
    'codex.exe',
  );
  const codex = resolveTool(root, manifest.codex?.executable || 'runtime/codex/codex.exe', [
    zoraCodex,
    path.join(REPO_ROOT, 'vendor', 'codex-main', 'codex-rs', 'target', 'release', 'codex.exe'),
  ]);

  const engineRoot = path.join(root, manifest.engine?.root || 'engine');
  const studioApi = path.join(root, manifest.engine?.studio_api || 'engine/services/studio_api');
  const engineHasContent =
    exists(engineRoot) &&
    fs.readdirSync(engineRoot).some((n) => !n.startsWith('.') && n !== '.gitkeep.txt');
  const studioApiPresent =
    exists(path.join(studioApi, 'app.py')) ||
    exists(path.join(studioApi, '__main__.py')) ||
    exists(path.join(studioApi, 'main.py'));

  const tools = {
    node: { path: node, present: exists(node), version: tryVersion(node, ['-v']) },
    python: { path: python, present: exists(python), version: tryVersion(python, ['--version']) },
    ffmpeg: { path: ffmpeg, present: exists(ffmpeg), version: tryVersion(ffmpeg, ['-version']) },
    ffprobe: { path: ffprobe, present: exists(ffprobe), version: tryVersion(ffprobe, ['-version']) },
    hyperframesCli: { path: hyperframesCli, present: exists(hyperframesCli), version: null },
    hyperframesBrowser: {
      path: hyperframesBrowser,
      present: exists(hyperframesBrowser),
      version: null,
    },
    codex: {
      path: codex,
      present: exists(codex),
      version: tryVersion(codex, ['--version']),
      reusedFromZora: exists(codex) && path.normalize(codex) === path.normalize(zoraCodex),
    },
  };

  const coreReady = tools.node.present && tools.python.present && tools.ffmpeg.present;
  return {
    vendorRoot: root,
    engineRoot,
    tools,
    engine: {
      root: engineRoot,
      linked: engineHasContent,
      studioApiPath: studioApi,
      studioApiPresent,
    },
    coreReady,
    engineReady: studioApiPresent,
    ready: coreReady && studioApiPresent,
  };
}

function readStateFile() {
  const p = statePath();
  if (!exists(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf8');
}

function clearState() {
  const p = statePath();
  if (exists(p)) fs.unlinkSync(p);
}

function processAlive(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function connectionFromEnv() {
  const base = (process.env.OM_API_BASE || '').replace(/\/$/, '');
  const token = process.env.OM_API_TOKEN || '';
  const authority = process.env.OM_LOCAL_TOOL_AUTHORITY || '';
  if (!base || !token) return null;
  return { origin: base, token, localToolAuthorityToken: authority, source: 'env' };
}

function connectionFromState() {
  const state = readStateFile();
  if (!state?.origin || !state?.token) return null;
  if (state.pid && !processAlive(state.pid)) {
    clearState();
    return null;
  }
  return {
    origin: state.origin,
    token: state.token,
    localToolAuthorityToken: state.localToolAuthorityToken || '',
    pid: state.pid,
    port: state.port,
    source: 'state',
  };
}

export function resolveOmConnection() {
  return connectionFromEnv() || connectionFromState();
}

async function omFetch(conn, pathname, { method = 'GET', body, authority = false } = {}) {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${conn.token}`,
  };
  if (authority) {
    if (!conn.localToolAuthorityToken) {
      const err = new Error('缺少本地工具授权 token（X-OpenMontage-Local-Tool-Authority）');
      err.status = 403;
      throw err;
    }
    headers[LOCAL_TOOL_HEADER] = conn.localToolAuthorityToken;
  }
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${conn.origin}${pathname}`, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 4000) };
  }
  return { ok: res.ok, status: res.status, data };
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('failed to reserve loopback port'));
        return;
      }
      const port = address.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSidecarEnv(probe, port, token, authority) {
  const pythonDir = path.dirname(probe.tools.python.path);
  const ffmpegDir = path.dirname(probe.tools.ffmpeg.path);
  const nodeDir = path.dirname(probe.tools.node.path);
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const childPath = [nodeDir, pythonDir, ffmpegDir, path.join(systemRoot, 'System32'), systemRoot].join(path.delimiter);
  const projectsRoot =
    process.env.OM_PROJECTS_ROOT ||
    path.join(probe.engineRoot, 'projects');

  return {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONNOUSERSITE: '1',
    PATH: childPath,
    OPENMONTAGE_STUDIO_API_PORT: String(port),
    OPENMONTAGE_STUDIO_API_TOKEN: token,
    OPENMONTAGE_LOCAL_TOOL_AUTHORITY_TOKEN: authority,
    OPENMONTAGE_PROJECTS_ROOT: projectsRoot,
    OPENMONTAGE_FFMPEG_EXECUTABLE: probe.tools.ffmpeg.path,
    OPENMONTAGE_FFPROBE_EXECUTABLE: probe.tools.ffprobe.path,
    OPENMONTAGE_HYPERFRAMES_CLI: probe.tools.hyperframesCli?.path || '',
    HYPERFRAMES_BROWSER_PATH: probe.tools.hyperframesBrowser?.path || '',
    OPENMONTAGE_REMOTION_BROWSER_PATH: probe.tools.hyperframesBrowser?.path || '',
    HYPERFRAMES_NO_TELEMETRY: '1',
    OPENMONTAGE_CODEX_EXECUTABLE: probe.tools.codex?.path || '',
    OPENMONTAGE_STUDIO_RENDERER_ORIGIN: process.env.OM_RENDERER_ORIGIN || 'null',
    OPENMONTAGE_BUNDLE_VERSION: process.env.OPENMONTAGE_BUNDLE_VERSION || 'zora-dev',
    OPENMONTAGE_REVISION: process.env.OPENMONTAGE_REVISION || 'development',
    OPENMONTAGE_STUDIO_API_VERSION: process.env.OPENMONTAGE_STUDIO_API_VERSION || '0.1.0',
  };
}

/** Start studio_api sidecar (idempotent if already running). */
export async function startSidecar({ force = false } = {}) {
  const existing = resolveOmConnection();
  if (existing && !force) {
    try {
      const health = await omFetch(existing, HEALTH_PATH);
      if (health.ok) {
        return {
          ok: true,
          alreadyRunning: true,
          origin: existing.origin,
          pid: existing.pid || null,
          health: health.data,
          source: existing.source,
        };
      }
    } catch {
      /* fall through to restart */
    }
  }

  const probe = probeOpenMontageRuntime();
  if (!probe.ready) {
    return {
      ok: false,
      error: 'OM runtime 未就绪（需要 python+ffmpeg+engine/studio_api）',
      runtime: {
        coreReady: probe.coreReady,
        engineReady: probe.engineReady,
      },
    };
  }

  if (existing?.pid && processAlive(existing.pid)) {
    try {
      process.kill(existing.pid);
    } catch {
      /* ignore */
    }
    await delay(400);
  }
  clearState();

  const port =
    process.env.OM_API_PORT && Number(process.env.OM_API_PORT) > 0
      ? Number(process.env.OM_API_PORT)
      : await reserveLoopbackPort();
  const token = crypto.randomBytes(32).toString('base64url');
  const authority = crypto.randomBytes(32).toString('base64url');
  const env = buildSidecarEnv(probe, port, token, authority);
  const bootstrap =
    "import runpy,sys;sys.path.insert(0,sys.argv[1]);runpy.run_module('services.studio_api',run_name='__main__')";
  const child = spawn(probe.tools.python.path, ['-c', bootstrap, probe.engineRoot], {
    cwd: probe.engineRoot,
    env,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  });

  let diagnostic = '';
  child.stderr?.on('data', (chunk) => {
    diagnostic = `${diagnostic}${String(chunk)}`.slice(-8000);
  });
  child.stdout?.resume();

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('sidecar spawn timed out')), 15000);
    child.once('spawn', () => {
      clearTimeout(t);
      resolve();
    });
    child.once('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  }).catch((err) => {
    throw err;
  });

  const origin = `http://127.0.0.1:${port}`;
  const conn = { origin, token, localToolAuthorityToken: authority, pid: child.pid, source: 'state' };
  const deadline = Date.now() + 25000;
  let health = null;
  let lastError = 'health not ready';
  while (Date.now() < deadline && child.exitCode == null) {
    try {
      const r = await omFetch(conn, HEALTH_PATH);
      if (r.ok) {
        health = r.data;
        break;
      }
      lastError = `HTTP ${r.status}`;
    } catch (e) {
      lastError = String(e?.message || e);
    }
    await delay(120);
  }

  if (!health) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `sidecar health failed: ${lastError}`,
      diagnostic: diagnostic.trim().slice(0, 2000),
    };
  }

  writeState({
    host: '127.0.0.1',
    port,
    origin,
    token,
    localToolAuthorityToken: authority,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    projectsRoot: env.OPENMONTAGE_PROJECTS_ROOT,
  });

  // Survive parent exit (CLI / server restart). Stop via PID in sidecar-state.json.
  child.unref();

  return { ok: true, alreadyRunning: false, origin, pid: child.pid, port, health };
}

export async function stopSidecar() {
  const state = readStateFile();
  const pid = state?.pid;
  if (pid && processAlive(pid)) {
    try {
      process.kill(pid);
    } catch {
      /* ignore */
    }
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && processAlive(pid)) await delay(100);
    if (processAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* ignore */
      }
    }
  }
  clearState();
  return { ok: true, stopped: Boolean(pid) };
}

export function openMontageStatus() {
  const probe = probeOpenMontageRuntime();
  const conn = resolveOmConnection();
  const enabledFlag = process.env.OM_ENABLED === 'true';
  const enabled = enabledFlag || Boolean(conn);
  let message = 'OpenMontage 工具桥已预留';
  if (!probe.engine.linked) message = 'vendor/openmontage/engine 未链接；运行 scripts/link-engine.ps1';
  else if (!probe.coreReady) message = 'OM runtime 未齐（需 python + ffmpeg）';
  else if (!conn) message = 'Runtime 就绪；sidecar 未启动（POST /api/om/sidecar/start 或 scripts/start-sidecar.mjs）';
  else message = `Sidecar 已连接 ${conn.origin}（${conn.source}）`;

  return {
    stub: !conn,
    provider: 'openmontage',
    configured: probe.ready,
    enabled,
    live: Boolean(conn),
    baseUrl: conn?.origin || process.env.OM_API_BASE || null,
    vendorRoot: probe.vendorRoot,
    runtime: {
      ready: probe.ready,
      coreReady: probe.coreReady,
      engineReady: probe.engineReady,
      tools: Object.fromEntries(
        Object.entries(probe.tools).map(([k, v]) => [k, { present: v.present, version: v.version }]),
      ),
      engine: {
        linked: probe.engine.linked,
        studioApiPresent: probe.engine.studioApiPresent,
      },
    },
    sidecar: conn
      ? { running: true, origin: conn.origin, pid: conn.pid || null, source: conn.source }
      : { running: false },
    message,
  };
}

export async function listProjects() {
  const conn = resolveOmConnection();
  if (!conn) {
    return {
      stub: true,
      provider: 'openmontage',
      projects: [],
      error: 'sidecar 未启动',
      runtime: openMontageStatus().runtime,
    };
  }
  try {
    const r = await omFetch(conn, PROJECTS_PATH);
    if (!r.ok) {
      return { ok: false, status: r.status, error: r.data?.detail || r.data || 'list projects failed', stub: false };
    }
    return { ok: true, stub: false, live: true, ...(r.data || {}) };
  } catch (e) {
    return { ok: false, stub: false, error: String(e?.message || e) };
  }
}

export async function getProject(projectId) {
  const id = String(projectId || '').trim();
  if (!id) return { ok: false, status: 400, error: 'projectId required' };
  const conn = resolveOmConnection();
  if (!conn) return { ok: false, status: 503, stub: true, error: 'sidecar 未启动', projectId: id };
  try {
    const r = await omFetch(conn, `${PROJECTS_PATH}/${encodeURIComponent(id)}`);
    if (!r.ok) {
      return { ok: false, status: r.status, projectId: id, error: r.data?.detail || r.data || 'get project failed' };
    }
    return { ok: true, live: true, projectId: id, ...(r.data || {}) };
  } catch (e) {
    return { ok: false, projectId: id, error: String(e?.message || e) };
  }
}

export async function executeTool(projectId, payload = {}) {
  const id = String(projectId || payload.projectId || '').trim();
  const toolName = String(payload.tool || payload.tool_name || '').trim();
  if (!id) return { ok: false, status: 400, error: 'projectId required' };
  const isLocalStudio = LOCAL_STUDIO_TOOLS.has(toolName) || ALLOWED_TOOLS.has(toolName);
  if (!toolName) {
    return { ok: false, status: 400, error: 'tool required', localStudioTools: [...LOCAL_STUDIO_TOOLS] };
  }
  if (!isLocalStudio) {
    const inputs = {
      ...(payload.args || payload.arguments || {}),
      instruction: payload.instruction || payload.prompt || (payload.args && (payload.args.instruction || payload.args.prompt)) || undefined,
      project_id: id || undefined,
    };
    const invoked = await invokeRegistryTool(toolName, inputs);
    return {
      ok: Boolean(invoked.ok),
      status: invoked.status || (invoked.ok ? 200 : 500),
      live: true,
      provider: 'openmontage-registry',
      projectId: id || null,
      tool: toolName,
      ...invoked,
    };
  }
  const conn = resolveOmConnection();
  if (!conn) return { ok: false, status: 503, stub: true, error: 'sidecar 未启动', projectId: id };

  const args = payload.args || payload.arguments || {};
  const options = Object.fromEntries(Object.entries(args).filter(([key]) => !['instruction', 'prompt', 'attachments'].includes(key)));
  const instruction =
    String(payload.instruction || args.instruction || payload.prompt || args.prompt || '').trim() ||
    `Run ${toolName}`;
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : Array.isArray(args.attachments)
      ? args.attachments
      : [];
  const body = {
    tool_name: toolName,
    instruction: Object.keys(options).length ? `@${toolName} ${JSON.stringify(options)}` : (instruction.includes(`@${toolName}`) ? instruction : `@${toolName} ${instruction}`),
    attachments,
    idempotency_key:
      payload.idempotency_key ||
      payload.idempotencyKey ||
      `zora-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
  };

  try {
    const r = await omFetch(conn, `${PROJECTS_PATH}/${encodeURIComponent(id)}/tools/execute`, {
      method: 'POST',
      body,
      authority: true,
    });
    return {
      ok: r.ok,
      status: r.status,
      live: true,
      projectId: id,
      tool: toolName,
      ...(typeof r.data === 'object' && r.data ? r.data : { data: r.data }),
      error: r.ok ? undefined : r.data?.detail || r.data?.message || r.data || 'execute failed',
    };
  } catch (e) {
    return { ok: false, status: e.status || 500, projectId: id, error: String(e?.message || e) };
  }
}

export async function healthCheck() {
  const conn = resolveOmConnection();
  if (!conn) return { ok: false, error: 'sidecar 未启动' };
  try {
    const r = await omFetch(conn, HEALTH_PATH);
    return { ok: r.ok, status: r.status, ...(r.data || {}) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}


const LOCAL_STUDIO_TOOLS = new Set([
  'direct_clip_search',
  'video_compose',
  'subtitle_gen',
  'piper_tts',
  'transcriber',
]);

function catalogPaths() {
  const root = vendorRoot();
  return {
    tools: path.join(root, 'tool-catalog.json'),
    skills: path.join(root, 'skill-catalog.json'),
    invokePy: path.join(root, 'scripts', 'invoke-registry-tool.py'),
  };
}

export function listOmTools(filter = {}) {
  const p = catalogPaths().tools;
  if (!exists(p)) return { ok: false, tools: [], error: 'tool-catalog.json missing — run build catalog' };
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let tools = Array.isArray(data.tools) ? data.tools : [];
  const cap = filter.capability && String(filter.capability);
  const q = filter.q && String(filter.q).toLowerCase();
  if (cap) tools = tools.filter((t) => t.capability === cap);
  if (q) tools = tools.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
  return {
    ok: true,
    count: tools.length,
    total: data.count || tools.length,
    generatedAt: data.generatedAt || null,
    localStudioTools: [...LOCAL_STUDIO_TOOLS],
    tools: tools.slice(0, filter.limit ? Number(filter.limit) : 200),
  };
}

export function listOmSkills(filter = {}) {
  const p = catalogPaths().skills;
  if (!exists(p)) return { ok: false, skills: [], error: 'skill-catalog.json missing' };
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let skills = Array.isArray(data.skills) ? data.skills : [];
  const cat = filter.category && String(filter.category);
  const q = filter.q && String(filter.q).toLowerCase();
  if (cat) skills = skills.filter((s) => s.category === cat);
  if (q) skills = skills.filter((s) => (s.id + s.name + s.description).toLowerCase().includes(q));
  return {
    ok: true,
    count: skills.length,
    total: data.count || skills.length,
    skills: skills.slice(0, filter.limit ? Number(filter.limit) : 300).map(({ id, name, category, description, source }) => ({ id, name, category, description, source })),
  };
}

export function getOmSkill(skillId) {
  const id = String(skillId || '').replace(/^om:/, '');
  if (!id) return { ok: false, error: 'skillId required' };
  const file = path.join(vendorRoot(), 'engine', 'skills', id.endsWith('.md') ? id : id + '.md');
  if (!exists(file)) return { ok: false, error: 'skill not found', skillId };
  const body = fs.readFileSync(file, 'utf8');
  const name = (body.match(/^#\s+(.+)$/m) || [, id])[1].trim();
  return {
    ok: true,
    id: 'om:' + id.replace(/\.md$/i, ''),
    name,
    category: id.split(/[\\/]/)[0] || 'om',
    description: name,
    prompt: body.slice(0, 20000),
    source: 'openmontage',
  };
}

function invokeRegistryTool(toolName, inputs = {}) {
  const probe = probeOpenMontageRuntime();
  if (!probe.tools.python?.present) {
    return Promise.resolve({ ok: false, status: 503, error: 'python runtime missing' });
  }
  const script = catalogPaths().invokePy;
  if (!exists(script)) return Promise.resolve({ ok: false, status: 500, error: 'invoke helper missing' });
  return new Promise((resolve) => {
    const child = spawn(probe.tools.python.path, [script], {
      cwd: probe.engineRoot,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONNOUSERSITE: '1',
        OPENMONTAGE_FFMPEG_EXECUTABLE: probe.tools.ffmpeg?.path || '',
        OPENMONTAGE_FFPROBE_EXECUTABLE: probe.tools.ffprobe?.path || '',
        OPENMONTAGE_HYPERFRAMES_CLI: probe.tools.hyperframesCli?.path || '',
        HYPERFRAMES_BROWSER_PATH: probe.tools.hyperframesBrowser?.path || '',
        PATH: [path.dirname(probe.tools.python.path), path.dirname(probe.tools.ffmpeg?.path || ''), process.env.PATH].filter(Boolean).join(path.delimiter),
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve({ ok: false, status: 504, error: 'registry tool timed out', tool: toolName });
    }, 180000);
    child.stdout.on('data', (c) => { out += String(c); });
    child.stderr.on('data', (c) => { err += String(c); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const json = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
        resolve({ ...json, status: json.ok ? 200 : 500, stderr: err.slice(-1500) || undefined });
      } catch {
        resolve({ ok: false, status: 500, error: 'invalid tool output', raw: out.slice(0, 2000), stderr: err.slice(-1500), code });
      }
    });
    child.on('error', (error) => { clearTimeout(timer); resolve({ ok: false, status: 500, error: error.message, tool: toolName }); });
    child.stdin.on('error', (error) => { clearTimeout(timer); resolve({ ok: false, status: 500, error: error.message, tool: toolName }); });
    child.stdin.write(JSON.stringify({ tool: toolName, inputs }));
    child.stdin.end();
  });
}

export class OpenMontageAdapter {
  status() {
    return openMontageStatus();
  }
  listProjects() {
    return listProjects();
  }
  getProject(id) {
    return getProject(id);
  }
  execute(projectId, payload) {
    return executeTool(projectId, payload);
  }
  probe() {
    return probeOpenMontageRuntime();
  }
  start(opts) {
    return startSidecar(opts);
  }
  stop() {
    return stopSidecar();
  }
  health() {
    return healthCheck();
  }
}

export const openMontage = {
  status: openMontageStatus,
  listProjects,
  getProject,
  executeTool,
  listTools: listOmTools,
  listSkills: listOmSkills,
  getSkill: getOmSkill,
  probe: probeOpenMontageRuntime,
  start: startSidecar,
  stop: stopSidecar,
  health: healthCheck,
};
