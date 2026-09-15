<!-- AUTO-TRANSLATED: 源文件 = ../../references/model-name-map.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 模型名称映射

last_verified: 2026-06-20

当用户说 "Seedance Pro"、"Seedance V2"、"Seedance V2 Mini"、"Seed2.0 Pro" 或包装器专属模型名称时，使用本文件。

## 规范名称

| 名称 | 含义 | 指引 |
|---|---|---|
| Seedance 2.0 | 字节跳动 Seed 视频生成模型线 | v2 视频模型族的正确公开名称。将其用作默认措辞。 |
| Seedance 2.0 Fast | 由官方/产品与包装器平台报告的更快 Seedance 2.0 变体 | 当活跃平台暴露 Fast 时用于草稿、迭代或低延迟讨论。重新检查确切分辨率、时长与价格。 |
| Seedance 2.0 Mini | 在火山引擎、BytePlus 与 Dreamina 平台上暴露的更轻官方 Seedance 2.0 系列通道 | 仅当活跃平台暴露 Mini 时使用。将 `Seedance V2 Mini` 视作简写，而非规范措辞。实时重新检查 API 可用性、时长、分辨率、价格与账户关卡。 |
| Doubao Seedance 2.0 | 火山引擎/豆包风味平台命名 | 视作产品/API 平台标签，而非不同的创作方法。 |
| `doubao-seedance-2-0-260128` | 在 5 月 29 日教程中观察到的火山引擎方舟模型 ID | 仅在重新检查活跃控制台/文档后用于实施范例。不要视作通用 BytePlus/全球可用。 |
| `doubao-seedance-2-0-fast-260128` | 在 5 月 29 日教程中观察到的火山引擎方舟 Fast 模型 ID | 仅当活跃平台暴露 Fast 变体且已检查当前价格/限制时使用。 |
| `doubao-seedance-2-0-mini-260615` | 在 2026-06-20 官方文档中观察到的火山引擎方舟 Mini 模型 ID | 仅在火山引擎上重新检查 6 月 15–22 日试用把关是否结束且 API 访问是否上线后使用。 |
| `doubao-seedance-2-0-pro-260215` | 火山引擎方舟 Pro 模型 ID（2026-06-14 报告，此处未控制台核验） | 仅在重新检查活跃方舟控制台后使用。不要与 `doubao-seed-2-0-pro-*` LLM 混淆（见非 Seedance 章节）。 |
| `dreamina-seedance-2-0-260128` / `-fast-260128` | BytePlus ModelArk 模型 ID —— 火山引擎 `doubao-` ID 的国际对应（2026-06-14 报告） | BytePlus 在火山引擎使用 `doubao-` 前缀处使用 `dreamina-` 前缀。同一模型族，不同平台；在引用前重新检查实时 ModelArk 文档。 |
| `dreamina-seedance-2-0-mini-260615` / `dreamina-seedance-2.0-mini` | 在 2026-06-20 官方文档中观察到的 BytePlus ModelArk Mini 模型 ID 与价格行标签 | 仅在 BytePlus 上使用。连字符 ID 与带点的价格标签是平台专属；在实施前重新检查 API 支持、价格与 1080p 支持。 |
| `seedance2` | Runway API 模型 ID | 仅用于 Runway 的 API 平台。不要替代火山引擎/豆包模型 ID。 |
| fal Seedance 2.0 端点 | fal 托管的 Seedance 2.0 平台：`text-to-video`、`image-to-video`、`reference-to-video`，每个都有 `/fast` 档 | 仅将 fal 端点命名用于 fal 平台（核验于 2026-06-09）。在引用前实时重新检查端点 ID、分辨率档与按秒计费。不要替代火山引擎、豆包或 Runway 模型 ID。 |
| `seedance-2.0-text-to-video` | EvoLink 模型值，显示在其公开 Seedance 2.0 页面 | 仅用于 EvoLink 的 API 平台。在实施前重新检查图像/参考/视频模式、价格、回调支持与人脸/参考策略。 |
| `bytedance/seedance-2.0` | OpenRouter 模型 slug 与公开模型页面上看到的相关提供商/路由命名 | 仅用于记录它的提供商/路由平台。在编码前重新检查路由是否支持 text-to-video、image-to-video、首尾帧或多模态参考输入。 |
| PiAPI `seedance` 与 `seedance-2-preview` / `seedance-2-fast-preview` | PiAPI 公开 Seedance 文档中的任务模型与任务类型模式 | 仅与 PiAPI 的通用任务 API 一起使用。在引用前重新检查当前任务类型、低限制变体、资产库要求与价格。 |
| Runware `bytedance:seedance@2.0` / `bytedance:seedance@2.0-fast` | 在公开模型文档中可见的 Runware 模型 ID | 仅在 Runware 上使用。重新检查确切操作支持，因为提供商页面可能将文本、图像、视频、音频、剪辑与延长分组不同。 |
| LaoZhang `/seedance/api/v3` 路由 | LaoZhang 提供商专属 Seedance API 平台 | 仅当用户针对 LaoZhang 时使用。在当前 LaoZhang 文档中重新检查端点路径、模型值、认证与任务生命周期。 |
| Kie.ai、ModelsLab、AI/ML API、MuAPI、SeeGen、Segmind Seedance 路由 | 提供商专属包装器或路由名称 | 视作提供商专属标签，而非规范名称。在实时文档与账户访问检查前，尤其是在人脸/参考处理与输出权利方面，不要在实施前引用。 |
| Seedance V2 | 社区简写 | 除非用户明确指代包装器专属模型，否则规范化为 Seedance 2.0。若用户说 `Seedance V2 Mini`，仅在检查活跃平台后规范化为 Seedance 2.0 Mini。 |
| Seedance 2.0 Pro | 模糊的社区简写 | 不要假设这是官方视频模型名称。询问哪个平台，或带注意事项规范化为 Seedance 2.0 / Fast。 |
| Seed2.0 Pro | Seedance 视频模型线之外见到的 Seed/Doubao 命名 | 不要与 Seedance 2.0 视频生成混淆。 |
| Seedance 1.5 Pro | 更早的 Seedance 代次 | 仅用于历史对比。不要将其限制与 Seedance 2.0 混合。 |

