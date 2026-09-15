<!-- AUTO-TRANSLATED: 源文件 = ../../../references/migrated/seedance-audio-original.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# `seedance-audio` 的旧版体

于 2026-04-27 在 v5.1.0 期间迁移。除非在 `references/api-status.md` 或 `references/source-registry.md` 中确认，否则将本文件中的平台、策略、API 与安全声明视为旧版。

---

# seedance-audio

针对 **Seedance 2.0 视频生成** 的音频设计、唇形同步与多角色对白。

> **来源情报**：字节跳动官方 Seedance 2.0 发布博客（seed.bytedance.com）、抖音创作者社区、CSDN 从业者教程、2026 年 Q1。西方来源很少有真实世界数据。

---

## ⚠️ 关键区别：即梦平台上的两个独立工具

即梦平台托管**两个完全不同的工具**，都涉及唇形同步。混淆两者是最常见的文档错误。

| 工具 | 模型 | 找到位置 | 作用 |
|---|---|---|---|
| **视频生成** | **Seedance 2.0** | 即梦 → 视频生成 → Seedance 2.0 | 生成本机音视频联合生成的完整视频片段（4–15 秒）。音频是生成输出的一部分。 |
| **数字人** | **OmniHuman-1** | 即梦 → 数字人 | 肖像动画工具 —— 上传面部图像 + 音频 → 生成精确唇形同步的说话头像。有大师/快速/标准模式。 |

**本技能仅涵盖 Seedance 2.0 视频生成。**
大师模式（大师模式）、快速模式、标准模式与 OmniHuman-1 引擎都属于**数字人工具** —— 而非 Seedance 2.0。不要在此处引入那些概念。

---

## 范围

- Seedance 2.0 原生音频生成架构
- 音频参考输入系统（节奏、情绪、节拍、唇形同步）
- 视频生成提示词中的对白规范与唇形同步
- 多角色唇形同步：已确认的问题与已知变通方法
- 已知失败模式与现场测试的修复
- 平台音频约束（格式、时长、文件限制）
- 暂停的功能（2026 年 2 月执行）
- 声音层设计
- 节拍同步（卡点）技巧
- 声音驱动的视觉时序

## 范围外

- 数字人（数字人）功能及其大师/快速/标准模式 → 单独工具
- OmniHuman-1 → 单独模型，单独功能
- 冲击 VFX 物理 → 见 [skill:seedance-vfx]
- 音乐驱动的摄影机剪辑 → 见 [skill:seedance-camera]
- 版权执行 → 见 [skill:seedance-copyright]

---

## Seedance 2.0 音频如何工作

对大多数用例，**用自然语言描述你想要的声音。** 模型理解声音概念。

- `The scene is silent except for the sound of wind.`
- `A heavy metal track plays.`
- `The sword makes a "shing" sound when drawn.`

仅在精确唇形同步或 MV 节拍匹配时使用 `@Audio1` 参考。

Seedance 2.0 使用**统一多模态音视频联合生成架构**（统一多模态音视频联合生成架构）。音频与视频一起生成 —— 而非作为单独的通过。这是它与更老的视频模型的核心架构差异。

**模型自动生成的内容：**
```
Ambient audio:     environmental sounds matched to visual scene
Background music:  mood-appropriate score matched to visual content  
Sound effects:     event-locked sounds (footsteps, impacts, etc.)
Dialogue:          natural speech with lip-sync when characters talk in the prompt
```

**音频参考输入的作用：**
当你将 MP3 作为 `@Audio1` 上传时，你提供了一个**参考**，影响：
- 视觉剪辑的节奏与速度
- 生成音频的情绪与色调特征
- 节拍同步剪辑时序
- 对话生成与唇形同步的声音/语音参考

音频输入**不保证**模型会不变地播放你上传的确切音频 —— 它将该文件视作参考，而非播放轨道。（参见失败模式 1 获取需要精确音频保持时的变通方法。）

---

## 平台音频约束（硬限制）

违反这些会导致无错误消息的静默失败。

