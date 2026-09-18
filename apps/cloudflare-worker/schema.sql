-- Zora Cloudflare D1 Database Schema

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  quota_balance INTEGER DEFAULT 100, -- 默认赠送 100 初始体验积分
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

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
  resource_type TEXT NOT NULL, -- chat, generation, topup
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
  quota_cost_per_unit INTEGER NOT NULL,
  max_concurrency INTEGER DEFAULT 2,
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
