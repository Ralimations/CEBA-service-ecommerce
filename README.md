# SoiréeSource

## Project

A local event services marketplace for customers, providers, and administrators. Customers discover individual services or curated multi-provider bundles, request a date, pay through a clearly labelled simulation, complete two digital handshakes, and review their experience. Providers manage their business and bookings. Administrators supervise the marketplace and its mock escrow ledger.

## Phase

**Phase 1 Functional MVP.** This is a working application with Supabase PostgreSQL persistence, server-side authorization, and tested workflows. Payment, subscription, promotion, refund, and earnings amounts are simulations. No real money is collected or transferred.

See [PHASE1_STATUS.md](PHASE1_STATUS.md) for the feature-by-feature status and assumptions, and [CHANGELOG_PHASE1.md](CHANGELOG_PHASE1.md) for major changes.

## Installation

Requirements: **Node.js 24 or newer** and npm. A Supabase project and server-only PostgreSQL connection string are required. Run commands from the project directory.

```powershell
npm ci
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

On macOS/Linux, replace the copy command with `cp .env.example .env`. Do not overwrite an existing customized `.env`.

Open **http://127.0.0.1:3000**. The server binds to loopback. `http://localhost:3000` also works; these loopback origins are accepted only on the same protocol and port.

For a local production build, stop the development server and run:

```powershell
npm run build
npm start
```

If using a different port, set `APP_ORIGIN` to that URL and run `npm run dev -- --port 3001` or `npm start -- --port 3001`.

## Environment variables

Use `.env` for configuration shared by the web application and database CLI. Environment variables already supplied by the shell take precedence over `.env`.

| Variable                   | Default                                | Purpose                                                                                                           |
| -------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_URL`            | `postgresql://...pooler.supabase.com:6543/postgres`            | Server-only Supabase PostgreSQL connection string.                                                    |
| `APP_ORIGIN`               | `http://localhost:3000` in the example | Allowed browser origin for JSON mutations. Change it when changing the server port or host.                       |
| `COOKIE_SECURE`            | `false`                                | Set to `true` only when the application is served through HTTPS.                                                  |
| `DEMO_HANDSHAKE_ANYTIME`   | `true`                                 | Lets demo bookings complete before their event date. Set to `false` to require the event date before either gate. |
| `NEXT_DIST_DIR`            | `.next`                                | Optional build-directory override; browser tests use `.next-test`.                                                |
| `TEST_ORIGIN`              | `http://127.0.0.1:3000`                | Origin used by the route smoke checks.                                                                            |
| `PLAYWRIGHT_CHROMIUM_PATH` | Auto-detected                          | Optional Chrome/Chromium executable for browser tests.                                                            |

Application identity, locale, default policy values, and recommendation weights live in `config/platform.ts`. Admin settings persist policy overrides in PostgreSQL. `.env`, local databases, generated artifacts, and dependencies are ignored by Git.

## Database

Supabase PostgreSQL is accessed through Postgres.js with a small typed, parameterized repository layer instead of an ORM. The app uses `POSTGRES_URL`, which should be a Supabase pooler connection string for Vercel. Foreign keys, status constraints, unique reservations, write transactions, and an append-only financial/event audit trail protect the core workflow.

`database/schema.postgres.sql` contains the initial idempotent migration and schema version marker. `database/seed.ts` creates relative-date demo scenarios, including 10 provider businesses, 20 services, 60 packages, reviews, two bundles, vouchers, and bookings in different lifecycle states. Seed data is fictional. Seeding skips databases that already contain users; it does not merge fixtures into existing data.

| Data group             | Tables                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Identity               | `users`, `sessions`, `auth_attempts`, `providers`, `categories`                                                                    |
| Catalog and scheduling | `portfolio`, `services`, `packages`, `addons`, `availability`, `reservations`                                                      |
| Bundles                | `bundles`, `bundle_items` with participant terms and approval state                                                                |
| Bookings               | `bookings`, `booking_items`, `booking_addons`, `booking_events`, `handshake_tokens`                                                |
| Money and benefits     | `payments`, `escrow_transactions`, `vouchers`, `voucher_wallet`, `voucher_redemptions`, `subscriptions`, `placements`, `referrals` |
| Trust and operations   | `reviews`, `provider_badges`, `disputes`, `notifications`, `support_tickets`, `settings`, `audit_log`, `schema_migrations`         |

Money is stored in integer centavos. Booking items snapshot package details, supplier terms, discounts, and fee allocations, so later catalog changes do not rewrite an existing agreement. Dates use Asia/Manila for event-day comparisons; timestamps are stored in UTC.

### Reset and seed

There is intentionally no production reset command. Run migrations and seed only against an explicitly selected development database; seeding skips databases that already contain users.

```powershell
npm run db:migrate
npm run db:seed
```

Use these separately when preserving existing records:

```powershell
npm run db:migrate
npm run db:seed
```

