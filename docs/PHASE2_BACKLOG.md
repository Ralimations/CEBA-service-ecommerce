# Phase 2 backlog

## Combined sprint implementation snapshot — 2026-10-13

The earlier planning entries below describe the state when drafted. The current branch now implements: 24-hour booking expiry and a prepared protected daily cron; configurable 48-hour provider cancellation review; persisted item-scoped booking messaging; light/dark/system theming; nonredeemable loyalty experience points; and a separate simulated installment ledger. Validation is summarized in `docs/PHASE2_COMBINED_IMPLEMENTATION_REPORT.md`. These business values remain provisional. No production migration or deployment has occurred.

**Emerald continuation update — 2026-10-13:** the UI now uses the Emerald Editorial Luxury system documented in `docs/EMERALD_DESIGN_SYSTEM.md`. Bundle-scoped message browser coverage, participant reporting/admin review, and visit-driven two-hour booking-deadline reminders are implemented on this branch. Migration 008 adds report metadata. Final automated evidence and known gaps are tracked in `docs/PHASE2_DESIGN_AND_FEATURE_COMPLETION.md`.

Complexity uses S/M/L/XL as a relative engineering estimate. All testing that mutates records must use the disposable PGlite harness or another verified isolated database.

## P0 — Blocking/security

### P0.1 Suspension authorization regression coverage — completed in this branch

- **Description:** Verify database-backed session invalidation and direct action denial after suspending customer/provider accounts.
- **Why:** A disabled UI does not protect the custom action API.
- **Files:** `server/auth.ts`, `server/actions.ts`, `app/api/actions/route.ts`, `tests/business.test.ts`.
- **Dependencies:** Isolated PGlite test harness.
- **Complexity:** S.
- **Acceptance criteria:** Old tokens resolve to no user; booking and provider mutations through the action boundary are denied; no records are created; active account functionality continues.
- **Tests:** `npm test`; direct action invocation with a missing user and session lookup after suspension.

### P0.2 Verify suspension behavior in the deployed pilot — pending operational follow-up

- **Description:** Reproduce the client report against a specifically approved non-production account and confirm the deployed build/session behavior.
- **Why:** Local code review cannot prove what build or browser state produced the report.
- **Files:** No code change unless a reproducible defect is found.
- **Dependencies:** A safe test account/environment; never use a real customer's account.
- **Complexity:** S.
- **Acceptance criteria:** Record app version, actor role, stale page/session condition, direct endpoint result, and no production-data mutation.
- **Tests:** Browser plus direct request against an isolated environment.

## P1 — Near-term improvements

### P1.1 Admin inspection of suspended provider — implemented in this branch

- **Description:** Add an authorized detail route with provider identity, business/contact details, moderation/profile state, services, and booking history.
- **Why:** Admin users need historical context even when public marketplace visibility is removed.
- **Files:** `app/[[...path]]/page.tsx`, `features/admin/pages.tsx`.
- **Dependencies:** Existing admin role guard and `providers()`/`bookingsFor()` projections.
- **Complexity:** M.
- **Acceptance criteria:** Admin can inspect active and suspended records; public `/providers/:id` still excludes suspended accounts; missing accounts return not-found; no invented suspension reason is shown.
- **Tests:** Existing business suite; browser checks at 1440, 768, and 390 px.

### P1.2 Service-fee terminology — implemented in this branch

- **Description:** Label the existing deduction “Service Fee” in customer/provider/admin presentation.
- **Why:** Avoid implying an extra customer charge.
- **Files:** `config/platform.ts`, `features/bookings/pages.tsx`, `features/provider/pages.tsx`, `features/admin/operations.tsx`, `features/admin/bundles.tsx`.
- **Dependencies:** No financial-rule changes.
- **Complexity:** S.
- **Acceptance criteria:** Display wording is consistent; internal `platform_fee` and `platformFee` stay intact; totals and supplier allocation do not change.
- **Tests:** Business financial allocation tests; fee-settings UI assertion.

### P1.3 Public suspended-account support intake — implemented; operational details remain

- **Description:** Provide an actual support request channel without granting account access.
- **Why:** Current public support is FAQ-only and ticket creation requires login.
- **Files:** Likely `app/api` route, `features/account/pages.tsx`, `server/management.ts`, `database/schema.postgres.sql`, `features/admin/operations.tsx`.
- **Dependencies:** Named support owner/channel, privacy wording, anonymous rate-limit and spam policy, admin response process.
- **Complexity:** M.
- **Acceptance criteria:** Generic response that reveals no account existence; validated lengths; server-side rate limits and spam trap; admin-only queue; no automatic reinstatement; no unsupported email address.
- **Tests:** Isolated tests for limits, generic responses, abuse inputs, and admin authorization.

