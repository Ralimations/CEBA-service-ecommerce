-- Migration 007: isolated, non-settling deposit prototype ledger.
CREATE TABLE IF NOT EXISTS simulated_deposit_entries (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  booking_item_id TEXT REFERENCES booking_items(id),
  stage TEXT NOT NULL CHECK(stage IN ('DEPOSIT','BALANCE')),
  amount INTEGER NOT NULL CHECK(amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id, stage, booking_item_id)
);
CREATE INDEX IF NOT EXISTS simulated_deposit_booking ON simulated_deposit_entries(booking_id,stage);
INSERT INTO schema_migrations(version) VALUES(7) ON CONFLICT(version) DO NOTHING;
