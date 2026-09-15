<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-troubleshoot/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-troubleshoot
description: "This skill should be used when a Seedance 2.0 output is blurry, jittery, off-prompt, morphing, blocked, visually generic, unstable, desynced, inconsistent, or otherwise fails and needs root-cause diagnosis."
license: MIT
user-invocable: true
tags:
  - diagnostics
  - troubleshooting
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

# seedance-troubleshoot

如果镜头部分良好而非失败，先路由到 `[ref:retake-protocol]` 分诊 —— 大多数镜头值得一个裁决，而非重写。在重写前诊断失败。不要简单添加更多形容词。识别失败是来自模式不匹配、过载、歧义、脆弱身份、不安全措辞、不支持的平台行为还是缺失的保持约束。

当诊断树没有失败对应的行时，加载 `[ref:model-mechanics]` 并按机制诊断：注意力稀释、先验冲突、召唤的否定、断裂的轨迹、复合错误、条件冲突、容量饥饿或过载的音视频联合约束。当失败涉及续拍、剪辑/延长、源片段、音频参考或平台特定错误时，加载 `[ref:field-observed-tips]`、`[ref:reference-workflow]` 与 `[ref:api-workflow]`。对多镜头漂移加载 `[ref:shot-list-continuity]`，对最终客户或交付失败加载 `[ref:delivery-qc]`。当序列状态存在时，加载 `[ref:failure-atlas]`、`[ref:continuation-handoff]` 与 `[ref:continuity-qc]`；对照连续性锁定、已完成节拍、精确参考标签与保留的未来节拍进行诊断。

## 意图

失败的生成感觉是私人的 —— 用户向机器展示了他们的想法，机器返回了破碎的东西。本技能的灵魂是无指责的拯救：命名机制，从不点名用户；拯救想法，不只拯救提示词。他们应带着修复与完好无损的自信离开。

## 诊断树

| 症状 | 可能原因 | 首要修复 |
|---|---|---|
| 产品或脸变化 | I2V 提示词重新描述了可见身份或动作过载。 | 添加保持约束；移除重复的静态细节。 |
| 摄影机跳跃 | 几个不兼容的运动或没有端点。 | 选择一个有起点和终点的运动。 |
| 泛化输出 | 空洞的风格词与弱动作。 | 用物理动作、源光、材质与声音替换。 |
| 动作被忽略 | 静态提示词或没有可见后果。 | 添加演员、动词、时序与改变的结束状态。 |
| 唇形同步差 | 移动的头/摄影机、长对白、未分配的说话者。 | 锁定构图、缩短台词、分配说话者。 |
| VFX 嘈杂 | 特效没有来源、物理或消散。 | 添加来源、材质、路径、交互与端点。 |
| 提示词被屏蔽 | 受保护 IP、真实人物、图形或类似规避的措辞。 | 用安全的制作语言改写意图，不要规避。 |
| 延长质量下降 | 没有尾帧锚点或续拍间变更变量过多。 | 使用返回尾帧作为首帧并变更一个变量。 |
| 音频参考被忽略 | 竞争的视频声音、无可见节拍映射或不支持的组合。 | 静音竞争视频并将一个可见事件映射到节拍。 |
| 文字/logo 破坏 | 小文字被要求移动或重画。 | 让文字保持静态、居中且受保护；在其周围动画光。 |
| 客户 QC 失败 | 提示词输出被视作最终交付而没有后期/QC。 | 路由到交付预检、后期修复或仅重生失败镜头。 |
| 续拍假设计划结尾 | 上一片段未被评审或 observed_end_state 被忽略。 | 用实际观察到的结束状态替换开场。 |
| 前一个动作重启 | 已完成节拍未标记为 already_happened。 | 添加已完成节拍排除。 |
| 未来节拍泄露 | 保留节拍进入当前提示词。 | 移除未来节拍并更早停止。 |
| 身份参考与连续性来源冲突 | 源片段同时控制瞬时状态与身份。 | 从规范参考重新锚定身份。 |
| 屏幕方向重置 | 轴线关系未被锁定或未被有意重置。 | 保持屏幕方向或声明新镜头轴线重置。 |
| 开放动作丢失 | 主体或摄影机向量未被继承。 | 将动作向量带入开场句。 |
| 摄影机相位重启 | 父级摄影机端点未被记录。 | 从观察到的摄影机相位开始。 |
| 道具状态矛盾 | 所有者、位置或状态缺失。 | 添加道具状态交接。 |
| 音频相位重启 | 已完成对白或音乐相位未被记录。 | 继续或有意改变音频相位。 |

## 修复流程

首先引用失败短语或缺失元素。然后命名根因。接下来，移除冲突而非添加复杂性。推荐一个主要修复变量，而非添加更多形容词。最后，生成一个保守的重试提示词，以及仅在用户希望探索时的一个可选创意变体。

## 保守重试模式

`[Reference role if any]. Preserve [identity/product/environment] exactly. One visible action: [specific verb and consequence]. Camera: [single move]. Lighting: [physical source]. Sound: [ambient/SFX/dialogue]. Constraints: [what must not change].`

## 升级规则

如果同一错误重复，将场景拆分为更短片段、减少角色、简化手或脸动作、使用更强的参考角色映射或更换模式。对于不稳定的文字/logo，让它们保持静态、居中且受保护；不要在动作期间要求模型重画小文字。

对于剪辑/延长失败，首先保持源片段并仅修改失败的那一层。如果平台支持返回尾帧，将其用作下一首帧锚点，然后延长。

## 输出契约

返回根因、来自提示词或结果的证据、修复后的提示词与一个保守的重试变体。