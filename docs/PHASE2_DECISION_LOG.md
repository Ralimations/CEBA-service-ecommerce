# Phase 2 decision log

## RC2 release engineering decisions (2026-10-14)

- Database mutation commands require an explicit local or staging target. Local means loopback only. Staging means a direct Supabase host matching the staging project ref and a separately verified, distinct production ref. Production runtime may connect in Vercel Production; migration and seed commands reject Production. This is an engineering safety rule, not a product-policy decision.
- No staging database was selected or provisioned because project identity, free quota/cost, and account settings could not be verified. The generic Supabase pooler endpoint in ignored local configuration is not sufficient proof of project identity.
- The development-branch Actions workflow remains isolated and secretless. RC2 workflow improvements stay local until an automatic Vercel Preview is proven isolated from production.
- No production flag, domain, branch mapping, cron, migration, deployment, or data was changed. Existing production settings were not readable in the available tools.
- Product-policy decisions for cancellation, message retention, monetary rewards, and simulated payment remain open; this sprint does not approve them.

No item below is approved policy unless explicitly marked approved. Recommendations are engineering proposals for stakeholder review.

| Decision ID | Question | PDF page | Why it matters | Possible options | Recommendation | Approval status | Implementation dependency |
|---|---|---:|---|---|---|---|---|
| D-01 | What should happen when a provider does not answer within 24 hours? | 3 | Determines request state, customer expectations, and reservation cleanup. | Auto-reject; expire and notify; extend; admin review. | Expire into a distinct terminal state after a durable deadline, with a bounded idempotent worker; only after product chooses the customer outcome. | Open | Deadline column/state, worker/cron, notifications, idempotency, bundle policy. |
| D-02 | How should a bundle behave when only some providers accept before the deadline? | 3 | Partial acceptance can leave providers reserved while the customer cannot proceed. | Keep accepted items pending; release all; allow partial booking; admin decision. | Keep atomic customer-facing bundle semantics and release partial reservations on whole-request expiry, if product approves expiry. | Open | Bundle deadline design and reservation cleanup tests. |
| D-03 | What cancellation reason options are approved, and may providers select multiple reasons? | 3–4, 9 | Free-text replacement requires a stable reason code list and UI semantics. | One primary reason; multiple checkboxes; other-only text. | Start with one primary reason plus optional “Other” after approving the list; preserve a separate internal note. | Open | Reason-code catalogue, schema, UI, tests. |
| D-04 | Who reviews custom cancellation text, and what does “reviewed” mean? | 4 | Unreviewed text currently reaches customers in notifications. | Admin approve/edit/reject; automated filter plus admin; keep text internal. | Keep custom text private until an audited admin approval; define whether edits are allowed. | Open | Moderation state, review permissions, customer-visible copy, notification timing. |
| D-05 | What cancellation fee applies after an accepted booking, and who may waive it? | 3–4, 9 | Changes provider liability and financial records. | Fixed amount; percentage; no fee; exception/waiver process. | Keep disabled until amount, exceptions, collection, and appeal rules are approved. | Open | Legal/business terms, ledger design, transaction and audit requirements. |
| D-06 | What cancellation lock window applies near an event, and what are the emergency exceptions? | 9 | A lock can force disputes or prevent legitimate cancellations. | 2 days; 1 week; another window; no lock. | Define an explicit event-time threshold and emergency/admin override before blocking cancellation. | Open | State transitions, timezone policy, admin workflow, tests. |
| D-07 | What exactly happens when both parties request cancellation? | 9 | Current system records one cancellation action and has dispute handling for later stages. | First request opens a dispute; two requests auto-open; admin review. | Open a dispute for post-acceptance conflicts; do not auto-resolve or auto-refund. | Open | Event semantics and dispute state transition approval. |
| D-08 | When is photographic proof required? | 4 and 10 | Pages conflict: cancellation photos are called unnecessary, while transaction photos are called required. | Cancellation; dispute; service start; completion; payment/refund review; none. | Decide separately by context, access, retention, and consent. Keep uploads optional/off until decided. | Open | Storage provider, privacy/retention policy, permissions, moderation. |
| D-09 | Is the proposed reservation fee separate from the proposed 50% pre-service payment? | 4 and 10 | Current system simulates one full checkout after acceptance; unclear amounts could double-charge if implemented. | Reservation fee credited toward 50%; reservation fee plus 50%; 50% replaces fee. | Define a complete payment schedule, due dates, and balance before changing checkout. | Open | Product and finance review; payment-state model and concurrency tests. |
| D-10 | What refund qualifies and how is “one business day” counted? | 4 | Requires calendar, cutoff, exception, and provider-cancellation definitions. | All accepted-provider cancellations; admin-approved only; business-day calendar. | Specify business timezone/calendar, triggering event, and simulation versus future live gateway. | Open | Payment lifecycle, event/audit model, finance/legal review. |
| D-11 | When are vouchers or alternative-provider referrals offered after cancellation? | 4 | Bundle and single-service compensation differ and affect discounts/liability. | Automatic; admin-approved; bundle only; referral only. | Keep manual and simulated until eligibility, value, expiry, and stacking rules are approved. | Open | Support workflow, voucher policy, audit trail. |
| D-12 | What are loyalty thresholds and reward values? | 2–3 | Current app uses completion thresholds; meeting ideas add check-ins, birthday discounts, vouchers, and referral XP without amounts/eligibility. | Retain current; approve a points schedule; approve each tier perk independently. | Preserve current ranks; decide thresholds, earning, caps, expiry, birthdays, verification, and stacking before financial rewards. | Open | Product specification and isolated reward tests. |
| D-13 | What does “priority customer service” guarantee? | 3 | The promise requires an actual support response-time/capacity policy. | Queue priority; stated SLA; dedicated human channel. | Define a measurable SLA and staffing owner first. | Open | Support operations and channel configuration. |
| D-14 | Should customer-provider messaging be allowed before booking or only on bookings? | 4 and 9 | Controls discovery, spam, privacy, moderation, and storage scope. | Pre-booking; accepted-booking only; all booking states. | Begin with booking-attached messaging after request creation, subject to abuse reporting and admin access policy. | Open | Conversation ownership, moderation, notification, retention, limits. |
| D-15 | Which channel should suspended-account support use, and what data may be requested publicly? | 5 | No configured support email or safe public appeal intake exists today. | Configured support email; rate-limited public intake; authenticated appeal flow. | Provide a rate-limited public request channel with a generic response, admin-only review, no account-existence confirmation, and no automatic reinstatement. | Open | Support contact/owner, privacy notice, abuse limits, admin review/response workflow. |
| D-16 | Which transaction stages require QR scanning versus manual code entry? | 10 | Current codes are dual-party and item-scoped; camera scanning is not in the product. | Keep manual code; add QR display/scan; support both. | Keep tested manual entry; separately evaluate camera UX, permissions, and accessibility. | Open | Browser/device matrix and explicit scan requirements. |
| D-17 | What visual tokens and header treatment should be approved? | 1, 10 | Theme and logo changes affect all routes and brand identity. | Emerald/cream tokens; exact contrast values; logo + name; logo + name + tagline. | Approve a token sheet and two header mockups before adding a switch or replacing identity. | Open | Brand assets, contrast review, preference/no-flash requirements. |

