<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-interview-short/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-interview-short
description: "This skill should be used when the user wants a fast Seedance 2.0 creative brief, a short interview, a compressed intake flow, or a quick director-style clarification before prompt writing."
license: MIT
user-invocable: true
tags:
  - creative-direction
  - brief
  - compression
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

# seedance-interview-short

当速度比详尽创意发现更重要时使用此参考。目标是将模糊想法转化为带不超过三个问题的紧凑导演简报，然后路由到提示词写作。

## 意图

这里的用户知道他们想要什么，并请你尊重他们的势头。本技能的灵魂是克制：找到会击沉生成的那一块缺失，只问那一块，然后让开。速度是其信任所采取的形式。

## 流程

最多问三个问题，且仅在答案实质上改变提示词时才问。假设没有电影背景：用日常用语提问、给出可挑选的选项、并附上默认值使"我不知道"永不使简报停滞。优先级：

1. 视频中发生了什么，结尾与开始有什么不同？`(不确定？我会选一个带可见结尾的简单动作)`
2. 这是一条完整的片段、相连片段、要划分的更长场景、已接受画面的续拍，还是你不确定？`(不确定？我会规划整个故事但仅定稿第一条提示词)`
3. 完整故事必须如何收尾，你是否有定义外观、动作或声音的照片、片段、尾帧或声音？`(没有也可以；如果是续拍，我需要已接受片段或尾帧)`

如果用户已提供足够信息，不要问。立即生成简报。如果用户流利地使用制作语言，放弃平实措辞并用导演术语提问。

即使在快速模式下，简报陈述一个有动机的意图，而非泛化的"电影感"外观：命名场景在做什么并让摄影机、光与表演服务于它。仅在场景的正确设置确实不清晰时加载 `[ref:directing-engine]`；否则从记忆中内联应用其连贯规则。

## 紧凑简报模式

`Mode: [T2V/I2V/V2V/R2V]. Subject: [anchor]. Beat: [before -> action -> final state]. Camera: [one move]. Light/style: [physical source and safe descriptor]. Sound: [dialogue/ambience/SFX/music/silence]. Constraints: [identity, IP, safety, product, prompt budget].`

## 路由规则

对相连片段、长场景、不清楚的总时长或续拍就绪规划，路由到 `[skill:seedance-sequence]`；对已接受画面的续拍路由到 `[skill:seedance-continuation]`；对完整独立制作提示词路由到 `[skill:seedance-prompt]`；对紧凑提示词路由到 `[skill:seedance-prompt-short]`；对 IP/肖像风险路由到 `[skill:seedance-copyright]`；当用户从糟糕结果开始时路由到 `[skill:seedance-troubleshoot]`。

## 输出契约

返回一条 150 字以内的紧凑简报、任何缺失的高影响问题与一个推荐的技能路由。如果请求是序列，包含完整故事结尾、可能的片段数、当前片段工作以及后续提示词在已接受画面被评审前保持临时的事实。