<!-- AUTO-TRANSLATED: 源文件 = ../../../examples/golden-prompts/video-edit-one-layer.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 黄金提示词：视频剪辑单层

## 来源简报

修复一条其他方面良好的片段中的灯光。

## 内部提示词规范

Mode: edit. `[Video1]` 是源片段。仅修改一层。

## 编译的自然语言提示词

[Video1] is the source clip. Preserve the existing subject, timing, camera path, background layout, and action exactly. Change only the lighting layer: add a soft warm practical lamp from frame left and a faint blue rim on the shoulder, keeping the same motion and endpoint. Do not regenerate wardrobe, face, props, dialogue, or camera movement.

## Lint 结果

lint: pass

## 控制关键句