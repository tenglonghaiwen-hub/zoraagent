<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-sequence/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-sequence
description: "This skill should be used when a Seedance 2.0 request is a long story, connected set of clips, multi-generation scene, campaign sequence, dense storyboard, continuation-ready plan, or any idea that must be divided into stateful clips."
license: MIT
user-invocable: true
tags:
  - sequence
  - continuity
  - prompt-compiler
  - seedance-20
metadata:
  version: "6.3.0"
  updated: "2026-06-29"
  parent: "seedance-20"
  author: "Iamemily2050 (@iamemily2050)"
  repository: "https://github.com/Emily2040/seedance-2.0"
  openclaw:
    emoji: "🎬"
    homepage: "https://github.com/Emily2040/seedance-2.0"
---

# seedance-sequence

当用户的想法超过一次可靠生成、要求相连片段、或用户说继续、延长、下一部分、第二部分、下一场景或更长时使用此参考。全局规划，本地生成：技能规划整个故事，但仅编译下一个未解决的片段。

加载 `[ref:sequence-project-state]`、`[ref:continuation-handoff]`、`[ref:prompt-compiler]`、`[ref:surface-prompt-profiles]`、`[ref:event-density]` 与 `[ref:continuity-qc]`。当存在参考时加载 `[ref:reference-transfer-contract]`，当请求包含许多镜头或动画分镜时加载 `[ref:dense-storyboard-mode]`。加载 `[ref:directing-engine]` 为整个故事设定一种导演声音并规划长篇脊柱，使外观由一只手跨每条片段创作。

## 意图

用户正在尝试制作一部影片，而非一堆提示词。本技能保护跨代动作的脉络：已发生的、正在发生的、还不得发生的，以及已接受画面实际展示的内容。规划是全局的；提示词是局部的。

## 序列分类器

当故事超出已验证活跃平台时长、要求多个相连片段、包含多个叙事节拍、是电影场景、广告、活动、MV、动作场景、对白场景或使用继续/延长/下一部分语言时，分类为 `sequence_project`。否则分类为 `standalone_clip` 并返回简洁提示词路径。

对每个请求还分类：

- 生成输入模式：T2V、I2V、V2V、R2V、FLF2V、剪辑、原生延长（在已验证时）或故障排查；
- 序列关系：standalone、sequence_first_clip、seamless_continuation、intentional_next_shot、bridge_between_known_states、repair_tail 或 reanchor_after_drift；
- 镜头结构：compact_single_take、phased_single_take、dense_multishot、first_last_frame_transition 或 video_edit_contract；
- 媒介语法：live_action、3d_animation、2d_animation、product_or_object 或另一受支持媒介；
- 平台档案：精确参考标签约定、已验证时长范围、提示词预算、支持的参考角色、时间轴语法、剪辑/延长可用性、音频行为与约束。

如果平台未知，使用保守通用档案。不要凭空发明时长、提示词限制、参考数量或标签语法。

## 构建流程

1. 在 Clip 01 之前建立故事承诺与最终结局。
2. 识别角色、产品或叙事目标，并与 `[ref:directing-engine]` 为整个项目设定一种导演声音并规划长篇脊柱 —— 景别、摄影机运动、光对比与声音应如何从开篇到高潮再到释放进展，以及哪一条片段打破模式以标记转折。
3. 提取有序节拍并将每个节拍分配状态：planned、current、completed、omitted 或 replaced。
4. 使用活跃平台预算或保守假设将节拍划分为生成大小的片段。
5. 给每个片段一个叙事职责和一个已完成的端点。
6. 定义计划的开场状态、计划的结束状态、连续性锁定、允许变更与延长友好的交接要求。
7. 将后续片段存储为临时意图卡片，而非最终提示词。
8. 仅从当前片段契约编译第一个未解决的片段提示词。
9. 生成后，要求片段或尾帧，记录观察到的开始/结束状态，调和正典，然后仅在那时编译下一提示词。

使用新手友好的语言。可以这样说："这个想法需要三次相连生成。我现在规划完整故事，但一次定稿一条提示词，使每条新提示词匹配 Seedance 实际产出的内容。"

## 序列映射字段

每个片段卡片必须包含 `clip_id`、`sequence_index`、`parent_clip_id`、`narrative_job`、`target_duration_sec`、`generation_mode`、`shot_structure`、`already_happened`、`this_clip_only`、`reserved_for_later`、`planned_start_state`、`planned_end_state`、`transition_in`、`transition_out`、`continuity_locks`、`allowed_changes`、`arc_position` 与 `status`。`arc_position`（open、rising、turn、climax 或 release）记录片段在导演脊柱上的位置，使景别、运动、光与声音趋势继承项目声音。

Clip 01 可以计划"离开终点并到达打开的车门"，端点为"主体在打开的后门旁边"，同时为后续片段保留"进入汽车"与"车辆离开"。不要将所有计划片段粘贴到一条生成提示词中。

## 输出契约

对于新序列，返回：

1. 项目摘要。
2. 故事脊柱。
3. 最终结局。
4. 世界与连续性圣经，包括所选导演声音与长篇外观脊柱（景别、运动、光与声音如何进展，以及哪条片段打破模式）。
5. 序列映射。
6. Clip 01 契约。
7. Clip 01 最终自然语言 Seedance 提示词。
8. 后续片段的临时意图卡片。
9. 在 Clip 02 定稿前返回生成的片段或尾帧的指令。
10. 项目状态胶囊。

不要输出内部 JSON，除非用户要求。可读的胶囊是跨会话交接。