# Zora Cloudflare Worker 官方网关与计费账本

本项目是 Zora 桌面端产品的 Serverless 云端网关，运行于 **Cloudflare Workers + Cloudflare D1（无服务器 SQL 数据库）**。

## 🎯 架构与商业化定位

1. **零自建服务器成本**：享受 Cloudflare Workers 免费额度（每日 10 万次请求）与 D1 免费存储，无需购买和维护云主机（VPS/ECS）。
2. **API 密钥物理隔离**：第三方供应商（如多元交叉 API 密钥 `DUOYUANX_API_KEY`）严格保存在 Cloudflare Secret 环境变量中，绝不随桌面客户端二进制分发打包。
3. **商业化定点账本**：
   - 官方积分兑换规则：1 元人民币 = 10 积分；成本人民币 × 12 = 应扣积分。
   - 所有调用在 upstream 前进行预检（Pre-check），不足时返回 `402 Payment Required`。
   - 上游响应后即时扣除积分并计入 D1 `usage_logs`，保证账本原子性与可审计性。

---

## 🚀 部署步骤

### 1. 安装 Wrangler CLI
在项目根目录或本目录下，确保已安装 Cloudflare Wrangler：
```bash
npm install -g wrangler
# 或者使用 npx
npx wrangler login
```

### 2. 创建 Cloudflare D1 数据库
运行以下命令创建 Zora D1 数据库：
```bash
npx wrangler d1 create zora-db
```
执行后控制台会输出类似如下配置：
```toml
[[d1_databases]]
binding = "DB"
database_name = "zora-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
请将生成的 `database_id` 填入 `wrangler.toml` 中的 `database_id` 字段。

### 3. 初始化数据库表结构与模型种子数据
运行本地执行或远程部署 SQL 脚本：
```bash
# 部署到 Cloudflare D1 生产环境
npx wrangler d1 execute zora-db --remote --file=./schema.sql

# 本地开发测试环境
npx wrangler d1 execute zora-db --local --file=./schema.sql
```

### 4. 设置安全环境变量 (Secrets)
通过 Wrangler CLI 向 Cloudflare Workers 写入受保护的第三方密钥与 JWT 密钥：
```bash
# 1. 必填：多元交叉等大模型/生图上游 API Key
npx wrangler secret put DUOYUANX_API_KEY

# 2. 必填：JWT 签名私钥（建议使用 32 位以上随机字符串）
npx wrangler secret put JWT_SECRET
```

### 5. 本地预览运行
```bash
npm run dev
# 或
npx wrangler dev
```
本地将启动在 `http://localhost:8787`。

### 6. 发布上线
```bash
npm run deploy
# 或
npx wrangler deploy
```
发布成功后，控制台会输出绑定的 Worker 域名，例如：
`https://zora-gateway.<your-subdomain>.workers.dev`

---

## 💻 桌面客户端接入

在 Zora 桌面端分发安装包时：
1. 客户端支持读取 `localStorage.getItem('zora.api.base')` 或环境变量 `ZORA_API_BASE`。
2. 桌面客户端默认连接至已部署的 Worker 域名：
   ```javascript
   localStorage.setItem('zora.api.base', 'https://zora-gateway.<your-subdomain>.workers.dev');
   ```
3. 桌面端的所有用户注册、登录、积分查询、生图/对话请求将统一通过该网关鉴权和扣除积分，同时在用户本机通过纯原生的本地工作区引擎执行本地文件操作，**完全无需在用户电脑上安装 Docker**。
