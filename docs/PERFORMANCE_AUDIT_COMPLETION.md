# SoiréeSource performance audit — completion status

Date: 2026-10-22  
Status: **Local implementation committed; release verification remains incomplete**  
Branch: `perf/performance-audit-completion`  
Commit: `perf: complete local performance audit` (branch HEAD)

## Findings and changes

| Area | Finding | Change | Evidence / limit |
|---|---|---|---|
| Booking creation | A package booking read the package, service, and eligible package list separately; bundled requests also reloaded every published bundle and read each service per item. Selected add-ons were fetched one at a time. | Joined the selected package with its service/provider eligibility, scoped bundle lookup to the requested bundle, selected guest limits in the bundle-item query, and fetched chosen add-ons as a set. | Business tests pass 35/35. No production PostgreSQL `EXPLAIN ANALYZE` was possible in this run. |
| Notifications | A booking transition inserted an identical notification once per recipient; changed bundle terms and support-ticket creation did the same. | Added `notifyMany` to insert recipient notices with one parameterized set-based statement and used it for these fan-outs. | All 35 business tests pass, including reminder and message notification cases. |
| Booking messages | Each message formatted its timestamp with a newly allocated `Intl.DateTimeFormat`. Composer keystrokes shared state with the parent, forcing message-list reconciliation. | Reused one Manila formatter; memoized the history and moved draft/busy state to a memoized composer; added an opt-in Profiler marker. | Browser measurement was blocked by the local detail route remaining in “Loading messages…” despite API success in an earlier probe. Latest run captured zero list commits and no composer, so no typing-render reduction is claimed. |
| Message history | Large threads were fetched without a bound. | Retained the existing cursor-based, 50-message history and “Load earlier messages” path. | API/business coverage exists; browser E2E could not complete on the local PGlite socket. |
| Assets | Large JPEG/PNG copies and fixed-size images increased transfer weight; the favicon still referenced the 200 KB PNG. | Added responsive local WebP `srcset` assets and explicit 1200×800 dimensions, retained eager priority on hero images and lazy loading elsewhere, and switched the icon URL to WebP. | Homepage trace confirms WebP and responsive 960 px mobile hero. Existing asset conversion record: 1,268,593 JPEG bytes → 531,850 WebP bytes for the converted image set; logo 200,630 PNG bytes → 6,422 WebP bytes. |
| Render state | Filtering, sorting, and dashboard state remain mostly server-owned; no broad `memo`/`useMemo` sweep was justified by evidence. | Applied memoization only to the measured message-history/composer boundary and reused the date formatter. | React Profiler instrumentation is available via `?reactProfile=1`; the final browser trace could not exercise typing due to the message panel issue. |

## Synthetic browser sample

Captured with Chromium 156 against the disposable PGlite local-demo server, not production. Desktop was 1440×1000; mobile was 390×844 with 150 ms RTT, 1.6 Mbps download and 4× CPU throttling. The measurements are one sample per viewport, include the development server, and are not a controlled before/after comparison.

| Metric | Desktop | Throttled mobile |
|---|---:|---:|
| TTFB | 191 ms | 203 ms |
| LCP | 1,464 ms | 2,456 ms |
| CLS | 0.0000 | 0.0000 |
| INP | Not observed (no qualifying interaction) | Not observed (no qualifying interaction) |
| Initial JS transferred | 859,287 B | 859,287 B |
| JS source bytes covered by V8 precise coverage | 4,643,845 B | 4,316,058 B |
| Homepage image transfer | 307,162 B | 226,028 B |
| Homepage resource entries | 27 | 25 |
| Total network requests through login + booking detail | 50 | 32 |
| SQL statements through home + login + booking creation/detail | 34 | 34 |
| SQL elapsed time in that scenario | 858.8 ms | 716.09 ms |
| Booking message composer ready | No | No |

The 34-query count includes the homepage, authentication and booking creation/detail requests; it is not a homepage-only count. Development JS and SQL timings are not representative of production. Full captured values and request details are in [performance-audit-completion-fixed.json](../artifacts/performance-audit-completion-fixed.json). INP was not measured because the run produced no qualifying interaction. The final profiler record count was zero because the client message route did not hydrate in that run.

