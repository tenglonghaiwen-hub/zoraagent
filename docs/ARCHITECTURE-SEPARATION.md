# Zora 客户端-服务端分离架构方案

## 概述

将 Zora 改造为 C/S 架构，客户端不存储任何 API 密钥，所有模型调用通过服务端代理，实现：
- ✅ 密钥安全（客户端无法获取）
- ✅ 集中管理（服务端控制模型可用性）
- ✅ 用户认证（多用户支持）
- ✅ 用量追踪（计费、限流）

---

## 架构设计

### 当前架构（不安全）

```
┌─────────────────────────────────────┐
│        Zora 客户端（桌面/Web）        │
│  ┌──────────────────────────────┐   │
│  │   配置 API Key               │   │
│  │   ZORA_AGENT_API_KEY         │   │
│  │   DUOYUANX_API_KEY           │   │
│  └──────────────────────────────┘   │
│            ↓                         │
│  ┌──────────────────────────────┐   │
│  │   直接调用上游 API           │   │
│  │   api.openai.com             │   │
│  │   duoyuanx.com               │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘

问题：客户端存储密钥，可被窃取
```

### 目标架构（安全）

```
┌────────────────────┐            ┌─────────────────────────────┐
│   Zora 客户端      │            │     Zora 服务端             │
│   (Desktop/Web)    │            │                             │
│                    │            │  ┌─────────────────────┐   │
│  用户登录          │──Token──▶  │  │  用户认证           │   │
│  sessionToken      │            │  │  JWT / Session      │   │
│                    │            │  └─────────────────────┘   │
│  发送请求          │            │           ↓                 │
│  /api/chat         │──────────▶ │  ┌─────────────────────┐   │
│  /api/generate     │            │  │  请求验证与鉴权     │   │
│                    │            │  │  - Token 验证        │   │
│                    │            │  │  - 用量检查          │   │
│                    │            │  │  - 速率限制          │   │
│                    │            │  └─────────────────────┘   │
│                    │            │           ↓                 │
│                    │            │  ┌─────────────────────┐   │
│                    │            │  │  代理层             │   │
│                    │            │  │  使用服务端密钥     │   │
│                    │            │  └─────────────────────┘   │
│                    │            │           ↓                 │
│  接收响应          │◀──────────  │  ┌─────────────────────┐   │
│                    │            │  │  上游 API           │   │
│                    │            │  │  api.openai.com     │   │
│                    │            │  │  duoyuanx.com       │   │
│                    │            │  └─────────────────────┘   │
└────────────────────┘            └─────────────────────────────┘
                                              ↓
                                   ┌─────────────────────┐
                                   │  数据库             │
                                   │  - 用户信息          │
                                   │  - 用量记录          │
                                   │  - 会话历史          │
                                   └─────────────────────┘
```

---

## 实施计划

### 阶段一：用户认证系统

#### 1.1 数据库设计

**用户表（users）：**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user', -- user, admin
  quota_balance INTEGER DEFAULT 0, -- 积分余额
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active' -- active, suspended
);
```

**会话表（sessions）：**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**用量记录表（usage_logs）：**
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  resource_type VARCHAR(50), -- chat, image, video
  model_id VARCHAR(100),
  tokens_used INTEGER,
  quota_cost INTEGER,
  request_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.2 认证 API

**注册：**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password",
  "username": "用户名"
}

Response:
{
  "ok": true,
  "userId": "uuid"
}
```

**登录：**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}

Response:
{
  "ok": true,
  "token": "jwt-token-or-session-id",
  "expiresAt": "2026-09-19T00:00:00Z",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "用户名",
    "quotaBalance": 1000
  }
}
```

**刷新 Token：**
```http
POST /api/auth/refresh
Authorization: Bearer <current-token>

Response:
{
  "ok": true,
  "token": "new-token",
  "expiresAt": "..."
}
```

**登出：**
```http
POST /api/auth/logout
Authorization: Bearer <token>

