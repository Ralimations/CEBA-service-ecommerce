# Phase 2 release checklist

This checklist is for a future reviewed rollout. The migrations below are prepared files, not applied production changes.

## Before merge

- [ ] Confirm the Phase 2 branch and `main` diff; keep this branch separate until approval.
- [ ] Stakeholders approve or revise the whole-bundle 24-hour expiration policy and provisional cancellation-reason list.
- [ ] Decide whether a scheduled expiry reconciler is needed for guaranteed notifications when nobody visits a booking.
- [ ] Name the human owner and privacy wording for public account-support follow-up; confirm whether stronger spam controls or email delivery are required.
- [ ] Review near-event cancellation rules, emergency exceptions, and escalation path. The provisional 48-hour restriction is feature-flagged and needs policy approval.
- [ ] Review messaging, theme, loyalty XP, and simulated installment behavior. Financial rewards remain off; the installment ledger does not alter payments or escrow.
- [ ] Verify CI and preview deployments use a dedicated test database and cannot point migration/test commands at shared Supabase.

## Database migration order

1. **Baseline:** `database/schema.postgres.sql` (idempotent PostgreSQL schema used by this application).
2. **002–007:** Apply `database/migrations/002_public_account_support.sql` through `007_simulated_deposit_prototype.sql` in numeric order.
3. **008:** Apply `database/migrations/008_booking_message_reports.sql` after 002–007; it adds report metadata and does not alter message content or bookings.

- [ ] Back up the target database and verify restore access before applying changes.
- [x] Applied baseline and migrations 002–007 to disposable PostgreSQL 17.11 during verification; migration suite passed.
- [x] Applied migration 008 to disposable PostgreSQL and confirmed rerun behavior, participant-linked reports, and audited admin review actions.
- [ ] Confirm migration reruns are idempotent and the append-only triggers still reject updates/deletes.
- [ ] Confirm historical pending bookings retain a `NULL` response deadline. Do not backfill or expire them without a separate approved plan.
- [ ] Confirm migration review-history tables contain no unintended seeded or test data.
- [ ] Apply to production only after a separate approval and maintenance/change record. No production migration has been executed by this branch.

## Environment prerequisites

- [ ] `POSTGRES_URL` points to the intended database; never inherit `.env.local` in a test/preview job.
- [ ] Run business and browser tests using a real, isolated PostgreSQL instance. PGlite remains useful for fast checks but its socket multiplexer is not reliable enough for concurrent Next.js browser workflows here.
- [ ] Confirm no email service or support address is implied by the UI; add one only after the team configures actual delivery and ownership.
- [ ] Confirm the deployment uses the current Next.js 16.3.8 project docs and Cache Components configuration.

## Regression and acceptance checks

- [x] Run `npm run verify:phase2` (disposable PostgreSQL 17.11, migrations 002–008, 35/35 business tests, production build, 13/13 Playwright); `npm run verify:release` also passed with the production probes and 1/1 feature-disabled test. PGlite is not the canonical compatibility result.
- [ ] Run migrations 002–007 against a fresh isolated PostgreSQL schema and an existing-data copy.
- [ ] Test appeal validation, generic confirmation, per-email rate limit, honeypot, admin-only reading, status/notes, and no account reinstatement.
- [ ] Test provider acceptance before/after deadline, old pending row behavior, partial bundle expiry, concurrent accept/expire/cancel, reservation release, voucher reuse, idempotency, and notifications.
- [ ] Test structured reason validation, Other text privacy, moderation permissions, append-only review history, customer-visible approval, and unchanged cancellation/payment transitions.
- [x] Test bundle chat as customer and each provider, cross-item/provider/customer access denial, message length and HTML text handling, report submission, and admin review without exposing full conversation history.
- [x] Verify two-hour deadline reminders are unique, scoped to the customer and participating providers, and described as visit-driven rather than exact-time delivery.
- [x] Verify admin provider detail for suspended providers at 1440, 768, and 390 pixels; verify customer, ordinary provider, and anonymous access denial; verify public marketplace exclusion.
- [x] Capture and review baseline and post-redesign screenshots across desktop, tablet, and mobile; see `artifacts/EMERALD_VISUAL_INDEX.md`.
- [x] Capture selected dark-mode route screenshots and run axe/WCAG 2.2 AA across 39 routes in both themes (zero findings); see `artifacts/EMERALD_VISUAL_INDEX.md` and `artifacts/axe-wcag22aa.json`.
- [ ] Complete manual keyboard, dialog, and assistive-technology review before claiming full accessibility completion.
- [ ] Verify existing payment simulation, dual QR handshake, service-fee calculations, cache behavior, and public browsing.

## Feature flags, monitoring, and cache

- [ ] No runtime feature flag currently gates appeals, deadlines, or cancellation reasons; if staged rollout is required, add an explicit server-side flag before deployment.
- [ ] Monitor appeal queue volume and rate-limit table growth. Current per-email hashing/honeypot is lightweight and can be bypassed by distributed or varied addresses.
- [ ] Configure `CRON_SECRET` and deploy the prepared daily cron before relying on scheduled expiry. Access/action reconciliation remains authoritative between runs.
- [ ] Review admin audit entries for appeal and cancellation moderation decisions.
- [ ] Recheck public cache invalidation and ensure support/booking/admin data is never placed in shared public caches.

## Rollback

- [ ] If application behavior must be reverted, disable/revert the relevant routes/actions while retaining appeal submissions, deadlines, cancellation reasons, review history, and audit rows.
- [ ] Do not drop migration tables or delete user submissions as a rollback shortcut.
- [ ] If a deadline or cancellation rule changes, preserve existing timestamps and explain the policy transition; do not silently rewrite history.
- [ ] Record any manual follow-up required for submissions created before rollback. No email has been sent by this feature.

## Deploy gate

- [ ] Confirm the Vercel plan supports the configured cron cadence and set `CRON_SECRET` in the intended environment.
- [ ] Keep `FEATURE_BOOKING_MESSAGING`, `FEATURE_PROVIDER_CANCELLATION_POLICY`, `FEATURE_LOYALTY_BETA`, and `FEATURE_SIMULATED_DEPOSITS` off until the corresponding provisional decisions are reviewed. Monetary loyalty rewards remain off.
- [ ] Approve message-report categories, handling/retention policy and customer notice before enabling messaging in a real environment.
- [ ] Confirm deadline reminder timing and cron deployment guarantees; the visit-driven reminder is not a scheduled delivery guarantee.

- [ ] Reviewer accepts the implementation report and stakeholder review decisions.
- [ ] PostgreSQL and browser evidence is attached to the release record.
- [ ] Preview database isolation and migration order are verified.
- [ ] Production data precautions, backups, monitoring, and rollback owner are confirmed.
- [ ] Only then merge and deploy through the project’s normal release process.
