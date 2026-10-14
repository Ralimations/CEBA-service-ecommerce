# SoiréeSource Phase 2A + 2B Combined Sprint Report

**Report date:** 2026-10-13
**Branch:** `phase2a/meeting-two-feedback`
**Production data, merge, and deployment:** untouched

This report records code and validation evidence separately from stakeholder policy. The PDF/pasted brief supplied the requested work; it does not establish approval of the new cancellation, deadline, messaging, theme, loyalty, or installment business rules.

## 1. Executive summary

Phase 2A support, suspension controls, booking response deadlines, cancellation moderation, and service-fee terminology are integrated with Phase 2B booking messaging, theme preference, loyalty experience points, scheduled expiry preparation, and an isolated simulated-installment prototype. A single command verifies the branch using disposable PostgreSQL 17 and Playwright.

The features are reviewable and locally validated. This is not a merge/deploy recommendation: provisional policy needs stakeholder review, the Vercel cron is not active, messaging bundle coverage and full accessibility auditing are incomplete, and the simulated installment flow intentionally does not settle or confirm bookings.

## 2. Git

- Starting branch: `phase2a/meeting-two-feedback`, starting commit `52ed3f337024bbcb60a7aac8a2d5a43937764654`.
- At start, the local `origin/phase2a/meeting-two-feedback` ref matched that commit; local `main` was `ce56e4dd4322b02477f24d5cb6a3b2682ea1c216`.
- A fetch was attempted but `.git/FETCH_HEAD` was read-only in this workspace. No branch switch, reset, or force push was used.
- Sprint commits: `48566a1` (`feat: complete Phase 2 booking communication and policies`), `e779a96` (`feat: add private messaging and expiry endpoints`), `709278f` (`test: add disposable PostgreSQL Phase 2 verification`), and the final report/docs commit.
- No push, merge, preview deployment, or production deployment was performed. Preview database isolation could not be verified.
- The pre-existing ignored `documentation/` folder was preserved.

## 3. Infrastructure

`npm run verify:phase2` provisions a fresh `postgres:17-alpine` container with a random in-memory password, a loopback-only ephemeral port, no persistent volume, and the explicit database/user `soiree_phase2_test`/`phase2_test`. Before fixtures, the runner verifies server identity and an empty public schema. It rejects any non-loopback host, wrong database/user, unknown server, or populated target. It redacts credentials and stops the container in `finally`.

The runner isolates child environment variables and the browser test server does not load `.env.local`. The production build can announce that `.env.local` exists, but the runner passes the isolated PostgreSQL URL explicitly and the test server refuses other targets. No Supabase connection was used.

`.github/workflows/phase2-verification.yml` defines an ephemeral PostgreSQL service for future CI. Local verification used the Docker container path; the GitHub Actions workflow itself has not yet run.

## 4. Phase 2A

- Suspension remains enforced at request-time through database-backed sessions and server authorization. Regression tests cover stale customer sessions, direct action denial, and provider restrictions.
- Admin suspended-provider detail includes scoped booking history. Playwright checks admin access, denial for customer/provider/anonymous roles, and public profile content exclusion; screenshots were captured at 1440, 768, and 390 pixels.
- Public account appeals persist with generic confirmation, validation/honeypot/rate-limit coverage, admin-only review, and no automatic reinstatement or email claim.
- Visible provider deduction labels use “Service Fee”; internal `platform_fee` columns/calculations are retained.
- New bookings carry a 24-hour response deadline. Expiry is idempotent, whole-bundle, releases partial reservations, records events and participant notifications, and does not assign deadlines to historical pending rows. A PostgreSQL race test runs expiry, accept, and customer cancel concurrently.
- “Other” cancellation text stays private until admin approval. The provisional 48-hour PHT event-date restriction sends provider requests into an admin queue; unpaid approvals cancel/release reservations, while paid held escrow becomes disputed/frozen. No fee or refund is charged.

## 5. Phase 2B

