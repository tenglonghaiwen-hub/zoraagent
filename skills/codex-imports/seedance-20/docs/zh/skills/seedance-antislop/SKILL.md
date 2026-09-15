<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-antislop/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-antislop
description: "This skill should be used when a Seedance 2.0 prompt contains generic AI filler, hollow superlatives, vague cinematic language, bloated adjectives, weak verbs, or needs sharper production-specific wording."
license: MIT
user-invocable: true
tags:
  - prompt-quality
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

# seedance-antislop

移除隐藏缺失视觉决策的填充词。一条强 Seedance 提示词使用可观察的名词、动词、摄影机运动、光源、声音提示与约束。一条弱提示词请求卓越而不说卓越看起来或听起来是什么。

## 意图

用户之所以求助于巨大的空洞词，恰恰是因为他们极度在乎却不知将其置于何处。去 slop 的灵魂是守恒：每个被删除的"史诗"必须作为一个承载相同在乎的可见选择回归。在不尊重使其膨胀的情感时剥离提示词，用户听到的是他们的兴奋错了。

## 可见性测试

每个主要短语应可见于摄影机、可由光度计测量、可在混音中听见、或可作为运动观察。如果短语不能通过该测试，将其替换为制作语言。

| 填充 | 询问其意 | 强力替换模式 |
|---|---|---|
| cinematic | 什么摄影机与灯光使其电影感？ | `locked close-up, warm practical key, cool rim light` |
| epic | 尺度或赌注是什么？ | `wide low-angle shot, tiny figure against storm wall` |
| beautiful | 什么颜色、质感或光线行为？ | `pearl highlights on wet ceramic, soft window bounce` |
| dynamic | 什么在移动，多快，在哪里结束？ | `fast lateral track ending on the hero label` |
| professional | 什么制作设置？ | `clean commercial tabletop, controlled reflection, no clutter` |

## 六种 slop 类别

在改写前分类 —— 每种类别有不同的修复：

1. **空洞评价词**（`cinematic, epic, stunning`）—— 将每个转换为赢得它的那一个可观察细节。
2. **借用的图像模型词**（`8K, masterpiece, trending on ArtStation`）—— 删除；质量与分辨率是设置，不是散文。
3. **标签沙拉**（从图像提示词移植的逗号关键词堆）—— 重写为拍摄简报散文：每元素一句，附动作与时间轴。
4. **否定 slop**（`no blur, no artifacts, no extra fingers`）—— 否定召唤；描述那里有什么，并将否定仅保留在约束槽中。
5. **形容词堆叠**（一个质量的三个同义词）—— 挑选重要的那一个细节。
6. **感觉后缀词**（`电影感, 雰囲気のある, 감성적인, atmosférico, атмосферный, vibey`）—— 命名感觉的物理原因；`references/vocab/` 中的每种语言文件都有自己的 Slop Traps 表针对其社区的空洞词。

## 改写通过

首先，下划所有最高级与模糊风格标签并将每个按 slop 类别分类。其次，决定每个词应变为摄影机、灯光、动作、材质、声音或约束语言。第三，减少重复。第四，保持提示词在字符预算内并保留参考标签。

## 不要过度纠正

当有用的类型语言与具体方向配对时不要移除它。`Noir hallway with hard venetian-blind shadows` 是有用的；`dramatic cinematic noir vibes` 没有用。保留传达媒介、年代、调色板或镜头行为的术语。

加载 `[ref:anti-slop-lexicon]` 获取 slop 类别分类法与扩展替换表，加载 `[skill:seedance-vocab-en]` 与 `references/vocab/en.md` 获取完整的功能组织的英语精确词汇。对于非英语提示词，加载匹配词法文件的 Slop Traps 表（`references/vocab/zh.md`、`ja.md`、`ko.md`、`es.md`、`ru.md`）—— 每种语言社区都有自己的空洞质量词与分解。

## 输出契约

返回被移除的词、按摄影机/灯光/动作/声音/约束分组的替换以及收紧的提示词。