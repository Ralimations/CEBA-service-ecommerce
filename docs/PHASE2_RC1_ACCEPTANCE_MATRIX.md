# Phase 2 RC1 acceptance matrix

The automated rows below describe local verification only. Product-policy and operational decisions remain separate release gates.

| Area | Acceptance evidence | RC1 status |
|---|---|---|
| Isolated database safety | Runner verifies loopback host, exact test user/database, PostgreSQL identity, and empty schema; uses a disposable database | Passed: PostgreSQL 17.11, disposable container cleaned up |
| PostgreSQL migrations | Baseline and migrations 002–008 execute and migration semantics are checked | Passed |
| Booking lifecycle | Business suite covers deadlines, acceptance, expiry, cancellation, reservations, and idempotency | Passed: 35/35 business tests |
| Booking reminders | Visit-driven two-hour reminders and daily scheduled advance reminders are idempotent; scheduled notices target customer and pending providers; dates use PHT | Passed in business tests |
| Messages and reports | Bundle-item threads, participant isolation, input handling, report workflow, and audited moderation | Passed in the business and browser suites |
| Provider cancellation flag | Enabled UI/action behavior and disabled behavior use the same server-side configuration | Passed in enabled and disabled browser runs |
| Feature flags | Messaging, cancellation policy, loyalty, and simulated deposits tested with disabled server configuration | Passed: 1/1 separate disabled-mode test; enabled behavior covered in main suite |
| Responsive layout | Homepage and admin detail measured at 1440, 1024, 768, 430, 390, and 360 px; route audit checks overflow at the same widths | Passed: six viewport widths; no horizontal overflow |
| Theme/accessibility | Public/customer/provider/admin route families audited in light and dark with axe WCAG 2.2 A/AA, 2.1 A/AA, and 2.2 AA tags | Passed: 39 routes × two themes, 0 axe violations; manual AT review remains |
| Production hydration | Clean Playwright Chromium context, extension-disabled, production build; captures server/client caret styles, mutation evidence, console and page errors | Passed for `/`, `/browse`, `/login`: no errors, caret styles, mutations, or layout shift. Dev-only mismatch remains under investigation. |
| Performance | Production route HTTP timing and SQL query count/time samples using seeded isolated data | Captured 19 local samples (26–95 ms, 0–13 queries); synthetic only |
| CI evidence | Workflow runs `verify:release` and uploads `artifacts/` | Workflow changed; remote CI pending |
| Preview/staging | Dedicated database, secrets, migration order, cron plan and smoke verification | Not verified; release gate |
| Payments/rewards | No real payment; loyalty monetary reward flag remains false | Confirmed by configuration/scope; no financial activation |
| Production operations | No production data, migration, deploy, push, merge, or outbound message | Confirmed; none performed |
