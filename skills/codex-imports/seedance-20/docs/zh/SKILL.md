<!-- AUTO-TRANSLATED: 源文件 = ../../SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->
<!-- 注意: YAML frontmatter 保持原文不动 -->

---
name: seedance-20
description: "This skill should be used when creating, improving, or troubleshooting Seedance 2.0 video on any surface - Dreamina, Jimeng, CapCut, Doubao, Volcengine/Ark, BytePlus, Runway's Seedance route, fal, or third-party provider/router surfaces such as EvoLink, OpenRouter, Kie.ai, PiAPI, LaoZhang, Runware, ModelsLab, AI/ML API, MuAPI, SeeGen, and Segmind - including text/image/video/reference-to-video prompts, first/last frame, dialogue, lip-sync and audio, IP-safe rewrites, API, pricing and model-ID questions, and zh/ja/ko/es/ru prompt work. Not for non-Seedance models (Sora, Veo, Kling, Runway's own Gen models) or image-only prompting."
license: MIT
user-invocable: true
tags: [seedance]
metadata:
  version: "6.3.0"
---

# seedance-20

Seedance 2.0 在智能体执导视频工作中的运行回路。使用此根技能做路由、核实事实、保护参考，并在加载专门的子技能前保持提示词紧凑。

## 灵魂

这个技能的存在，是为了让带着感受而来的人能带着一段影片离开。三条原则支配下方所有内容：

1. **听清话语背后的意图。** 用户描述的是结果（"让它感觉像家"），而不是参数。每道关卡与子技能都将感受转化为工艺；它们中任何一个都不应将翻译工作推回给用户。
2. **让故事保持鲜活。** 在对话中持有故事状态：主体、模式、外观、参考、已决定的约束以及先前失败的东西。每个技能在询问任何事之前先读取它，在执行后更新它。用户不应重复任何决定，新的请求应继承已经构建的世界。
3. **随用户一同进化。** 对初学者说得平实，对专业人士用导演语言——并在同一用户从一种状态成长到另一种时及时察觉。语气可调，标准不变。

## 快速通道

多数请求是来自只想看看自己想法的非专家的一段短片段。不要在它们身上跑完整套关卡。当请求是单一独立片段、来自非专家、无 IP/肖像/品牌/真实人物或安全标记、无平台事实问题（API、价格、模型 ID、限制、地区）时，走快速路径：

1. 直接进入 `[skill:seedance-interview-short]` —— 或者如果想法已经清晰就直接写简报 —— 然后进入 `[skill:seedance-prompt-short]`。
2. 从记忆中内联应用工艺：一个可见的节拍、一个有动机的摄影机运动、一个有动机的光源、声音意图，以及导演连贯性规则（命名一个意图；让摄影机、灯光和表演服务于它）。仅在实际触发时加载 `[ref:directing-engine]`、`[ref:capability-map]`、`[ref:allocation-model]` 以及源关卡或专业关卡。
3. 视为一个片段：暂时不问序列或续拍问题。仅在第一稿之后，或用户说继续、延长、下一部分或更长时，才提出"这是否应该是系列、第二部分或更长"。
4. 让单片段提示词保持紧凑（约 40–110 词），除非活跃平台是经验证的更严格 API，并将导演语言（走位、导演声音、镜头契约）留在内部简报中 —— 用平实的话与用户交流。

当请求触发关卡时，立刻离开快速通道：IP/肖像/品牌/安全风险进入安全关卡（步骤 9）；平台事实问题加载源关卡；电影、客户或交付请求加载专业关卡；长故事、相连片段或续拍进入序列关卡。对安全性存疑时，离开快速通道。下方的运行回路是完整流程 —— 快速通道是常见情况的默认值，它跳过的每一道关卡都只隔一个信号。

## 运行回路

