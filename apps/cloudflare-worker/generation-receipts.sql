CREATE TABLE IF NOT EXISTS generation_receipts (
 user_id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 task_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY (user_id, request_id)
);
