# PostgreSQL production runtime hotfix — 2026-10-05

Production base: `8657890`. Work branch: `hotfix/postgres-production-runtime`.

## Errors reproduced

- Loading `/browse` locally against the configured Supabase project produced **`TypeError: value.toFixed is not a function`**, recorded in `.next/dev/logs/next-development.log`. `providers()` returned `AVG(integer)` as PostgreSQL numeric / a JavaScript string; `Rating` called `toFixed` on it. An HTTP 200 alone did not prove success because Next.js streamed the rendering error.
- The original uncast subscription query reproduced **SQLSTATE 42883: `operator does not exist: text <= timestamp with time zone`**. The current adapter hid it by rewriting `CURRENT_TIMESTAMP` to text. That introduced incorrect lexical comparisons between ISO strings and PostgreSQL's formatted timestamp text, including same-day activation/expiry errors.
- The original booking-list query reproduced **SQLSTATE 42P10: `for SELECT DISTINCT, ORDER BY expressions must appear in select list`**.
- The production-mode admin dashboard reproduced **SQLSTATE 42601: `syntax error at or near "month"`** in the monthly booking totals query. Its alias is now explicitly quoted and grouping/ordering use the selected expression's position.

## Changes and SQL audit

| File | Change |
| --- | --- |
| `server/db.ts` | Remove the global `CURRENT_TIMESTAMP::text` rewrite. Keep Postgres.js and parameter binding. |
| `server/queries.ts` | Cast average rating to `double precision`; compare subscription/placement boundaries as `timestamptz`; include the timestamp sort expression in the distinct booking selection; cast customer totals/counts to JS numeric types. |
| `server/auth.ts` | Cast session expiry and login throttle timestamps; parse throttle expiry in JS; qualify existing-row columns in the login-attempt upsert. |
| `server/bookings.ts` | Parse handshake expiry in JS and cast the conditional SQL expiry comparison. |
| `server/reminders.ts` | Cast promotion expiry bounds. |
| `server/vouchers.ts` | Parse validity/expiry; cast aggregate counts, including zero paid bookings so the string `"0"` cannot falsely reject a welcome voucher. |
| `server/management.ts` | Cast portfolio count. |
| `app/layout.tsx` | Cast unread notification count. |
| `features/account/pages.tsx` | Cast voucher expiry and redemption counts. |
| `features/admin/pages.tsx` | Cast placement times and monthly aggregates; fix the reserved monthly alias. Existing single-value aggregates already use `Number(...)` via `scalar()`. |
| `features/admin/operations.tsx`, `features/provider/pages.tsx` | Compare parsed timestamp values for status labels; cast provider dashboard counts. |
| `tests/postgres-audit.ts` | Read-only metadata, timestamp castability, flag-type and original-error diagnostics. |
| `tests/runtime-smoke.ts` | Browser and DB assertions with unique test identities, explicit API rejection tests, and one unpaid booking per full run. |
| `README.md` | Document safe smoke commands and correct the old claim that the fixture browser suite creates an isolated DB. |

The database audit inspected **32 date/time columns** through `information_schema`. All were `TEXT` except `users.terms_accepted_at`, which was already `TIMESTAMPTZ`. No audited columns were `DATE` or plain `TIMESTAMP`. Every non-null stored timestamp successfully cast to `timestamptz`; every event/availability/reservation date successfully cast to `date`. No schema conversion or data rewrite was performed.

`created_at`, `starts_at`, `expires_at`, `valid_from`, `reset_at`, `used_at`, `responded_at`, `rewarded_at`, and `read_at` remain stored strings. Canonical `YYYY-MM-DD` event-day strings remain unchanged. Null checks for consent/used/read/responded/rewarded fields do not need casts.

`active`, `moderated`, and stored review ratings are PostgreSQL `integer`; bundle `package_active` and `category_active` are aliases of integer columns. `vip` and `featured` remain numeric `CASE` results. Average ratings, counts, and money aggregates now match their TypeScript numeric consumers; no `any` or global numeric coercion was introduced.

Runtime search found no `strftime(`, `rowid`, `PRAGMA`, `INSERT OR IGNORE`, `COLLATE NOCASE`, `BEGIN IMMEDIATE`, `node:sqlite`, or `DatabaseSync`. The old unused `database/schema.sql` remains a historical SQLite schema. All runtime `CURRENT_TIMESTAMP` comparisons now cast the stored timestamp side. No runtime `CURRENT_DATE` or SQL `NOW()` comparisons were found.

## Validation

- Initial local reproduction used the existing development server on port 3000 and `.env.local` without printing credentials.
- Development browser public-page checks passed: `/`, `/browse`, rating/price sorting, `/services/service-0-0`, `/providers/provider-0`, `/bundles`, `/bundles/bundle-wedding`, `/register`, `/login`, `/terms`.
- Production build tested on port 3200, connected to the same Supabase database. Browser checks inspect rendered content and uncaught page errors, not just HTTP status.
- Full production smoke run: **passed**. All 11 public routes/variants above rendered without an error boundary or uncaught page error. Both customer and provider registered through the browser, with unchecked consent rejected by browser validation and missing/false consent rejected by the API. Both saved `terms_accepted_at` and version `2026-10-05` in Supabase. Both logged out, had their old session invalidated, rejected wrong-password attempts, logged back in, and retained their session across navigation/reload.
- Customer, newly registered provider, seeded provider, and seeded admin dashboards all passed. The admin monthly totals fix was tested in the rebuilt production server.
- The browser selected a real package and created booking `703b9cf1-9e83-4a28-957d-7ddc38913310`. The customer and seeded provider both opened it; the provider booking list linked to it. Supabase confirmed `PENDING` and `UNPAID`. The welcome-voucher quote also succeeded with the unpaid booking present, exercising the numeric-zero aggregate fix.
- Final smoke identity marker: `71de36fb-bd5f-4ad5-9a52-dfc0d8041a0f`. Earlier diagnostic runs also left uniquely marked test accounts and one additional unpaid booking; no records were deleted.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed, including the admin SQL fix.
- Full fixed-fixture integration suite intentionally not run against the shared project.

## Operational limits

No records were deleted or reset, and no existing account details were changed. Smoke-test accounts and explicitly marked pending/unpaid bookings remain in the shared project. Registration and booking notification writes are expected. No real or simulated payment was submitted.

The old public URL `https://ceba-service-ecommerce.vercel.app/browse` returned Vercel's deployment-not-found response. GitHub identified an existing successful production deployment, but its generated URL redirected to Vercel SSO. Production deployment status and public accessibility must be distinguished from the passing local production-build checks.

Text timestamps remain a compatibility choice. Future malformed timestamp writes can fail explicit casts; new application writes use ISO timestamps. Fixture isolation and the existing repeated-query performance cost remain outside this hotfix.