1. 受理：识别用户目标、制作阶段、目标平台、模式、时长、画幅、参考、音频需求、可交付物和安全/版权风险。如果受理暴露明显的安全、IP、肖像或规避风险，在任何规划前直接跳到安全关卡（步骤 9）。
2. 源关卡：在做出平台声明前，加载 `[ref:api-status]` 和 `[ref:source-registry]`。针对 Runway、火山引擎、fal、提供商/路由或面向中国市场的平台细节，还需加载 `[ref:platform-surface-matrix]`。
3. 专业关卡：如果用户要求电影、广告、活动、客户、交付、本地化、调色、声音、字幕、后期、QC 或多镜头工作，在动笔前加载 `[ref:pro-filmmaking-standards]`。
4. 序列关卡：在模式关卡前将请求分类为 `standalone_clip` 或 `sequence_project`。长故事、相连片段、续拍/延长/下一部分请求、密集动作/对白场景、活动、或任何节拍无法清晰放入一次已验证活跃平台生成的创意，使用 `sequence_project`。对于序列工作，加载 `[skill:seedance-sequence]`、`[ref:sequence-project-state]`、`[ref:continuation-handoff]` 和 `[ref:prompt-compiler]`；对于续拍、修复尾部或重新锚定请求，还需加载 `[skill:seedance-continuation]`。
5. 模式关卡：在撰写自然语言前选择 T2V、I2V、V2V、R2V、FLF2V、剪辑、原生延长（在经验证时）或先排错。

   模式可用性因平台而异：剪辑和延长存在于 Dreamina 和方舟路由；fal 没有专用延长端点 —— 在 fal 上续拍片段时，优先使用参考到视频并以先前片段作为视频参考（保持动作和音频上下文），并将图像到视频链式以其尾帧作为回退。提供商/路由平台可以重命名同一作业类型、隐藏字段或仅暴露选定的模式；在实施前重新检查其当前文档。

6. 能力检查：在规划任何镜头、模式或预算时，加载 `[ref:capability-map]` 以按模型能力与已知边界设计，加载 `[ref:allocation-model]` 以在动笔前决定提示词的保真度预算花在哪里。
7. 参考映射：为每个资产分配一个主要角色：身份、首帧、尾帧、产品、环境、动作、摄影机、时序、音频或风格。陈述不应传递什么。
8. 多语言关卡：如果提示词使用中文、俄语、日语、韩语、西班牙语或代码混合措辞，加载 `[ref:multilingual-community-examples]` 并精确保留参考标签。对于母语中文、日语或韩语基于范例的请求，路由到 `[skill:seedance-examples-zh]`、`[skill:seedance-examples-ja]` 或 `[skill:seedance-examples-ko]`。
9. 安全关卡：将 IP、肖像、人声、品牌、真实人物、图形或类似规避的措辞路由到 `[skill:seedance-copyright]` 或 `[skill:seedance-filter]`。
10. 导演：在动笔撰写任何场景前，命名一个意图并让摄影机、镜头、灯光、走位、表演和声音服务于它，而不是选择"电影感外观" —— 内联应用此连贯规则。仅在场景需要差异化处理、必须贯穿多片段持有一种导演声音、或正确的设置确实不清晰时，加载 `[ref:directing-engine]`。
11. 提示词构建：路由到 `[skill:seedance-interview]`、`[skill:seedance-prompt]`、`[skill:seedance-prompt-short]`、`[skill:seedance-sequence]`、`[skill:seedance-continuation]`，或摄影机、动作、灯光、音频、角色、VFX、风格、配方或流水线的领域技能。
12. 质量关卡：运行反 slop 与导演连贯性测试，然后检查一个可见节拍、一个主要摄影机运动、物理有动机的光线、声音意图、连续性锚点、约束、交付注意事项和源日期注意事项。
13. 修复回路：当一个镜头返回时，使用 `[ref:retake-protocol]` 分诊（保留 / 后期修复 / 剪辑 / 重拍 / 重写，每次重拍一个变量，在尝试预算内）；如果它彻底失败，先通过 `[skill:seedance-troubleshoot]` 诊断根因再添加形容词。

## 序列关卡

对于序列项目，在以下内容已知前不要撰写 Clip 01：故事目标、最终故事结局、有序的主要节拍、活跃平台或保守的平台假设、片段预算、当前片段叙事职责、当前片段已完成端点。

在上一段已接受的片段或其实际尾帧被审阅且其观察到的结束状态被记录前，不要撰写续拍提示词。

序列不变量：
- 每个序列提示词都有 `project_id` 和 `clip_id` 血统；
- 已接受的观察状态覆盖计划状态；
- 被拒绝的画面被排除在正典之外，不能成为续拍源；
- 未来提示词保持临时状态，直到先前的已接受镜头被审阅；
- 精确的参考标签在每个片段中保持不变；
- 已完成的节拍不能重演，保留的未来节拍不能提前泄露；
- 连续性状态必须在每个已接受镜头之后更新；
- 最终 Seedance 提示词保持自然语言，除非用户明确要求结构化输出。

## 加载地图

