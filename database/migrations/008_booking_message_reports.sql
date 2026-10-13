-- Migration 008: allow either booking participant to report one message.
CREATE TABLE IF NOT EXISTS booking_message_reports (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES booking_messages(id),
  reporter_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK(category IN ('HARASSMENT','SPAM','SAFETY','OTHER')),
  details TEXT NOT NULL DEFAULT '' CHECK(char_length(details)<=1000),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REVIEWED','RESOLVED')),
  internal_note TEXT NOT NULL DEFAULT '' CHECK(char_length(internal_note)<=2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(message_id,reporter_id)
);
CREATE INDEX IF NOT EXISTS booking_message_reports_queue ON booking_message_reports(status,created_at);
INSERT INTO schema_migrations(version) VALUES(8) ON CONFLICT(version) DO NOTHING;
