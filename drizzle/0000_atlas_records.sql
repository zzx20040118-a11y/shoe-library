CREATE TABLE atlas_records (
  user_id TEXT NOT NULL,
  record_key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, record_key)
);
