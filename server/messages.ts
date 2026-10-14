import { z } from 'zod';
import { assert, requireRole, type User } from '@/lib/domain';
import { all, audit, id, insert, now, one, run, transaction } from './db';

const messageSchema = z.object({
  itemId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});
const reportSchema = z.object({
  messageId: z.string().uuid(),
  category: z.enum(['HARASSMENT', 'SPAM', 'SAFETY', 'OTHER']),
  details: z.string().trim().max(1000).default(''),
});

type Conversation = {
  item_id: string;
  booking_id: string;
  booking_status: string;
  customer_id: string;
  provider_user_id: string;
  provider_name: string;
  disputed: boolean;
};

function enabled() {
  assert(process.env.FEATURE_BOOKING_MESSAGING === 'true', 'Booking messaging is not enabled.', 404);
}

async function conversation(user: User, itemId: string, write = false) {
  requireRole(user, 'CUSTOMER', 'PROVIDER', 'ADMIN');
  const active = await one<{ status: string; role: string }>('SELECT status,role FROM users WHERE id=?', user.id);
  assert(active?.status === 'ACTIVE' && active.role === user.role, 'An active account is required to access booking messages.', 403);
  const row = await one<Conversation>(
    `SELECT i.id item_id,b.id booking_id,b.status booking_status,b.customer_id,
            pu.id provider_user_id,p.business_name provider_name,
            EXISTS(SELECT 1 FROM disputes d WHERE d.booking_id=b.id AND d.status IN ('OPEN','UNDER_REVIEW')) disputed
       FROM booking_items i JOIN bookings b ON b.id=i.booking_id
       JOIN providers p ON p.id=i.provider_id JOIN users pu ON pu.id=p.user_id
      WHERE i.id=?`, itemId,
  );
  assert(row, 'Conversation not found.', 404);
  const participant = (user.role === 'CUSTOMER' && user.id === row.customer_id) ||
    (user.role === 'PROVIDER' && user.id === row.provider_user_id);
  const adminDisputeReview = user.role === 'ADMIN' && row.disputed;
  assert(participant || adminDisputeReview, 'Conversation not found.', 404);
  assert(row.booking_status !== 'CANCELLED', 'This booking conversation is closed.', 404);
  if (write) {
    assert(participant, 'Administrators can review disputed messages but cannot send as either party.', 403);
    assert(!row.disputed, 'Messaging is paused while this booking is under dispute review.', 409);
  }
  return { ...row, canSend: participant && !row.disputed };
}

export async function readConversation(user: User, itemId: string) {
  enabled();
  const access = await conversation(user, itemId);
  const timestamp = now();
  let unread = 0;
  if (user.id === access.customer_id || user.id === access.provider_user_id) {
    unread = (await one<{ count: number }>(
      'SELECT COUNT(*)::int count FROM booking_messages WHERE booking_item_id=? AND recipient_id=? AND read_at IS NULL',
      itemId, user.id,
    ))?.count ?? 0;
    await run('UPDATE booking_messages SET read_at=? WHERE booking_item_id=? AND recipient_id=? AND read_at IS NULL',
      timestamp, itemId, user.id);
  }
  const rows = await all<{
    id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null;
  }>(`SELECT id,sender_id,recipient_id,body,created_at,read_at FROM (
       SELECT id,sender_id,recipient_id,body,created_at,read_at FROM booking_messages
       WHERE booking_item_id=? ORDER BY created_at DESC,id DESC LIMIT 200
     ) latest ORDER BY created_at,id`, itemId);
  return {
    itemId, bookingId: access.booking_id, providerName: access.provider_name,
    canSend: access.canSend, messages: rows, unread,
  };
}

async function consumeSendLimit(user: User) {
  const current = new Date();
  await run('INSERT INTO booking_message_rate_limits(sender_id,window_started_at,message_count) VALUES(?,?,1) ON CONFLICT(sender_id) DO NOTHING',
    user.id, current.toISOString());
  const existing = await one<{ window_started_at: string; message_count: number }>(
    'SELECT window_started_at,message_count FROM booking_message_rate_limits WHERE sender_id=? FOR UPDATE', user.id,
  );
  assert(existing, 'Message rate limit is temporarily unavailable.', 503);
  if (current.getTime() - Date.parse(existing.window_started_at) >= 10 * 60_000) {
    await run('UPDATE booking_message_rate_limits SET window_started_at=?,message_count=1 WHERE sender_id=?', current.toISOString(), user.id);
    return;
  }
  assert(existing.message_count < 20, 'You have sent several messages. Please wait a few minutes before sending more.', 429);
  await run('UPDATE booking_message_rate_limits SET message_count=message_count+1 WHERE sender_id=?', user.id);
}

