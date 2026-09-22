import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolRunner} from '../packages/agent/tools.mjs';
import {planImageSuite} from '../packages/agent/image-suite.mjs';
import {attachGenerationReceipts} from '../apps/client/agent-generation-tasks.js';
import {refreshImageSuite} from '../apps/client/image-suite.js';
import {imageSuitePageStatus} from '../apps/client/image-suite.js';
import fs from 'node:fs';
import vm from 'node:vm';

const args={modelId:'gpt-image-2',title:'服装详情四页',sharedStyle:'白背景，柔和左侧光，深蓝服装不变，标题居上，统一留白',ratio:'9:16',resolution:'2K',
 items:[{title:'首页',prompt:'正面全身服装主图'},{title:'领口',prompt:'领口蕾丝特写'},{title:'版型',prompt:'腰线与裙摆轮廓'},{title:'面料',prompt:'面料纹理特写'}]};
const ref={name:'original',type:'image/png',contentUrl:'data:image/png;base64,aGVsbG8='};
test('suite validation is free and each prompt includes only its own content and common style',async()=>{
 let called=0;const run=createToolRunner({references:[ref],callApi:async()=>{called++;}});
 const plan=await run('preview_image_suite',args);
 assert(plan.ok);assert.equal(called,0);assert.equal(plan.drafts.length,4);
 for(let i=0;i<4;i++){
  assert.equal(plan.drafts[i].count,1);assert.match(plan.drafts[i].prompt,/只生成当前页面/);
  assert(plan.drafts[i].prompt.includes(args.sharedStyle));assert(!('references' in plan.drafts[i]));
  for(let j=0;j<4;j++)assert.equal(plan.drafts[i].prompt.includes(args.items[j].prompt),i===j);
 }
 assert.equal(planImageSuite({...args,items:[args.items[0],args.items[0]]}).ok,false);
});
async function submitSuite(failAt=-1){
 const calls=[],receipts=[];
 const run=createToolRunner({references:[ref],generationTasks:receipts,callApi:async call=>{
  calls.push(call);if(calls.length===failAt)return {ok:false,status:400,error:'参数被拒绝'};
  return {ok:true,data:{task:{id:call.body.requestId,status:'running',revision:1,upstreams:[]}}};
 }});
 const result=await run('submit_image_suite',args);
 await run('submit_image_suite',args);
 return {calls,receipts,result};
}
test('suite submits four independent single images with original reference; repeat call does not duplicate',async()=>{
 const {calls,receipts}=await submitSuite();assert.equal(calls.length,4);assert.equal(receipts.length,4);
 assert.equal(new Set(receipts.map(r=>r.suite.id)).size,1);
 for(let i=0;i<4;i++){assert.equal(calls[i].body.count,1);assert.deepEqual(calls[i].body.references,[ref]);assert.equal(receipts[i].suite.index,i);}
});
test('all drafts validated before any paid submission',async()=>{
 let calls=0;const run=createToolRunner({callApi:async()=>calls++});
 assert.equal((await run('submit_image_suite',{...args,ratio:'99:1'})).ok,false);assert.equal(calls,0);
});
test('partial submission stops and retains rejected page without automatic refill',async()=>{
 const {calls,receipts}=await submitSuite(2);assert.equal(calls.length,2);assert.equal(receipts.length,2);
 assert.equal(receipts[1].task.status,'failed');assert(receipts[1].task.localRejection);
});
test('client groups suite and preserves page order across completion, old receipts and reload',async()=>{
 const {receipts}=await submitSuite();const source={id:'source'},messages=[source];
 attachGenerationReceipts(messages,source,receipts);
 assert.equal(messages.length,2);assert.equal(messages[1].count,4);
 const saved=JSON.parse(JSON.stringify(messages));const message=saved[1];
 const ids=receipts.map(r=>r.task.id);
 await refreshImageSuite(message,async url=>({ok:true,json:async()=>({task:{id:url.split('/').at(-1),revision:2,status:url.endsWith(ids[0])?'running':'completed',upstreams:url.endsWith(ids[0])?[]:[{url:'https://example.test/'+url.split('/').at(-1)+'.png'}]}})}));
 assert.equal(message.genUrls[0],null);assert(message.genUrls[1].includes(ids[1]));assert.equal(message.genStatus,'生成中');
 attachGenerationReceipts(saved,saved[0],receipts);assert.equal(saved.length,2);assert(message.genUrls[1].includes(ids[1]));
 await refreshImageSuite(message,async url=>({ok:true,json:async()=>({task:{id:url.split('/').at(-1),revision:3,status:'completed',upstreams:[{url:'https://example.test/'+url.split('/').at(-1)+'.png'}]}})}));
 assert.equal(message.genStatus,'已完成');assert.equal(message.genUrls.length,4);
});
test('missing result and failed queries never duplicate first image or trigger a POST',async()=>{
 const {receipts}=await submitSuite(2);const source={id:'source'},messages=[source];attachGenerationReceipts(messages,source,receipts);
 const m=messages[1];await refreshImageSuite(m,async(url,options)=>{assert(!options.method);throw Error('offline');});
 assert(m.genUnknown);assert.equal(m.genUrls[2],null);assert.equal(m.genUrl,null);assert.match(m.genError,/未提交/);
});

test('actual media renderer shows one suite with four frames, fixed empty slot and shared download actions',async()=>{
 const {receipts}=await submitSuite();const source={id:'source'},messages=[source];
 attachGenerationReceipts(messages,source,receipts);const message=messages[1];
 message.genUrls=[null,'https://example.test/2.png','https://example.test/3.png','https://example.test/4.png'];
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes);}setAttribute(){}addEventListener(){}
 }
 const target=new Element('main'),downloaded=[];
 const context=vm.createContext({document:{createElement:tag=>new Element(tag)},conversationLog:target,
  chatNode:(tag,cls,text)=>Object.assign(new Element(tag),{className:cls,textContent:text}),
  imageSuitePageStatus,downloadGenerated:async url=>downloaded.push(url)});
 const app=fs.readFileSync(new URL('../apps/client/app.js',import.meta.url),'utf8');
 vm.runInContext(app.slice(app.indexOf('function renderMediaTask('),app.indexOf('const agentOption=')),context);
 context.renderMediaTask(message,target);
 const walk=node=>[node,...node.children.flatMap(walk)],nodes=walk(target);
 assert.equal(nodes.filter(n=>n.className==='media-task-entry').length,1);
 assert.equal(nodes.filter(n=>n.className==='media-task-frame').length,4);
 assert.equal(nodes.filter(n=>n.className==='media-task-result').length,3);
 assert.equal(nodes.filter(n=>n.className==='media-task-placeholder').length,1);
 assert.equal(nodes.filter(n=>n.textContent==='刷新生成结果').length,1);
 assert(nodes.some(n=>n.textContent==='重新规划整套'));
 await nodes.find(n=>n.textContent==='下载').onclick();
 assert.deepEqual(downloaded,message.genUrls.filter(Boolean));
});
