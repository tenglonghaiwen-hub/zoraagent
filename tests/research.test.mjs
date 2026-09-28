import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createResearch} from '../packages/agent/research.mjs';
import {MAIN_AGENT_TOOL_DEFS} from '../packages/agent/media-subagents.mjs';
test('main Agent exposes all three research tools',()=>{
 for(const name of ['research_collect','research_record','research_status'])assert.ok(MAIN_AGENT_TOOL_DEFS.some(t=>t.name===name));
});
test('collected pages persist across turns; missing and fabricated evidence never verifies',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-research-'));
 const options={directory,conversationId:'one',browser:async()=>({ok:true,data:{page:{url:'https://example.com/source',title:'Source',text:'Actual published value is 100 USD.',links:[]}}})};
 let run=createResearch(options);
 const page=await run('research_collect',{url:'https://example.com/source'});
 assert.equal(page.source.status,'retrieved');
 await run('research_record',{entity:'Example',fields:[{name:'value',value:'100 USD',sourceId:page.source.id,quote:'Actual published value is 100 USD.'},{name:'date',value:'2025-01-01',sourceId:page.source.id,quote:'Invented date January 1'}]});
 run=createResearch(options);
 const status=await run('research_status',{requiredFields:['value','date','shareCount']});
 assert.deepEqual(status.records[0].missingFields,['date','shareCount']);assert.equal(status.records[0].status,'needs_review');assert.equal(status.canRender,false);
 assert.equal((await createResearch({...options,conversationId:'two'})('research_status',{})).records.length,0);
});
test('search summaries are not source evidence and collection failures remain actionable',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-research-fail-'));
 const run=createResearch({directory,conversationId:'one',browser:async args=>args.action==='search'?{ok:true,data:{page:{text:'A search result snippet',url:'https://example.com/search'}}}:{ok:false,data:{error:'网页导航超时'}}});
 const search=await run('research_collect',{query:'market cap'});
 const record=await run('research_record',{entity:'A',fields:[{name:'value',value:'1',sourceId:search.source.id,quote:'A search result snippet'}]});
 assert.equal(record.record.fields[0].evidenceStatus,'missing_evidence');
 const failed=await run('research_collect',{url:'https://example.com'});assert.equal(failed.ok,false);assert.match(failed.source.error,/超时/);
 assert.equal((await run('research_status',{})).sources.length,2);
});
