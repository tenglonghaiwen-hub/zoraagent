# Agent 统一生成任务契约 v1

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

日期：2026-09-14。本文是本轮源码、UI、测试与构建协作契约，不是上线或验收完成声明。

## 兼容边界

- 保留 `POST /api/generate` 和 `GET /api/generation-tasks/{id}` 现有路径及响应结构。
- 保留旧调用方未带 requestId 的行为；新 Agent 生成必须带 requestId，不能使用同步兼容分支。
- `GET /api/generation-capabilities` 保留 `durableTasks`，新增数字 `agentTasksVersion: 1`。构建检查和测试 fixture 使用相同字段识别能力。
- Agent 默认模型及用户明确参数优先规则保持；供应商路由和请求编码仍归后端模型适配器管理。

## 源码职责：稳定提交与真实收据

Agent 的 `submit_generation` 及 `call_api POST /api/generate` 进入同一提交封装。服务端为一次逻辑提交生成符合现有校验的 requestId（16–100 位字母、数字、下划线或短横线，可用 UUID）。同一轮同一逻辑提交的重复工具调用复用 ID；参数不同或用户明确要求新的生成才创建新 ID。请求编号不得取决于 LLM 自行编造。

现有任务存储已在付费 POST 前保存收据；同 ID 同参数返回已有记录，同 ID 不同参数返回 409。不得因网络超时、Agent 后续输出失败或进程重启自动换 ID 重提。跨聊天 HTTP 请求重试如未实现稳定轮次 ID，不得宣称具有跨请求去重能力。

Agent 直接调用供应商生成代理 POST 会绕开此边界，应在 Agent 白名单层拒绝并引导使用统一生成工具；普通前端兼容接口不因此删除。素材必须在提交前解析成真实可读内容；有参考素材但不可读应返回具体错误，不静默过滤后转为文生图。任务账本继续不保存输入图片字节或密钥。

工具调用响应保留 API 包装：

```json
{"ok":true,"status":202,"data":{"task":{"id":"stable-request-id","modelId":"gpt-image-2","status":"running","revision":1,"upstreams":[],"pollError":"","createdAt":0}}}
```

`task` 是现有 TaskView：`id`、`modelId`、`status`、`revision`、`upstreams`、`pollError`、`createdAt`。状态仅为 `running`、`completed`、`partial`、`failed`；不另造上游状态枚举。

提交回执尚未取得时的例外：允许返回带 `submissionUnknown:true` 的本地查询占位记录，使用原 requestId、`status:"unknown"`、revision 0。它不是服务端权威 TaskView，也不证明上游已提交。前端只查询该 ID，显示结果待确认；404 停止恢复且不自动新建生成。取得真实 TaskView 后替换占位状态。

`POST /api/chat` 在现有字段之外新增：

```json
{
  "generationTasks": [
    {
      "task": {"id":"stable-request-id","modelId":"gpt-image-2","status":"running","revision":1,"upstreams":[],"pollError":"","createdAt":0},
      "draft": {"modelId":"gpt-image-2","prompt":"实际提交指令","count":1,"concurrency":1,"ratio":"1:1","resolution":"1K"}
    }
  ]
}
```

`draft` 来自实际工具提交的参数，按需包含 `kind`、`duration`、`videoMode`；不包含素材字节、访问密钥或 LLM 未执行的猜测结果。`generationTasks` 必须从真实提交收据收集并按 task.id 去重，不能依赖模型返回的 `tasks` 列表。没有实际提交时返回空数组。工具提交后模型输出解析失败时，也应尽量返回已取得的收据和明确聊天错误，而不掩盖已提交事实。

## UI 职责：关联与恢复

- 为 Agent 消息保留稳定本地消息 ID；每个收据对应一个可恢复生成记录，记录 `sourceAgentMessageId` 与所属会话/画布。
- `task.id` 映射现有 `genBatchId`，`revision` 映射 `genRevision`；`status === 'running'` 映射 `genPending`。复用现有生成结果归一化与轮询逻辑。
- 按 task.id 去重，而不是按提示词、模型或数组下标猜测关联。先持久保存收据，再开始展示与轮询。
- 无论 Agent 的 `tasks` 是否为空，都展示真实生成记录。规划任务与已经提交的任务不能重复创建可付费的生成入口。
- 结果仅从 `task.upstreams` 归一化；`completed` 显示已完成，`partial` 保留已有结果并显示部分失败，`failed` 展示具体错误。Agent 自然语言“已完成”不能单独改变任务状态。
- 刷新、切换会话及重启后，对保存的 `genBatchId` 使用 GET 查询。查询不要求重新解析原图，不提交新生成。临时查询失败保留 ID，显示查询异常；404 表示本地记录缺失，停止自动重试生成并说明结果未知，不能换 ID POST。
- 运行中禁用重复生成入口；用户明确发起新的生成时再建立新请求。保持用户现有阅读位置，不以轮询触发消息自动滚动。

## 首轮验收与实施顺序

1. 源码实现统一提交、真实收据列表和能力版本；测试使用模拟上游确认重复工具调用只 POST 一次。
2. UI 消费 generationTasks，验证空规划列表仍显示卡片、task.id 去重及失败信息。
3. 验证异步完成、部分失败、查询异常、刷新和重启恢复；仅 GET 取结果，不重复付费 POST。
4. 构建检查 agentTasksVersion；更新本地 fixture 与缓存戳，最后由测试角色报告实际通过项。

本轮不迁移历史会话，不保证无收据的旧付费结果可恢复，不实现多用户服务端鉴权或跨重启聊天历史持久化；这些边界须另行设计。任何真实付费验证均须用户确认。
