# Seedance 型号核对、自动轮询与任务恢复

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

日期：2026-09-12；版本：studio133。

## 已实现

- 新生成请求附带客户端持久化的 requestId。服务端先以原子文件替换写入本地回执，再提交生成；相同编号、相同参数返回原任务，相同编号不同参数返回 409。
- 默认任务目录为 `data/generation-tasks`，可通过服务端 `ZORA_TASK_STORE_DIR` 配置。只保存参数指纹、模型、任务回执、状态与结果，不保存请求提示词、输入素材或密钥。
- `GET /api/generation-tasks/{requestId}` 获取持久化任务。原来不带 requestId 的 `/api/generate` 请求仍兼容 studio132 的同步批次响应。
- 服务端每 5 秒查询待完成任务，查询 HTTP 并发最多 4；网络错误退避至最多 60 秒，单次查询超时 30 秒。任务超过 3 天停止自动查询并明确报错；过期、失败及无有效产物的完成响应不会显示成成功。
- 启动时恢复已有远端任务编号，继续 GET 查询；不会自动重发生成 POST。提交中断且没有拿到上游编号的部分明确显示“结果未知，未自动重提”，避免重复扣费。
- 前端自动同步首页所有会话、当前画布及未打开画布的待完成媒体节点。完整重开软件后继续恢复结果；原有手动刷新按钮保留。状态未变化时不重绘节点编辑器。
- 批次部分成功保留已完成素材。完成结果自动进入原会话/节点；节点已有的输出选择在新结果到达时保留。
- 自动下载继续遵守用户设置，并持久化素材 URL 的摘要用于去重。去重记录表示浏览器已交接下载请求；并不替代操作系统磁盘写入完成确认。下载按钮仍可手动重试。
- 用户明确点击“再次生成”才创建新的请求编号；提交回执暂未取得时先查询原编号。

服务端运行时可持续后台查询。若关闭桌面同时关闭本地服务，停机期间不会在本机轮询，下次启动恢复查询；不安装常驻系统服务。远端仍在运行的任务不会因为本机关闭而被伪称为已取消。

## Seedance 2.5 / Mini 核对结论

| 项目 | 当前处理 | 验证边界 |
| --- | --- | --- |
| 2.5 模型名 | 以用户最新 curl 中的 `doubao-seedance-2.5` 为准，`doubao-seedance-2-5` 作为兼容别名 | 旧节点及保存的型号选择仍可识别 |
| Mini 模型名 | 保留 `doubao-seedance-2-0-mini` | 供应商视频清单明确列出了该 ID |
| 视频请求与恢复 | 保留家族的 content/metadata 适配、签名上传和视频查询入口；两个型号均纳入任务账本 | 请求构造与恢复用模拟服务验证 |
| 2.5 专属视频协议 | **待确认** | 用户 curl 是 `/v1/chat/completions`，截图也是聊天参数；不能据此确认视频入口、30 秒上限或产物格式 |
| Mini 专属能力上限 | **待确认** | 供应商清单有 ID，但所查创建视频页只明确列标准版与 Fast；不能将全部家族能力当作 Mini 实测承诺 |
| 真实渠道运行 | **未测试** | 无付费生成。只读模型清单检查发现当前环境没有可用网关凭据，因此未发起该查询 |

本轮没有将用户提供的聊天示例误接为视频生成请求，也没有把它归为新的文字模型。后续需要该型号真正的视频请求/响应示例，才能确认其专属参数及路由；不能仅靠修改型号字符串作出“真实接入成功”的结论。

## 验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 单元、契约及进程恢复测试 | 通过，累计 24 项 | `tests/task-recovery.test.mjs`、`tests/task-recovery-http.test.mjs` 及原有 6 个测试文件 |
| 真服务端进程重启 | 通过 | 本地模拟网关，重启 server.mjs 后原任务完成，生成 POST 始终只有一次 |
| 完整 Electron 重启 | 通过 | `scripts/verify-task-recovery.mjs`；最终证据 `outputs/task-recovery-desktop-verified/results.json`；当前画布、未打开画布、首页会话恢复，生成提交始终 3 次 |
| 桌面回归 | 通过，31 项 | `outputs/task-recovery-regression/desktop-results.json` |
| 自动下载回归 | 通过 | `outputs/task-recovery-auto-download/Zora` 中 2 份模拟素材下载完成；刷新返回的重复素材未再次下载 |
| 源码语法 | 通过 | app.js、node-workflow.js、server.mjs、catalog.mjs、generation-service.mjs、task-store.mjs |

新增回归覆盖：提交幂等、错误参数复用编号、断网退避、部分批次提交中断、任务过期、远端失败、无产物的假完成，以及批次收尾覆盖先前轮询结果的竞态。

复跑记录：`task-recovery-desktop-final` 曾在未打开画布检查处超时，后台 3 条记录均已完成；该测试直接写入 localStorage 后未同步页面内存。补充注入后的 reload，使测试设置与页面内存一致后，在 `task-recovery-desktop-verified` 完整通过。测试保留失败状态输出逻辑，便于后续定位。

备份与原文件 SHA-256：`outputs/task-recovery-20260912-230840/manifest.json`。没有批量删除、修改 .env 或重启用户当前服务。前后端需重启才能加载新版本。已有两份交接文件保持原样。

协议依据：[供应商视频清单](https://docs.deepwl.cn/duoyuanx/zh/video-models)、[Seedance 创建视频](https://docs.deepwl.cn/duoyuanx/zh/videos/seedance-2/generation)、[Seedance 概览](https://docs.deepwl.cn/duoyuanx/zh/videos/seedance-2/overview)。型号确认另依据本轮用户提供的 curl 原文。
