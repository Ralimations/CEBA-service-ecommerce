PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('CUSTOMER','PROVIDER','ADMIN')),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')), referral_code TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL DEFAULT 'Sparkles', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS providers (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), business_name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', category_id TEXT NOT NULL REFERENCES categories(id), area TEXT NOT NULL DEFAULT 'Metro Manila',
 avatar TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '/images/event.jpg', phone TEXT NOT NULL DEFAULT '',
 verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS portfolio (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), image TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), category_id TEXT NOT NULL REFERENCES categories(id),
 title TEXT NOT NULL, description TEXT NOT NULL, base_price INTEGER NOT NULL CHECK(base_price>=0), unit TEXT NOT NULL DEFAULT 'event',
 duration TEXT NOT NULL DEFAULT '4 hours', min_guests INTEGER NOT NULL DEFAULT 1, max_guests INTEGER NOT NULL DEFAULT 500,
 image TEXT NOT NULL DEFAULT '/images/event.jpg', status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
 moderated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE, description TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('FIXED','PERCENTAGE')),
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
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS booking_items (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), provider_id TEXT NOT NULL REFERENCES providers(id), service_id TEXT NOT NULL REFERENCES services(id), package_id TEXT NOT NULL REFERENCES packages(id),
 title TEXT NOT NULL, package_name TEXT NOT NULL, inclusions TEXT NOT NULL, terms TEXT NOT NULL DEFAULT '',
 price INTEGER NOT NULL, allocation INTEGER NOT NULL, platform_fee INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','CONFIRMED','IN_PROGRESS','COMPLETION_PENDING','COMPLETED','CANCELLED')), UNIQUE(booking_id,provider_id)
);
CREATE TABLE IF NOT EXISTS booking_addons (id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL REFERENCES booking_items(id), name TEXT NOT NULL, price INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reservations (provider_id TEXT NOT NULL REFERENCES providers(id), date TEXT NOT NULL, booking_id TEXT NOT NULL REFERENCES bookings(id), PRIMARY KEY(provider_id,date));
CREATE TABLE IF NOT EXISTS voucher_redemptions (id TEXT PRIMARY KEY, voucher_id TEXT NOT NULL REFERENCES vouchers(id), user_id TEXT NOT NULL REFERENCES users(id), booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, booking_id TEXT UNIQUE REFERENCES bookings(id), user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL CHECK(amount>=0), purpose TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS escrow_transactions (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), provider_id TEXT REFERENCES providers(id),
 type TEXT NOT NULL CHECK(type IN ('HOLD','RELEASE','REFUND','FREEZE')), amount INTEGER NOT NULL CHECK(amount>=0), fee INTEGER NOT NULL DEFAULT 0,
 actor_id TEXT NOT NULL REFERENCES users(id), note TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS handshake_tokens (
 id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL REFERENCES booking_items(id), gate TEXT NOT NULL CHECK(gate IN ('START','COMPLETE')), token_hash TEXT NOT NULL UNIQUE,
 issuer_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, used_at TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 verified_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS booking_events (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), actor_id TEXT NOT NULL REFERENCES users(id), event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL UNIQUE REFERENCES booking_items(id), customer_id TEXT NOT NULL REFERENCES users(id), provider_id TEXT NOT NULL REFERENCES providers(id), service_id TEXT NOT NULL REFERENCES services(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS disputes (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','UNDER_REVIEW','RESOLVED_CUSTOMER','RESOLVED_PROVIDER','CLOSED')), resolution TEXT NOT NULL DEFAULT '', admin_id TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE UNIQUE INDEX IF NOT EXISTS one_open_dispute ON disputes(booking_id) WHERE status IN ('OPEN','UNDER_REVIEW');
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), tier TEXT NOT NULL CHECK(tier IN ('CLASSIC','VIP')), starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', payment_id TEXT REFERENCES payments(id));
CREATE TABLE IF NOT EXISTS placements (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), placement TEXT NOT NULL CHECK(placement IN ('HOMEPAGE','CATEGORY','SEARCH')), starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', payment_id TEXT REFERENCES payments(id));
CREATE TABLE IF NOT EXISTS provider_badges (provider_id TEXT NOT NULL REFERENCES providers(id), badge TEXT NOT NULL CHECK(badge IN ('TRUSTED','BEST_SERVICE')), granted INTEGER NOT NULL, admin_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(provider_id,badge));
CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL REFERENCES users(id), referred_id TEXT NOT NULL UNIQUE REFERENCES users(id), rewarded_at TEXT, CHECK(referrer_id<>referred_id));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, href TEXT NOT NULL DEFAULT '/notifications', read_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS support_tickets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), booking_id TEXT REFERENCES bookings(id), subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')), response TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value REAL NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS bookings_customer ON bookings(customer_id,event_date);
CREATE INDEX IF NOT EXISTS items_provider ON booking_items(provider_id,booking_id);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,read_at);
CREATE INDEX IF NOT EXISTS service_category ON services(category_id,status);
CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON booking_events BEGIN SELECT RAISE(ABORT,'Booking events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON booking_events BEGIN SELECT RAISE(ABORT,'Booking events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_ledger_update BEFORE UPDATE ON escrow_transactions BEGIN SELECT RAISE(ABORT,'Escrow ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_ledger_delete BEFORE DELETE ON escrow_transactions BEGIN SELECT RAISE(ABORT,'Escrow ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_audit_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_audit_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit log is append-only'); END;
INSERT OR IGNORE INTO schema_migrations(version) VALUES(1);
