<!-- AUTO-TRANSLATED: 源文件 = ../../references/i2v-guide.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 图生视频指南

## 核心规则

只提示图像无法呈现的内容。一张静图已经包含主体身份、产品形态、服装、调色、构图和背景。重新描述这些静态细节常常导致漂移。添加动作、摄影机、时序、转变、灯光变化、音频和保持性约束。

## 最小模板

`[Image1] is the reference; preserve [identity/product/scene] exactly. Only [motion] changes. Camera: [one move]. Lighting: [source or transition]. Sound: [cue]. Constraint: [what must not change].`

## 两种 I2V 模式

来自中文实践的现场观察；在动笔前决定模式。

- **保持模式**（图像即为此刻）：将三或四个自然的微动作分散到整个片段 —— 一次眨眼、一口呼吸、头发飘动、缓慢的视线转移 —— 并用双重语句锁定其余，正面加负面：`she stays seated by the window; she does not stand, turn, or leave frame`。无摄影机运动，或最多一次缓慢推镜。
- **反应模式**（有事发生在主体身上）：将一种情绪展开为有时间落地的子节拍 —— `she registers the sound, her eyes widen, color rises in her face over two to three seconds`。仓促的情绪读作故障；给关键节拍至少两秒。如果图像明显是场景中段而非自然开场帧，显式锚定起点：`the clip begins exactly at this moment`。

## 保持性语言

对脆弱锚点使用精确锁定：`preserve face identity`、`preserve logo and label`、`preserve bottle shape and cap geometry`、`preserve outfit and hairstyle`、`preserve room layout`。如果场景需要自然动作，不要全部锁定；只锁定必须保持稳定的内容。

## 良好的 I2V 增量

| 增量 | 范例 |
|---|---|
| 微表情 | `subject blinks once and lowers their eyes` |
| 产品光 | `thin highlight travels across the label` |
| 天气 | `rain streaks behind the subject; droplets bead on the surface` |
| 摄影机 | `slow dolly-in from current composition to tighter detail` |
| 氛围 | `dust catches the doorway beam and settles` |
| 音频 | `soft room tone, one key click at the endpoint` |

## 失败修复

- 如果身份漂移：减少新的视觉描述，加强保持性约束。
- 如果摄影机跳跃：使用一次有起点和终点的摄影机运动。
- 如果产品变形：声明保持、静态身份，无形状变化，无产品变形。
- 如果输出静止：添加一个物理动作和一个时间提示。
- 如果背景变化：保持环境布局，仅动画化光线、天气或氛围。
- 如果手部变形：简化手部动作或将手保持在主要动作之外。