## Implemented on this branch (not product policy)

### Combined sprint additions — 2026-10-13

- New booking response deadlines use 24 hours; bounded expiry is shared by page/action access and a bearer-protected `/api/cron/expire-bookings` endpoint. `vercel.json` prepares a daily schedule; activation requires a future deployment and `CRON_SECRET`.
- The near-event provider restriction is provisionally 48 hours from PHT event-date midnight through the event day. Emergency requests wait for administrator review. The lock can be disabled with `FEATURE_PROVIDER_CANCELLATION_POLICY`.
- Booking messages are item-scoped, participant-only, refresh-based, capped at 4,000 characters, rate-limited, and disabled unless `FEATURE_BOOKING_MESSAGING=true`. Admin read access is limited to disputed bookings.
- Theme preference supports light, dark, or system. Existing logo assets are retained.
- Loyalty experience points use provisional check-in/completion/referral-milestone values, are nonredeemable, and are disabled unless `FEATURE_LOYALTY_BETA=true`; monetary loyalty rewards remain off.
- Deposit simulation is an independent prototype ledger. It does not create payment rows or alter booking/escrow state. `FEATURE_SIMULATED_DEPOSITS` defaults off; no real payment integration exists.
- Scheduled expiry, rank thresholds, 50% deposit timing/rounding, cancellation categories/window, message retention, and theme tokens need stakeholder review. None is represented as approved policy.

- “Service Fee” is a display label for the existing provider deduction. No schema key, percentage, amount, allocation, simulated escrow, or payout behavior changed.
- Administrators may inspect suspended provider records through an admin-only route. Public marketplace exclusion remains in place.
- Suspension defense regression coverage is added for stale sessions and API action dispatch. The reported production incident was not reproduced and no production data was tested.

## Continuation implementation decisions (2026-10-13)

These labels separate PDF requests from reversible engineering choices made for this branch. **None of the provisional items below is stakeholder-approved policy.**

