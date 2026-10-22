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

The previous status below reflects the RC2/compliance checkpoint before the final release. Current final-release evidence and deployment outcome are in `PHASE2_FINAL_DEPLOYMENT_REPORT.md`.

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
- [x] Apply to production only after project identity, pending migration set, backward compatibility, protected backup, isolated restore, and rehearsal pass. Production migrations 002–008 were applied after all gates passed; see the final deployment report.

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
- [x] Automated release verification covered the existing simulated checkout, dual QR handshake, Service Fee calculations, and browsing. Continue routine post-release cache checks.

## Feature flags, monitoring, and cache

- [x] No additional rollout flags were required for public appeals or deadline reconciliation. Messaging, near-event cancellation review, and loyalty XP use the Production flags listed in the final report.
- [ ] Monitor appeal queue volume and rate-limit table growth. Current per-email hashing/honeypot is lightweight and can be bypassed by distributed or varied addresses.
- [x] Configure Production-only `CRON_SECRET` and deploy the daily cron. Access/action reconciliation remains authoritative between runs; exact invocation time is not guaranteed.
- [ ] Review admin audit entries for appeal and cancellation moderation decisions.
- [ ] Recheck public cache invalidation and ensure support/booking/admin data is never placed in shared public caches.

## Rollback

- [ ] If application behavior must be reverted, disable/revert the relevant routes/actions while retaining appeal submissions, deadlines, cancellation reasons, review history, and audit rows.
- [ ] Do not drop migration tables or delete user submissions as a rollback shortcut.
- [ ] If a deadline or cancellation rule changes, preserve existing timestamps and explain the policy transition; do not silently rewrite history.
- [ ] Record any manual follow-up required for submissions created before rollback. No email has been sent by this feature.

## Deploy gate

- [x] Confirmed Vercel Hobby permits the configured once-daily cron and set `CRON_SECRET` in Production only.
- [x] Before activation, verify Phase 2 schema dependencies and anonymous/participant authorization. Production flag state and remaining provisional policy follow-ups are recorded in the final deployment report. Keep `FEATURE_LOYALTY_MONETARY_REWARDS` and `FEATURE_SIMULATED_DEPOSITS` off; no real monetary benefit or payment flow is active.
- [ ] Post-release governance follow-up: approve message-report categories, handling/retention policy, and customer notice; messaging is enabled by the owner's final release authorization, and this product policy remains unresolved.
- [x] Document that the configured daily cron is not an exact-time guarantee; visit/access-driven reconciliation remains available. Review whether reminder timing meets the product's eventual operating expectations.

- [x] Project owner has authorized a conditional Phase 2 merge; no separate stakeholder meeting is required.
- [x] PostgreSQL and browser evidence is recorded in `PHASE2_FINAL_DEPLOYMENT_REPORT.md` and sanitized artifacts under `artifacts/`.
- [x] Preview database isolation, workflow isolation, and migration order were verified.
- [x] Production data precautions, protected backup, checksums, compatibility rehearsal, log query, and rollback reference are recorded.
- [x] Merged exact verified commit `ec9602e135bb72625c1cd1fb699b34af5f2aabde` into `main`; existing Vercel integration deployed merge `acd20fd3d0cbcd9f4baf4a8e42704e2a82a82206`.

## Final production release — completed 2026-10-14

- [x] Vercel project/repository/branch and production Supabase identity verified; Preview had no database variables.
- [x] Protected PostgreSQL 17 full backup created and archive inspected; restored all public application tables/objects to isolated PostgreSQL and verified hashes, schema metadata, and Phase 1 compatibility.
- [x] Rehearsed and applied migrations 002–008. All 34 legacy application table hashes matched before/after; ledger is 1–8.
- [x] `npm run verify:release`: 35/35 business, 13/13 Playwright, 1/1 feature-disabled, axe 39 routes × 2 themes with zero violations, build/typecheck/lint/safety probes passed.
- [x] Live Production smoke: 72/72 browser assertions across 15 routes; 401 anonymous message/action/cron checks; no runtime exceptions or 500s.
- [x] Nonmonetary flags and production cron credential set; simulated deposits and monetary rewards remain disabled.
- [ ] Manual keyboard and assistive-technology review remains to be completed before claiming full accessibility review.
- [ ] Continue monitoring after the initial smoke period. GitHub Actions could not start due to an external account billing lock; independent verification was completed and no remote CI success is claimed.
