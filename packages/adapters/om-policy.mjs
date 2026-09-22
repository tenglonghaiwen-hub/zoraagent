import fs from 'node:fs';
export const OM_POLICY=JSON.parse(fs.readFileSync(new URL('../../vendor/openmontage/zora-policy.json',import.meta.url),'utf8'));
export const omToolAllowed=name=>OM_POLICY.allowedTools.includes(name);
export const omSkillAllowed=id=>OM_POLICY.allowedSkills.includes(String(id).replace(/^om:/,'').replace(/\.md$/,''));
export function omChildEnvironment(env){
 // OM is a local execution layer, not a second Agent or a remote model client.
 return Object.fromEntries(Object.entries(env).filter(([key])=>!/(API_KEY|ACCESS_KEY|TOKEN|SECRET|PASSWORD|CODEX|ANTHROPIC|OPENAI|DUOYUANX|MINIMAX|GPU_RENT|AUTODL|RUNPOD|VAST_AI)/i.test(key)));
}
export const OM_PIPELINES=[
 {id:'cinematic',name:'AI 视频创作与后期',useWhen:'按主题、分镜或参考素材先生成图片/视频，再剪辑成片；生成走 Zora 已配置 API',inputs:['创作指令','可选参考素材'],steps:[['由 Zora 制定分镜和生成参数'],['Zora 媒体 Agent 调用已配置 API，等待真实结果'],['整理生成素材','material_ledger','audio_probe','frame_sampler'],['配音字幕与合成','piper_tts','subtitle_gen','audio_mixer','video_stitch','video_compose'],['验收导出','composition_validator','export_bundle']]},
 {id:'edit-compose',name:'剪辑与合成',useWhen:'裁剪、变速、拼接、调色，合成已有图片视频和音轨',inputs:['原始素材','剪辑目标'],steps:[['检查素材','audio_probe','frame_sampler'],['剪辑规划','edit_plan'],['剪辑处理','video_trimmer','video_stitch','color_grade','auto_reframe'],['合成验收','video_compose','composition_validator','export_bundle']]},
 {id:'clip-factory',name:'长视频拆短片',useWhen:'从访谈、直播、课程中提取多个独立片段',inputs:['长视频','片段数量或筛选要求'],steps:[['检测与转写','scene_detect','transcriber','audio_energy'],['由 Zora 选择片段','edit_plan'],['剪辑与字幕','video_trimmer','auto_reframe','subtitle_gen'],['逐条验收导出','video_compose','audio_probe','export_bundle']]},
 {id:'localization-dub',name:'字幕与配音',useWhen:'语音转字幕、翻译字幕、本地配音；翻译由 Zora Agent 完成',inputs:['视频或音频','目标语言或配音文稿'],steps:[['转写与时间轴','transcriber','audio_probe'],['字幕和本地配音','subtitle_gen','piper_tts'],['混音与合成','audio_mixer','video_compose'],['字幕同步验收','composition_validator','export_bundle']]},
 {id:'podcast-repurpose',name:'播客再剪辑',useWhen:'音频/访谈去静音、提取精彩片段、添加字幕',inputs:['播客音视频'],steps:[['分析转写','audio_probe','audio_energy','transcriber'],['剪辑规划','edit_plan'],['去静音剪辑','silence_cutter','video_trimmer'],['字幕混音合成','subtitle_gen','audio_mixer','video_compose','export_bundle']]},
 {id:'documentary-montage',name:'素材混剪',useWhen:'围绕主题将用户素材和已授权素材剪成叙事视频',inputs:['主题','已有素材或允许检索的素材范围'],steps:[['素材整理','direct_clip_search','material_ledger','frame_sampler'],['由 Zora 安排叙事与剪辑','edit_plan'],['配音与字幕','piper_tts','subtitle_gen'],['合成导出','video_stitch','audio_mixer','video_compose','export_bundle']]},
 {id:'animated-explainer',name:'图文动画说明',useWhen:'将现成图文、数据和旁白制作说明视频，不调用 OM 生成模型',inputs:['脚本','图文或数据'],steps:[['由 Zora 编排图文','edit_plan'],['旁白字幕','piper_tts','subtitle_gen'],['本地渲染','hyperframes_compose','video_compose'],['验收','composition_validator','audio_probe','export_bundle']]},
 {id:'screen-demo',name:'录屏教程后期',useWhen:'剪辑用户提供的录屏，配旁白字幕和音轨',inputs:['已有录屏','讲解内容'],steps:[['审阅录屏','frame_sampler','audio_probe'],['整理教程步骤','edit_plan','video_trimmer'],['旁白字幕','piper_tts','subtitle_gen'],['合成导出','video_compose','export_bundle']]},
 {id:'talking-head',name:'口播视频后期',useWhen:'剪辑已有真人口播；不生成数字人、不调用独立大模型',inputs:['已有口播视频'],steps:[['转写分析','transcriber','scene_detect'],['去停顿和裁切','silence_cutter','video_trimmer','auto_reframe'],['字幕调色合成','subtitle_gen','color_grade','video_compose','export_bundle']]}
].map(p=>({...p,executor:'zora-agent',tools:[...new Set(p.steps.flatMap(step=>step.slice(1)))],mediaGeneration:{executor:'zora-configured-api',delegateTool:'delegate_media_task',queryTool:'query_generation_task',requiresCompletedOutput:true},generationPolicy:'先选择管线；涉及图片/视频生成时统一由 Zora 媒体 Agent 按服务端模型目录调用已配置 API，等待生成完成后交给 OM 本地后期，不启用 OM 自带模型。用户只要求后期时不得自行增加付费生成。',completionRule:'逐步检查真实输出，失败停止；管线选择不代表执行完成。'}));
export const findOmPipeline=id=>OM_PIPELINES.find(p=>p.id===id);
