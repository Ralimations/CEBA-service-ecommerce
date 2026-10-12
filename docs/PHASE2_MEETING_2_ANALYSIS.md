# Phase 2A meeting 2 analysis

## Scope and evidence

The client meeting PDF is the source for the meeting statements below. This audit separates those statements from code observations and engineering recommendations. It does not treat every discussion point as approved policy.

| PDF page | Source requirement or proposal | Current implementation | Status / priority | Dependency and risk |
|---|---|---|---|---|
| 1 | Offer dark and light modes; use emerald inspiration and lighter silver-like cream; establish recognizable branding. | `app/globals.css` already defines the application palette and existing SoiréeSource mark/header. No complete user-controlled theme switch exists. | Proposed; P2 | Needs approved tokens, contrast review, preference persistence, and no-flash behavior. Do not imply a working dark mode. |
| 2 | Rename the provider-paid “Platform Fee” to “Service Fee.” | Fee values are `platform_fee` internally and are calculated from the configured percentage. Several customer, provider, and admin displays used “Platform fee.” | Implemented in this branch as a presentation-only rename. Internal fields and calculations remain unchanged. P1 | UI wording only; verify calculations and snapshots remain identical. |
| 2–3 | Referral experience when the referred customer ranks up; Classic, Silver, Gold, and Platinum benefits. | `rankFor`, referral tracking/rewarding, rank settings, and voucher support exist. Current tiers are driven by completed-booking thresholds; proposed check-ins, birthday discounts, and tier vouchers are not implemented. | Existing foundation plus proposed/unclear rewards; P3 planning | Thresholds, points, eligibility, caps, expiry, voucher stacking, and referral XP need product approval. No financial reward activated. |
| 3 | Booking starts pending. Providers have 24 hours to accept or reject. Do not reserve a date until acceptance. | Booking creation inserts pending booking items and no reservation. Each provider acceptance creates that provider's reservation; payment is enabled only after all bundle providers accept. No response deadline or expiration worker exists. | Pending/reservation behavior already matches; deadline missing. P2 | Expiration outcome, partial bundle handling, cleanup, notifications, and extension policy need approval. |
| 3–4 | Provider cancellation reasons should use common selections and “Other”; custom text must be reviewed before it is shown to customers. | `booking.cancel` accepts free text. It is persisted in the append-only booking event and sent in booking notifications. No structured reason or moderation queue exists. | Missing; safe implementation deferred pending approved reason list and cardinality. P1 design / P2 build | Do not expose unreviewed text or alter the current state/refund/dispute rules. Preserve existing event detail. |
| 3–4 | After an accepted provider cancellation, consider a cancellation fee, reservation-fee return within one business day, alternatives, or bundle voucher. Rejection before acceptance has no fee. | Current cancellations of pending/accepted bookings cancel the booking, release reservations, and notify participants. Cancellation after confirmation/in-progress becomes a dispute. Payments and escrow are simulations. | Proposed business policy; not implemented. P2 | Fee amount, collection, refund timing, exceptions, compensation, and authority remain unsettled. No real financial action. |
| 4 | Cancellation photo proof is unnecessary in the proposed fee flow. | No cancellation photo upload is required. | Contradicted by page 10. Unclear. | A decision is required for cancellations versus disputes and service evidence. No upload/storage change. |
| 4, 9 | Add customer-provider chat. Page 9 separately discusses human support, FAQ, and an AI chatbot. | `/support` has an FAQ assistant and authenticated human support tickets. There is no customer-provider messaging. | Missing; P2 design | Keep three communication categories separate. Chat needs ownership, retention, moderation, abuse reporting, notification, and operating-cost decisions. |
| 5 | Suspended providers cannot reach administrators because support submission requires login. | Public `/support` offers FAQs but ticket creation and ticket history require an active account. There is no configured public support contact in the repository. | Confirmed usability gap; P1 blocker documented | A public channel needs rate limits, spam handling, privacy terms, and an admin review/response route. Do not invent a support email or claim the existing FAQ is an appeal channel. |
| 6 | Suspended provider details cannot be viewed. | `providers()` includes suspended accounts for admin use, and `/admin/providers` linked to the public profile route. Public provider content intentionally returns null for suspended providers. | Confirmed admin navigation gap; addressed in this branch with an admin-only provider detail route. P1 | Admin route is gated by the existing admin role check; public filtering is preserved. Suspension reasons are not stored. |
| 6 | A suspended user can still book. | Every action request resolves its cookie through `userFromToken`, which joins the current user status and only returns `ACTIVE`; suspension deletes all user sessions. The action dispatcher and booking domain also check role/status. | Not reproduced by code-path review; P0 regression coverage added. | Old pages may remain visible from browser state, but their separate POST uses a fresh database-backed session lookup and should fail. Automated business test verifies old token invalidation and direct action denial. No production database request was made. |
| 7–8 | Competitor feature descriptions and advantages. | Discovery, profiles, reviews, booking, bundles, availability, and FAQ support already exist in Phase 1. | Inspiration / long-term ideas only. P3 | Do not copy competitor designs or infer approval for dreamboards, planning tools, or new integrations. |
| 9 | Near-date cancellation lock (examples: 2 days or 1 week); if both parties cancel, dispute. | No date-based cancellation lock. Confirmed and later cancellations enter dispute handling; pending/accepted cancellation closes the booking and frees reservations. | Proposed/unclear. P2 | Choose a lock window, emergency exceptions, and precise bilateral-cancellation semantics before state changes. |
| 10 | Photo proof protects both parties during transactions. | No general photo-proof requirement exists. Existing booking history, disputes, simulated escrow, and dual-party handshake events provide non-photo records. | Contradiction with page 4; unclear. | Explicitly decide which transaction stages require evidence, who can view it, and retention/security before adding uploads. |
| 10 | QR handshake is dual verification; both parties verify before and after the event. | Handshake tokens are bound to item/gate, expire, have attempt limits, cannot be reused, and are verified by the counterparty. Completion releases simulated escrow only after all bundle items complete. The current interface supports manual code entry; it does not invoke camera scanning. | Core dual-party flow already exists; camera scanning is a proposed enhancement. P2 review | Keep current mechanism and distinguish completion from real payment authorization. Camera permissions and QR UX need separate scope. |
| 10 | Reservation fee after acceptance and 50% before service; possible collateral/capital in future. | Checkout creates a simulated full-payment/escrow record after all providers accept. No real charge, refund, or payout gateway exists. | Payment relationship unclear; collateral is long-term only. Planning | Clarify reservation fee versus 50% and the remaining balance. No financial behavior activated. |
| 10 | Own visual identity; provide logo + name and logo + name + tagline header suggestions. | Existing logo and header remain in place. | Design proposal; P2 | Prepare options for review without replacing the current logo. |

