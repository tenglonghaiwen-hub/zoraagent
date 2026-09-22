CREATE TABLE IF NOT EXISTS membership_state (
 user_id TEXT PRIMARY KEY, tier TEXT, revision INTEGER NOT NULL DEFAULT 0,
 pending_tier TEXT, effective_at INTEGER, pending_days INTEGER, pending_gift INTEGER,
 pending_concurrency INTEGER, last_request_id TEXT
);
CREATE TABLE IF NOT EXISTS membership_orders (
 user_id TEXT NOT NULL, request_id TEXT NOT NULL, result_json TEXT NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
