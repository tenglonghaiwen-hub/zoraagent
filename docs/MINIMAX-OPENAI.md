# 多元 MiniMax OpenAI 格式

2026-09-21：新增独立模板 `minimax-openai`。现有 `minimax` 继续使用 v2 content 格式；供应商 duoyuanx 使用多元地址与密钥，不等于官方直连。

## 后台配置

- 模型 ID：`MiniMax-H3`
- 类型：`video`
- 供应商：`duoyuanx`
- 协议模板：`minimax-openai（多元 OpenAI 格式 v1）`
- Route：`/v1/videos`
- Query Route：`/v1/videos/{task_id}`
- 能力 JSON：可留空，采用模板默认值；分辨率仅 `768P` / `2K`，时长 4–15 秒，单次一个视频。
- 不勾选 Seedance 素材库。收费和并发上限需要按实际业务与上游账户设置。

选择模板后自动更新两条路由并清空旧能力 JSON。修改供应商时不会再因 MiniMax-H3 模型 ID 把 v1 强制改回 v2。已保存配置不会被本次发布自动切换，须在后台选择模板并保存。

## 参数与角色

请求体使用 `model/prompt/duration/size/images/metadata`，比例在 `metadata.ratio`，参考视频和音频分别在 `metadata.reference_videos/reference_audios`。使用 Bearer 认证。

- 文生：不带素材，不能使用 adaptive。
- 首帧：一张图片；首尾帧：两张图片。两者必须使用 adaptive，不能混入参考视频/音频。
- 多模态参考：1–2 张图片会被网关解释为首尾帧，因此提交前拦截该组合；可以改用 v2 官方格式，或由用户提供至少三张真实参考图。不得复制图片凑数，也不静默切换模式。
- 查询解析 id、status、progress、video_url、metadata.url 和 error；生成响应缺少网关 id 时报告结果未知，不能用虚构编号掩盖失败。

## 验证与边界

专项模拟测试覆盖协议默认值、错误配置、文生/首帧/首尾帧/多模态请求、实际请求路径、Bearer 头、成功及失败查询、缺失任务编号。后台页面实际验证了模板切换、路由自动填充、保存，以及供应商切换不会覆盖 v1。

本次未调用真实付费生成。Remix `/v1/videos/{video_id}/remix` 仍未接入，不属于本模板的生成操作。旧安装包需要更新才能使用本地新增的预览/Agent 校验；所有媒体统一持久回执仍属于后续工作。

来源（2026-09-21 已读取）：[生成](https://docs.deepwl.cn/duoyuanx/zh/videos/minimax/generation)、[查询](https://docs.deepwl.cn/duoyuanx/zh/videos/minimax/query)、[再生成](https://docs.deepwl.cn/duoyuanx/zh/videos/minimax/remix)。

官方格式 v2 的增强/再生成已另行接入，见 [官方格式操作说明](MINIMAX-OFFICIAL-OPERATIONS.md)。本文件所述未接入 Remix 仅指 OpenAI v1 接口。
