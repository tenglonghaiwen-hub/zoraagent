import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../apps/desktop/main/main.mjs',import.meta.url),'utf8');
function setup(){
 const context=vm.createContext({Date,AbortSignal,setTimeout,fetch:async()=>({ok:true})});
 vm.runInContext(source.slice(source.indexOf('async function waitForUrl('),source.indexOf('function spawnLogged(')),context);
 return context.waitForUrl;
}
test('desktop surfaces backend bind error immediately instead of masking it as fetch failed',async()=>{
 await assert.rejects(setup()('http://localhost',45000,{exitCode:1,startupStderr:'listen EACCES: permission denied 0.0.0.0:4317'}),/EACCES/);
});
test('desktop surfaces spawn failure and accepts healthy backend',async()=>{
 await assert.rejects(setup()('http://localhost',45000,{exitCode:null,startupError:'spawn ENOENT'}),/ENOENT/);
 assert.equal(await setup()('http://localhost',45000,{exitCode:null}),true);
});
