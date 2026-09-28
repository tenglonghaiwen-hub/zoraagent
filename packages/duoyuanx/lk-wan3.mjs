// https://qiangge888.com/apidoc#model/wan3.0
export const LK_WAN3={
 kind:'video',family:'lk-wan3',route:'/v1/media/generate',queryRoute:'/v1/media/status?task_id={task_id}',
 ratios:['adaptive','16:9','9:16','1:1','4:3','3:4'],
 resolutions:['480P','720P','1080P'],
 durations:[-1,...Array.from({length:29},(_,i)=>i+2)],
 maxCount:1,modes:['t2v','i2v','fl','ref'].map(id=>({id,enabled:true}))
};
const invalid=message=>Object.assign(Error(message),{status:400});
const docTypes=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
const httpUrl=value=>typeof value==='string'&&/^https?:\/\/[^\s]+$/.test(value);
export function packLkWan3(input,model){
 if(model.id!=='wan3.0')throw invalid('万相 3.0 模型 ID 必须为 wan3.0');
 if(typeof input.prompt!=='string'||!input.prompt.trim())throw invalid('请填写万相 3.0 提示词');
 if((input.count??1)!==1)throw invalid('万相 3.0 单次只生成一个视频');
 for(const [key,list] of [['duration','durations'],['resolution','resolutions'],['ratio','ratios']])if(!LK_WAN3[list].includes(input[key]))throw invalid('万相 3.0 参数无效：'+key);
 const refs=input.references||[];
 if(!Array.isArray(refs))throw invalid('参考素材格式无效');
 const images=[],videos=[],audios=[],documents=[];let inlineBytes=0;
 for(const ref of refs){
  const kind=ref?.type?.split('/')[0],url=ref?.contentUrl;
  if(typeof url!=='string')throw invalid('参考素材缺少地址');
  if(docTypes.has(ref.type)){
   if(!httpUrl(url))throw invalid('万相参考文档需要公网直链 URL');
   documents.push(url);continue;
  }
  if(!['image','video','audio'].includes(kind))throw invalid('万相参考素材类型不支持');
  if(!httpUrl(url)){
   const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
   if(kind==='video')throw invalid('万相参考视频需要公网直链 URL');
   if(!match||!match[1].startsWith(kind+'/')||match[2].length%4!==0)throw invalid('万相图片或音频需要公网 URL 或有效 base64');
   const bytes=match[2].length*3/4-(match[2].match(/=+$/)?.[0].length||0);
   if(bytes>10*1024*1024)throw invalid('单个内嵌素材不能超过 10MB');inlineBytes+=bytes;
  }
  ({image:images,video:videos,audio:audios})[kind].push(url);
 }
 if(inlineBytes>30*1024*1024)throw invalid('内嵌素材合计不能超过 30MB');
 const fileUrl=input.fileUrl||documents[0],linkUrl=input.linkUrl;
 if(documents.length>1||fileUrl&&(!httpUrl(fileUrl)||documents.length&&fileUrl!==documents[0]))throw invalid('万相最多接受一份公网参考文档');
 if(linkUrl!==undefined&&!httpUrl(linkUrl))throw invalid('万相网页链接必须是公网 http/https URL');
 if(fileUrl&&linkUrl)throw invalid('参考文档和网页链接只能选一项');
 if(images.length>10||videos.length>5||audios.length>5)throw invalid('万相最多10张参考图、5段视频和5段音频');
 const hasRef=refs.length>0||!!linkUrl||!!fileUrl;
 const mode=input.videoMode||(hasRef?'ref':'t2v');
 if(!LK_WAN3.modes.some(m=>m.id===mode))throw invalid('万相生成模式无效');
 if(mode==='t2v'&&hasRef||mode==='ref'&&!hasRef)throw invalid('生成模式与素材不一致');
 if(['i2v','fl'].includes(mode)&&(images.length!==(mode==='i2v'?1:2)||videos.length||audios.length||fileUrl||linkUrl))throw invalid('首帧需要1张图，首尾帧需要2张图，不能混入其他素材');
 const version=model.capability?.wanVersion||'standard';
 if(!['standard','prime'].includes(version))throw invalid('万相版本配置无效');
 const params={mode:mode==='ref'?'cankaosheng':'shouweizhen',version,resolution:input.resolution,duration:input.duration===-1?'auto':String(input.duration),ratio:input.ratio};
 if(images.length)params[mode==='ref'?'image_url':'images']=images;
 if(videos.length)params.video_url=videos;
 if(audios.length)params.audio_url=audios;
 if(fileUrl)params.file_url=fileUrl;
 if(linkUrl)params.link_url=linkUrl;
 for(const [key,configKey] of [['audio','wanAudio'],['prompt_extend','wanPromptExtend']])if(model.capability?.[configKey]!==undefined)params[key]=model.capability[configKey];
 const body={model:model.id,prompt:input.prompt,params};
 if(new TextEncoder().encode(JSON.stringify(body)).length>50*1024*1024)throw invalid('万相请求体不能超过 50MB');
 return {operation:'generate',method:'POST',path:LK_WAN3.route,queryRoute:LK_WAN3.queryRoute,contentType:'json',body};
}
