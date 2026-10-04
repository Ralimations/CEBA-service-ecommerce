import type { User } from '@/lib/domain';
import { assert, requireRole } from '@/lib/domain';
import { z } from 'zod';
import * as book from './bookings';
import * as manage from './management';
import { run, now, audit } from './db';
const str = (d: Record<string, unknown>, key: string) => z.string().min(1).max(5000).parse(d[key]);
export async function executeAction(user: User, action: string, data: Record<string, unknown>) {
    requireRole(user, 'CUSTOMER', 'PROVIDER', 'ADMIN');
    switch (action) {
        case 'booking.create':
            return (await book.createBooking(user, data));
        case 'booking.accept':
            return (await book.acceptBooking(user, str(data, 'bookingId')));
        case 'booking.cancel':
            return (await book.cancelBooking(user, str(data, 'bookingId'), str(data, 'reason')));
        case 'booking.pay':
            return (await book.payBooking(user, str(data, 'bookingId'), data.confirmed));
        case 'booking.dispute':
            return (await book.openDispute(user, str(data, 'bookingId'), str(data, 'reason')));
        case 'handshake.issue':
            return (await book.issueHandshake(user, str(data, 'itemId'), z.enum(['START', 'COMPLETE']).parse(data.gate)));
        case 'handshake.verify':
            return (await book.verifyHandshake(user, str(data, 'itemId'), z.enum(['START', 'COMPLETE']).parse(data.gate), str(data, 'code')));
        case 'review.create':
            return (await book.submitReview(user, data));
        case 'profile.save':
            return (await manage.updateProfile(user, data));
        case 'service.save':
            return (await manage.saveService(user, data));
        case 'package.save':
            return (await manage.savePackage(user, data));
        case 'addon.save':
            return (await manage.saveAddon(user, data));
        case 'addon.remove':
            return (await manage.removeAddon(user, str(data, 'id')));
        case 'calendar.save':
            return (await manage.setAvailability(user, data));
        case 'portfolio.save':
            return (await manage.portfolioAction(user, data));
        case 'bundle.save':
            return (await manage.saveBundle(user, data));
        case 'bundle.add':
            return (await manage.addBundleItem(user, data));
        case 'bundle.remove':
            return (await manage.removeBundleItem(user, str(data, 'id')));
        case 'bundle.respond':
            return (await manage.respondBundle(user, data));
        case 'bundle.status':
            return (await manage.bundleStatus(user, str(data, 'id'), str(data, 'status')));
        case 'subscription.save':
            return (await manage.subscription(user, data));
        case 'placement.save':
            return (await manage.placement(user, data));
        case 'placement.expire':
            requireRole(user, 'ADMIN');
            (await run("UPDATE placements SET status='EXPIRED' WHERE id=?", str(data, 'id')));
            (await audit(user.id, 'Placement expired', str(data, 'id')));
            return { message: 'Placement expired.' };
        case 'voucher.save':
            return (await manage.saveVoucher(user, data));
        case 'category.save':
            return (await manage.saveCategory(user, data));
        case 'user.status':
            return (await manage.adminUser(user, str(data, 'id'), str(data, 'status')));
        case 'provider.verify':
            return (await manage.adminProvider(user, str(data, 'id'), Number(data.verified)));
        case 'service.moderate':
            return (await manage.adminService(user, str(data, 'id'), Number(data.disabled)));
        case 'badge.save':
            return (await manage.grantBadge(user, str(data, 'providerId'), str(data, 'badge'), Number(data.granted)));
        case 'settings.save':
            return (await manage.saveSettings(user, data));
        case 'escrow.manage':
            return (await book.adminEscrow(user, str(data, 'bookingId'), str(data, 'decision'), str(data, 'reason'), data.confirmed));
        case 'dispute.review':
            requireRole(user, 'ADMIN');
            (await run("UPDATE disputes SET status='UNDER_REVIEW',admin_id=? WHERE id=? AND status='OPEN'", user.id, str(data, 'id')));
            (await audit(user.id, 'Dispute under review', str(data, 'id')));
            return { message: 'Dispute is under review.' };
        case 'ticket.create':
            return (await manage.createTicket(user, data));
        case 'ticket.respond':
            return (await manage.respondTicket(user, data));
        case 'notifications.read':
            if (data.id)
                (await run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?', now(), str(data, 'id'), user.id));
            else
                (await run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now(), user.id));
            return { message: 'Notifications marked as read.' };
        default:
            assert(false, 'Unknown action.', 404);
    }
}
