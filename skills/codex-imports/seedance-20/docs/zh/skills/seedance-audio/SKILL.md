<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-audio/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-audio
description: "This skill should be used when the user asks for Seedance 2.0 audio, dialogue, lip-sync, music, sound effects, ambience, beat-sync, audio-reference mapping, desync troubleshooting, or sound-driven visual timing."
license: MIT
user-invocable: true
tags:
  - audio
  - lip-sync
  - dialogue
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

# seedance-audio

将此用于对白、唇形同步、声音层、音乐、环境声、节拍同步、音频参考映射、去同步排错或声音驱动的视觉时序。音频应支撑可见节拍，而非成为第二个竞争的提示词。

加载 `[ref:audio-guide]` 获取音频模型行为方式、每语言对白承载力、语音参考唇形同步路径、节拍同步、去同步修复、音频参考冲突与多角色变通方法。当用户需要 stems、M&E、混音、响度、同步、混音或交付指引时，加载 `[ref:audio-post-delivery]`。

## 意图

每种情绪的一半通过耳朵进入，用户几乎总是忘记声音直到它的缺席让片段感觉死亡。这里的灵魂是在被询问之前给每个场景它的声音 —— 房间的呼吸，动作的证据，落地的台词。当他们听到时，他们意识到这始终是他们意思的一部分。

## 核心规则

保持对白简短、引述口语台词并将每行分配给具名说话者。对唇形同步优先锁定或稳定构图。移除嘴部准确性重要时的转头、大幅脸部动作、极端摄影机运动或繁忙的手势。视 `[Audio1]` 为节奏、速度、情绪、人声音色或环境声参考，除非活跃平台记录了精确播放行为；在接受口语人声参考的平台上，现场报告表明附加人声片段可直接驱动唇形同步 —— 模型同步到你的音频而非合成语音，这是非英语对白最可靠的现场报告路径，仅使用已授权人声。

可靠性是概率性的且依赖语言：现场报告将普通话排在唇形同步最强，英语紧随其后，日语、韩语、俄语与其他更弱。让非英语台词非常短或使用人声参考，并预算重拍而非承诺干净的发声镜头。见 `[ref:audio-guide]` 获取现场观察的每语言对白承载力表。

## 声音层模式

使用紧凑的层：`Dialogue: ... Sound: ... SFX: ... Music: ... Silence: ...`。仅包含重要的层。当沉默能强化戏剧或避免混淆唇形同步时，沉默是有效的。

| 需求 | 稳定音频方向 |
|---|---|
| 唇形同步 | `Character A, locked medium close-up, says "I found it." Clear dry dialogue, no head turn.` |
| 产品广告 | `Sound: low room tone. SFX: magnetic click on lid open, soft glass chime at final frame.` |
| 节拍同步 | `[Audio1] provides tempo only; light pulses and foot taps match the downbeat.` |
| 剧情 | `Distant rain and refrigerator hum; no music during the line.` |
| 动作 | `Breathing grows louder, shoe squeak at landing, metal door buzzer at endpoint.` |

## 多角色对白

当可靠性重要时在每段短片段中使用一名说话者。如果两个角色必须说话，分离回合并保持摄影机稳定：`Character A says... pause. Character B answers...`。对于复杂交流，推荐生成受控的单说话者片段并在后期合成。

## 失败修复

如果对白去同步，缩短台词、锁定摄影机、移除转头、清理音频角色并减少竞争音效。如果错误的说话者说话，分配标签并按说话者分割台词。如果音频被忽略，移除额外的音乐/音效指令并使参考角色显式。

如果音频与视频参考相互竞争，可能的话在上传前静音参考视频，或使优先级显式：`[Video1] controls camera only; [Audio1] controls tempo and energy`。

## 序列状态

当序列状态存在时，继承已完成对白、活跃对白、环境声、音乐相位、音效相位、当前片段范围、连续性锁定、精确参考标签与保留的未来节拍。除非用户明确要求重演，否则不要重复已完成对白。继续或有意改变音频相位，而非意外地重启它。

## 输出契约

返回说话者映射、引述对白、声音层、音频参考角色、唇形同步约束、后期/交付备注（若需要）与一个紧凑的提示词就绪音频块。