export async function sendBookingMessage(user: User, input: unknown) {
  enabled();
  requireRole(user, 'CUSTOMER', 'PROVIDER');
  const data = messageSchema.parse(input);
  return transaction(async () => {
    const firstAccess = await conversation(user, data.itemId, true);
    await one('SELECT id FROM bookings WHERE id=? FOR UPDATE', firstAccess.booking_id);
    const access = await conversation(user, data.itemId, true);
    const recipient = user.id === access.customer_id ? access.provider_user_id : access.customer_id;
    await consumeSendLimit(user);
    const messageId = id();
    const timestamp = now();
    await insert('booking_messages', {
      id: messageId, booking_item_id: data.itemId, sender_id: user.id,
      recipient_id: recipient, body: data.body, created_at: timestamp,
    });
    await insert('notifications', {
      id: `booking-message-${messageId}`, user_id: recipient,
      title: 'New booking message', body: `${user.name} sent a message about ${access.provider_name}.`,
      href: `/bookings/${access.booking_id}`,
    });
    return { message: 'Message sent.', messageId };
  });
}

export async function reportBookingMessage(user: User, input: unknown) {
  enabled();
  requireRole(user, 'CUSTOMER', 'PROVIDER');
  const data = reportSchema.parse(input);
  const message = await one<{ id: string; booking_item_id: string; sender_id: string }>(
    'SELECT id,booking_item_id,sender_id FROM booking_messages WHERE id=?', data.messageId,
  );
  assert(message, 'Message not found.', 404);
  await conversation(user, message.booking_item_id);
  assert(message.sender_id !== user.id, 'You can report messages from the other booking participant.', 400);
  const reportId = id();
  await run(`INSERT INTO booking_message_reports(id,message_id,reporter_id,category,details)
    VALUES(?,?,?,?,?) ON CONFLICT(message_id,reporter_id) DO NOTHING`,
    reportId, message.id, user.id, data.category, data.details);
  return { message: 'The message was sent to the administrator review queue.' };
}

export async function bookingMessageReports(user: User) {
  requireRole(user, 'ADMIN');
  return all<{
    id: string; message_id: string; category: string; details: string; status: string;
    internal_note: string; created_at: string; reviewed_at: string | null;
    reporter_name: string; sender_name: string; message_body: string;
    booking_id: string; booking_title: string; provider_name: string;
  }>(`SELECT r.id,r.message_id,r.category,r.details,r.status,r.internal_note,r.created_at,r.reviewed_at,
      reporter.name reporter_name,sender.name sender_name,m.body message_body,b.id booking_id,
      b.title booking_title,p.business_name provider_name
    FROM booking_message_reports r JOIN booking_messages m ON m.id=r.message_id
    JOIN users reporter ON reporter.id=r.reporter_id JOIN users sender ON sender.id=m.sender_id
    JOIN booking_items i ON i.id=m.booking_item_id JOIN bookings b ON b.id=i.booking_id
    JOIN providers p ON p.id=i.provider_id ORDER BY CASE WHEN r.status='OPEN' THEN 0 ELSE 1 END,r.created_at DESC`);
}

export async function reviewBookingMessageReport(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z.object({
    id: z.string().uuid(), status: z.enum(['REVIEWED', 'RESOLVED']),
    internalNote: z.string().trim().max(2000).default(''),
  }).parse(input);
  const result = await run(`UPDATE booking_message_reports
    SET status=?,internal_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='OPEN'`,
    data.status, data.internalNote, user.id, now(), data.id);
  assert(result.changes === 1, 'This report has already been reviewed.', 409);
  await audit(user.id, 'Booking message report reviewed', `${data.id}:${data.status}`);
  return { message: 'Message report review saved.' };
}
