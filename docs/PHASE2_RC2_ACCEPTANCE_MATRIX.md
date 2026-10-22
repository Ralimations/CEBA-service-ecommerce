# Phase 2 RC2 acceptance matrix

This is a historical RC2 acceptance checkpoint. “Pending” is not a pass. The completed conditional Phase 2 Production release supersedes these pre-release environment statuses; see `PHASE2_FINAL_DEPLOYMENT_REPORT.md`.

| Acceptance criterion | Evidence | Status | Environment | Remaining risk |
|---|---|---|---|---|
| Preserve working branch and user reference files | Local branch `phase2a/meeting-two-feedback`; Emerald pack and ZIP remain untracked | Pass | Local | Remote tracking ref may be stale |
| Audit GitHub/Vercel/Supabase before deploying | [`RC2_INFRASTRUCTURE_AUDIT.md`](RC2_INFRASTRUCTURE_AUDIT.md); GitHub connector, repo metadata, local `.vercel/repo.json` and env key names inspected | Partial | Local + GitHub metadata | Vercel/Supabase project settings and secret scopes unavailable |
| Prevent unverified DB mutations | `database/target-guard.ts`; 4 target-guard tests pass | Pass (unit checks) | Local | Full Docker-backed RC2 release verification remains blocked |
| Prove staging DB is separate from Production | No verified cloud project ref or staging credentials | Fail / blocked | None | Must inspect both projects and confirm distinct refs |
| CI uses isolated database and no cloud secrets | Workflow config has read-only contents, disposable test DB, no deployment secrets | Pass (definition) | Local config | Remote Actions not observed |
| Remote Actions run is green | GitHub cannot identify local `a730716`; no matching status available | Pending | Remote | Push/PR blocked until Preview side effects are audited |
| Vercel Preview is isolated and protected | No account settings or deployment evidence | Pending / blocked | None | Verify Preview variables, protection, hooks, build-time migration behavior |
| Staging migrations/fixtures pass | Not run; target is unverified | Pending | None | Need isolated staging DB and backup evidence |
| Hosted journeys and authorization pass | No Preview URL or synthetic hosted accounts | Pending | None | Exercise role matrix on protected Preview |
| Hosted accessibility/screenshots/runtime diagnostics pass | No Preview URL or cloud artifacts | Pending | None | Capture protected staging artifacts and review manually |
| Scheduled handler is authenticated/idempotent | Existing local RC1 suite documents only prior coverage; RC2 has not rerun expanded handler checks | Pending | Local/cloud | Verify cron handler matrix on isolated test DB; cron remains inactive |
| Feature flags have safe staged settings | `.env.example` defaults all provisional flags off; monetary loyalty off | Partial | Local config | Preview and Production scopes unknown |
| Production remains unchanged | No production connection or change; no push, deployment, migration, cron activation, or domain/variable change | Pass | Production boundary | Cloud settings could not be read |
| RC2 local verification passes | `npm run verify:release` passed: typecheck, lint, 4 target-guard tests, migration semantics 002–008, 35 PostgreSQL business tests, production build/probes, 13 Playwright tests, 1 feature-disabled check and axe 0 violations over 39 routes in 2 themes | Pass | Local disposable PostgreSQL | Remote CI and cloud Preview evidence remain separate pending gates |
| Stakeholder demo package is ready | [`PHASE2_STAKEHOLDER_DEMO.md`](PHASE2_STAKEHOLDER_DEMO.md) | Pass (script only) | Documentation | Protected Preview and accounts pending |
| Production release approved | Project owner authorized a conditional merge; no separate stakeholder meeting is required | Authorized, conditional | Governance | Production migration/merge still require verified identity, successful backup/restore, and exact-commit CI |

## Final PDF compliance update (2026-10-14)

| Acceptance criterion | Evidence | Status | Environment | Remaining risk |
|---|---|---|---|---|
| All PDF concerns audited | `FINAL_PDF_COMPLIANCE_AUDIT.md` covers pages 1–10, including concerns, feature proposals, contradictory photo evidence, optional competitor research, tests, and limitations | Pass | Local code/docs | Hosted evidence remains separate |
| Service Fee wording | Updated seed terms and customer booking flow assertion; existing fee math unchanged | Pass | Local disposable PostgreSQL/browser | Production rendering unknown |
| Loyalty proposal simulation | Monetary flag-gated preview and exact-value tests; no DOB collection, reward issuance, or checkout effect | Pass | Local enabled/disabled test modes | Production flag values unknown; keep off |
| PDF visual direction | Emerald light/dark, responsive route/screenshots, dashboard and message screenshots reviewed | Pass with documented limits | Local screenshot artifacts | Manual assistive technology and Production review remain |
| Production identity and schema | Local project metadata conflicts with brief names; Supabase endpoint ref/schema/history cannot be proven | Blocked | None | Need authenticated project inventory and read-only production inspection |
| Verified backup and restore | Not generated; no isolated restore drill | Blocked | None | Mandatory stop condition: no production DDL or merge |
| Remote synchronization/CI | Cached local feature ref equals starting tip; live Git fetch unavailable | Pending | Local refs only | Do not claim remote commit/run status |
| Production deployment/smoke | Vercel settings unavailable; URL in PDF not accessible with available browser tools | Pending | None | No deployment, flag, cron, or production health claim |

The exact final `npm run verify:release` result and subsequent Production outcome are recorded in `PHASE2_FINAL_DEPLOYMENT_REPORT.md`. The statement above is historical RC2 status, before final migration and deployment.
