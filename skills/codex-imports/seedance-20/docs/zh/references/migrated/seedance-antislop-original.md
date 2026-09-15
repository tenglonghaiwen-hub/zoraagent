<!-- AUTO-TRANSLATED: 源文件 = ../../../references/migrated/seedance-antislop-original.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# `seedance-antislop` 的旧版体

于 2026-04-27 在 v5.1.0 期间迁移。除非在 `references/api-status.md` 或 `references/source-registry.md` 中确认，否则将本文件中的平台、策略、API 与安全声明视为旧版。

---

# seedance-antislop

杀死空洞语言。每个词必须赢得其位置。

---

## 什么是 AI Slop？

**AI Slop** 是*感觉*描述性但包含零可测量指令的语言。
它是训练数据平均化的残留物 —— 在文本语料中出现在"好视频"附近但未告诉模型任何它不能已假设的词。

**AI Hum** 是 AI 系统默认添加的自夸叙述层：
*"Certainly! Here is a stunning, cinematic, breathtaking, high-quality prompt that masterfully captures..."*

两者都会降级输出。Slop 浪费 token 预算。Hum 触发通用模式。

**Platform Slop** 是第三种类型：泛化的、对所有观众安全的样板文本，AI 为避免拒绝而插入。当创作者想要故事驱动的内容时，它会产生一段"猫在凌晨 3 点弹钢琴"的片段。这是 2026 年 2 月内容过滤收紧后创意用户的主要失败模式。

---

## 唯一测试

> **"摄影机、光度计或秒表能测量这个吗？"**

能 → 保留。
不能 → 删除或替换为可测量的东西。

| 词 | 可测量？ | 裁决 |
|---|---|---|
| `cinematic` | 否 | ❌ 删除或替换 |
| `45° key light camera-left` | 是 | ✅ 保留 |
| `stunning` | 否 | ❌ 删除 |
| `slow push-in over 6 s` | 是 | ✅ 保留 |
| `epic` | 否 | ❌ 删除或分解 |
| `18mm wide, dolly back 3 m` | 是 | ✅ 保留 |
| `8K ultra-real` | 否 | ❌ 删除 |
| `stable exposure, clean edges` | 是 | ✅ 保留 |

---

## 主 Slop 黑名单

看到这些词立即删除。它们是**不可测量的填充词**，会触发通用输出。

### 最高级加成词
`stunning` · `breathtaking` · `incredible` · `amazing` · `beautiful` · `gorgeous` · `magnificent` · `spectacular` · `extraordinary` · `phenomenal` · `jaw-dropping` · `mind-blowing`

### 质量断言
`masterpiece` · `award-winning` · `professional` · `ultra-high-quality` · `top-quality` · `world-class` · `best-in-class` · `premium quality`

### 分辨率剧场
`8K` · `4K ultra HD` · `super resolution` · `hyper-detailed` · `insanely detailed` · `extreme detail` · `photorealistic`（当用作加成词而非具体风格目标时）

### 模糊美学声明
`cinematic` · `epic` · `dramatic` · `artistic` · `creative` · `unique` · `immersive` · `captivating` · `engaging` · `compelling`

### AI 自夸（Hum 层 —— 完全移除）
`certainly` · `of course` · `here is` · `I will now create` · `masterfully` · `expertly crafted` · `carefully designed` · `thoughtfully composed` · `beautifully rendered`

### 空洞氛围词
`magical` · `ethereal` · `transcendent` · `otherworldly` · `surreal`（除非超现实主义是有意风格） · `mystical` · `enchanting` · `whimsical`（除非童话是目标）

### 冗余强调
`very` · `really` · `truly` · `so` · `extremely` · `super` · 当 `highly` 在任何描述词前时

### 平台安全 Slop（新增 —— 2026 年 2 月）
这些由过度谨慎的避免过滤模式添加。它们使内容平淡且通用：
`family-friendly` · `safe for all ages` · `fun and lighthearted` · `wholesome` · `uplifting` · `positive` · `heartwarming` —— **除非这些实际上是你的创作意图。**

---

## 分解模式

当一个 slop 词被移除时，用可观察组件替换它。

### `cinematic` → 分解为：

```
❌  cinematic lighting
✅  single hard key 45° camera-left, amber gel, deep shadow camera-right, no fill
```

```
❌  cinematic shot
✅  slow dolly push-in from MS to CU over 8 s, anamorphic 2.39:1, shallow DOF
```

```
❌  cinematic color
✅  teal shadows, orange-amber midtones, desaturated highlights, slight crush in blacks
```

### `epic` → 分解为：

```
❌  epic battle scene
✅  wide establishing shot, 200 soldiers clashing on a muddy plain,
    handheld low-angle, dramatic brass swell, slow-motion at impact 0.3×
```

```
❌  epic landscape
✅  extreme wide shot, mountain range at dusk, god rays through cloud break,
    drone descending from 800 m to 50 m over 12 s
```

### `stunning` → 删除，然后强化名词：

```
❌  stunning sunset
✅  sunset, golden-red horizon, 5 min after sun has dipped, long shadows,
    warm backlight 3200K, silhouette of tree line
```

### `beautiful` → 指定哪种属性是有吸引力的：

