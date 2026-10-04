import type { User } from '@/lib/domain';
import { assert, requireRole } from '@/lib/domain';
import { z } from 'zod';
import * as book from './bookings';
import * as manage from './management';
import { run, now, audit } from './db';
const str = (d: Record<string, unknown>, key: string) => z.string().min(1).max(5000).parse(d[key]);
export function executeAction(user: User, action: string, data: Record<string, unknown>) {
  requireRole(user, 'CUSTOMER', 'PROVIDER', 'ADMIN');
  switch (action) {
    case 'booking.create':
      return book.createBooking(user, data);
    case 'booking.accept':
      return book.acceptBooking(user, str(data, 'bookingId'));
    case 'booking.cancel':
      return book.cancelBooking(user, str(data, 'bookingId'), str(data, 'reason'));
    case 'booking.pay':
      return book.payBooking(user, str(data, 'bookingId'), data.confirmed);
    case 'booking.dispute':
      return book.openDispute(user, str(data, 'bookingId'), str(data, 'reason'));
    case 'handshake.issue':
      return book.issueHandshake(
        user,
        str(data, 'itemId'),
        z.enum(['START', 'COMPLETE']).parse(data.gate),
      );
    case 'handshake.verify':
      return book.verifyHandshake(
        user,
        str(data, 'itemId'),
        z.enum(['START', 'COMPLETE']).parse(data.gate),
        str(data, 'code'),
      );
    case 'review.create':
      return book.submitReview(user, data);
    case 'profile.save':
      return manage.updateProfile(user, data);
    case 'service.save':
      return manage.saveService(user, data);
    case 'package.save':
      return manage.savePackage(user, data);
    case 'addon.save':
      return manage.saveAddon(user, data);
    case 'addon.remove':
      return manage.removeAddon(user, str(data, 'id'));
    case 'calendar.save':
      return manage.setAvailability(user, data);
    case 'portfolio.save':
      return manage.portfolioAction(user, data);
    case 'bundle.save':
      return manage.saveBundle(user, data);
    case 'bundle.add':
      return manage.addBundleItem(user, data);
    case 'bundle.remove':
      return manage.removeBundleItem(user, str(data, 'id'));
    case 'bundle.respond':
      return manage.respondBundle(user, data);
    case 'bundle.status':
      return manage.bundleStatus(user, str(data, 'id'), str(data, 'status'));
    case 'subscription.save':
      return manage.subscription(user, data);
    case 'placement.save':
      return manage.placement(user, data);
    case 'placement.expire':
      requireRole(user, 'ADMIN');
      run("UPDATE placements SET status='EXPIRED' WHERE id=?", str(data, 'id'));
      audit(user.id, 'Placement expired', str(data, 'id'));
      return { message: 'Placement expired.' };
    case 'voucher.save':
      return manage.saveVoucher(user, data);
    case 'category.save':
      return manage.saveCategory(user, data);
    case 'user.status':
      return manage.adminUser(user, str(data, 'id'), str(data, 'status'));
    case 'provider.verify':
      return manage.adminProvider(user, str(data, 'id'), Number(data.verified));
    case 'service.moderate':
      return manage.adminService(user, str(data, 'id'), Number(data.disabled));
    case 'badge.save':
      return manage.grantBadge(
        user,
        str(data, 'providerId'),
        str(data, 'badge'),
        Number(data.granted),
      );
    case 'settings.save':
      return manage.saveSettings(user, data);
    case 'escrow.manage':
      return book.adminEscrow(
        user,
        str(data, 'bookingId'),
        str(data, 'decision'),
        str(data, 'reason'),
        data.confirmed,
      );
    case 'dispute.review':
      requireRole(user, 'ADMIN');
      run(
        "UPDATE disputes SET status='UNDER_REVIEW',admin_id=? WHERE id=? AND status='OPEN'",
        user.id,
        str(data, 'id'),
      );
      audit(user.id, 'Dispute under review', str(data, 'id'));
      return { message: 'Dispute is under review.' };
    case 'ticket.create':
      return manage.createTicket(user, data);
    case 'ticket.respond':
      return manage.respondTicket(user, data);
    case 'notifications.read':
      if (data.id)
        run(
          'UPDATE notifications SET read_at=? WHERE id=? AND user_id=?',
          now(),
          str(data, 'id'),
          user.id,
        );
      else
        run(
          'UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL',
          now(),
          user.id,
        );
      return { message: 'Notifications marked as read.' };
    default:
      assert(false, 'Unknown action.', 404);
  }
}
