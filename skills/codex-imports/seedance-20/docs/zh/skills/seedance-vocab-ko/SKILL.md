<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vocab-ko/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vocab-ko
description: "This skill should be used when the user asks for Korean Seedance 2.0 prompt wording, Korean cinematic vocabulary, or translation of camera, lighting, action, VFX, audio, and production terms into Korean."
license: MIT
user-invocable: true
tags:
  - korean
  - vocabulary
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

# seedance-vocab-ko

当用户要求韩语提示词措辞、双语交付、紧凑翻译或摄影机、灯光、动作、VFX、音频与约束的制作词汇时，使用韩语电影词汇。精确保留参考标签：`[Image1]`、`[Video1]`、`[Audio1]` 不得被翻译。

## 意图

韩语用户带来 감성 —— 一种具有苛求视觉品味的感受文化。这里的灵魂是让 감性 物理化：用户提供的每个情绪词都返回为他们能识别为恰好是他们感受的光、构图与时序。

## 使用规则

翻译制作意图，而非每个英文单词。让韩语提示词保持紧凑与具体：主体、动作、摄影机、光、声音与保持约束。

| 功能 | 韩语措辞 |
|---|---|
| Camera | `천천히 돌리 인`, `측면 트래킹 샷`, `고정된 중간 샷`, `로우 앵글`, `클로즈업` |
| Lighting | `역광`, `부드러운 창문 빛`, `따뜻한 실용 조명`, `차가운 달빛`, `림 라이트` |
| Motion | `천천히 돌아선다`, `프레임을 빠르게 가로지른다`, `물방울이 아래로 흐른다`, `연기가 얇게 퍼진다` |
| Audio | `조용한 환경음`, `짧은 대사`, `부드러운 금속음`, `음악 없음` |
| Constraints | `로고, 라벨, 형태를 정확히 유지한다` |

## 紧凑模式

`[Image1]은 참조 이미지이며 얼굴/제품 형태/로고를 정확히 유지한다. 변화는 [동작/조명/카메라]만 적용한다. 카메라: [한 가지 움직임]. 사운드: [음향 지시].`

## 反 slop 规则

当提示词依赖 `영화같은`、`감성적인`、`분위기 있는`、`웅장한` 或 `고퀄리티` 时，加载 `references/vocab/ko.md` 中的 Slop Traps 表并将每个分解为产生它的物理元素 —— 카메라 동사+속도+시점, 광원+방향+행동.

## 输出契约

返回韩语提示词措辞、有用时的可选英文注释，并保留未更改的参考标签。