# Phase 2 stakeholder review

This is a review list for CEBA students. Items marked proposed were selected by engineering for a reversible development implementation; they were not approved in the meeting.

## Decisions requested

1. **Booking response timeout — provisional.** The meeting asks providers to accept or reject within 24 hours. The branch provisionally expires the entire request if every provider in a bundle has not accepted by then, releases partial holds, and notifies everyone. Should the whole request expire, should customers choose whether to wait, or should another outcome apply?
2. **Existing requests.** The branch gives only new bookings a persisted deadline. Existing pending bookings have no deadline. Should these remain untouched, receive a grace period, or be handled another way?
3. **Cancellation reasons — provisional.** The form uses one primary reason: scheduling conflict, staff/team availability, equipment/operations, personal emergency, weather/safety, venue/logistics, or Other. Are the choices accurate, and should providers be able to select more than one?
4. **“Other” moderation.** Custom wording is shown only to administrators until approved. Should the customer see an edited summary, a reason label only, or another outcome? Who owns timely review?
5. **Near-event cancellation.** The minutes propose a restriction shortly before the event and mention both two days and one week. Engineering has not activated the proposed 48-hour default. Which period, emergency exceptions, and escalation route should apply?
6. **Support follow-up.** A public account review form is available in the branch. Administrators can record status and internal notes, but the app does not send email and does not restore access. Who will follow up, and what contact/response expectations should the product promise?

## Financial and evidence policies to resolve separately

- The PDF proposes a provider cancellation fee, returning a reservation fee, alternative-provider referrals, bundle vouchers, and a one-business-day refund goal. None is implemented as an actual charge, refund, or monetary voucher.
- The PDF mentions a 50% pre-service payment and collateral/capital ideas. Existing payment and QR flows remain simulations; no live payment or payout behavior was changed.
- The PDF conflicts on photo evidence: one section says cancellation photos are not required; another says transaction proof is needed. No upload or private evidence storage was added.

## Product and design review

- Confirm whether chat means customer-provider booking messages, human support, or both. Messaging was deferred; no AI chatbot or paid service was added.
- Review the emerald, silver/cream, light/dark direction and the existing brand identity. A complete theme switch and header candidates were deferred; current branding was not replaced.
- Decide whether proposed check-ins, experience points, birthday discounts, referral points, and tier rewards are non-financial engagement only. No new loyalty economics were activated.

## Items already requested in the meeting

- “Service Fee” terminology for provider-paid deductions was implemented as presentation wording; fee math and internal field names did not change.
- Admins can open a suspended provider record and view its retained booking history; the public marketplace remains filtered.
- The branch includes a public account-review intake and provisional expiry/cancellation workflows for review. These implementations are not evidence that the business policies have final approval.
