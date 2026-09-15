<!-- AUTO-TRANSLATED: 源文件 = ../../../../references/migrated/v5.2-legacy-skill-bodies/seedance-filter.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-filter
description: "This skill should be used when a Seedance 2.0 prompt is blocked, rejected, silently degraded, or likely to trigger a content filter; or when the user asks for a safer rewrite without losing the creative intent."
license: MIT
user-invocable: true
user-invokable: true
tags:
  - seedance-20
  - content-filter
  - safety
  - rewrites
metadata:
  version: "5.1.0"
  updated: "2026-04-27"
  parent: "seedance-20"
  author: "Iamemily2050 (@iamemily2050)"
  repository: "https://github.com/Emily2040/seedance-2.0"
  openclaw:
    emoji: ""
    homepage: "https://github.com/Emily2040/seedance-2.0"
---

# seedance-filter

当提示词被屏蔽、降级或可能触发内容过滤器时使用本技能。工作不是绕过安全系统；而是以更安全的表面措辞保留合法的创作意图。

诊断问题：
1. 风险是基于身份的吗：明星、公众人物、指名角色、品牌、logo、人声或面部？
2. 风险是暴力、性、未成年人、自残或武器措辞吗？
3. 风险是版权或平台策略吗？
4. 风险是可被中性制作语言替换的误报措辞吗？

改写规则：
- 用原创原型替换受保护身份。
- 用非图形动作后果替换图形伤害。
- 用编排、走位或道具中性动作替换武器强调。