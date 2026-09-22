CREATE TABLE IF NOT EXISTS seedance_asset_receipts (
 user_id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 state_json TEXT NOT NULL,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id, request_id)
);
