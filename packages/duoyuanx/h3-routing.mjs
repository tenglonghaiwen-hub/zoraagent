// Supplier documentation: generation and official-generation, verified 2026-09-15.
export function selectH3(input){
 const refs=input.references||[],images=refs.filter(r=>r.type?.startsWith('image/')),videos=refs.filter(r=>r.type?.startsWith('video/')),audios=refs.filter(r=>r.type?.startsWith('audio/'));
 const fail=error=>({ok:false,error});
 if(images.length+videos.length+audios.length!==refs.length)return fail('H3 素材类型无效');
 if(images.length>9||videos.length>3||audios.length>3)return fail('H3 最多9张图片、3个视频、3个音频');
 const mode=input.videoMode|| (refs.length?'ref':'t2v');
 if(!['t2v','i2v','fl','ref'].includes(mode))return fail('H3 生成模式无效');
 if(mode==='t2v'&&refs.length)return fail('文生视频不能携带参考素材，请选择对应参考模式');
 if(mode==='t2v'&&input.ratio==='adaptive')return fail('H3 文生视频不能选择 adaptive');
 if(mode==='i2v'||mode==='fl'){
  if(images.length!==(mode==='i2v'?1:2)||videos.length||audios.length)return fail('首帧需要1张图，首尾帧需要2张图，不能混入视频或音频');
  if(input.ratio!=='adaptive')return fail('H3 首帧/首尾帧强制跟随素材画幅，请选择 adaptive；指定画幅请使用多模态参考');
 }
 if(mode==='ref'&&!refs.length)return fail('多模态参考需要原始素材');
 // V1 assigns 1/2 images to frame roles regardless of caller intention.
 // Legacy OpenAI restriction disabled: if(mode==='ref'&&images.length>0&&images.length<3)return fail('H3 OpenAI 格式会将1–2张图片识别为首尾帧，不能作为多模态参考提交；请提供至少3张实际参考图，或仅使用视频/音频参考');
 // Legacy submission route: /v1/videos (disabled for new H3 tasks).
 const apiRoute='/v2/video_generation';
 const operation=mode==='t2v'?'generate':'reference';
 if(input.operation!==undefined&&input.operation!==operation)return fail('H3 operation 与生成模式冲突');
 if(input.apiRoute!==undefined&&input.apiRoute!==apiRoute)return fail('H3 所选路由与素材角色不兼容，应使用 '+apiRoute+'；未降级或提交');
 return {ok:true,mode,selected:{operation,apiRoute},queryRoute:'/v2/query/video_generation/{task_id}'};
}
