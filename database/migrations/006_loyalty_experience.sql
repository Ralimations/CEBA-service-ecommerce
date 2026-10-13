-- Migration 006: nonredeemable, idempotent experience-point ledger.
CREATE TABLE IF NOT EXISTS experience_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('DAILY_CHECK_IN','BOOKING_COMPLETED','REFERRAL_RANK_UP')),
  reference_key TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,event_type,reference_key)
);
CREATE INDEX IF NOT EXISTS experience_ledger_user_history ON experience_ledger(user_id,created_at DESC);
INSERT INTO schema_migrations(version) VALUES(6) ON CONFLICT(version) DO NOTHING;
