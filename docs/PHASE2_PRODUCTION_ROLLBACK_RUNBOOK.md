# Phase 2 production rollback and recovery runbook

**State at 2026-10-14:** No Phase 2 push, merge, deployment, Production migration, flag change, or production data operation was performed. The production project and prior deployed commit remain unverified. No production backup or restore drill exists.

This runbook is a controlled future procedure. It does not authorize destructive production actions. Do not execute rollback SQL based only on migration filenames.

## Release prerequisites

Before the first Production migration or merge:

1. From the authenticated Vercel and Supabase consoles, verify the exact project IDs/references, connected repository, Production branch, domains, Preview and Production variable names/scopes, deployment hooks, and cron behavior. Record identifiers only; never copy secret values into this repository.
2. Verify the Supabase production project reference against the intended project inventory. Resolve the mismatch between the project names in the release brief and local Vercel metadata. Do not use the unidentified pooler endpoint.
3. Read the Production schema and migration ledger. Identify genuinely pending changes, existing tables/columns/indexes, data volume, database roles/permissions, lock duration, and compatibility with the live Phase 1 application.
4. Create a consistent protected full backup outside Git and build artifacts. Record its project reference, timestamp, size/checksum, and encrypted storage location in the protected release record; do not put customer records or backup content in logs.
5. Validate backup integrity and restore it into isolated local PostgreSQL. Confirm schema and record-count invariants without exposing personal data. Apply only the truly pending additive migrations to the restored copy, run regression tests, and rehearse the documented application rollback. A backup file that has not been restored is not a verified recovery path.
6. If any identity, backup, restore, compatibility, or rollback check fails, stop before Production DDL, push, merge, or deployment.

## Application rollback

1. Stop promotion and further rollout. Capture the current deployed SHA, deployment ID, timestamps, and redacted error summaries.
2. Use the existing Vercel project's deployment history to redeploy/promote the prior known-good Production deployment. Confirm the repository and project match before selecting it. Do not infer the deployed SHA from `main` or `.vercel/repo.json`.
3. Re-run non-destructive homepage, browse, authentication, dashboard, booking-read, messaging-read, and database-connectivity checks. Do not create bookings or run simulated financial transitions on real customer records.
4. Disable only affected optional features by changing their verified Production environment flags, then redeploy if required by the platform. Preserve messages, reports, cancellation review history, notices, bookings, and audit records.
5. Inspect Vercel runtime logs and PostgreSQL health. Keep the incident open until error rates, auth, booking reads, and query behavior are stable.

An application rollback restores code only. It does not reverse database DDL or data written by the new application.

## Database recovery

- Treat Phase 2 schema changes as additive and forward-compatible. Do not drop new tables/columns or run destructive “down” scripts during an application rollback.
- If the live schema has a compatibility issue, stop rollout and use the tested forward fix or a reviewed repair against a restored copy. Preserve all customer-created rows and append-only history.
- Restore Production from backup only if the incident owner and database operator have verified that restore is necessary, its recovery point is acceptable, and the exact target is the verified Production project. Account for writes since the backup; never restore a backup over a live database as a first diagnostic step.
- After recovery, compare schema/migration state and non-sensitive record counts, verify Phase 1 flows, and record recovery point/time and any replayed work.
- Never reset the Production project, delete user records to clear a migration, or assume a code rollback reverses migrations.

## Flag-specific response

| Feature | Immediate reversible control | Data handling |
|---|---|---|
| Booking messaging | Set `FEATURE_BOOKING_MESSAGING=false`, then redeploy if needed. | Keep messages, read state, reports, and admin decisions. |
| Provider cancellation policy | Set `FEATURE_PROVIDER_CANCELLATION_POLICY=false`, then redeploy if needed. | Keep cancellation requests, reason text, decisions, and audit events; do not rewrite deadlines or history. |
| Loyalty beta | Set `FEATURE_LOYALTY_BETA=false`, then redeploy if needed. | Keep nonredeemable XP rows. |
| Monetary loyalty preview | Set `FEATURE_LOYALTY_MONETARY_REWARDS=false`. | No monetary ledger exists in this preview. Keep any existing vouchers governed by their existing terms. |
| Simulated deposits | Set `FEATURE_SIMULATED_DEPOSITS=false`, then redeploy if needed. | Preserve the prototype ledger for audit; it does not alter escrow. |

Do not disable core Phase 1 booking/payment behavior as a workaround for a Phase 2-only issue without verifying the effect on active bookings.

## Recovery ownership and evidence

The Production change owner, database operator, incident contact, actual prior healthy deployment, and protected backup location were not available during this sprint. Assign those roles and record the verified deployment SHA, backup/restore evidence, exact migration set, feature flag matrix, smoke results, and rollback decision in a restricted release record before a future production change.
