<!-- AUTO-TRANSLATED: 源文件 = ../../references/progressive-disclosure.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 渐进披露计划

根技能应该路由。子技能应该决策。参考应该承载密集表与易变事实。活动上下文保持精简，因为仅当任务赢得它时才加载权重。

## 真实文件集

| 层 | 文件 | 加载条件 |
|---|---|---|
| 根路由器 | `SKILL.md` | 总是。拥有快速通道、关卡、序列关卡与加载地图 —— 无任何密集内容。 |
| 子技能 | 28 个 `skills/seedance-*/SKILL.md` | 当任务是该技能的工作时。每个中等权重：意图、契约与路由，而非数据库。 |
| 参考 | 58 个 `references/*.md` | 按需，按关卡或加载地图行命名。大部分廉价；少数沉重（见下）。 |

不要将大型数据库移回活动子技能主体，也不要默认加载沉重参考。

## 沉重 vs 廉价参考

大多数参考是可自由加载的小查找表。少数沉重，必须仅在任务需要时加载，永不预先加载：

- [`directing-engine.md`](directing-engine.md) —— 导演推理核心（读解、连贯性原则、导演声音、长篇脊柱）。当场景需要差异化处理或一种声音必须贯穿多片段时加载；对于单片段，从记忆中内联应用其连贯性规则。
- [`directing-engine-genre-library.md`](directing-engine-genre-library.md) —— 33 个完整类型范例。仅当用户想要某个具体类型的完整范例时通过类型/范例加载地图行加载，永不由常驻的导演步骤加载。
- [`api-status.md`](api-status.md)、[`platform-surface-matrix.md`](platform-surface-matrix.md)、[`api-workflow.md`](api-workflow.md) —— 带日期的易变平台事实。仅在源关卡后加载，并保持新鲜（见下方的新鲜度规则）。
- [`pro-filmmaking-standards.md`](pro-filmmaking-standards.md) —— 专业制作脊柱。仅在专业关卡后加载。

## 类型内容归属

类型工艺出现在三个地方；每个承担一个工作，以便它们停止分歧：

- `directing-engine.md` / `directing-engine-genre-library.md` 承担**推导** —— 为什么类型被这样拍摄、打光与表演（读解 → 意图 → 声音 → 设置）。
- `genre-guides.md` 承担**优先级** —— 每种类型最需要保护什么（产品身份、唇形同步、节拍同步）。
- `seedance-recipes` + `examples-by-mode.md` 承担**骨架** —— 可复制即用的起始模式。

类型事实的唯一真相来源是其推导文件；其他文件引用它而非重述它。

## 新鲜度规则

带日期的平台参考不应远远落后于 `api-status.md` 的 `last_verified` 日期。如果 `api-status.md` 推进且一个新鲜度关键参考仍引用旧的核验日期，发布前重新核验并重新盖章（或确认仍准确）。刻意冻结的快照如 `research-2026-05-30.md` 是例外；它们的日期是其身份的一部分。

## V6 序列披露

根 `SKILL.md` 仅拥有序列关卡与不变量。`skills/seedance-sequence` 拥有全局规划与当前片段编译。`skills/seedance-continuation` 拥有已接受画面的续拍与重新锚定。密集状态细节位于 `references/sequence-project-state.md`、`references/continuation-handoff.md` 与 `references/prompt-compiler.md`。