## Engineering recommendations (not client-approved policy)

- Keep authorization at the uncached request boundary. A page rendered before suspension must not authorize a later mutation.
- Keep public marketplace exclusion for suspended providers while giving administrators an uncached, role-protected historical view.
- Keep service-fee labels separate from database names, calculations, and ledger amounts.
- Model any future response deadline in database state with an idempotent worker and explicit bundle rules; do not rely on browser timers.
- Keep new monetary rules disabled until signed-off terms, transaction semantics, and tests exist.
- Treat cancellation text moderation as a separate review state. Do not notify customers with custom “Other” text until approved.

## Implementation-ready design notes (proposals only)

### Response deadline

Current records already have booking `created_at`; a future migration should add `response_deadline` (timestamp with time zone) and, if a distinct timeout outcome is approved, an explicit expired state at booking/item level. Item state must distinguish pending from accepted so a bundle cannot silently become payable after partial acceptance. An expiry worker should claim due bookings transactionally, check the pending state again, apply the approved whole-bundle rule, release any reservation rows for that booking only when the approved outcome requires it, append one event, and insert idempotently keyed notifications for the customer and outstanding providers. A retry after a crash must not duplicate transitions or notifications. A persisted deadline is authoritative; browser timers are informational only. Decide Manila-time display versus UTC storage and whether any extension is possible before rollout.

### Cancellation policy/state outline

Existing transitions remain authoritative until a policy is approved:

```text
PENDING  -> ACCEPTED -> CONFIRMED -> IN_PROGRESS -> COMPLETION_PENDING -> COMPLETED
   |           |            |             |                 |
   +-------- CANCELLED      +-------------+-----------------+--> DISPUTED
```

Pending/accepted cancellation currently closes the booking and removes reservations. Confirmed or in-progress cancellation currently opens a dispute and freezes simulated escrow. The diagram is descriptive, not a request to change the state machine. Any future provider cancellation fee should use an append-only fee assessment/waiver record within the same transaction that records the approved transition; it must not mutate balances or trigger a real collection. The admin workflow should preserve original reason text, show it only to authorized reviewers, record reviewer/action/time, and separately store the approved customer-facing text. A failed transaction rolls back state and reservation updates together; an external payment/refund must be a later idempotent workflow, never a side effect inside the booking transaction. Rollback should be additive: disable the new action and keep old events/columns intact, rather than deleting history.

