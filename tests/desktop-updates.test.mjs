import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createUpdateChannel} from '../apps/desktop/main/updates.mjs';
function fixture(enabled=true,confirm=true){
 const updater=new EventEmitter(),calls=[];
 updater.checkForUpdates=async()=>{calls.push('check');updater.emit('update-available',{version:'0.2.0'});};
 updater.downloadUpdate=async()=>{calls.push('download');updater.emit('update-downloaded',{version:'0.2.0'});};
 updater.quitAndInstall=()=>calls.push('install');
 const run=createUpdateChannel({updater,version:'0.1.0',enabled,confirmInstall:async()=>confirm,prepareInstall:async()=>calls.push('cleanup')});
 return {run,updater,calls};
}
test('update requires separate download and installation, cleanup first',async()=>{
 const {run,updater,calls}=fixture();assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false);assert.equal(updater.allowDowngrade,false);
 assert.equal((await run('check')).phase,'available');assert.deepEqual(calls,['check']);
 assert.equal((await run('download')).phase,'downloaded');await run('install');assert.deepEqual(calls,['check','download','cleanup','install']);
});
test('development mode rejects changes',async()=>{const {run}=fixture(false);assert.equal((await run('status')).phase,'disabled');await assert.rejects(run('check'));});
test('cancelled confirmation never installs',async()=>{const {run,calls}=fixture(true,false);await run('check');await run('download');await run('install');assert.deepEqual(calls,['check','download']);});
test('failed download cannot install, recheck can recover',async()=>{const {run,updater,calls}=fixture();await run('check');updater.downloadUpdate=async()=>{throw Error('checksum mismatch');};assert.equal((await run('download')).phase,'error');await run('install');assert.ok(!calls.includes('install'));assert.equal((await run('check')).phase,'available');});
