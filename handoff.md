# 造境 Zora → Codex 交接文档 (HANDOFF)

> **最新更新**：2026-09-19（2026-09-18 晚班重大里程碑交接）  
> **维护入口**：最新文档索引见 [文档索引](docs/README.md)、[架构分离方案](docs/ARCHITECTURE-SEPARATION.md)、[认证测试报告](docs/AUTH-TEST-REPORT.md)、[API 规范](docs/API.md)、[当前状态](docs/CURRENT-STATUS.md)  
> **交接对象**：Codex / 协作 Agent  
> **用户**：Tr2ck（Windows 账户 `强哥`，机器 `DESKTOP-TI64NQE`）  
> **项目规范**：严格遵循 [AGENTS.md](AGENTS.md) 约定（第三方 API 密钥只在远程服务端、定点账本 1元=10分、成本×12、模型及并发以服务端为准、原生安全沙箱）

---

## 0. 昨晚工作汇总（2026-09-18 晚班成果汇总）

昨晚（2026-09-18 18:50 ~ 22:00）共完成 **11 次代码提交**，新增 28 个文件，修改 8 个核心模块，覆盖全链路端到端自动化测试。重点完成了 **从单机到 C/S 架构分离、用户认证与定点账本、原生安全沙箱解耦、Cloudflare Worker 无服务云网关与可视化管理控制台** 5 大核心工作流：

| 模块 | 核心改动 | 涉及关键文件 |
|------|---------|-------------|
| **1. 用户认证系统** | JWT Bearer 鉴权、bcrypt 哈希、会话管理、自动续期、纯 JS SQLite (`sql.js`) 持久化、客户端登录弹窗与测试账号一键免密填入 | `apps/client/auth.js`, `apps/client/login-handler.js`<br>`apps/server/routes/auth.mjs`, `packages/auth/index.mjs`<br>`packages/database/schema.mjs`, `tests/auth.test.mjs` |
| **2. 配额预检与定点账本** | 接入 `/api/generate` 与 `/api/chat` 配额预检（Preflight）、402 余额拦截、Phase 3 用量明细账本（`usage_logs`）、演示充值接口、1元=10分与成本×12换算规则 | `packages/auth/pricing.mjs`, `apps/server/routes/generation.mjs`<br>`tests/quota-billing.test.mjs`, `tests/phase3-lifecycle.test.mjs` |
| **3. 工作区原生安全沙箱** | 彻底解耦 Docker 强依赖，实现原生自适应安全沙箱与后端回退机制，严格限制目录遍历与越界访问，敏感文件防护，前端联动运行时状态面板 | `packages/agent/local-runtime.mjs`, `apps/client/runtime-panel.js`<br>`tests/native-runtime.test.mjs` |
| **4. Cloudflare Worker 网关** | 构建 Serverless 云网关，对接 Cloudflare D1 分布式数据库（`zora-db`），实现第三方密钥完全剥离桌面端；多提供商动态代理架构（MiniMax 官方直连、多元交叉、OpenAI、SiliconFlow、DeepSeek、自定义上游） | `apps/cloudflare-worker/src/index.mjs`, `proxy.mjs`<br>`apps/cloudflare-worker/src/billing.mjs`, `wrangler.toml`<br>`apps/cloudflare-worker/schema.sql`, `tests/cloudflare-worker.test.mjs` |
| **5. 可视化 Admin 控制台** | Worker 内嵌独立高性能可视化单页后台（Inter 字体、高对比暗黑美学、玻璃拟态），支持系统密钥配置、服务端模型可用性管理、自定义模型与查询路由（Route Table）配置 | `apps/cloudflare-worker/src/admin-ui.mjs`<br>`tests/cloudflare-worker.test.mjs` |

---

## 1. 产品定位与核心约束

**造境 Zora** = 桌面端创作软件（Electron），不是普通网页 SaaS。

