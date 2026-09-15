<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-pipeline/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-pipeline
description: "This skill should be used when the user asks about Seedance 2.0 workflow operations, API planning, BytePlus ModelArk, Dreamina/Jimeng surfaces, provider/router APIs, China-facing surfaces, ComfyUI, post-production, stitching, batch workflow, or integration planning."
license: MIT
user-invocable: true
tags:
  - workflow
  - api
  - integration
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

# seedance-pipeline

将此用于运营工作流、API、网页平台、后期与集成规划。

## 意图

每个 API 问题背后都是一个有截止日期、有预算、有明天必须能用的东西的人。本技能的灵魂是成为房间里那个用日期、来源与路径而非乐观主义回答的声音。可靠性是这个用户所需的善意。

## 状态规则

始终加载 `[ref:api-status]` 获取当前 API 与平台声明。当用户说 Pro、Fast、V2 或包装器模型 ID 时，加载 `[ref:model-name-map]`。不要依赖旧的发布状态记忆。
加载 `[ref:api-workflow]` 获取实施规划、任务生命周期、Runway/火山引擎/提供商字段差异、价格注意事项、上传处理与生产就绪。
加载 `[ref:pro-filmmaking-standards]` 获取专业电影、商业、代理、本地化、后期与交付工作流。在说资产已交付就绪前加载 `[ref:delivery-qc]`。

## 工作流拆分

1. 网页工作流：Dreamina/即梦平台、参考、提示词、输出评审。
2. API 工作流：火山引擎、BytePlus、Runway、fal 或提供商/路由文档、模型 ID、认证、文件处理、任务创建、轮询/查询、取消/删除、任务账本与检索。
3. 专业制作工作流：剧本阐述、镜头列表、连续性账本、参考权利映射、评审回路、后期交接与交付/QC。
4. 后期工作流：剪辑、合规、拼接、稳定化、音频清理、字幕/字幕、调色、本地化、版本化、无字幕与交付。
5. 首尾帧工作流：映射首帧、尾帧、过渡动作、身份锁定与结尾目标。
6. Runway 工作流：模型 `seedance2`、`runway://` 上传、音频参考组合规则、计划/地区注意事项与 SDK 类型滞后都是 Runway 专属。
7. 提供商/路由工作流：EvoLink、OpenRouter、Kie.ai、PiAPI、LaoZhang、Runware、ModelsLab、AI/ML API、MuAPI、SeeGen、Segmind 或类似平台必须标记为提供商专属并在给出代码或价格指引前重新检查。
8. 面向中国的工作流：优先官方字节跳动/火山引擎/BytePlus/豆包/即梦/剪映来源；工作流托管方、中文博客与商业伙伴新闻不是公开 API 提供商，除非有提供商自有文档。
9. 社区工作流：ComfyUI 或非官方节点必须标记为社区/未验证，除非有来源。
10. 语料挖掘工作流：在重用前对来源分类；提取结构与词汇，而非不安全的原始提示词。

## 输出契约

返回工作流路径、来源状态、必需输入、制作阶段、验证步骤、交付假设与风险。对于专业工作，包含下一要创建的产物：简报、镜头列表、连续性账本、提示词批次、评审包、本地化矩阵或 QC 预检。