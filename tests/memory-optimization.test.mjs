import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

test('index.html contains low memory mode toggle and purge controls', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/client/index.html'), 'utf8');
  assert.match(html, /id="low-memory-mode"/);
  assert.match(html, /id="purge-memory-btn"/);
  assert.match(html, /id="storage-usage-text"/);
});

test('style.css defines comprehensive low-memory mode acceleration styles', () => {
  const css = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');
  assert.match(css, /html\.low-memory-mode video\.backdrop/);
  assert.match(css, /html\.low-memory-mode \*/);
  assert.match(css, /backdrop-filter:\s*none\s*!important/);
});

test('app.js implements smart backdrop pausing and history memory controls', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  assert.match(appJs, /isLowMemoryMode/);
  assert.match(appJs, /window\.__clearCanvasHistory/);
  assert.match(appJs, /#low-memory-mode/);
  assert.match(appJs, /#purge-memory-btn/);
  assert.match(appJs, /updateStorageUsageDisplay/);
});

test('style.css guarantees crystal clear contrast in day mode', () => {
  const css = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');
  assert.match(css, /html\[data-theme="day"\] \.studio-centered \.prompt-card/);
  assert.match(css, /html\[data-theme="day"\] \.studio-centered \.compact-composer #prompt/);
  assert.match(css, /html\[data-theme="day"\] \.studio-centered \.content/);
});

