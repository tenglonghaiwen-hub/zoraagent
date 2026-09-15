<!-- AUTO-TRANSLATED: 源文件 = ../../references/api-status.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# Seedance 2.0 API 与平台状态

last_verified: 2026-06-20
confidence: 截至核验日期的公开来源快照；分节日期适用之处（Seedance 2.0 Mini、其他提供商/路由与面向中国检索记录于 2026-06-20，平台安全策略与分辨率记录于 2026-06-14，海外 API 状态与 Replicate 记录于 2026-06-13，fal 章节复核于 2026-06-11，更早平台章节核验于 2026-05-30）；不保证每个平台上的访问、价格、模型 ID、上传限制、授权行为或地区可用性

## 经公开来源确认

- 字节跳动官方的 Seedance 2.0 页面将其描述为支持文本、图像、音频和视频输入的统一多模态音视频架构。
- 字节跳动的发布文章称 Seedance 2.0 可使用最多 9 张图像、3 段视频片段、3 段音频片段，外加自然语言指令。
- 官方材料称参考可引导视觉构图、摄影机语言、动作节奏、特效和声音特征。
- 官方材料将视频延长和剪辑描述为受支持的创作工作流。
- 官方材料描述了 15 秒多镜头音视频输出和双通道音频。
- arXiv 模型卡有助于理解模型族背景，包括 4–15 秒音视频生成、论文中 480p/720p 原生画幅以及 Fast 变体。
- 火山引擎/方舟文档发布了 Seedance 2.0 教程与视频生成 API 导航，包括 create/query/list/cancel-delete 任务流，但确切模式、价格、模型 ID、地区和限制必须实时重新检查。
- 火山引擎的模型列表页面在 2026-05-29 被观察到有更新。
- 火山引擎的 Seedance 2.0 教程现在列出 Mini 试用公告以及 `doubao-seedance-2-0-mini-260615`，与早期的 `doubao-seedance-2-0-260128` 和 `doubao-seedance-2-0-fast-260128` 模型 ID 并列。
- 火山引擎的通用视频生成教程在 2026-05-29 被观察到有更新，是当前重新检查任务生命周期、首尾帧角色、返回尾帧、网络搜索工具与文件/参考组合的第一手平台。
- 火山引擎的提示词指南在 2026-05-15 被观察到有更新，强化了多模态参考提示词。
- 火山引擎的价格页面在 2026-05-28 被观察到有更新。引用火山引擎价格时仅附带平台、日期、货币、模型/分辨率/时长上下文与重新检查警告。对未实时核验的 JavaScript 渲染 BytePlus 页面，保留更强的"不引用"注意事项。
- 一篇火山引擎开发者社区文章称 Seedance 2.0 API 服务已上线，并提及肖像/版权安全标准、人脸验证、肖像授权、虚拟肖像资产与 BytePlus 海外 API 服务。视作官方生态/新闻证据，而非 API 契约。
- 公开 BytePlus 页面可能在静态抓取中按 JavaScript 渲染。在未经实时官方核验前，不要从此类页面引用 Seedance 2.0 BytePlus 价格或模型 ID。
- Runway 的官方 Seedance 2 指南和稳定的 Models、API Changelog、Inputs 与帮助页面在 Runway 平台上列出 Seedance 2.0/Seedance 2.0 Fast。Seedance 专属指南记录了 `seedance2` 范例与参考字段注意事项；若原始 HTTP 检查器报告 404，请通过浏览器/已索引文档核验后再放弃该来源。
- BytePlus ModelArk 文档现已列出 Dreamina Seedance 2.0 Mini、`dreamina-seedance-2-0-mini-260615` 以及 `dreamina-seedance-2.0-mini` 的价格行。将连字符 ID 与带点的价格标签视作 BytePlus 平台专属名称，而非每个提供商的规范名称。
- 2026-06-20 可见的其他提供商/路由页面包括 EvoLink、OpenRouter、Kie.ai、PiAPI、LaoZhang、Runware、ModelsLab、AI/ML API、MuAPI、SeeGen 与 Segmind。将它们视作平台专属访问路径，而非官方字节跳动/火山引擎/BytePlus 契约。
- 2026-06-20 面向中国的检索确认最强来源仍是官方字节跳动 Seed、火山引擎方舟、BytePlus ModelArk、豆包、即梦/剪映与 CapCut/剪映平台。中文工作流文章、商业伙伴新闻或托管的 ComfyUI 工作流不是公开 API 提供商，除非它们发布提供方自有的 API 文档。
- 合作方工作流文档（如 ComfyUI）暴露 T2V、R2V 与 FLF2V 工作流词汇，但那些文档是平台专属的。
- 最近的音视频生成基准论文（包括 AVBench 与 VABench）有助于音视频一致性评测词汇的构建，但它们不是 Seedance 平台访问来源。

