// Provider-specific contracts: https://qiangge888.com/apidoc#model/seedance-2.0-guanfang
const modes=['t2v','i2v','fl','ref'].map(id=>({id,enabled:true}));
const shared={kind:'video',ratios:['adaptive','16:9','4:3','1:1','3:4','9:16','21:9'],resolutions:['480p','720p','1080p','4k'],durations:[-1,...Array.from({length:12},(_,i)=>i+4)],maxCount:1,modes};
export const LK_SEEDANCE_UPSTREAM_MODEL='doubao-seedance-2-0-260128';
export const LK_SEEDANCE_MEDIA={...shared,family:'lk-seedance-media',id:'lk-seedance-2.0-media',route:'/v1/media/generate',queryRoute:'/v1/media/status?task_id={task_id}'};
export const LK_SEEDANCE_ARK={...shared,family:'lk-seedance-ark',id:'lk-seedance-2.0-ark',route:'/api/v3/contents/generations/tasks',queryRoute:'/api/v3/contents/generations/tasks/{task_id}'};
const fail=message=>Object.assign(Error(message),{status:400});
function publicUrl(value){
 if(typeof value!=='string')return false;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?|\[?fc|\[?fd)/i.test(url.hostname)&&!/^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);}catch{return false;}
}
function collectReferences(input,{ark}){
 const refs=input.references||[];
 if(!Array.isArray(refs))throw fail('参考素材格式无效');
 const images=[],videos=[],audios=[];let inlineBytes=0;
 for(const ref of refs){
  const kind=ref?.type?.split('/')[0],url=ref?.contentUrl;
  if(!['image','video','audio'].includes(kind)||typeof url!=='string')throw fail('Seedance 参考素材类型或地址无效');
  if(!publicUrl(url)){
   if(ark||kind==='video')throw fail(ark?'火山方舟格式的参考素材需要公网 URL；请先上传素材取得公网地址':'Seedance 参考视频需要公网 URL');
   const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
   if(!match||!match[1].startsWith(kind+'/')||match[2].length%4!==0)throw fail('Seedance 图片或音频需要公网 URL 或有效 base64');
   const bytes=match[2].length*3/4-(match[2].match(/=+$/)?.[0].length||0);
   if(bytes>10*1024*1024)throw fail('单个内嵌素材不能超过 10MB');inlineBytes+=bytes;
  }
  ({image:images,video:videos,audio:audios})[kind].push(url);
 }
 if(inlineBytes>30*1024*1024)throw fail('内嵌素材合计不能超过 30MB');
 if(images.length>9||videos.length>3||audios.length>3)throw fail('Seedance 最多9张参考图、3段视频和3段音频');
 if(audios.length&&!images.length&&!videos.length)throw fail('Seedance 2.0 的音频参考需要搭配图片或视频');
 const mode=input.videoMode||(refs.length?'ref':'t2v');
 if(!modes.some(item=>item.id===mode))throw fail('Seedance 生成模式无效');
 if(mode==='t2v'&&refs.length||mode==='ref'&&!refs.length)throw fail('生成模式与参考素材不一致');
 if(['i2v','fl'].includes(mode)&&(images.length!==(mode==='i2v'?1:2)||videos.length||audios.length))throw fail('首帧需要1张图，首尾帧需要2张图，不能混入视频或音频');
 return {mode,images,videos,audios};
}
export function packLkSeedance(input,model){
 const ark=model.family==='lk-seedance-ark';
 const template=ark?LK_SEEDANCE_ARK:LK_SEEDANCE_MEDIA;
 if(model.id!==template.id||model.family!==template.family)throw fail('Seedance 模型与协议模板不匹配');
 if(typeof input.prompt!=='string'||!input.prompt.trim())throw fail('请填写 Seedance 提示词');
 if((input.count??1)!==1)throw fail('Seedance 单次只生成一个视频');
 for(const [key,list] of [['duration','durations'],['resolution','resolutions'],['ratio','ratios']])if(!template[list].includes(input[key]))throw fail('Seedance 参数无效：'+key);
 const {mode,images,videos,audios}=collectReferences(input,{ark});
 let body;
 if(ark){
  const content=[
   {type:'text',text:input.prompt},
   ...Object.entries({image:images,video:videos,audio:audios}).flatMap(([kind,urls])=>urls.map((url,index)=>{
    const type=kind+'_url';
    const role=kind==='image'?(mode==='i2v'?'first_frame':mode==='fl'?(index?'last_frame':'first_frame'):'reference_image'):kind==='video'?'reference_video':'reference_audio';
    return {type,role,[type]:{url}};
   }))
  ];
  body={model:LK_SEEDANCE_UPSTREAM_MODEL,content,resolution:input.resolution,ratio:input.ratio,duration:input.duration};
 }else{
  const params={mode:mode==='ref'?'cankaosheng':'shouweizhen',version:'标准',duration:input.duration===-1?'auto':String(input.duration),aspect_ratio:input.ratio,resolution:input.resolution==='4k'?'4K':input.resolution};
  if(images.length)params[mode==='ref'?'image_url':'images']=images;
  if(videos.length)params.video_url=videos;
  if(audios.length)params.audio_url=audios;
  body={model:LK_SEEDANCE_UPSTREAM_MODEL,prompt:input.prompt,params};
 }
 if(new TextEncoder().encode(JSON.stringify(body)).length>50*1024*1024)throw fail('Seedance 请求体不能超过 50MB');
 return {operation:'generate',method:'POST',path:template.route,queryRoute:template.queryRoute,contentType:'json',body};
}
export function lkSeedanceTaskId(data,{ark}){
 if(!ark&&data?.code!==undefined&&data.code!==200)throw Object.assign(Error(String(data.msg||'Seedance 媒体任务创建失败')),{status:Number(data.code)>=400&&Number(data.code)<500?Number(data.code):502});
 const id=ark?data?.id:(data?.data?.task_id??data?.task_id);
 if((typeof id==='string'&&/^\d+$/.test(id)||Number.isSafeInteger(id)&&id>0))return String(id);
 throw Object.assign(Error('上游未返回可识别的 Seedance 任务 ID，提交结果待核对'),{status:502});
}
export function normalizeLkSeedanceResult(data,taskId,{ark}){
 const id=ark?data?.id:data?.task_id;
 if(String(id)!==String(taskId))throw fail('查询返回了其他 Seedance 任务');
 if(ark){
  if(['queued','running'].includes(data.status))return {status:'processing'};
  if(['failed','cancelled','expired'].includes(data.status))return {status:'failed',error:data.error?.message||String(data.error||`视频任务已${data.status==='cancelled'?'取消':data.status==='expired'?'过期':'失败'}`)};
  if(data.status!=='succeeded'||!publicUrl(data.content?.video_url))throw fail('Seedance 任务终态缺少有效视频地址');
  return {status:'completed',url:data.content.video_url,usageTokens:Number(data.usage?.completion_tokens)||0};
 }
 if(typeof data.is_final!=='boolean'||!['pending','running','success','failed'].includes(data.state))throw fail('Seedance 媒体协议返回了无效任务状态');
 if(!data.is_final)return {status:'processing'};
 if(data.state==='failed')return {status:'failed',error:typeof data.error==='string'&&data.error||data.error?.message||'视频生成失败'};
 if(data.state!=='success'||!publicUrl(data.result_url))throw fail('Seedance 任务终态缺少有效视频地址');
 return {status:'completed',url:data.result_url};
}
