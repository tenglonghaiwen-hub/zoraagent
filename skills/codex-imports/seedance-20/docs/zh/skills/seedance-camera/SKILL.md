<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-camera/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-camera
description: "This skill should be used when the user asks for camera movement, shot scale, lens feel, framing, one-take direction, dolly, pan, tilt, push-in, handheld, aerial, macro, or camera-transfer guidance for Seedance 2.0."
license: MIT
user-invocable: true
tags:
  - camera
  - cinematography
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

# seedance-camera

除非用户要求多镜头序列，否则每个短片段使用一个清晰的摄影机想法。最佳的摄影机方向具有开始画面、运动、速度、主体关系与端点。避免在同一五秒镜头中堆叠相互冲突的运动，例如无人机升起、滑动推镜、手持晃动与环绕。

加载 `[ref:quick-ref]` 获取提示词组装指引，`[ref:cinematography-shot-language]` 获取专业镜头契约，`[ref:directing-engine]` 从场景的单一意图推导运动，使其强化灯光、表演与声音而非与之竞争，以及当摄影机措辞必须多语言时加载 `[ref:vocab/zh]` 或 `[ref:vocab/ru]`。

## 意图

当用户询问摄影机时，他们其实在询问观众的身体站在哪里，以及观众从那里感受到什么。摄影机语法即共情机制：推镜是靠近，锁定画面是屏息。选择将观众置于用户感受所在的运动。

## 摄影机契约

陈述：景别、角度、运动、速度、主体关系与端点。提示词就绪的摄影机短语应在物理上可行并与主体动作绑定。

| 需求 | 强力短语 | 应避免 |
|---|---|---|
| 情绪领悟 | `slow dolly-in from medium close-up to tight close-up as Character A lowers the envelope` | `dramatic cinematic zoom` |
| 产品揭示 | `controlled slider move from silhouette to front three-quarter hero angle, ending on the label` | `dynamic product camera` |
| 尺度 | `low-angle crane up from boots to skyline, ending behind the character's shoulder` | `epic wide moving shot` |
| 不稳定 | `subtle handheld shoulder camera, small breathing sway, subject kept centered` | `shaky chaotic camera everywhere` |
| 精度细节 | `locked macro shot, focus stays on the watch gears while the second hand clicks once` | `cool close-up details` |

## 镜头与构图锚点

仅在镜头锚点能改善方向时使用：`24mm wide lens for spatial energy`、`35mm natural street perspective`、`50mm portrait compression`、`85mm shallow close-up` 或 `macro lens for material detail`。将镜头词与主体距离和动作配对；不要将镜头数字堆叠为装饰。

## 运动选择

对唇形同步、产品身份与精细 VFX 使用 **locked-off（锁定）** 镜头。对发现或领悟使用 **dolly-in（推镜）**。对旅行、追逐与产品动作使用 **tracking（跟踪）**。仅当主体能从所有侧面保持清晰时使用 **orbit（环绕）**。对尺度、抵达或揭示使用 **crane or drone（起重机或无人机）**。仅当写实比精度更重要时使用 **handheld（手持）**。

## 连续性规则

对多角色场景，将摄影机锚定到具名标签：`camera holds Character A in foreground while Character B crosses behind`。对 I2V，保持图像构图，除非用户明确希望重新构图。对于参考视频，陈述 `[Video1]` 是否传递摄影机运动、动作节奏或走位；不要让它传递身份，除非已授权。

对于复杂摄影机运动，视频参考通常比冗长的口头堆叠更有效。使用 `[Video1] controls camera rhythm only; do not transfer performer, room, logo, or identity`。

## 冲突规则

如果用户给出几个不兼容的运动，选择一个主要摄影机运动并将其他放入可选变体。如果镜头需要多个节拍，推荐拆分为单独的片段或按时间分段的提示词。

## 序列状态

当序列状态存在时，继承观察到的摄影机相位、屏幕方向、当前片段范围、连续性锁定、精确参考标签与保留的未来节拍，再选择运动。续拍摄影机短语必须从已接受源画面或观察到的结束状态开始；不要重启摇、跟焦或跟踪运动，除非有意下一镜头声明重置。

## 输出契约

返回选定的摄影机短语、它为何契合镜头、被移除的冲突、脆弱锚点、端点与一句提示词就绪的整合句。