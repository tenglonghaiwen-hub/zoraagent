import {dataPath,workspacePath} from '../../packages/runtime-paths.mjs';
import { loadStoredMinimaxKey } from './minimax-credentials.mjs';
import { loadStoredAgentKey } from './agent-credentials.mjs';
import { startCodexKernel } from './codex-agent.mjs';
import { peekKernel } from '../../packages/agent/codex-kernel.mjs';
import { createLocalRuntime } from '../../packages/agent/local-runtime.mjs';
import { createWorkflowStore } from '../../packages/agent/workflow-store.mjs';
import { createGenerationTaskStore } from '../../packages/duoyuanx/task-store.mjs';
import { generateBatch } from '../../packages/duoyuanx/generation-service.mjs';
import { packGenerateRequest } from '../../packages/duoyuanx/generation-adapters.mjs';
import { getModel } from '../../packages/duoyuanx/catalog.mjs';
import { agentStatus } from './codex-agent.mjs';
import { createChatService } from './chat-service.mjs';
import { createLocalApiCaller } from '../../packages/agent/api.mjs';
import { handleDuoyuanxRequest } from '../../packages/duoyuanx/proxy.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Route handlers
import { serveStatic } from './routes/static.mjs';
import { handleWorkspaceRoutes } from './routes/workspace.mjs';
import { handleLocalRuntimeRoutes } from './routes/local-runtime.mjs';
import { handleGenerationRoutes } from './routes/generation.mjs';
import { handleOpenMontageRoutes } from './routes/openmontage.mjs';
import { handleAuthRoutes } from './routes/auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ─── .env loading ───────────────────────────────────────────────────────────

/** Load KEY=VALUE pairs from a .env file without printing secrets. */
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    return true;
  } catch {
    return false;
  }
}

const envCandidates = [
  process.env.ZORA_ENV_PATH,
  path.join(ROOT, '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '..', '.env'),
].filter(Boolean);

for (const p of envCandidates) loadEnvFile(p);
loadStoredAgentKey(ROOT);
loadStoredMinimaxKey(ROOT);

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 8787);
const CLIENT_DIR =
  process.env.ZORA_CLIENT_DIR ||
  path.resolve(__dirname, '..', 'client') ||
  path.resolve(ROOT, 'apps', 'client');
const WORKSPACE_ROOT = workspacePath();

// ─── Service singletons (lazy) ─────────────────────────────────────────────

const callApi = createLocalApiCaller({ port: PORT });
const handleChat = createChatService({
  callApi,
  storageDirectory: process.env.ZORA_CHAT_STORE_DIR || dataPath('chat-sessions'),
});

let localRuntime;
let localWorkflows;
let generationTasks;

function runtime() {
  return (localRuntime ||= createLocalRuntime({
    directory: dataPath('local-approvals'),
    workspaceRoot: WORKSPACE_ROOT,
    dockerImage: process.env.ZORA_SANDBOX_IMAGE || 'node:24-bookworm-slim',
    backend: process.env.ZORA_RUNTIME_BACKEND || 'auto',
  }));
}

function workflows() {
  return (localWorkflows ||= createWorkflowStore({
    directory: dataPath('local-workflows'),
    runtime: runtime(),
  }));
}

function taskStore() {
  if (!generationTasks) {
    const base = (process.env.DUOYUANX_BASE_URL || 'https://duoyuanx.com').replace(/\/$/, '');
    const key = process.env.DUOYUANX_API_KEY || '';
    generationTasks = createGenerationTaskStore({
      directory: process.env.ZORA_TASK_STORE_DIR || dataPath('generation-tasks'),
      getModel,
      base,
      key,
      generate: (draft, model, options) => generateBatch(draft, model, { base, key, ...options }),
    });
    generationTasks.start();
  }
  return generationTasks;
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

// ─── Shared context for route handlers ──────────────────────────────────────

const ctx = {
  sendJson,
  readJson,
  runtime,
  workflows,
  taskStore,
  handleChat,
  clientDir: CLIENT_DIR,
  workspaceRoot: WORKSPACE_ROOT,
};

// ─── HTTP server ────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Route delegation — each handler returns true if it consumed the request
    if (await handleWorkspaceRoutes(req, res, url, ctx)) return;
    if (await handleLocalRuntimeRoutes(req, res, url, ctx)) return;
    if (await handleDuoyuanxRequest(req, res, url)) return;
    if (await handleAuthRoutes(req, res, url, ctx)) return;
    if (await handleGenerationRoutes(req, res, url, ctx)) return;
    if (await handleOpenMontageRoutes(req, res, url, ctx)) return;
    if (req.method === 'GET' && serveStatic(req, res, url, ctx)) return;

    sendJson(res, 404, { error: '未找到' });
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message || err) });
  }
});

// ─── Lifecycle hooks ────────────────────────────────────────────────────────

server.on('listening', () => {
  if (process.env.DUOYUANX_API_KEY) taskStore();
});

let workflowTimer;
server.on('listening', () => {
  if (fs.existsSync(dataPath('local-workflows'))) workflows();
  workflowTimer = setInterval(() => {
    localWorkflows?.tick().catch((e) => console.error('Workflow scheduler:', e.message));
  }, 1000);
  workflowTimer.unref();
});

server.on('listening', () => {
  startCodexKernel().catch((e) => console.error('Codex kernel startup:', e.message));
});

server.on('close', () => {
  peekKernel()?.close();
  generationTasks?.close();
  clearInterval(workflowTimer);
});

// ─── Entrypoint ─────────────────────────────────────────────────────────────

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, process.env.ZORA_SERVER_HOST || '127.0.0.1', () => {
    const configured = Boolean(process.env.DUOYUANX_API_KEY);
    const agent = agentStatus();
    console.log(`Zora server listening on http://127.0.0.1:${PORT}`);
    console.log(`DUOYUANX_API_KEY configured: ${configured}`);
    console.log(`Agent Codex: configured=${agent.configured} enabled=${agent.enabled} backend=${agent.backend}`);
    console.log(`client dir: ${CLIENT_DIR}`);
  });
}

export { server, loadEnvFile, packGenerateRequest };
