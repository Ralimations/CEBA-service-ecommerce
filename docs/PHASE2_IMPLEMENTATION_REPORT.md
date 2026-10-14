# SoiréeSource Phase 2 implementation report

**Review state:** Development branch only. No merge, deployment, production migration, or shared Supabase mutation was performed.

## Git state

- Starting branch: `phase2a/meeting-two-feedback` at `7d3778e` (the branch already contained the prior Phase 2A commits and screenshot helper).
- Starting worktree: clean; `main` remained at `ce56e4d`.
- Implementation commit: `899ada3` (`feat: add Phase 2 support and booking policies`).
- Continuation findings and release gates are recorded in the Phase 2 reports and checklist.
- Push status: not pushed pending review of preview-deployment/database isolation.
- Existing local files outside Git were not read, changed, or deleted.

## Completed implementation

- Added public account-support intake at `/support/appeal`, with strict field/body limits, same-origin validation, an unobtrusive honeypot, per-normalized-email rate limiting, generic confirmation, and no account lookup or automated reinstatement.
- Added an administrator-only queue in `/admin/support`. Administrators can record status, internal notes, and whether further follow-up is required. The interface and response state clearly say no email is sent and account access is unchanged.
- Updated suspended-login copy and linked the public review form from login.
- New bookings receive a persisted deadline 24 hours after submission. Old pending rows keep a `NULL` deadline and are not backfilled or silently expired.
- Added idempotent expiration under a booking-row lock. It expires the entire pending bundle, changes all items to cancelled, releases only that booking’s reservations, records a system event, and notifies the customer and participating providers. The operation runs when relevant booking lists/details are accessed and before provider acceptance or participant cancellation. No unconfigured cron is assumed.
- Added one provisional provider cancellation reason selection. “Other” requires 10–500 characters, is stored separately from the customer timeline, and stays hidden until an administrator appends an approval. Rejected and approved decisions preserve the original text and are audited. Fixed reason labels are visible without custom text.
- Added additive migration files `002_public_account_support.sql` and `003_booking_response_and_cancellation_review.sql`; the same idempotent schema is represented in `database/schema.postgres.sql` for isolated test setup.
- Added an isolated browser-suite launcher that supplies an in-memory database URL before the Next dev server starts, so the test server does not load `.env.local`.

## Stabilization and browser evidence

- The append-only failure was reproduced once on both unchanged `main` and the Phase 2A branch in the PGlite socket harness, including when the test ran alone. A direct query to the same in-memory PGlite database after the app-side failure showed the booking and its seven events still persisted. Diagnostic retries were inconsistent, including a failure moving to the audit-row assertion after reconnecting. The full business suite subsequently passed on the feature branch.
- This points to an intermittent Postgres wire/multiplexer issue in the PGlite test path after rejected trigger statements; it does not establish PostgreSQL production behavior. A real isolated PostgreSQL instance was unavailable (`psql`/`pg_ctl` were absent and the Docker daemon was inaccessible). The append-only assertion remains intact.
- Browser runs used only the in-memory PGlite database and never `.env.local`. With one socket connection, the app logged `ECONNRESET`; with five multiplexed connections, PGlite returned protocol errors such as mismatched unnamed prepared-statement parameter counts. This matches the socket package’s documented single-backend multiplexer limitation under concurrent Next requests.
- The admin provider-detail responsive/access-control browser test and anonymous appeal browser test were attempted but did not complete because of that database transport failure. No valid new screenshots were captured. Browser acceptance remains open; do not describe the detail page as browser-verified.

## Security and data behavior

- Suspension still invalidates sessions and does not grant suspended users normal access.
- Appeal submission reveals no account-existence result, never changes account status, and is readable only through the admin queue. Rate limits are keyed by a SHA-256 hash of normalized email; this is a lightweight abuse control, not strong identity verification or a defense against distributed spam. No forwarded-IP header is trusted. A CAPTCHA, email verification, and delivery service remain unconfigured.
- Provider “Other” text is escaped by React on display and is not included in customer notifications before moderation. Customers see a neutral message while review is pending or rejected.
- Booking deadlines use UTC timestamps and display in Philippine time. Past-deadline status changes when the booking is next accessed or acted on; no scheduled worker exists. A scheduled reconciler is needed if product requires a guaranteed wall-clock notification without user access.
- Expiration releases unpaid reservation holds only. Voucher availability follows the existing rule that cancelled bookings no longer reserve an unused voucher. No money is collected, refunded, or assessed.

## Validation

- `npm run typecheck`: passed after the final code changes.
- `npm run lint`: passed after the final code changes.
- Full `npm test`: 29 passed, 0 failed, including the isolated migration and focused policy regressions.
- `npm run build`: passed with Next.js 16.3.8.
- Playwright admin/support browser checks: attempted with the isolated launcher; blocked by PGlite socket transport failures described above.
- Real PostgreSQL migration/trigger test: unavailable in this environment.

## Deferred or not activated

- The 48-hour provider cancellation restriction remains disabled until the emergency, escalation, and near-event dispute rules are approved and fully tested.
- No cancellation fees, refunds, compensation vouchers, or payment changes were added. Existing payment and QR simulation remain untouched.
- Customer-provider messaging and dark mode were deferred because the higher-priority browser/database validation remains unstable. No partial theme was introduced.
- Loyalty-point economics, birthday rewards, photographic evidence storage, chatbot/AI, and branding/header variants remain planning/review items.

## Migration and rollout

1. Review and apply the existing PostgreSQL schema baseline, then migration 002, then migration 003 to an approved isolated database first.
2. Verify the old pending rows still have `response_deadline_at IS NULL`; new bookings receive a 24-hour deadline.
3. Run the business and browser suites against a dedicated PostgreSQL test database before production review.
4. Review spam/privacy copy and assign a human follow-up owner before exposing the public form in a real environment.
5. No migration in this report has been run against Supabase. Rollback should disable/revert application features while retaining new tables, columns, and review history; do not drop user-submitted records.

## Production readiness

**Not ready to merge or deploy.** The admin provider view still needs browser evidence at 1440, 768, and 390 pixels plus customer/provider/anonymous denial checks. A real PostgreSQL migration/integration run, stakeholder approval of provisional cancellation/expiry rules, and review of preview database isolation remain required.
