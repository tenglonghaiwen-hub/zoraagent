import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const run=promisify(execFile);
function binary(name){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const dirs=[path.join(root,'runtime','ffmpeg','bin'),path.join(root,'vendor','openmontage','runtime','ffmpeg','bin'),'D:/ffmpeg/bin',...(process.env.PATH||'').split(path.delimiter)];
 for(const dir of dirs){for(const suffix of process.platform==='win32'?['.exe']:['']){const file=path.join(dir,name+suffix);try{if(fs.statSync(file).isFile())return file;}catch{}}}
 throw Error('视频抽帧未就绪：未找到本机 '+name+'，没有调用视频分析');
}
function decode(reference){
 const value=reference.contentUrl;
 if(typeof value!=='string')throw Error('视频素材未读取');
 const hit=/^data:video\/(mp4|quicktime|webm|x-msvideo);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
 if(!hit||!hit[2]||hit[2].length%4!==0)throw Error('视频分析仅接受已上传的 MP4/MOV/WebM/AVI 原始文件，不下载网络链接或播放列表');
 const bytes=Buffer.from(hit[2],'base64');if(bytes.length<12)throw Error('视频素材大小或内容无效');
 const mp4=bytes.toString('ascii',4,8)==='ftyp',webm=bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])),avi=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='AVI ';
 if(!((['mp4','quicktime'].includes(hit[1])&&mp4)||(hit[1]==='webm'&&webm)||(hit[1]==='x-msvideo'&&avi)))throw Error('视频文件签名与声明格式不符，拒绝播放列表或伪装文件');
 return {bytes,extension:mp4?'mp4':webm?'webm':'avi'};
}

