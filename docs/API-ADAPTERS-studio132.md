# API 接入核查与修复验收（studio132）

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

日期：2026-09-12。范围：当前目录中的 49 个模型及图片、视频生成链路。结论：本轮完成媒体请求适配、批量提交、多结果处理和查询界面的本地验证；不能认定所有模型已通过真实渠道验收。

## 路由与实现

| 模型组 | 数量 | 当前入口 | 本轮结论 |
| --- | ---: | --- | --- |
| 文本模型 | 31 | Responses 或 Chat Completions | 保留现有模型分流；本轮未逐个真实调用 |
| GPT Image / Grok Image / Seedream | 3 | `/v1/images/generations` | 图片参考数组、像素尺寸、数量拆分已实现 |
| Qwen Image 标准 / Pro | 2 | 生成 `/v1/images/generations`，编辑 `/v1/images/edits` | 原生 messages/parameters、最多 3 张参考图片已实现 |
| Gemini Image | 1 | `/v1beta/models/{model}:generateContent` | 保留 inlineData 输入，补齐多结果解析与数量拆分 |
| Grok Video | 3 | `/v1/videos` | 重复 multipart 文件字段、任务查询已实现 |
| MiniMax H3 | 1 | `/v1/videos` | images、音视频参考 metadata 已实现；混用约束显式报错 |
| Omni | 2 | `/v1/videos` | 首帧、首尾帧、多图和 v2v 字段分别处理 |
| Veo | 2 | `/v1/videos` | JSON input_reference、output_config、尺寸同步；参考生成要求 16:9 |
| Seedance | 4 | `/v1/video/generations` | content 类型及 role、内嵌素材签名上传已实现；2.5/mini 仍沿用家族协议，专属协议未证实 |

路由表中的入口数量不是接入完成数量。文档中还有当前产品目录未收录的模型，以及 remix、mask、原生 Claude/Gemini 文本等替代或扩展接口，本轮没有将它们全部增加为产品功能。

## 已改行为

- 请求构造移至 `packages/duoyuanx/generation-adapters.mjs`，按模型家族处理，避免参考素材被静默丢弃。
- `generation-service.mjs` 将 count 拆成单次请求，保留每次成功或失败。提交阶段全局最多 4 个 HTTP 请求，同时受模型上限与用户批次并发值限制；上游请求超时为 120 秒。
- Seedance 的 Data URL 先在服务端申请签名，再上传二进制；签名存储请求不携带网关 Bearer 密钥。此流程只进行了模拟验证。
- 前端统一解析 URL、Base64、Gemini parts、任务编号及失败状态。完成但无素材不显示为成功。
- 首页每份结果可以单独下载、拖动或加入参考；首页增加任务刷新按钮。节点可选择批次中的某份结果作为输出，选择会保存，并供下游读取。
- 异步任务失败后可重新生成；查询网络失败保留任务编号供重试。再次生成会清除旧任务编号，不再误走旧任务查询。
- 自动下载遍历已返回的所有素材。异步素材当前仍需要用户点击“刷新生成结果”取得结果，尚无后台自动轮询。
- JS、CSS 及节点模块缓存版本同步为 studio132。历史两份交接文件未改。

## 验证证据

| 检查 | 结果 | 依据 |
| --- | --- | --- |
| 单元与 HTTP 契约测试 | 通过 | 6 个 test 文件，17 项通过；新增 generation.test.mjs 覆盖 18 个媒体模型构造、家族字段、批次并发、部分失败、签名上传和重复文件字段 |
| 桌面回归 | 通过 | `outputs/api-adapters-desktop-regression/desktop-results.json`，31 项通过，无页面脚本异常 |
| 节点串联及异步查询 | 通过 | `scripts/verify-node-workflow.mjs`，模拟文字→图片→视频、刷新恢复 |
| 多输出选择、持久化、远端失败恢复 | 通过 | `scripts/verify-media-batch.mjs`，截图 `outputs/api-adapters-batch-final/workflow.png` |
| 自动下载 | 通过 | `outputs/api-adapters-download-regression/Zora` 中 3 个隔离测试下载，Electron 返回 completed |
| 修改模块语法 | 通过 | app.js、node-workflow.js、media-results.js、server.mjs、generation-adapters.mjs、generation-service.mjs |
| 真实付费生成 / 素材上传 | 未测试 | 本轮没有发送真实生成或上传请求 |
| 所有模型真实权限、计费及产物质量 | 未测试 | 文档和模拟测试无法证明渠道可用性 |
| 全面交接验收完成 | 未通过完成门槛 | 下列后续项仍存在，不将其写成已实现 |

本轮开始前的源码副本在 `outputs/api-adapters-20260912-224440`（app.js、server.mjs、index.html、catalog.mjs），不包含密钥。没有初始化 Git，也没有重启用户正在使用的服务。

## 后续优先项

1. 持久化任务队列、自动轮询、跨重启继续查询、提交幂等和可核实的取消语义。目前并发只限制 HTTP 提交阶段，不限制远端同时生成的任务总数；队列没有持久化。
2. 完善大文件上传：当前引用合同最多 6 份、每份 Data URL 字符长度有限，不能代表供应商允许的视频/音频总容量；应采用服务端受控上传及尺寸、时长校验。
3. 收紧文本接口遇到普通 400/500 时的自动回退，避免无意义重复请求；CLI 路径需要核实并补齐用户所选模型及图片参数。
4. 逐渠道确认 Seedance 2.5/mini、图片 1K/4K 自定义尺寸及参考模式的实际支持。像素尺寸可以构造，不等于每条渠道均接受；不得用静默改变参数代替错误提示。
5. 服务端请求体大小限制、代理超时、账户级生成并发与积分账本，以及远程密钥托管部署，需单独验收。

## 协议依据

- [图像支持矩阵](https://docs.deepwl.cn/duoyuanx/zh/images/model-matrix)
- [GPT Image 2](https://docs.deepwl.cn/duoyuanx/zh/images/gpt-image-2/generation)
- [Qwen 编辑](https://docs.deepwl.cn/duoyuanx/zh/images/qwen-image/edit)
- [Seedream](https://docs.deepwl.cn/duoyuanx/zh/images/doubao-seedream/generation)
- [Grok 视频](https://docs.deepwl.cn/duoyuanx/zh/videos/grok/generation)
- [Veo 视频](https://docs.deepwl.cn/duoyuanx/zh/videos/veo/generation)
- [MiniMax 视频](https://docs.deepwl.cn/duoyuanx/zh/videos/minimax/generation)
- [Omni](https://docs.deepwl.cn/duoyuanx/zh/videos/omni/overview)
- [Seedance 2](https://docs.deepwl.cn/duoyuanx/zh/videos/seedance-2/generation)
- [签名上传](https://docs.deepwl.cn/duoyuanx/zh/uploads/image-upload)
