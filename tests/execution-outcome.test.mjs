import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {executionOutcome} from '../packages/agent/execution-outcome.mjs';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
test('nonzero child validation cannot be reported as completed by outer zero exit',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-child-result-'));
 const runtime=createLocalRuntime({directory:path.join(root,'ledger'),workspaceRoot:path.join(root,'workspace'),backend:'native'});
 const r=runtime.propose({kind:'exec',runtime:'node',command:"const r=require('child_process').spawnSync(process.execPath,['-e',\"console.error('records empty');process.exitCode=1\"],{encoding:'utf8',windowsHide:true});console.log(JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));process.exitCode=0;"});
 const result=await runtime.approve(r.id);
 assert.equal(result.status,'failed');assert.equal(result.metadata.childExitCode,1);assert.match(result.stderr,/records empty/);
});
test('ordinary output and successful envelopes remain successful',()=>{
 for(const stdout of ['ordinary log','{"status":1}','{"status":0,"stdout":"ok","stderr":""}'])assert.equal(executionOutcome({stdout}).status,'completed');
});