Response:
{
  "ok": true
}
```

#### 1.3 中间件实现

**packages/auth/middleware.mjs：**
```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: '需要身份验证',
      category: 'permission'
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, role }
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: 'Token 无效或已过期',
      category: 'permission'
    });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: '权限不足',
        category: 'permission'
      });
    }
    next();
  };
}
```

---

### 阶段二：API 代理层

#### 2.1 密钥管理

**服务端配置文件（仅服务器可见）：**
```javascript
// packages/proxy/api-keys.mjs
const API_KEYS = {
  openai: process.env.OPENAI_API_KEY,
  duoyuanx: process.env.DUOYUANX_API_KEY,
  minimax: process.env.MINIMAX_API_KEY,
};

export function getApiKey(provider) {
  const key = API_KEYS[provider];
  if (!key) {
    throw new Error(`Provider ${provider} not configured`);
  }
  return key;
}
```

#### 2.2 代理端点

**修改现有 API 端点添加认证：**
```javascript
// apps/server/routes/chat.mjs
import { requireAuth } from '../../packages/auth/middleware.mjs';

export function handleChatRoutes(app, { chatService }) {
  // 添加认证中间件
  app.post('/api/chat', requireAuth, async (req, res) => {
    const userId = req.user.userId;
    
    // 检查配额
    const balance = await checkUserBalance(userId);
    if (balance <= 0) {
      return res.status(402).json({
        ok: false,
        error: '账户余额不足，请充值',
        category: 'resource'
      });
    }

    try {
      // 调用原有逻辑，但使用服务端密钥
      const result = await chatService(req.body);
      
      // 记录用量
      await logUsage({
        userId,
        resourceType: 'chat',
        modelId: result.modelId,
        quotaCost: calculateCost(result),
      });

      res.json(result);
    } catch (error) {
      res.status(error.status || 500).json({
        ok: false,
        error: error.message
      });
    }
  });
}
```

**生成 API 同样处理：**
```javascript
// apps/server/routes/generation.mjs
app.post('/api/generate', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  
  // 检查配额
  const quotaCost = estimateQuotaCost(req.body);
  const balance = await checkUserBalance(userId);
  
  if (balance < quotaCost) {
    return res.status(402).json({
      ok: false,
      error: `余额不足，需要 ${quotaCost} 积分，当前余额 ${balance}`,
      category: 'resource'
    });
  }

  // 执行生成（使用服务端密钥）
  // ...
});
```

---

### 阶段三：客户端改造

#### 3.1 登录界面

**apps/client/auth.js：**
```javascript
// 登录表单
async function handleLogin(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (data.ok) {
    // 存储 token（使用 httpOnly cookie 更安全）
    localStorage.setItem('zora_token', data.token);
    localStorage.setItem('zora_user', JSON.stringify(data.user));
    
    // 跳转到主界面
    window.location.href = '/';
  } else {
    alert(data.error);
  }
}
```

#### 3.2 请求拦截

**apps/client/api-client.js：**
```javascript
// 统一的 API 客户端
class ZoraApiClient {
  constructor() {
    this.baseURL = window.location.origin;
    this.token = localStorage.getItem('zora_token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // 添加 Token
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    // 处理 401 未授权
    if (response.status === 401) {
      localStorage.removeItem('zora_token');
      window.location.href = '/login';
      throw new Error('需要重新登录');
    }

    return response.json();
  }

  async chat(message, options = {}) {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, ...options })
    });
  }

  async generate(params) {
    return this.request('/api/generate', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }
}

export const apiClient = new ZoraApiClient();
```

#### 3.3 用户界面更新

**显示用户信息和余额：**
```html
<!-- 顶部导航栏 -->
<div class="user-info">
  <span class="username">用户名</span>
  <span class="balance">余额：1000 积分</span>
  <button onclick="logout()">登出</button>
</div>
```

---

### 阶段四：管理后台

#### 4.1 用户管理

**GET /api/admin/users**（需要 admin 角色）
```javascript
app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await db.query('SELECT id, email, username, quota_balance, status FROM users');
  res.json({ users });
});
```

**POST /api/admin/users/:id/quota** - 充值积分

**POST /api/admin/users/:id/suspend** - 封禁用户

#### 4.2 模型管理

**模型配置表（server_models）：**
```sql
CREATE TABLE server_models (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200),
  kind VARCHAR(50), -- image, video, agent
  enabled BOOLEAN DEFAULT true,
  provider VARCHAR(100),
  quota_cost_per_unit INTEGER, -- 每单位消耗积分
  max_concurrency INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**GET /api/admin/models** - 列出所有模型配置
