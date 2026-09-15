# Seedance 文档适配验收（studio136）

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

依据：用户提供的 `C:/Users/强哥/Downloads/4..txt`。本报告更新此前“2.5 视频协议缺少依据”的结论，保留历史交接文档原样。

## 已实现

- 文档明确列出 `doubao-seedance-2.5`、Mini、2.0 和 Fast，使用 POST `/v1/video/generations` 和 GET `/v1/video/generations/{task_id}`。
- 四个版本限制同步为 4–15 秒或 -1 自动时长、480P/720P/1080P，比例为 16:9、9:16、1:1、4:3、adaptive。保留既有 2-5 别名。
- 画布和主创作时长选项支持“自动”；请求保持数值 -1。
- Seedance 请求校验接受合法 asset:// 引用，保留图片、视频、音频类型及角色；已有引用直接传递，不重复上传。
- 请求继续使用嵌套 content、metadata，不采用末尾示例中的点号字段名。
- 嵌套任务失败不再被外层 IN_PROGRESS 和 task_id 误判为待轮询。
- 前端缓存戳更新为 studio136。

## 验证结果

| 范围 | 状态 | 依据 |
| --- | --- | --- |
| 模型限制、素材引用、嵌套查询响应 | 通过 | tests/seedance-document.test.mjs |
| 媒体适配、目录校验、轮询及跨服务进程重启恢复 | 通过 | 相关五个测试文件共 18 项通过；模拟网关，重启不重复提交 |
| Electron 2.5 / Mini 时长、分辨率控件 | 通过 | scripts/verify-seedance-document.mjs；outputs/seedance-document-ui-136/results.json |
| JS 语法 | 通过 | app.js、node-workflow.js、media-results.js、server.mjs |
| 供应商实际生成 | 未测试 | 未发起付费调用或上传素材 |
| 素材组创建界面、draft_task、全部可选高级参数 | 未实施 | 本轮未新增这些交互；不能视为完整支持全部文档字段 |

文档中的“默认帮我设置为 true”属于附件内容，不视为独立用户指令。本轮保留原有 generate_audio 行为：音频参考时为 true，其余为 false。

备份目录：outputs/seedance-document-20260912-235053（源码清单及哈希见 hashes.json；该备份未包含随后修改的 media-results.js）。未修改密钥配置，未停止用户运行中的程序。前后端重启后加载本轮改动。
