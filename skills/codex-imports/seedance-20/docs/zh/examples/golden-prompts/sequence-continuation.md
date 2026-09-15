<!-- AUTO-TRANSLATED: 源文件 = ../../../examples/golden-prompts/sequence-continuation.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 黄金提示词：序列续拍

## 来源简报

在已接受 Clip 01 之后继续机场序列的 Clip 02。

## 内部提示词规范

Sequence relation: seamless_continuation. Source: 已接受 `[Video 1]`。Opening state: 观察到的旅行者距打开的车后门两步。排除终点退出与车辆离开。

## 编译的自然语言提示词

[Video 1] is the accepted continuity source; @Image 1 preserves the traveler identity and charcoal coat. Begin from the observed final frame: she is two steps from the open rear door, still moving left-to-right with the suitcase rolling behind. Continue the same lateral camera and rainy curb ambience. This clip only finishes the two steps, lets her enter the rear seat, and closes the door. Do not replay the terminal exit. Do not show the car departing yet.

## Lint 结果

lint: pass

## 控制关键句