/** Sample the entire bounded duration at 2 fps and pack chronological timestamped frames into visual slots. */
export async function analyzeVideoReferences(references,{maxFrames=6}={}){
 if(!Array.isArray(references))throw Error('视频参考列表无效');
 const videos=references.filter(r=>String(r?.type||'').startsWith('video/'));
 if(!videos.length)return {images:[],audioFiles:[],summary:''};
 if(!Number.isInteger(maxFrames)||maxFrames<1||maxFrames>6||videos.length>maxFrames)throw Error('视频数量超过可用抽帧预算；每段视频至少需要 1 个视觉槽位');
 const decoded=videos.map(decode),ffprobe=binary('ffprobe'),ffmpeg=binary('ffmpeg');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zora-video-frames-'));
 const images=[],audioFiles=[],descriptions=[],prepared=[],sampling=[];
 for(let i=0;i<videos.length;i++){
  const video=videos[i],source=path.join(directory,`video-${i}.${decoded[i].extension}`);fs.writeFileSync(source,decoded[i].bytes);
  let metadata;
  try{const result=await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi','-show_entries','format=duration:stream=codec_type,duration','-of','json',source],{timeout:15000,maxBuffer:1024*1024,windowsHide:true});metadata=JSON.parse(result.stdout);}
  catch(e){throw Error(`视频 ${i+1} 元数据读取失败：${String(e.message||e).slice(0,500)}`);}
  const stream=metadata.streams?.find(s=>s.codec_type==='video'),duration=Number(stream?.duration||metadata.format?.duration);
  if(!stream||!Number.isFinite(duration)||duration<=0)throw Error(`视频 ${i+1} 没有可读取的视频流或有效时长`);
  const containerDuration=Number(metadata.format?.duration||duration);
  if(duration>120||containerDuration>120)throw Error('视频或音频时长超过 120 秒分析上限，请先分段；未截断分析');
  prepared.push({source,duration,metadata,frameCount:Math.ceil(duration*2)});
 }
 if(prepared.reduce((sum,p)=>sum+p.duration,0)>120||prepared.reduce((sum,p)=>sum+p.frameCount,0)>240)throw Error('参考视频总计超过 120 秒或 240 帧分析上限，请先分段；未截断分析');
 const font=process.platform==='win32'&&fs.existsSync('C:/Windows/Fonts/arial.ttf')?"fontfile='C\\:/Windows/Fonts/arial.ttf':":'';
 const inputArgs=['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi'];
 for(let i=0;i<prepared.length;i++){
  const {source,duration,metadata,frameCount}=prepared[i],video=videos[i],prefix=`video-${i}-sample-`,pattern=path.join(directory,prefix+'%03d.png');
  const filter=`fps=fps=2:start_time=0:round=up,scale=256:144:force_original_aspect_ratio=decrease,pad=256:168:(ow-iw)/2:0:black,drawtext=${font}text='%{pts\\:hms}':fontcolor=white:fontsize=16:x=4:y=148`;
  try{await run(ffmpeg,[...inputArgs,'-i',source,'-map','0:v:0','-an','-sn','-dn','-vf',filter,'-frames:v',String(frameCount+1),'-threads','1','-y',pattern],{timeout:45000,maxBuffer:256*1024,windowsHide:true});}
  catch(e){throw Error(`视频 ${i+1} 时序抽帧失败：${String(e.message||e).slice(0,500)}`);}
  const frames=fs.readdirSync(directory).filter(name=>name.startsWith(prefix)&&name.endsWith('.png')).sort();
  if(frames.length!==frameCount)throw Error(`视频 ${i+1} 实际采样 ${frames.length} 帧与时长预计 ${frameCount} 帧不符，未声称覆盖完整时长`);
  const slots=Math.min(3,frames.length,Math.floor(maxFrames/videos.length)+(i<maxFrames%videos.length?1:0));
  const sheets=[];let offset=0;
  for(let j=0;j<slots;j++){
   const count=Math.floor(frames.length/slots)+(j<frames.length%slots?1:0),columns=Math.min(8,Math.ceil(Math.sqrt(count))),rows=Math.ceil(count/columns),target=path.join(directory,`video-${i}-sheet-${j}.jpg`);
   try{await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-start_number',String(offset+1),'-i',pattern,'-vf',`tile=${columns}x${rows}:nb_frames=${count}:padding=2:margin=2`,'-frames:v','1','-q:v','3','-threads','1','-y',target],{timeout:20000,maxBuffer:256*1024,windowsHide:true});}
   catch(e){throw Error(`视频 ${i+1} 时序拼图失败：${String(e.message||e).slice(0,500)}`);}
   const stat=fs.statSync(target);if(stat.size<4||stat.size>4*1024*1024)throw Error('时序拼图为空或超过 4 MiB 限制');
   const start=offset/2,end=(offset+count-1)/2;
   images.push({name:`${video.name||'视频'+(i+1)} · ${start.toFixed(2)}–${end.toFixed(2)}秒 · ${count}帧（从左到右、从上到下）`,url:'data:image/jpeg;base64,'+fs.readFileSync(target).toString('base64')});
   sheets.push({start,end,frameCount:count});offset+=count;
  }
  const hasAudio=metadata.streams?.some(s=>s.codec_type==='audio');
  if(hasAudio){
   const audioPath=path.join(directory,`video-${i}-audio.wav`);
   try{await run(ffmpeg,[...inputArgs,'-i',source,'-map','0:a:0','-vn','-sn','-dn','-ac','1','-ar','16000','-c:a','pcm_s16le','-threads','1','-y',audioPath],{timeout:30000,maxBuffer:256*1024,windowsHide:true});}
   catch(e){throw Error(`视频 ${i+1} 音频提取失败：${String(e.message||e).slice(0,500)}`);}
   const size=fs.statSync(audioPath).size;if(size<44||size>120*16000*2+8192)throw Error('提取音频为空或超过 120 秒限制');
   audioFiles.push({path:audioPath,name:(video.name||'视频'+(i+1))+'.wav',duration:Number(metadata.format?.duration||duration)});
  }
  sampling.push({name:video.name||'视频'+(i+1),duration,frameCount:frames.length,intervalSeconds:0.5,sheets});
  descriptions.push(`视频 ${i+1}（${String(video.name||'未命名').slice(0,200)}）：时长 ${duration.toFixed(2)} 秒，从 0 秒到 ${((frames.length-1)/2).toFixed(2)} 秒每 0.5 秒采样（每秒 2 帧），共 ${frames.length} 帧，按时间顺序排入 ${slots} 张拼图，覆盖整个时长的采样区间；${hasAudio?'已提取 16kHz 单声道 WAV，音频未转写':'未检测到音频流'}。`);
 }
 return {images,audioFiles,sampling,summary:descriptions.join('\n')+'\n这是全时段定间隔采样，不是原视频逐帧分析；不能据此声称完整理解全部动作、镜头变化或听取音频。',temporaryDirectory:directory};
}