```
Format:       MP3 only.
              WAV, AAC, OGG, FLAC, M4A 接受但无错误，
              但不产生唇形同步或静默失败。#1 静默失败原因。
Duration:     ≤ 15 seconds per audio file. Hard limit.
              Optimal range: 3–8 s for best lip-sync accuracy.
File budget:  Max 3 audio clips per generation (part of the Rule of 12).
Bitrate:      128–320 kbps recommended. Below 64 kbps degrades sync.
Size:         ≤ 10 MB per file.
Noise:        Background noise in audio degrades phoneme recognition.
              Use clean, noise-free recordings.
```

---

## 对白与唇形同步

Seedance 2.0 通过两条路径生成唇形同步：

**路径 1 —— 文本驱动对白**（最可靠）：
```
Character A says: "We leave at dawn."
Framing: medium close-up, locked-off camera.
Character lips match the dialogue naturally.
```

**路径 2 —— 音频驱动**（音频驱动）：
```
Upload MP3 audio as @Audio1.
In prompt: "Lip-sync matches @Audio1 exactly. Camera: medium close-up, locked."
```

**可靠唇形同步的关键规则：**
- 让台词简短。长对白会降级视觉稳定性。
- 将对白放在引号中：`Character says: "We leave at dawn."`
- 指定构图：`medium close-up, locked-off camera`
- 移除头部/脸部动作词（点头、转头、摇头）—— 它们与唇引擎竞争
- 用时序指定停顿：`"brief pause at 2s, then continues"`

---

## ⚠️ 多角色唇形同步：官方未解决

字节跳动自己的官方 Seedance 2.0 发布博客明确指出：

> **"Seedance 2.0 仍需继续解决多人口型匹配、偶现音频失真等问题"**
> 翻译："Seedance 2.0 仍需继续解决多人唇形同步匹配与偶发音频失真问题。"

这不是社区抱怨。这是 Seedance 团队官方的承认。多人单次生成唇形同步截至 2026 年 Q1 仍是**公开未解决的问题**。

**多人实际发生的情况：**
- 模型可能仅动画一个角色的嘴
- 两个角色可能产生混乱或不对齐的嘴部动作
- 两个角色之间的音频路由不可靠
- 即使使用相同提示词，结果也不一致

**变通方法：单独生成 + 合成**

这是抖音创作者使用的现场测试解决方案：

```
STEP 1 — Split dialogue audio by character
  Character A lines → CharA.mp3 (≤8 s each segment, MP3, 128–320 kbps)
  Character B lines → CharB.mp3 (≤8 s each segment, MP3, 128–320 kbps)

STEP 2 — Generate each character separately
  Generation 1: Character A reference image + CharA audio segment 1
    Prompt: "Medium close-up, locked camera. Character A speaks.
             Lip-sync matches @Audio1 exactly. No head rotation."

  Generation 2: Character B reference image + CharB audio segment 1
    Prompt: "Medium close-up, locked camera. Character B listens,
             expression engaged but mouth closed."

  Generation 3: Character B reference image + CharB audio segment 2
    Prompt: "Character B speaks. Lip-sync matches @Audio1. Same framing."

  ...repeat for each dialogue exchange.

STEP 3 — Composite in CapCut / Jianying / Premiere
  - Place both character clips in a PiP (picture-in-picture) layout
  - Apply Linear Mask between the two figure positions
  - Set feather: 15–20% to avoid hard edges
  - When A speaks: A layer = generated video / B layer = static original image
  - When B speaks: swap layers
  - Silent character uses still image = zero extra generation credits
```

**为何有效：**
每次生成只有一个脸 → 干净的音频路由 → 可靠的同步。
合成交换创建双向对话的错觉，而模型永远不需要同时处理两个嘴。

---

## 已知失败模式与修复

这些失败模式记录于抖音/B 站创作者社区报告、2026 年 Q1 以及字节跳动官方评估。

### 失败 1：模型重写或替换上传的音频（音频被乱改）

**症状**：你上传自己的 MP3；生成的视频播放完全不同的音频 —— 模型已替换或更改了你的内容。

**原因**：当 Seedance 的原生音频生成引擎检测到它知道如何生成的音频（环境、音乐、音效）时，可以覆盖参考。模型将音频输入视作参考信号，而非播放指令。竞争的动作词会放大此行为。

