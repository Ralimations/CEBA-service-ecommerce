# SoiréeSource performance optimization report

## Scope and method

This pass measured the existing production-shaped application, consolidated repeated PostgreSQL reads, added safe Next.js 16 caching, and re-ran functional checks. Query logging is opt-in (`DB_PERF=1`) and records normalized SQL shapes and timings without parameters or secrets. The route benchmark starts a fresh local production server for each sample and compares the first request with the next request.

## Measured results

The baseline and SQL-only runs used the same seeded routes and data. The baseline had no shared public cache. The SQL-only run used the consolidated queries with caching disabled for the comparison.

| Route | Baseline queries | SQL-only queries | Baseline cold ms | SQL-only cold ms |
|---|---:|---:|---:|---:|
| `/` | 54 | 8 | 13,192 | 2,451 |
| `/browse` | 26 | 3 | 5,850 | 1,492 |
| `/services/service-0-0` | 31 | 3 | 6,815 | 913 |
| `/providers/provider-0` | 34 | 5 | 7,559 | 1,651 |
| `/bundles` | 2 | 2 | 384 | 513 |
| `/dashboard` | 125 | 7 | 30,841 | 1,407 |
| `/provider` | 101 | 10 | 23,488 | 2,496 |
| `/admin` | 256 | 9 | 62,021 | 1,736 |
| `/bookings` | 64 | 5 | 15,489 | 1,394 |

The optimized cached production run showed the intended warm behavior: `/` fell from 6 queries/1,972 ms cold to 0/46 ms warm; service detail from 3/671 ms to 0/42 ms; bundle detail from 2/532 ms to 0/23 ms; and the public browse shell stayed at 0 queries on both samples after the cached shell was available. Date-filtered browse retained one live availability query on the warm request, and provider detail retained one live query for conservative availability correctness.

## Query and connection changes

- Replaced provider, service, bundle, and booking loops with set-based reads and JSON aggregation.
- Batched package, add-on, review, portfolio, bundle-item, booking-item, and availability reads.
- Combined dashboard scalar counts and reminder inserts.
- Added request-scoped React memoization for settings, provider, booking, dashboard, and current-user reads.
- Kept availability uncached across requests because reservations can change it.
- Added a bounded singleton Postgres.js pool (`POSTGRES_POOL_MAX`, default `5`) and Supabase TLS requirement. Transactions use a serialized client queue to avoid pooler pipelining races; outside transactions use a reserved client for the query lifetime.
- Existing indexes and EXPLAIN plans were reviewed. The optimized provider plan was about 1.2 ms and package/booking-item plans were below 0.1 ms in the audit sample, so no new indexes were justified by this dataset.

## Cache design and invalidation

Next.js 16 Cache Components are enabled. Public categories, provider summaries, services, service details, bundles, and provider public content use `use cache: remote` with explicit 30-second stale/revalidate and 60-second expiry windows. Cache tags cover the catalog, settings, categories, providers, services, and bundles. Successful mutations call `revalidateTag(tag, { expire: 0 })` and invalidate the relevant provider/service/bundle/category marketplace tags. Session state, dashboards, bookings, authorization, payments, escrow, notifications, and availability are never put in a shared cache.

The cache lifetime test observed 0 queries on a warm request and 3 queries after the short lifetime expired. The live regression test created disposable records, verified service/category/review/bundle invalidation and date blocking, then deactivated all test records in cleanup.

## Verification

- `npm test`: 23/23 isolated PostgreSQL business tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed on Next.js 16.3.8 with Cache Components and partial prerendering.
- Public and authenticated route smoke coverage passed (56 routes), including role redirects and CSRF origin checks.
- Desktop (1440 px) and mobile (390 px) navigation smoke tests passed, including header layout and registration terms acceptance.
- Supabase-backed cache regression passed for terms registration, ownership, reservation uniqueness, voucher/escrow/handshake behavior, reviews, bundles, moderation, and concurrent query parameter binding.

## Deployment notes

The Supabase pooler hostname is in `ap-northeast-2` (Seoul), while Vercel functions default to `iad1` unless the project is configured otherwise. The deployment should use the Vercel `icn1` region when account policy permits, and Fluid Compute should remain enabled for concurrent requests. The code keeps a global pool rather than creating a pool per invocation. See [Vercel regions](https://vercel.com/docs/regions), [Vercel connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions), [Vercel Runtime Cache](https://vercel.com/docs/caching/runtime-cache), and [Supabase Postgres.js guidance](https://supabase.com/docs/guides/database/postgres-js).

No Redis or other external cache was added. Remaining latency is dominated by cold regional network setup and live availability reads; those paths intentionally remain correctness-first. The deployment branch and commit status should be checked after pushing so the Vercel build corresponds to the merged commit.
