import { run, now } from './db';
import { today } from '@/lib/format';
import type { User } from '@/lib/domain';
// Local, visit-driven delivery. Deterministic notification IDs prevent repeated
// reminders; a production scheduler can call the same routine later.
export async function deliverReminders(user: User) {
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
