<!-- AUTO-TRANSLATED: 源文件 = ../../references/platform-surface-matrix.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 平台能力矩阵

last_verified: 2026-06-20

Seedance 2.0 的能力声明必须将模型与产品平台分开。一个特性对模型可能为真，但在特定平台上仍可能被把控、不可用、被重命名、定价不同或受策略限制。

访问说明 (2026-06-13)：海外 Seedance 2.0 API 在版权驱动的暂停后存在争议 —— 见 `api-status.md`。在依赖任何第三方平台之前实时核验访问，并在此处新增任何平台前独立确认其承载 Seedance 2.0。

| 平台 | 证据类型 | 典型用途 | 当前指引 |
|---|---|---|---|
| 字节跳动 Seed 官方模型页面 | 官方 | 广义能力定位 | 仅用于高层级模型定位。它确认多模态音视频生成、参考、表现力、灯光、阴影与摄影机控制。 |
| 字节跳动官方发布文章 | 官方 | 能力细节与已知限制 | 用于关于输入模态、参考数量、视频延长/剪辑、双通道音频与剩余弱点的最强公开声明。 |
| 火山引擎方舟 / ModelArk 文档 | 官方平台文档 | API 任务流与模型平台 | 在给出端点、地区、配额、价格或文件限制前重新检查。截至 2026-06-20，火山引擎将 Seedance 2.0 Mini 暴露为 `doubao-seedance-2-0-mini-260615`，但官方文档称其至 6 月 22 日仍处于试用把关。 |
| 火山引擎视频生成教程 | 官方平台文档 | 异步任务生命周期、首尾帧角色、返回尾帧、网络搜索工具与参考文件组合 | 火山引擎字段的当前 5 月 29 日信号。仅用于火山引擎；在实施前重新检查确切模式、授权、价格与人脸参考行为。 |
| 火山引擎开发者社区文章 | 官方生态/新闻文章 | API 可用性、安全与采用上下文 | 有助于留意 API 服务推广、肖像/版权标准、人脸验证、虚拟肖像与 BytePlus 海外服务。不要视作 API 模式、价格表或账户授权保证。 |
| BytePlus ModelArk 文档 | 官方平台文档 | 国际 API 与文档平台 | 在生产指引前重新检查。BytePlus 将 Seedance 2.0 Mini 暴露为 `dreamina-seedance-2-0-mini-260615` 以及 `dreamina-seedance-2.0-mini` 价格行，但仅引用可见或独立核验的声明。 |
| Runway Seedance 2 | 官方第三方平台 | 使用 Seedance 2 模型访问的 API/web 生成 | Runway 记录了 `seedance2`、5–15 秒时长、图像/视频/音频参考、上传 URI、音频合成规则与计划/地区注意事项。视作 Runway 平台行为，而非火山引擎或 BytePlus 行为。 |
| Runway MCP | 官方智能体连接器平台 | 智能体可访问的图像/视频生成 | 对智能体工作流规划有用。它不证明字节跳动 API 访问或改变 Seedance 模型限制。 |
| fal | 官方第三方平台 | 通过 fal 的 Seedance 2.0 端点的 API 生成 | 核验于 2026-06-09：fal 记录了 text-to-video、image-to-video（起始图像加上可选结束图像）以及 reference-to-video，每个都有 /fast 档、4–15 秒或 auto 时长、六种画幅加 auto 以及按秒计费。fal 的散文指南说 480p/720p 而模型与价格页面列出 1080p —— 在调用时按端点核验分辨率。该平台无延长端点。视作 fal 平台行为，而非火山引擎或 BytePlus 行为。 |
| Atlas Cloud | 第三方聚合平台 | 通过异步视频生成 API 托管 Seedance 2.0 | 核验于 2026-06-13：Atlas Cloud 托管活跃的 Seedance 2.0（text-to-video、image-to-video、reference-to-video，外加快速变体）。其 OpenAI 兼容端点仅覆盖 LLM/聊天；**Seedance 视频生成使用 Atlas Cloud 自身的异步 API** —— `POST /api/v1/model/generateVideo`，模型 ID 如 `bytedance/seedance-2.0/text-to-video`，返回在 `/api/v1/model/prediction/{id}` 轮询的预测 ID —— 而非 OpenAI SDK 形态。转售 Seedance 访问的若干聚合器之一；将端点、价格、模型 ID、配额与把关视作聚合器专属，使用前重新检查，且永远不要作为官方字节跳动行为呈现。本仓库不背书任何转售商；仅为完整列出。 |
| Replicate | 第三方模型托管平台 | 在官方 `bytedance` 命名空间下托管 Seedance 2.0 | 核验于 2026-06-13：Replicate 列出 `bytedance/seedance-2.0`（text-to-video、image-to-video、多模态参考输入 `[Image1]/[Video1]/[Audio1]`、原生音频）位于其标准异步预测 API 后；检查模型页面以获取支持的分辨率而非假设模型级最大值。知名且广泛使用的模型宿主 —— 但仍是平台专属：在引用前重新检查价格、限制与活跃访问（见 `api-status.md` 中的海外 API 状态说明），且永远不要作为官方字节跳动行为呈现。本仓库不背书任何宿主；仅为完整列出。 |
| WaveSpeedAI / Higgsfield / Pollo | 第三方托管平台 | 额外已核验的 Seedance 2.0 宿主 | 核验于 2026-06-14（提供商自有页面）：WaveSpeedAI（异步任务 API，t2v/i2v + fast/turbo/"spicy" 变体，480p/720p/1080p 档）、Higgsfield（创作者 UI，多模态输入；未发现清晰记录的公开 API）、Pollo（网页模型页面 + 统一任务 API）。与每个宿主相同规则：异步提交/轮询视频，实时重新检查，聚合器/宿主专属而非官方。本仓库不背书任何。 |
| EvoLink / OpenRouter / Kie.ai / PiAPI / LaoZhang | 第三方提供商/路由平台 | 额外的 Seedance 2.0 API 访问路径 | 核验于 2026-06-20 来自提供商自有页面或文档：EvoLink 记录了 `/v1/videos/generations` 加上 `/v1/tasks/{task_id}`；OpenRouter 列出 `bytedance/seedance-2.0`；PiAPI 记录了带 Seedance 任务类型的通用任务 API；LaoZhang 记录了 `/seedance/api/v3` 基路径；Kie.ai 发布 Seedance 2.0 API 访问。将模型 ID、认证、基 URL、轮询、价格、人脸/参考支持、输出 URL 与内容策略视作提供商专属。本仓库不背书任何转售商。 |
| Runware / ModelsLab / AI/ML API / MuAPI / SeeGen / Segmind | 第三方提供商/路由平台 | 额外的 Seedance 2.0 或 Seedance 2 Fast 模型托管路由 | 核验于 2026-06-20 来自提供商自有页面或文档。这些页面列出 Seedance 2.0、Seedance 2.0 Fast 或相关字节跳动视频路由，但它们的字段与模型名称不同。仅将它们视作提供商专属集成的候选，且在已检查实时文档与账户访问后才使用。本仓库不背书任何转售商。 |
| Dreamina / 即梦网页 UI | 官方产品平台 | 创作者工作流 | 行为可能与 API 不同。不要将网页 UI 限制、积分、人脸检查或上传规则推广到每个平台。 |
| Dreamina Seedance 2.0 Mini | 官方产品平台 | 更低成本/更快的 Dreamina 网页生成通道 | 仅用作 Dreamina 网页平台证据。不要在没有检查火山引擎/BytePlus 文档或控制台的情况下推断 API 字段、模型 ID、价格或 1080p 支持。 |
| ComfyUI 合作方节点文档 | 合作方工作流文档 | T2V、R2V、FLF2V 工作流 | 有助于工作流词汇与平台注意事项。标记为 ComfyUI 专属而非通用 Seedance 行为。 |
| 第三方包装器 | 社区/商业包装器 | 访问抽象 | 仅用作现场模式与集成思路。不要将包装器模型名称、价格或把关行为呈现为官方。 |
| 社区提示词语料 | 现场观察 | 提示词模式挖掘 | 挖掘结构、时序语法、词汇与失败模式。不要直接复制不安全、对 IP 敏感或真实人物的范例。 |
| Agent Skills 文档 | 智能体打包文档 | 仓库布局与安装措辞 | 用于技能结构与渐进披露指引。不要将仓库安装路径视作通用客户端保证。 |

