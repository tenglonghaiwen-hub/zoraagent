<!-- AUTO-TRANSLATED: 源文件 = ../../../examples/golden-prompts/first-last-frame-transition.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 黄金提示词：首尾帧过渡

## 来源简报

从一个已知的产品状态移动到另一个。

## 内部提示词规范

Mode: FLF2V. `[Image1]` 是首帧。`[Image2]` 是最终视觉目标。无不相关故事节拍。

## 编译的自然语言提示词

[Image1] is the first frame and [Image2] is the final visual target. Preserve the same product identity, logo, label, and tabletop geometry. Generate only the continuous transition: condensation forms on the bottle, slides once down the front glass, and stops with the product aligned exactly to [Image2]. Camera remains locked; sound is a single soft glass tick at the endpoint.

## Lint 结果

lint: pass

## 控制关键句