### Support, dispute, and messaging boundaries

- **Customer ↔ provider:** proposed booking-attached threads, initially available after a request exists; one thread per booking/provider pair; participants can read/write only their own thread. Store immutable messages with sender and timestamps, derive unread counts from a per-participant last-read cursor, and use refresh-based updates first. Notify only the other participant and rate-limit writes. Add report/flagging and audited admin read access for dispute handling. Retention and deletion policy must be explicit.
- **User ↔ SoiréeSource support:** existing authenticated tickets and `/admin/support`; the suspended-account path needs a separate anonymous intake or configured email. Anonymous requests must return generic success, avoid account-existence lookup, validate length, rate-limit by privacy-preserving keys, and enter an admin-only review queue. Do not promise a response channel until an owner and reply process are assigned.
- **User ↔ FAQ assistant:** current FAQ support is informational. Do not merge it with human support or provider messaging. Any future AI assistant needs its own data-sharing, cost, escalation, and answer-quality approval.

### Loyalty comparison/design

Current: completed-booking thresholds determine rank; referral records can grant vouchers after completion; voucher eligibility is server-side. Proposed by meeting: Classic one-time first-user discount; Silver check-ins, points at ₱0.01 each and 10% birthday discount; Gold 15% birthday, ₱5–₱10 off and 10% bundle voucher; Platinum 20% birthday, ₱5–₱15 off, 15% bundle voucher, and priority support; referral experience when a referred user ranks up. The currency intervals are recorded literally from the notes, not normalized. Safe alternatives: retain the current scheme; or approve each perk independently with caps. Before implementation decide rank thresholds, points/check-in period, earn limits, redemption minimum, expiry, birthday verification, voucher stacking, referral XP, and a measurable priority-support SLA. No new reward is activated.

### Payment/escrow comparison

Current Phase 1: providers accept first; bundle payment waits until all have accepted; checkout writes a simulated payment/escrow hold; two participant-bound handshake gates govern service progress; simulated release is written only after all bundle items complete; disputes freeze the simulation for admin review. Proposed Phase 2 notes mention a reservation fee after acceptance, a 50% pre-service payment, refund within one business day after qualifying cancellation, and payout after dual verification. The relationship among reservation fee, 50%, and remaining balance is unknown. Future data may need payment schedule items, due dates, refund eligibility and idempotency keys, and provider-level payout allocations, but these require approved rules. Concurrency controls must prevent duplicate payment/refund actions, ledger changes should be append-only, and booking state plus internal ledger writes must commit atomically. Gateway selection, compliance, reconciliation, chargebacks, and operational controls require separate review. Keep all current behavior simulated.

### Brand specification for stakeholder review

Current CSS variables that can be reused: `--ink: #233d34`, `--forest: #285446`, `--forest-dark: #183e32`, `--cream: #faf9f5`, `--paper: #fff`, `--muted: #788079`, `--line: #e4e7df`, and `--sage: #eff2e9`. Proposed silver-cream neutral: `#E9E8E1`. Proposed dark surface set: background `#121A17`, card `#1C2923`, text `#EEF2EF`, muted text `#B9C5BE`, and border `#36463E`; dark-mode primary button may use a pale emerald fill with dark text. Retain the current dark forest primary in light mode. Verify every text/control pair meets WCAG AA contrast at implementation time, including hover/focus/disabled states. These are starting values, not approved final brand tokens.

Header treatments to present (do not replace the existing mark):

1. **Logo + name:** SoiréeSource mark with the product name beside it.
2. **Logo + name + tagline:** same lockup plus a short line of copy; tagline wording remains subject to stakeholder approval.

## Verified current workflows

- New requests are `PENDING`; providers reserve dates only when accepting.
- Bundles remain pending until each participating provider accepts. Checkout follows complete acceptance.
- Customers and providers use item-specific, counterparty-verified START and COMPLETE codes. Completion waits for all items before the simulated release.
- Disputes freeze held simulated escrow and require an administrator decision with audit entries.
- Public provider content filters out suspended accounts; admin records now have a separate route in this branch.
- The `documentation/` directory was already untracked at the start of work and was preserved.
