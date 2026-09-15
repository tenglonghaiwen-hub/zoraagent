<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vocab-es/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vocab-es
description: "This skill should be used when the user asks for Spanish Seedance 2.0 prompt wording, Spanish cinematic vocabulary, or translation of camera, lighting, action, VFX, audio, and production terms into Spanish."
license: MIT
user-invocable: true
tags:
  - spanish
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

# seedance-vocab-es

当用户要求西班牙语提示词、双语交付、或摄影机、灯光、动作、VFX、音频与制作约束的紧凑翻译时，使用西班牙语电影词汇。精确保留参考标签：`[Image1]`、`[Video1]`、`[Audio1]` 永远不应被翻译。

## 意图

西班牙语即使在技术指令中也承载韵律。为用西班牙语思考的用户服务，保持其音乐性又保持摄影机精度的词汇 —— 他们永远不应觉得用自己的语言执导是一种降级。

## 使用规则

翻译制作含义，而非逐字英文。让提示词保持具体与简洁：主体、可见动作、摄影机、光、声音与约束。

| 功能 | 西班牙语措辞 |
|---|---|
| Camera | `travelling de acercamiento`, `plano medio`, `primer plano`, `seguimiento lateral`, `cámara fija` |
| Lighting | `contraluz`, `luz suave de ventana`, `luz práctica cálida`, `sombra marcada`, `halo frío de luna` |
| Motion | `gira lentamente`, `cruza rápido el encuadre`, `avanza con estabilidad`, `las gotas se deslizan` |
| Audio | `sonido ambiente`, `diálogo claro`, `golpe metálico suave`, `sin música` |
| Constraints | `mantener el logotipo, la etiqueta y la forma sin cambios` |

## 紧凑模式

`[Image1] es la referencia; mantener identidad, color y forma sin cambios. Solo cambia [movimiento/luz/cámara]. Cámara: [un movimiento]. Sonido: [señal].`

## 反 slop 规则

当提示词依赖 `cinematográfico`、`épico`、`impresionante`、`mágico` 或 `de alta calidad` 时，加载 `references/vocab/es.md` 中的 Slop Traps 表并将每个分解为产生它的物理元素 —— 摄影机运动、光源、材质、声音。

## 输出契约

返回西班牙语提示词措辞、有用时的可选英文注释，并保留未更改的参考标签。