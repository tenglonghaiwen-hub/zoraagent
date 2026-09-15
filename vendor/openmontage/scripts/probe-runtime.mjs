#!/usr/bin/env node
/**
 * Probe vendor/openmontage runtime + engine. No network. No secrets printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '../..');
const manifestPath = path.join(ROOT, 'runtime-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function abs(rel) {
  return path.resolve(ROOT, rel);
}

function tryVersion(exe, args = ['--version']) {
  if (!exists(exe)) return null;
  const r = spawnSync(exe, args, { encoding: 'utf8', timeout: 8000, windowsHide: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split(/\r?\n/)[0] || '';
  return out.slice(0, 120) || (r.status === 0 ? 'ok' : null);
}

const checks = [];
function add(name, candidates, versionArgs) {
  const found = candidates.find((p) => exists(p));
  const p = found || candidates[0];
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  checks.push({
    name,
    path: rel.startsWith('..') ? p : rel,
    present: Boolean(found),
    version: found && versionArgs ? tryVersion(found, versionArgs) : null,
  });
}

const zoraNode = path.join(REPO_ROOT, 'runtime', 'node-v24.21.0-win-x64', 'node.exe');
add('node', [abs(manifest.node.executable), zoraNode], ['-v']);
add('python', [abs(manifest.python.executable)], ['--version']);
add('ffmpeg', [abs(manifest.ffmpeg.executable)], ['-version']);
add('ffprobe', [abs(manifest.ffmpeg.ffprobe)], ['-version']);
if (manifest.hyperframes?.cli) add('hyperframes.cli', [abs(manifest.hyperframes.cli)], null);
if (manifest.hyperframes?.browser) add('hyperframes.browser', [abs(manifest.hyperframes.browser)], null);
if (manifest.codex?.executable) add('codex', [abs(manifest.codex.executable)], ['--version']);

const engineRoot = abs(manifest.engine?.root || 'engine');
const studioApi = abs(manifest.engine?.studio_api || 'engine/services/studio_api');
const engine = {
  root: manifest.engine?.root || 'engine',
  present: exists(engineRoot) && fs.readdirSync(engineRoot).some((n) => !n.startsWith('.')),
  studio_api: exists(path.join(studioApi, 'app.py')) || exists(path.join(studioApi, '__main__.py')) || exists(path.join(studioApi, 'main.py')),
};

const coreOk = ['node', 'python', 'ffmpeg'].every((n) => checks.find((c) => c.name === n)?.present);
const report = {
  ok: coreOk && engine.studio_api,
  root: ROOT,
  manifestVersion: manifest.version,
  runtime: checks,
  engine,
  stub: true,
  message: coreOk && engine.studio_api
    ? 'Core runtime + studio_api present. API still stub until OM_ENABLED + sidecar.'
    : 'Fill missing runtime binaries / link engine before enabling OM_ENABLED.',
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);
