# Phase 2 RC2 deployment runbook

This runbook is for a later explicitly authorized staging deployment. No staging URL or cloud configuration was verified during RC2.

## Required access and evidence

Before staging, an operator must have read access to the Vercel project and Supabase organization, and staging-only write credentials. Verify and record (without secret values): Vercel project/repository IDs, production branch, Preview scopes, deployment protection, build settings, domains, hooks, and cron behavior; Supabase production and staging project refs, plan/cost/quota, PostgreSQL version, migration state, RLS/storage use, and backup/restore availability.

The staging project reference must differ from the verified production reference. Use a dedicated non-production project with synthetic data. Do not copy production data. Do not use the `.env.local` pooler until its project identity has been verified.

## Staging variables

Configure only the Vercel Preview scope or a protected staging environment:

- `POSTGRES_URL`: direct staging project endpoint `db.<staging-ref>.supabase.co`, with TLS and a staging-only DB password.
- `DATABASE_TARGET=staging`.
- `STAGING_SUPABASE_PROJECT_REF=<verified staging project ref>`.
- `PRODUCTION_SUPABASE_PROJECT_REF=<verified production project ref>`.
- `APP_ORIGIN`: exact protected Preview origin.
- `COOKIE_SECURE=true` for HTTPS.
- Explicitly reviewed Phase 2 flags from `PHASE2_STAKEHOLDER_DEMO.md`; keep monetary loyalty rewards off.
- `CRON_SECRET`: do not configure a Preview cron assumption. The repo schedule is intended for the later production release; verify platform behavior before any activation.

Never put production DB URLs or service-role keys in CI or Preview. Do not print secret values or place them in commits/artifacts. Add a deployment access gate before inviting stakeholders. Keep application role checks in force.

## Safe database preparation

1. Confirm the current branch and SHA; compare both project refs against the verified cloud project inventory.
2. Confirm `DATABASE_TARGET=staging` and that `POSTGRES_URL` host exactly matches `db.<STAGING_SUPABASE_PROJECT_REF>.supabase.co`.
3. The CLI now rejects missing target, pooler-only/unknown target, same staging and production refs, and mutations in Vercel Production. Run migration and seed only after this check passes and backup/restore is known.
4. Review `database/schema.postgres.sql` and migrations 002–008 against the empty staging project. Use `npm run db:migrate`, then `npm run db:seed` only on the isolated staging target. The seed skips if users already exist.
5. Capture migration state, test identity, and fixture count without recording credentials or real user data.

## CI and Preview

1. Run `npm ci` and `npm run verify:release` locally. The verification job has no cloud credentials and uses disposable PostgreSQL.
2. Review workflow changes and confirm remote branch protections and Vercel Git behavior. A push is allowed only once automatic Preview configuration is proven not to inherit production DB credentials or run unsafe migrations.
3. Push the development branch or open a draft PR only after that proof. Do not merge, use production deployment flags, promote, change the production branch, or assign the production domain.
4. Observe the actual GitHub Actions run and artifact bundle. Do not treat local pass as remote CI pass.
5. Confirm the Preview deployment SHA, access protection, runtime variables by names/scopes, and database identity before testing routes.

## Cloud validation

Use synthetic customer/provider/admin accounts created in staging. Verify public browse/search/theme/support; customer booking and notices; provider acceptance and messaging; admin review and authorization boundaries; flags on and off; cookies and dynamic routes; and health/error logs. Record environment, commit, role, route, expected/actual behavior, result, and redacted evidence. Do not send messages or notifications outside staging.

Test the cron handler directly on isolated data for missing/invalid/valid secret, expiration, idempotency, concurrent calls, duplicate-notice prevention, bounded pagination, and bundle cleanup. Preview must not be represented as a running Vercel Cron environment.

## Failure diagnosis

- `Database access is blocked...`: explicitly configure the correct target; never remove the check to make the build pass.
- Staging host/ref mismatch: verify the Supabase project reference and use its direct endpoint. Do not substitute a generic pooler host that cannot prove project identity.
- Migration failure: stop, retain logs, inspect applied migration state on staging, and restore staging from its known backup before retrying. Never replay against Production.
- Preview auth/DB errors: compare variable names and scopes, not secret values; inspect Vercel logs and project identity.
- CI failure: inspect the Actions summary/artifacts; retry only after the cause is understood. No secret is needed for ordinary verification.

## Production prerequisites and rollback

Production requires separately approved release authorization, stakeholder policy decisions, reviewed migration/backup/restore plan, protected CI, security/accessibility review, dependency findings, production flag matrix, cron activation decision, monitoring, named rollback owner, and a maintenance/incident plan. RC2 does not grant that authorization.

Rollback first disables the affected feature or reverts the application deployment while preserving audit and customer records. Do not delete reports, bookings, messages, or reminders as a rollback shortcut. Schema rollback must be separately reviewed and rehearsed against a restored copy. Never use a production reset, staging credentials, or force-push as rollback.
