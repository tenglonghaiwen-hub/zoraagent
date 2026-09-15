<!-- AUTO-TRANSLATED: 源文件 = ../../references/first-last-frame-guide.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 首帧/尾帧指南

last_verified: 2026-05-30

将本指南用于 FLF2V、首帧/尾帧过渡、中文 `首帧/尾帧` 或要求生成两幅图像之间动作的请求。

源边界：官方字节跳动材料支持多模态参考、剪辑、延长和 R2V 范例。火山引擎现已在其视频生成平台上记录首帧与尾帧角色。精确的 `FLF2V` 标签仍是产品平台词汇，因此在实施时使用活跃平台的字段名。

## 核心原则

首帧定义片段的起点。尾帧定义目标状态。提示词应仅描述过渡逻辑、摄影机行为、灯光连续性、音频意图以及什么必须保持不变。

## 参考角色

| 角色 | 英文措辞 | 中文措辞 | 俄文措辞 |
|---|---|---|---|
| 首帧 | `[Image1] is the first frame.` | `@图1 为首帧。` | `[Image1] как первый кадр.` |
| 尾帧 | `[Image2] is the last frame.` | `@图2 为尾帧。` | `[Image2] как последний кадр.` |
| 身份锁定 | `Preserve the same subject identity, outfit, shape, and scene logic.` | `保持同一主体、服装、形状和场景逻辑。` | `Сохранить того же персонажа, одежду, форму и логику сцены.` |
| 仅过渡 | `Generate only the motion between the two frames.` | `只生成两帧之间的连续动作。` | `Сгенерировать только переход между кадрами.` |

## 平台字段说明

| 平台 | 实用措辞 |
|---|---|
| 火山引擎/方舟 | 使用当前文档以核实 `first_frame`、`last_frame`、`image_with_roles`、时长、分辨率，以及视频/音频参考能否与首尾帧模式混合。 |
| Runway | 在 Runway 平台上使用 `promptImage` 位置如 `first` 或 `last`，并在假设与火山引擎字段对等前重新检查当前 API 文档。 |
| ComfyUI / 合作方工作流 | `FLF2V` 是有用的工作流简写，但仍需确认节点的精确输入与人脸/肖像策略。 |

## 提示词模板

```text
[Image1] is the first frame. [Image2] is the last frame.
Preserve [subject/product/character], [outfit/logo/shape], and scene layout.
Generate a continuous transition from [starting state] to [ending state].
Motion: [one physical action path].
Camera: [one controlled move or locked frame].
Lighting: [source and continuity].
Sound: [ambience/dialogue/SFX/music/silence].
Constraints: no new text, no watermark, no identity change, no object redesign.
```

## 产品安全过渡

`[Image1] is the first frame and [Image2] is the last frame. Preserve the bottle logo, label, glass shape, cap geometry, and color exactly. Only the condensation and light change: droplets gather at the shoulder, slide toward the label, and a narrow warm highlight travels left to right. Camera stays locked in a medium product shot. Sound: low room tone, one soft glass tick at the end.`

## 角色安全过渡

`[Image1] is the first frame and [Image2] is the last frame. Preserve the original character's face structure, hairstyle, jacket, and room layout. The character slowly stands from the chair, turns toward the window, and stops in the final pose. Camera: locked medium shot with a slight push-in. Lighting: same cool window light, warmer lamp glow at the end. Sound: quiet room tone and soft floor creak.`

## 转变方法

从业者现场观察的技法；在承诺结果前测试。当提示词点名两个端点状态加上持久载体 —— 经历变化并承载连续性的元素：logo、剪影、光源、摄影机位置 —— 转变会成功。

- 状态 A、状态 B 与载体：`the paper crane unfolds into a flat sheet; the red wax seal stays fixed at center frame throughout.`
- 让载体占据视线：观众追踪不变的元素，而其周围一切都在转变，从而隐藏中间帧的怪异。
- 困难情况拆解为首尾帧步骤：生成 A → 载体稳定的中点，然后将中点 → B 作为第二次 FLF2V 通过，再将它们剪在一起。
- 匹配剪辑变体：在剪辑中保持载体的屏幕位置与尺度，让周围交换。

## 常见失败

| 失败 | 修复 |
|---|---|
| 主体变形 | 仅锁定重要的身份锚点；移除额外的风格变化。 |
| 产品/logo 重画 | 使用锁定摄影机，并只说光线/天气变化。 |
| 跳切 | 加入"continuous transition"和一个物理动作路径。 |
| 摄影机混乱 | 用锁定画面或一次缓慢推镜取代多个运动。 |
| 结尾错过目标 | 声明 `[Image2]` 是最终视觉目标，而非仅氛围参考。 |