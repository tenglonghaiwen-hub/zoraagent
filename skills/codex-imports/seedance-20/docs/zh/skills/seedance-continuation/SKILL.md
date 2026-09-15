<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-continuation/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-continuation
description: "This skill should be used when a Seedance 2.0 user asks to continue, extend, make the next part, repair the tail, bridge between known frames, re-anchor drift, or create a successor prompt from accepted footage."
license: MIT
user-invocable: true
tags:
  - continuation
  - extend
  - continuity
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

# seedance-continuation

将此用于无缝续拍、有意下一镜头、衔接片段、尾部修复与漂移后的重新锚定。续拍提示词必须锚定在已接受画面中，而非仅在旧计划中。

加载 `[ref:continuation-handoff]`、`[ref:sequence-project-state]`、`[ref:prompt-compiler]`、`[ref:reference-transfer-contract]` 与 `[ref:continuity-qc]`。当续拍失败或可见漂移时加载 `[ref:failure-atlas]`。加载 `[ref:directing-engine]` 使下一片段继承项目的导演声音及其在长篇脊柱上的位置；外观永不在片段间重置。

## 意图

用户已经制作了他们接受的某物，现在他们信任故事从它真正落地之处继续 —— 不是计划希望它落在之处。本技能的灵魂是对实际发生之事忠诚：尊重已接受画面作为唯一真相，拒绝凭空发明衔接，并询问真实结尾而非猜测它。连续性是一个承诺：用户已有的影片不会被悄悄矛盾。

## 必需输入关卡

在撰写任何续拍提示词前，要求：

- `project_id`；
- 当前 `clip_id`；
- 有效的 `parent_clip_id`；
- 完整故事目标；
- 最终故事结局；
- 下一计划叙事职责；
- 已接受前序片段或已接受尾帧；
- `observed_end_state`；
- 连续性锁定；
- 继承的导演声音与弧位置；
- 精确参考注册表；
- 活跃平台或保守平台档案。

如果来源不可用，说："我有故事计划，但我没有上一生成的实际结尾。上传片段或其尾帧，或精确描述结尾可见的内容。我不应凭空发明续拍状态。"

不要通过撰写投机性提示词来隐藏这种不确定性。

## 续拍类型

`seamless_continuation`：同一镜头、同一地理、同一开放动作、相同或有动机的摄影机延续，以及已接受前序画面作为来源。

`intentional_next_shot`：适合编辑性剪辑。故事连续性重要，但不承诺精确的画面连续性。不要称之为无缝。

`bridge_between_known_states`：必须连接一个定义好的开始状态与结束状态，当活跃平台支持时常用首尾帧生成。

`repair_tail`：前序最后数秒失败。在继续前修复、剪辑或重生尾部，因为从失败的尾部继续会放大错误。

`reanchor_after_drift`：身份、细节、地理、动作、音频或世界连续性降级。返回规范身份、最强已接受尾帧、稳定源片段或使用规范参考的新有意镜头。

## 正典规则

已接受观察画面覆盖计划状态。如果计划说主体到达车门但已接受片段在两步外结束，下一提示词从两步外开始。它不重演终点退出，也不假设主体已在车内。

被拒绝的画面永不更新正典，也永不成为父级来源。

追踪 `extension_depth`。在深度 2 或以上，警告重复延长会增加连续性风险。当可见漂移开始时，推荐重新锚定而非盲目再次延长。

## 输出契约

返回：

1. 续拍类型。
2. 使用的来源证据。
3. 观察到的结束状态。
4. 下一片段契约。
5. 连续性锁定与允许变更。
6. 要排除的已完成节拍。
7. 要排除的保留未来节拍。
8. 仅针对当前片段的最终自然语言 Seedance 提示词。
9. 更新的项目状态胶囊或对缺失来源证据的请求。