<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-style/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-style
description: "This skill should be used when the user asks for visual style, art direction, render feel, period aesthetic, texture, animation style, realism level, or style-safe alternatives to studio or franchise references."
license: MIT
user-invocable: true
tags:
  - style
  - art-direction
  - ip-safe
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

# seedance-style

将风格请求翻译为制作描述符。风格应描述媒介、质感、调色板、镜头或渲染行为、年代线索与构图。当更安全的描述性风格能保留用户意图时，不要依赖工作室、系列、艺术家或在世创作者名称。

## 意图

用户指向他们喜爱的艺术并请求靠近它。本技能的灵魂是尊重这份爱但拒绝偷窃：找出爱由什么构成 —— 光、质感、节奏、年代 —— 并将其重建为用户拥有的东西。他们应感受到自己的品味被理解，而非被纠正。

## 风格安全规则

除非用户有明确授权的工作流，否则不要使用工作室、系列、艺术家或在世创作者名称作为风格锚点。通过描述媒介、质感、调色板、灯光、构图、年代、线条质量与动作节奏来保留预期的视觉功能。

| 用户意图 | 安全的制作描述符 |
|---|---|
| 温馨手绘奇幻 | `hand-painted 2D animation, soft watercolor backgrounds, rounded character silhouettes, warm pastel palette, gentle parallax` |
| 锐利赛博朋克动作 | `neon noir city, wet pavement reflections, high-contrast magenta and cyan light, fast lateral tracking, angular silhouettes` |
| 高端产品写实 | `clean commercial realism, controlled reflections, shallow depth of field, neutral background, polished material detail` |
| 复古纪录片 | `1970s documentary texture, muted film grain, practical daylight, handheld observational framing` |
| 儿童动画 | `soft clay-like characters, simple expressive faces, bright primary palette, bouncy squash-and-stretch motion` |

## 分层风格方法

将风格分为层而非一个宽泛标签：**媒介**（实拍、定格、2D、3D、微缩）、**表面**（纸张颗粒、黏土、拉丝金属、玻璃、织物）、**调色板**（柔和、单色、钠橙）、**摄影机/渲染**（微距、浅焦、正交、手持）与**动作节奏**（温和、顿音、弹性、写实重量）。

## 混合风格规则

如果用户要求混合，将每种风格分配给一层：`live-action product photography with illustrated UI overlays` 比混合许多具名影响更清晰。让角色设计、环境、灯光与 VFX 处于兼容的语域中。

当风格是 2D、动画或赛璐璐时加载 `[ref:2d-anime-grammar]` —— 它涵盖图层语法、爆发 vs 保持动作、冲击帧、涂抹、绘图台摄影机语言，以及风格化工作的无镜头规则。

## 源外观锁定

从中国实践中现场观察：当提示词命名捕获源并拥抱其伪影而非与之对抗时，写实风格会稳定。分类预期外观，然后刻意锁定其标志缺陷：

| 源外观 | 锁定其伪影 |
|---|---|
| 手机日常拍摄 / UGC | `vertical handheld phone footage, slight grip sway, auto-exposure shifts, ambient room sound` |
| 直播 | `fixed webcam framing, flat ring light, mild compression, real-time caption pacing` |
| 安防 / 行车记录仪 | `locked high-angle camera, timestamp burn-in feel, low-light noise, no camera response to events` |
| 复古胶片 | `grainy film texture, gate weave, halation around highlights, era-correct contrast` |
| 工作室商业 | `controlled reflections, clean background, polished material detail, zero handheld motion` |

缺陷词汇即风格：看起来过于干净的伪 UGC 被读为双重的假。

## 序列状态

当序列状态存在时，继承媒介语法、当前片段范围、连续性锁定、精确参考标签、规范设计、已接受瞬时状态与保留的未来节拍。风格可为片段上色，但它不能改变身份、服装、产品设计、平台档案或保留的事件。

## 输出契约

返回一个安全的风格描述符、任何受保护名称改写与一句整合的提示词句。