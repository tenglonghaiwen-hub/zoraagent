<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-characters/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-characters
description: "This skill should be used when the user asks for character consistency, character tags, identity lock, multi-character blocking, wardrobe continuity, hand safety, expression control, or likeness-sensitive character guidance."
license: MIT
user-invocable: true
tags:
  - characters
  - identity
  - consistency
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

# seedance-characters

将此用于身份、一致性、多角色走位、服装连续性、手部安全、表情控制与肖像敏感的角色指导。角色提示词必须在添加风格之前消除歧义。

当角色身份、服装、道具、视线、屏幕方向或情绪状态必须跨多个镜头存活时，加载 `[ref:shot-list-continuity]`。加载 `[ref:directing-engine]` 指导表演：给每个角色一个可演的目标，通过词与动作的矛盾展示潜台词，并让一种表演语域与项目导演声音保持一致。

## 意图

用户在这里保护某物 —— 他们发明的角色、他们建造的产品或他们爱的人。身份是信任：当脸漂移时，用户将其感受为背叛，而非渲染伪影。将每个重复角色视作有记忆与契约的延续剧组成员，永远不要为每条片段重塑的陌生人。

## 角色契约

为每个角色分配一个稳定标签：`Character A`、`Character B`、`[Image1] subject` 或用户提供的原创名称。当不止一个角色出现时，不要使用模糊的代词。保持标签、角色、外观、服装、位置、动作与情绪节拍一致。

| 字段 | 提示词使用 |
|---|---|
| 标签 | `Character A` 或 `[Image1] subject` |
| 身份锚 | 年龄段、剪影、发型、服装或授权参考角色 |
| 位置 | 前景/背景、左/右、坐/站 |
| 动作 | 一个分配的动词与端点 |
| 表情 | 可观察行为如眨眼、瞥视、微笑、抓握、停顿 |
| 约束 | 必须保持不变的内容 |

## 多角色走位

分别分配动作：`Character A lowers the envelope; Character B remains in the doorway`。当模型必须决定谁移动时，不要写 `they argue dramatically`。如果发生接触，描述接触点与端点。对于人群场景，识别主角并让背景动作保持简单。

## 三层动作层级

从中国制作实践中现场观察；已知的多人场景最强稳定器。为每个可见的人从恰好一层给一个动作：

1. **持久微动作** —— 呼吸、眨眼、轻微肩膀动作、头发飘动、漂移的目光。连续，无间隙；这是所有非焦点人物的默认层。
2. **一个有焦点的反应** —— 一个人获得一个带有显式时间窗口的小反应：`Character B's lip corner lifts and she holds a half-second glance`。
3. **大动作 —— 默认禁止。** 在多人镜头中，显式排除站立、行走、转身、姿势变化与物品拾起，除非其中之一是镜头的单一节拍。角色-道具物理（举起玻璃杯、传递物体）在画面上有多个人的情况下脆弱 —— 让接触保持简单或移出画面。

## 手与脸稳定性

手与脸在复杂编排下会降级。让手可见但简单，避免快速手指动作，避免对白期间触碰脸部，并为唇形同步或肖像保持锁定摄影机。当面部精度脆弱时使用道具展示情绪。

## 肖像规则

对真实人物肖像，不要从上传的资产推断同意。将肖像、面部与人声工作流视为依赖授权与平台专属。如果授权不清晰，改为保留场景功能的原创角色原型。

## 序列状态

当序列状态存在时，继承服装、发型、屏幕地理、视线、姿态、情绪状态、当前片段范围、连续性锁定、精确参考标签与保留的未来节拍。规范身份参考控制身份；已接受画面控制瞬时开场状态。不要让动作或连续性来源覆盖不可变的角色锁定。

## 输出契约

返回角色卡、标签映射、动作分配、连续性约束与任何安全或授权备注。