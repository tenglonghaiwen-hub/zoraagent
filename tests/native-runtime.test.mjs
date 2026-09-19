import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalRuntime } from '../packages/agent/local-runtime.mjs';

const fixture = (backend = 'native', execFileImpl = async () => { throw Error('ENOENT: docker not found'); }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zora-native-runtime-'));
  return {
    directory: path.join(root, 'approvals'),
    workspaceRoot: path.join(root, 'workspace'),
    backend,
    execFileImpl,
  };
};

test('native runtime status is available without docker and requires no docker CLI calls', async () => {
  let dockerCalled = false;
  const config = fixture('native', async () => {
    dockerCalled = true;
    throw Error('Docker should not be invoked');
  });

  const runtime = createLocalRuntime(config);
  const st = await runtime.status();

  assert.equal(st.available, true);
  assert.equal(st.backend, 'native');
  assert.equal(st.workspaceRoot, config.workspaceRoot);
  assert.equal(dockerCalled, false);
});

test('native runtime executes write, read, list, and search directly in workspace', async () => {
  const config = fixture('native');
  const runtime = createLocalRuntime(config);

  // 1. Write file
  const writeProp = runtime.propose({
    kind: 'write',
    path: 'hello.txt',
    content: 'Hello Zora Desktop Native Workspace!',
  });
  assert.equal(writeProp.status, 'pending');

  const writeResult = await runtime.approve(writeProp.id);
  assert.equal(writeResult.status, 'completed');
  assert.ok(fs.existsSync(path.join(config.workspaceRoot, 'hello.txt')));
  assert.equal(fs.readFileSync(path.join(config.workspaceRoot, 'hello.txt'), 'utf8'), 'Hello Zora Desktop Native Workspace!');
  assert.ok(writeResult.artifacts && writeResult.artifacts.length > 0);

  // 2. Read file
  const readProp = runtime.propose({
    kind: 'read',
    path: 'hello.txt',
  });
  const readResult = await runtime.approve(readProp.id);
  assert.equal(readResult.status, 'completed');
  assert.equal(readResult.stdout, 'Hello Zora Desktop Native Workspace!');

  // 3. Subdirectory write & list
  const subWrite = runtime.propose({
    kind: 'write',
    path: 'scripts/build.js',
    content: 'console.log("build target");',
  });
  await runtime.approve(subWrite.id);

  const listProp = runtime.propose({ kind: 'list', path: '.' });
  const listResult = await runtime.approve(listProp.id);
  assert.equal(listResult.status, 'completed');
  assert.match(listResult.stdout, /hello\.txt/);
  assert.match(listResult.stdout, /scripts/);

  // 4. Literal search
  const searchProp = runtime.propose({ kind: 'search', path: '.', query: 'build target' });
  const searchResult = await runtime.approve(searchProp.id);
  assert.equal(searchResult.status, 'completed');
  assert.match(searchResult.stdout, /scripts\/build\.js:1:console\.log\("build target"\);/);
});

test('native runtime enforces path boundary and rejects sensitive files or path traversal', async () => {
  const config = fixture('native');
  const runtime = createLocalRuntime(config);

  for (const illegalPath of ['../escape.txt', '/absolute/file.txt', 'C:/Windows/system32', '.env', 'sub/.env.secret']) {
    assert.throws(() => {
      runtime.propose({ kind: 'read', path: illegalPath });
    }, /越界|受限|仅允许工作区/);

    assert.throws(() => {
      runtime.propose({ kind: 'write', path: illegalPath, content: 'bad' });
    }, /越界|受限|仅允许工作区/);
  }
});

test('auto mode gracefully falls back to native when docker is not installed or unreachable', async () => {
  let dockerProbed = false;
  const config = fixture('auto', async (file) => {
    if (file === 'docker') {
      dockerProbed = true;
      throw Error('docker: command not found');
    }
    return { stdout: '', stderr: '' };
  });

  const runtime = createLocalRuntime(config);
  const st = await runtime.status();

  assert.equal(dockerProbed, true);
  assert.equal(st.available, true);
  assert.equal(st.backend, 'native');
  assert.equal(st.fallbackFromDocker, true);

  // Should successfully write and read in fallback mode
  const writeProp = runtime.propose({ kind: 'write', path: 'test-auto.txt', content: 'Fallback Auto Native' });
  const done = await runtime.approve(writeProp.id);
  assert.equal(done.status, 'completed');
  assert.equal(fs.readFileSync(path.join(config.workspaceRoot, 'test-auto.txt'), 'utf8'), 'Fallback Auto Native');
});