## API 形态规则

核验于 2026-06-20 跨此处检查的每个开发者平台（fal、Replicate、火山引擎方舟、BytePlus ModelArk、Atlas Cloud、Runway、WaveSpeed、Pollo、EvoLink、OpenRouter、Kie.ai、PiAPI、LaoZhang、Runware、ModelsLab、AI/ML API、MuAPI、SeeGen、Segmind）：Seedance 2.0 **视频生成总是异步任务** —— 提交任务，获取 ID，轮询直到就绪，获取 URL。一些路由器将任务包装在统一或 OpenAI 兼容平台中，但视频生成本身仍使用提供商专属的异步语义。永远不要将 LLM/聊天请求形态提供给用户的 Seedance 视频。

## 面向中国检索说明

2026-06-20 的中文检索找到官方面向中国的平台，已在此处代表：字节跳动 Seed、火山引擎方舟、BytePlus ModelArk、豆包、即梦/剪映与 CapCut/剪映。RunningHub 式托管 ComfyUI 工作流与中文商业伙伴新闻可作为有用上下文，但除非提供商自有的 API 页面暴露端点、模型 ID、价格、账户访问与策略条款，否则不是自助式 API 平台。

## 平台专属声明

回答生产使用问题时，包含：

- 平台名称；
- 核验日期；
- 已知时的模型或工作流名称；
- 声明是官方、合作方、包装器还是现场观察；
- 使用前必须重新检查的内容。

## 真实人物规则

真实人物图像、肖像与人声是授权敏感的。某些平台可能提供身份验证流程，另一些可能拒绝或限制真实人物参考。不要从上传的资产推断同意。

## V2V、R2V 与 FLF2V 边界

官方字节跳动材料支持多模态参考、I2V/R2V 范例、剪辑与延长。火山引擎现已在视频生成平台上记录首帧与尾帧角色。将 `FLF2V` 保留为标签注意事项，因为工作流名称因产品平台而异，但不要说首尾帧本身仅限合作方。