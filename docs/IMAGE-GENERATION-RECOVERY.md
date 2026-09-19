# 云端图片数量与结果恢复

修复对象为 gpt-image-2 的 Agent、对话和画布生成。旧实现直接发送客户端 `count`、`references`，上游不识别数量时默认只出一张；本地 UUID 又被转到 MiniMax 视频查询接口，导致 `record not found (1000)`。

## 现在的流程

1. 客户端或 Agent 提交后，本机服务先保存批次编号并立即返回回执。
2. 本机服务保持云端 HTTP 请求，页面刷新或 Agent 回合结束不会中止该请求。第三方密钥仍仅位于云端，本机仅使用用户登录令牌，令牌不写入生成记录。
3. 云端把 `count` 转为 `n`，参考图片转为 `image`，比例/分辨率转为 `size`。当前实际渠道单次只接受 1–4 张（实际 `n:5` 返回 400）；例如 4 张、9:16、2K 为 `n: 4, size: "1152x2048"`。用户明确不需要自动拆分，超过上限直接拒绝。
4. 云端 D1 以用户和请求编号保存索引，Durable Object 通过持久化 alarm 执行生成，不再依赖浏览器或本机维持长连接。输入与完整结果按小块存储，避免 Base64 图片超过单行大小限制。同编号重发只读取原记录；参数变更返回冲突。执行中崩溃或上游结果未知时不会重发收费请求。
5. 客户端查询 `/api/generation-tasks/:id` 时通过本机 `/api/cloud-media/tasks/:id` 读取本地或云端结果。真实视频任务仍走 `/api/tasks/:id`，两个编号体系不混用。
6. 完成时保留全部成图；少返回图片显示部分结果及数量差异，不自动补发。积分按实际返回数量结算，记账失败不丢弃已保存的图片，需人工核对。

本地记录：`data/cloud-generation-tasks/<账号哈希>/<请求编号>.json`。服务重启后可向云端恢复已保存的结果；上游连接中断且云端尚未取得结果时保留待确认，不声称一定可恢复。

## 部署和验证

先执行 `wrangler d1 execute zora-db --remote --file=generation-receipts.sql`，再部署 Worker。新建环境的 `schema.sql` 已包含该表。入口为 `src/worker.mjs`，导出 `ImageGenerationJob`，配置包含 SQLite Durable Objects 迁移 `image-jobs-v1`。重启本机服务并刷新客户端。

`node --test tests/cloud-image-receipts.test.mjs tests/cloud-image-job.test.mjs` 验证 4 张参数与结果、刷新恢复、同编号去重、缺图、记账失败保留图片、账号隔离、未知结果不重提及大于 2 MB 的 Base64 结果持久化。`tests/fixtures/image-job-wrangler.toml` 为真实 workerd/alarm 本地验收配置，使用模拟上游，不产生生成费用。

## 旧任务限制

修复前未存储的响应无法凭本地 UUID反查同步图片接口。2026-09-19 22:49:47 的旧请求只核对到上游消费记录，Request ID 为 `2b575c80-b439-11f1-b7e4-9eec3e7ca8df`；现有日志没有成图地址，未补发生成。需要上游按该请求编号提供原结果才能回填。

2026-09-19 23:27:07 的 4 张请求也只有开始回执，尚未保存结果。上游 Request ID 为 `63cc8f72-b43e-11f1-b7e4-9eec3e7ca8df`，本地编号 `d0999dc6-b541-4a80-b187-60bfdf5de659`。该旧任务没有 Durable Object 作业，不会因升级而重新提交。不能将新任务持久化修复表述为已找回这 4 张原图。

依据：[多元探索 gpt-image-2 接口](https://docs.deepwl.cn/duoyuanx/zh/images/gpt-image-2/generation)。
