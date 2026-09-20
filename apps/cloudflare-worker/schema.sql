-- Zora Cloudflare D1 Database Schema

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  quota_balance INTEGER DEFAULT 100, -- 默认赠送 100 初始体验积分
  is_vip INTEGER DEFAULT 0, -- 0: 普通用户, 1: VIP会员
  vip_expires_at INTEGER DEFAULT 0, -- VIP 到期时间戳 (0 表示非 VIP, -1 表示永久)
  concurrency_limit INTEGER DEFAULT 2, -- 该用户专属并发上限
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_vip ON users(is_vip);

-- 2. 会话记录表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. 消费与充值流水记录表
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- chat, generation, topup, admin_topup, admin_refund
  model_id TEXT,
  tokens_used INTEGER,
  quota_cost INTEGER NOT NULL, -- 正数表示消耗，负数表示充值
  request_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- 4. 服务端模型计费与开放配置表
CREATE TABLE IF NOT EXISTS server_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('image', 'video', 'agent')),
  enabled INTEGER DEFAULT 1,
  provider TEXT,
  route TEXT,
  query_route TEXT,
  quota_cost_per_unit INTEGER NOT NULL,
  max_concurrency INTEGER DEFAULT 2,
  vip_only INTEGER DEFAULT 0, -- 0: 全员可用, 1: 仅 VIP 会员可用
  config TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_server_models_enabled ON server_models(enabled);

-- 预置核心模型单价与并发
INSERT OR REPLACE INTO server_models (id, name, kind, enabled, provider, quota_cost_per_unit, max_concurrency, created_at, updated_at)
VALUES
  ('gpt-5.5', 'GPT 5.5', 'agent', 1, 'openai', 1, 1, 1789700000000, 1789700000000),
  ('gpt-6-astra', 'GPT 6 Astra', 'agent', 1, 'openai', 1, 1, 1789700000000, 1789700000000),
  ('gpt-image-2', 'GPT Image 2', 'image', 1, 'openai', 10, 4, 1789700000000, 1789700000000),
  ('doubao-seedream-5-0-260128', 'Seedream 5.0', 'image', 1, 'seedream', 10, 4, 1789700000000, 1789700000000),
  ('grok-4-2-image', 'Grok 4.2 Image', 'image', 1, 'grok', 10, 4, 1789700000000, 1789700000000),
  ('MiniMax-H3', 'MiniMax H3', 'video', 1, 'minimax', 100, 2, 1789700000000, 1789700000000),
  ('grok-video-3', 'Grok Video 3', 'video', 1, 'grok', 100, 2, 1789700000000, 1789700000000);

-- 5. 系统动态运行配置表（可视化管理 API 密钥与网关参数）
CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  is_secret INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO system_configs (key, value, description, is_secret, updated_at)
VALUES
  ('MINIMAX_API_KEY', '', 'MiniMax 官方 API Key（用于 MiniMax-H3 视频生成）', 1, 1789700000000),
  ('MINIMAX_BASE_URL', 'https://api.minimax.cn', 'MiniMax 官方 API Base 地址', 0, 1789700000000),
  ('DUOYUANX_API_KEY', '', '多元交叉/大模型上游 API Key（留空则使用 Cloudflare Secret）', 1, 1789700000000),
  ('DUOYUANX_BASE_URL', 'https://duoyuanx.com', '多元探索上游 API Base 地址', 0, 1789700000000),
  ('OPENAI_API_KEY', '', 'OpenAI 官方 API Key', 1, 1789700000000),
  ('OPENAI_BASE_URL', 'https://api.openai.com', 'OpenAI 官方 API Base 地址', 0, 1789700000000),
  ('SILICONFLOW_API_KEY', '', '硅基流动 API Key', 1, 1789700000000),
  ('SILICONFLOW_BASE_URL', 'https://api.siliconflow.cn', '硅基流动 API Base 地址', 0, 1789700000000),
  ('DEEPSEEK_API_KEY', '', 'DeepSeek 官方 API Key', 1, 1789700000000),
  ('DEEPSEEK_BASE_URL', 'https://api.deepseek.com', 'DeepSeek 官方 API Base 地址', 0, 1789700000000),
  ('CUSTOM_API_KEY', '', '自定义 / OneAPI 中转 API Key', 1, 1789700000000),
  ('CUSTOM_BASE_URL', '', '自定义 / OneAPI 中转 Base 地址', 0, 1789700000000),
  ('ADMIN_PASSWORD', 'admin123456', '网关可视化后台管理密码（请登录后及时修改）', 1, 1789700000000);

-- 6. 模型动态分发路由表 (Route Table)
CREATE TABLE IF NOT EXISTS model_routes (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  path TEXT,
  query_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 7. 运营通知与全员公告表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL 或 '*' 表示全员广播；指定 user_id 表示专属私信
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT DEFAULT 'official' CHECK(kind IN ('official', 'activity')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 预置全员上线公告
INSERT OR IGNORE INTO notifications (id, user_id, title, content, kind, created_at)
VALUES (
  'notif-welcome',
  '*',
  '欢迎使用造境 Zora！',
  '造境全新全球云端创作网关已就绪。所有官方模型与并发服务均已开启，快在工作台开启您的批量 AI 创作之旅吧！',
  'official',
  1789700000000
);



CREATE TABLE IF NOT EXISTS generation_receipts (
 user_id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 task_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY (user_id, request_id)
);

-- Membership scheduling (additive migration: membership-state.sql)
CREATE TABLE IF NOT EXISTS membership_state (
 user_id TEXT PRIMARY KEY, tier TEXT, revision INTEGER NOT NULL DEFAULT 0,
 pending_tier TEXT, effective_at INTEGER, pending_days INTEGER, pending_gift INTEGER,
 pending_concurrency INTEGER, last_request_id TEXT
);
CREATE TABLE IF NOT EXISTS membership_orders (
 user_id TEXT NOT NULL, request_id TEXT NOT NULL, result_json TEXT NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
