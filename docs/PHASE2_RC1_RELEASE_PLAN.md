# Phase 2 RC1 release plan

RC1 passed local verification. This plan records the sequence required before any staging or production change.

## 1. Review candidate

1. Review the local commit and RC1 report, acceptance matrix, screenshots, axe output, production probe, and performance samples. Automated local checks have passed; review the remaining gates below.
2. Resolve any failed verification or accessibility findings. Review keyboard access and representative assistive-technology flows in addition to axe.
3. Obtain product decisions for response expiry, cancellation reasons/near-event handling, messaging reports and retention, and the Emerald visual identity.

## 2. Prepare isolated preview

1. Create/confirm a dedicated preview database and verify its credentials, migration ownership, and reset process. Do not reuse production or shared Supabase data for verification.
2. Confirm the preview runtime, cron support/cadence, `CRON_SECRET`, and environment-specific application origin.
3. Keep provisional feature flags off until the corresponding policy and operating owner are approved. Keep monetary loyalty rewards off.
4. Back up the preview database and confirm restore access before migrations.

## 3. Stage and verify

1. Apply the reviewed baseline/migration sequence 002–008 to the isolated preview using the approved migration operator.
2. Run remote CI and retain its artifacts. This local sprint did not execute remote CI.
3. Deploy to preview only after the preview configuration and migrations are reviewed.
4. Smoke-test public discovery, customer booking, provider acceptance, messaging/reporting, admin review, cancellation moderation, reminder authorization, and feature-disabled paths with demo accounts.
5. Inspect error logs, cron response, and database health. Confirm no PII or test fixtures appear outside the isolated preview.

## 4. Production change gate

Production requires separate explicit authorization, an approved change record, backup/restore confirmation, named rollback owner, reviewed migration diff, monitored rollout, and product/legal/finance approval for any policy that affects bookings or money. The current sprint did not deploy, push, merge, or migrate production.

## Rollback

Prefer application rollback/feature-flag disablement while retaining additive records and audit history. Do not delete message reports, moderation records, reminders, or customer submissions as a rollback shortcut. If schema rollback is needed, design and review it separately against a restored copy first.
