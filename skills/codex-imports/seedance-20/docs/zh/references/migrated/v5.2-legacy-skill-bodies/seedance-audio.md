<!-- AUTO-TRANSLATED: 源文件 = ../../../../references/migrated/v5.2-legacy-skill-bodies/seedance-audio.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-audio
description: "This skill should be used when the user asks for native audio, dialogue, lip-sync, voice, sound effects, music timing, beat sync, ambient sound, audio references, or audio-video synchronization in Seedance 2.0."
license: MIT
user-invocable: true
user-invokable: true
tags:
  - seedance-20
  - audio
  - lip-sync
  - sound-design
metadata:
  version: "5.1.0"
  updated: "2026-04-27"
  parent: "seedance-20"
  author: "Iamemily2050 (@iamemily2050)"
  repository: "https://github.com/Emily2040/seedance-2.0"
  openclaw:
    emoji: ""
    homepage: "https://github.com/Emily2040/seedance-2.0"
---

# seedance-audio

使用本技能处理对白、唇形同步、音乐时序、音效、环境声与音频参考规划。

返回：音频目标、说话者/源分配、提示词就绪措辞、同步约束、风险备注与重试变体。

规则：
- 保持口语台词简短并将每行分配给特定角色。
- 分离对白、环境声、音效与音乐。
- 按角色映射参考：`[Audio1] rhythm`、`[Audio2] voice tone`、`[Audio3] ambience`。
- 不要声称为通用支持的语言、时长或声音克隆。检查 `[ref:api-status]`。
- 真实人物人声与肖像工作流需要授权与平台专属支持。