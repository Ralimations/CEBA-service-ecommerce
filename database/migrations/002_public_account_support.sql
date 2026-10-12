-- Migration 002: anonymous suspension/account support intake.
-- Safe to apply more than once. This migration does not change user account status.
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
ALTER TABLE public_account_support ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS public_account_support_queue ON public_account_support(status,created_at DESC);
CREATE INDEX IF NOT EXISTS public_account_support_email ON public_account_support(email_hash,created_at DESC);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT(version) DO NOTHING;
