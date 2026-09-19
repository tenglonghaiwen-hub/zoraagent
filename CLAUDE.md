# Zora 项目开发规范

## 语言

- 与用户交流时默认使用简体中文。

## 项目架构

Zora 是基于 **Codex 0.154.0 app-server** 的 Windows 桌面 Agent 应用，架构分为三层：

1. **内核层**：包内开源 Codex app-server（`runtime/codex/`），通过 JSON-RPC 与 Node.js 后端通信
2. **服务层**：Node.js 后端（`apps/server/`），负责对话编排、工具桥接、任务管理
3. **客户端层**：Electron 桌面壳（`apps/desktop/`）和 Web 界面（`apps/client/`）

关键模块：
- `packages/agent/codex-kernel.mjs` - Codex 内核桥接与生命周期管理
- `apps/server/codex-agent.mjs` - Agent 入口与后端选择（app-server/responses/cli）
- `apps/server/chat-service.mjs` - 对话服务与上下文编排
- `packages/agent/codex-interactions.mjs` - Codex 交互协议处理（审批、MCP 表单等）
- `packages/duoyuanx/` - 多元图像/视频生成接口适配
- `packages/desktop/windows-driver.mjs` - Windows 桌面自动化
- `packages/adapters/openmontage.mjs` - OpenMontage 视频编辑工具桥

## 代码修改规则

### 1. 内核与后端交互

**永远不要**直接修改 `runtime/codex/` 下的 Codex 可执行文件或其内部逻辑。这是官方编译的二进制文件。

修改 Agent 行为时：
- 工具定义、上下文编排 → 修改 `apps/server/chat-service.mjs`
- Codex 交互处理（审批、表单）→ 修改 `packages/agent/codex-interactions.mjs`
- 内核启动参数、环境配置 → 修改 `packages/agent/codex-kernel.mjs`
- 后端选择逻辑 → 修改 `apps/server/codex-agent.mjs`

### 2. 工具开发

添加新工具时：
1. 在 `packages/agent/tool-handlers/` 创建工具处理模块（参考 `browser-tools.mjs`）
2. 在 `apps/server/chat-service.mjs` 的工具定义中注册
3. 在 `packages/agent/tool-preferences.mjs` 添加工具启停配置
4. 如需审批，在 `packages/agent/approval-policy.mjs` 配置审批策略

工具分为两类：
- **Codex 原生工具**：文件读写、终端执行、技能调用等，由 Codex 内核直接处理
- **Zora 动态工具**：浏览器、桌面自动化、媒体生成等，由后端桥接处理

### 3. 错误处理

使用 `packages/agent/codex-errors.mjs` 中的标准错误构造：
- `rpcError(code, message, data)` - JSON-RPC 协议错误
- 配额错误检测：`isQuotaError(message)` 正则匹配中英文

重要：Codex 内核通过 JSON-RPC 通信，所有错误必须符合 JSON-RPC 2.0 规范。

### 4. 媒体生成

图像/视频生成流程：
1. Agent 调用生成工具 → `apps/server/chat-service.mjs` 拦截
2. 路由到 `packages/duoyuanx/generation-service.mjs`
3. 根据模型 ID 选择适配器（`generation-adapters.mjs`）
4. 任务持久化到 `packages/duoyuanx/task-store.mjs`
5. 轮询或 webhook 更新状态

添加新模型适配器：
- 在 `packages/duoyuanx/catalog.mjs` 注册模型元数据
- 在 `packages/duoyuanx/generation-adapters.mjs` 实现 `submit` 和 `query` 方法
- MiniMax H3 官方接口在 `minimax-official.mjs`

### 5. 桌面自动化

Windows 桌面能力在 `packages/desktop/windows-driver.mjs`：
- 窗口枚举、激活、几何信息
- UI 自动化（UIA）树遍历、元素查找
- 键盘输入、鼠标点击（受限，仅测试）

浏览器自动化在 `packages/agent/browser-client.mjs`：
- Playwright 驱动的独立浏览器实例
- 搜索、导航、内容提取
- 需要 Electron 桌面进程

