<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vocab-en/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vocab-en
description: "This skill should be used when an English Seedance 2.0 prompt is slop-heavy, generic, padded with empty quality words, tripping false-positive filters, or needs precise English production vocabulary for camera, lighting, motion, VFX, audio, and constraints."
license: MIT
user-invocable: true
tags:
  - english
  - vocabulary
  - anti-slop
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

# seedance-vocab-en

英语是默认的提示词语言，同时以两种方式失败：slop（增加 token 但无信号的空洞评价词）与误报（模糊的威胁相邻措辞触发最严的审核表面）。两者的解药相同：具体的制作英语。精确保留参考标签：`[Image1]`、`[Video1]`、`[Audio1]` 永远不应被重新措辞。

## 意图

英语是大多数用户思考的地方，也是大多数提示词悄悄腐朽的地方。本词汇的灵魂是精确即善意：给人们精确的词，使他们的兴奋在接触模型时存活，并使诚实的提示词停止被误认为危险的。

## 使用规则

如果摄影机、麦克风、光度计或秒表无法检测到它，重写它。每个句子应命名可见、可听或可测量的内容：主体、可见动作、摄影机、光源、声音、约束。

| 功能 | 英语措辞 |
|---|---|
| Camera | `slow push-in`, `locked medium shot`, `stable lateral tracking`, `pull back to reveal`, `macro close-up` |
| Lighting | `soft backlight`, `warm practical light from the left`, `cool moonlight rim`, `wet asphalt reflecting neon` |
| Motion | `a slow head turn that stops`, `droplets merge and slide down`, `fabric settles after the gesture` |
| Audio | `quiet room tone`, `one clear spoken line in quotes`, `no music until after the line` |
| Constraints | `keep the logo, label, and shape unchanged`, `one action, one camera move`, `nothing else moves` |

## 反 slop 通过

在添加任何内容前剥离质量形容词：`cinematic`、`epic`、`stunning`、`masterpiece`、`8K`、`ultra-realistic`、`award-winning`、`hyper-detailed` 全部删除或各自转换为一个可观察细节。一条赢得"史诗"的提示词点名人群规模、镜头距离或建筑高度，而非这个词。

## 过滤感知措辞

英语同音词被读作过滤器的威胁：`shoot the scene`、`kill the lights`、`gun it`、`dead silence`、`blow up the image`。使用制作同义词（`film the take`、`cut the lights to black`、`accelerate hard`、`held silence`、`enlarge to full frame`）。这是仅对安全提示词的清晰 —— 永远不是规避。任何真正有风险的内容（未成年人、真实人物肖像、性或图形内容）路由到 `[skill:seedance-filter]` 获取其边界规则，而非重新措辞。

## 紧凑模式

`[Image1] is the reference; keep identity, color, and shape unchanged. Only [motion/light/camera] changes. Camera: [one move]. Sound: [one cue]. Constraints: [lock].`

加载 `references/vocab/en.md` 获取完整的功能组织词汇、slop 陷阱与过滤触发修复。加载 `[ref:anti-slop-lexicon]` 获取核心替换规则与 `[ref:filter-vocab]` 获取完整误报修复表。

## 输出契约

返回反 slop 后的英语提示词、所做的每次替换（slop → 可观察细节）、任何已应用的过滤触发修复，以及未更改的参考标签。