### P1.4 Cancellation-reason moderation — implemented provisionally; owner is acceptance authority

- **Description:** Replace provider-only free text with approved reason codes and admin review for custom text.
- **Why:** Maintain professional customer-visible communication and an audit record.
- **Files:** `server/bookings.ts`, `features/bookings/pages.tsx`, `features/admin/operations.tsx`, `database/schema.postgres.sql`, `types/models.ts`.
- **Dependencies:** Approved reason list, single versus multiple selection, moderator decisions, customer visibility rules.
- **Complexity:** L.
- **Acceptance criteria:** Existing cancellation events remain; unreviewed text is private; approved reason is customer-facing; reviewer and timestamp are recorded; current booking/refund/dispute transitions do not change.
- **Tests:** Reason validation, visibility state, notification content, historical note retention, isolated migration.

## P2 — Phase 2 features

### P2.1 Durable 24-hour response window — implemented provisionally; real PostgreSQL validation pending

- **Description:** Add persisted response deadline and idempotent expiry processing for pending bookings.
- **Why:** Requests currently remain pending indefinitely.
- **Files:** `server/bookings.ts`, `server/reminders.ts`, `database/schema.postgres.sql`, `types/models.ts`, customer/provider booking pages.
- **Dependencies:** D-01 and D-02. Decide timeout outcome, bundle all-or-nothing behavior, notification content, and reservation cleanup.
- **Complexity:** L.
- **Acceptance criteria:** No reservation before acceptance; deadline uses agreed timezone; expiration is durable/idempotent; only outstanding booking items expire as approved; customer/provider receive correct notices; retries do not duplicate transitions.
- **Tests:** Concurrent accept/expire race, partial bundle response, retry, notification uniqueness, reservation cleanup.

## Continuation status (2026-10-13)

## Emerald redesign and feature follow-up (2026-10-13)

| Work item | Status | Evidence / remaining work |
|---|---|---|
| Emerald Editorial Luxury visual system | **Implemented for core public, customer, provider, and admin surfaces** | Responsive token and component refinement plus homepage redesign. Route-specific dark screenshots and visual-diff automation remain incomplete. |
| Bundle messaging browser coverage | **Implemented in E2E** | Two booking-item conversations, customer/provider exchange, unrelated provider/customer denial, mobile screenshot, long input rejection and script-like text escaping are exercised. |
| Message reporting | **Implemented provisionally** | Migration 008, participant-only reports, one report per sender/message, focused admin queue and audited review. Retention and moderation policy remain open. |
| Pre-deadline reminders | **Implemented: visit-driven and scheduled** | Stable-ID in-app notices are visit-driven within two hours and scheduled daily for the 26-hour advance window; cron configuration remains to be verified in preview. |
| Birthday/rank monetary benefits | **Deferred** | Feature flag remains off. Business values, birthday data handling, stacking, caps and abuse prevention are not approved. |
| WCAG 2.2 AA audit | **Automated audit passed** | axe-core found zero violations across 39 public/customer/provider/admin routes in light and dark. Manual keyboard and assistive-technology review remains. |
| Performance measurements | **Local synthetic samples captured** | Production mode sampled 19 routes/variants at 16–84 ms with 0–13 SQL queries. No before/after comparison or production-capacity claim. |

