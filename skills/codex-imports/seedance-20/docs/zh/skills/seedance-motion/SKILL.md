<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-motion/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-motion
description: "This skill should be used when the user asks for body action, choreography, physics, object movement, movement timing, action continuity, stunt direction, or motion-reference mapping in Seedance 2.0."
license: MIT
user-invocable: true
tags:
  - motion
  - choreography
  - physics
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

# seedance-motion

使用物理动词与后果。动作应可在屏幕上观察、在片段内定时、并分配给主体或物体。偏好一个具有可见端点的强动作，而非几个相互竞争的模糊动作。

加载 `[ref:reference-workflow]` 获取视频动作参考，`[ref:shot-list-continuity]` 获取跨镜头动作交接，`[ref:examples-by-mode]` 获取安全剪辑、延长与 R2V 模式，当动作是表演时加载 `[ref:directing-engine]`：将场景的情绪转化为每节拍一个真实可见的姿态 —— 一个可演的动作带有目标和潜台词 —— 而非模型无法渲染的情绪词。

## 意图

动作是用户故事的动词 —— 他们来看的事情发生。这里的灵魂是后果：有开始、落地并改变某事的动作感觉真实生活；循环的动作感觉生成。每个动作将故事向前推一个节拍，否则它不属于这条片段。

## 动作契约

陈述：演员/物体、动作、力量级别、时序、物理后果、连续性要求与端点。

| 动作类型 | 强力短语 | 弱短语 |
|---|---|---|
| 微妙表演 | `Character A inhales, grips the cup tighter, then sets it down without looking away` | `she feels nervous` |
| 产品材质 | `condensation beads gather, merge, and slide down the bottle neck` | `the product looks refreshing` |
| 编排 | `Character B ducks under the swinging bag, pivots left, and stops in a guarded stance` | `fast action fight scene` |
| 物体物理 | `paper receipt lifts in the fan breeze, flips once, and lands face-up` | `papers move dynamically` |
| 环境动作 | `rain streaks diagonally across the backlight while puddle ripples spread from footsteps` | `stormy weather atmosphere` |

## 物理优先模式

官方材料声称强物理；通过写入原因并让模型计算后果来提取它（现场观察强调 —— 在承诺结果前测试）。陈述质量、力量与材质，然后命名摄影机可见的一个后果：`the heavy oak door swings shut and the candle flames bend toward it` 胜过 `the door closes dramatically`。后果证明动作：重量在落地压缩中显示，动量在过冲和恢复中，摩擦在滑行长度中，风在它置换的物体中。一个物理原因加两到三个可见后果比三个独立动作读起来更强。

## 时序模式

对短片段使用三节拍结构：建立、动作、改变的结束状态。范例：`0-2s: candle flame steady; 2-4s: door opens and flame bends; 4-6s: smoke trail curls toward the hallway`。时间分段对动作、VFX、唇形同步与产品演示有用，但除非用户真正需要，否则避免逐帧过载。

当声音驱动动作时，将每个可见变化与一个节拍或音效配对：`door click at 2s, light pulse on the downbeat, hand releases the cup on the final chime`。不要在一段短片段中要求许多剪辑、地点与微动作。

## 参考动作规则

对参考画面，仅使用自有、已授权、公共领域、素材库、动捕、排练或自录的素材。将 `[Video1]` 映射到动作、摄影机、时序或走位，而非身份，除非身份已授权。如果参考包含真实人物，仅传递一般动作或摄影机行为并显式排除肖像传递。

## 稳定规则

当过多动作发生时，手、脸、logo 与产品几何会漂移。在脆弱细节周围减少动作：为唇形同步锁定摄影机，让手保持简单姿态，要求产品部件保持刚性，并移动光或环境而非核心身份锚点。

## 序列状态

当序列状态存在时，继承观察到的动作相位、开放动作向量、当前片段范围、连续性锁定、精确参考标签与保留的未来节拍。不要重演标记为已发生或已完成的动作。不要提前执行保留的节拍；将未完成的动作从已接受结束状态带入下一片段。

## 输出契约

返回动作短语、时序模式、参考角色映射（若有）与修复后的提示词语言。