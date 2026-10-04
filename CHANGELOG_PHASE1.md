# Phase 1 changelog

## 2026-10-05 — Local functional MVP

- Created the Next.js/React/TypeScript application with a responsive marketplace, local photography, shared components, and separate customer, provider, and administrator workspaces.
- Added persistent SQLite storage, the initial schema migration, guarded reset and idempotent seed commands, and realistic fictional demonstration scenarios.
- Implemented registration, hashed passwords and sessions, role/ownership authorization, account suspension, input validation, and origin checks.
- Built service/package/add-on management, public provider profiles, portfolios, calendar availability, search/filter/sort discovery, and provider onboarding guidance.
- Implemented transactional individual and multi-provider booking workflows, supplier bundle terms and approvals, date reservations, price snapshots, status transitions, and participant timelines.
- Added clearly labelled simulated checkout, held escrow, proportional supplier earnings and fees, expiring one-use start/completion codes with QR display, dispute freeze, and audited administrator release/refund.
- Added eligible completed-booking reviews, derived ratings and loyalty ranks, configurable trust badges, welcome/seasonal/rank/referral vouchers, and completion-based referral rewards.
- Added simulated Classic/VIP subscriptions and scoped featured placements, with separate paid-visibility labels, expiry, and configurable benefits.
- Added notifications, visit-driven reminders, deterministic FAQ assistance, support-ticket replies, database-backed analytics, and the administrative management/settings/audit tools.
- Verified 21 domain tests, six browser journeys, and 53 development/production route checks. Fixed server-component serialization, accessible field associations, loopback origin handling, isolated browser-test storage, and Windows test-server cleanup found during verification.
- Documented setup, accounts, routes, architecture, reset behavior, product assumptions, test coverage, and explicit Phase 2 boundaries in README and the status report.
