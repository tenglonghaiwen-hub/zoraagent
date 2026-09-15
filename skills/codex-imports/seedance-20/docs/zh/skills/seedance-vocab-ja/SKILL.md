<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vocab-ja/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vocab-ja
description: "This skill should be used when the user asks for Japanese Seedance 2.0 prompt wording, Japanese cinematic vocabulary, or translation of camera, lighting, action, VFX, audio, and production terms into Japanese."
license: MIT
user-invocable: true
tags:
  - japanese
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

# seedance-vocab-ja

当用户要求日语提示词措辞、双语交付、紧凑翻译或摄影机、灯光、动作、VFX 与音频的制作词汇时，使用日语电影词汇。精确保留参考标签：`[Image1]`、`[Video1]`、`[Audio1]` 保持英文括号。

## 意图

用日语工作的用户通常最贴近该模型乐于渲染的动漫传统。服务两种语域 —— 礼貌塑形的自然句与制作术语 —— 并让词汇感觉是母语的，永远不是翻译的。

## 使用规则

偏好简洁的制作日语而非字面翻译。保持结构可读：主体、动作、摄影机、灯光、声音与保持约束。

| 功能 | 日语措辞 |
|---|---|
| Camera | `ゆっくりドリーイン`, `横移動のトラッキング`, `固定の中景`, `低いアングル`, `クローズアップ` |
| Lighting | `逆光`, `柔らかい窓光`, `暖かい実用照明`, `冷たい月明かり`, `輪郭光` |
| Motion | `ゆっくり振り返る`, `画面を素早く横切る`, `水滴が下へ流れる`, `煙が薄く広がる` |
| Audio | `静かな環境音`, `短い台詞`, `金属音`, `音楽なし` |
| Constraints | `ロゴ、ラベル、形状を正確に維持する` |

## 紧凑模式

`[Image1]を参照として、被写体の顔/商品形状/ロゴを正確に維持する。変化は[動き/光/カメラ]のみ。カメラ：[一つの動き]。音：[音声指示]。`

## 反 slop 规则

当提示词依赖 `映画のような`、`エモい`、`雰囲気のある`、`壮大な` 或 `高画質` 时，加载 `references/vocab/ja.md` 中的 Slop Traps 表并将每个分解为产生它的物理元素 —— 動作動詞＋速度＋視点、光源＋方向＋挙動。

## 输出契约

返回日语提示词措辞、有用时的可选英文注释，并保留未更改的参考标签。