- **Messaging:** PostgreSQL history per booking item, customer-to-matching-provider membership checks per request, read/unread updates, message notifications, 4,000-character limit, sender rate limits, escaped text, and refresh-based UI. Admin read-only access is restricted to disputed bookings. Browser test sends customer message, provider reply, customer reads it, and unrelated provider gets 404.
- **Theme:** light/dark toggle, system preference, localStorage persistence, early initialization, and responsive screenshots. Dark surfaces now include the home bundle and provider invitation bands. Automated contrast sampling checks body/card text; this is not a full WCAG audit.
- **Loyalty:** feature-gated nonredeemable XP for Manila-day check-in, completed bookings, and referral rank milestones; idempotent ledger and existing rank thresholds retained. Monetary rewards remain disabled.
- **Installment prototype:** separate ledger records ceil-rounded 50% deposit and remaining balance, apportioned across bundle items with largest-remainder centavo balancing. It does not create payment/escrow rows, confirm a booking, trigger handshakes, issue refunds, or move money. The normal full-payment simulation remains intact.
- **Notifications:** booking expiry, provider cancellation requests/reviews, new booking messages, and loyalty milestones use existing notification storage. A pre-deadline reminder is not scheduled. Public appeal review does not claim email delivery.
- **QR/disputes:** existing two-party, item-bound, expiring, single-use handshake gates and simulated escrow/dispute protections remain in place and are covered by the business and browser suites. Camera scanning and private photographic evidence storage were not added.

## 6. Database

Additive migrations `002_public_account_support.sql` through `007_simulated_deposit_prototype.sql` are included and mirrored in `database/schema.postgres.sql`. Migrations 002–007 were applied twice against a disposable PostgreSQL schema. The migration test verifies rerun safety, preserved historical event/user data, null deadlines for old pending bookings, and the new schema version markers.

No migration was applied to production. Upgrade order and rollback guidance are in `docs/PHASE2_RELEASE_CHECKLIST.md`; rollback means disable/revert application behavior while retaining append-only records, not dropping data.

## 7. Testing

Reproduce with:

```powershell
npm run verify:phase2
```

The runner executes TypeScript, ESLint, PostgreSQL migration semantics, real-PostgreSQL business tests, a production build, and Playwright. It writes the redacted structured result and transcript to `artifacts/phase2-verification.json` and `artifacts/phase2-verification.log`.

**Final run (2026-10-13 00:34 UTC):** TypeScript passed; ESLint passed; migrations 002–007 passed twice; PostgreSQL business tests passed **34/34**; production build passed; Playwright passed **10/10**; disposable-container cleanup passed. The structured result records `status: passed`, zero failed steps, PostgreSQL 17.11, and redacted local connection identity in `artifacts/phase2-verification.json`. The PGlite `npm test` command is not the canonical compatibility result because its existing socket/append-only behavior has been intermittent; real PostgreSQL is used by the combined command.

Browser coverage includes public discovery, bundle booking, customer registration/booking, provider acceptance, simulated installment accounting, messaging privacy, both QR gates, escrow release/review, provider services/calendar, admin provider detail/support/cancellation, anonymous appeals, theme persistence, loyalty check-in, and responsive overflow checks. The suite uses one worker and retains screenshots/traces on failure.

## 8. Screenshots

Playwright output is retained locally under ignored `artifacts/`:

- `home-desktop.png`, `home-tablet.png`, `home-mobile.png`
- `admin-provider-detail-1440.png`, `admin-provider-detail-768.png`, `admin-provider-detail-390.png`
- `theme-system-dark.png`, `theme-light.png`, `theme-dark.png`, `theme-dark-mobile.png`
- `booking-completed.png`, `bundle-booking.png`, `provider-desktop.png`, `provider-mobile.png`, `admin-desktop.png`, `admin-mobile.png`, `cancellation-review-mobile.png`, and `loyalty-checkin-mobile.png`

The final successful run captured the listed images. Desktop/tablet/mobile marketplace shots and three-width admin provider detail were visually inspected; the dark homepage was also reviewed after correcting the promotional surface contrast.

## 9. Performance

The earlier performance report’s existing measurements remain unchanged. This sprint did not capture a new before/after latency or query-count benchmark, so no performance improvement or parity is claimed. New message reads are booking-item scoped and bounded to the most recent 200 messages; expiry batches are bounded at 100 items.

## 10. Feature flags

Defaults are documented in `.env.example` and remain off unless set explicitly:

| Flag | Default | Effect |
|---|---|---|
| `FEATURE_BOOKING_MESSAGING` | `false` | Booking-linked customer/provider messages and disputed-booking admin read view |
| `FEATURE_PROVIDER_CANCELLATION_POLICY` | `false` | Provisional 48-hour provider request/review behavior |
| `PROVIDER_CANCELLATION_LOCK_HOURS` | `48` | Configurable lock range (validated 1–336 hours) |
| `FEATURE_LOYALTY_BETA` | `false` | Nonredeemable experience ledger and check-in UI |
| `FEATURE_LOYALTY_MONETARY_REWARDS` | `false` | Monetary loyalty rewards; no such behavior is implemented |
| `FEATURE_SIMULATED_DEPOSITS` | `false` | Separate simulated installment prototype ledger |

The 24-hour deadline/expiry behavior is part of the current booking flow, not a runtime flag. Cron needs `CRON_SECRET`; no secret is hardcoded.

## 11. Business assumptions

Stakeholder review is still needed for whole-bundle expiry wording/outcome, cancellation reason catalogue, PHT 48-hour restriction and emergency policy, messaging retention/moderation/reporting, loyalty XP values and rank milestones, deposit rounding/timing, and final theme tokens. None is claimed as approved by CEBA students or SoiréeSource stakeholders.

## 12. Remaining issues

- The prepared Vercel cron is daily (`0 0 * * *`) and inactive until a future deployment with `CRON_SECRET`. Vercel schedules cron jobs on production deployments, not preview deployments; this sprint did not deploy. Hobby allows once-daily cron with up to ±59-minute timing variance; therefore exact deadline correctness still relies on access/action reconciliation. See [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- Messaging browser coverage covers a single provider booking, not a bundle’s separate provider conversations. Message retention/deletion and user abuse reporting are not implemented.
- Contrast sampling is focused, not a full route-by-route WCAG/axe audit. The development browser emitted a React hydration warning involving an unexpected `caret-color: transparent` style on inputs; no corresponding inline style exists in project source. This warning remains for a clean-browser/production-browser follow-up.
- No private evidence upload/storage interface, camera QR scanning, pre-deadline reminder job, real payment integration, or new performance benchmark is included.
- The GitHub Actions workflow is prepared but not yet exercised remotely.

## 13. Release readiness

The branch has local PostgreSQL, build, business, and browser evidence. It is **not ready to merge/deploy without review** because policy decisions remain provisional, scheduled activation is pending, message bundle coverage and complete accessibility review are unfinished, and production rollout/preview isolation has not been verified. Production schema/data, `main`, and deployment state were not changed.

## 14. Final completion matrix

| Feature | Status |
|---|---|
| Suspension authorization and active-user regression | Implemented and tested |
| Admin suspended-provider details and role/privacy checks | Implemented and tested |
| Public suspension appeal and admin queue | Implemented and tested |
| Service Fee display terminology | Implemented and tested; calculation unchanged |
| Booking 24-hour deadline, bundle expiry, concurrency, idempotency | Implemented and tested on PostgreSQL |
| Scheduled expiry endpoint and Vercel configuration | Implemented/tested locally; activation pending deployment/secret |
| Structured cancellation and moderated Other copy | Implemented and tested; catalogue provisional |
| Configurable 48-hour cancellation review | Implemented and tested; policy provisional |
| Booking messaging and single-booking authorization | Implemented and tested |
| Bundle messaging journey | Partially verified; per-item implementation, browser bundle message flow not exercised |
| Light/dark/system theme and persistence | Implemented and browser-tested; full accessibility audit pending |
| Loyalty check-in/referral XP | Implemented and tested; values provisional, nonmonetary |
| Simulated deposit/balance prototype | Implemented and tested as separate non-settling ledger; no payment/escrow integration |
| New-feature notifications | Partially implemented/tested; no pre-deadline reminder scheduler |
| Existing QR/dual-party handshake and dispute/escrow protections | Existing system retained and regression-tested; camera/evidence uploads not implemented |
| Private dispute evidence storage | Not implemented |
| Automated GitHub workflow | Prepared; remote Actions run not verified |
| Performance regression benchmark | Not run |

## RC1 follow-up (2026-10-14)

The release-candidate pass supersedes the earlier pending accessibility/performance notes above: `npm run verify:release` passed using disposable PostgreSQL 17.11, migrations 002–008, 35/35 business tests, production build, 13/13 Playwright cases, and a separate 1/1 feature-disabled browser/API case. Axe WCAG 2.2 AA reported zero violations across 39 routes in light and dark. Local production probes captured 19 synthetic route samples (26–95 ms and 0–13 SQL queries); these are not production-capacity or before/after evidence. The production probe found no caret-style mutations or hydration client errors on `/`, `/browse`, and `/login`; a development-only `caret-color: transparent` hydration warning remains unexplained. Manual accessibility review, remote CI, preview isolation, and stakeholder policy decisions remain release gates. See `PHASE2_RC1_IMPLEMENTATION_REPORT.md` and `artifacts/EMERALD_VISUAL_INDEX.md`.
