import { all, run, now } from './db';
import { today } from '@/lib/format';
import type { User } from '@/lib/domain';

// Local, visit-driven delivery. Deterministic notification IDs prevent repeated
// reminders and let the scheduled worker safely share the same idempotency key.
export async function deliverReminders(user: User) {
    const deadlineHorizon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await run(`INSERT INTO notifications(id,user_id,title,body,href)
      SELECT 'booking-deadline-reminder-'||b.id||'-customer', b.customer_id,
        'A provider response is due soon',
        b.title||' is awaiting a provider response by '||to_char(b.response_deadline_at AT TIME ZONE 'Asia/Manila','Mon DD, YYYY HH12:MI AM')||' PHT.', '/bookings/'||b.id
      FROM bookings b
      WHERE b.customer_id=? AND b.status='PENDING' AND b.expired_at IS NULL
        AND b.response_deadline_at>?::timestamptz AND b.response_deadline_at<=?::timestamptz
      ON CONFLICT DO NOTHING`, user.id, now(), deadlineHorizon);
    if (user.role === 'PROVIDER') {
        await run(`INSERT INTO notifications(id,user_id,title,body,href)
          SELECT DISTINCT 'booking-deadline-reminder-'||b.id||'-'||p.user_id, p.user_id,
            'A booking request needs your reply',
            b.title||' needs your response by '||to_char(b.response_deadline_at AT TIME ZONE 'Asia/Manila','Mon DD, YYYY HH12:MI AM')||' PHT.', '/bookings/'||b.id
          FROM bookings b JOIN booking_items i ON i.booking_id=b.id AND i.status='PENDING'
          JOIN providers p ON p.id=i.provider_id
          WHERE p.user_id=? AND b.status='PENDING' AND b.expired_at IS NULL
            AND b.response_deadline_at>?::timestamptz AND b.response_deadline_at<=?::timestamptz
          ON CONFLICT DO NOTHING`, user.id, now(), deadlineHorizon);
    }
    const nextDay = new Date(new Date(`${today()}T12:00:00Z`).getTime() + 86400000)
        .toISOString()
        .slice(0, 10);
    await run(`INSERT INTO notifications(id,user_id,title,body,href)
      SELECT DISTINCT 'reminder-'||b.id||'-'||?, ?, 'Your celebration is almost here',
      b.title||' is scheduled for '||b.event_date||'. Get your check-in code ready.', '/bookings/'||b.id
      FROM bookings b LEFT JOIN booking_items i ON i.booking_id=b.id LEFT JOIN providers p ON p.id=i.provider_id
      WHERE b.status='CONFIRMED' AND b.event_date BETWEEN ? AND ? AND (b.customer_id=? OR p.user_id=?)
      ON CONFLICT DO NOTHING`, user.id, user.id, today(), nextDay, user.id, user.id);
    if (user.role === 'PROVIDER') {
        const limit = new Date(Date.now() + 2 * 86400000).toISOString();
        await run(`INSERT INTO notifications(id,user_id,title,body,href)
          SELECT 'placement-reminder-'||f.id, ?, 'Your featured placement ends soon',
          lower(f.placement)||' visibility expires on '||substr(f.expires_at,1,10)||'.', '/provider/promotions'
          FROM placements f JOIN providers p ON p.id=f.provider_id WHERE p.user_id=? AND f.status='ACTIVE'
          AND f.expires_at::timestamptz>?::timestamptz AND f.expires_at::timestamptz<=?::timestamptz
          ON CONFLICT DO NOTHING`, user.id, user.id, now(), limit);
    }
}

// The current Vercel schedule runs daily, so the worker checks a 26-hour
// horizon to cover the 24-hour booking window plus schedule drift. This is an
// advance in-app notice, not a two-hour or push-delivery guarantee.
export async function deliverUpcomingBookingDeadlineReminders(at = new Date(), limit = 100) {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const from = at.toISOString();
    const through = new Date(at.getTime() + 26 * 60 * 60 * 1000).toISOString();
    const inserted = await all<{ id: string }>(`WITH candidates AS (
      SELECT b.id
      FROM bookings b
      WHERE b.status='PENDING' AND b.expired_at IS NULL
        AND b.response_deadline_at>?::timestamptz AND b.response_deadline_at<=?::timestamptz
        AND (
          NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id='booking-deadline-reminder-'||b.id||'-customer')
          OR EXISTS (
            SELECT 1 FROM booking_items i JOIN providers p ON p.id=i.provider_id
            WHERE i.booking_id=b.id AND i.status='PENDING'
              AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id='booking-deadline-reminder-'||b.id||'-'||p.user_id)
          )
        )
      ORDER BY b.response_deadline_at,b.id
      LIMIT ?
    ), recipients AS (
      SELECT b.id booking_id,b.title,b.response_deadline_at,b.customer_id user_id,'customer' id_suffix,'customer' recipient_type
      FROM candidates c JOIN bookings b ON b.id=c.id
      UNION ALL
      SELECT b.id booking_id,b.title,b.response_deadline_at,p.user_id,p.user_id,'provider'
      FROM candidates c JOIN bookings b ON b.id=c.id
      JOIN booking_items i ON i.booking_id=b.id AND i.status='PENDING'
      JOIN providers p ON p.id=i.provider_id
    )
    INSERT INTO notifications(id,user_id,title,body,href)
    SELECT 'booking-deadline-reminder-'||booking_id||'-'||id_suffix,user_id,
      CASE WHEN recipient_type='customer' THEN 'A provider response deadline is approaching' ELSE 'A booking request needs your reply' END,
      title||CASE WHEN recipient_type='customer' THEN ' is awaiting provider responses by ' ELSE ' needs your response by ' END
        ||to_char(response_deadline_at AT TIME ZONE 'Asia/Manila','Mon DD, YYYY HH12:MI AM')||' PHT.',
      '/bookings/'||booking_id
    FROM recipients
    ON CONFLICT DO NOTHING
    RETURNING id`, from, through, boundedLimit);
    return { delivered: inserted.length, through };
}
