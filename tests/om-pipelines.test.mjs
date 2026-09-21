import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {OM_POLICY,OM_PIPELINES,omChildEnvironment} from '../packages/adapters/om-policy.mjs';
import {listOmTools,listOmSkills,getOmSkill,prepareOmPipeline,importOmMedia,executeTool,describeOmTool,probeOpenMontageRuntime} from '../packages/adapters/openmontage.mjs';
import {createToolRunner} from '../packages/agent/tools.mjs';
import {isAllowedAgentApi} from '../packages/agent/api.mjs';
import {buildMainAgentPrompt} from '../packages/agent/prompts/main-agent.mjs';

test('OM exposes curated pipelines/local tools only and rejects removed capabilities before execution',async()=>{
 assert.equal(OM_POLICY.independentAgent,false);assert.equal(OM_POLICY.gpuRental,false);
 assert(OM_PIPELINES.every(p=>p.tools.every(t=>OM_POLICY.allowedTools.includes(t))));
 const tools=listOmTools().tools.map(t=>t.name);
 assert(tools.includes('transcriber'));assert(tools.includes('piper_tts'));assert(tools.includes('video_compose'));
 for(const name of ['openai_image','minimax_video','video_selector','local_diffusion','runpod','llm_chat']){
  assert(!tools.includes(name));assert.equal((await executeTool('test',{tool:name})).status,403);
 }
 assert(!listOmSkills().skills.some(s=>s.id==='om:meta/onboarding'));
 assert.equal(getOmSkill('../../.env').ok,false);
 assert.equal(getOmSkill('om:creative/image-provider-usage').ok,false);
 assert.equal(getOmSkill('om:core/ffmpeg').ok,true);
 const env=omChildEnvironment({PATH:'local',TEMP:'tmp',OPENAI_API_KEY:'secret',OM_API_TOKEN:'secret',OPENMONTAGE_CODEX_EXECUTABLE:'codex',RUNPOD_KEY:'secret'});
 assert.deepEqual(env,{PATH:'local',TEMP:'tmp'});
});

test('pipeline project is stable, rejects changed intent, preserves originals, and schema is discoverable',async()=>{
 const old=process.env.OM_PROJECTS_ROOT;
 const root=path.resolve('outputs/om-pipeline-tests-'+Date.now());process.env.OM_PROJECTS_ROOT=root;
 try{
  const body={pipelineId:'edit-compose',requestId:'pipeline-test-request-001',instruction:'剪辑现有视频，不生成'};
  const prepared=prepareOmPipeline(body);assert(prepared.ok);assert.equal(prepared.status,'planned');assert.equal(prepareOmPipeline(body).projectId,prepared.projectId);
  assert.equal(prepareOmPipeline({...body,instruction:'different'}).status,409);
  assert.equal(prepareOmPipeline({...body,requestId:'../../outside'}).ok,false);
  const described=await describeOmTool('audio_probe');assert.equal(described.ok,true);assert(described.inputSchema.required.includes('input_path'));
  const imported=await importOmMedia({projectId:prepared.projectId,url:'data:image/png;base64,aGVsbG8='});assert(imported.ok);assert.equal(fs.readFileSync(imported.path,'utf8'),'hello');
  const repeated=await importOmMedia({projectId:prepared.projectId,url:'data:image/png;base64,aGVsbG8='});assert.equal(repeated.path,imported.path);
  assert.equal((await importOmMedia({projectId:prepared.projectId,url:'https://127.0.0.1/private'})).ok,false);
  assert.equal((await executeTool(prepared.projectId,{tool:'video_trimmer',args:{input_path:imported.path,output_path:imported.path}})).ok,false);
 }finally{if(old===undefined)delete process.env.OM_PROJECTS_ROOT;else process.env.OM_PROJECTS_ROOT=old;}
});

test('Agent chooses pipeline, queries configured API receipts, and hands completed material to OM',async()=>{
 const calls=[];
 const runner=createToolRunner({conversationId:'c',messageId:'m',callApi:async args=>{calls.push(args);return {ok:true,data:args.path.includes('generation-tasks')?{task:{id:'existing-task-00001',status:'completed',upstreams:[{url:'https://media.example.com/result.mp4'}]}}:{}};}});
 await runner('om_list_pipelines');await runner('om_get_pipeline',{pipelineId:'cinematic'});
 await runner('om_prepare_pipeline',{pipelineId:'cinematic',instruction:'生成一段视频后加字幕'});
 const queried=await runner('query_generation_task',{requestId:'existing-task-00001'});
 await runner('om_import_media',{projectId:'project',url:queried.data.task.upstreams[0].url});
 assert.equal(calls[2].body.pipelineId,'cinematic');assert.equal(calls[3].method,'GET');assert.equal(calls[4].path,'/api/om/media/import');
 assert(calls.every(c=>isAllowedAgentApi(c.method,c.path)));assert(isAllowedAgentApi('GET','/api/om/tools?capability=video_post'));
 assert(!calls.some(c=>c.path==='/api/generate'));
 const prompt=buildMainAgentPrompt().join('\n');assert(prompt.includes('生成回执通过 query_generation_task'));assert(prompt.includes('不能使用 OM 自带生成模型'));
});

test('real bundled Python helper refuses removed model tool without importing it',()=>{
 const result=spawnSync(path.resolve('vendor/openmontage/runtime/python/python.exe'),['vendor/openmontage/scripts/invoke-registry-tool.py'],{input:JSON.stringify({tool:'openai_image',inputs:{prompt:'must not run'}}),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'},windowsHide:true});
 assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout.trim()).ok,false);assert.match(result.stdout,/disabled/);
});

test('real local FFmpeg clip flows through selected OM pipeline with no model API',async()=>{
 const old=process.env.OM_PROJECTS_ROOT,root=path.resolve('outputs/om-e2e-'+Date.now());process.env.OM_PROJECTS_ROOT=root;
 try{
  const probe=probeOpenMontageRuntime();
  const plan=prepareOmPipeline({pipelineId:'edit-compose',requestId:'local-e2e-pipeline-001',instruction:'裁剪测试素材前半段'});
  const original=path.join(plan.projectPath,'test-source.mp4');
  const ff=spawnSync(probe.tools.ffmpeg.path,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x90:r=24','-t','2','-c:v','libx264','-pix_fmt','yuv420p',original],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(ff.status,0,ff.stderr);
  const sourceBytes=fs.readFileSync(original);
  const media=await importOmMedia({projectId:plan.projectId,url:'https://media.example.com/test.mp4'},{fetch:async()=>new Response(sourceBytes,{headers:{'content-type':'video/mp4'}})});assert(media.ok);
  const output=path.join(plan.projectPath,'trimmed.mp4');
  const result=await executeTool(plan.projectId,{tool:'video_trimmer',args:{operation:'cut',input_path:media.path,output_path:output,start_seconds:0,end_seconds:1}});
  assert.equal(result.ok,true,JSON.stringify(result));assert(fs.statSync(output).size>0);assert.deepEqual(fs.readFileSync(original),sourceBytes);
  const checked=await executeTool(plan.projectId,{tool:'audio_probe',args:{input_path:output}});assert(checked.ok,JSON.stringify(checked));
 }finally{if(old===undefined)delete process.env.OM_PROJECTS_ROOT;else process.env.OM_PROJECTS_ROOT=old;}
});
