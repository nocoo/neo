-- Rate limit tracking table.
-- Stores per-key request timestamps for sliding window rate limiting.
-- Uses D1 for cross-isolate consistency.

CREATE TABLE IF NOT EXISTS rate_limits (
  key       TEXT    NOT NULL,
  ts        INTEGER NOT NULL,  -- Unix epoch milliseconds
  PRIMARY KEY (key, ts)
);

-- Index for efficient window queries and cleanup.
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts ON rate_limits (key, ts);