## 回答模式

若用户说 "Seedance 2.0 Pro"，回答：

`I will treat this as Seedance 2.0 unless you mean a specific wrapper's Pro label. Official public video-model wording is Seedance 2.0 and, on some surfaces, Seedance 2.0 Fast. Seed2.0 Pro is a different naming lane and should not be used as the Seedance video model name without source confirmation.`

若用户说 "Seedance V2 Mini"，回答：

`I will treat this as Seedance 2.0 Mini only if the active surface exposes the Mini lane. Official source-visible examples are Volcengine's doubao-seedance-2-0-mini-260615 and BytePlus ModelArk's dreamina-seedance-2-0-mini-260615; API access, pricing, duration, and resolution are surface-specific and need a live recheck.`

## 非 Seedance 模型（不要混淆）

这些不是 Seedance，且不应触发 Seedance 专属的语法、规格或平台。版本核验于 2026-06-14；引用前重新检查。

| 名称 | 实际是什么 | 备注 |
|---|---|---|
| Seedream（如 Seedream 4.5） | 字节跳动的**图像**生成模型 | 同一供应商，名称几乎相同（Seedr**ea**m 对 Seed**a**nce）。最高混淆风险。不是视频。 |
| Doubao-Seed-2.0（`doubao-seed-2-0-pro-*`） | 字节跳动在火山引擎上的**LLM** | 共享方舟平台与 "Seed" 谱系，但是语言模型，而非 Seedance 视频。 |
| Doubao-Seed-2.0 Mini（`doubao-seed-2-0-mini-*`） | 字节跳动的 **Seed/Doubao** 模型命名通道，非 Seedance 视频 | 不要与 `doubao-seedance-2-0-mini-260615` 混淆。缺少的 `ance` 很重要。 |
| Sora 2（OpenAI） | 竞争视频模型 | 注意：OpenAI 已宣布 Sora 的终结 —— 应用约 2026-04 关闭，API 约 2026-09 终止。不是 Seedance。 |
| Veo 3.1（Google） | 竞争视频模型（族：3.1 / Fast / Lite） | "Veo 3" 是上一代。不是 Seedance。 |
| Kling 3.0（快手） | 竞争视频模型（"Omni" = 其多模态变体） | 不是 Seedance。 |
| Runway Gen-4.5 | Runway 自有的视频模型线 | 不同于 Runway 通过 API **托管** Seedance 2.0。不是 Seedance。 |
| Hailuo / Vidu / Luma Ray3 / Pika / Wan | 其他竞争视频模型 | 不是 Seedance。 |

对于这些，仅提供一般电影制作工艺 —— 永远不要 Seedance 参考标签、镜头语法或平台专属设置。

## 包装器名称

第三方包装器可能暴露诸如 `doubao-seedance-2.0`、`doubao-seedance-2.0-fast`、OpenRouter 风格 slug、PiAPI 任务类型、Runware ID 或提供商前缀变体等名称。这些对实施有用，但不是仓库对官方命名的权威来源。

除非已在当前官方页面或控制台中核验值，否则不要从 JavaScript 渲染的价格页面引用当前的 BytePlus Seedance 2.0 价格或模型 ID。引用火山引擎价格时仅附来源日期、模型、平台、货币与重新检查警告。