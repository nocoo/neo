-- Add Backy integration and encryption key columns to user_settings
-- These columns support the unified encrypted backup → Backy webhook flow.

ALTER TABLE user_settings ADD COLUMN encryption_key TEXT;
ALTER TABLE user_settings ADD COLUMN backy_webhook_url TEXT;
ALTER TABLE user_settings ADD COLUMN backy_api_key TEXT;
ALTER TABLE user_settings ADD COLUMN backy_pull_key TEXT;
