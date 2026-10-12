# Repository-backed timeline

Last reviewed: 6 October 2026 (Asia/Manila)

This timeline is based on the Git history of [`main`](https://github.com/Ralimations/CEBA-service-ecommerce). The available repository history begins on 5 October 2026 with a complete Phase 1 codebase and its test suite, so that date should not be presented as the start of all design and development work. It is the first point supported by the current Git record.

## 5 October 2026 — Phase 1 enters the repository

Commit [`7316e05`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/7316e050ce53f6c56180b1c153a8be982e9584d2) records the initial Phase 1 application and end-to-end coverage.

The commit contains the public marketplace, customer/provider/administrator workspaces, shared UI, the original SQLite schema and seed data, authentication and authorization, booking and bundle workflows, vouchers, simulated payments and escrow, verification handshakes, reviews, subscriptions, promotions, notifications, support, tests, and project documentation.

Evidence at this milestone:

- Next.js App Router application with responsive public and authenticated routes;
- three distinct role-based workspaces;
- transactional booking and date-reservation behavior;
- a seeded fictional marketplace for repeatable demos;
- domain, smoke, and Playwright test coverage; and
- explicit Phase 1/Phase 2 scope documentation.

## 5 October 2026 — SQLite-to-Supabase migration

The migration is recorded across four commits:

- [`98c2eb5`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/98c2eb51c6a30f6c307618a5689a72070e2b4f8e) — prepares asynchronous query handling throughout the application;
- [`a76c987`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/a76c987e528a2c27bcbecf9b0b5570764734748c) — replaces the SQLite database adapter with PostgreSQL/Postgres.js behavior;
- [`4dea8b4`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/4dea8b4419cc9a64f46288a90f4fc7bc6e75e9d8) — adds the Supabase PostgreSQL schema, connection setup, terms acceptance, and SoiréeSource assets; and
- [`8657890`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/8657890787a4139e761fa59a81aa331ac3531b4a) — merges the migration and brand work.

This phase moved persistence from a local-only implementation to a cloud-hosted relational database while keeping parameterized access, transactions, constraints, and the established marketplace rules.

## 5 October 2026 — production-shaped PostgreSQL hardening

Commit [`88b336a`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/88b336a986f8690987b4a0eaf9ac715bf9f2b8a8) fixes runtime differences uncovered against the configured Supabase project. Commit [`c72cc60`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/c72cc602f935847c0bd398f8d7af7674c2801081) records the verified merge.

The work corrected numeric aggregate types, explicit timestamp comparisons, a PostgreSQL `DISTINCT`/`ORDER BY` incompatibility, a reserved administrator-dashboard alias, and voucher logic affected by a string-valued zero. It also added PostgreSQL metadata auditing and full runtime smoke coverage.

The accompanying report records successful public routes, customer/provider registration, terms persistence, login/logout and session invalidation, role dashboards, booking creation, voucher behavior, type checking, linting, and a production build.

## 5 October 2026 — brand consistency and visual polish

- [`0d22351`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/0d223514aad953b00314627446c937fa7bec7959) straightens the header logo badge.
- [`1856c23`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/1856c23cf6e668cf0cea5ccb7f69cd71a8e76ad6) applies the treatment consistently and removes the outline.
- [`6217039`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/6217039204aa3d1fe900ba8f2319e835479368a1) standardizes the product name as “SoiréeSource” across code and documentation.

These small commits matter to the case study because they show the move from functional implementation into a coherent client-facing product identity.

## 6 October 2026 — PostgreSQL query and caching optimization

The performance phase is recorded as a focused series:

- [`c522fe6`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/c522fe6437378384853934c26657aae228b8d242) consolidates PostgreSQL reads, introduces request memoization, enables safe public caching, adds post-commit cache invalidation, and bounds the connection pool;
- [`f91bc9`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/f91bc9b85468bc7e17f5cae71d911339130ab6b3) adds cache, connection, navigation, query, and performance regression coverage;
- [`b208b48`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/b208b487ccf895398d244ccaf09d3f5987873af6) records the measured results;
- [`48686f0`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/48686f08a623f8b11bc4e68a24500bd6784eaab3) adds opt-in query instrumentation; and
- [`8eabd28`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/8eabd285d12cef6a2c999d975f199c58acc9bd87) merges the verified optimization work.

The measured headline results were:

- homepage: 54 queries to 8;
- customer dashboard: 125 queries to 7;
- administrator dashboard: 256 queries to 9; and
- cached public pages: few or zero database queries on warm requests, depending on whether live availability was required.

The key design decision was not to cache everything. Session state, authorization, bookings, payments, escrow, notifications, and availability remain live or request-scoped.

## 6 October 2026 — route-aware loading states

Commit [`6235269`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/6235269bb4f9106ff213406f97cf30d4b35ad052) replaces a generic loading experience with route-aware skeletons for marketplace, detail, dashboard, and form-heavy views. Commit [`ce56e4d`](https://github.com/Ralimations/CEBA-service-ecommerce/commit/ce56e4dd4322b02477f24d5cb6a3b2682ea1c216) records the merge.

This is the latest milestone in the available history. It improves perceived responsiveness while the remote database and server-rendered content are loading.

## Current status

Phase 1 is deployed and undergoing client/user acceptance testing. The next timeline entry should be added when there is concrete evidence such as a merged commit, UAT decision, verified deployment, measured regression result, or released production integration.