剪映控制在 `apps/desktop/jianying-bridge.js`：
- 读取 UI 树、执行有限操作
- **未完整验收**导入-剪辑-导出全流程

### 6. 文件与工作区

- 默认工作区：`workspace/`（可通过 `ZORA_WORKSPACE_ROOT` 配置）
- Codex 工作目录：`CodexKernel` 构造时的 `cwd` 参数
- PPTX 文件校验：`packages/agent/pptx-validation.mjs` 检查已知结构错误
- 文件交付：桌面下载到 `用户下载目录/Zora/`，失败不跳转网页

### 7. 数据持久化

```
data/
├── chat-sessions/          # 会话记录（服务端）
├── generation-tasks/       # 生成任务状态
├── local-approvals/        # 审批记录
└── codex-home/            # Codex 内核数据
    ├── zora-threads.json      # 会话 ID → Codex 线程 ID 映射
    └── zora-execution-records.json  # 执行历史与审批状态
```

- 会话恢复：读取 `threadMap` 找到 Codex 线程 ID，通过 `resumeConversation` 恢复
- 执行记录：重启时标记中断任务为 `unknown` 状态，不自动重放
- 素材库：前端 IndexedDB，不跨浏览器/设备同步

### 8. 配置与环境变量

关键配置（见 `apps/server/config/agent.json` 和 `README.md`）：
- `ZORA_AGENT_BACKEND` - 后端选择：`app-server`（推荐）/ `responses` / `cli`
- `ZORA_CODEX_BIN` - 仅允许包内路径，外部路径会被拒绝
- `ZORA_AGENT_API_KEY` / `DUOYUANX_API_KEY` - 凭据优先级
- `MINIMAX_API_KEY` - H3 官方接口独立凭据（或使用 DPAPI 加密存储）
- `OM_ENABLED` - OpenMontage 桥开关

**安全约定**（见 `AGENTS.md`）：
- 第三方 API 密钥只能位于远程服务端（当前开发版本例外）
- 不要将真实 Key 提交到仓库、放入前端代码或日志

### 9. 测试与验证

测试文件在 `tests/`，执行：
```bash
npm test                    # Node.js 单元测试
npm run test:desktop        # Electron 交互测试（需 Playwright）
node scripts/verify-codex-kernel.mjs  # 内核验证（使用本地模拟服务）
```

添加新功能时：
- 核心逻辑写单元测试（`tests/*.test.mjs`）
- 交互流程写集成测试（`scripts/verify-*.mjs`）
- 付费接口使用 mock，避免实际计费

### 10. 常见陷阱

1. **不要假设 Codex 桌面已安装**：包内运行时是自包含的，不查找系统 PATH
2. **不要混淆两种后端**：`app-server` 是 Codex 进程，`responses` 是旧版直接调用模型 API
3. **不要在工具中阻塞**：Codex 期望工具快速返回，长时间操作应异步+轮询
4. **不要跳过审批**：高风险操作（删除、支付、发送消息）必须经过审批流程
5. **不要假设上游能力**：模型能力、媒体生成、MCP 认证取决于实际配置的上游服务
6. **重启后不自动重放**：执行记录持久化，但中断任务标记为 `unknown`，需人工核对

## 文档引用

修改相关模块前，参考：
- 整体架构 → `README.md`
- 安全约定 → `AGENTS.md`
- Codex 接入 → `docs/codex-agent.md`
- 包内运行时 → `docs/bundled-runtime.md`
- 浏览器/剪映 → `docs/INDEPENDENT-BROWSER.md` / `docs/JIANYING-DESKTOP-CONTROL.md`
- OpenMontage → `docs/openmontage-bridge.md`
- 视频分析 → `docs/VIDEO-AUDIO-TIMELINE.md`
- 当前状态 → `docs/CURRENT-STATUS.md`

## Git 提交

- 提交信息使用简体中文
- 结尾添加：`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- PR 描述结尾添加：`🤖 Generated with [Claude Code](https://claude.com/claude-code)`
