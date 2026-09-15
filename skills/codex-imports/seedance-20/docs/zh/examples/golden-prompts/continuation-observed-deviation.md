<!-- AUTO-TRANSLATED: 源文件 = ../../../examples/golden-prompts/continuation-observed-deviation.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 黄金提示词：续拍观察偏差

## 来源简报

计划说主体到达门口，但已接受片段在两步外结束。

## 内部提示词规范

使用 observed_end_state，而非 planned_end_state。将未完成的节拍带入当前片段。

## 编译的自然语言提示词

Start with the accepted final frame: the traveler is still two steps from the open rear door, mid-stride, suitcase behind her. Complete only those two steps first, then let her reach the door handle. Keep the same left-to-right travel, black sedan, rain reflections, and tracking camera. Do not assume she is already at the door. Do not place her inside the car until after the two steps are completed.

## Lint 结果

lint: pass

## 控制关键句