## 海外 API 状态 —— 版权暂停 *(记录于 2026-06-13)*

权威报道（Variety 与 CNBC，2026 年 2–3 月）记录了 Seedance 2.0 于 2026-02-12 在中国发布后，迪士尼、华纳兄弟、派拉蒙、Netflix 与美国电影协会就涉嫌侵权向字节跳动发出停止侵权函，字节跳动**暂停了计划中的海外 API 推广（约 2026-03-15）**，待解决并新增安全策略后再说。这对指南的含义：

- 将海外/全球 Seedance 2.0 API 访问视为**有争议且易变**，而非保证可用。在依赖任何平台前，实时核验访问、地区与权利姿态。
- 第三方平台（fal、Atlas Cloud、Replicate、EvoLink、OpenRouter、Kie.ai、PiAPI、LaoZhang、Runware、ModelsLab、AI/ML API、MuAPI、SeeGen、Segmind 等）在不同日期显示了活跃的 Seedance 2.0 端点；这不构成稳定的官方全球可用 —— 访问已经并可能继续变化。在生产前立即重新检查。
- 这一争议使仓库的常驻规则变得可操作，而非假设：永远不要复刻受保护角色、场景或真实人物肖像 —— 正是这种行为触发了暂停。

## 平台安全策略 —— 已上线 *(记录于 2026-06-14)*

权威报道（SCMP、CNBC、The Next Web，2026 年 2–4 月）记录了字节跳动为应对争议而在 Seedance 2.0 中新增的安全策略。这些已不再是假设 —— 将它们视作官方平台上的当前行为，并设计提示词来*配合*它们：

- **真实人脸输入屏蔽：** 包含真实人脸的图像或视频的生成受到限制（反深伪）。不要假设真实人物参考会被接受；将肖像工作路由到 `[skill:seedance-copyright]`。
- **受版权保护角色屏蔽：** 可识别受保护角色（如史莱克、海绵宝宝、达斯·维达）的生成被屏蔽。这是执行而非仅是策略 —— `[skill:seedance-filter]` 的原创角色改写是可行路径。
- **可见水印 + 输出上的 C2PA Content Credentials**，以及**不可见水印**与主动 IP 监控（字节跳动声明即使模型输出被分享或修改后，其仍可识别并采取行动）。

对技能的影响：误报修复与 IP 安全改写不是可选的润色 —— 它们是提示词如何清除实时关卡的方式。平台专属行为仍然各异；在活跃平台上核验。

## 分辨率 —— 模型 vs 平台 *(记录于 2026-06-14)*

主要来源（arXiv 模型卡与字节跳动 Seed 页面）声明 Seedance 2.0 的**原生输出分辨率是 480p/720p**。更高分辨率是**平台专属的，而非模型原生保证**，即使单一平台文档也可能不一致：火山引擎/方舟（Pro）、BytePlus、Atlas Cloud、Runway 与 WaveSpeed 暴露**1080p**；fal 的散文指南说 480p/720p 而其模型与价格页面列出 1080p（见下方 fal 章节）。将 480p/720p 视为基线能力，任何 1080p/“2K”声明都视为按平台功能在调用时核验 —— 永远不要视为通用模型规格。

