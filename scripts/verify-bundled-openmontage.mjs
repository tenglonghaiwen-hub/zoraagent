import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||'');assert.ok(process.argv[2],'传入打包暂存根目录');
const output=path.resolve('outputs/openmontage-smoke-'+Date.now());fs.mkdirSync(output,{recursive:true});
for(const key of Object.keys(process.env))if(/^(OM_|ZORA_|OPENMONTAGE_)/.test(key)||/API_KEY$/.test(key))delete process.env[key];
const {configurePackagedRuntime}=await import(pathToFileURL(path.join(root,'apps/desktop/main/packaged-runtime.mjs')));
const profile=process.argv[3]?path.resolve(process.argv[3]):path.join(output,'profile');
configurePackagedRuntime(root,profile);
const om=await import(pathToFileURL(path.join(root,'packages/adapters/openmontage.mjs')));
const probe=om.probeOpenMontageRuntime();assert.equal(probe.ready,true);
assert.ok(probe.engineRoot.startsWith(profile));
for(const name of ['node','python','ffmpeg','ffprobe','hyperframesCli','hyperframesBrowser','codex'])assert.ok(probe.tools[name].present,name);
const versions={hyperframes:execFileSync(probe.tools.node.path,[probe.tools.hyperframesCli.path,'--version'],{encoding:'utf8',windowsHide:true,timeout:30000}),browser:execFileSync(probe.tools.hyperframesBrowser.path,['--version'],{encoding:'utf8',windowsHide:true,timeout:30000})};
fs.writeFileSync(path.join(output,'render-runtimes.json'),JSON.stringify(versions,null,2));
const projectId='package-smoke-'+Date.now();const project=path.join(process.env.OM_PROJECTS_ROOT,projectId);
fs.mkdirSync(path.join(project,'assets/video'),{recursive:true});
fs.writeFileSync(path.join(project,'project.json'),JSON.stringify({project_id:projectId,title:'安装包本地合成测试',pipeline_type:'framework-smoke',created_at:new Date().toISOString()}));
const clips=[];
for(const color of ['red','blue']){
  const file=path.join(project,'assets/video',color+'.mp4');
  execFileSync(probe.tools.ffmpeg.path,['-v','error','-f','lavfi','-i',`color=c=${color}:s=320x180:r=25:d=0.6`,'-c:v','libx264','-pix_fmt','yuv420p',file],{windowsHide:true});
  clips.push({kind:'file',name:color+'.mp4',path:file,size_bytes:fs.statSync(file).size});
}
let started=false;
try{
  const start=await om.startSidecar();assert.equal(start.ok,true,JSON.stringify(start));started=true;
  const projects=await om.listProjects();assert.equal(projects.ok,true,JSON.stringify(projects));
  assert.ok(JSON.stringify(projects).includes(projectId));
  assert.ok(om.listOmTools({}).count>0);assert.ok(om.listOmSkills({}).count>0);
  assert.equal(om.getOmSkill('om:core/ffmpeg').ok,true);
  const compose=await om.executeTool(projectId,{tool:'video_compose',args:{operation:'compose',profile:'generic_hd',preset:'ultrafast'},attachments:clips,idempotencyKey:'package-local-compose'});
  fs.writeFileSync(path.join(output,'compose.json'),JSON.stringify(compose,null,2));
  assert.equal(compose.ok,true,JSON.stringify(compose));
  const payload=compose.data||compose;assert.equal(payload.success,true,JSON.stringify(compose));
  const artifact=payload.artifacts.find(p=>p.endsWith('.mp4'));assert.ok(artifact);
  const rendered=path.join(project,artifact);
  const meta=JSON.parse(execFileSync(probe.tools.ffprobe.path,['-v','error','-show_entries','format=duration','-of','json',rendered],{encoding:'utf8',windowsHide:true}));assert.ok(Number(meta.format.duration)>=1);
  const trimmed=path.join(project,'renders/trimmed.mp4');
  const trim=await om.executeTool(projectId,{tool:'video_trimmer',args:{operation:'cut',input_path:rendered,output_path:trimmed,start_seconds:0,end_seconds:0.6}});
  fs.writeFileSync(path.join(output,'registry.json'),JSON.stringify(trim,null,2));assert.equal(trim.ok,true,JSON.stringify(trim));assert.ok(fs.statSync(trimmed).size>0);
  const result={ok:true,root,output,rendered,duration:Number(meta.format.duration),checks:['runtime paths','sidecar health','project listing','tool and skill catalogs','FFmpeg compose through studio API','registry tool invocation'],pid:start.pid};
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(started)await om.stopSidecar();}
