# Agent Runtime v2：分期架构与接口边界

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

本文为新增能力的实现方案，不代表能力已实现或经过验收。已只读核查现有 Agent、媒体子 Agent 与生成任务存储；Windows 主机是否具备可用 WSL、Docker、Hyper-V 或其他隔离环境尚未验证。本轮不修改业务代码、不安装运行时、不启动服务。

## 当前可复用基础

- `apps/server/chat-service.mjs`：聊天编排入口；会话持久化应替换其进程内状态依赖。
- `packages/agent/tools.mjs`、`api.mjs`：工具定义和宿主调用边界；不能把提示词或模型返回当作权限授权。
- `packages/agent/media-subagents.mjs`：有界媒体委派，保持其工具白名单。
- `packages/duoyuanx/task-store.mjs`：生成收据、查询、重启恢复；继续作为媒体副作用账本，不扩成保存所有聊天与文件字节的大对象。
- 延续 `UNIFIED-TASK-CONTRACT.md` 的 generationTasks 与 `PRODUCT-SUBAGENT-CONTRACT.md` 的媒体默认模型和权限约束。

## 第一阶段：审批工具执行与文件操作

统一工具注册表 `ToolDefinition` 至少包含：`name`、`version`、`inputSchema`、`outputSchema`、`effect`（read/write/execute/external）、`requiredCapabilities`、`executionMode`、`timeoutMs`、`maxOutputBytes`。注册工具即使来自插件/MCP，也必须经过相同宿主 broker，不可通过别名或原始 call_api 绕过。

每次执行先建立 `ToolInvocation`：`id`、`sessionId`、`turnId`、`toolName`、`toolVersion`、`argsHash`、`workspaceId`、`status`、`approvalId`、`startedAt`、`completedAt`、`resultRef`。状态为 `proposed → awaiting_approval → queued → running → completed/failed/cancelled/unknown`；只读已授权工具可直接排队。写入意图和审批消费记录必须先于真实副作用。

审批对象 `Approval`：`id`、`invocationId`、`toolName`、`argsHash`、`workspaceId`、`expiresAt`、`decision`、`decidedAt`、`consumedAt`。界面展示具体文件变更预览或准确命令、工作目录及影响。用户批准只授权这份不可变请求；任何参数、工具版本或目录变化使旧批准失效。批准不能由 Agent 工具自我签发，重复点击只消费一次。支付、注册、发送消息、账号权限及批量删除继续要求用户明确确认。

建议接口：`POST /api/runtime/invocations` 创建意图；`GET /api/runtime/invocations/{id}` 查询；`POST /api/runtime/approvals/{id}/decision` 接受用户界面的 approve/reject 决定；`POST /api/runtime/invocations/{id}/cancel` 请求取消。决策端点必须绑定真实用户/本机会话认证、防跨站请求；不能加入模型工具白名单。取消执行不能保证已发生的副作用被撤销，应如实记录。

文件最小工具为读取、列举、精确补丁和受控测试命令。文件写入采用内容哈希前置条件，备份/差异预览，原子替换；解析实际绝对路径并验证 junction/symlink/reparse point，不只做字符串前缀判断。敏感文件与密钥不进入模型上下文、工具输出或聊天日志。终端输出需大小限制、超时与进程树管理；命令包含的外部调用仍遵守相同授权。

## 隔离声明：cwd 限制不是操作系统沙箱

`cwd`、允许目录列表、命令黑名单、路径检查、超时和 Windows Job Object 都不能单独隔离任意代码对宿主文件、网络、注册表或凭据的访问。PowerShell 包装器也不是安全沙箱。WSL 普通发行版可能挂载宿主磁盘，不能因存在 WSL 就宣称隔离完成。

