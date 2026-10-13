-- Migration 005: auditable emergency cancellation review inside the provisional window.
CREATE TABLE IF NOT EXISTS provider_cancellation_requests (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  requester_id TEXT NOT NULL REFERENCES users(id),
  reason_code TEXT NOT NULL CHECK(reason_code IN ('SCHEDULING','STAFFING','EQUIPMENT','EMERGENCY','WEATHER_SAFETY','VENUE_LOGISTICS','OTHER')),
  submitted_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_provider_cancel_request
  ON provider_cancellation_requests(booking_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS provider_cancel_request_queue
  ON provider_cancellation_requests(status,created_at) WHERE status='PENDING';
CREATE TABLE IF NOT EXISTS provider_cancellation_request_reviews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES provider_cancellation_requests(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS provider_cancel_request_review_history
  ON provider_cancellation_request_reviews(request_id,created_at DESC);
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_update ON provider_cancellation_requests;
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_delete ON provider_cancellation_requests;
CREATE OR REPLACE FUNCTION soiree_cancel_request_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
     OR NEW.submitted_text IS DISTINCT FROM OLD.submitted_text OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'provider cancellation request content is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER immutable_provider_cancel_request_update BEFORE UPDATE ON provider_cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION soiree_cancel_request_immutable();
CREATE TRIGGER immutable_provider_cancel_request_delete BEFORE DELETE ON provider_cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_review_update ON provider_cancellation_request_reviews;
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_review_delete ON provider_cancellation_request_reviews;
CREATE TRIGGER immutable_provider_cancel_request_review_update BEFORE UPDATE OR DELETE ON provider_cancellation_request_reviews
  FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
INSERT INTO schema_migrations(version) VALUES(5) ON CONFLICT(version) DO NOTHING;
