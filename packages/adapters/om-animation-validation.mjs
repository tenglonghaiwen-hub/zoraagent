// Validate the contract before the renderer can silently create placeholder scenes.
export function validateAnimationInvocation(tool,args={},instruction=''){
 const runtime=args.edit_decisions?.render_runtime;
 if(/remotion/i.test(instruction)&&(tool==='hyperframes_compose'||tool==='video_compose'&&runtime!=='remotion'&&args.operation!=='remotion_render')){
  throw Error('用户明确指定 Remotion，禁止替换渲染器。请使用 video_compose 的 Remotion 路径；依赖不可用时报告缺项。');
 }
 const hyper=tool==='hyperframes_compose'||tool==='video_compose'&&runtime==='hyperframes';
 if(!hyper||!['render','compose','scaffold_workspace'].includes(args.operation))return;
 const cuts=args.edit_decisions?.cuts;
 if(!Array.isArray(cuts)||!cuts.length)throw Error('动画缺少 cuts 场景数据，不能渲染占位成片');
 for(const [index,cut] of cuts.entries()){
  if(!Number.isFinite(cut.in_seconds)||!Number.isFinite(cut.out_seconds)||cut.in_seconds<0||cut.out_seconds<=cut.in_seconds)throw Error(`场景 ${index+1} 缺少有效 in_seconds/out_seconds 时间轴`);
  const text=cut.text||cut.title;
  const type=String(cut.type||'').toLowerCase();
  if(type&& !['text_card','hero_title','callout','image','video','composition','audio'].includes(type))throw Error(`场景 ${index+1} 的 ${type} 不支持直接转换为 HyperFrames，必须先编写实际动画，禁止降级为标题占位`);
  if(!cut.source&&(!text||/^Scene\s*\d+$/i.test(String(text).trim())))throw Error(`场景 ${index+1} 缺少实际文字或素材，禁止使用 Scene 占位`);
 }
 if(cuts.length>1&&cuts.every(c=>c.in_seconds===0))throw Error('所有场景同时从 0 秒开始，可能互相覆盖；请提供正确的分段时间轴');
}
