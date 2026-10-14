# SoiréeSource Phase 2 Release Candidate 1

Date: 2026-10-13
Branch: `phase2a/meeting-two-feedback`
Commit at start: `16aa792`
Release status: **Locally verified candidate; stakeholder and staging gates remain**

## Scope delivered in this candidate

- Adds a daily protected reminder worker for pending booking deadlines. It creates idempotent in-app notices for the customer and providers whose booking items are still pending, with Philippine-time dates. The worker processes at most 100 bookings per run and checks 26 hours ahead to tolerate daily schedule drift. It does not promise two-hour or push delivery.
- Keeps the existing visit-driven two-hour reminder. Both paths share stable notification IDs, so a reminder already created through a visit is not duplicated by the scheduled worker.
- Uses one server-side provider-cancellation-policy flag helper in the booking UI and action boundary.
- Adds a WCAG 2.2 AA axe scan over public, customer, provider, and admin routes in light and dark themes, with six viewport overflow checks and selected dark screenshots.
- Adds `verify:release`: the isolated Phase 2 checks plus a clean production-browser probe, route performance/query sampling, and a separate browser/API check with provisional feature flags disabled.
- Updates CI to run `verify:release` and upload `artifacts/` even when verification fails.

## Verification evidence

Final results are filled after both requested commands finish. Evidence files are local and ignored by Git.

| Check | Result | Evidence |
|---|---|---|
| `npm run verify:phase2` | Passed | Disposable PostgreSQL 17.11; see `artifacts/phase2-verification.json` and `.log` |
| `npm run verify:release` | Passed | Same verification files plus production, axe, and performance JSON |
| TypeScript and ESLint | Passed | Route type generation, `tsc --noEmit`, `eslint .` |
| Migration/business suite | Passed | Migrations 002–008; 35/35 PostgreSQL business tests; no skipped/todo tests |
| Playwright | Passed | 13/13 browser cases and 1/1 separate feature-disabled browser/API case |
| Axe WCAG 2.2 AA | Passed with 0 violations | 39 public/customer/provider/admin routes, light and dark; `artifacts/axe-wcag22aa.json` |
| Production browser probe | Passed | Chromium 155, extensions disabled; no console/page errors, no server caret styles, mutations, or layout shift on `/`, `/browse`, `/login`; see JSON and screenshot |
| Performance/query sampling | Captured | 19 local route samples; total response time 26–95 ms, DB query count 0–13; see `artifacts/perf-rc1.json` and `artifacts/perf-queries.jsonl` |
| Remote CI / preview deployment | Not run | No remote CI or staging credentials/action used |

## Security, payment, and rollout boundaries

- Verification uses a disposable local PostgreSQL database and seeded demo accounts. No production or shared database was contacted.
- No production migration, deployment, push, merge, email, real payment, or monetary loyalty reward was performed.
- Loyalty monetary rewards remain disabled. Simulated deposit behavior remains a prototype and does not create a payment or escrow movement.
- The Vercel cron declaration is daily; the worker is protected by `CRON_SECRET`. Actual Vercel configuration, plan capability, secret presence, and preview DB isolation remain unverified until an authorized staging review.

## Known decisions and limitations

- The 24-hour response window, whole-bundle expiration behavior, cancellation reason categories, and near-event cancellation policy remain provisional and require stakeholder approval.
- The 26-hour scheduled notice is an advance in-app notice, not an exact-time reminder guarantee. Scheduling and feature-flag choices must be reviewed before a real deployment.
- Messaging report categories, privacy notice, moderation SLA, retention, and deletion process still need an owner and approval.
- The axe scan reports no violations for the audited routes and themes. It is not a substitute for keyboard and assistive-technology review.
- Development mode still emits a hydration mismatch involving client-only `caret-color: transparent` on inputs. The production probe finds no such server style, client mutation, console error, or page error on its three sampled public routes. The source of the development warning remains unknown.
- Production performance numbers are local synthetic measurements and should not be represented as production capacity or SLO evidence.
- `npm audit` could not reach the registry audit endpoint in this environment, so dependency advisory status was not verified.

## Final review disposition

Local verification is complete. The code is ready for local review; it is **not a deployment approval**. Stakeholder decisions, isolated preview configuration, remote CI, migration review against an existing-data copy, manual accessibility review, and staging smoke review remain release gates.
