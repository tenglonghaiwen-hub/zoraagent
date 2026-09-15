import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalRuntime} from '../packages/agent/local-runtime.mjs';
import {AGENT_TOOL_DEFS} from '../packages/agent/tools.mjs';
const fixture=execFileImpl=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'zora-local-runtime-'));return {directory:path.join(root,'approvals'),workspaceRoot:path.join(root,'workspace'),dockerImage:'alpine:3.20',execFileImpl};};
test('pending approval performs no process; approve runs only Docker with fixed isolation and consumes once',async()=>{
 const calls=[],config=fixture(async(file,args,options)=>{calls.push({file,args,options});return {stdout:'ok',stderr:''};}),runtime=createLocalRuntime(config);
 const proposal=runtime.propose({kind:'exec',command:'echo hello'});assert.equal(proposal.status,'pending');assert.equal(calls.length,0);
 const done=await runtime.approve(proposal.id);assert.equal(done.status,'completed');
 const run=calls.find(c=>c.args[0]==='run');assert.equal(run.file,'docker');assert.equal(run.options.shell,undefined);
 for(const [flag,value] of [['--network','none'],['--cap-drop','ALL'],['--security-opt','no-new-privileges'],['--memory','512m'],['--cpus','1'],['--pids-limit','64'],['--user','1000:1000'],['--workdir','/workspace'],['--pull','never']])assert.equal(run.args[run.args.indexOf(flag)+1],value);
 assert.ok(run.args.includes('--read-only'));assert.match(run.args[run.args.indexOf('--mount')+1],/target=\/workspace$/);assert.deepEqual(run.args.slice(-3),['sh','-lc','echo hello']);
 await runtime.approve(proposal.id);assert.equal(calls.filter(c=>c.args[0]==='run').length,1);
 await createLocalRuntime(config).approve(proposal.id);assert.equal(calls.filter(c=>c.args[0]==='run').length,1);
});
test('write passes bytes through stdin and read/write paths cannot traverse or target secrets',async()=>{
 const calls=[],runtime=createLocalRuntime(fixture(async(file,args,options)=>{calls.push({args,options});return {};}));
 for(const p of ['../escape','/absolute','D:/host','.env','folder/.env.local','secret.pem'])assert.throws(()=>runtime.propose({kind:'read',path:p}));
 const proposal=runtime.propose({kind:'write',path:'note.txt',content:'literal $(host command)'});await runtime.approve(proposal.id);
 const run=calls.find(c=>c.args[0]==='run');assert.equal(run.options.input,'literal $(host command)');assert.ok(!run.args.includes(run.options.input));
});
test('Docker unavailable stays blocked without host fallback; denied approval does not execute',async()=>{
 const calls=[],runtime=createLocalRuntime(fixture(async(file,args)=>{calls.push({file,args});throw Error('ENOENT docker');}));
 const proposal=runtime.propose({kind:'read',path:'a.txt'});assert.equal((await runtime.approve(proposal.id)).status,'blocked');assert.ok(calls.every(c=>c.file==='docker'));assert.ok(calls.every(c=>c.args[0]!=='run'));
 const denied=runtime.propose({kind:'exec',command:'echo denied'});runtime.deny(denied.id);const count=calls.length;await runtime.approve(denied.id);assert.equal(calls.length,count);
});
test('timed out container is explicitly removed and interrupted consumed approvals never replay',async()=>{
 const calls=[],config=fixture(async(file,args)=>{calls.push(args);if(args[0]==='run')throw Object.assign(Error('timeout'),{killed:true});return {};});const runtime=createLocalRuntime(config);
 const proposal=runtime.propose({kind:'exec',command:'sleep 99'});assert.equal((await runtime.approve(proposal.id)).status,'failed');assert.ok(calls.some(args=>args[0]==='rm'&&args[1]==='-f'));
 const pending=runtime.propose({kind:'exec',command:'echo interrupted'}),file=path.join(config.directory,pending.id+'.json');const record=JSON.parse(fs.readFileSync(file));record.status='consumed';fs.writeFileSync(file,JSON.stringify(record));
 const restored=createLocalRuntime(config);assert.equal(restored.list().find(r=>r.id===pending.id).status,'unknown');const count=calls.length;await restored.approve(pending.id);assert.equal(calls.length,count);
});
test('tampered proposal and repository workspace are rejected',async()=>{
 const config=fixture(async()=>({})),runtime=createLocalRuntime(config),p=runtime.propose({kind:'exec',command:'echo original'}),file=path.join(config.directory,p.id+'.json');const record=JSON.parse(fs.readFileSync(file));record.request.command='echo changed';fs.writeFileSync(file,JSON.stringify(record));await assert.rejects(runtime.approve(p.id),/改变/);
 fs.writeFileSync(path.join(config.workspaceRoot,'.env'),'dummy');assert.throws(()=>runtime.propose({kind:'exec',command:'cat .env'}),/受限/);
});
test('independent code projects remain usable and unavailable status retains configuration',async()=>{
 const config=fixture(async()=>({})),runtime=createLocalRuntime(config);
 fs.writeFileSync(path.join(config.workspaceRoot,'package.json'),'{}');fs.writeFileSync(path.join(config.workspaceRoot,'AGENTS.md'),'Local project instructions');
 assert.equal((await runtime.status()).available,true);assert.equal((await runtime.approve(runtime.propose({kind:'exec',command:'ls'}).id)).status,'completed');
 const unavailable=createLocalRuntime({...config,execFileImpl:async()=>{throw Error('offline');}}),status=await unavailable.status();
 assert.equal(status.available,false);assert.equal(status.workspaceRoot,config.workspaceRoot);assert.equal(status.dockerImage,config.dockerImage);assert.equal(status.network,'none');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assert.throws(()=>createLocalRuntime({...config,workspaceRoot:root}),/Zora 项目根目录/);
});
test('list and literal search use approved Docker operations with bounded output and argument-safe query',async()=>{
 const calls=[],runtime=createLocalRuntime(fixture(async(file,args,options)=>{calls.push({file,args,options});return {stdout:'sample.txt:1:match',stderr:''};}));
 const list=runtime.propose({kind:'list'}),search=runtime.propose({kind:'search',query:'$(do not execute); --flag'});assert.equal(calls.length,0);assert.equal(list.request.path,'.');
 await runtime.approve(list.id);await runtime.approve(search.id);
 const runs=calls.filter(c=>c.args[0]==='run');assert.equal(runs.length,2);assert.deepEqual(runs[0].args.slice(-5),['sh','-lc','ls -la -- "$1"','zora-list','.']);
 assert.equal(runs[1].args.at(-1),'$(do not execute); --flag');assert.match(runs[1].args.at(-4),/grep -r -n -F -I/);assert.equal(runs[1].options.maxBuffer,64*1024);assert.equal(runs[1].options.timeout,30000);
 assert.throws(()=>runtime.propose({kind:'search',query:''}),/搜索/);assert.throws(()=>runtime.propose({kind:'search',path:'../escape',query:'x'}),/越界/);
 const direct=AGENT_TOOL_DEFS.find(t=>t.name==='propose_local_action').parameters.properties;
 const workflow=AGENT_TOOL_DEFS.find(t=>t.name==='plan_local_workflow').parameters.properties.steps.items.properties.request.properties;
 for(const schema of [direct,workflow]){assert.ok(schema.kind.enum.includes('list'));assert.ok(schema.kind.enum.includes('search'));assert.equal(schema.query.type,'string');}
});
