<!-- AUTO-TRANSLATED: 源文件 = ../../references/source-registry.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 来源注册表

last_verified: 2026-06-20

在对 Seedance 2.0 平台行为做出事实声明前使用本注册表。优先主要公开来源，附核验日期，并将易变声明标记为需重新检查。本文件是声明边界地图，而非对每个产品平台或地区访问的保证。

## 证据标签

| 标签 | 含义 | 必需措辞 |
|---|---|---|
| `confirmed` | 在核验日期直接可见于主要公开来源。 | `Public sources state... as of [date].` |
| `volatile` | 可能因平台、账户、地区、价格页面或模型更新而变化。 | `Recheck before giving numbers or promises.` |
| `field-observed` | 重复的创作者/从业者模式，但不是官方平台事实。 | `Field observation, not guaranteed platform behavior.` |
| `unverified` | 合理但未被主要来源确认。 | `Requires testing or owner confirmation.` |
| `internal` | 由本技能包推导的仓库指引。 | `Use as workflow guidance, not external fact.` |

## 主要来源层级

| 主题 | 首选来源 | 证据标签 | 核验备注 | 声明边界 |
|---|---|---|---|---|
| 核心模型能力 | ByteDance Seedance 2.0 官方页面：https://seed.bytedance.com/en/seedance2_0 | confirmed | 在发布说明、API 声明或营销文案前重新检查。 | 仅用于广泛的公共能力定位。 |
| 发布能力与已知限制 | ByteDance Seedance 2.0 官方发布文章：https://seed.bytedance.com/en/blog/seedance-2-0-official-launch | confirmed | 在讨论多模态参考、剪辑、音频与平台范例时重新检查。 | 不要将发布范例转化为每个平台的保证行为。 |
| 模型卡与论文 | arXiv 模型卡：https://arxiv.org/abs/2604.14148 | confirmed | 有助于模型族背景与基准注意事项。 | 提供方撰写的论文；不要用作当前商业访问证明。 |
| API 教程与平台文档 | BytePlus ModelArk 与火山引擎方舟文档：https://docs.byteplus.com/en/docs/ModelArk/2291680、https://docs.byteplus.com/en/docs/ModelArk/1520757、https://www.volcengine.com/docs/82379/1520757?lang=zh 与 https://www.volcengine.com/docs/82379/2291680?lang=zh | volatile | 在程序性 API 指引前重新检查端点、请求字段、模型 ID、任务流与价格。 | API 形态可能因地区、账户、发布渠道或试用关卡而异。 |
| 视频生成任务生命周期 | 火山引擎视频生成教程：https://www.volcengine.com/docs/82379/2298881?lang=zh | volatile | 在实施前重新检查 create/query/list/cancel-delete 流、首尾帧角色、返回尾帧、工具与文件参考规则。 | 官方平台，但字段与账户支持可能变化。 |
| 模型 ID 与价格 | 火山引擎模型列表/价格与 BytePlus 价格页面，包括 https://docs.byteplus.com/en/docs/ModelArk/1544106 | volatile | 始终在引用数字或 ID 前立即重新检查。Seedance 2.0 Mini ID 在 2026-06-20 源可见，但访问在官方文档中仍试用把关至 6 月 22 日。 | 火山引擎价格仅可在附日期、货币、模型、平台与注意事项的情况下引用；永远不要从不完整的 JS 渲染页面推断 BytePlus 价格。 |
| API 服务生态新闻 | 火山引擎开发者文章：https://developer.volcengine.com/articles/7628567056649125942 | volatile | 用作 API 服务推广、安全标准、肖像授权、虚拟肖像与 BytePlus 海外服务声明的官方生态/新闻证据。在实施前重新检查文档/控制台。 | 不是 API 契约、价格表或授权保证。 |
| BytePlus 价格页面 | BytePlus ModelArk 价格文档：https://docs.byteplus.com/en/docs/ModelArk/1544106 与遗留文档如 https://docs.byteplus.com/en/docs/ModelArk/1099320 | volatile | 在引用 Seedance 2.0 价格、配额或模型 ID 前重新检查实时官方页面或控制台。BytePlus 目前显示 `dreamina-seedance-2.0-mini` 价格行且该行不支持 1080p。 | 某些页面在静态抓取中按 JavaScript 渲染；不要从不完整的静态内容推断价格。 |
| 提示词指南 | 火山引擎 Seedance 2.0 提示词指南：https://www.volcengine.com/docs/82379/2222480?lang=zh | confirmed | 在添加多模态参考措辞或提示词范例时重新检查。 | 提示词指引是官方指南，而非每个平台暴露每个控件的保证。 |
| 首尾帧工作流 | 火山引擎教程与 ComfyUI 合作方文档：https://www.volcengine.com/docs/82379/2298881?lang=zh 与 https://docs.comfy.org/zh/tutorials/partner-nodes/bytedance/seedance-2-0 | volatile | 火山引擎记录首尾帧角色；ComfyUI 使用 FLF2V 工作流词汇。在使用确切字段前重新检查活跃平台。 | `FLF2V` 标签是平台专属，但首尾帧能力在火山引擎上有文档。 |
| 人脸、肖像与人声行为 | 活跃产品平台、官方策略与用户授权 | volatile | 重新检查当前平台行为与授权上下文。 | 不要从文件上传推断同意。 |
| Runway Seedance 2 平台 | Runway API 与帮助文档：https://docs.dev.runwayml.com/guides/seedance/、https://docs.dev.runwayml.com/guides/models/、https://docs.dev.runwayml.com/api-details/api_changelog/、https://docs.dev.runwayml.com/assets/inputs/ 与 https://help.runwayml.com/hc/en-us/articles/50488490233363-Creating-with-Seedance-2-0 | volatile | 在生产使用前重新检查时长、画幅、音频/参考组合规则、上传处理、地区可用性、计划要求与 SDK 支持。Seedance 专属指南携带最模型专属的 Runway 范例；若原始 HTTP 检查器报告 404，在放弃该源前通过浏览器/已索引文档核验。 | 官方 Runway 平台，而非字节跳动/火山引擎 API 契约。 |
| fal Seedance 2.0 平台 | fal 模型/API 页面：https://fal.ai/models/bytedance/seedance-2.0/text-to-video、https://fal.ai/models/bytedance/seedance-2.0/image-to-video 与 https://fal.ai/models/bytedance/seedance-2.0/reference-to-video | volatile | 在引用数字或编写 API 调用前重新检查端点、请求字段、分辨率档、时长与按秒计费。 | 官方 fal 平台行为，而非火山引擎、BytePlus 或 Runway 行为。快速端点共享文档化模式；多镜头可靠性在快速档下降是现场观察，而非官方。 |
| 其他提供商/路由平台 | 提供商自有页面与文档：https://evolink.ai/seedance-2-0、https://openrouter.ai/bytedance/seedance-2.0、https://kie.ai/seedance-2-0、https://piapi.ai/seedance-2-0、https://piapi.ai/docs/seedance-api/seedance-2、https://docs.laozhang.ai/en/api-capabilities/seedance2-video-generation、https://runware.ai/docs/models、https://modelslab.com/seedance-2、https://docs.aimlapi.com/api-references/video-models/bytedance/seedance-2.0、https://muapi.ai/、https://seegen.ai/ 与 https://www.segmind.com/models/seedance-2.0 | volatile | 在编写代码或引用数字前重新检查每个提供商页面、API 文档、端点基 URL、模型 ID、价格、账户访问、审核、人脸/参考模式、输出 URL 寿命与权利条款。 | 仅第三方提供商/路由行为；不是官方字节跳动、火山引擎、BytePlus、Runway 或 fal 行为。本仓库不背书任何宿主。 |
| 面向中国的提供商检索 | 官方中文/产品来源：https://seed.bytedance.com/zh/seedance2_0、https://www.volcengine.com/docs/82379/2291680?lang=zh、https://www.volcengine.com/docs/82379/1520757、https://jimeng.jianying.com/ai-tool/home 与字节跳动自有的豆包/即梦/剪映/CapCut 平台；工作流或新闻范例包括 RunningHub 工作流与商业伙伴报告 | field-observed | 在将中文结果视作公开 API 提供商前重新检查当前官方中文文档与提供商自有页面。 | 不要将工作流宿主、博客或商业伙伴新闻列为自助式 API 平台，除非它们发布提供商自有的 API 文档。 |
| Agent Skills 结构 | OpenAI Codex Agent Skills 文档：https://developers.openai.com/codex/skills、OpenAI Academy 插件/技能解释器：https://openai.com/academy/codex-plugins-and-skills/、OpenAI Codex 插件文档与 Agent Skills 开放标准：https://agentskills.io/ | confirmed | 在更改安装指引或根技能布局前重新检查。 | 打包指引，而非 Seedance 平台能力。 |
| Runway MCP 智能体平台 | Runway MCP 公告：https://runwayml.com/news/mcp | confirmed | 仅用于智能体平台可用性。 | 不改变 Seedance 模型能力；计划与连接器访问是 Runway 专属。 |
| 音视频评测词汇 | AVBench 与 VABench 论文：https://arxiv.org/abs/2605.24652 与 https://openaccess.thecvf.com/content/CVPR2026/papers/Hua_VABench_A_Comprehensive_Benchmark_for_Audio-Video_Generation_CVPR_2026_paper.pdf | field-observed | 用于评测维度如音视频同步与跨模态一致性。 | 基准框架，而非产品访问或官方 Seedance 性能证明。 |
| 专业镜头语言 | ASC 摄影机运动教育与制作镜头列表实践：https://theasc.com/article/shot-craft-camera-movement/ 与 https://www.studiobinder.com/blog/shot-list-template-free-download/ | field-observed | 用于镜头契约、摄影机运动与镜头列表字段。 | 行业工作流指引，而非 Seedance 能力证明。 |
| 连续性实践 | ScreenSkills 剧本监督角色：https://www.screenskills.com/job-profiles/browse/film-and-tv-drama/technical/script-supervisor-film-and-tv-drama/ | field-observed | 用于连续性锚点如服装、道具、视线、屏幕方向与备注。 | 角色指引，而非平台行为。 |
| 色彩管理与 ACES | ACES 文档与 AMF 规范：https://docs.acescentral.com/background/overview/ 与 https://docs.acescentral.com/amf/specification/ | confirmed | 用于调色流水线词汇与交接元数据。 | 提示词可以描述外观；它不能证明 ACES 合规。 |
| 画幅与交付容器 | DCI、ISDCF 与买方/平台规格：https://www.dcimovies.com/dci-specification/ 与 https://registry-page.isdcf.com/ | field-observed | 用于画幅/容器分离与命名注意事项。 | 始终遵循签约的交付规格。 |
| 字幕与字幕 | Netflix 时序文本、WebVTT 与可访问性规则：https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements、https://w3c.github.io/webvtt/ 与 https://www.law.cornell.edu/cfr/text/47/79.1 | volatile | 用于字幕/SDH/强制叙述规划与字幕安全构图。在引用前重新检查买方、语言、地区与平台要求。 | 交付要求因买方、语言、地区与平台而异。 |
| 音频响度与后期 | ITU BS.1770、EBU R128、ATSC A/85 与买方声音规格：https://www.itu.int/rec/R-REC-BS.1770、https://tech.ebu.ch/fr/publications/r128、https://www.atsc.org/atsc-documents/a85-techniques-for-establishing-and-maintaining-audio-loudness-for-digital-television/ 与 https://partnerhelp.netflixstudios.com/hc/en-us/articles/360001794307-Netflix-Sound-Mix-Specifications-Best-Practices-v1-6 | volatile | 用于 stems、M&E、同步、响度与混音交接语言。在引用前重新检查目标买方或平台规格。 | 提示词音频不是认证的最终混音。 |
| 交付与 QC | SMPTE IMF、DPP 规格、Netflix 交付规格与 MovieLabs OMC：https://www.smpte.org/standards/st2067、https://www.thedpp.com/specs/、https://partnerhelp.netflixstudios.com/hc/en-us/sections/10066414335891-Delivery-Specifications 与 https://movielabs.com/ontology-for-media-creation/ | volatile | 用于交付预检与元数据/版本化指引。在最终交付前重新检查签约平台规格。 | 签约平台规格覆盖通用指引。 |
| 社区实践 | 抖音、Bilibili、CSDN、Reddit、Habr、创作者备注、工作流截图 | field-observed | 仅用作从业者指引。 | 标记为非官方；不要作为模型保证陈述。 |
| 本地化与混合语言提示词 | 日语、韩语、西班牙语、俄语与多语言社区指南加论坛观察 | field-observed | 在发布前重新检查公开页面；仅用于词汇与范例结构。 | 代码混合可以澄清安全提示词，但永远不要将其视作官方过滤行为或安全规避。 |
| 社区提示词语料 | YouMind/OpenLab、公开提示词画廊、论坛集合 | field-observed | 在安全分类后仅挖掘结构、时序、词汇与失败模式。 | 不要将不安全、对 IP 敏感或真实人物的提示词复制到活跃范例中。 |
| 仓库指引 | README、SKILL.md、references、evals | internal | 保持与来源注册表与 API 状态一致。 | 工作流指引，而非平台事实的外部来源。 |

## 必需声明模式

回答平台状态问题时，说：`As of 2026-06-20, public official sources describe Seedance 2.0 as supporting text, image, audio, and video inputs, including multimodal references for composition, camera language, motion rhythm, visual effects, and sound. Volcengine documents first/last-frame roles, Runway documents a Seedance 2 surface, fal documents text-to-video, image-to-video, and reference-to-video endpoints, and additional provider/router pages list Seedance 2.0 access, but access, pricing, model IDs, upload limits, regions, resolution, audio-combination rules, face/reference handling, and authorization behavior remain surface-specific and should be rechecked.`

回答价格、配额、上传限制、模型 ID 或地区可用性问题时，不要猜测。声明这些值是易变的且需要检查当前官方平台。

回答肖像、人脸与人声问题时，分离三件事：技术平台支持、权利/授权与提示词安全。不要从文件上传推断同意。

使用社区来源时，说：`Field observation, not guaranteed platform behavior.`