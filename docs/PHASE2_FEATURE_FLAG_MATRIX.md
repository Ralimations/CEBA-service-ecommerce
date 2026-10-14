# Phase 2 feature flag matrix

Checked against the Phase 2 code and `.env.example` on 2026-10-14. The default configuration is fail-closed: every Phase 2 feature flag is `false`. Production and Preview environment values were not accessible during the final compliance sprint, so no cloud flag state is claimed.

| Flag | Server behavior when enabled | Default / disabled behavior | Verification | Production disposition |
|---|---|---|---|---|
| `FEATURE_BOOKING_MESSAGING` | Enables booking-item conversations for the customer and participating provider, including read cursors, notices, reports, and admin moderation. | The booking conversation UI is hidden and message endpoints reject requests. Existing records are retained. | Business and browser suites cover participant isolation, report moderation, notices, suspended users, and the disabled endpoint. | Keep off until message retention, privacy notice, and moderation ownership are confirmed. |
| `FEATURE_PROVIDER_CANCELLATION_POLICY` | Enables the provisional 48-hour Philippine event-date cancellation review window and urgent admin review for an accepted booking. | The provisional near-event restriction is not applied. Existing cancellation reason moderation remains available. | Business tests cover the Manila boundary, pending review, authorization, and the accepted/cancelled/disputed state outcomes; the release flag browser case checks both states. | Keep off until the cancellation policy and emergency handling are accepted. It does not assess a fee or issue a refund. |
| `FEATURE_LOYALTY_BETA` | Enables nonredeemable daily check-in, completed-booking, and referral rank-up XP. | XP panel and check-in action are hidden/rejected; existing rank and voucher rules continue. | Business test covers Manila-day idempotency and referral milestones; browser tests exercise display and disabled action. | Off until nonmonetary earning/display rules are accepted. |
| `FEATURE_LOYALTY_MONETARY_REWARDS` | With the loyalty beta also enabled, renders a clearly labeled concept-only preview of the PDF's point value and tier benefit proposals. | No proposal preview is shown. No birthday data is collected, no reward/voucher is issued, no XP becomes redeemable, and checkout is unchanged. | Business tests check the disabled result and the preview values; enabled/disabled browser checks confirm visibility is gated by both flags. | Keep off. Enabling it in test only verifies a text preview; it does not activate money, discount, or redemption behavior. |
| `FEATURE_SIMULATED_DEPOSITS` | Enables a separate simulated 50/50 deposit/balance ledger for an accepted, unpaid booking. | Deposit prototype UI is hidden and actions reject. Existing mock full-payment/escrow flow remains unchanged. | Business and browser suites verify allocation, retry behavior, disabled action, and that the prototype does not settle escrow. | Keep off unless the product accepts the demonstration wording. It is not a payment method or production installment plan. |

## Adjacent controls

- `PROVIDER_CANCELLATION_LOCK_HOURS` configures the provisional review-window length; invalid values fall back to 48 hours. It is not a monetary penalty.
- `CRON_SECRET` authenticates the scheduled expiration/reminder endpoint. Without it, the handler returns unavailable; deployed secret scope and cron status are unverified.
- The repository declares one daily cron in `vercel.json`. A daily schedule is not a precise 24-hour notification guarantee; booking reads/actions also reconcile due requests.
- `DEMO_HANDSHAKE_ANYTIME` is an existing demonstration control for the simulated handshake and is not a Phase 2 monetary feature flag.

## Required release checks

1. Inspect the flag names and values by Vercel environment scope without displaying secret values.
2. Keep monetary loyalty rewards and simulated deposits off in Production.
3. Enable nonmonetary capabilities only after their database migration state, authorization, and production-mode behavior are verified.
4. After any flag change, verify both the enabled and disabled path and record the environment, deployed commit, and result.