**修复（抖音创作者现场测试 —— 时间戳反向套路法）：**
```
Fix A — Explicit preservation instruction:
  Add to prompt: "Audio @Audio1 plays exactly as uploaded from 0s to end.
                  Do not modify or replace the audio content."

Fix B — Remove competing audio tokens:
  Strip all ambient/SFX/music tokens from the prompt.
  Do not write: "background rain", "jazz music", "street noise"
  These invite the native audio engine to take over.

Fix C — Simplify:
  Reduce prompt to under 50 words total.
  Complex prompts increase the chance of audio substitution.
```

### 失败 2：唇形同步去同步 / 嘴部错位

**原因与修复：**
```
Cause: Audio too long (>10 s is the practical ceiling, not 15 s)
Fix:   Trim to 3–8 s for best results. The 15 s limit is technical maximum,
       not the sweet spot.

Cause: Noisy audio (background music, reverb, crowd noise in the MP3)
Fix:   Clean the audio before uploading.
       Remove background noise, reverb, and crowd sound.

Cause: Fast speech rate
Fix:   Record at ~80% of natural speaking pace. Slightly slower = better sync.

Cause: Head/face motion tokens in prompt
Fix:   Remove "nodding", "turning head", "looking away" — these compete
       with the phoneme engine. Use "locked camera, neutral expression".

Cause: Multi-speaker audio uploaded for single-character generation
Fix:   Always split audio by speaker before uploading. Never upload a
       conversation track and expect one character to lip-sync it.
```

### 失败 3：多角色唇形同步破缺

**根因**：Seedance 2.0 中已确认的公开问题（字节跳动官方承认，2026 年 2 月）。

**修复**：使用上述单独生成 + 合成工作流。永远不要在单次生成中尝试双角色唇形同步。

### 失败 4：静默音频格式失败

**症状**：上传成功，无错误，但输出无唇形同步或通用生成失败。

**原因**：文件不是 MP3。WAV、AAC、OGG、FLAC、M4A 全部静默失败。

**修复**：在上传前转换为 MP3（128–320 kbps，≤15 秒，≤10 MB）。
```
FFmpeg command: ffmpeg -i input.wav -codec:libmp3lame -b:a 192k output.mp3
```

### 失败 5：偶发音频失真

**状态**：字节跳动在 Seedance 2.0 发布说明中官方承认。不可预测。社区尚未记录可靠的预防方法。

**当前缓解**：如果发生音频失真，重生。社区测试中更短的片段（4–6 秒）显示较低的失真率。

### 失败 6：音频超过 15 秒 → 失败或截断

**修复 —— 分段生成流水线：**
```
1. Split audio at natural pause points into 3–8 s segments (not 15 s slices)
2. Each segment becomes one generation
3. Use the same character reference image across all segments
4. Maintain identical framing, lighting, camera angle in the prompt
5. Stitch in CapCut/Jianying with 0-frame cuts (dissolves break lip continuity)
```

### 失败 7：声音克隆 / Face-to-Voice 功能

**状态**：2026 年 2 月暂停（字节跳动执行 —— 隐私/版权）。未宣布恢复时间表。

**当前替代方案：**
- 使用外部 TTS 工具（ElevenLabs、Minimax TTS 等）生成清晰的语音 MP3
- 将该 MP3 作为音频参考上传

### 失败 8：真实人物面部上传被屏蔽

**状态**：2026 年 2 月 15 日起屏蔽（字节跳动执行）。

**变通方法：**
- 首先生成 AI 角色插画（使用即梦图像生成）
- 使用该插画作为角色参考
- 不要上传真实人物的照片

---

## 声音层结构

Seedance 2.0 联合生成音频与视频。音频层即使未明确指定也会影响速度与剪辑感觉。

```
Ambient bed:      continuous environmental sound
Foreground SFX:   1–2 event-locked sounds
Music cue:        entry time + arc (rising / falling / steady)
Silence design:   deliberate absence — where silence matters most
```

**紧凑语法：**

