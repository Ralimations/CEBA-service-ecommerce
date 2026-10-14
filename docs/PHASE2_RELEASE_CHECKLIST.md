# Phase 2 release checklist

## RC2 cloud staging gate

- [ ] Verify Vercel project, production branch, Preview scopes, deployment protection, domains, build hooks and automatic deployment effects.
- [ ] Verify Supabase production and dedicated staging project refs, plan/quota/cost, migration history, backup and restore access. Confirm refs differ; never use the unidentified local pooler endpoint.
- [ ] Configure only Preview-scoped staging credentials and an access gate. Keep CI free of cloud credentials.
- [ ] Run `npm run verify:release` locally; observe an actual GitHub Actions run after the push gate passes.
- [ ] Apply reviewed migrations/fixtures only to empty isolated staging and retain redacted identity evidence.
- [ ] Run deployed role, authorization, accessibility, runtime, feature-flag and cron-handler checks using synthetic data.
- [ ] Record deployed SHA, Preview URL, logs, test matrix and rollback owner. Do not promote or merge under this checklist alone.

Current RC2 status: local release verification **passes**; cloud staging remains **blocked at isolation proof**. See `PHASE2_RC2_CLOUD_STAGING_REPORT.md`; no Preview, remote CI result, migration, or Production change is claimed.

This checklist is for a future reviewed rollout. The migrations below are prepared files, not applied production changes.

## Final PDF compliance and release gate

The project owner has authorized the Phase 2 merge conditionally; no separate stakeholder meeting is required. Safe, reversible engineering defaults are documented in `PHASE2_DECISION_LOG.md`. Optional monetary features remain disabled.

- [x] Audit all PDF requests, concerns, contradictions, and optional competitor research in `FINAL_PDF_COMPLIANCE_AUDIT.md`.
- [x] Add a loyalty reward concept preview gated by `FEATURE_LOYALTY_MONETARY_REWARDS`; it does not change checkout, issue vouchers, or collect birthday data.
- [x] Correct remaining customer-facing seeded bundle text to say “Service Fee.”
- [ ] Verify exact Vercel project/repository/production branch and the Preview/Production variable scopes.
- [ ] Verify the exact Supabase production project reference, applied schema/migration state, locks, permissions, and current data volume.
- [ ] Create a protected full backup, validate it, restore it into isolated PostgreSQL, apply pending migrations to the restored copy, and verify Phase 1 data and rollback procedure.
- [ ] Push only after automatic Preview deployment and database isolation are proven; observe remote CI for the exact commit.
- [ ] Merge only the exact verified commit after all backup/restore and CI gates pass.
- [ ] Verify the production deployment, non-destructive smoke paths, logs, database connectivity, and production flag values.

Current status: local release verification is recorded in `PHASE2_PRODUCTION_RELEASE_REPORT.md`. Production identity and backup/restore are not verifiable in this environment, so migration, push, merge, and deployment remain stopped.

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
- [ ] Apply to production only after the project identity, actual pending migration set, backward compatibility, protected backup, isolated restore, and rehearsal all pass. The project owner has conditionally authorized the release; no production migration has been executed by this branch.

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
- [ ] Keep provisional features off in Production until database dependencies, authorization, and operating requirements are verified. Keep `FEATURE_LOYALTY_MONETARY_REWARDS` and `FEATURE_SIMULATED_DEPOSITS` off; the loyalty value is only a simulation preview and no real monetary benefit is active.
- [ ] Approve message-report categories, handling/retention policy and customer notice before enabling messaging in a real environment.
- [ ] Confirm deadline reminder timing and cron deployment guarantees; the visit-driven reminder is not a scheduled delivery guarantee.

- [x] Project owner has authorized a conditional Phase 2 merge; no separate stakeholder meeting is required.
- [ ] PostgreSQL and browser evidence is attached to the release record.
- [ ] Preview database isolation and migration order are verified.
- [ ] Production data precautions, backups, monitoring, and rollback owner are confirmed.
- [ ] Only after all technical gates pass, merge the exact verified commit and deploy through the existing Vercel project integration.