运行时必须明确报告 `executionMode: unsupported | host_approved | isolated`。未验证隔离时默认禁用任意 shell；若用户选择逐条批准宿主执行，明确标为 host_approved，不显示“沙箱安全”。进入 isolated 前必须实际验证容器/虚拟机/低权限隔离策略：专属工作目录、无宿主凭据与敏感挂载、受限网络、资源配额、进程清理、文件越界拒绝。容器引擎存在也不等于策略有效。安装 Docker/WSL 或变更主机设置不是本方案自动授权的动作。

## 第二阶段：跨重启聊天

持久 `Session`：`id`、`channel`、`workspaceId`、`modelId`、`revision`、`createdAt`、`updatedAt`。持久 `Turn`：`id`（客户端先生成的稳定 ID）、`sessionId`、`inputHash`、`status`、`userMessageRef`、`assistantMessageRef`、`toolInvocationIds`、`generationTaskIds`、`error`。`Message` 保存文本和 `assetIds`，素材通过独立受控存储读取，不把 Base64 重复塞入文本历史。

优先使用可事务写入的本地数据库，或者明确支持原子性和并发锁的现有文件存储。会话与工具意图必须可关联；schemaVersion、迁移备份、损坏报告和存储失败行为明确。未完成轮次恢复为 interrupted/awaiting_approval/等待已有生成结果，不能在启动时重新发送未知工具命令或付费 POST。

现有 `/api/chat` 接受可选 `turnId` 并保持旧响应字段兼容：相同 session+turnId+inputHash 返回原状态，相同 ID 不同输入返回冲突。查询轮次与恢复接口独立于重新发聊天。历史过长采用可审计摘要加原始消息留存，不把裁剪等同丢弃；主 Agent 与画布 channel 的归属由服务端校验。用户删除记录、保留策略和导出需单独受控。

## 第三阶段：多阶段工作流 DAG

`Workflow`：`id`、`sessionId`、`revision`、`status`、`nodes`、`edges`。`Node`：`id`、`kind`、`instruction`、`inputBindings`、`toolInvocationId`、`generationTaskId`、`status`、`attempt`、`outputs`。`Artifact`：`id`、`kind`、`uri`、`producerNodeId`、`contentHash`（可取得时）、`availability`。边必须引用确定的输出端口/素材 ID，不能靠模型从回复文本猜 URL。

接收计划时检查环、悬空边、输入类型和预算；node 状态 `blocked/ready/awaiting_approval/running/completed/failed/cancelled/unknown`。只有全部必要依赖完成且输出可读取才进入 ready。调度器保存状态后取得执行租约，受并发和轮次/时间预算约束；同一节点同一 attempt 使用稳定副作用 ID。重启恢复租约不等于重放动作，unknown 节点需核查已有收据或用户决定。失败默认阻塞依赖节点，重试和重新生成区分，新的付费 attempt 必须满足用户授权。

图片→视频最小闭环：图片提交获得现有 generationTaskId → 后台查询得到真实图片 URL → 注册 Artifact 并验证读取 → 将该 Artifact 显式绑定视频 reference → 视频提交。等待过程不保持语言模型循环空转，不由网页定时器承担唯一调度责任。阶段完成或需要批准时通知用户；未实现后台服务驻留时，必须说明退出应用期间不能推进。

## 交付顺序与验收门槛

1. 工具 broker、审批 ledger、只读文件工具和有限补丁；验证审批参数篡改、重复消费、路径越界和重启未知执行不重放。
2. 会话/轮次持久化与素材引用；验证重启继续、多轮隔离、重复 turnId、损坏存储及密钥不落日志。
3. 确认本机可用隔离后接通 isolated 终端；验证越界、网络、资源限制，不支持时如实保持 unsupported/host_approved。
4. 持久 DAG 与首个图片→视频链路；通过模拟长任务、失败依赖、进程中断和重复调度测试，再单独请求真实生成验证。

四项能力可分阶段交付，不能以文件工具加 cwd 限制宣称具有完整 Codex、安全沙箱或任意持续自主执行能力。
