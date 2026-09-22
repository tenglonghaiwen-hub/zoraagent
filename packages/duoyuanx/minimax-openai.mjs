// Duoyuanx MiniMax OpenAI-format API. Separate from the content-array v2 protocol.
export const MINIMAX_OPENAI={kind:'video',family:'minimax-openai',route:'/v1/videos',queryRoute:'/v1/videos/{task_id}',contentType:'json',ratios:['16:9','9:16','1:1','adaptive','21:9','4:3','3:4'],resolutions:['768P','2K'],durations:Array.from({length:12},(_,i)=>i+4),maxCount:1,maxConcurrency:2,modes:['t2v','i2v','fl','ref'].map(id=>({id,enabled:true}))};
export function selectMinimaxOpenAI(input){
 const fail=error=>({ok:false,error});
 const refs=input.references||[];
 if(!Array.isArray(refs))return fail('参考素材格式无效');
 const images=refs.filter(r=>r?.type?.startsWith('image/')),videos=refs.filter(r=>r?.type?.startsWith('video/')),audios=refs.filter(r=>r?.type?.startsWith('audio/'));
 if(images.length+videos.length+audios.length!==refs.length)return fail('H3 素材类型无效');
 if(images.length>9||videos.length>3||audios.length>3)return fail('H3 最多9张图片、3个视频、3个音频');
 const mode=input.videoMode||(refs.length?'ref':'t2v');
 if(!MINIMAX_OPENAI.modes.some(m=>m.id===mode))return fail('H3 OpenAI 格式不支持此生成模式');
 if(mode==='t2v'&&(refs.length||input.ratio==='adaptive'))return fail('文生视频不能携带素材或使用 adaptive');
 if(mode==='i2v'||mode==='fl'){
  if(images.length!==(mode==='i2v'?1:2)||videos.length||audios.length)return fail('首帧需1张图片，首尾帧需2张图片，不能混入视频或音频');
  if(input.ratio!=='adaptive')return fail('首帧/首尾帧会强制跟随素材画幅，请选择 adaptive');
 }
 if(mode==='ref'){
  if(!refs.length)return fail('参考生成需要原始素材');
  if(images.length===1||images.length===2)return fail('OpenAI 格式会将1–2张图片解释为首尾帧，不能用于当前多模态参考；请改用官方格式模板，或提供至少3张真实参考图');
 }
 const operation=mode==='t2v'?'generate':'reference';
 if(input.operation!==undefined&&input.operation!==operation)return fail('操作与生成模式不一致');
 if(input.apiRoute!==undefined&&input.apiRoute!==MINIMAX_OPENAI.route)return fail('MiniMax OpenAI 格式必须使用 /v1/videos');
 return {ok:true,mode,selected:{operation,apiRoute:MINIMAX_OPENAI.route},queryRoute:MINIMAX_OPENAI.queryRoute};
}
export function packMinimaxOpenAI(input,model){
 const selected=selectMinimaxOpenAI(input);if(!selected.ok)throw Error(selected.error);
 if(model.id!=='MiniMax-H3')throw Error('多元 MiniMax OpenAI 格式当前仅支持 MiniMax-H3');
 if(!input.prompt?.trim()||input.prompt.length>7000)throw Error('H3 提示词需为1–7000字符');
 if(!MINIMAX_OPENAI.resolutions.includes(input.resolution)||!MINIMAX_OPENAI.durations.includes(input.duration)||!MINIMAX_OPENAI.ratios.includes(input.ratio))throw Error('H3 OpenAI 格式参数超出支持范围');
 if((input.count??1)!==1)throw Error('H3 单次请求只生成一个视频');
 const refs=input.references||[],urls=kind=>refs.filter(r=>r.type.startsWith(kind+'/')).map(r=>r.contentUrl);
 const images=urls('image'),videos=urls('video'),audios=urls('audio');
 const body={model:model.id,prompt:input.prompt,duration:input.duration,size:input.resolution,...(images.length?{images}:{}),metadata:{ratio:input.ratio,...(videos.length?{reference_videos:videos}:{}),...(audios.length?{reference_audios:audios}:{}),aigc_watermark:false}};
 if(new TextEncoder().encode(JSON.stringify(body)).byteLength>64*1024*1024)throw Error('请求体超过64MB，请使用公网素材地址');
 return {method:'POST',path:MINIMAX_OPENAI.route,queryRoute:MINIMAX_OPENAI.queryRoute,authorizationScheme:'bearer',contentType:'json',body};
}