| Work item | Status | Evidence / remaining work |
|---|---|---|
| P0.1 stale-session security regression | **Completed** | Isolated business suite verifies invalidated customer/provider sessions and denied action dispatch. |
| P0.2 deployed pilot incident review | **Blocked on operational access** | No pilot environment was queried. Obtain the incident build, logs, and authorized read-only verification separately. |
| P1.1 Service Fee wording | **Completed** | Presentation-only change; provider allocation and internal fee names are unchanged. |
| P1.2 suspended provider admin record | **Implemented and verified locally** | Role/provider access, customer/provider/anonymous denial, public marketplace exclusion, and 1440/768/390 layouts passed the real-PostgreSQL Playwright suite. No shared or production database was queried. |
| P1.3 public account support | **Implemented; owner is acceptance authority** | Generic public intake, rate-limit/honeypot, admin-only queue and internal notes. Final local PostgreSQL/browser verification passed. No email delivery or auto-reinstatement; stronger spam controls and an operating owner remain open. |
| P1.4 provider cancellation reason moderation | **Implemented provisionally; owner is acceptance authority** | One primary code; Other text private pending append-only admin decision. Near-event restrictions remain off; exact operating policy remains provisional. |
| P2.1 response deadline and expiry | **Implemented provisionally, real PostgreSQL validation pending** | New rows get 24 hours; old pending rows remain deadline-null; due bundles expire atomically on relevant access/action. No scheduled reconciler. |
| P2.2 late cancellation, fees, refunds and compensation | **Deferred** | Existing dispute behavior retained; no financial consequences or near-date lock activated. |
| P2.3 customer-provider messaging | **Deferred** | Earlier priorities require stable browser/database verification and approved privacy/retention/moderation rules. |
| P2.4 full dark/light theme and header concepts | **Deferred** | No incomplete theme switch shipped. |
| P2.6 payment lifecycle specification | **Not started in this continuation** | Keep the current simulation and obtain finance/product approval before implementation. |
| P3 loyalty/rewards | **Deferred** | Existing rank/referral rules remain unchanged; monetary reward values are not active. |

The full PGlite business suite passed once after the continuation tests were added. The pre-existing append-only assertion has also failed intermittently in both baseline and feature runs; a real isolated PostgreSQL run remains a release gate. The Playwright failures are recorded in `PHASE2_IMPLEMENTATION_REPORT.md`.

## RC2 release engineering — 2026-10-14

| Work item | Status | Evidence / remaining work |
|---|---|---|
| Fail-closed local/staging DB target | Implemented and verified locally | `database/target-guard.ts` requires loopback for local, direct host/ref match plus distinct production ref for staging, and blocks production mutations. Four target-guard checks passed in `npm run verify:release`. |
| Disposable-PostgreSQL CI workflow | Updated locally | Read-only permissions, no cloud secrets, concurrency cancellation, manual trigger and artifacts. Remote branch copy is older; push is blocked until Preview effects are audited. |
| Cloud infrastructure audit | Partial | Local Vercel project link and GitHub repo metadata checked; remote Vercel/Supabase settings, plans, secret scopes and protection unavailable. See `RC2_INFRASTRUCTURE_AUDIT.md`. |
| Isolated cloud staging and Preview | Blocked | No distinct staging project identity, pricing/quota, Preview variable scope, protection, or deployment evidence. |
| Hosted journeys, accessibility, runtime health | Pending | Requires protected Preview, synthetic accounts and deployed SHA. |
| Operational/demo package | Prepared | RC2 report, runbook, acceptance matrix, stakeholder walkthrough and decision sheet created. |

Keep the Emerald reference pack untracked/preserved. Do not push the branch until automatic Preview effects and database separation are proven.

### P2.2 Cancellation policy and dispute model

- **Description:** Specify cancellation transitions, near-event constraints, admin review, compensation, and audit trail before implementation.
- **Why:** The meeting proposes financial penalties and a lock without amounts or exceptions.
- **Files:** `server/bookings.ts`, `lib/domain.ts`, schema, admin disputes, booking pages.
- **Dependencies:** D-05 through D-11.
- **Complexity:** XL.
- **Acceptance criteria:** No unapproved fee/refund; each transition is explicit and auditable; provider/customer responsibilities and exceptions are documented; rollback is additive and safe.
- **Tests:** State matrix, race and idempotency tests, ledger invariants, authorization.

### P2.3 Booking-attached customer/provider messaging

- **Description:** Design and deliver a low-cost refresh-based message thread attached to a booking.
- **Why:** Customers need coordination without confusing marketplace messaging with platform support.
- **Files:** New messaging model/routes plus booking detail and admin moderation views.
- **Dependencies:** D-14, retention/privacy, notification and abuse policy.
- **Complexity:** L.
- **Acceptance criteria:** Only booking participants can read/write; admin access is audited; rate limits, unread state, report/retention behavior are documented; no paid chat service or realtime service is introduced.
- **Tests:** Cross-booking access denial, spam limits, notification idempotency, retention visibility.

### P2.4 Dark/light token foundation and header options

