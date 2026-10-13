import { z } from 'zod';
import { assert, requireRole, type User } from '@/lib/domain';
import { all, audit, id, insert, notify, one, transaction } from './db';
import { booking } from './queries';

export const providerCancellationReasons = {
  SCHEDULING: 'Scheduling conflict',
  STAFFING: 'Staff or team availability',
  EQUIPMENT: 'Equipment or operational issue',
  EMERGENCY: 'Personal emergency',
  WEATHER_SAFETY: 'Weather or safety concern',
  VENUE_LOGISTICS: 'Venue or logistical issue',
  OTHER: 'Other',
} as const;
export type ProviderCancellationReason = keyof typeof providerCancellationReasons;
export const otherReasonPendingCopy = 'Your provider has requested cancellation. SoiréeSource is reviewing the explanation.';

export function providerCancellationLockHours() {
  const configured = Number(process.env.PROVIDER_CANCELLATION_LOCK_HOURS ?? '48');
  return Number.isInteger(configured) && configured > 0 && configured <= 336 ? configured : 48;
}

export function providerCancellationWindowActive(eventDate: string, at = new Date()) {
  const eventDayStart = new Date(`${eventDate}T00:00:00+08:00`).getTime();
  if (!Number.isFinite(eventDayStart)) return false;
  const eventDayEnd = eventDayStart + 24 * 60 * 60 * 1000;
  const restrictedStart = eventDayStart - providerCancellationLockHours() * 60 * 60 * 1000;
  return at.getTime() >= restrictedStart && at.getTime() < eventDayEnd;
}

export async function pendingEmergencyCancellationRequests(user: User) {
  requireRole(user, 'ADMIN');
  return all<{
    id: string; booking_id: string; title: string; event_date: string; requester_name: string;
    reason_code: ProviderCancellationReason; submitted_text: string; created_at: string;
  }>(`SELECT r.id,r.booking_id,b.title,b.event_date,u.name requester_name,r.reason_code,r.submitted_text,r.created_at
      FROM provider_cancellation_requests r JOIN bookings b ON b.id=r.booking_id JOIN users u ON u.id=r.requester_id
      WHERE r.status='PENDING' ORDER BY r.created_at,r.id LIMIT 200`);
}

export async function pendingProviderCancellationReasons(user: User) {
  requireRole(user, 'ADMIN');
  return all<{
    id: string;
    booking_id: string;
    title: string;
    event_date: string;
    requester_name: string;
    submitted_text: string;
    created_at: string;
  }>(`SELECT r.id,r.booking_id,b.title,b.event_date,u.name requester_name,r.submitted_text,r.created_at
      FROM provider_cancellation_reasons r
      JOIN bookings b ON b.id=r.booking_id JOIN users u ON u.id=r.requester_id
      WHERE r.reason_code='OTHER' AND NOT EXISTS (
        SELECT 1 FROM provider_cancellation_reviews review WHERE review.reason_id=r.id
      ) ORDER BY r.created_at LIMIT 200`);
}

export async function reviewProviderCancellation(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z.object({
    id: z.string().uuid(),
    decision: z.enum(['APPROVED', 'REJECTED']),
    customerVisibleReason: z.string().trim().max(500).default(''),
    moderationNote: z.string().trim().max(2000).default(''),
  }).parse(input);
  if (data.decision === 'APPROVED')
    assert(data.customerVisibleReason.length >= 5, 'Provide a short approved explanation for the customer.');

  return transaction(async () => {
    const reason = await one<{ booking_id: string; requester_id: string }>(
      'SELECT booking_id,requester_id FROM provider_cancellation_reasons WHERE id=? FOR UPDATE', data.id,
    );
    assert(reason, 'Cancellation explanation not found.', 404);
    const prior = await one('SELECT id FROM provider_cancellation_reviews WHERE reason_id=? LIMIT 1', data.id);
    assert(!prior, 'This cancellation explanation has already been reviewed.');
    const booking = await one<{ customer_id: string }>('SELECT customer_id FROM bookings WHERE id=?', reason.booking_id);
    assert(booking, 'Booking not found.', 404);
    await insert('provider_cancellation_reviews', {
      id: id(),
      reason_id: data.id,
      reviewer_id: user.id,
      decision: data.decision,
      customer_visible_reason: data.decision === 'APPROVED' ? data.customerVisibleReason : '',
      moderation_note: data.moderationNote,
    });
    await audit(user.id, 'Provider cancellation explanation reviewed', data.id, data.decision);
    const body = data.decision === 'APPROVED'
      ? `The provider’s cancellation explanation was reviewed: ${data.customerVisibleReason}`
      : 'The provider’s additional cancellation explanation was reviewed and will not be shared.';
    await notify(booking.customer_id, 'Cancellation explanation reviewed', body, `/bookings/${reason.booking_id}`);
    return { message: 'Moderation decision recorded. The original provider submission remains in the audit history.' };
  });
}

export async function cancellationReasonForBooking(bookingId: string, viewer: User) {
  await booking(bookingId, viewer);
  const record = await one<{
    reason_code: ProviderCancellationReason;
    requester_id: string;
    submitted_text: string;
    decision: 'APPROVED' | 'REJECTED' | null;
    customer_visible_reason: string | null;
  }>(`SELECT r.reason_code,r.requester_id,r.submitted_text,review.decision,review.customer_visible_reason
      FROM provider_cancellation_reasons r
      LEFT JOIN LATERAL (
        SELECT decision,customer_visible_reason FROM provider_cancellation_reviews
        WHERE reason_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1
      ) review ON TRUE
      WHERE r.booking_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 1`, bookingId);
  if (!record) return undefined;
  return {
    ...record,
    submitted_text: viewer.role === 'ADMIN' || viewer.id === record.requester_id ? record.submitted_text : '',
  };
}