| Item | Status | Branch behavior | Stakeholder follow-up |
|---|---|---|---|
| Provider response window | Stakeholder-requested 24-hour response; expiry outcome is **Engineering provisional / awaiting approval** | New bookings get a UTC deadline 24 hours after submission. A pending multi-provider request expires as a whole unless all providers accepted. | Confirm whole-request expiry, notice wording, and extension/appeal behavior. |
| Historical pending bookings | **Engineering provisional** | Existing pending rows retain `NULL` deadlines and do not expire automatically. | Decide whether to leave them untouched or plan a separately approved grace period. |
| Cancellation reason choice | **Engineering provisional / awaiting approval** | One primary reason from seven proposed categories. | Approve category wording and single-versus-multiple selection. |
| “Other” moderation | **Engineering provisional** | Custom text remains admin-only until approval; original submission and each moderation decision are retained. | Define moderator owner, response timing, and customer-visible wording. |
| Public suspension appeal | Approved as an engineering priority in the continuation brief; **not identified as meeting-approved product policy** | Anonymous intake, generic confirmation, lightweight rate limiting, admin-only queue; no account status change or email delivery. | Confirm privacy copy, follow-up owner, and stronger spam/email requirements. |
| Near-event cancellation lock | **Deferred** | No 48-hour restriction is active; existing cancellation/dispute transitions remain. | Choose a window and emergency escalation workflow before enabling a lock. |
| Messaging and full theme switch | **Deferred** | No chat or partial dark mode was introduced. | Approve privacy/retention/moderation and complete theme/contrast direction. |
| Fees, refunds, voucher compensation, and payment plan | **Deferred / not approved** | No monetary penalty, real refund, or payment gateway was added. | Resolve amounts, eligibility, exceptions, operations, and finance/legal requirements. |

## Emerald continuation decisions (2026-10-13)

These branch implementation notes supersede stale “deferred” wording in earlier continuation rows where indicated. They do not imply stakeholder approval.

| Topic | Branch implementation | Decision still required |
|---|---|---|
| Emerald Editorial Luxury tokens | Implemented using deep/olive emerald with pearl/silver light surfaces and dedicated dark surfaces; system preference remains supported. | Approve final brand colors, header treatment, and contrast direction. |
| Booking messages | Existing item-scoped participant access retained; bundle E2E now verifies separate suppliers and cross-customer isolation. | Approve allowed booking states, moderation owner, retention duration and deletion process. |
| Message reporting | New participant report stores a specific message reference and reason; admin sees only that message plus booking/provider context. Review actions are audited. | Approve categories, response process, privacy notice, and report/conversation retention. |
| Deadline reminders | Deterministic two-hour-window reminders are created on participant visits. | Decide whether/which reliable scheduler should send reminders without a visit. Current daily cron is not exact-time delivery and remains inactive. |
| Loyalty monetary benefits | No birthday or rank money is issued; monetary flag remains false. | Approve eligibility, personal-data handling, caps, expiry, stacking, and anti-abuse controls before implementation. |

## Final compliance sprint update (2026-10-14)

The project owner is the product-acceptance authority for this assignment and has authorized a conditional merge. A separate CEBA/client meeting is not required. Safe engineering defaults below remain explicitly engineering decisions; this update does not claim the PDF stated them.

- Whole-request expiry, one primary cancellation reason, the 48-hour urgent review window, and the 50/50 prototype ledger are reversible defaults. Their monetary effects remain absent and provisional policy flags default off.
- `FEATURE_LOYALTY_MONETARY_REWARDS` now gates only a text preview of the PDF proposal. XP remains nonredeemable; no birthday data, new voucher, checkout change, refund, or fee assessment is introduced.
- All user-facing seeded bundle terms use “Service Fee”; database storage and calculations retain the existing `platform_fee` field.
- At the time of this compliance checkpoint, production identity, migration state, backup/restore, and Vercel settings had not been verified. This statement is historical and is superseded by the completed production release in `PHASE2_FINAL_DEPLOYMENT_REPORT.md`.
- See `FINAL_PDF_COMPLIANCE_AUDIT.md`, `PHASE2_FEATURE_FLAG_MATRIX.md`, and `PHASE2_FINAL_DEPLOYMENT_REPORT.md` for the current evidence and release status.

## Final production release (2026-10-14)

- The owner authorized and completed the conditional release after the backup, isolated application restore, migration rehearsal, and complete local release checks passed.
- Migrations 002–008 were applied to the verified production project. All 34 legacy public application table hashes matched before and after. Phase 1 public route smoke checks remained healthy.
- Feature branch commit `ec9602e135bb72625c1cd1fb699b34af5f2aabde` was merged normally to `main` as `acd20fd3d0cbcd9f4baf4a8e42704e2a82a82206`; that merge is deployed to the existing Vercel Production project.
- Messaging, provider cancellation review, and nonredeemable XP are enabled for this release. Their privacy/retention and provisional product-policy follow-ups remain open. Monetary rewards and simulated deposits remain disabled.
- GitHub Actions could not start because the account was locked due to a billing issue. Local, restored-database, Preview-build, and production smoke evidence is recorded in the final deployment report; no remote CI test pass is claimed.
