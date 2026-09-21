-- Apply once before publishing the capability-config Worker.
-- server_models.config already exists in the baseline schema.
CREATE TABLE IF NOT EXISTS model_config_history (
 model_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY (model_id, revision)
);
