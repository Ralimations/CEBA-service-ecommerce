-- Migration 003: persisted response deadlines and moderated provider cancellation reasons.
-- Existing pending bookings intentionally retain NULL deadlines; only new requests expire.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS response_deadline_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS bookings_due_response ON bookings(response_deadline_at) WHERE status='PENDING';

-- System-generated expiration events have no human actor. Existing event rows are preserved.
ALTER TABLE booking_events ALTER COLUMN actor_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS provider_cancellation_reasons (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), requester_id TEXT NOT NULL REFERENCES users(id),
 reason_code TEXT NOT NULL CHECK(reason_code IN ('SCHEDULING','STAFFING','EQUIPMENT','EMERGENCY','WEATHER_SAFETY','VENUE_LOGISTICS','OTHER')),
 submitted_text TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS provider_cancellation_reviews (
 id TEXT PRIMARY KEY, reason_id TEXT NOT NULL REFERENCES provider_cancellation_reasons(id), reviewer_id TEXT NOT NULL REFERENCES users(id),
 decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')), customer_visible_reason TEXT NOT NULL DEFAULT '',
 moderation_note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS provider_cancellation_reason_queue ON provider_cancellation_reasons(reason_code,created_at DESC);
CREATE INDEX IF NOT EXISTS provider_cancellation_review_history ON provider_cancellation_reviews(reason_id,created_at DESC);
CREATE OR REPLACE FUNCTION soiree_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END; $$;
DROP TRIGGER IF EXISTS immutable_cancellation_reason_update ON provider_cancellation_reasons;
DROP TRIGGER IF EXISTS immutable_cancellation_reason_delete ON provider_cancellation_reasons;
DROP TRIGGER IF EXISTS immutable_cancellation_review_update ON provider_cancellation_reviews;
DROP TRIGGER IF EXISTS immutable_cancellation_review_delete ON provider_cancellation_reviews;
CREATE TRIGGER immutable_cancellation_reason_update BEFORE UPDATE OR DELETE ON provider_cancellation_reasons FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
CREATE TRIGGER immutable_cancellation_review_update BEFORE UPDATE OR DELETE ON provider_cancellation_reviews FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT(version) DO NOTHING;
