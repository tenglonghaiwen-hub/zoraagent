# 造境 Zora · Cloudflare Worker 远程网关与真实密钥部署指南

> **目标**：以 **0 元服务器成本** 搭建具备生产级鉴权、定点账本扣费、多提供商（MiniMax 官方、DeepSeek、OpenAI、硅基流动、多元交叉等）动态反代的 Serverless 云网关。  
> **安全核心规范**：所有第三方 API 密钥只能存放于 Cloudflare 远端（D1 数据库或 Worker Secrets），**绝对不进入桌面客户端**。

### 🌐 当前线上已部署生产环境
- **生产网关 API 入口**：`https://zora-api.tenglonghaiwen.workers.dev`
- **站长专属运营中台 (Admin Console)**：[https://zora-api.tenglonghaiwen.workers.dev/admin](https://zora-api.tenglonghaiwen.workers.dev/admin)
- **默认管理员密码**：`admin123456`（登录后可在后台服务商配置 Tab 随时修改）
- **关联 Cloudflare D1 数据库**：`zora-db` (`295307be-7caa-4d26-b85e-e68ac22a0c51`)
- **客户端模式**：普通用户开箱即用，无需配置；高级开发者调试默认预填此生产网关。

---

## 一、架构拓扑

```text
┌─────────────────────────────────────────────────────────────┐
│                    Zora 桌面端 (Client)                     │
│  - 不存储任何第三方 API Key                                   │
│  - 通过 getApiBase() 统一路由至当前激活的网关                │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (Bearer JWT)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           Cloudflare Worker 无服务云网关 (zora-api)          │
│  - 纯 Web Crypto 算法 JWT 签发与高并发验签                  │
│  - 预检用户定点账本 (Preflight 402 拦截)                    │
│  - 动态路由与多厂商反代: MiniMax / DeepSeek / OpenAI 等     │
│  - 内嵌可视化 Admin 控制台 (/admin)                         │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
    ┌──────────────────────┐      ┌───────────────────────────┐
    │ Cloudflare D1 分布式 │      │ 各厂商官方上游 API         │
    │ 关系型数据库         │      │ - api.minimax.cn (视频/H3)│
    │ (用户/账本/密钥配置) │      │ - api.deepseek.com        │
    └──────────────────────┘      │ - api.openai.com          │
                                  │ - api.siliconflow.cn      │
                                  └───────────────────────────┘
```

---

## 二、部署前准备

1. **注册 Cloudflare 账号**：[https://dash.cloudflare.com](https://dash.cloudflare.com)（完全免费，无需绑定信用卡即可使用 Worker + D1 免费额度：每天 100,000 次 Worker 请求，每月 500 万次 D1 读）。
2. **进入 Worker 目录**：
   ```powershell
   cd D:\zora\apps\cloudflare-worker
   ```
3. **登录 Cloudflare 命令行 (Wrangler)**：
   ```powershell
   npx wrangler login
   ```
   *浏览器会自动打开，点击「Allow / 授权」即可。*

---

## 三、部署三步走

### 步骤 1：创建并初始化 D1 数据库

1. **创建 D1 实例**：
   ```powershell
   npm run db:create
   ```
   *控制台会输出返回的 `database_id`，例如：*
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "zora-db"
   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```
2. **检查 `wrangler.toml`**：
   若这是你新创建的库，将输出的 `database_id` 填入 `apps/cloudflare-worker/wrangler.toml` 的对应位置。
3. **导入数据库结构（建表与初始数据）**：
   ```powershell
   npm run db:remote:init
   ```
   *这会自动创建 `users`、`sessions`、`usage_logs`、`server_models`、`system_configs` 等核心表，并写入默认模型定价。*

---

### 步骤 2：设置基础管理密钥并发布上线

1. **设置生产 JWT 密钥（防止篡改令牌）**：
   ```powershell
   npm run secret:jwt
   # 输入一段高强度随机密钥（例如：zora_production_jwt_secret_2026_x89a）
   ```
2. **发布上线**：
   ```powershell
   npm run deploy
   ```
   *发布成功后，控制台会输出公网 Worker 地址，形如：*
   ```text
   Uploaded zora-api (2.1 sec)
   Deployed zora-api triggers (0.8 sec)
     https://zora-api.<你的子域名>.workers.dev
   ```

---

### 步骤 3：配置真实大模型 API 密钥（二选一）

#### 方式 A：推荐！通过可视化 Admin 控制台配置（即时生效）

1. 在浏览器打开部署好的后台管理地址：
   ```text
   https://zora-api.<你的子域名>.workers.dev/admin
   ```
2. **登录密码**：默认初始密码为 `admin123456`（登录后可在后台直接修改）。
3. 切换到 **「API 密钥与配置」** 标签页：
   - **MiniMax 官方**：填入 `MINIMAX_API_KEY`（在 MiniMax 开放平台获取的官方 Key），Base 地址默认 `https://api.minimax.cn`。点击 **「测试 MiniMax 连通性」** 按钮，系统会直接发起上游握手并返回毫秒延迟。
   - **DeepSeek 官方**：填入 `DEEPSEEK_API_KEY`（`sk-...`），点击 **「测试 DeepSeek」**。
   - **OpenAI 官方**：填入 `OPENAI_API_KEY`，点击 **「测试 OpenAI」**。
   - **硅基流动 / 多元探索 / 自定义**：直接填入对应 Key 与中转 Base URL。
4. 点击 **「保存所有服务商配置」**。配置直接存入 Cloudflare D1，**0 秒热生效，无需重新部署 Worker**！

#### 方式 B：通过 Wrangler 命令行设置环境变量 Secrets

如果你不希望将 Key 存入数据库，也可以直接写入 Worker 独立安全环境变量：
```powershell
# 配置 MiniMax 官方密钥
npm run secret:minimax

# 配置 DeepSeek 密钥
npm run secret:deepseek

# 配置 OpenAI 密钥
npm run secret:openai
```
*Worker 的解析优先级为：`D1 数据库配置 > Worker Environment Secrets > 默认 fallback`。*

---

## 四、客户端连接与热切换

1. 打开造境客户端桌面端（或浏览器访问 `http://127.0.0.1:4318`）。
2. 进入 **「设置 (Preferences)」** 面板。
3. 在顶部的 **「服务网关 (Service Gateway)」** 中：
   - 点击切换至 **「云端网关 (Cloudflare Worker)」** 药丸胶囊；
   - 填入部署好的 Worker 域名：`https://zora-api.<你的子域名>.workers.dev`；
   - 点击 **「测试连接」**。
4. 提示 `✓ 状态正常 · 响应 XXms · XX 个模型就绪` 时，客户端的所有注册、登录、模型报价、视频创作和 Agent 对话请求将全自动流转至远端云网关！

---

## 五、常见问题与排查 (FAQ)

| 现象 | 可能原因 | 解决办法 |
| :--- | :--- | :--- |
| **测试连接报 500: 未配置 DB 绑定** | `wrangler.toml` 中的 `database_id` 未创建或写错 | 重新执行 `npx wrangler d1 create zora-db`，确保 ID 正确并重新 `npm run deploy` |
| **测试连通性返回 HTTP 401** | 对应厂商的 API Key 输入错误或已过期 | 登录对应厂商后台（如 MiniMax 开发者平台）核实 Key 是否有效并重新复制粘贴 |
| **跨域 (CORS) 报错** | 请求头被拦截 | Worker 已内置全域名自适应 CORS 响应（包含 OPTIONS 预检 86400 秒缓存），通常是网络代理篡改了请求头，检查代理软件 |
| **实时日志跟踪** | 想要看云端 Worker 请求详细日志 | 在命令行执行 `npm run tail`，即可看到边缘节点的所有请求实时控制台打印 |
