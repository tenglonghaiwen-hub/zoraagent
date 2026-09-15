<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vfx/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vfx
description: "This skill should be used when the user asks for VFX, particles, energy, destruction, transformation, weather effects, magical effects, explosions, smoke, fire, water, or physically plausible effects in Seedance 2.0."
license: MIT
user-invocable: true
tags:
  - vfx
  - particles
  - effects
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

# seedance-vfx

VFX 提示词需要材质行为、来源、时序与后果。将每个特效视为物理的：它从某处开始，与光和物体交互，随时间变化，并以可见状态结束。除非将"魔幻"、"爆炸性"或"电影感"翻译为粒子、流体、烟、光、碎片、变形或能量行为，否则避免使用它们。

## 意图

用户想要惊奇，而惊奇在它停止服从物理的那一刻就死了。本技能的目的是带因果预魔的魔法：每个特效都有来源、旅程与结尾，所以不可能读作被见证而非被渲染。

## 特效契约

陈述：特效来源、材质、运动路径、与光的交互、与物体的交互、消散与端点。

| 特效 | 提示词就绪短语 | 稳定性备注 |
|---|---|---|
| 产品粒子 | `gold dust particles spiral from behind the logo, catch the backlight, then settle on the table` | 让 logo 与瓶子保持刚性。 |
| 能量 | `thin blue electrical arcs crawl along the cable, briefly illuminating fingerprints on the plug` | 让电弧附着于来源。 |
| 烟 | `cold white vapor rolls over the rim, sinks down the glass, and thins near the tabletop` | 描述密度与方向。 |
| 转变 | `paper edge chars inward from the corner, flakes curl and fall, final logo remains untouched` | 保护身份锚点。 |
| 天气 | `wind pushes rain diagonally across the frame, puddles ripple outward from each step` | 将天气绑定到表面。 |

## VFX 集成规则

每条片段使用一个主角特效。将来源锚定到清晰的物体或身体部位。让特效尊重重力、风、碰撞、反射与遮挡。对于面部、手部、logo 或文字附近的 VFX，让核心身份保持稳定并将特效放在其周围而非穿过它。

## 时序与消散

特效需要一个端点：沉降、褪色、蒸发、冻结、塌陷、辉光消失或留下残留。如果特效复杂，使用三步时序短语：`forms -> travels -> dissipates`。避免无后果的永久特效，因为它们常常变成嘈杂的叠加。

## 输出契约

返回 VFX 契约、稳定性约束与一个紧凑的提示词就绪短语。