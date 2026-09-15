<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vocab-zh/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vocab-zh
description: "This skill should be used when the user asks for Chinese Seedance 2.0 prompt wording, Mandarin cinematic vocabulary, Chinese prompt compression, or translation of camera, lighting, action, VFX, audio, and production terms into Chinese."
license: MIT
user-invocable: true
tags:
  - chinese
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

# seedance-vocab-zh

当用户要求中文提示词、普通话电影措辞、角色绑定、首尾帧工作流或最大紧凑度时，使用中文词汇。中文提示词措辞通常高效，但它仍必须保留模式、参考标签、动作、摄影机、灯光、音频与约束。

## 意图

中文能用四字表达英语需要一句话的内容 —— 用户选择中文即是选择那种紧凑性与其文化。在不丢失指挥性的前提下服务那种密度：每个成语般紧凑的短语仍命名摄影机可见的东西。

## 使用规则

不要翻译参考标签。保持 `[Image1]`、`[Video1]`、`[Audio1]` 不变。使用简短的制作短语而非抽象形容词。

加载 `[ref:vocab/zh]` 获取密集的角色绑定、首尾帧、摄影机、灯光、音频、剪辑/延长、约束与安全词汇。

| 功能 | 中文措辞 |
|---|---|
| Camera | `缓慢推镜`, `横向跟拍`, `固定中景`, `低角度`, `特写`, `从轮廓到正面四分之三角度` |
| Lighting | `侧逆光`, `柔和窗光`, `暖色实用灯`, `冷色月光`, `轮廓光`, `体积光` |
| Motion | `慢慢转身`, `快速掠过画面`, `水珠沿表面下滑`, `薄雾贴地扩散` |
| Audio | `安静环境声`, `一句短对白`, `轻微金属声`, `无配乐`, `脚步声卡点` |
| First/last frame | `@图1 为首帧`, `@图2 为尾帧`, `自然过渡到尾帧`, `中间动作连续，不跳切` |
| Constraints | `严格保持logo、标签、形状和颜色不变` |

## 紧凑模式

`[Image1]为参考，严格保持[主体/产品/脸部/标志]不变；仅加入[动作/光线/镜头变化]。镜头：[一个动作]。声音：[音效或环境声]。`

## 反 slop 规则

当提示词依赖 `电影感`、`氛围感`、`高级感`、`大片感` 或空泛的 `质感` 时，加载 `references/vocab/zh.md` 中的 Slop Traps 表并将每个分解为产生它的物理元素 —— 材质、光线、色彩、空气。

## 输出契约

返回简洁的中文提示词文本、有用时的可选英文注释，并精确保留参考标签。