- **Description:** Prepare approved emerald/cream/silver/dark tokens and two logo/header mockups; implement a switch only after contrast and no-flash behavior are approved.
- **Why:** Establish brand identity without broad visual regressions.
- **Files:** `app/globals.css`, `app/layout.tsx`, `components/navigation.tsx`, brand assets.
- **Dependencies:** D-17 and accessibility review.
- **Complexity:** M (tokens), L (complete mode switch).
- **Acceptance criteria:** Keyboard-accessible state, preference persistence, no flash, contrast across public and admin routes, existing logo retained until approved.
- **Tests:** Theme persistence, keyboard operation, contrast sampling, mobile screenshots.

### P2.5 Handshake camera scanning feasibility

- **Description:** Evaluate optional camera QR scanning while preserving manual entry and the current handshake state machine.
- **Why:** The current protocol already has dual-party confirmation but the UI uses manual codes.
- **Files:** `features/bookings/handshake.tsx`, `server/bookings.ts` only if protocol changes are justified.
- **Dependencies:** D-16, browser/device and accessibility review.
- **Complexity:** M.
- **Acceptance criteria:** Only participants can issue/verify; both gates and counterparty requirements remain; expiration, attempts, and one-use behavior remain; no camera scanning is required to complete a booking.
- **Tests:** Existing handshake suite plus camera fallback and permission denial UX.

### P2.6 Payment lifecycle specification

- **Description:** Map current simulation to proposed reservation fee, 50% payment, dual QR, refund, and payout lifecycle.
- **Why:** Meeting language is ambiguous and real payment is out of scope.
- **Files:** Design document first; future payment service and schema only after approval.
- **Dependencies:** D-09 and D-10; finance/legal/compliance review.
- **Complexity:** L.
- **Acceptance criteria:** State diagram, amount schedule, idempotency keys, transaction boundaries, failure/rollback behavior, security and compliance dependencies; simulated-only implementation until approved.
- **Tests:** Future ledger invariants and concurrent payment attempts in isolated DB.

## P3 — Future growth

### P3.1 Loyalty and referral rewards

- **Description:** Compare current ranks/referrals with proposed check-ins, birthday rewards, tier vouchers, and rank-up referrals.
- **Why:** Retain customer loyalty without inventing financial values.
- **Files:** `server/vouchers.ts`, `lib/domain.ts`, `config/platform.ts`, account pages, schema.
- **Dependencies:** D-12 and D-13.
- **Complexity:** L.
- **Acceptance criteria:** Approved thresholds, eligibility, point value, caps, expiry, birthday verification, stacking, and service SLA exist before rewards activate.
- **Tests:** Rank boundaries, idempotent daily check-in, referral fraud and duplicate prevention, voucher ledger.

### P3.2 Collateral/capital feature

- **Description:** Research only; no sprint implementation.
- **Why:** Page 10 describes a possible provider capital mechanism for a larger future product.
- **Files:** None until a separate approved proposal.
- **Dependencies:** Legal, finance, lending/credit and risk review.
- **Complexity:** XL.
- **Acceptance criteria:** Separate approved product and compliance plan; no user funds or liabilities created by this marketplace sprint.
- **Tests:** Not applicable until scoped.

## Final PDF compliance sprint (2026-10-14)

| Work | Status | Evidence / follow-up |
|---|---|---|
| PDF issue/feature audit | Complete | `FINAL_PDF_COMPLIANCE_AUDIT.md` maps every concern, proposal, contradiction, code path, test, result, and remaining issue. |
| Emerald design and responsive route review | Implemented; local visual evidence reviewed | `artifacts/EMERALD_VISUAL_INDEX.md`; production visual state remains unverified. |
| Provider-paid fee wording | Implemented and verified | Customer/provider/admin labels and seeded bundle copy say “Service Fee”; storage/calculation unchanged. |
| Monetary loyalty concept simulation | Implemented, flag-gated | Preview shows only the PDF's terms. No real redemption, personal birthday data, voucher issuance, or checkout effect. |
| Local release verification | Final run recorded in production report | Disposable PostgreSQL, migrations 002–008, business and browser suites, production build/probes, accessibility, and enabled/disabled flags. |
| Production database and Vercel release | Blocked by technical prerequisite | No verified production project reference, schema/migration state, backup/restore drill, deployment config, or live CI. No production change or merge. |

The project owner has authorized a conditional merge and remains acceptance authority; no separate stakeholder meeting is required. Release still stops before production migration and merge when backup/restore cannot be proven, as documented in the owner brief.