Backups, point-in-time recovery, and database monitoring are managed in the Supabase project. The migration and seed commands are intentionally idempotent; there is no production reset command.

## Demo accounts

All seeded accounts use **`DemoPass!2026`**. These credentials are for this local demo only. You can also register a new customer or provider; administrator accounts cannot be created through public registration.

| Role          | Email                   | Profile                                       |
| ------------- | ----------------------- | --------------------------------------------- |
| Administrator | `admin@demo.local`      | Mika Reyes                                    |
| Customer      | `customer@demo.local`   | Sofia Cruz; existing booking history          |
| Customer      | `customer2@demo.local`  | Miguel Santos; existing booking history       |
| Customer      | `customer3@demo.local`  | Isabel Ramos; first-booking/referral scenario |
| Provider      | `provider@demo.local`   | Luna Lens Photography                         |
| Provider      | `provider2@demo.local`  | Golden Table Catering                         |
| Provider      | `provider3@demo.local`  | Northstar Event Hosting                       |
| Provider      | `provider4@demo.local`  | Petal & Pine Events                           |
| Provider      | `provider5@demo.local`  | Velvet Glow Makeup                            |
| Provider      | `provider6@demo.local`  | After Hours Mobile Bar                        |
| Provider      | `provider7@demo.local`  | Serenade Live Performers                      |
| Provider      | `provider8@demo.local`  | Ever After Wedding Planning                   |
| Provider      | `provider9@demo.local`  | The Glasshouse Garden                         |
| Provider      | `provider10@demo.local` | Little Joys Event Studio                      |

Use separate browser profiles or an incognito window for simultaneous customer/provider/admin sessions.

## Main features

- Customer/provider registration, persistent sessions, role-specific navigation, suspension controls, and server-side ownership checks.
- Marketplace keyword/category/date/budget/rating/availability/trust/VIP filters, explicit sorting, individual and bundle discovery, and provider portfolios and reviews.
- Provider onboarding checklist, editable profiles, services, packages, add-ons, publication states, and an availability calendar.
- Date-reserving booking acceptance, rejection/cancellation, item-level progress for bundles, price breakdowns, and immutable booking timelines.
- Mock checkout and escrow, two single-use QR/manual-code gates, confirmed admin dispute resolution, full refunds, and supplier-level earnings allocations.
- Admin-curated bundles with supplier approval of terms and intersection of participant availability.
- Welcome, seasonal, rank, and referral vouchers with server validation; completed-booking loyalty ranks; earned trust badges distinct from paid visibility.
- Simulated Classic/VIP subscriptions and scoped 3/7/30-day featured placements with automatic expiry in queries.
- Persistent notifications, visit-driven event and promotion reminders, deterministic FAQ assistance, and support tickets with administrator replies.
- Customer, provider, and admin dashboards based on saved records, responsive layouts, accessible form labels, field errors, confirmation dialogs, and empty/error states.

## Main routes

