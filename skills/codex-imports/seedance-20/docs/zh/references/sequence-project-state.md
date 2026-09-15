<!-- AUTO-TRANSLATED: 源文件 = ../../references/sequence-project-state.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 序列项目状态

当 Seedance 请求成为多片段项目时使用本参考。项目状态是唯一真相；提示词是针对一次生成的临时编译指令。

## 运行模型

用户想法 -> 故事脊柱 -> 世界与连续性圣经 -> 序列规划 -> 当前片段契约 -> 当前片段提示词 -> 生成的镜头 -> 观察到的镜头评审 -> 正典调和 -> 下一片段契约 -> 下一提示词。

全局规划。本地生成。观察真实结果。更新正典。从实际已接受画面继续。

## 规范状态

将规范状态与瞬时状态分开。

规范参考控制身份与不可变设计：角色身份、产品身份、服装、产品几何、持久道具、地点与已批准参考标签。

已接受的前序画面控制瞬时开场状态：姿态、动作相位、屏幕位置、摄影机相位、环境排列、音频相位、开放动作与未完成姿态。

## 必需项目字段

最低限度，一个项目状态包含 `schema_version`、`state_revision`、`project_id`、`project_mode`、`surface`、`clip_budget_sec`、`prompt_budget`、`story`、`world_bible`、`reference_registry`、`beats`、`clips`、`take_history`、`current_clip_id`、`canon_revision` 与 `updated_at`。

故事字段：`logline`、`story_promise`、`objective`、`initial_condition`、`final_outcome`、`target_duration_sec`、`tone` 与 `medium`。

节拍字段：`beat_id`、`description`、`narrative_function`、`status`、`assigned_clip_id` 与 `dependencies`。

片段血统字段：`clip_id`、`parent_clip_id`、`sequence_index`、`prompt_version`、`generation_mode`、`source_clip_tag`、`status`、`narrative_job`、`already_happened`、`this_clip_only`、`reserved_for_later`、`planned_start_state`、`planned_end_state`、`observed_start_state`、`observed_end_state`、`continuity_locks`、`allowed_changes`、`continuity_breaks`、`accepted_deviations`、`transition_in`、`transition_out`、`open_motion_vectors`、`handoff_requirements` 与 `extension_depth`。

## 视觉状态

仅追踪重要的内容，不要发明不清晰的细节。

角色：规范身份 ID、服装、发型、所在世界位置、画面内位置、姿态、动作相位、情绪状态、目光、视线、移动方向、速度与身体朝向。

道具：身份、所有者、位置、状态、动作与交互状态。

环境：地点、地理、背景布置、一天中的时间、天气、氛围与持久实用元素。

摄影机：景别、高度、角度、支撑、路径、方向、速度、运动相位、主体关系、对焦状态、曝光状态与端点。

灯光：主光方向、强度、色彩关系、实用光源与过渡状态。

音频：环境声、已完成对白、活跃对白、音乐相位、音效相位、活跃引擎或环境声与音频参考归属。

开放动作：主体方向与速度、摄影机方向与速度、移动道具、未完成姿态、衣物或头发跟随、车辆移动与待定冲击恢复。

观察质量：`observation_confidence`、`uncertainties` 与 `requires_user_confirmation`。

## 调和

当一个已接受片段与计划不同时：

1. 记录偏差。
2. 决定是接受为正典、修复、拒绝/重生，还是重新锚定下一镜头。
3. 若接受，更新下游规划。
4. 移除任何意外完成的节拍。
5. 将任何未完成的计划节拍带入下一合适片段。
6. 永远不要假装计划的结局已发生，而它并未发生。

被拒绝的画面不改变正典，也不能成为续拍父级。

## 项目状态胶囊

使用可读胶囊以支持跨会话续拍。新的对话不能假设其拥有隐藏的先前记忆。

必需字段：

PROJECT ID:
STORY GOAL:
FINAL OUTCOME:
SURFACE:
REFERENCE TAGS:
CANONICAL REFERENCES:
ACCEPTED CLIPS:
CURRENT ACTUAL STATE:
OPEN MOTION:
COMPLETED BEATS:
NEXT CLIP JOB:
CONTINUITY LOCKS:
ALLOWED CHANGES:
RESERVED FUTURE BEATS:
EXTENSION DEPTH:
UNRESOLVED UNCERTAINTIES: