# SoiréeSource Phase 2 stakeholder demo

## Purpose

Demonstrate the Phase 2 experience in a protected Preview using synthetic accounts and simulated money. No hosted Preview or account is available yet; do not use the local README demo password on a public Preview.

## Before the session

- Confirm the Preview URL is protected and marked “SoiréeSource — Phase 2 Preview”. Confirm it uses an isolated staging database and the deployed commit is recorded.
- Create synthetic customer, provider, and administrator accounts with unique passwords. Share credentials directly with invited reviewers using the approved channel; never put them in this repository.
- Confirm there is no production customer data, real payment provider, outbound email/SMS, production cron, or live monetary reward.
- Enable only approved-for-demo nonmonetary flags in Preview. Keep `FEATURE_LOYALTY_MONETARY_REWARDS=false`.

## Suggested 15-minute walkthrough

1. **Public discovery (2 min):** Browse the Emerald marketplace, search/filter categories, inspect a provider and service, switch theme, and show support/appeal entry points.
2. **Customer booking (3 min):** Sign in as the synthetic customer, inspect service/bundle options, submit a simulated booking, show the response deadline, notices, and booking-specific message thread.
3. **Provider response (3 min):** Sign in as the synthetic provider, review the request and deadline, accept it, respond in the thread, and inspect the calendar/earnings simulation.
4. **Customer follow-up (2 min):** Return as the customer, verify status/notification and message history. Show cancellation/dispute entry without implying a penalty or refund is approved.
5. **Admin moderation (3 min):** Inspect provider/account state, message report, cancellation review, and audit history. Confirm unauthorized roles cannot access admin actions.
6. **Close (2 min):** Review policy decisions below and capture feedback; explain that simulated ledger values do not collect or transfer money.

Use separate browser profiles for each role. Do not present a scheduled Preview cron as running; directly invoked synthetic tests are a separate verification.

## Feature flag proposal

Defaults are verified in `.env.example`; Preview and Production values are not available from the current account audit.

| Flag | Purpose | Local default | Proposed Preview | Production status | Dependency / approval | Rollback |
|---|---|---:|---:|---|---|---|
| `FEATURE_BOOKING_MESSAGING` | Booking participant communication | off | on after privacy/retention review | Unknown; do not change | Message access, report moderation, retention owner | Set false; preserve existing records |
| `FEATURE_PROVIDER_CANCELLATION_POLICY` | Provisional cancellation review interface | off | on only as clearly labeled simulation | Unknown; do not change | Approve reasons, notice wording, review owner; no penalties | Set false; preserve audit history |
| `FEATURE_LOYALTY_BETA` | Nonmonetary experience points | off | on for synthetic demo | Unknown; do not change | Approve display and earning rules | Set false; keep ledger history |
| `FEATURE_SIMULATED_DEPOSITS` | Simulated installment/deposit records | off | on only with simulation label | Unknown; do not change | Keep payment simulation explicit; no gateway | Set false; no real charge exists |
| `FEATURE_LOYALTY_MONETARY_REWARDS` | Monetary loyalty value | off | off | Keep off | Requires finance/legal approval, caps, eligibility, expiry, anti-abuse | Keep false; no monetary issue |

Do not activate a flag merely because the user interface exists. Verify server-side behavior and disabled paths in both environments.

## Provisional policy decision sheet

Ask stakeholders to decide and assign an owner for:

- Booking response expiry outcome, customer/provider notices, and treatment of old deadline-null bookings.
- Cancellation reason categories, review service level, emergency exceptions, and customer-visible wording. No cancellation penalty is implemented as approved policy.
- Messaging access, reporting categories, moderation ownership, retention/deletion, and privacy notice.
- Loyalty earning rules and whether points ever become redeemable. Monetary rewards remain disabled until formal finance/legal approval.
- Payment plan, refunds, payouts, fees, and disputed deposits. Existing numbers remain simulations.
- Brand token/header approval and manual keyboard/screen-reader review.
- Preview access list and stakeholder invitation/feedback owner.

Record decisions in `PHASE2_DECISION_LOG.md` after stakeholder review; this document itself is not approval.
