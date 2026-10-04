import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { one, run, insert, transaction, id, now, notify, admins, settings, audit } from './db';
import { available, booking, bookingItems, bundles, packagesFor, service } from './queries';
import { validateVoucher, rewardReferral } from './vouchers';
import { assert, requireRole, checkTransition, type User, type BookingStatus } from '@/lib/domain';
import { today } from '@/lib/format';
import { hashToken } from './security';
import type { Booking } from '@/types/models';
export const eventDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
  .refine(
    (x) => !Number.isNaN(Date.parse(x)) && new Date(`${x}T00:00:00Z`).toISOString().startsWith(x),
    'Choose a valid date.',
  );
const createSchema = z.object({
  packageId: z.string().optional(),
  bundleId: z.string().optional(),
  eventDate: eventDate.refine((x) => x >= today(), 'Choose today or a future event date.'),
  eventType: z.string().trim().min(2).max(100),
  location: z.string().trim().min(5).max(300),
  guests: z.coerce.number().int().min(1).max(100000),
  contact: z.string().trim().min(5).max(200),
  requests: z.string().max(3000).default(''),
  voucher: z.string().max(50).default(''),
  addons: z.array(z.string()).default([]),
});
export function event(bookingId: string, actorId: string, label: string, detail = '') {
  insert('booking_events', {
    id: id(),
    booking_id: bookingId,
    actor_id: actorId,
    event: label,
    detail,
  });
}
export function notifyBooking(b: Booking, title: string, body: string) {
  const recipients = new Set([b.customer_id, ...b.items.map((i) => i.provider_user_id)]);
  for (const recipient of recipients) notify(recipient, title, body, `/bookings/${b.id}`);
}
function transition(b: Booking, next: BookingStatus, actor: string, label: string, detail = '') {
  checkTransition(b.status, next);
  run('UPDATE bookings SET status=? WHERE id=?', next, b.id);
  event(b.id, actor, label, detail);
  b.status = next;
}
export function createBooking(user: User, input: unknown) {
  requireRole(user, 'CUSTOMER');
  const data = createSchema.parse(input);
  return transaction(() => {
    assert(!!data.packageId !== !!data.bundleId, 'Choose one service package or one bundle.');
    const selected: {
      providerId: string;
      serviceId: string;
      packageId: string;
      title: string;
      packageName: string;
      inclusions: string;
      terms: string;
      price: number;
      categoryId: string;
      addons: { name: string; price: number }[];
    }[] = [];
    let title = '',
      bundleDiscount = 0;
    if (data.bundleId) {
      const bundle = bundles(data.eventDate).find((b) => b.id === data.bundleId);
      assert(bundle?.ready, 'This bundle is not yet ready for booking.');
      assert(bundle.available, 'At least one bundle provider is unavailable on this date.');
      title = bundle.name;
      bundleDiscount = bundle.discount_percent;
      for (const item of bundle.items) {
        const s = service(item.service_id);
        assert(s, 'A service in this bundle is no longer available.');
        assert(
          data.guests >= s.min_guests && data.guests <= s.max_guests,
          `${s.title} supports ${s.min_guests}–${s.max_guests} guests.`,
        );
        selected.push({
          providerId: item.provider_id,
          serviceId: item.service_id,
          packageId: item.package_id,
          title: item.service_title,
          packageName: item.package_name,
          inclusions: item.inclusions,
          terms: `${item.terms}\nExclusions: ${item.exclusions}`,
          price: item.price,
          categoryId: item.category_id,
          addons: [],
        });
      }
    } else {
      const packageRow = one<{ service_id: string }>(
        'SELECT service_id FROM packages WHERE id=? AND active=1',
        data.packageId!,
      );
      assert(packageRow, 'Package not found.');
      const s = service(packageRow.service_id);
      assert(s, 'This service is no longer available.');
      const p = packagesFor(s.id).find((p) => p.id === data.packageId)!;
      assert(
        available(s.provider_id, data.eventDate),
        'This provider is unavailable on that date.',
      );
      assert(
        data.guests >= s.min_guests && data.guests <= s.max_guests,
        `This service supports ${s.min_guests}–${s.max_guests} guests.`,
      );
      const addons = data.addons.map((addonId) => {
        const a = one<{ name: string; price: number }>(
          'SELECT name,price FROM addons WHERE id=? AND service_id=? AND active=1',
          addonId,
          s.id,
        );
        assert(a, 'An add-on is no longer available.');
        return a;
      });
      assert(
        new Set(data.addons).size === data.addons.length,
        'Duplicate add-ons are not allowed.',
      );
      title = s.title;
      selected.push({
        providerId: s.provider_id,
        serviceId: s.id,
        packageId: p.id,
        title: s.title,
        packageName: p.name,
        inclusions: p.inclusions,
        terms: `${p.terms}\nExclusions: ${p.exclusions}`,
        price: p.price + addons.reduce((n, a) => n + a.price, 0),
        categoryId: s.category_id,
        addons,
      });
    }
    const original = selected.reduce((s, i) => s + i.price, 0);
    const subtotal = Math.round(original * (1 - bundleDiscount / 100));
    const promo = data.voucher
      ? validateVoucher(
          data.voucher,
          user.id,
          subtotal,
          selected.map((s) => s.categoryId),
        )
      : null;
    const discount = promo?.discount || 0;
    const total = subtotal - discount;
    const fee = Math.round((total * settings().platformFee) / 100);
    const bookingId = id();
    insert('bookings', {
      id: bookingId,
      customer_id: user.id,
      bundle_id: data.bundleId || null,
      title,
      event_date: data.eventDate,
      event_type: data.eventType,
      location: data.location,
      guests: data.guests,
      contact: data.contact,
      requests: data.requests,
      subtotal,
      discount,
      total,
      platform_fee: fee,
      voucher_id: promo?.voucher.id || null,
    });
    let allocated = 0,
      fees = 0;
    selected.forEach((s, index) => {
      const last = index === selected.length - 1;
      const allocation = last ? total - allocated : Math.floor((total * s.price) / original);
      const itemFee = last ? fee - fees : Math.floor((fee * s.price) / original);
      allocated += allocation;
      fees += itemFee;
      const itemId = id();
      insert('booking_items', {
        id: itemId,
        booking_id: bookingId,
        provider_id: s.providerId,
        service_id: s.serviceId,
        package_id: s.packageId,
        title: s.title,
        package_name: s.packageName,
        inclusions: s.inclusions,
        terms: s.terms,
        price: s.price,
        allocation,
        platform_fee: itemFee,
      });
      for (const addon of s.addons)
        insert('booking_addons', { id: id(), booking_item_id: itemId, ...addon });
    });
    event(
      bookingId,
      user.id,
      'Booking submitted',
      'Waiting for all participating providers to accept.',
    );
    notifyBooking(booking(bookingId, user), 'New booking request', `${title} · ${data.eventDate}`);
    return {
      redirect: `/bookings/${bookingId}`,
      message: 'Booking request sent. You can pay after all providers accept.',
    };
  });
}
export function acceptBooking(user: User, bookingId: string) {
  requireRole(user, 'PROVIDER');
  return transaction(() => {
    const b = booking(bookingId, user);
    assert(b.status === 'PENDING', 'This request is no longer pending.');
    const item = b.items.find((i) => i.provider_user_id === user.id)!;
    assert(item.status === 'PENDING', 'You have already responded.');
    assert(
      available(item.provider_id, b.event_date, b.id),
      'You already have an accepted booking or blocked date.',
    );
    assert(service(item.service_id), 'The booked service must be active before accepting.');
    insert('reservations', { provider_id: item.provider_id, date: b.event_date, booking_id: b.id });
    run("UPDATE booking_items SET status='ACCEPTED' WHERE id=?", item.id);
    event(b.id, user.id, 'Provider accepted', item.business_name);
    if (bookingItems(b.id).every((i) => i.status === 'ACCEPTED')) {
      transition(b, 'ACCEPTED', user.id, 'All providers accepted');
      notify(
        b.customer_id,
        'Your booking is accepted',
        'Complete the development checkout to confirm your date.',
        `/checkout/${b.id}`,
      );
    }
    return { message: 'Booking accepted. This date is now reserved.' };
  });
}
export function cancelBooking(user: User, bookingId: string, reason: string) {
  const text = z.string().trim().min(5, 'Please give a short reason.').max(1000).parse(reason);
  return transaction(() => {
    const b = booking(bookingId, user);
    assert(
      ['CUSTOMER', 'PROVIDER'].includes(user.role),
      'Use admin escrow controls for platform interventions.',
    );
    if (['CONFIRMED', 'IN_PROGRESS', 'COMPLETION_PENDING'].includes(b.status))
      return openDisputeInside(user, b, `Cancellation request: ${text}`);
    assert(
      ['PENDING', 'ACCEPTED'].includes(b.status),
      'This booking cannot be cancelled at this stage.',
    );
    transition(b, 'CANCELLED', user.id, 'Booking cancelled', text);
    run("UPDATE booking_items SET status='CANCELLED' WHERE booking_id=?", b.id);
    run('DELETE FROM reservations WHERE booking_id=?', b.id);
    notifyBooking(b, 'Booking cancelled', text);
    return {
      message: 'Booking cancelled. Reserved dates and unused voucher reservations were released.',
    };
  });
}
export function payBooking(user: User, bookingId: string, confirmed: unknown) {
  requireRole(user, 'CUSTOMER');
  assert(confirmed === true || confirmed === 'on', 'Confirm that this is a simulated payment.');
  return transaction(() => {
    const b = booking(bookingId, user);
    assert(
      b.status === 'ACCEPTED' && b.escrow_status === 'UNPAID',
      'Payment requires an accepted, unpaid booking.',
    );
    assert(b.event_date >= today(), 'The event date has passed. Please create a new request.');
    assert(
      b.items.every(
        (i) =>
          available(i.provider_id, b.event_date, b.id) &&
          !!one(
            'SELECT 1 FROM reservations WHERE provider_id=? AND date=? AND booking_id=?',
            i.provider_id,
            b.event_date,
            b.id,
          ),
      ),
      'A provider is no longer available.',
    );
    assert(
      b.items.every((i) => !!service(i.service_id)),
      'A service or provider is no longer active.',
    );
    if (b.voucher_id) {
      const v = one<{ code: string }>('SELECT code FROM vouchers WHERE id=?', b.voucher_id)!;
      const categories = b.items.map(
        (i) =>
          one<{ category_id: string }>('SELECT category_id FROM services WHERE id=?', i.service_id)!
            .category_id,
      );
      const current = validateVoucher(v.code, user.id, b.subtotal, categories, b.id);
      assert(
        current.discount === b.discount,
        'The voucher changed. Cancel and submit a new request for an updated quote.',
      );
      insert('voucher_redemptions', {
        id: id(),
        voucher_id: b.voucher_id,
        user_id: user.id,
        booking_id: b.id,
      });
    }
    insert('payments', {
      id: id(),
      booking_id: b.id,
      user_id: user.id,
      amount: b.total,
      purpose: 'Development booking payment',
    });
    insert('escrow_transactions', {
      id: id(),
      booking_id: b.id,
      provider_id: null,
      type: 'HOLD',
      amount: b.total,
      fee: b.platform_fee,
      actor_id: user.id,
      note: 'Development Payment Simulation — no currency transferred',
    });
    run("UPDATE bookings SET escrow_status='HELD_IN_ESCROW' WHERE id=?", b.id);
    run("UPDATE booking_items SET status='CONFIRMED' WHERE booking_id=?", b.id);
    transition(b, 'CONFIRMED', user.id, 'Payment placed in escrow', 'Booking confirmed.');
    notifyBooking(
      b,
      'Booking confirmed',
      'Your date is secured and the simulated payment is held in escrow.',
    );
    return {
      redirect: `/bookings/${b.id}`,
      message: 'Development payment complete. Funds held in mock escrow.',
    };
  });
}
function itemFor(user: User, itemId: string) {
  const row = one<{ booking_id: string }>(
    'SELECT booking_id FROM booking_items WHERE id=?',
    itemId,
  );
  assert(row, 'Booking item not found.', 404);
  const b = booking(row.booking_id, user);
  return { b, item: b.items.find((i) => i.id === itemId)! };
}
export function issueHandshake(user: User, itemId: string, gate: 'START' | 'COMPLETE') {
  return transaction(() => {
    const { b, item } = itemFor(user, itemId);
    assert(
      b.escrow_status === 'HELD_IN_ESCROW',
      'Verification is unavailable while payment is unpaid, frozen, or settled.',
    );
    if (gate === 'START') {
      requireRole(user, 'CUSTOMER');
      assert(
        b.customer_id === user.id && item.status === 'CONFIRMED',
        'Check-in requires your confirmed booking.',
      );
    } else {
      requireRole(user, 'PROVIDER');
      assert(
        item.provider_user_id === user.id &&
          ['IN_PROGRESS', 'COMPLETION_PENDING'].includes(item.status),
        'Start this service before requesting completion.',
      );
    }
    if ((process.env.DEMO_HANDSHAKE_ANYTIME ?? 'true') !== 'true')
      assert(b.event_date <= today(), 'Verification opens on the event date.');
    run(
      'UPDATE handshake_tokens SET used_at=? WHERE booking_item_id=? AND gate=? AND used_at IS NULL',
      now(),
      item.id,
      gate,
    );
    const token = randomBytes(6).toString('hex').toUpperCase();
    const expires = new Date(Date.now() + 30 * 60000).toISOString();
    insert('handshake_tokens', {
      id: id(),
      booking_item_id: item.id,
      gate,
      token_hash: hashToken(token),
      issuer_id: user.id,
      expires_at: expires,
    });
    if (gate === 'COMPLETE') {
      run("UPDATE booking_items SET status='COMPLETION_PENDING' WHERE id=?", item.id);
      if (
        bookingItems(b.id).every((i) => ['COMPLETION_PENDING', 'COMPLETED'].includes(i.status)) &&
        b.status === 'IN_PROGRESS'
      )
        transition(b, 'COMPLETION_PENDING', user.id, 'Completion requested');
    }
    event(
      b.id,
      user.id,
      gate === 'START' ? 'Check-in code generated' : 'Completion code generated',
      item.business_name,
    );
    notifyBooking(
      b,
      'Verification code ready',
      `${item.business_name}: ${gate === 'START' ? 'check-in' : 'completion'} verification is ready.`,
    );
    return {
      message: 'Code generated. Share it only with the other party for this service.',
      code: token,
      expires,
      gate,
      itemId,
    };
  });
}
function release(b: Booking, actorId: string, note: string) {
  assert(
    ['HELD_IN_ESCROW', 'DISPUTED'].includes(b.escrow_status),
    'Escrow is already settled or unpaid.',
  );
  for (const item of b.items)
    insert('escrow_transactions', {
      id: id(),
      booking_id: b.id,
      provider_id: item.provider_id,
      type: 'RELEASE',
      amount: item.allocation - item.platform_fee,
      fee: item.platform_fee,
      actor_id: actorId,
      note,
    });
  run("UPDATE bookings SET escrow_status='RELEASED' WHERE id=?", b.id);
  event(b.id, actorId, 'Escrow released', note);
  rewardReferral(b.customer_id);
  notifyBooking(
    b,
    'Booking completed · escrow released',
    'Thank you for celebrating together. The customer can now leave a review.',
  );
}
export function verifyHandshake(
  user: User,
  itemId: string,
  gate: 'START' | 'COMPLETE',
  input: string,
) {
  const { b: preview, item: previewItem } = itemFor(user, itemId);
  if (gate === 'START') {
    requireRole(user, 'PROVIDER');
    assert(
      previewItem.provider_user_id === user.id,
      'Only this provider can verify check-in.',
      403,
    );
  } else {
    requireRole(user, 'CUSTOMER');
    assert(
      preview.customer_id === user.id,
      'Only the booking customer can verify completion.',
      403,
    );
  }
  const token = one<{
    id: string;
    token_hash: string;
    issuer_id: string;
    expires_at: string;
    attempts: number;
    used_at: string | null;
  }>(
    'SELECT * FROM handshake_tokens WHERE booking_item_id=? AND gate=? ORDER BY created_at DESC,rowid DESC LIMIT 1',
    itemId,
    gate,
  );
  assert(
    token && !token.used_at && token.expires_at > now() && token.attempts < 5,
    'This code has expired, was used, or is locked. Ask for a new code.',
  );
  assert(token.issuer_id !== user.id, 'The code must be verified by the other party.', 403);
  if (hashToken(input.trim().toUpperCase()) !== token.token_hash) {
    run('UPDATE handshake_tokens SET attempts=attempts+1 WHERE id=?', token.id);
    assert(false, 'Incorrect verification code. Five failed attempts lock this code.');
  }
  return transaction(() => {
    const { b, item } = itemFor(user, itemId);
    assert(
      b.escrow_status === 'HELD_IN_ESCROW',
      'Verification cannot proceed while escrow is frozen or settled.',
    );
    const updated = run(
      'UPDATE handshake_tokens SET used_at=?,verified_by=? WHERE id=? AND used_at IS NULL AND expires_at>?',
      now(),
      user.id,
      token.id,
      now(),
    );
    assert(updated.changes === 1, 'This code has already been used.');
    if (gate === 'START') {
      assert(item.status === 'CONFIRMED', 'This service has already started.');
      run("UPDATE booking_items SET status='IN_PROGRESS' WHERE id=?", item.id);
      if (b.status === 'CONFIRMED')
        transition(
          b,
          'IN_PROGRESS',
          user.id,
          'Service check-in verified',
          `${item.business_name}; token ${token.id}; issuer ${token.issuer_id}`,
        );
      else
        event(
          b.id,
          user.id,
          'Service check-in verified',
          `${item.business_name}; token ${token.id}; issuer ${token.issuer_id}`,
        );
    } else {
      assert(item.status === 'COMPLETION_PENDING', 'The provider must request completion first.');
      run("UPDATE booking_items SET status='COMPLETED' WHERE id=?", item.id);
      event(
        b.id,
        user.id,
        'Service completion verified',
        `${item.business_name}; token ${token.id}; issuer ${token.issuer_id}`,
      );
      if (bookingItems(b.id).every((i) => i.status === 'COMPLETED')) {
        if (b.status === 'IN_PROGRESS')
          transition(b, 'COMPLETION_PENDING', user.id, 'All suppliers completed');
        transition(b, 'COMPLETED', user.id, 'Booking completed');
        release(b, user.id, 'All suppliers passed both verification gates.');
      }
    }
    notifyBooking(
      b,
      gate === 'START' ? 'Service started' : 'Service completion verified',
      item.business_name,
    );
    return {
      message:
        gate === 'START'
          ? 'Check-in verified. Service is now in progress.'
          : 'Completion verified. Escrow releases when all suppliers finish.',
    };
  });
}
function openDisputeInside(user: User, b: Booking, reason: string) {
  assert(
    ['CONFIRMED', 'IN_PROGRESS', 'COMPLETION_PENDING'].includes(b.status) &&
      b.escrow_status === 'HELD_IN_ESCROW',
    'A dispute can only be opened before held escrow is released.',
  );
  transition(b, 'DISPUTED', user.id, 'Dispute opened', reason);
  run("UPDATE bookings SET escrow_status='DISPUTED' WHERE id=?", b.id);
  insert('disputes', { id: id(), booking_id: b.id, user_id: user.id, reason });
  insert('escrow_transactions', {
    id: id(),
    booking_id: b.id,
    type: 'FREEZE',
    amount: 0,
    actor_id: user.id,
    note: reason,
  });
  notifyBooking(b, 'Escrow frozen for review', reason);
  admins('New dispute', reason, '/admin/disputes');
  return { message: 'Dispute opened. Escrow is frozen until administrator review.' };
}
export function openDispute(user: User, bookingId: string, reason: string) {
  requireRole(user, 'CUSTOMER', 'PROVIDER');
  return transaction(() =>
    openDisputeInside(
      user,
      booking(bookingId, user),
      z.string().trim().min(10).max(2000).parse(reason),
    ),
  );
}
export function adminEscrow(
  user: User,
  bookingId: string,
  action: string,
  reason: string,
  confirmed: unknown,
) {
  requireRole(user, 'ADMIN');
  assert(confirmed === true || confirmed === 'on', 'Confirm this administrator escrow action.');
  const note = z.string().trim().min(10).max(2000).parse(reason);
  return transaction(() => {
    const b = booking(bookingId, user);
    assert(
      ['HELD_IN_ESCROW', 'DISPUTED'].includes(b.escrow_status),
      'Only held or disputed escrow can be managed.',
    );
    if (action === 'freeze') {
      if (b.status !== 'DISPUTED') openDisputeInside(user, b, note);
      else assert(false, 'Escrow is already frozen.');
    } else {
      assert(action === 'refund' || action === 'release', 'Choose release, refund, or freeze.');
      assert(b.status === 'DISPUTED', 'Freeze and review the booking before a manual settlement.');
      if (action === 'refund') {
        transition(b, 'CANCELLED', user.id, 'Administrator refunded booking', note);
        run("UPDATE bookings SET escrow_status='REFUNDED' WHERE id=?", b.id);
        run("UPDATE booking_items SET status='CANCELLED' WHERE booking_id=?", b.id);
        run('DELETE FROM reservations WHERE booking_id=?', b.id);
        insert('escrow_transactions', {
          id: id(),
          booking_id: b.id,
          type: 'REFUND',
          amount: b.total,
          actor_id: user.id,
          note,
        });
        notifyBooking(b, 'Simulated payment refunded', note);
      } else {
        run("UPDATE booking_items SET status='COMPLETED' WHERE booking_id=?", b.id);
        transition(b, 'COMPLETED', user.id, 'Administrator confirmed completion', note);
        release(b, user.id, note);
      }
      run(
        "UPDATE disputes SET status=?,resolution=?,admin_id=? WHERE booking_id=? AND status IN ('OPEN','UNDER_REVIEW')",
        action === 'refund' ? 'RESOLVED_CUSTOMER' : 'RESOLVED_PROVIDER',
        note,
        user.id,
        b.id,
      );
    }
    audit(user.id, `Escrow ${action}`, b.id, note);
    return { message: `Escrow action recorded: ${action}.` };
  });
}
export function submitReview(user: User, input: unknown) {
  requireRole(user, 'CUSTOMER');
  const data = z
    .object({
      itemId: z.string(),
      rating: z.coerce.number().int().min(1).max(5),
      body: z.string().trim().min(10).max(2000),
    })
    .parse(input);
  return transaction(() => {
    const { b, item } = itemFor(user, data.itemId);
    assert(
      b.customer_id === user.id && b.status === 'COMPLETED' && item.status === 'COMPLETED',
      'Only the customer of a completed booking can review it.',
    );
    assert(
      !one('SELECT id FROM reviews WHERE booking_item_id=?', item.id),
      'You already reviewed this service.',
    );
    insert('reviews', {
      id: id(),
      booking_item_id: item.id,
      customer_id: user.id,
      provider_id: item.provider_id,
      service_id: item.service_id,
      rating: data.rating,
      body: data.body,
    });
    event(b.id, user.id, 'Review submitted', item.business_name);
    notify(
      item.provider_user_id,
      'A new review arrived',
      `${data.rating}/5 stars from ${user.name}.`,
      '/provider/reviews',
    );
    return { message: 'Review published. Provider ratings and badge eligibility are updated.' };
  });
}