```
❌  beautiful woman
✅  woman, sharp cheekbones, calm expression, direct eye contact — [then add lighting that serves her]
```

### `8K ultra-real` → 替换为输出契约：

```
❌  8K ultra-real photorealistic
✅  stable exposure, no flicker, clean edge definition, no hallucinated geometry
```

### `masterpiece` → 完全移除：

```
❌  create a masterpiece video of a flower blooming
✅  flower blooming timelapse. Macro push-in. Soft diffused daylight. No camera movement.
```

### `ethereal` → 指定光学原因：

```
❌  ethereal forest scene
✅  forest, heavy morning fog, shafts of diffused light through canopy,
    floating dust motes, cool teal cast, static wide shot
```

### `magical` → 指定效果：

```
❌  magical atmosphere
✅  floating glowing particles, slow upward drift, warm amber light source below frame,
    gentle lens flare at 3 s
```

### `dramatic` → 分解为张力触发器：

```
❌  dramatic lighting
✅  hard single key from 60° above camera-left, deep shadow fill ratio 1:8, no bounce

❌  dramatic scene
✅  two figures, 1.5 m apart, both still. Static camera. Wind lifts coat at 3 s.
    No dialogue. Low-frequency drone audio.
```

---

## 之前 / 之后：完整提示词修复

### 范例 1 —— 产品广告

```
❌  Create a stunning, cinematic, ultra-high-quality advertisement for our amazing
    perfume bottle. Make it look incredibly beautiful and photorealistic. 8K quality.
    Breathtaking lighting. Masterpiece level.

✅  Glass perfume bottle on white marble. Camera slow orbit 90° over 8 s.
    Soft studio key top-left, rim light rear-right. Macro DOF on label.
    No text. No people.
```

*移除：* 14 个 slop token。*获得：* 3 条可测量的灯光指令，1 条摄影机路径，2 条约束。

---

### 范例 2 —— 动作场景

```
❌  An epic, breathtaking, jaw-dropping fight scene between two amazing warriors
    in a stunning mystical forest. Ultra-cinematic. World-class choreography.
    Make it feel truly extraordinary and immersive. 4K masterpiece.

✅  @Image1 warrior A (dark armour). @Image2 warrior B (white cloth).
    A charges → B sidesteps → B counter-kick to A's chest → A stumbles into tree.
    Ancient forest, fog, shafts of light. Handheld low-angle, whip-pan at impact 4 s.
    0–4 s real-time; 4–6 s 0.3× slow-motion; 6–10 s real-time.
    Impact sfx at 4 s, ambient forest wind throughout.
```

*移除：* 16 个 slop token。*获得：* 完整编排、时序、摄影机运动、音频提示。

---

### 范例 3 —— 情绪片段

```
❌  A truly magical, ethereal, incredibly beautiful scene of a woman walking
    through an enchanting, mystical forest at night. Stunning visuals. Cinematic masterpiece.

✅  Woman in white dress walks slowly through night forest.
    Bioluminescent ground plants, cool blue ambient light, breath visible.
    Steadicam follow from behind, medium shot, slow pace.
    Quiet footstep sfx, distant owl, no music.
```

*移除：* 12 个 slop token。*获得：* 具体光源、呼吸可见性、摄影机装备、音频设计。

---

### 范例 4 —— 建筑

```
❌  Showcase our amazing, breathtaking, world-class skyscraper in a stunning
    cinematic drone shot. Ultra-high quality. Make it look absolutely incredible
    and awe-inspiring.

✅  Glass tower, 60 floors. Drone approach from south-east, altitude 300 m,
    slow descent to 80 m over 12 s. Golden hour, warm side light.
    Lens flare at apex. No people. No text.
```

---

### 范例 5 —— 中文提示词修复

```
❌  美丽的、震撼的、史诗级的、超高质量的、电影感十足的、令人叹为观止的视频

✅  女性独自走在雨夜街道。霓虹反光，湿地面。
    缓慢跟拍，中景，肩后视角。
    雨声环境音，远处钢琴。低饱和蓝绿色调。
```

---

### 范例 6 —— 音频被忽略的失败（来自 10,000 次生成研究的现场数据）

从业者研究中顶级失败模式之一：零音频规范的提示词会产生平淡、无生命的结果，无论视觉质量如何。

```
❌  Person walking through forest
    [no audio spec → model fills with generic ambient wash]

✅  Person walking forest.
    Audio: leaves crunching underfoot, distant bird calls, gentle wind through branches.
    No music. Natural ambience only.
```

音频上下文使 AI 视频感觉真实，即使视觉上明显是 AI 生成的。
始终指定：环境层 + 音效 + 音乐/安静决策。

---

### 范例 7 —— 首帧 slop

首帧描述中的 slop 是单一最高影响的失败向量。模型严重加权前 20–30 个词。第 1 位的 slop 毒化整个生成。

```
❌  "A beautiful, cinematic, high-quality, stunning establishing shot of..."
    [全部 slop，无信息，模型从前 8 个词获得 0 指令]

✅  "Glass tower, 60 floors, south-east face, sunset side light."
    [5 个词的实际信息，模型具有强首帧锚点]
```

> **规则**：永远不要让 slop 词占据前 20 个 token 中的位置。