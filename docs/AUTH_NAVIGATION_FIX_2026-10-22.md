# Authentication navigation investigation — 22 October 2026

## Evidence and limits

The user reported landing-page login/sign-up navigation remaining on a skeleton, while direct/private login works. An anonymous live probe completed home in 4,671 ms, login in 348 ms, registration in 353 ms, and a clean-browser home-to-login navigation in 823 ms. The intermittent stuck state was not reproduced in that clean session. A stalled/stale client navigation is consistent with the user's observation, but its precise production trigger remains unconfirmed.

Code inspection confirmed an avoidable dependency: the catch-all route awaited the cached service-category database read for both login and registration before rendering either form. Categories are only required for provider registration.

The Vercel connector returned 403 for team `ralimations-projects` (`team_F2d6WNDSI9Z3SlPv5WUzHXW7`), preventing private deployment/log inspection and deployment through that connection. Its suggested team-authorization tool is not exposed in this session; a local authenticated Vercel CLI was not available. No production deployment or configuration change was made.

## Changes

- Authentication entry links in the header, landing provider CTA, footer and login/signup switch now use normal document navigation through `AuthLink`. This deliberately avoids reusing an unfinished App Router prefetch and gives authentication a fresh document/session check.
- Login and customer signup no longer await catalog categories. Session verification and existing login/registration authorization are unchanged.
- Provider registration fetches the existing public category list only when needed through `GET /api/auth/categories`. The form stays visible while loading. Failure/empty results show a retry action; an eight-second client timeout prevents indefinite loading. Provider submission stays disabled without valid categories; switching back to customer registration remains possible.
- TypeScript excludes generated `artifacts` and `tmp` directories. This removes the old Phase 1 compatibility copy from compilation and restores production-build verification.
- The authentication page now has a padded, bordered form card, a full-height rounded photo panel with a dark caption fade, and responsive spacing. Header navigation/actions use flexible sizing; the theme toggle is hidden on extra-narrow screens to keep signup and the menu inside the viewport.

## Verification

- `npm run typecheck`: passed.
- Targeted ESLint on changed application components, handler and regression script: passed.
- `npm run build`: passed, using an explicitly unreachable loopback database rather than production credentials.
- Production-mode viewport review at 320, 390, 768, 1024 and 1390 px found no horizontal page overflow after the final CSS adjustment. Desktop (1390 px) and mobile (390 px) card/header layouts were visually reviewed.
- `node --import tsx tests/auth-navigation.ts`: **6/6 checks passed** against the production build:
  1. Landing → login uses a document navigation with auth RSC requests blocked and database offline (913 ms).
  2. Customer signup displays without category requests (344 ms).
  3. Provider category failure is visible; customer mode remains usable.
  4. Provider category retry recovers from a simulated outage.
  5. Mobile landing → Get started opens signup (540 ms).
  6. A deliberately delayed provider category response times out with retry (~8.2 seconds).

Provider success/failure/delay responses were intercepted in these UI resilience tests; these are not end-to-end registration submissions. An offline catalog cannot provide marketplace content, but it no longer prevents anonymous authentication forms from rendering. Requests with session cookies still require the existing session lookup; no security checks were bypassed.

Evidence: `artifacts/live-auth/result.json`, `artifacts/auth-navigation/result.json`, `artifacts/auth-fix-build.log`, `artifacts/auth-fix-final-lint.log`. The temporary production test server was stopped by the regression script.

## Release status

**Implemented and verified locally; not deployed.** Grant the connected Vercel account access to the existing `ralimations-projects` team before inspecting the current deployment and releasing this patch. Recheck the deployed SHA, landing → login, landing → signup, and provider category retry on the actual production URL after release. Until then, opening `/login` or `/register` directly is the confirmed practical workaround for the affected client-navigation path.
