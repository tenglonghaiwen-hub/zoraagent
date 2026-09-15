<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-examples-ja/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-examples-ja
description: "This skill should be used when the user asks for Japanese Seedance 2.0 examples, Japanese prompt patterns, example rewrites, or safe versions of working Japanese video-generation prompts."
license: MIT
user-invocable: true
tags:
  - japanese
  - examples
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

# seedance-examples-ja

将日语范例用作母语提示词模式，而非翻译的英文模板。精确保留参考标签：`[Image1]`、`[Image2]`、`[Video1]`、`[Audio1]` 在日语句子中保持不变。

## 意图

日语范例应感觉像日本创作者能实际使用的制作笔记：礼貌处适宜，模型需要清晰处紧凑，且每种情绪都变得足够具体可成为构图、光、动作、声音或后期处理。

## 范例标签

| 标签 | 含义 |
|---|---|
| `safe` | 原创概念，无受保护身份。 |
| `needs-owned-reference` | 需要用户自有、已授权、公共领域或已批准资产。 |
| `surface-specific` | 取决于活跃的网页、API 或工作流平台。 |
| `rewrite-required` | 提及受保护身份、品牌、明星、精确场景、歌曲或人声。 |

## 安全范例模式

**产品 I2V：** `[Image1]を商品参照として使い、ロゴ、ラベル、形状、色を正確に維持する。変化は小さな水滴が表面を下へ流れる動きと、左から横切る柔らかい暖色光だけ。Camera: locked product close-up, slow push-in. Sound: quiet room tone, one small glass tick at the end.`

**肖像微表演：** `[Image1]の人物の顔、髪型、衣装、背景構図を保持。動きは小さく、一度まばたきし、視線を少し下げ、最後に控えめに微笑む。Camera: locked medium close-up, no reframing. Lighting: soft window light from frame right. Sound: quiet room tone.`

**序列 Clip 01：** `オリジナル人物Aが夜明けの駅ホームに入ってくる。目的は「誰かを待つ」と分かる最初の手がかりだけを見せる。Aは濡れた床を二歩歩き、折りたたまれた切符を見つけて拾わずに止まる。Camera: stable lateral tracking, medium-wide. このクリップでは列車到着や再会は見せない。`

**续拍：** `前の採用済みクリップの終点から続ける。Aは切符の二歩手前で止まっている状態から開始し、ゆっくりしゃがんで切符を拾い、遠くのアナウンスに反応して顔を上げる。前の入場動作を繰り返さない。Camera: locked medium shot, slight push-in.`

**对白：** `Character A sits at a cafe table in a locked medium close-up and softly says, "もう一度だけ。" セリフ中は頭を大きく動かさず、小さな口の動きだけ。Lighting: warm interior practical, cool rain reflection on wall. Sound: clear short dialogue, no music under the line.`

**无字幕本地化：** `9:16の日本向けSNSカット。商品は中央、端に重要な動きなし。画面内に生成文字、字幕、広告コピーを入れない。Post note: 日本語字幕、法務文言、CTAは編集で追加する。`

## 改写模式

如果提示词包含受保护名称，将创意功能重写为原创日语描述符：`有名キャラクターそのもの` 变为 `オリジナルの仮面をつけた屋上配達員`；`特定作品そっくり` 变为 `低彩度の夜景、硬いサイドライト、静かな演技、長焦点の圧縮感`。

## 输出契约

返回日语范例、标签、风险备注以及需要时的更安全日语变体。除非用户要求结构化输出，否则保持最终 Seedance 提示词文本为自然语言。