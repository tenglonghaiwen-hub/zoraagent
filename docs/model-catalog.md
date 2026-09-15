# 后台模型目录

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

配置文件：apps/server/config/models.json。仅服务端读取，不通过静态文件接口暴露。

- revision：配置版本正整数，更新配置时递增。
- accountMaxConcurrency：当前演示账户的并发上限；真实账户鉴权未接入。
- models：id、name、kind（agent/image/video）、enabled、maxConcurrency、maxCount。
- 图片/视频模型：ratios、resolutions。
- 视频时长：durationRange（min/max/step），或 durations 离散列表。

修改文件后下一次 API 请求即生效，无需重启。客户端切回窗口时刷新目录。模型列表仅返回 enabled=true 的条目，并发取模型与账户上限的较小值。客户端显示参数，后台再次验证草稿，拒绝过期或被篡改的模型、参数、数量和并发。

接口：GET /api/models，GET /api/account，POST /api/preview。

配置异常时接口失败，不沿用旧配置接受任务。配置采用公开字段白名单输出，勿将密钥放入此目录文件。真实上游同步、用户鉴权、生成队列和运行时并发调度仍未接入；当前完成的是配置分发与参数约束。
