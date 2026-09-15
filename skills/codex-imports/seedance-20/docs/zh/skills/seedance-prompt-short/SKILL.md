<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-prompt-short/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-prompt-short
description: "This skill should be used when the user asks for a compact Seedance 2.0 prompt, short Chinese prompt, prompt compression, 30-100 word output, or removal of unnecessary prompt language."
license: MIT
user-invocable: true
tags:
  - prompt-compression
  - chinese-prompt
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

# seedance-prompt-short

压缩 Seedance 提示词而不失去制作信号。一条短提示词在有用时仍需要模式、主体、动作、摄影机、光、声音与约束。在移除物理细节之前先移除填充词。

当序列状态存在时，压缩必须保留连续性锁定、精确参考标签、实际开场状态、当前片段动作、端点、已完成节拍排除与保留的未来节拍。不要压缩掉让续拍不重演已完成动作或不泄露未来动作的词。

## 意图

压缩是关于用户最在乎什么的判断行为。存活切割的是他们镜头灵魂；其余先行。如果用户会为被删除的词哀悼，它从不是填充词。

## 压缩优先级

按此顺序保留：

1. 参考标签与其角色。
2. 主体或产品身份。
3. 动作动词与可见端点。
4. 一次摄影机运动。
5. 物理光源或氛围。
6. 声音提示或安静指令。
7. 安全、IP 或连续性约束。
8. 序列状态子句：实际开场状态、连续性锁定、已完成节拍与保留节拍。

在删除保持约束前，先删除泛化形容词、重复风格标签、明显背景细节、二级摄影机运动与二级动作。

对于双语或混合语言压缩，加载 `[ref:multilingual-community-examples]`。仅保留阐明参考角色、对白、摄影机术语或安全制作约束的语言混合。

## 紧凑模板

| 需求 | 模板 |
|---|---|
| T2V | `[Subject] [action and endpoint] in [scene]. Camera: [one move]. Light/style: [physical source]. Sound: [cue]. Constraint: [risk/continuity].` |
| I2V | `[Image1] preserved; only [motion/light/camera] changes. Camera: [one move]. Sound: [cue]. Constraint: [what must not change].` |
| V2V | `[Video1] controls [motion/camera/timing] only; new subject [anchor]. [Action]. Do not transfer [identity/scene/logo].` |
| Chinese | `[Image1]为参考，严格保持[主体]不变；仅加入[动作/光线/镜头]。声音：[提示]。` |

## 输出契约

返回一条紧凑提示词，理想为 30–100 个英文单词或等效的中文提示词（当用户要求中文或最大压缩时）。仅在移除了重要内容时附一条单行备注。