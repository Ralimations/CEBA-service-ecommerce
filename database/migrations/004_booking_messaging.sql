-- Migration 004: private, booking-item-scoped customer/provider messages.
CREATE TABLE IF NOT EXISTS booking_messages (
  id TEXT PRIMARY KEY,
  booking_item_id TEXT NOT NULL REFERENCES booking_items(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ,
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS booking_messages_thread ON booking_messages(booking_item_id,created_at,id);
CREATE INDEX IF NOT EXISTS booking_messages_unread ON booking_messages(recipient_id,booking_item_id,read_at) WHERE read_at IS NULL;
CREATE TABLE IF NOT EXISTS booking_message_rate_limits (
  sender_id TEXT PRIMARY KEY REFERENCES users(id),
  window_started_at TIMESTAMPTZ NOT NULL,
  message_count INTEGER NOT NULL CHECK(message_count BETWEEN 1 AND 20)
);
CREATE OR REPLACE FUNCTION soiree_message_content_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.booking_item_id IS DISTINCT FROM OLD.booking_item_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.body IS DISTINCT FROM OLD.body OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'booking message content is immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS immutable_booking_message_content ON booking_messages;
CREATE TRIGGER immutable_booking_message_content BEFORE UPDATE ON booking_messages
  FOR EACH ROW EXECUTE FUNCTION soiree_message_content_immutable();
DROP TRIGGER IF EXISTS immutable_booking_message_delete ON booking_messages;
CREATE TRIGGER immutable_booking_message_delete BEFORE DELETE ON booking_messages
  FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
INSERT INTO schema_migrations(version) VALUES(4) ON CONFLICT(version) DO NOTHING;