| Audience             | Routes                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public               | `/`, `/browse`, `/services/:id`, `/providers/:id`, `/bundles`, `/bundles/:id`, `/login`, `/register`, `/support`                                                                                                                                                                                                                                                                              |
| Customer             | `/dashboard`, `/profile`, `/bookings`, `/bookings/:id`, `/checkout/:id`, `/vouchers`, `/notifications`                                                                                                                                                                                                                                                                                        |
| Provider             | `/provider`, `/provider/profile`, `/provider/services`, `/provider/services/new`, `/provider/services/:id`, `/provider/packages`, `/provider/calendar`, `/provider/bookings`, `/provider/bundles`, `/provider/reviews`, `/provider/earnings`, `/provider/subscription`, `/provider/promotions`                                                                                                |
| Administrator        | `/admin`, `/admin/users`, `/admin/providers`, `/admin/services`, `/admin/categories`, `/admin/bookings`, `/admin/bundles`, `/admin/bundles/new`, `/admin/bundles/:id`, `/admin/vouchers`, `/admin/vouchers/new`, `/admin/vouchers/:id`, `/admin/subscriptions`, `/admin/placements`, `/admin/badges`, `/admin/disputes`, `/admin/escrow`, `/admin/support`, `/admin/settings`, `/admin/audit` |
| Shared authenticated | `/bookings/:id` (authorized participants/admin only), `/notifications`, `/support`                                                                                                                                                                                                                                                                                                            |
| JSON mutations       | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/actions`, `/api/quote`                                                                                                                                                                                                                                                                                                     |

## Walk through the lifecycle

1. Register a customer, or sign in as `customer3@demo.local`. Open a service, choose a future available date and package, and request a booking. A newly registered customer can apply `WELCOME10` if its current rules are met.
2. Sign in as that service's provider in another browser profile. Open the booking and accept. Acceptance reserves the provider's entire event day. Pending requests do not reserve dates.
3. Return as the customer and refresh the booking. Complete the labelled mock checkout. For bundles, every participant must first accept.
4. As the customer, generate the **Gate 1 / start** code. As the provider, enter that code on the same booking item. The service becomes in progress.
5. As the provider, generate the **Gate 2 / completion** code. As the customer, enter that code. All bundle items must complete before the booking releases its mock escrow. Codes expire after 30 minutes, are single-use, and lock after five incorrect attempts.
6. Leave a review from the completed booking. Inspect provider earnings and the admin escrow ledger. Completion updates customer rank and can qualify referral rewards and provider trust eligibility.

QR images encode the same manual code. An integrated camera scanner is not included; enter the displayed code manually. `DEMO_HANDSHAKE_ANYTIME=true` intentionally makes this lifecycle testable without waiting for the event.

For admin review, `/bookings/demo-disputed` starts with a dispute. `/admin/escrow` requires a reason and explicit confirmation for a full refund or exceptional release. These actions are logged. Paid customer cancellations open a dispute; unpaid cancellations free reservations.

## Architecture

```text
app/          Next.js App Router entry points, API handlers, global styles
features/     Marketplace, account, booking, provider, and admin page modules
components/   Shared navigation, forms, cards, tables, status and feedback UI
server/       Authentication, queries, business rules, transactions, reminders
lib/          Shared domain types, transition rules, formatting, FAQ content
config/       Identity, currency, recommendation weights, policy defaults
database/     Initial SQL migration, seed fixtures, reset/migrate CLI
tests/        Domain integration tests, route smoke checks, browser workflows
public/       Local demo photography and favicon
```

Next.js 16, React 19, TypeScript, and Tailwind 4/PostCSS provide the application shell. Most views render on the server; forms, navigation, FAQ, and QR interactions are client components. A guarded catch-all page maps stable product URLs to domain page modules. API handlers validate origin and inputs, then call domain functions that enforce authorization again. PostgreSQL transactions cover booking acceptance, voucher reservations/redemption, payment, gate verification, and dispute resolution.

Passwords use salted scrypt; session and gate secrets are hashed in the database. Cookies are HttpOnly and SameSite=Lax. Login attempts are throttled. Suspended accounts lose access. Audit and escrow rows cannot be updated or deleted through normal SQL statements because of append-only triggers.

## Tests

For the connected Supabase project, use the hotfix smoke checks:

```powershell
npx tsx tests/postgres-audit.ts
# With npm run dev (or npm run start) already running:
npx tsx tests/runtime-smoke.ts --public-only
npx tsx tests/runtime-smoke.ts
```

The audit and `--public-only` checks are read-only. The full runtime smoke creates two unique test accounts and one unpaid booking, validates consent, login/logout, session invalidation, dashboards, and provider visibility, and retains those records. It does not seed, reset, accept bookings, or make payments. Set `TEST_ORIGIN` to test a different local port; it defaults to `http://127.0.0.1:3000`.

The fixture suites below require a separate test database; they are not safe rerun checks for the shared project.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

With the application running on port 3000:

```powershell
npm run test:smoke
```

The fixture browser suite starts and stops its own server on **3100** and uses the configured database. Point it at an isolated test project and keep that port free. It automatically uses Chrome at the standard Windows installation path, otherwise install Playwright Chromium once:

```powershell
npx playwright install chromium
npm run test:e2e
```

On Windows with the detected Chrome installation, the install step is unnecessary. Test runs use a fresh browser context, not an existing signed-in browser profile. Generated screenshots are in `artifacts/`; failures retain Playwright traces under `test-results/`.

Verified during implementation: PostgreSQL migration and seed, terms acceptance for customer and provider registration, type checking, ESLint, and a production build. The full integration suite requires an isolated Supabase test database because it creates bookings, vouchers, and accounts; running it against a shared seeded project will leave test fixtures behind and cause duplicate-key failures on reruns.

## Known limitations

- Real payment gateways, payouts, recurring billing, email/SMS, external identity/business verification, cloud deployment, and production security/scale operations remain Phase 2.
- No integrated camera scanner, partial refund, installment checkout, or per-provider partial escrow release. Bundles release only after every item completes, except an explicit audited admin resolution.
- Availability is one event per provider per day. Accepted unpaid requests keep their reservation until cancelled; no automatic reservation timeout exists yet.
- Notifications update on navigation/refresh. Event/promotion reminders are generated during authenticated visits, without a background scheduler or push service.
- Portfolios use local assets or entered image URLs; direct file uploads and media storage are not implemented. Provider local verification is an admin review flag, not external KYC.
- Analytics are basic database aggregates. VIP has visibility, portfolio capacity, and placement discounts; advanced VIP analytics are deferred.
- PWA installation/offline behavior is **WIP / Requires Product Clarification**. No service worker or installable app is claimed.
- Supabase free-tier projects can pause after inactivity and have resource limits. Production operations still need backups, monitoring, stronger anti-abuse controls, and a dedicated test database.

All demo businesses, people, reviews, and transactions are fictional. Image source references are recorded in [public/images/README.md](public/images/README.md).