| 原则 | 说明 |
|------|------|
| **Agent-first** | 能力优先走 Agent 工具调用，UI 风格克制一体 |
| **桌面壳** | Electron：`D:\zora\apps\desktop`，加载本地前端与远程/本地服务端 |
| **密钥隔离** | **第三方 API 密钥只能位于远程服务端/云网关**，绝对不进入桌面端和客户端代码 |
| **定点账本** | **1 元 = 10 积分；成本人民币 × 12 = 应扣积分**。必须使用定点账本，扣费前必须预检 |
| **Comfy / RunningHub** | RunningHub 已彻底移除，不再接入 |
| **OpenMontage** | 能力嵌入客户端本地 sidecar（`vendor/openmontage`） |

---

## 2. 仓库与关键路径

| 路径 | 用途 |
|------|------|
| `D:\zora` | 主工程根目录 |
| `D:\zora\apps\client\` | 客户端前端：`index.html`、`app.js`、`auth.js`、`login-handler.js`、`style.css` |
| `D:\zora\apps\server\` | Node 服务端：`server.mjs`、`routes/auth.mjs`、`routes/generation.mjs` |
| `D:\zora\apps\desktop\` | Electron 主进程：`main/main.mjs` |
| `D:\zora\apps\cloudflare-worker\` | **Cloudflare Worker 云端无服务网关**（D1 数据库、多提供商反代、管理后台） |
| `D:\zora\packages\auth\` | 认证鉴权与计费模块：`index.mjs`（JWT/用户）、`pricing.mjs`（定价核算） |
| `D:\zora\packages\database\` | 数据库层：`schema.mjs`（纯 JS SQLite 驱动，位于 `data/zora.db`） |
| `D:\zora\packages\agent\` | Agent 工具/沙箱：`local-runtime.mjs`（原生工作区安全沙箱）、`tools.mjs` |
| `D:\zora\data\` | 运行数据：`zora.db`（用户/配额/账本）、`codex-home`、`local-workflows` |
| `D:\zora\tests\` | 自动化测试用例集（含认证、计费、原生沙箱、Worker 测试） |

前端缓存戳（改动前端后务必递增）：当前 **`studio187`**。

本地 Node：`D:\zora\runtime\node-v24.21.0-win-x64\node.exe`

---

## 0.1 站长专属运营中台与开箱即用（2026-09-19 最新进展）
针对“用户开箱即用、后台站长统一管控”的全球网关定位，完成 7 大模块交付与全面测试验证：
1. **客户端零配置开箱即用**：普通用户启动即连官方全球云端网关，设置面板高亮展示「● 官方云服务畅通」，将网关选择收折为「高级开发者网关调试」折叠项；
2. **消息中心与未读红点**：桌面端顶栏消息铃铛接入云端 `/api/messages`，支持未读红点实时提醒；
3. **站长专属运营中台（Super Admin Console）**：
   - **用户用量与 VIP 控制**：实时搜索过滤、VIP 期限设置（30天/90天/365天/永久/取消）、一键账号冻结与解冻；
   - **充值与退费审计**：管理员一键增减积分，正数充值 `admin_topup`，负数退费 `admin_refund`，与服务端定点账本同构；
   - **单人账本穿透**：弹窗穿透查询任意创作者的历史消费、充值与调用明细；
   - **消息全员与定向推送**：支持全员公告 `*` 与个人私信实时推送，后台支持一键撤回；
   - **VIP 专属模型控制**：支持将特定模型标记为 `👑 VIP 专属`；
   - **服务商 API 密钥自检与动态路由映射**。

---

## 3. 架构演进速览（C/S 分离 + Cloudflare 网关）

```
┌─────────────────────────────────────────────────────────────┐
│                      Zora 客户端 (Electron)                 │
│  ├─ 界面层：工作台 (#studio) / 画布 (#canvases) / 登录模态框 │
│  ├─ 状态层：localStorage 会话分离 (主 Agent ↔ 画布 Agent)    │
│  └─ 请求拦截：自动携带 Authorization: Bearer <token>         │
└──────────────┬───────────────────────────────┬──────────────┘
               │ (本地开发模式)                 │ (生产/云网关模式)
               ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────────────┐
│       Node 本地开发服务       │ │       Cloudflare Worker 云端网关       │
│  (http://127.0.0.1:4318)     │ │   (D1: zora-db / Admin Console)      │
│  ├─ /api/auth/* (注册/登录)  │ │  ├─ /api/auth/* (分布式 JWT/D1 用户) │
│  ├─ /api/generate (预检扣费) │ │  ├─ /api/generate / /api/chat 鉴权   │
│  ├─ /api/chat (Codex Agent)  │ │  ├─ /admin (可视化控制台 SPA)        │
│  ├─ /api/om/* (OpenMontage)  │ │  └─ 动态多模型提供商路由反代:        │
│  └─ SQLite (data/zora.db)    │ │     ├─ MiniMax 官方 (H3 直连视频)    │
│     ├─ users / sessions      │ │     ├─ 多元交叉 (Flux / LLM)         │
│     ├─ server_models         │ │     ├─ OpenAI / DeepSeek / 硅基流动  │
│     └─ usage_logs (账本)     │ │     └─ 自定义上游 (OneAPI/Relay)     │
└──────────────┬───────────────┘ └──────────────────┬───────────────────┘
               │                                    │
               └─────────────────┬──────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │   第三方 AI 远程服务商   │
                    │ (密钥仅存放于服务端/云端)│
                    └─────────────────────────┘
```

---

## 4. 2026-09-18 重点技术实现细节

### 4.1 用户认证与预设测试账号
- **密码处理**：采用 `bcryptjs` 进行加盐哈希，禁止明文入库。
- **Token 机制**：采用 `jsonwebtoken` 生成 7 天有效期的 JWT，提供 `/api/auth/refresh` 自动续期。
- **预设账号与权限**：
  | 账号 | 默认密码 | 角色 | 初始积分 | 说明 |
  |------|---------|------|---------|------|
  | `admin@zora.local` | `admin123` | admin | 10000 | 管理员，可管理模型与配额 |
  | `test@zora.local` | `test123` | user | 1100 | 普通测试用户 |
- **UI 体验**：登录弹窗内置测试账号一键快捷填充按钮，错误提示明确友好（“邮箱或密码错误”）。

### 4.2 配额体系与计费规则
- **换算基准**：
  - 1 元人民币 = 10 积分。
  - 接口调用成本人民币 × 12 = 应扣积分。
  - 默认定价回退基准：`agent` 模式 1 分/次，`image` 10 分/张，`video` 100 分/次（以服务端 `server_models.quota_cost_per_unit` 配置为准）。
- **流程控制**：
  1. 客户端发起生成请求 (`POST /api/generate`)。
  2. 服务端鉴权并计算所需积分（`calculateQuotaCost`）。
  3. 执行 **配额预检**：余额不足直接拦截并返回 `402 Payment Required`（带所需积分与当前余额提示）。
  4. 扣除积分并向 `usage_logs` 表插入定点流水记账记录。
  5. 响应中包含更新后的用户最新余额，前端顶栏即时同步。

### 4.3 工作区原生安全沙箱（解耦 Docker）
- 在 `packages/agent/local-runtime.mjs` 中构建了自适应安全沙箱：
  - **模式支持**：支持 `native`（原生隔离）与 `docker`（容器隔离），优先使用原生沙箱保证无 Docker 环境流畅运行。
  - **路径越界防御**：要求工作区与审批目录分离，禁止挂载系统根目录，禁止通过符号链接跳转，仅允许操作工作区内部相对路径。
  - **敏感资产隔离**：自动屏蔽 `.env*`、`.git`、`credentials`、`secrets`、`id_rsa`、证书私钥（`.pem`, `.key`）等敏感文件名。
  - **前端状态监控**：通过 `runtime-panel.js` 实时展示沙箱模式与健康指标。

### 4.4 Cloudflare Worker 云网关与 D1 数据库
- **工程位置**：`apps/cloudflare-worker/`。
- **D1 绑定**：`wrangler.toml` 绑定 live D1 数据库 `zora-db`，执行 `schema.sql` 完成数据库结构同步。
- **路由分发与安全代理**（`src/proxy.mjs`）：
  - 集中保管各类上游 API Keys（`MINIMAX_API_KEY`, `DUOYUANX_API_KEY`, `OPENAI_API_KEY`, `SILICONFLOW_API_KEY`, `DEEPSEEK_API_KEY`, `CUSTOM_API_KEY`）。
  - 支持 MiniMax H3 官方直连（`/v2/video_generation` 与 `/v2/query/video_generation/{task_id}`）。
  - 支持多上游模型映射与路由定制。

### 4.5 可视化 Admin 控制台
- **访问入口**：部署在 Worker 的 `/admin` 路径。
- **能力包含**：
  1. **系统配置**：在线配置/更新上游提供商 API Key 与 Base URL（密码/密钥脱敏遮罩）。
  2. **模型目录（Model Catalog）**：管理 `server_models`，开启/停用模型、设置单价积分、调整最大并发数。
  3. **自定义路由（Route Table）**：模型路由与查询路由在线配置，表格实时展现上游服务商与映射端点。
  4. **用户与用量明细**：查看注册用户列表、调整用户积分、查阅流水明细。

---

## 5. 关键存储与数据结构

### 5.1 本地 SQLite / Cloudflare D1 数据表
- `users`: `(id, email, password_hash, username, role, quota_balance, status, created_at, updated_at)`
- `sessions`: `(id, user_id, token, expires_at, created_at, last_used_at)`
- `server_models`: `(id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at)`
- `usage_logs`: `(id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)`
- `system_configs`: `(key, value, description, is_secret, updated_at)`
- `model_routes`: `(model_id, provider, path, query_path, created_at, updated_at)`

### 5.2 关键 localStorage Key
| Key | 含义 |
|-----|------|
| `zora_token` | 当前登录用户的 JWT Bearer Token |
| `zora_user` | 当前登录用户的缓存信息（含余额） |
| `zora.auth.v1` | 兼容旧前端的登录标记 |
| `zora.workMode.v1` | `agent` \| `canvas` 工作模式 |
| `zora.canvases.v1` | 多画布项目库列表 |
| `zora.canvasCurrent.v1` | 当前打开的画布 ID |
| `zora.canvasAgentSession.v1` | 画布右侧 Agent 独立会话（与主创作区会话物理隔离） |
| `zora.canvasAgentRailCollapsed.v1` | 画布右侧 Agent 栏收起状态 |
| `zora.gateway.mode.v1` | 服务网关模式：`local` (本地 127.0.0.1:4318) \| `cloud` (Cloudflare Worker) |
| `zora.gateway.cloudUrl.v1` | 自定义 Cloudflare Worker 云网关地址 |
| `zora.gateway.localUrl.v1` | 本地服务地址（默认 `http://127.0.0.1:4318`） |
| `zora.api.base` | 当前生效的 API 请求基地址（`getApiBase()` 动态同步） |

---

## 6. 开工与验证清单

接手同学启动开发前，建议按以下顺序验证：

```text
[ ] 1. 验证 Node 环境与测试套件：
      & "D:\zora\runtime\node-v24.21.0-win-x64\node.exe" -v
[ ] 2. 验证自动化测试（全量 37 项）：
      - tests/auth.test.mjs (用户认证与会话)
      - tests/quota-billing.test.mjs (配额预检与扣除)
      - tests/phase3-lifecycle.test.mjs (用量账本与全生命周期)
      - tests/native-runtime.test.mjs (原生工作区安全沙箱)
      - tests/cloudflare-worker.test.mjs (Cloudflare Worker 网关、连通性探测与控制台)
      - tests/canvas-agent-node-interactivity.test.mjs (画布节点拖拽与插入联动)
      - tests/gateway-switch.test.mjs (本地/云端网关动态切换与连通性测试)
      - tests/demo-recharge.test.mjs (充值套餐计算、演示收银台与入账测试)
[ ] 3. 启动本地服务并验证桌面端：
      - 执行 start-zora.cmd 或 node apps/server/server.mjs (默认端口 4318/4317)
      - 打开客户端，测试点击测试账号登录（test@zora.local / test123）
      - 检查顶栏积分实时显示与收银台充值入账
[ ] 4. 验证 Cloudflare Worker 控制台与网关切换：
      - 客户端打开“设置”面板，切换至云端网关并点击“测试连接”
      - cd apps/cloudflare-worker
      - 详见部署与配置文档 docs/CLOUDFLARE-WORKER-DEPLOYMENT.md
[ ] 5. 前端改动必须递增 studio 缓存版本号（index.html 中的 ?v=studioXXX）。
```

---

## 7. 下一步规划建议

1. **画布 Agent 与生成结果节点化联动**：【已完成 ✅ 2026-09-19】
   - 支持在结果卡片上点击“⊞ 插入画板”/“⊞ 全部插入画板”。
   - 支持从 Agent 结果拖拽（Drag & Drop）至画板精准生成 `res-image` / `res-video` 节点。
   - 缓存戳升级至 `studio183`，新增 `tests/canvas-agent-node-interactivity.test.mjs` 全量通过。
2. **Cloudflare Worker 远程云网关 / 本地开发服务 一键切换开关**：【已完成 ✅ 2026-09-19】
   - 在客户端系统设置面板（`#settings`）中实现“本地服务 (127.0.0.1:4318) / 云端网关 (Cloudflare Worker)”一键切换药丸按钮。
   - 支持自定义 Cloudflare Worker URL，支持一键连通性探测（实时统计 `/api/models` 响应延迟与可用模型数），支持打开 Admin 控制台。
   - `auth.js` 统一接管 `getApiBase()` / `apiUrl()` 动态路由，无需重启客户端即时热生效。
   - 静态资源版本升级至 `studio184`，新增自动化测试 `tests/gateway-switch.test.mjs`，全套 32 项自动化测试全部通过。
3. **充值面板与演示支付全流程打通**：【已完成 ✅ 2026-09-19】
   - 在客户端 `#credits` 和 `#wallet` 中实现阶梯充值套餐卡片（￥10、￥50、￥100、￥200及自定义金额）；
   - 严格遵循 `1 元 = 10 积分` 定点账本；
   - 打造高保真演示收银台模态框（`#checkout-dialog`），含订单号、动态二维码扫描动画、倒计时与合规警示横幅；
   - 点击模拟支付即时调用 `/api/user/topup`，服务端记录 `usage_logs`，客户端广播刷新所有余额视图与明细表格；
   - 升级缓存戳至 `studio185`，新增 `tests/demo-recharge.test.mjs`，全套 36 项测试全部通过。
4. **Cloudflare Worker 真实多模型密钥配置与部署联调**：【已完成 ✅ 2026-09-19】
   - 实现服务端提供商密钥连通性探测接口 `POST /api/admin/providers/test` 与代理核心方法 `testProviderConnectivity`。
   - 支持 MiniMax 官方直连、DeepSeek、OpenAI、SiliconFlow、多元交叉及自定义反代端点的自检与网络延迟诊断。
   - 在 Admin 可视化控制台（`admin-ui.mjs`）为各模型厂商提供一键「测试连通」按钮与毫秒级延迟指示。
   - 编写完整的 0 成本部署与密钥配置指南 [CLOUDFLARE-WORKER-DEPLOYMENT.md](docs/CLOUDFLARE-WORKER-DEPLOYMENT.md)。
   - 升级 `tests/cloudflare-worker.test.mjs`，全套 37 项自动化测试全部通过。
5. **Electron 正式打包与签名**：
   - 完善生产环境跨平台打包脚本与离线静态资源封装（待用户下达明确打包指令）。
