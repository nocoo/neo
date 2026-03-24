-- D1 test isolation marker.
-- Apply ONLY to the test database (neo-db-test).
-- E2E setup verifies this table exists before any data reset.
CREATE TABLE IF NOT EXISTS _test_marker (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO _test_marker (key, value) VALUES ('env', 'test');
