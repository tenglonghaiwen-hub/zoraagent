<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-prompt/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-prompt
description: "This skill should be used when the user asks to write, improve, translate, compress, or debug a Seedance 2.0 video prompt; mentions T2V, I2V, V2V, R2V, camera direction, prompt quality, or provides reference assets for a production-ready prompt."
license: MIT
user-invocable: true
tags:
  - prompt-engineering
  - video-generation
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

# seedance-prompt

从清晰的概念或提供的参考资产生成生产就绪的 Seedance 提示词。将提示词视为简短的拍摄简报：它必须说屏幕上什么在变化、摄影机做什么、光与声音贡献什么、什么必须保持稳定。让最终提示词低于平台提示词预算，并在交付前移除填充词。

加载 `[ref:quick-ref]` 获取清单，`[ref:reference-workflow]` 获取多模态参考，`[ref:i2v-guide]` 获取图生视频，`[ref:first-last-frame-guide]` 获取首尾帧工作，`[ref:examples-by-mode]` 当范例有用时，`[ref:shot-list-continuity]` 获取多镜头专业计划，`[ref:multishot-grammar]` 获取镜头标签语法、镜头-时长-秒数预算与一次生成内的剪辑摆放，`[ref:multilingual-community-examples]` 获取中文/俄语/日语/韩语/西班牙语或混合语言提示词。当序列状态存在时，加载 `[ref:prompt-compiler]` 并仅编译当前片段契约。

## 意图

这是某人脑中的场景与屏幕上场景之间的翻译者。用户已经想象了它；工作是让传输过程中尽量少损失。成功是第一次生成就足够接近，让他们能反应而非解释。每次修订都继承故事已经决定的一切，并仅改变反应所要求的 —— 草稿是对话，而非重启。

## 导演公式

在填充槽位前，决定镜头在做的唯一一件事。加载 `[ref:directing-engine]`，读取场景，命名单一意图，并让该意图选择摄影机、灯光、走位、表演与声音一起，使它们强化而非竞争。下面的公式是连贯设置的容器，而非独立装饰的清单；如果项目声音已设定，让该镜头保持在它之内。

使用 `Subject + Action + Scene + Camera + Lighting/Style + Audio + Constraints`。将主体与主要动作放在前面，因为早期子句设定镜头层级。如果参考资产已显示该信息，不要强制每个槽位；对 I2V，仅描述静图无法展示的动作、摄影机、时序、转变、音频与保持约束。

| 槽位 | 用于 | 提示词就绪模式 |
|---|---|---|
| Subject | 模型必须追踪的锚。 | `Original ceramic perfume bottle on black acrylic, label preserved exactly` |
| Action | 可见变化。 | `condensation beads form and slide down the glass over five seconds` |
| Scene | 仅参考中未包含的内容。 | `quiet rain-lit kitchen counter, shallow depth of field` |
| Camera | 一次有端点的主要运动。 | `slow dolly-in from medium product shot to macro label detail` |
| Light and style | 物理光加安全的视觉语言。 | `warm practical key from frame left, cool blue rim, clean commercial realism` |
| Audio | 环境床、音效、对白或安静。 | `Sound: low room tone, soft glass chime on final frame` |
| Constraints | 保持与排除。 | `do not alter logo, shape, label, or cap geometry` |

## 模式关卡

在动笔前选择模式。**T2V** 需要主体、动作、场景、摄影机、光、风格与约束，因为尚无任何可见内容。**I2V** 从 `[Image1]` 开始，仅添加动作、时序、摄影机、灯光过渡、音频与保持。**V2V** 应将 `[Video1]` 映射到源片段、摄影机运动、动作节奏、走位、剪辑目标或延长锚点，而非意外地传递身份。**R2V** 必须列出每个参考角色并声明不应传递的内容。**FLF2V** 使用 `[Image1]` 作为首帧，`[Image2]` 作为尾帧，然后仅描述连续过渡。

| 模式 | 撰写优先级 | 常见错误 | 修复 |
|---|---|---|---|
| T2V | 在紧凑层中构建整个镜头。 | 一条片段中过多事件。 | 保持一个可见节拍与一个端点。 |
| I2V | 保持可见身份；添加动作。 | 重新描述图像直到产品或脸漂移。 | 说 `preserve [Image1] exactly`；仅添加动态变化。 |
| V2V | 传递动作、摄影机或时序。 | 复制未授权肖像或场景细节。 | 使用自有/已授权/已批准参考并限制传递角色。 |
| R2V | 为每个资产分配独立角色。 | 一个参考被要求控制身份、姿态、场景与风格。 | 拆分角色或优先考虑最重要的角色。 |
| FLF2V | 从首帧移动到尾帧。 | 将尾帧视为模糊情绪而非端点。 | 陈述 `[Image2]` 是最终视觉目标。 |
| Edit | 保持源片段同时修改一层。 | 重写整个场景并失去连续性。 | 说 `[Video1] is the source clip; change only...` |
| Extend | 仅从已接受源画面继续。 | 从计划结尾开始或凭空发明片段状态。 | 路由到 `[skill:seedance-continuation]` 并使用观察到的结束状态。 |

## 序列边界

通用提示词技能不能独立凭空发明续拍状态。如果用户要求继续、延长、制作第二部分或使用上一片段，路由到 `[skill:seedance-continuation]`，除非已接受片段/尾帧与观察到的结束状态已存在于序列状态中。

对于序列提示词，保留 `project_id`、`clip_id`、`parent_clip_id`、连续性锁定、精确参考标签、实际开场状态、已完成节拍排除与保留的未来节拍。最终提示词保持自然语言并仅覆盖当前片段。

## 提示词构建流程

首先，识别单一可见节拍：揭示、抵达、决定、转变、接触、追逐或消失，并命名它服务的那一个意图。接下来，在添加形容词前分配参考角色。然后按导演公式顺序撰写紧凑的首稿，让摄影机、光、表演与声音瞄准那个意图。最后，运来自检与来自 `[ref:directing-engine]` 的导演连贯性测试：一个主要主体、一个主要动作、一个有动机的摄影机运动、物理有动机的灯光、以可见姿态而非情绪词写的表演、分配的角色标签、声音意图且无空洞加成词。

## 压缩规则

当提示词太长时，按此顺序削减：重复的风格形容词、泛化的质量词、参考中可见的背景细节、二级摄影机运动、二级动作与投机性的情绪标签。保留保持约束、动作时序与角色映射。如果用户要求双语或混合语言提示词，仅为清晰度使用语言混合：参考角色、对白语言、技术摄影机术语与安全制作约束。不要使用另一种语言来隐藏不安全意图。

## 输出契约

返回：

1. 模式：T2V、I2V、V2V、R2V、FLF2V、剪辑或延长。
2. 参考角色映射（若有）。
3. 在已验证活跃平台提示词预算内的最终提示词。
4. 有用时的可选中文压缩版本。
5. 当提示词属于专业序列时的镜头列表或交付备注。
6. 相关的安全或版权备注。

在最终定稿前，运来反 slop 通过并移除模糊的质量加成词。