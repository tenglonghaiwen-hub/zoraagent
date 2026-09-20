import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {configurePackagedRuntime,packagedPort} from '../apps/desktop/main/packaged-runtime.mjs';

test('installed runtime separates private state from immutable package and persists its origin',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-package-test-'));
  const root=path.join(directory,'application'),profile=path.join(directory,'profile');
  fs.mkdirSync(path.join(root,'runtime'),{recursive:true});
  fs.writeFileSync(path.join(root,'runtime/runtime-manifest.json'),JSON.stringify({nodeRelativePath:'runtime/node/node.exe',codexRelativePath:'runtime/codex/codex.exe'}));
  const env={PATH:'original'};configurePackagedRuntime(root,profile,env);
  assert.equal(env.ZORA_WORKSPACE_ROOT,path.join(profile,'workspace'));
  assert.equal(env.DATABASE_PATH,path.join(profile,'data/zora.db'));
  assert.equal(env.ZORA_BRIDGE_DIRECTORY,env.ZORA_DATA_DIR);
  assert.equal(env.ZORA_CODEX_BIN,path.join(root,'runtime/codex/codex.exe'));
  assert.equal(env.OM_AUTO_SIDECAR,'false');
  assert.ok(!fs.existsSync(path.join(root,'data')));
  const first=await packagedPort(profile);assert.equal(await packagedPort(profile),first);
  assert.ok(first>=1024&&first<=65535);
  const code=`import {dataPath,bridgePath,workspacePath} from './packages/runtime-paths.mjs';console.log(JSON.stringify([dataPath('chat'),bridgePath('desktop-bridge.json'),workspacePath()]));`;
  const values=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,...env},encoding:'utf8'}));
  assert.deepEqual(values,[path.join(profile,'data/chat'),path.join(profile,'data/desktop-bridge.json'),path.join(profile,'workspace')]);
});

test('bundled OpenMontage gets writable versioned engine, isolated state and shared durable projects',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-om-package-test-'));
  const root=path.join(directory,'application'),profile=path.join(directory,'profile');
  fs.mkdirSync(path.join(root,'runtime'),{recursive:true});
  fs.writeFileSync(path.join(root,'runtime/runtime-manifest.json'),JSON.stringify({nodeRelativePath:'runtime/node/node.exe',codexRelativePath:'runtime/codex/codex.exe'}));
  const vendor=path.join(root,'vendor/openmontage');fs.mkdirSync(path.join(vendor,'engine'),{recursive:true});
  fs.writeFileSync(path.join(vendor,'engine/config.yaml'),'{}');
  fs.writeFileSync(path.join(vendor,'bundle.json'),JSON.stringify({engineDigest:'a'.repeat(64),sourceRevision:'test',version:'test'}));
  const env={OM_API_BASE:'http://old',OM_API_TOKEN:'old'};configurePackagedRuntime(root,profile,env);
  assert.equal(env.OM_AUTO_SIDECAR,'true');assert.equal(env.OM_ENABLED,'true');
  assert.ok(env.OM_ENGINE_ROOT.startsWith(profile));assert.ok(env.OM_STATE_DIR.startsWith(profile));
  assert.equal(env.OM_API_TOKEN,undefined);assert.equal(env.OM_API_BASE,undefined);
  fs.writeFileSync(path.join(env.OM_ENGINE_ROOT,'config.yaml'),'custom');
  const projects=env.OM_PROJECTS_ROOT;
  configurePackagedRuntime(root,profile,env);assert.equal(fs.readFileSync(path.join(env.OM_ENGINE_ROOT,'config.yaml'),'utf8'),'custom');
  fs.writeFileSync(path.join(vendor,'bundle.json'),JSON.stringify({engineDigest:'b'.repeat(64),sourceRevision:'test2',version:'test2'}));
  configurePackagedRuntime(root,profile,env);assert.equal(env.OM_PROJECTS_ROOT,projects);
  assert.equal(fs.readFileSync(path.join(env.OM_ENGINE_ROOT,'config.yaml'),'utf8'),'custom');
  assert.equal(fs.readFileSync(path.join(profile,'openmontage/engines','a'.repeat(64),'config.yaml'),'utf8'),'custom');
});