Prior optimized-route benchmark figures in [PERFORMANCE_OPTIMIZATION_REPORT.md](../PERFORMANCE_OPTIMIZATION_REPORT.md) are historical local production-mode results (for example, `/` 54→8 SQL queries in the earlier SQL-only comparison). They are not a baseline for this working tree, so no change percentage is asserted here.

## Database review and remaining scope

- The booking-creation and notification fan-out query loops identified in this pass are batched. Availability checks remain set-based and uncached for correctness.
- Existing indexes cover customer bookings, provider booking items, pending booking deadlines, user notifications, provider cancellation queues, and message thread/unread lookups. No new production indexes were added speculatively.
- The full review surfaced unbounded booking-list, review, published-bundle and some admin collections. They still need product-level cursor controls and matching query/caller changes; silently adding a cap would hide records, so those limits were not added in this pass.
- Several `SELECT *` statements remain in authentication, settings, domain row locks and model-returning queries where the full row is currently consumed. The aggregate marketplace SQL still contains broad model projections. Narrowing those safely needs per-caller field maps and is outstanding.
- Large fixture `EXPLAIN (ANALYZE, BUFFERS)` plans were not captured because the isolated PostgreSQL container could not start. Existing index definitions were inspected, but no index-benefit claim is made for this run.

## Verification

Passed locally after the final source edits:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` — 35/35 business tests, including the admin-release append-only audit assertion
- `npm run test:cache` — 2/2 cache-invalidation checks

The admin-release test failure was a test-client connection recovery defect after deliberate trigger errors. The database correctly wrote the booking event. The test now reconnects after each expected SQL failure and retains the original event/ledger assertions.

Not completed:

- `npm run verify:release` could not start its disposable PostgreSQL container: Docker Desktop’s daemon pipe was unavailable. This blocked migrations/business integration on real PostgreSQL, production browser probes, full Playwright, feature-disabled checks and the axe route scan.
- `test:browser-isolated` was attempted, but the PGlite socket returned PostgreSQL protocol errors (`bind message supplies ... parameters`) and connection resets during Playwright, before a reliable end-to-end result. Its database port is now configurable to avoid colliding with a user's local service.
- The message panel stayed on its loading state and did not expose the composer in the synthetic trace. This needs a working isolated PostgreSQL browser run before the messaging optimization can be considered verified.
- No controlled pre-change desktop/mobile trace or complete SQL plan set was available. No performance percentage is claimed.
- This work is committed locally on `perf/performance-audit-completion`. Do not merge this candidate until Docker-backed release verification and browser/accessibility suites pass.

## Hosting recommendation

The known deployment topology places Vercel Functions in `iad1` while Supabase Postgres is in Seoul (`ap-northeast-2`). Keep the current infrastructure unchanged for this audit. Benchmark otherwise-identical production routes and database queries from `iad1` and Vercel Seoul `icn1`, with warm/cold cache and p50/p95 latency separated, then compare error rates and connection reuse before proposing a regional move.

## Modified files

Source and tooling changes in the working tree:

`app/[[...path]]/page.tsx`, `app/api/actions/route.ts`, `app/api/messages/route.ts`, `app/api/quote/route.ts`, `app/globals.css`, `app/layout.tsx`, `components/action-form.tsx`, `components/cards.tsx`, `components/navigation.tsx`, `components/responsive-image.tsx`, `features/admin/bundles.tsx`, `features/bookings/handshake.tsx`, `features/bookings/messages.tsx`, `features/marketplace/booking-form.tsx`, `features/marketplace/pages.tsx`, `features/provider/pages.tsx`, `features/provider/services.tsx`, `eslint.config.mjs`, `package.json`, `server/bookings.ts`, `server/cache-invalidation.ts`, `server/db.ts`, `server/management.ts`, `server/messages.ts`, `server/public-data.ts`, `server/queries.ts`, `server/view-data.ts`, `tests/browser-isolated.ts`, `tests/business.test.ts`, `tests/cache-invalidation.test.ts`, `tests/local-demo.ts`, `tests/performance-audit-browser.ts`, `tests/serve.ts`, `tsconfig.json`, and `types/models.ts`.

Added responsive WebP assets: `public/soiree-source-logo.webp` and `public/images/{bar,catering,decor,event,hero,makeup,photography,venue}{,-640,-960,-1200}.webp` (32 image files).