| 情境 | 加载 |
|---|---|
| 模糊想法或缺失简报 | `[skill:seedance-interview]` 或 `[skill:seedance-interview-short]` |
| 长故事、相连片段、活动序列、密集动作/对白场景或需要多次生成的提示词 | `[skill:seedance-sequence]`、`[ref:sequence-project-state]`、`[ref:prompt-compiler]` |
| 继续、延长、下一部分、修复尾部、衔接已知状态或从已接受画面重新锚定偏移 | `[skill:seedance-continuation]`、`[ref:continuation-handoff]`、`[ref:continuity-qc]` |
| 审阅生成的镜头并在下一提示词前更新正典 | `[ref:retake-protocol]`、`[ref:sequence-project-state]`、`[ref:continuation-handoff]` |
| 密集动画分镜或多镜头提示词 | `[ref:dense-storyboard-mode]`、`[ref:multishot-grammar]`、`[ref:2d-anime-grammar]` |
| 生产提示词 | `[skill:seedance-prompt]`、`[ref:quick-ref]`、`[ref:prompt-examples]` |
| 规划任何镜头、模式或预算 | `[ref:capability-map]` |
| 提示词的保真度花在哪里：身份 vs 动作 vs 场景密度 | `[ref:allocation-model]`、`[ref:intent-vs-precision]` |
| 多镜头提示词、片段内剪辑或每时长镜头预算 | `[ref:multishot-grammar]` |
| 2D、动画或赛璐璐风格动作 | `[ref:2d-anime-grammar]`、`[skill:seedance-style]` |
| 专业电影、商业、活动或交付工作流 | `[ref:pro-filmmaking-standards]`、`[ref:shot-list-continuity]`、`[ref:delivery-qc]` |
| 紧凑提示词或中文压缩 | `[skill:seedance-prompt-short]`、语言词汇参考 |
| 为场景选择正确的摄影机、灯光、走位、表演和声音，保持每个选择都有动机，或贯穿长故事持有一种导演风格 | `[ref:directing-engine]` |
| 摄影机、镜头、走位、镜头契约 | `[skill:seedance-camera]`、`[ref:cinematography-shot-language]` |
| 图像参考 / 首帧 | `[ref:i2v-guide]`、`[ref:reference-workflow]` |
| 首尾帧 | `[ref:first-last-frame-guide]` |
| API、Runway、火山引擎、fal、提供商/路由平台、面向中国的平台、工作流、价格、模型 ID | `[skill:seedance-pipeline]`、`[ref:api-workflow]`、`[ref:model-name-map]` |
| 调色、ACES、HDR/SDR、画幅、字幕、音频后期或 QC | `[ref:color-pipeline-aces]`、`[ref:aspect-ratio-delivery]`、`[ref:subtitles-localization]`、`[ref:audio-post-delivery]`、`[ref:delivery-qc]` |
| 类型模板、范例或特定类型的完整导演范例 | `[skill:seedance-recipes]`、`[ref:examples-by-mode]`、`[ref:genre-guides]`、`[ref:directing-engine-genre-library]` |
| 中文范例或安全的中文改写 | `[skill:seedance-examples-zh]`、`[skill:seedance-vocab-zh]`、`[ref:vocab/zh]` |
| 日语范例或安全的日语改写 | `[skill:seedance-examples-ja]`、`[skill:seedance-vocab-ja]`、`[ref:vocab/ja]` |
| 韩语范例或安全的韩语改写 | `[skill:seedance-examples-ko]`、`[skill:seedance-vocab-ko]`、`[ref:vocab/ko]` |
| 俄语/西班牙语或混合语言范例 | `[skill:seedance-vocab-ru]`、`[skill:seedance-vocab-es]`、`[ref:multilingual-community-examples]` |
| 冗余或触发过滤的英语措辞 | `[skill:seedance-vocab-en]`、`[skill:seedance-antislop]` |
| 糟糕的结果 | `[skill:seedance-troubleshoot]` |
| 一个镜头回来了：保留、后期修复、剪辑、重拍或重写 | `[ref:retake-protocol]` |
| 为何一条规则有效，或没有规则覆盖的新颖案例 | `[ref:model-mechanics]` |

精确保留参考标签，保持提示词简短，永远不要将现场观察的社区技巧转化为官方平台保证。对于专业电影制作请求，交付角色所需的工作流对象：镜头列表、镜头契约、连续性账本、提示词、后期交接、本地化计划或 QC 清单。