## fal —— 授权提供商，全球 *(新增 2026-06-10；字段、分辨率与价格复核于 2026-06-11)*

**端点：** `text-to-video`、`image-to-video`（起始图像 + 可选 `end_image_url` 用于 A→B）、`reference-to-video` —— 每个都有 `/fast` 档。
**时长：** 4–15 秒或 `auto`（模型根据提示词复杂度确定大小；多镜头 → 更长）。**画幅：** 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 / auto。
**参数（t2v）：** `prompt`、`resolution`、`duration`、`aspect_ratio`、`generate_audio`（默认开启；**音频包含在内，无额外生成成本**）、`seed`（**可复现性辅助，非硬锁定** —— 即使相同种子输出也可能变化）。
**参数（i2v）：** t2v 字段加上 `image_url`（起始帧）与可选 `end_image_url`（A→B）。不要向 t2v 端点发送图像字段。
**参数（r2v）：** 参考资产放入数组字段 `image_urls`、`video_urls`、`audio_urls`（核验于 2026-06-11）—— 不要在参考中复用 i2v 的 `image_url`/`end_image_url` 字段；在实施前重新检查实时模式。
**参考（r2v）：** @Image×9、@Video×3、@Audio×3、≤12 文件。图像 JPEG/PNG/WebP ≤30 MB；视频 480–720p，合计 ≤15 秒，总计 <50 MB；音频 MP3/WAV 每个 ≤15 MB，合计 ≤15 秒；**音频需要至少 1 张图像或视频。**
**分辨率（核验于 2026-06-11）：** 标准端点列出 480p/720p/**1080p（约 $0.682/秒）**；快速端点封顶 720p。散文指南曾落后于模式 —— 在调用时按端点核验。
**价格（引用前实时核验）：** 720p 标准约 $0.30/秒 · 快速约 $0.24/秒 · 视频参考 ×0.6 · 1080p 约 $0.682/秒。
**提示词：** 散文指令；多镜头使用 `Shot 1:/Shot 2:` 标签；r2v 文档也接受时间戳节奏短语作为辅助提示。**快速档：** fal 官方文档给快速端点相同的模式和多镜头支持；现场报告仍偏向 Standard 档用于多镜头、慢动作和滑动摄影机运动 —— 视为现场指引，而非提供方文档。
**无专用延长端点** —— 延长是 Dreamina 应用功能。要在 fal 上续拍片段，优先使用参考到视频并以先前片段作为视频参考（保留动作和音频上下文）；将图像到视频从先前片段尾帧链式化作为回退。

## Seedance 2.0 Mini *(记录于 2026-06-20)*

官方火山引擎与 BytePlus 文档现将 Seedance 2.0 Mini 作为更轻的 Seedance 2.0 系列通道暴露。使用规范公开措辞 `Seedance 2.0 Mini`，而非 `Seedance V2 Mini`，除非引用用户或包装器标签。

- **火山引擎方舟：** 可见模型 ID `doubao-seedance-2-0-mini-260615`。火山引擎公告称从 2026-06-15 至 2026-06-22，它仅通过控制台体验中心可用，并发数限制为 1，API 支持预计在 6 月 22 日北京时间之后。在给出 API 指令前重新核验 6 月 22 日之后的状态。
- **BytePlus ModelArk：** 可见模型 ID `dreamina-seedance-2-0-mini-260615`；BytePlus 文档描述了 2026-06-15 至 2026-06-22 相同的通过 Model Playground 的试用窗口限制。BytePlus 价格页面也显示 `dreamina-seedance-2.0-mini` 行并声明该行不支持 1080p。在引用数字前实时重新核验价格。
- **Dreamina/CapCut 网页：** 官方 Dreamina 页面将 Seedance 2.0 Mini 描述为更快/更便宜，并在 Dreamina 中可用。将其工作流声明视作 Dreamina 网页平台行为，而非 API 模式。

不要将 Seedance Mini ID 与 `doubao-seed-2-0-mini-*` 混淆，后者属于非 Seedance 的 Seed/豆包模型命名通道。

## 其他提供商/路由平台 *(记录于 2026-06-20)*

这些是第三方或路由平台。它们对集成规划有用，但每一个都可以重命名模式、更改模式、隐藏字段、更改价格或施加自己的审核与账户规则。

- **EvoLink：** 公开页面记录了 `POST /v1/videos/generations`，通过 `GET /v1/tasks/{task_id}` 轮询，Bearer 认证，`seedance-2.0-text-to-video`，4–15 秒时长，480p/720p/1080p 质量选项，以及按秒计费。
- **OpenRouter：** 模型页面将 `bytedance/seedance-2.0` 列为具有文本到视频、图像到视频（带首尾帧控制）以及多模态参考到视频的视频模型。将提供商路由、token/秒核算以及支持的提供商视作 OpenRouter 专属。
- **Kie.ai、PiAPI 与 LaoZhang：** 公开页面或文档列出 Seedance 2.0 API 访问，但模式不同。PiAPI 记录了以 `seedance` 为模型与 `seedance-2-preview` / `seedance-2-fast-preview` 任务类型的通用任务 API；LaoZhang 记录了 `/seedance/api/v3` 基路径；Kie.ai 公开页面强调 API 访问与多模态支持。在实施前重新检查确切字段。
- **Runware、ModelsLab、AI/ML API、MuAPI、SeeGen 与 Segmind：** 提供商页面列出 Seedance 2.0、Seedance 2.0 Fast 或相关字节跳动视频路由。仅将它们视作额外的提供商/路由候选；不要在没有实时核验的情况下将它们的模型 ID、人脸处理、水印、权利或价格声明复制到官方范例中。

## 面向中国的提供商检索 *(记录于 2026-06-20)*

对于中国提供商问题，从官方或字节跳动自有的平台开始：字节跳动 Seed、火山引擎方舟、BytePlus ModelArk、豆包、即梦/剪映、CapCut/剪映。RunningHub 式托管工作流可作为有用的工作流证据，商业伙伴报告可显示商业采用，但除非提供商发布自己的 API 文档、模型 ID、价格、账户访问规则与审核条款，否则不应视作公开 API 提供商。

## 操作措辞

除非更新的主要来源另有说明，否则使用以下措辞：

> 截至 2026-06-20，公开字节跳动来源将 Seedance 2.0 描述为支持文本、图像、音频和视频输入的统一多模态音视频生成模型。官方发布与模型卡材料称参考可包含最多 9 张图像、3 段视频片段与 3 段音频片段。火山引擎/方舟、Runway、fal 与其他提供商/路由页面发布了 Seedance 2 文档或访问路径，但访问、模型 ID、价格、文件限制、地区可用性、分辨率、音频合成规则、人脸/参考处理与肖像授权仍然是平台专属的，必须在生产使用前重新检查。

## 模型命名规则

- 对官方视频模型线使用 `Seedance 2.0`。
- 仅当活跃平台暴露 Fast 变体时使用 `Seedance 2.0 Fast`。
- 仅当活跃平台暴露 Mini 通道时使用 `Seedance 2.0 Mini`；将 `Seedance V2 Mini` 视作简写而非规范命名。
- 仅对 Runway 的 API 平台使用 `seedance2`。
- 仅在该提供商的平台上使用提供商/路由模型 ID，例如 EvoLink 的 `seedance-2.0-text-to-video`、OpenRouter 的 `bytedance/seedance-2.0`、PiAPI 任务类型或 Runware 的 `bytedance:seedance@2.0`。
- 不要在没有当前来源的情况下将 `Seedance 2.0 Pro` 称为官方视频模型名称。视作模糊的包装器或社区措辞。
- 不要将 `Seed2.0 Pro` 或豆包/Seed 通用模型名称与 Seedance 视频生成混淆。

见 [`model-name-map.md`](model-name-map.md)。

## 声明边界

- 说明 API 可用性、价格、模型 ID、上传限制、授权规则、速率限制与地区可用性必须对照当前主要来源核实。
- 除非当前主要来源声明，避免声明 API 全球可用或不可用。
- 除非当前主要来源声明，避免声明人脸或肖像上传普遍支持或普遍屏蔽。
- 将模型能力与产品平台行为分开。Dreamina/即梦、豆包、火山引擎/方舟、BytePlus/ModelArk、ComfyUI、fal、提供商/路由平台与第三方包装器可能不同。
- 将第三方包装器价格与模型别名视作包装器专属，而非官方。

## 已知限制类别

官方/提供商材料与现场观察指出以下领域为脆弱：

- 细节稳定性；
- 超写实；
- 动态活力；
- 多主体一致性；
- 文本渲染；
- 复杂剪辑；
- 音频失真；
- 多说话者唇形同步；
- 产品/logo 保持；
- 真实人物授权与平台把关。

## 真实人物、肖像与人声规则

真实人物面部、肖像与人声工作流需要授权、法律/伦理合规以及平台专属支持。不要从上传的资产推断许可。在没有明确授权且符合适用规则与用户同意要求的工作流的情况下，不要帮助模仿公众人物、私人、明星或人声。

## 待重新检查的主要来源

*主要来源 URL 列表保留英文原文以便精确核验；这些链接维持英文。*

- https://seed.bytedance.com/en/seedance2_0
- https://seed.bytedance.com/en/blog/seedance-2-0-official-launch
- https://replicate.com/bytedance/seedance-2.0
- https://variety.com/2026/film/news/paramount-disney-bytedance-cease-and-desist-seedance-ai-infringement-ip-1236663663/
- https://www.cnbc.com/2026/02/16/bytedance-safeguards-seedance-ai-copyright-disney-mpa-netflix-paramount-sony-universal.html
- https://arxiv.org/abs/2604.14148
- https://www.volcengine.com/docs/82379/1330310?redirect=1&lang=zh
- https://www.volcengine.com/docs/82379/1520757?lang=zh
- https://www.volcengine.com/docs/82379/2291680?lang=zh
- https://www.volcengine.com/docs/82379/2298881?lang=zh
- https://www.volcengine.com/docs/82379/2222480?lang=zh
- https://www.volcengine.com/docs/82379/1544106?lang=zh
- https://developer.volcengine.com/articles/7628567056649125942
- https://docs.byteplus.com/en/docs/ModelArk/2291680
- https://docs.byteplus.com/en/docs/ModelArk/1520757
- https://docs.byteplus.com/en/docs/ModelArk/1544106
- https://docs.byteplus.com/en/docs/ModelArk/1099320
- https://fal.ai/models/bytedance/seedance-2.0/text-to-video
- https://fal.ai/models/bytedance/seedance-2.0/image-to-video
- https://fal.ai/models/bytedance/seedance-2.0/reference-to-video
- https://docs.dev.runwayml.com/guides/seedance/
- https://docs.dev.runwayml.com/assets/inputs/
- https://evolink.ai/seedance-2-0
- https://openrouter.ai/bytedance/seedance-2.0
- https://kie.ai/seedance-2-0
- https://piapi.ai/seedance-2-0
- https://piapi.ai/docs/seedance-api/seedance-2
- https://docs.laozhang.ai/en/api-capabilities/seedance2-video-generation
- https://runware.ai/docs/models
- https://modelslab.com/seedance-2
- https://docs.aimlapi.com/api-references/video-models/bytedance/seedance-2.0
- https://muapi.ai/
- https://seegen.ai/
- https://www.segmind.com/models/seedance-2.0
- https://docs.dev.runwayml.com/guides/models/
- https://docs.dev.runwayml.com/api-details/api_changelog/
- https://help.runwayml.com/hc/en-us/articles/50488490233363-Creating-with-Seedance-2-0
- https://docs.comfy.org/zh/tutorials/partner-nodes/bytedance/seedance-2-0
- https://arxiv.org/abs/2605.24652
- https://openaccess.thecvf.com/content/CVPR2026/papers/Hua_VABench_A_Comprehensive_Benchmark_for_Audio-Video_Generation_CVPR_2026_paper.pdf