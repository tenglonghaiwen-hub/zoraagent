<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-recipes/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-recipes
description: "This skill should be used when the user asks for a Seedance 2.0 template, genre recipe, product ad, lifestyle video, drama scene, music video, landscape shot, commercial, animation scene, or reusable production pattern."
license: MIT
user-invocable: true
tags:
  - templates
  - genres
  - recipes
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

# seedance-recipes

将配方用作起始模式，而非僵化的提示词模板。选择匹配用户结果的配方，然后定制主体、动作、摄影机、灯光、音频与约束。配方应保持短片段的单一节拍纪律。

加载 `[ref:genre-guides]` 获取类型模式，当用户需要可复制即用的范例时加载 `[ref:examples-by-mode]`，对专业多镜头序列或商业广告加载 `[ref:shot-list-continuity]`，当配方应反映中文/俄语/日语/韩语/西班牙语社区风格结构时加载 `[ref:multilingual-community-examples]`。

## 意图

配方是起步，从不是模具。用户想要经过验证形状的自信，以及他们自己的故事在里面。每次都将配方弯曲到故事上；如果用户感觉被模板化，即使输出是称职的，他们也被辜负了。

## 配方族

| 族 | 最佳用途 | 核心模式 |
|---|---|---|
| 产品 | 广告、电商、主角镜头、材质揭示。 | `product anchor + one material change + controlled camera + logo preservation` |
| 生活方式 | 人使用、食物、旅行、社交片段。 | `simple action + lived environment + handheld or natural light + ambient sound` |
| 剧情 | 情绪、对白、简短叙事节拍。 | `character tag + gesture + motivated camera + silence or sparse sound` |
| MV | 节拍同步、舞蹈、风格化剪辑。 | `rhythm reference + visible beat changes + light pulses + clear character blocking` |
| 风景 | 建立镜头、自然、氛围。 | `slow camera + weather motion + layered depth + natural sound` |
| 商业 | 品牌安全的润色与功能。 | `problem/use/result beat + precise product constraint + clean light` |
| 动画 | 原创角色与风格化动作。 | `medium + shape language + palette + elastic or weighted motion` |
| VFX | 转变、粒子、天气、能量。 | `source + material behavior + interaction + dissipation endpoint` |
| 首尾帧 | 中间过渡、产品状态变化、角色姿态目标。 | `first frame + last frame + continuous transition + identity locks` |
| 商业活动 | 6/10/15/30 秒变体、竖屏/社交精简版、无字幕/本地化母版。 | `hook + product proof + end state + cutdown matrix + delivery notes` |
| 短剧 | 快剪竖屏迷你剧节拍：建立、反转、悬念。 | `two or three labeled shots + one emotional reversal + held reaction close + cut on the sting` |
| 口播 | 主持人、解说、直播风格镜头前推介。 | `locked medium close-up + short quoted lines + minimal head motion + caption-safe framing + room tone` |
| 家居/空间参观 | 房间、场地或物业的参观。 | `single continuous take + steady forward path + light changes per zone + ambient sound only` |

## 提示词骨架

**产品 I2V：** `[Image1] is the product reference; preserve logo, label, shape, and materials exactly. [One material or light change]. Camera: [single move]. Lighting: [physical source]. Sound: [ambient/SFX].`

**剧情 T2V：** `Character A [visible emotional action] in [specific setting]. Camera: [motivated framing]. Lighting: [motivated source]. Sound: [ambient or short dialogue]. End state: [changed expression/action].`

**参考动作：** `[Video1] provides only [camera/action/timing] reference; do not transfer identity, costume, logo, or environment. New subject: [authorized/original subject]. [Action and endpoint].`

**首尾帧：** `[Image1] is the first frame. [Image2] is the last frame. Preserve [identity/product/scene anchors]. Generate a continuous transition from [start state] to [end state]. Camera: [locked or one controlled move]. Sound: [ambient/SFX].`

**动画：** `Original [character archetype] [action] in [environment]. Style: [medium, line quality, texture, palette]. Motion: [rhythm]. Camera and sound: [simple support].`

## 选择规则

如果用户给出多个目标，选择保护最脆弱需求的配方。产品身份胜过摄影机奇观；唇形同步胜过大幅头部动作；角色一致性胜过复杂编排；首尾帧目标准确性胜过额外风格变化；安全与授权胜过风格模仿。

## 序列状态

当序列状态存在时，配方必须继承故事脊柱、当前片段范围、连续性锁定、精确参考标签、已完成节拍与保留的未来节拍。配方可提议片段地图，但它必须仅定稿当前未解决的提示词，并将后续提示词保持临时直到已接受画面被评审。

## 输出契约

返回一个选定的配方、它为何契合、定制的提示词骨架、紧凑最终提示词与活动/交付备注（若相关）。