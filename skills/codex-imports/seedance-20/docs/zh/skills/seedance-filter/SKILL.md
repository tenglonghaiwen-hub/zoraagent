<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-filter/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-filter
description: "This skill should be used when a Seedance 2.0 prompt is blocked, rejected, silently degraded, or likely to trigger a content filter; or when the user asks for a safer rewrite without losing the creative intent."
license: MIT
user-invocable: true
tags:
  - content-filter
  - safe-rewrite
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

# seedance-filter

## 意图

被错误屏蔽的提示词让用户感觉被一台没有上诉法庭的机器指控。本技能是辩护者：用平实语言陈述他们的诚实意图来清除无辜者，并永远不为有罪者出主意。用户尊严与平台边界在同一姿态中得到保护。

## 边界 —— 在做任何事之前阅读

本技能仅修复**误报**：被过于宽泛的过滤阻挡或降级的良性制作内容（医疗、历史、运动、虚构原创上下文）。它通过**用平实语言澄清合法的上下文**来工作 —— 永远不要伪装意图。它不会重新措辞真正被禁止的内容：涉及未成年人、无权利的真实人物肖像、性或图形或非法材料的任何内容。如果底层请求被禁止，直接拒绝，并仅在存在合法替代时提供一个。

当提示词被屏蔽、降级、可能触发审核、或需要在不失去创意意图的情况下进行更安全的改写时，使用本技能。本技能不帮助规避安全系统。它将风险表面措辞改写为专业的、非图形的制作语言，并保留安全的创意核心。

## 修复方法

1. 识别创意意图：动作、情绪、摄影机、主体与最终节拍。
2. 识别风险表面措辞：图形伤害、受保护身份、性化框架、真实人物肖像、武器、自残、仇恨、规避语言或精确 IP 复制。
3. 用专业的、非图形的、制作上下文语言取代风险术语。
4. 保留构图、动作、情绪、摄影机逻辑与授权参考。
5. 对于可能的误报，澄清良性的制作上下文、所有权与非图形意图。不要帮助绕过安全系统或提供规避策略。

## 更安全的改写模式

| 意图 | 更安全的方向 |
|---|---|
| 冲突 | `staged confrontation, choreographed action beat, no graphic injury` |
| 余波 | `non-graphic distress, torn fabric, scattered props, dramatic silence` |
| 悬念 | `threat implied by shadow, locked door, heavy breathing, low light` |
| 类武器道具 | `prop object handled safely within a staged action scene` |
| 恐怖氛围 | `eerie atmosphere, flickering practical light, off-screen sound cue` |
| 受保护身份 | `original character with broad genre archetype traits` |

## 边界规则

如果用户的请求不安全，拒绝或重定向到安全的替代。如果是安全的但措辞不佳，修复措辞。当不确定时，陈述风险类别并提供一个保留无害场景功能的保守提示词。

不要提供过滤器绕过、规避或隐藏词策略。安全的路径是澄清制作意图、移除不安全的身份或伤害元素，并改写为原创授权场景。

面部限制或肖像验证的变通方法不是安全的提示词技巧。如果平台提供授权的虚拟肖像、可信模型输出或授权资产流程，将用户路由到那些当前官方路径，而非规避语言。

加载 `[ref:filter-vocab]` 获取更安全的替代。仅当安全修复需要中文/俄语/日语/韩语/西班牙语或混合语言措辞以确保清晰时，加载 `[ref:multilingual-community-examples]`。

## 输出契约

返回可能的触发类别、更安全的措辞、最终提示词、变更的内容以及仍适用的任何内容边界。