**PUT /api/admin/models/:id** - 更新模型配置

**实时生效：**
```javascript
// 模型列表端点从数据库读取
app.get('/api/models', requireAuth, async (req, res) => {
  const models = await db.query(
    'SELECT * FROM server_models WHERE enabled = true'
  );
  res.json({ models });
});
```

#### 4.3 用量统计

**GET /api/admin/stats/usage** - 用量统计
**GET /api/admin/stats/revenue** - 收入统计

---

### 阶段五：安全加固

#### 5.1 HTTPS 强制

```javascript
// 生产环境强制 HTTPS
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure) {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}
```

#### 5.2 速率限制

```javascript
import rateLimit from 'express-rate-limit';

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每用户 10 次
  keyGenerator: (req) => req.user.userId,
  message: { ok: false, error: '请求过于频繁，请稍后重试' }
});

app.post('/api/chat', requireAuth, chatLimiter, handleChat);
```

#### 5.3 输入验证

```javascript
import { body, validationResult } from 'express-validator';

app.post('/api/chat',
  requireAuth,
  body('message').isString().isLength({ min: 1, max: 8000 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        error: '输入验证失败',
        details: errors.array()
      });
    }
    next();
  },
  handleChat
);
```

#### 5.4 日志审计

```javascript
// 记录所有 API 请求
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
      status: res.statusCode,
      duration,
      ip: req.ip
    });
  });
  
  next();
});
```

---

## 部署架构

### 开发环境
```
客户端（localhost:4317）
    ↓
服务端（localhost:4317）
    ↓
数据库（SQLite 文件）
```

### 生产环境
```
客户端（Web）
    ↓
负载均衡器（nginx）
    ↓
服务端集群（Node.js × N）
    ↓
数据库（PostgreSQL/MySQL）
    ↓
Redis（Session/Cache）
```

---

## 迁移步骤

### 步骤 1：搭建数据库
```bash
# 创建数据库
createdb zora_production

# 运行迁移脚本
node scripts/migrate-database.mjs
```

### 步骤 2：配置环境变量
```bash
# .env.production
DATABASE_URL=postgresql://user:pass@localhost/zora_production
JWT_SECRET=your-random-secret-key-here
OPENAI_API_KEY=sk-...
DUOYUANX_API_KEY=...
NODE_ENV=production
```

### 步骤 3：部署服务端
```bash
# 构建
npm run build

# 启动
NODE_ENV=production node apps/server/server.mjs
```

### 步骤 4：更新客户端
- 移除本地 API Key 配置
- 添加登录界面
- 使用新的 API 客户端

---

## 成本估算

### 开发成本
- 数据库设计与实现：2-3 天
- 认证系统：3-4 天
- API 代理层改造：2-3 天
- 客户端改造：2-3 天
- 管理后台：3-5 天
- 测试与优化：3-5 天

**总计：15-23 天**

### 运营成本
- 服务器：$20-100/月（根据用户量）
- 数据库：$10-50/月
- CDN/流量：$5-50/月
- 监控服务：$0-30/月

---

## 优势

1. **安全性**
   - ✅ 密钥不会泄露给客户端
   - ✅ 统一的访问控制
   - ✅ 审计日志完整

2. **可控性**
   - ✅ 实时调整模型可用性
   - ✅ 控制每个用户的配额
   - ✅ 灵活的计费策略

3. **可扩展性**
   - ✅ 支持多用户
   - ✅ 水平扩展
   - ✅ 便于添加新功能

---

## 下一步

您希望我：
1. ✅ 先实现认证系统？
2. ✅ 设计数据库 schema？
3. ✅ 编写数据库迁移脚本？
4. ✅ 实现 API 代理层？
5. ✅ 还是从其他部分开始？
