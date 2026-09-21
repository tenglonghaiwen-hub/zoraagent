# 多元 MiniMax 官方格式与 Agent 自动选择

2026-09-21。供应商为 `duoyuanx`，模板为 `minimax`，不是 MiniMax 官方直连，也不是 `minimax-openai`。

| 用户意图 | Agent 工具 | 上游路由 | 结果 |
| --- | --- | --- | --- |
| 增强视频提示词 | enhance_video_prompt | POST /v2/h3_context_ir | 异步文本 |
| 生成新视频 | preview_task / submit_generation | POST /v2/video_generation | 异步视频 |
| 已有视频再生成 | remix_video | POST /v2/video_regeneration | 异步 2K 视频 |
| 查询以上任务 | query_h3_task | GET /v2/query/video_generation/{task_id} | 原任务状态及结果 |

先理解用户指令，再由视频 Agent 从模型目录的 agentOperations 选择能力。普通润色不强制调用付费增强；只要求优化提示词时不能擅自生成视频。新工具已经加入视频专业 Agent 白名单，主 Agent 可以查询，付费创作经视频 Agent 执行。

## 配置与报价

模型生成路由 `/v2/video_generation`，查询路由 `/v2/query/video_generation/{task_id}`。后台模型弹窗分别设置“提示词增强”和“再生成”积分，用户确认初始均为 5 积分。之后可单独修改；留空关闭该操作，0 为用户免费，常规视频生成单价独立保留。

能力配置中对应：

```json
"h3OperationCosts": { "enhance": 5, "remix": 5 }
```

专用工具 `preview=true` 只校验和报价。实际提交使用预览 cost 作为 expectedCost；价格变化则拒绝旧报价，不请求上游。Agent 需取得用户对本次费用的授权，不自动增加收费步骤。

## 源任务、源视频和持久恢复

- 再生成二选一：本账号已完成的视频回执 sourceReceiptId，或选择当前会话一个视频素材并提供提示词。源任务方式禁止同时传新提示词；要改变内容应使用源视频方式。
- 输出固定 2K，再生成请求不传 duration/ratio。具体生成效果受上游能力限制，不保证任意视频编辑要求都能实现。
- 同一用户/requestId 保存到现有 generation_receipts 表，包含供应商地址、实际路由、上游 task_id、操作类型、结果类型和积分状态；无需新增表。客户端使用本地回执 id，避免把上游 id 当回执查询。
- 提示词增强只返回 enhancedPrompt，不产生空视频卡片。生成/再生成回执沿用客户端视频结果和轮询显示。
- 相同编号相同参数恢复原回执，不重发 POST。参数变化拒绝复用；连接中断/缺失任务 ID 为 unknown，禁止自动改编号重提。
- 扣减前事务检查余额及并发，保留积分；明确上游拒绝/任务失败仅退回一次。提交结果未知保留待核对状态，不擅自认定成功或失败。部署/重启不自动重提。
- 已有旧视频没有本账号持久回执时，不能凭猜测任务 ID 再生成，可使用源视频方式。供应商地址改变后不向新地址发送旧任务查询。

## 接口与验证

本产品接口为 POST `/api/h3/preview`、POST `/api/h3/tasks`、GET `/api/h3/tasks/{requestId}`。视频回执也可通过 GET `/api/generation-tasks/{requestId}` 恢复。

测试 `tests/h3-operations.test.mjs` 使用隔离 SQLite、模拟上游和实际 Worker HTTP 分发，覆盖 Agent 委派、参数组装、账号隔离、报价变化、扣费幂等、超时不重提、恢复到客户端结果。未进行真实付费生成，因此测试通过不代表已验证上游账号权限或实际生成效果。旧客户端安装包需更新才能包含新增工具。

接口依据：[多元官方格式创建](https://docs.deepwl.cn/duoyuanx/zh/videos/minimax/official-generation)、[多元官方格式查询](https://docs.deepwl.cn/duoyuanx/zh/videos/minimax/official-query)。OpenAI 格式的 `/v1/videos/{video_id}/remix` 不属于本次 v2 接入范围。
