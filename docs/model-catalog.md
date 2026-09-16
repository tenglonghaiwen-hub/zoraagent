# 模型目录与路由

更新：2026-09-16。本文描述当前实现，不将旧配置文件视作实际模型能力来源。

## 当前来源

`GET /api/models` 由 `packages/duoyuanx/proxy.mjs` 调用 `catalogPayload()` 返回。能力目录在 `packages/duoyuanx/catalog.mjs`，`apps/server/catalog.mjs` 为转导出。历史 `apps/server/config/models.json` 不能作为修改当前媒体路由的唯一入口。修改模块后应重启后台，再核对 API 返回和客户端选择项。

目录描述模型、比例、分辨率、时长、模式与路由；`route-capabilities.mjs`、`h3-routing.mjs` 和 `generation-adapters.mjs` 负责进一步匹配及请求打包。界面显示选项不等于供应商已授权或实际成片一定符合参数。

## MiniMax H3

新任务使用 MiniMax 官方 `https://api.minimax.cn/v2/video_generation`，Bearer 凭据为独立 `MINIMAX_API_KEY`。请求通过 content 指定文字与素材角色，duration、resolution、ratio 位于顶层。模式按意图区分文字、首帧、首尾帧、多模态参考；身份参考图片不能仅因数量少就改判为首帧。当前实现中参考模式支持 1–9 张图片，首尾帧使用 adaptive。

旧提交代码保留注释，历史任务根据保存的 provider 和回执走原查询来源。缺少官方 Key 不回退至中转 Key。修改新任务提交格式不应破坏旧任务查询。

## 验证与排障

先检查用户选择、实际参考素材角色和后端请求记录，再对照供应商返回的任务状态及媒体尺寸。请求记录不含鉴权头，内嵌素材正文省略；提示词与素材 URL 仍属于本地用户数据。前端详细信息可读取已保存请求描述，旧任务未记录的请求无法还原。

参数校验与模拟路由测试不等于付费上游验收。不要以提示词中的“9:16”代替结构化 ratio，也不要以任务成功状态代替实际视频尺寸检查。当前功能与验证记录见 [当前状态](CURRENT-STATUS.md)。
