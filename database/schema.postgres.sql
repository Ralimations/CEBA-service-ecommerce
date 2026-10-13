-- Supabase PostgreSQL schema for SoiréeSource.
-- Idempotent migration 1; preserves existing rows and constraints.
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('CUSTOMER','PROVIDER','ADMIN')),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')), referral_code TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL DEFAULT 'Sparkles', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS providers (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), business_name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', category_id TEXT NOT NULL REFERENCES categories(id), area TEXT NOT NULL DEFAULT 'Metro Manila',
 avatar TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '/images/event.jpg', phone TEXT NOT NULL DEFAULT '',
 verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS portfolio (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), image TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), category_id TEXT NOT NULL REFERENCES categories(id),
 title TEXT NOT NULL, description TEXT NOT NULL, base_price INTEGER NOT NULL CHECK(base_price>=0), unit TEXT NOT NULL DEFAULT 'event',
 duration TEXT NOT NULL DEFAULT '4 hours', min_guests INTEGER NOT NULL DEFAULT 1, max_guests INTEGER NOT NULL DEFAULT 500,
 image TEXT NOT NULL DEFAULT '/images/event.jpg', status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
 moderated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS packages (
 id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 price INTEGER NOT NULL CHECK(price>0), inclusions TEXT NOT NULL DEFAULT '', exclusions TEXT NOT NULL DEFAULT '',
 duration TEXT NOT NULL DEFAULT '4 hours', terms TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS addons (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id), name TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS availability (provider_id TEXT NOT NULL REFERENCES providers(id), date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('AVAILABLE','UNAVAILABLE')), note TEXT NOT NULL DEFAULT '', PRIMARY KEY(provider_id,date));
CREATE TABLE IF NOT EXISTS bundles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL DEFAULT '/images/event.jpg',
 discount_percent INTEGER NOT NULL DEFAULT 5 CHECK(discount_percent BETWEEN 0 AND 50), status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);