```
Sound: rain bed + distant train hum.
SFX: chess piece click at 2s.
Music: low piano note enters at 3s, resolves on last frame.
Silence holds final 0.5s.
```

---

## 混音意图

```
Dialogue scene:   dialogue clean and prominent, music low, ambient subtle
Music-driven:     music leads, ambient secondary, no dialogue
SFX-driven:       environmental sounds prominent, no music
Action:           layered SFX prominent, music rhythmic, no dialogue
Atmospheric:      ambient dominant, sparse SFX, no music or faint drone
```

---

## 对白提示词语法

**单角色：**
```
Character A (deep male voice) says: "I told you not to come here."
Framing: medium close-up, locked-off camera.
Lip-sync matches @Audio1 exactly. No head rotation.
```

**双角色（单独生成 —— 见合成工作流）：**
```
Generation 1 (Character A's turn):
  Character A says: "I told you not to come here."
  Character B listens silently, expression neutral.
  [Use Character A reference image only]

Generation 2 (Character B's turn):
  Character B says: "You didn't leave me a choice."
  [Use Character B reference image only]
```

**时间戳锚定：**
```
At 0s: character begins speaking quietly.
At 2s: brief pause, character looks down.
At 4s: character resumes with urgency.
Lip-sync follows @Audio1 throughout.
Camera locked, no head rotation.
```

---

## 多语言生成

```
Character speaks in Mandarin: "[dialogue]"
Character speaks in English: "[dialogue]"
Character speaks in Cantonese: "[Cantonese dialogue]"
Character speaks in Sichuan dialect: "[dialect text]"
Character speaks in Japanese: "[dialogue]"
Character speaks in Korean: "[dialogue]"
```

确认支持方言，包括中国地区方言。支持 8+ 种语言。

**最佳实践**：使用与提示词中书写语言匹配的音频参考。

---

## 节拍同步 / 卡点 技巧

对于音乐同步的视觉剪辑：

1. 上传场景图像 + 一段音乐参考音频/视频
2. 提示词：

```
@Image1 through @Image6 are scene images.
@Audio1 provides rhythm and beat reference.
Cut scene transitions on musical downbeats.
Characters move with energy matching the music tempo.
Visual pacing: fast during chorus, slower during verse.
```

**节拍同步最佳实践：**
- 5–7 张场景图像效果最佳（更多 = 更多剪辑 = 更复杂的编排）
- 使用清晰有节奏的音频（非环境或氛围曲目）
- 较短的片段（4–8 秒）比 15 秒片段对节奏精度更可靠
- 节拍同步与对白同步在一次生成中互斥 —— 永远不要混合两者

---

## 声音驱动的时序

使用音频提示词锚定视觉事件：

```
Sound: thunder crack at 3s.
Visual: lightning illuminates the scene exactly at the thunder crack.
Character flinches at the sound.
```

---

## 智能体陷阱

1. **仅 MP3，永远。** WAV/AAC/OGG/FLAC/M4A 全部静默失败。无错误消息。
2. **每段最大 15 秒。最佳点是 3–8 秒。** 同步质量在 10 秒后下降。
3. **多角色唇形同步官方未解决。** 字节跳动如此说。使用合成。
4. **模型将音频视作参考，而非播放。** 如果你需要精确音频保持，使用时间戳锚定。
5. **干净的音频 = 更好的同步。** 嘈杂源显著降级音素识别。
6. **放慢语音。** 比自然语速稍慢提升同步精度。
7. **移除头部动作词。** "点头"、"转头"与唇引擎竞争。
8. **声音克隆已暂停**（2026 年 2 月）。改用外部 TTS。
9. **真实面部上传被屏蔽**（2026 年 2 月）。使用 AI 生成的角色艺术。
10. **节拍同步与对白在同一提示词中互斥。**
11. **更短的片段 = 更好的同步。** 在自然停顿处分割长对白，而非任意切割。
12. **跨片段保持一致的构图/灯光** 使拼接片段不可见地剪辑。
13. **偶发音频失真是已知 bug。** 发生则重生。
14. **大师/快速/标准模式在 Seedance 2.0 中不存在。** 那些属于单独的数字人（OmniHuman-1）工具。