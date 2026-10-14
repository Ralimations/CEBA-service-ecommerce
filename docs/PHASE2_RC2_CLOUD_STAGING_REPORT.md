# SoiréeSource Phase 2 RC2 cloud staging report

Audit and implementation date: 2026-10-14. RC2 work is local-only until the hosting and database isolation gates below are verified.

## Starting state

- Branch `phase2a/meeting-two-feedback`, local HEAD `a730716`; tracked remote ref `a2eb1ba` is two commits behind local and could not be refreshed because GitHub was unreachable by Git transport.
- The untracked Emerald design reference pack and ZIP were preserved.
- RC1's recorded baseline was 35 business tests, 13 Playwright tests, one feature-disabled browser check, migrations 002–008, axe across 39 routes in light/dark modes, production build/probes, and synthetic performance samples. Those remain RC1 evidence, not RC2 results.

Primary RC2 local commits: `a999196` (database target safeguards and isolated CI workflow) and `615bd46` (staging audit, runbook, acceptance, and demo documents). The branch remains `phase2a/meeting-two-feedback`; its remote-tracking ref could not be refreshed, so the reported ahead count is stale. Only the untracked Emerald pack and ZIP remain in the working tree. Nothing was pushed.

## Hosting and database audit

See [the infrastructure audit](RC2_INFRASTRUCTURE_AUDIT.md). A local Vercel repo link exists, but remote settings could not be inspected. `.env.local` exposes only a Supabase pooler endpoint identity (region, port, database path), not a project reference. Because staging and production identity cannot be compared, the endpoint is considered unsafe for writes and Preview use. No hosted database operation was attempted.

## Changes delivered locally

- Added fail-closed database target validation for runtime access outside Vercel Production, migrations, and seeding. Local targets must be loopback. Staging requires a direct `db.<staging-ref>.supabase.co` endpoint, valid and distinct staging/production project references, and `DATABASE_TARGET=staging`. Production runtime remains the only production-DB runtime path; migration and seed commands reject production.
- Added unit coverage for local, staging, isolated-test, and production-target decisions and included it in release verification.
- Tightened Supabase TLS detection to cover `.supabase.com` and `.supabase.co` hostnames.
- Added workflow concurrency, manual verification dispatch, and failure artifact collection. The workflow remains read-only and uses only isolated PostgreSQL fixtures.
- Updated the `.env.example` with explicit target and project-reference fields.

## Local verification results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `node --import tsx --test tests/database-target.test.ts`: 4 passed, 0 failed.
- `npm test`: 35 passed, 0 failed on the isolated PGlite harness.
- `npm run build`: passed on Next.js 16.3.8.
- `npm run verify:release`: **passed** against an auto-removed local PostgreSQL 17.11 container. TypeScript, ESLint, guard checks, migration semantics 002–008, and all 35 business tests passed; no tests connected to the Supabase pooler.
- Production build passed. Production browser probe sampled 19 route/role variants at 24–80 ms and 0–13 SQL queries, with zero console/page errors. These are local synthetic timings, not hosted performance claims.
- Playwright: **13 passed, 0 failed, 0 skipped**. The feature-disabled browser/API check passed **1/1**. axe found **0 violations across 39 routes in light and dark themes**. Development browser logged the previously observed external `caret-color` injection/hydration warning; the production browser probe reported no hydration error.
- An earlier optional PGlite-only browser-harness attempt had socket resets; the supported Docker-backed release runner completed cleanly and supersedes that attempt for local release evidence.

## Staging and Preview

Status: **blocked / not deployed**. No isolated non-production Supabase project, free quota, price, Preview-scoped environment, deployment protection, or migration ownership was verifiable. There is no Vercel CLI in this environment. No Preview URL, synthetic hosted account, screenshot, runtime log, or cloud E2E evidence exists.

## CI

RC2 workflow definition is local and not pushed. The existing remote development-branch workflow copy still runs `verify:phase2`, with no artifact upload. The GitHub connector did not provide branch-protection/secrets settings or a current run for local commit `a730716`; Git transport was unavailable. Remote CI status is **pending**, not green.

The workflow grants `contents: read`, has no cloud secrets, and runs the test harness against disposable PostgreSQL. It does not run migrations or seeding against Supabase. `npm run verify:release` validates TypeScript, lint, migration semantics, PostgreSQL business tests, production build, browser checks, and feature-disabled behavior.

## Runtime, cron, feature flags, and security

- No runtime cloud/database health check or deployed route was executed.
- The repository declares a daily cron at `0 0 * * *`; deployment status and `CRON_SECRET` are unknown. It was not activated or changed.
- The five flags in `.env.example` are server-side. The shipped defaults remain off; monetary loyalty stays off. Preview and Production values were not visible. See the demo decision sheet for a safe staging configuration proposal.
- No real payments, payouts, SMS/email delivery, or external notifications were triggered. Production data/configuration was not read through the database and was not changed.
- `npm audit --package-lock-only` was attempted for RC2 but the npm registry audit endpoint failed in this restricted-network environment. No dependency changes were made; the advisory audit remains unverified.

## Performance and visual checks

No cloud benchmark or deployed visual capture was possible. RC1's local synthetic performance and accessibility observations are historical local evidence only. No performance, browser-compatibility, or availability claim is made for a cloud environment.

## Release readiness

- Local candidate: full Docker-backed release verification **passes**. Remote CI and cloud staging remain pending/blocked.
- Remote CI: pending a safe push/PR after deployment-trigger audit.
- Staging: blocked on verified isolated database and Vercel environment scopes.
- Stakeholder demo: walkthrough prepared; hosted access and synthetic accounts pending.
- Production: **blocked / not released**. This RC2 snapshot predates the final owner instruction, which conditionally authorizes the merge and requires no separate stakeholder meeting. The later instruction's verified-backup-and-restore stop condition remains unmet, so no production change or merge is permitted under that brief.

The exact blockers and next steps are listed in [the RC2 deployment runbook](PHASE2_RC2_DEPLOYMENT_RUNBOOK.md) and [acceptance matrix](PHASE2_RC2_ACCEPTANCE_MATRIX.md).

## Final compliance/release sprint update (2026-10-14)

- The project owner has now authorized a conditional Phase 2 merge. No separate stakeholder meeting is required; prior wording that Production was not authorized is superseded on the governance point only.
- The local feature branch and cached `origin/phase2a/meeting-two-feedback` were at `fa32797`; cached `origin/main` was `ce56e4d`, 17 commits behind. A read-only dry-run fetch failed to connect to GitHub (`github.com:443`), so these refs were not verified live.
- Local Vercel repo metadata identifies `ceba-service-ecommerce`; the current brief says `soiree-source`, and the PDF screenshot shows `soireesource.vercel.app`. The Supabase pooler endpoint does not reveal a project reference. Exact deployment/database identity remains unverified.
- No Production schema read, migration-history query, backup, restore, push, merge, deployment, feature-flag change, cron activation, or production smoke test occurred.
- The release brief requires a verified production backup restored in isolation before migration or merge. Since that cannot be completed here, production-changing steps stop at this gate.
- Full PDF audit, updated flag matrix, final release report, and rollback runbook are available in the `docs/` directory. Local final `npm run verify:release` evidence is in `PHASE2_PRODUCTION_RELEASE_REPORT.md`.
