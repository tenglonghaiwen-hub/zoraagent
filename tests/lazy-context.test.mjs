import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatService} from '../apps/server/chat-service.mjs';
import {MAIN_AGENT_TOOL_DEFS} from '../packages/agent/media-subagents.mjs';
import {LIGHT_AGENT_TOOLS,createLazyToolRunner} from '../packages/agent/lazy-context.mjs';
import {buildMainAgentPrompt} from '../packages/agent/prompts/main-agent.mjs';
process.env.ZORA_AGENT_API_KEY='unit-test-dummy';process.env.ZORA_AGENT_ENABLED='true';
test('reply ok uses small context and three tools, no catalog or local probe',async()=>{
 let captured,calls=0;const chat=createChatService({callApi:async()=>{calls++;throw Error('unexpected');},run:async(prompt,options)=>{captured={prompt,options};return {reply:'ok',tasks:[]};}});
 assert.equal((await chat({message:'回复ok'})).reply,'ok');assert.equal(calls,0);
 assert.equal(captured.options.tools.length,3);assert.doesNotMatch(captured.prompt,/models|本轮本地状态|Piper|spawnSync/);
 assert.doesNotMatch(captured.prompt,/你是造境/);assert.match(captured.options.contextInstructions,/你是造境/);
 const before=buildMainAgentPrompt().join('\n').length+JSON.stringify(MAIN_AGENT_TOOL_DEFS).length;
 const after=captured.prompt.length+captured.options.contextInstructions.length+JSON.stringify(LIGHT_AGENT_TOOLS).length;
 assert.ok(after<before*.2,`${after}/${before}`);console.log(JSON.stringify({baselineInstructionAndToolChars:before,newInstructionToolAndInputChars:after}));
});
test('all main tools remain discoverable; undeclared and forbidden tools cannot execute',async()=>{
 let calls=0,local=0;const runner=createLazyToolRunner(async(name,args)=>{calls++;return {name,args};},{loadLocalContext:async()=>{local++;return 'fresh own state';}});
 assert.equal((await runner('invoke_agent_tool',{name:'propose_local_action',argumentsJson:'{}'})).ok,false);
 const found=new Set(['delegate_media_task']);
 for(const group of ['local','browser','research','desktop','om','media','skills']){const result=await runner('discover_agent_tools',{group});assert.equal(result.ok,true);for(const tool of result.tools)found.add(tool.name);if(group==='local')assert.equal(result.context,'fresh own state');}
 assert.equal(local,1);assert.deepEqual(MAIN_AGENT_TOOL_DEFS.map(t=>t.name).filter(n=>!found.has(n)),[]);
 assert.equal((await runner('invoke_agent_tool',{name:'call_api',argumentsJson:'{}'})).ok,false);
 assert.equal((await runner('invoke_agent_tool',{name:'local_runtime_status',argumentsJson:'[]'})).ok,false);
 assert.deepEqual(await runner('invoke_agent_tool',{name:'local_runtime_status',argumentsJson:'{}'}),{name:'local_runtime_status',args:{}});assert.equal(calls,1);
 const nextTurn=createLazyToolRunner(async()=>{throw Error();});assert.equal((await nextTurn('invoke_agent_tool',{name:'local_runtime_status',argumentsJson:'{}'})).ok,false);
});
test('media-only requests cannot discover or invoke a window-opening browser tool',async()=>{
 let opened=0;
 const runner=createLazyToolRunner(async()=>{opened++;return {ok:true};},{allowExternalBrowser:false});
 assert.equal((await runner('discover_agent_tools',{group:'browser'})).ok,false);
 assert.equal((await runner('discover_agent_tools',{group:'research'})).ok,false);
 assert.equal((await runner('invoke_agent_tool',{name:'browser_open',argumentsJson:'{"url":"https://example.com"}'})).ok,false);
 assert.equal((await runner('invoke_agent_tool',{name:'research_collect',argumentsJson:'{"query":"example"}'})).ok,false);
 assert.equal(opened,0);
 const allowed=createLazyToolRunner(async(name)=>({ok:true,name}),{allowExternalBrowser:true});
 assert.equal((await allowed('discover_agent_tools',{group:'browser'})).ok,true);
});