CREATE TABLE IF NOT EXISTS bundle_items (
 id TEXT PRIMARY KEY, bundle_id TEXT NOT NULL REFERENCES bundles(id), provider_id TEXT NOT NULL REFERENCES providers(id), package_id TEXT NOT NULL REFERENCES packages(id),
 price INTEGER NOT NULL CHECK(price>0), inclusions TEXT NOT NULL DEFAULT '', exclusions TEXT NOT NULL DEFAULT '', terms TEXT NOT NULL DEFAULT '',
 approval TEXT NOT NULL DEFAULT 'PENDING' CHECK(approval IN ('PENDING','ACCEPTED','REJECTED')), responded_at TEXT, UNIQUE(bundle_id,provider_id)
);
CREATE TABLE IF NOT EXISTS vouchers (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, description TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('FIXED','PERCENTAGE')),
 value INTEGER NOT NULL CHECK(value>0), min_spend INTEGER NOT NULL DEFAULT 0, max_discount INTEGER NOT NULL DEFAULT 0,
 valid_from TEXT NOT NULL, expires_at TEXT NOT NULL, usage_limit INTEGER NOT NULL DEFAULT 1000, per_user_limit INTEGER NOT NULL DEFAULT 1,
 rank_required TEXT NOT NULL DEFAULT 'BRONZE', first_only INTEGER NOT NULL DEFAULT 0, category_id TEXT REFERENCES categories(id), active INTEGER NOT NULL DEFAULT 1,
 owner_id TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS voucher_wallet (user_id TEXT NOT NULL REFERENCES users(id), voucher_id TEXT NOT NULL REFERENCES vouchers(id), PRIMARY KEY(user_id,voucher_id));
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), bundle_id TEXT REFERENCES bundles(id), title TEXT NOT NULL,
 event_date TEXT NOT NULL, event_type TEXT NOT NULL, location TEXT NOT NULL, guests INTEGER NOT NULL CHECK(guests>0), contact TEXT NOT NULL, requests TEXT NOT NULL DEFAULT '',
 subtotal INTEGER NOT NULL CHECK(subtotal>=0), discount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL CHECK(total>=0), platform_fee INTEGER NOT NULL DEFAULT 0,
 voucher_id TEXT REFERENCES vouchers(id), status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','CONFIRMED','IN_PROGRESS','COMPLETION_PENDING','COMPLETED','CANCELLED','DISPUTED')),
 escrow_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(escrow_status IN ('UNPAID','HELD_IN_ESCROW','PARTIALLY_RELEASED','RELEASED','REFUNDED','DISPUTED')),
 created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS response_deadline_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS booking_items (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), provider_id TEXT NOT NULL REFERENCES providers(id), service_id TEXT NOT NULL REFERENCES services(id), package_id TEXT NOT NULL REFERENCES packages(id),
 title TEXT NOT NULL, package_name TEXT NOT NULL, inclusions TEXT NOT NULL, terms TEXT NOT NULL DEFAULT '',
 price INTEGER NOT NULL, allocation INTEGER NOT NULL, platform_fee INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','CONFIRMED','IN_PROGRESS','COMPLETION_PENDING','COMPLETED','CANCELLED')), UNIQUE(booking_id,provider_id)
);
CREATE TABLE IF NOT EXISTS booking_addons (id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL REFERENCES booking_items(id), name TEXT NOT NULL, price INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reservations (provider_id TEXT NOT NULL REFERENCES providers(id), date TEXT NOT NULL, booking_id TEXT NOT NULL REFERENCES bookings(id), PRIMARY KEY(provider_id,date));
CREATE TABLE IF NOT EXISTS voucher_redemptions (id TEXT PRIMARY KEY, voucher_id TEXT NOT NULL REFERENCES vouchers(id), user_id TEXT NOT NULL REFERENCES users(id), booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id), created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, booking_id TEXT UNIQUE REFERENCES bookings(id), user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL CHECK(amount>=0), purpose TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE TABLE IF NOT EXISTS escrow_transactions (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), provider_id TEXT REFERENCES providers(id),
 type TEXT NOT NULL CHECK(type IN ('HOLD','RELEASE','REFUND','FREEZE')), amount INTEGER NOT NULL CHECK(amount>=0), fee INTEGER NOT NULL DEFAULT 0,
 actor_id TEXT NOT NULL REFERENCES users(id), note TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS handshake_tokens (
 id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL REFERENCES booking_items(id), gate TEXT NOT NULL CHECK(gate IN ('START','COMPLETE')), token_hash TEXT NOT NULL UNIQUE,
 issuer_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, used_at TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 verified_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS booking_events (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), actor_id TEXT NOT NULL REFERENCES users(id), event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
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
CREATE TABLE IF NOT EXISTS provider_cancellation_requests (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), requester_id TEXT NOT NULL REFERENCES users(id),
 reason_code TEXT NOT NULL CHECK(reason_code IN ('SCHEDULING','STAFFING','EQUIPMENT','EMERGENCY','WEATHER_SAFETY','VENUE_LOGISTICS','OTHER')),
 submitted_text TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS provider_cancellation_request_reviews (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES provider_cancellation_requests(id), reviewer_id TEXT NOT NULL REFERENCES users(id),
 decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')), note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL UNIQUE REFERENCES booking_items(id), customer_id TEXT NOT NULL REFERENCES users(id), provider_id TEXT NOT NULL REFERENCES providers(id), service_id TEXT NOT NULL REFERENCES services(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE TABLE IF NOT EXISTS disputes (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','UNDER_REVIEW','RESOLVED_CUSTOMER','RESOLVED_PROVIDER','CLOSED')), resolution TEXT NOT NULL DEFAULT '', admin_id TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE UNIQUE INDEX IF NOT EXISTS one_open_dispute ON disputes(booking_id) WHERE status IN ('OPEN','UNDER_REVIEW');
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), tier TEXT NOT NULL CHECK(tier IN ('CLASSIC','VIP')), starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', payment_id TEXT REFERENCES payments(id));
CREATE TABLE IF NOT EXISTS placements (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), placement TEXT NOT NULL CHECK(placement IN ('HOMEPAGE','CATEGORY','SEARCH')), starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', payment_id TEXT REFERENCES payments(id));
CREATE TABLE IF NOT EXISTS provider_badges (provider_id TEXT NOT NULL REFERENCES providers(id), badge TEXT NOT NULL CHECK(badge IN ('TRUSTED','BEST_SERVICE')), granted INTEGER NOT NULL, admin_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(provider_id,badge));
CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL REFERENCES users(id), referred_id TEXT NOT NULL UNIQUE REFERENCES users(id), rewarded_at TEXT, CHECK(referrer_id<>referred_id));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, href TEXT NOT NULL DEFAULT '/notifications', read_at TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE TABLE IF NOT EXISTS support_tickets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), booking_id TEXT REFERENCES bookings(id), subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')), response TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE TABLE IF NOT EXISTS public_account_support (
 id TEXT PRIMARY KEY, submitted_email TEXT NOT NULL, email_hash TEXT NOT NULL,
 account_type TEXT NOT NULL CHECK(account_type IN ('CUSTOMER','PROVIDER','UNSURE')),
 category TEXT NOT NULL CHECK(category IN ('SUSPENSION_REVIEW','ACCOUNT_HELP')),
 message TEXT NOT NULL, reference_number TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_REVIEW','RESOLVED')),
 follow_up_required BOOLEAN NOT NULL DEFAULT TRUE,
 internal_notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TIMESTAMPTZ, reviewed_by TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS public_support_rate_limits (
 email_hash TEXT PRIMARY KEY, window_started_at TIMESTAMPTZ NOT NULL, request_count INTEGER NOT NULL CHECK(request_count>=0)
);
CREATE TABLE IF NOT EXISTS booking_messages (
 id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL REFERENCES booking_items(id),
 sender_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, read_at TIMESTAMPTZ,
 CHECK(sender_id<>recipient_id)
);
CREATE TABLE IF NOT EXISTS booking_message_rate_limits (
 sender_id TEXT PRIMARY KEY REFERENCES users(id), window_started_at TIMESTAMPTZ NOT NULL,
 message_count INTEGER NOT NULL CHECK(message_count BETWEEN 1 AND 20)
);
CREATE TABLE IF NOT EXISTS experience_ledger (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('DAILY_CHECK_IN','BOOKING_COMPLETED','REFERRAL_RANK_UP')),
 reference_key TEXT NOT NULL, points INTEGER NOT NULL CHECK(points>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,event_type,reference_key)
);
ALTER TABLE public_account_support ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value REAL NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
CREATE INDEX IF NOT EXISTS bookings_customer ON bookings(customer_id,event_date);
CREATE INDEX IF NOT EXISTS items_provider ON booking_items(provider_id,booking_id);
CREATE INDEX IF NOT EXISTS bookings_due_response ON bookings(response_deadline_at) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS provider_cancellation_reason_queue ON provider_cancellation_reasons(reason_code,created_at DESC);
CREATE INDEX IF NOT EXISTS provider_cancellation_review_history ON provider_cancellation_reviews(reason_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_provider_cancel_request ON provider_cancellation_requests(booking_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS provider_cancel_request_queue ON provider_cancellation_requests(status,created_at) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS provider_cancel_request_review_history ON provider_cancellation_request_reviews(request_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,read_at);
CREATE INDEX IF NOT EXISTS public_account_support_queue ON public_account_support(status,created_at DESC);
CREATE INDEX IF NOT EXISTS public_account_support_email ON public_account_support(email_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS booking_messages_thread ON booking_messages(booking_item_id,created_at,id);
CREATE INDEX IF NOT EXISTS booking_messages_unread ON booking_messages(recipient_id,booking_item_id,read_at) WHERE read_at IS NULL;
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
CREATE INDEX IF NOT EXISTS experience_ledger_user_history ON experience_ledger(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS service_category ON services(category_id,status);
CREATE OR REPLACE FUNCTION soiree_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END; $$;
CREATE OR REPLACE FUNCTION soiree_message_content_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.booking_item_id IS DISTINCT FROM OLD.booking_item_id
 OR NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
 OR NEW.body IS DISTINCT FROM OLD.body OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'booking message content is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION soiree_cancel_request_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
 OR NEW.requester_id IS DISTINCT FROM OLD.requester_id OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
 OR NEW.submitted_text IS DISTINCT FROM OLD.submitted_text OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'provider cancellation request content is immutable';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS immutable_events_update ON booking_events;
DROP TRIGGER IF EXISTS immutable_events_delete ON booking_events;
DROP TRIGGER IF EXISTS immutable_ledger_update ON escrow_transactions;
DROP TRIGGER IF EXISTS immutable_ledger_delete ON escrow_transactions;
DROP TRIGGER IF EXISTS immutable_audit_update ON audit_log;
DROP TRIGGER IF EXISTS immutable_audit_delete ON audit_log;
CREATE TRIGGER immutable_events_update BEFORE UPDATE OR DELETE ON booking_events FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
DROP TRIGGER IF EXISTS immutable_booking_message_content ON booking_messages;
DROP TRIGGER IF EXISTS immutable_booking_message_delete ON booking_messages;
CREATE TRIGGER immutable_booking_message_content BEFORE UPDATE ON booking_messages FOR EACH ROW EXECUTE FUNCTION soiree_message_content_immutable();
CREATE TRIGGER immutable_booking_message_delete BEFORE DELETE ON booking_messages FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_update ON provider_cancellation_requests;
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_delete ON provider_cancellation_requests;
CREATE TRIGGER immutable_provider_cancel_request_update BEFORE UPDATE ON provider_cancellation_requests FOR EACH ROW EXECUTE FUNCTION soiree_cancel_request_immutable();
CREATE TRIGGER immutable_provider_cancel_request_delete BEFORE DELETE ON provider_cancellation_requests FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_review_update ON provider_cancellation_request_reviews;
DROP TRIGGER IF EXISTS immutable_provider_cancel_request_review_delete ON provider_cancellation_request_reviews;
CREATE TRIGGER immutable_provider_cancel_request_review_update BEFORE UPDATE OR DELETE ON provider_cancellation_request_reviews FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
DROP TRIGGER IF EXISTS immutable_cancellation_reason_update ON provider_cancellation_reasons;
DROP TRIGGER IF EXISTS immutable_cancellation_reason_delete ON provider_cancellation_reasons;
DROP TRIGGER IF EXISTS immutable_cancellation_review_update ON provider_cancellation_reviews;
DROP TRIGGER IF EXISTS immutable_cancellation_review_delete ON provider_cancellation_reviews;
CREATE TRIGGER immutable_cancellation_reason_update BEFORE UPDATE OR DELETE ON provider_cancellation_reasons FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
CREATE TRIGGER immutable_cancellation_review_update BEFORE UPDATE OR DELETE ON provider_cancellation_reviews FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
CREATE TRIGGER immutable_ledger_update BEFORE UPDATE OR DELETE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
CREATE TRIGGER immutable_audit_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION soiree_append_only();
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT(version) DO NOTHING;


ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;

INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT(version) DO NOTHING;
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT(version) DO NOTHING;
INSERT INTO schema_migrations(version) VALUES(4) ON CONFLICT(version) DO NOTHING;
INSERT INTO schema_migrations(version) VALUES(5) ON CONFLICT(version) DO NOTHING;
INSERT INTO schema_migrations(version) VALUES(6) ON CONFLICT(version) DO NOTHING;

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
-- Migration 008: participant-submitted reports refer to one message only.
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
