# SOIRÉESOURCE PHASE 2 — FINAL PRODUCTION RELEASE

**Release completed:** 14 October 2026, 09:28 PHT (Vercel reports UTC). **Live smoke checks completed:** 15 October 2026, 12:40 PHT. The implementation deployment is `acd20fd3d0cbcd9f4baf4a8e42704e2a82a82206`. This report was added after that deployment; it records the implementation release commit rather than claiming the report itself was in that deployment.

## 1. Deployment status

- **Status: deployed and smoke-checked.** Vercel project `soiree-source`, owner `ralimations-projects`, linked to `Ralimations/CEBA-service-ecommerce`, production branch `main`.
- Pull request [#1](https://github.com/Ralimations/CEBA-service-ecommerce/pull/1) merged normally at 2026-10-14 01:28:00 UTC. Merge commit: `acd20fd3d0cbcd9f4baf4a8e42704e2a82a82206`.
- Vercel production deployment: `dpl_HfBzXjt7Lg927HssDtE2ortKua6w`, ready at 2026-10-14 01:28:33 UTC (09:28:33 PHT), source SHA matches the merge commit.
- Production URL: [https://soireesource.vercel.app](https://soireesource.vercel.app). The deployment also aliases `soiree-source-mk8008i8a-ralimations-projects.vercel.app`.
- No replacement project, custom domain, paid service, force push, or administrative protection bypass was used. `main` had no required status checks or branch protection.

## 2. Git

- Source branch: `phase2a/meeting-two-feedback`, verified source commit `ec9602e135bb72625c1cd1fb699b34af5f2aabde`.
- GitHub `main` before merge: `ce56e4dd4322b02477f24d5cb6a3b2682ea1c216`; ordinary merge included all 19 Phase 2 feature commits.
- Pull request merged with the ordinary merge strategy and a required matching source SHA. No force push or unrelated history rewrite.
- Vercel Preview built the feature branch. GitHub Actions did not run its test job: run `38495833090` was stopped before any steps because the GitHub account was locked due to a billing issue. The earlier run had the same result. No remote CI tests are claimed as passing. The owner-approved external-service exception was supported by the complete local suite, isolated restore rehearsal, exact-source Preview build, and production compatibility checks.

## 3. Database

- Confirmed the Production Vercel PostgreSQL host and public Supabase URL identify project `loxvsdxuyrbvlbxbspxl` (`ceba-ecommerce-service`). The release migration/backup connection used PostgreSQL 17.11 with certificate-verified TLS. Preview had no database environment variables; Preview and the GitHub workflow had no production write credentials.
- Before migration the application's ledger contained version 1 and 34 public tables with 1,404 rows. A consistent custom-format full database dump was created using PostgreSQL 17.11 on 14 October 2026 at 09:11 PHT, protected outside the repository at `C:\Users\aedra\AppData\Local\SoireeSource\backups\phase2-20261014T010912Z`. Archive size: 508,982 bytes. SHA-256: `bb0e2ef88725fa7c1b6cda4393df6701211db7e871e77a2116c9fe5161e25e34`. Its archive table of contents was inspected. No record contents, credentials, or connection strings were added to Git.
- A fresh isolated PostgreSQL 17.11 restore reproduced every public application table's row count and content hash, columns, constraints, indexes, triggers, and functions. All custom application account, session, booking, payment simulation, and audit records were included. The restore rehearsal used the public application schema; Supabase managed internal schemas remain in the full archive and were not restored into plain PostgreSQL.
- Migrations `002`–`008` were rehearsed and safely rerun on the restored copy. 158 rehearsal checks passed, including all constraints, append-only protections, and 14 read-only application integration checks each against migrated Phase 2 code and the pre-release Phase 1 code.
- Production migrations `002_public_account_support`, `003_booking_response_and_cancellation_review`, `004_booking_messaging`, `005_provider_cancellation_window`, `006_loyalty_experience`, `007_simulated_deposit_prototype`, and `008_booking_message_reports` were then applied in sequence with per-migration transactions, 5-second lock timeouts, and 30-second statement timeouts. Ledger is now `1`–`8`.
- Before and after migration, all 34 legacy public tables matched the backup snapshot by row count and content hash. Historical pending bookings kept null response/expiration deadlines; no seed or test business data was written to Production. Existing Phase 1 public routes returned HTTP 200 after the migration.
- **Scope limitation:** this was a complete protected database archive and a complete application-schema restore rehearsal, not a full Supabase platform disaster-recovery drill. Do not represent the plain PostgreSQL rehearsal as restoring Supabase Auth/Storage internals.

## 4. Testing

- `npm run verify:release` passed on the verified feature source: TypeScript, ESLint, database mutation safety checks (4/4), migrations (002–008), business integration tests (35/35), production build, browser hydration/performance probes, Playwright (13/13), feature-disabled checks (1/1), and PostgreSQL cleanup.
- Accessibility automation found zero axe violations on 39 routes in both light and dark themes. The performance probe sampled 19 variants (25–90 ms, 0–13 database queries). A manual keyboard and assistive-technology review remains outside this automated result.
- Production browser smoke: **72/72 assertions passed** on 15 routes. Public home, browse, a database-backed service and its provider, bundles, login, registration, support, public appeal, and terms returned HTTP 200. Anonymous visits to dashboard, provider, admin, message reports, and bookings resolved to `/login`.
- Live light/dark theme toggle and persistence passed; the 390 px mobile layout stayed within viewport width. Anonymous messaging, action, and cron requests returned 401; a wrong cron bearer also returned 401. No browser runtime/hydration exceptions, console errors, or HTTP 500 responses occurred during the checks.
- Smoke screenshots: `artifacts/production-smoke/home-light-desktop.png`, `artifacts/production-smoke/home-dark-desktop.png`, and `artifacts/production-smoke/home-dark-mobile.png`.
- Production customer/provider/admin account flows were not exercised with real accounts or bookings. No production business mutation was performed by smoke tests.

## 5. Features

Emerald light/dark visual system; Service Fee display terminology; suspended-account booking defenses; administrator access to suspended-provider details; public account support and appeals; booking messaging/reporting; provider response deadlines and expiration; structured cancellation reasons and moderation; nonmonetary loyalty experience points; dual-party booking verification; and simulated deposit prototype support are present in the released code.

These policy and product proposals remain incomplete or provisional: cash-valued or redeemable rewards, real payments/refunds/penalties, a settled cancellation policy, the message retention and handling policy, secure dispute photo attachments, camera QR scanning, exact-time notification guarantees, and competitor-inspired planning/AI suites. The deposit ledger remains a separately gated simulation and does not settle payments or replace checkout.

## 6. Feature flags

Production-only values were confirmed through the Vercel project API, with no values copied for the cron secret:

| Setting | Production state |
|---|---|
| `FEATURE_BOOKING_MESSAGING` | `true` |
| `FEATURE_PROVIDER_CANCELLATION_POLICY` | `true` (provisional 48-hour review window) |
| `FEATURE_LOYALTY_BETA` | `true` (nonredeemable XP) |
| `FEATURE_SIMULATED_DEPOSITS` | `false` |
| `FEATURE_LOYALTY_MONETARY_REWARDS` | `false` |
| `PROVIDER_CANCELLATION_LOCK_HOURS` | `48` |
| `CRON_SECRET` | configured, sensitive type, Production only |

No real payment processing, redemption, monetary reward, fee, penalty, or refund was enabled. Vercel showed no Preview-scoped environment variables.

## 7. Production verification

- The live deployment was `READY`, targeted Production, and its source SHA exactly matched the merge commit. The `soireesource.vercel.app` production alias was attached.
- The deployed Vercel configuration lists `/api/cron/expire-bookings` at `0 0 * * *`. The account plan is Hobby; this daily schedule is permitted. Vercel documents that Hobby cron runs once a day and does not guarantee precise invocation time ([Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Booking access/actions continue to reconcile expirations; do not promise exact-time delivery.
- The deployed message endpoint returned 401 to anonymous requests, confirming the message feature was present while retaining participant authentication. The cron endpoint returned 401 without a bearer and with an invalid bearer; the scheduled credential was not invoked manually because the handler can expire bookings and write notifications.
- A sanitized Vercel runtime-log query for the deployment returned zero entries in the observed window. This supplies no exception sample to review and is not evidence of long-term stability. Brief smoke testing cannot establish production reliability over time.
- No personal customer data was printed, and no real account or booking was modified by the release checks.

## 8. Rollback

- Last known-good Phase 1 Production deployment: `dpl_5xWyM7K6gUhLZhrjEhKG71e1WdhS`, source `ce56e4dd4322b02477f24d5cb6a3b2682ea1c216`, Vercel deployment URL `soiree-source-8do6o5p65-ralimations-projects.vercel.app`.
- Phase 1 read-only application queries succeeded against the post-migration restored database; additive Phase 2 schema is compatible with the previous application code. If a critical issue occurs, disable the affected Production feature flag or roll application traffic back to this deployment after checking current status. Preserve all migrated tables and newly written records. Do not run down migrations or restore over live data as an application rollback.
- The protected backup path and checksum are recorded above; its ACL intentionally restricts access. Use it only for a separate incident recovery decision after considering writes made since backup creation.

## 9. PDF compliance

The 10-page PDF was compared with the implementation in [`FINAL_PDF_COMPLIANCE_AUDIT.md`](FINAL_PDF_COMPLIANCE_AUDIT.md). The audit distinguishes customer requests from engineering defaults and ambiguous proposals. The release implements the reviewed visual, access-control, support, booking, messaging, cancellation, loyalty, verification, and Service Fee work where described, and it retains explicit status labels for incomplete financial, photo-evidence, camera-scan, and future competitor proposals. It does not claim conceptual financial proposals are complete.

## 10. Final conclusion

**Phase 2 is merged and deployed to the existing Production application.** Production schema versions 002–008 are applied and the existing 34 application tables passed before/after integrity checks. The restored-application rehearsal, local release suite, deployed commit verification, and non-destructive live smoke checks passed. GitHub Actions could not start because of an external billing lock; no remote test success is claimed. Continue monitoring runtime and business behavior beyond this initial smoke window, and treat unresolved policy proposals listed above as follow-up decisions.
