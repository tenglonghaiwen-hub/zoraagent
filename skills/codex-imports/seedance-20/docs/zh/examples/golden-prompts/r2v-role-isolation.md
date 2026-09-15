<!-- AUTO-TRANSLATED: 源文件 = ../../../examples/golden-prompts/r2v-role-isolation.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 黄金提示词：R2V 角色隔离

## 来源简报

将图像用于身份、视频用于摄影机节奏、音频用于节奏。

## 内部提示词规范

Mode: R2V. `[Image1]` 控制原创角色身份。`[Video1]` 仅控制摄影机节奏。`[Audio1]` 仅控制节奏。Endpoint: 角色到达门口。

## 编译的自然语言提示词

[Image1] controls the original character identity and wardrobe. [Video1] controls camera rhythm only; ignore its performer, room, logo, and costume. [Audio1] controls tempo only; do not copy voice or song identity. The character walks toward the doorway in three steady steps as the camera matches the reference rhythm and stops when her hand reaches the handle.

## Lint 结果

lint: pass

## 控制关键句