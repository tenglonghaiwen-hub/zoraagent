// qiangge888.com/apidoc#model/minimax-h3: LK media API, not Duoyuanx.
export const LK_H3={kind:'video',family:'lk-minimax-h3',route:'/v1/media/generate',queryRoute:'/v1/media/status?task_id={task_id}',ratios:['adaptive','16:9','9:16','1:1','4:3','3:4','21:9'],resolutions:['768P','1080P','2K','4K'],durations:Array.from({length:12},(_,i)=>i+4),maxCount:1,modes:['t2v','i2v','fl','ref'].map(id=>({id,enabled:true}))};
const fail=message=>Object.assign(Error(message),{status:400});
export function packLkH3(input,model){
 if(model.id!=='minimax-h3')throw fail('LK H3 模型 ID 必须为 minimax-h3');
 if(typeof input.prompt!=='string'||!input.prompt.trim())throw fail('请填写 H3 提示词');
 if((input.count??1)!==1)throw fail('H3 单次只生成一个视频');
 for(const [key,list] of [['duration','durations'],['resolution','resolutions'],['ratio','ratios']])if(!LK_H3[list].includes(input[key]))throw fail('H3 参数无效：'+key);
 const refs=input.references||[];
 if(!Array.isArray(refs))throw fail('参考素材格式无效');
 const mode=input.videoMode||(refs.length?'ref':'t2v');
 if(!LK_H3.modes.some(m=>m.id===mode))throw fail('H3 生成模式无效');
 const images=[],videos=[],audios=[];let total=0;
 for(const ref of refs){
  const kind=ref?.type?.split('/')[0],url=ref?.contentUrl;
  if(!['image','video','audio'].includes(kind)||typeof url!=='string')throw fail('H3 参考素材格式无效');
  if(!/^https?:\/\//.test(url)){
   const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
   if(kind==='video')throw fail('H3 参考视频需要公网直链，不支持本地视频内嵌');
   if(!match||!match[1].startsWith(kind+'/')||match[2].length%4!==0)throw fail('H3 参考素材需要公网 URL 或有效 base64');
   const bytes=match[2].length*3/4-(match[2].match(/=+$/)?.[0].length||0);
   if(bytes>10*1024*1024)throw fail('单个内嵌素材不能超过 10MB');total+=bytes;
  }
  ({image:images,video:videos,audio:audios})[kind].push(url);
 }
 if(total>30*1024*1024)throw fail('内嵌素材合计不能超过 30MB');
 if(images.length>9||videos.length>3||audios.length>3)throw fail('H3 最多9张参考图、3个视频和3段音频');
 if(mode==='t2v'&&refs.length||mode==='ref'&&!refs.length)throw fail('生成模式与素材不一致');
 if(['i2v','fl'].includes(mode)&&(images.length!==(mode==='i2v'?1:2)||videos.length||audios.length))throw fail('首帧需要1张图，首尾帧需要2张图，不能混入视频或音频');
 const params={mode:mode==='ref'?'cankaosheng':'shouweizhen',duration:String(input.duration),resolution:input.resolution,aspect_ratio:input.ratio};
 if(images.length)params[mode==='ref'?'image_url':'images']=images;
 if(videos.length)params.video_url=videos;
 if(audios.length)params.audio_url=audios;
 const body={model:model.id,prompt:input.prompt,params};
 if(new TextEncoder().encode(JSON.stringify(body)).length>50*1024*1024)throw fail('H3 请求体不能超过 50MB');
 return {operation:'generate',method:'POST',path:LK_H3.route,queryRoute:LK_H3.queryRoute,contentType:'json',body};
}
export function normalizeLkH3Result(data,taskId){
 if(String(data.task_id)!==String(taskId))throw fail('查询返回了其他任务');
 if(typeof data.is_final!=='boolean'||!['pending','running','success','failed'].includes(data.state))throw fail('H3 返回了无效任务状态');
 if(!data.is_final)return {status:'processing'};
 if(data.state==='failed')return {status:'failed',error:typeof data.error==='string'&&data.error||data.error?.message||'视频生成失败'};
 if(data.state!=='success'||typeof data.result_url!=='string'||!/^https?:\/\//.test(data.result_url))throw fail('H3 任务终态缺少有效结果，请稍后查询');
 return {status:'completed',url:data.result_url};
}
