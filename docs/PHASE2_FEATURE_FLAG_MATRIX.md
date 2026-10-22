# Phase 2 feature flag matrix

Checked against Phase 2 code and `.env.example` on 2026-10-14. The default configuration is fail-closed: every Phase 2 feature flag is `false`. After the conditional production release, Vercel Production values were inspected and applied as shown below. See `PHASE2_FINAL_DEPLOYMENT_REPORT.md`; no Preview-scoped environment variables are configured.

| Flag | Server behavior when enabled | Default / disabled behavior | Verification | Production disposition |
|---|---|---|---|---|
| `FEATURE_BOOKING_MESSAGING` | Enables booking-item conversations for the customer and participating provider, including read cursors, notices, reports, and admin moderation. | The booking conversation UI is hidden and message endpoints reject requests. Existing records are retained. | Business/browser suites cover participant isolation, report moderation, notices, suspended users, and disabled behavior. Production anonymous GET returns 401. | **Production: true.** User-authorized for release after schema and auth checks. Message retention, privacy notice, report handling, and moderation ownership remain governance follow-ups. |
| `FEATURE_PROVIDER_CANCELLATION_POLICY` | Enables the provisional 48-hour Philippine event-date cancellation review window and urgent admin review for an accepted booking. | The provisional near-event restriction is not applied. Existing cancellation reason moderation remains available. | Business tests cover the Manila boundary, pending review, authorization, and accepted/cancelled/disputed states; browser suite covers both flag states. | **Production: true; lock hours: 48.** This remains a provisional policy default and does not assess a fee or issue a refund. |
| `FEATURE_LOYALTY_BETA` | Enables nonredeemable daily check-in, completed-booking, and referral rank-up XP. | XP panel and check-in action are hidden/rejected; existing rank and voucher rules continue. | Business test covers Manila-day idempotency and referral milestones; browser tests exercise display and disabled action. | **Production: true.** XP remains nonredeemable and nonmonetary. |
| `FEATURE_LOYALTY_MONETARY_REWARDS` | With the loyalty beta also enabled, renders a clearly labeled concept-only preview of the PDF's point value and tier benefit proposals. | No proposal preview is shown. No birthday data is collected, no reward/voucher is issued, no XP becomes redeemable, and checkout is unchanged. | Business tests check disabled behavior and preview values; enabled/disabled browser checks confirm gating. | **Production: false.** No money, discount, or redemption behavior. |
| `FEATURE_SIMULATED_DEPOSITS` | Enables a separate simulated 50/50 deposit/balance ledger for an accepted, unpaid booking. | Deposit prototype UI is hidden and actions reject. Existing mock full-payment/escrow flow remains unchanged. | Business/browser suites verify allocation, retries, disabled behavior, and no escrow settlement. | **Production: false.** Not a payment method or production installment plan. |

## Adjacent controls

- `PROVIDER_CANCELLATION_LOCK_HOURS` configures the provisional review-window length; invalid values fall back to 48 hours. It is not a monetary penalty.
- `CRON_SECRET` authenticates the scheduled expiration/reminder endpoint. **Production: configured as a sensitive variable scoped to Production only.** Anonymous and invalid bearer requests both returned 401 after deployment.
- The repository declares one daily cron in `vercel.json`; the deployed Production config confirms it. A daily schedule is not a precise 24-hour notification guarantee; booking reads/actions also reconcile due requests.
- `DEMO_HANDSHAKE_ANYTIME` is an existing demonstration control for the simulated handshake and is not a Phase 2 monetary feature flag.

## Required release checks

1. Inspect the flag names and values by Vercel environment scope without displaying secret values.
2. Keep monetary loyalty rewards and simulated deposits off in Production.
3. Enable nonmonetary capabilities only after their database migration state, authorization, and production-mode behavior are verified.
4. After any flag change, verify both the enabled and disabled path and record the environment, deployed commit, and result.
