import { all, run, now } from './db';
import { today } from '@/lib/format';
import type { User } from '@/lib/domain';
// Local, visit-driven delivery. Deterministic notification IDs prevent repeated
// reminders; a production scheduler can call the same routine later.
export async function deliverReminders(user: User) {
    const nextDay = new Date(new Date(`${today()}T12:00:00Z`).getTime() + 86400000)
        .toISOString()
        .slice(0, 10);
    const upcoming = (await all<{
        id: string;
        title: string;
        event_date: string;
    }>(`SELECT DISTINCT b.id,b.title,b.event_date FROM bookings b LEFT JOIN booking_items i ON i.booking_id=b.id LEFT JOIN providers p ON p.id=i.provider_id WHERE b.status='CONFIRMED' AND b.event_date BETWEEN ? AND ? AND (b.customer_id=? OR p.user_id=?)`, today(), nextDay, user.id, user.id));
    for (const b of upcoming)
        (await run('INSERT INTO notifications(id,user_id,title,body,href) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING', `reminder-${b.id}-${user.id}`, user.id, 'Your celebration is almost here', `${b.title} is scheduled for ${b.event_date}. Get your check-in code ready.`, `/bookings/${b.id}`));
    if (user.role === 'PROVIDER') {
        const limit = new Date(Date.now() + 2 * 86400000).toISOString();
        const expiring = (await all<{
            id: string;
            placement: string;
            expires_at: string;
        }>("SELECT f.* FROM placements f JOIN providers p ON p.id=f.provider_id WHERE p.user_id=? AND f.status='ACTIVE' AND f.expires_at>? AND f.expires_at<=?", user.id, now(), limit));
        for (const f of expiring)
            (await run('INSERT INTO notifications(id,user_id,title,body,href) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING', `placement-reminder-${f.id}`, user.id, 'Your featured placement ends soon', `${f.placement.toLowerCase()} visibility expires on ${f.expires_at.slice(0, 10)}.`, '/provider/promotions'));
    }
}
