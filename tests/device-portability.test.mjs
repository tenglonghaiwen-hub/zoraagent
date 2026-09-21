import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loopbackHandler} from '../apps/desktop/main/loopback-origin.mjs';
import {configurePackagedRuntime} from '../apps/desktop/main/packaged-runtime.mjs';
import {validateNetwork,applyNetwork} from '../apps/desktop/main/network-settings.mjs';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
test('no Docker native exec must not report success without running a script',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-no-docker-'));
 const runtime=createLocalRuntime({directory:path.join(root,'approvals'),workspaceRoot:path.join(root,'workspace'),backend:'native'});
 const proposal=runtime.propose({kind:'exec',command:'echo must-not-run'});
 const result=await runtime.approve(proposal.id);assert.equal(result.status,'failed');assert.match(result.error,/脚本未执行/);
});
test('port recovery preserves method/body/auth/range but refuses foreign origin',async()=>{
 let seen;const handler=loopbackHandler(1234,5678,{forward:async(url,init)=>{seen={url,init};return new Response('ok');},external:()=>new Response('external')});
 await handler(new Request('http://127.0.0.1:1234/api/test',{method:'POST',headers:{origin:'http://127.0.0.1:1234',authorization:'Bearer test'},body:'payload'}));
 assert.equal(seen.url,'http://127.0.0.1:5678/api/test');assert.equal(seen.init.headers.get('origin'),'http://127.0.0.1:5678');assert.equal(seen.init.headers.get('authorization'),'Bearer test');assert.equal(await new Response(seen.init.body).text(),'payload');
 assert.equal((await handler(new Request('http://127.0.0.1:1234/api/test',{headers:{origin:'https://evil.invalid'}}))).status,403);
});
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zora-portability-'));fs.mkdirSync(path.join(dir,'app/runtime'),{recursive:true});fs.writeFileSync(path.join(dir,'app/runtime/runtime-manifest.json'),JSON.stringify({nodeRelativePath:'runtime/node.exe',codexRelativePath:'runtime/codex.exe'}));return {root:path.join(dir,'app'),profile:path.join(dir,'profile')};}
test('invalid OM bundle never blocks base runtime',()=>{const {root,profile}=fixture();fs.mkdirSync(path.join(root,'vendor/openmontage'),{recursive:true});fs.writeFileSync(path.join(root,'vendor/openmontage/bundle.json'),'{');const env={};configurePackagedRuntime(root,profile,env);assert.ok(env.ZORA_OM_INIT_ERROR);assert.equal(env.OM_ENABLED,'false');assert.ok(fs.existsSync(env.ZORA_WORKSPACE_ROOT));});
test('hardlink denied falls back to copy and preserves edited config across upgrades',()=>{
 const {root,profile}=fixture(),vendor=path.join(root,'vendor/openmontage');fs.mkdirSync(path.join(vendor,'engine'),{recursive:true});fs.writeFileSync(path.join(vendor,'engine/config.yaml'),'initial');const manifest=digest=>fs.writeFileSync(path.join(vendor,'bundle.json'),JSON.stringify({engineDigest:digest.repeat(64),sourceRevision:'test',version:'test'}));
 const options={link:()=>{throw Object.assign(Error('denied'),{code:'EPERM'});}},env={};manifest('a');configurePackagedRuntime(root,profile,env,options);assert.equal(env.ZORA_OM_INIT_ERROR,undefined);fs.writeFileSync(path.join(env.OM_ENGINE_ROOT,'config.yaml'),'personal');configurePackagedRuntime(root,profile,env,options);assert.equal(fs.readFileSync(path.join(env.OM_ENGINE_ROOT,'config.yaml'),'utf8'),'personal');manifest('b');configurePackagedRuntime(root,profile,env,options);assert.equal(fs.readFileSync(path.join(env.OM_ENGINE_ROOT,'config.yaml'),'utf8'),'personal');
});
test('network applies proxy while excluding loopback and rejects embedded secrets',()=>{const env={https_proxy:'http://old'};applyNetwork(validateNetwork({mode:'proxy',proxy:'http://127.0.0.1:7890'}),env);assert.equal(env.HTTPS_PROXY,'http://127.0.0.1:7890');assert.equal(env.https_proxy,undefined);assert.ok(env.NO_PROXY.includes('127.0.0.1'));assert.throws(()=>validateNetwork({mode:'proxy',proxy:'http://user:secret@localhost:99'}));applyNetwork({mode:'direct'},env);assert.equal(env.HTTPS_PROXY,undefined);});
