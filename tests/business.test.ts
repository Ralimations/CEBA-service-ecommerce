import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, closeDb, one, all, run, insert, id, now, settings } from '@/server/db';
import { seed, day, DEMO_PASSWORD } from '@/database/seed';
import { register, login, userFromToken, logout } from '@/server/auth';
import { executeAction } from '@/server/actions';
import { available, booking, bookingItems, bundles, services, provider } from '@/server/queries';
import { validateVoucher, rewardReferral } from '@/server/vouchers';
import { deliverReminders } from '@/server/reminders';
import {
  requireRole,
  checkTransition,
  rankFor,
  badgeEligible,
  DomainError,
  type User,
} from '@/lib/domain';
import * as b from '@/server/bookings';
import * as m from '@/server/management';
process.env.DATABASE_PATH = ':memory:';
let admin: User, customer: User, providerUser: User;
const user = (id: string) => one<User>('SELECT * FROM users WHERE id=?', id)!;
const freshCustomer = (referralCode = '') => {
  const result = register({
    name: 'Test Customer',
    email: `${id()}@test.local`,
    password: DEMO_PASSWORD,
    confirmPassword: DEMO_PASSWORD,
    role: 'CUSTOMER',
    referralCode,
  });
  return userFromToken(result.token)!;
};
const request = (
  who: User,
  date = day(120),
  packageId = 'package-0-0-0',
  extra: Record<string, unknown> = {},
) =>
  b
    .createBooking(who, {
      packageId,
      eventDate: date,
      eventType: 'Birthday',
      location: 'A test venue in Quezon City',
      guests: 50,
      contact: '09170000000',
      ...extra,
    })
    .redirect.split('/')
    .at(-1)!;
const confirm = (who: User, bookingId: string) => {
  const items = bookingItems(bookingId);
  for (const item of items) b.acceptBooking(user(item.provider_user_id), bookingId);
  b.payBooking(who, bookingId, true);
};
const finishItem = (who: User, itemId: string) => {
  const row = one<{ provider_id: string }>(
    'SELECT provider_id FROM booking_items WHERE id=?',
    itemId,
  )!;
  const p = provider(row.provider_id)!;
  const supplier = user(p.user_id);
  const start = b.issueHandshake(who, itemId, 'START');
  b.verifyHandshake(supplier, itemId, 'START', start.code);
  const end = b.issueHandshake(supplier, itemId, 'COMPLETE');
  b.verifyHandshake(who, itemId, 'COMPLETE', end.code);
  return { start, end };
};
before(() => {
  migrate();
  seed();
  admin = user('admin-demo');
  customer = user('customer-0');
  providerUser = user('provider-user-0');
});
after(() => closeDb());
test('SQLite results use plain prototypes for React serialization', () => {
  assert.equal(Object.getPrototypeOf(one('SELECT id FROM users LIMIT 1')), Object.prototype);
  assert.equal(Object.getPrototypeOf(all('SELECT id FROM users LIMIT 1')[0]), Object.prototype);
});
test('visit-driven booking and featured expiry reminders are delivered only once', () => {
  const c = freshCustomer();
  const bookingId = request(c, day(1));
  confirm(c, bookingId);
  deliverReminders(c);
  deliverReminders(c);
  assert.equal(
    one<{ n: number }>(
      'SELECT COUNT(*) n FROM notifications WHERE id=?',
      `reminder-${bookingId}-${c.id}`,
    )!.n,
    1,
  );
  const placementId = id();
  insert('placements', {
    id: placementId,
    provider_id: 'provider-0',
    placement: 'SEARCH',
    starts_at: now(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  deliverReminders(providerUser);
  deliverReminders(providerUser);
  assert.equal(
    one<{ n: number }>(
      'SELECT COUNT(*) n FROM notifications WHERE id=?',
      `placement-reminder-${placementId}`,
    )!.n,
    1,
  );
});
test('registration hashes passwords, persists sessions, welcomes customers, rejects public admin role', () => {
  const c = freshCustomer();
  const row = one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=?', c.id)!;
  assert.notEqual(row.password_hash, DEMO_PASSWORD);
  assert.ok(row.password_hash.includes(':'));
  assert.ok(one('SELECT 1 FROM voucher_wallet WHERE user_id=?', c.id));
  assert.throws(() =>
    register({
      name: 'Attacker',
      email: 'evil@test.local',
      password: DEMO_PASSWORD,
      confirmPassword: DEMO_PASSWORD,
      role: 'ADMIN',
    }),
  );
  const session = login({ email: c.email, password: DEMO_PASSWORD, remember: true });
  assert.equal(userFromToken(session.token)?.id, c.id);
  logout(session.token);
  assert.equal(userFromToken(session.token), null);
});
test('provider registration creates business profile and no customer welcome voucher', () => {
  const session = register({
    name: 'Studio Owner',
    email: 'studio@test.local',
    password: DEMO_PASSWORD,
    confirmPassword: DEMO_PASSWORD,
    role: 'PROVIDER',
    businessName: 'Test Studio',
    description: 'A thoughtful test provider business.',
    phone: '09170001111',
    categoryId: 'photography',
  });
  const p = userFromToken(session.token)!;
  assert.equal(p.role, 'PROVIDER');
  assert.ok(one('SELECT id FROM providers WHERE user_id=?', p.id));
  assert.equal(one('SELECT 1 FROM voucher_wallet WHERE user_id=?', p.id), undefined);
});
test('server role enforcement and ownership reject cross-role and cross-provider access', () => {
  assert.throws(
    () => requireRole(customer, 'ADMIN'),
    (e: unknown) => e instanceof DomainError && e.status === 403,
  );
  assert.throws(() => executeAction(customer, 'settings.save', {}));
  assert.throws(() =>
    m.savePackage(providerUser, {
      serviceId: 'service-1-0',
      name: 'Stolen',
      price: 5,
      inclusions: 'Something',
      duration: '1 hour',
    }),
  );
  assert.throws(
    () => booking('demo-confirmed', user('customer-2')),
    (e: unknown) => e instanceof DomainError && e.status === 404,
  );
  assert.throws(() => b.acceptBooking(user('provider-user-1'), 'demo-request'));
});
test('booking state machine rejects jumps, repeat completion, and payment before acceptance', () => {
  assert.throws(() => checkTransition('PENDING', 'COMPLETED'));
  assert.throws(() => checkTransition('COMPLETED', 'CONFIRMED'));
  const c = freshCustomer();
  const bookingId = request(c, day(121));
  assert.throws(() => b.payBooking(c, bookingId, true));
  assert.equal(booking(bookingId, c).status, 'PENDING');
});
test('full individual lifecycle: voucher, acceptance, escrow, both gates, single-use, review', () => {
  const c = freshCustomer();
  const bookingId = request(c, day(122), 'package-0-0-0', { voucher: 'WELCOME10' });
  let state = booking(bookingId, c);
  assert.equal(state.discount, 80000);
  assert.equal(state.total, 720000);
  confirm(c, bookingId);
  state = booking(bookingId, c);
  assert.equal(state.escrow_status, 'HELD_IN_ESCROW');
  assert.throws(() => b.payBooking(c, bookingId, true));
  const item = state.items[0];
  const { start, end } = finishItem(c, item.id);
  assert.throws(() => b.verifyHandshake(providerUser, item.id, 'START', start.code));
  assert.throws(() => b.verifyHandshake(c, item.id, 'COMPLETE', end.code));
  state = booking(bookingId, c);
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.escrow_status, 'RELEASED');
  const ledger = all<{ type: string; amount: number; fee: number }>(
    'SELECT * FROM escrow_transactions WHERE booking_id=?',
    bookingId,
  );
  assert.equal(ledger.filter((t) => t.type === 'HOLD').length, 1);
  assert.equal(ledger.filter((t) => t.type === 'RELEASE').length, 1);
  assert.equal(ledger[1].amount + ledger[1].fee, state.total);
  b.submitReview(c, {
    itemId: item.id,
    rating: 5,
    body: 'A beautifully coordinated test celebration.',
  });
  assert.throws(() =>
    b.submitReview(c, { itemId: item.id, rating: 5, body: 'A duplicate test review.' }),
  );
  assert.ok(all('SELECT * FROM booking_events WHERE booking_id=?', bookingId).length >= 8);
});
test('reservation uniqueness prevents double acceptance and manual blocking of booked dates', () => {
  const c = freshCustomer(),
    other = freshCustomer(),
    date = day(123);
  const first = request(c, date);
  const second = request(other, date);
  b.acceptBooking(providerUser, first);
  assert.equal(available('provider-0', date), false);
  assert.throws(() => b.acceptBooking(providerUser, second));
  assert.throws(() => m.setAvailability(providerUser, { date, status: 'UNAVAILABLE' }));
  assert.equal(booking(second, other).status, 'PENDING');
  b.cancelBooking(c, first, 'Our plans have changed.');
  assert.equal(available('provider-0', date), true);
  b.acceptBooking(providerUser, second);
  assert.equal(booking(second, other).status, 'ACCEPTED');
});
test('calendar blocking and guest/package validation prevent impossible requests', () => {
  const c = freshCustomer();
  m.setAvailability(providerUser, { date: day(124), status: 'UNAVAILABLE', note: 'Private date' });
  assert.throws(() => request(c, day(124)));
  assert.throws(() => request(c, day(125), 'missing-package'));
  assert.throws(() => request(c, day(-1)));
  assert.throws(() => request(c, '2027-02-30'));
  assert.throws(() => request(c, day(125), 'package-0-0-0', { guests: 900 }));
});
test('bundle availability is the intersection; all accept and all finish before release', () => {
  const c = freshCustomer();
  const date = day(130);
  assert.equal(bundles(day(14)).find((x) => x.id === 'bundle-wedding')!.available, false);
  const create = b.createBooking(c, {
    bundleId: 'bundle-wedding',
    eventDate: date,
    eventType: 'Wedding',
    location: 'Garden venue in Manila',
    guests: 80,
    contact: '09170001111',
  });
  const bookingId = create.redirect.split('/').at(-1)!;
  let state = booking(bookingId, c);
  assert.equal(state.items.length, 3);
  assert.equal(
    state.items.reduce((n, i) => n + i.allocation, 0),
    state.total,
  );
  assert.equal(
    state.items.reduce((n, i) => n + i.platform_fee, 0),
    state.platform_fee,
  );
  b.acceptBooking(providerUser, bookingId);
  assert.equal(booking(bookingId, c).status, 'PENDING');
  assert.throws(() => b.payBooking(c, bookingId, true));
  for (const i of state.items.filter((i) => i.provider_user_id !== providerUser.id))
    b.acceptBooking(user(i.provider_user_id), bookingId);
  b.payBooking(c, bookingId, true);
  for (const item of state.items.slice(0, 2)) {
    finishItem(c, item.id);
    assert.equal(booking(bookingId, c).escrow_status, 'HELD_IN_ESCROW');
  }
  finishItem(c, state.items[2].id);
  state = booking(bookingId, c);
  assert.equal(state.status, 'COMPLETED');
  const releases = all<{ amount: number; fee: number }>(
    "SELECT * FROM escrow_transactions WHERE booking_id=? AND type='RELEASE'",
    bookingId,
  );
  assert.equal(releases.length, 3);
  assert.equal(
    releases.reduce((n, t) => n + t.amount + t.fee, 0),
    state.total,
  );
});
test('draft bundles cannot publish without approvals; supplier revisions force a draft', () => {
  assert.throws(() => m.bundleStatus(admin, 'bundle-party', 'PUBLISHED'));
  m.respondBundle(user('provider-user-1'), {
    itemId: 'party-item-1',
    approval: 'ACCEPTED',
    price: 28000,
    inclusions: 'Agreed catering service',
    exclusions: 'Travel',
    terms: 'Agreed 5% bundle discount',
  });
  m.bundleStatus(admin, 'bundle-party', 'PUBLISHED');
  assert.equal(
    bundles().some((x) => x.id === 'bundle-party'),
    true,
  );
  m.respondBundle(user('provider-user-1'), {
    itemId: 'party-item-1',
    approval: 'REJECTED',
    price: 28000,
    inclusions: 'Agreed catering service',
  });
  assert.equal(
    bundles().some((x) => x.id === 'bundle-party'),
    false,
  );
});
test('expired, future, used, rank-restricted, category, owner, minimum and capped voucher constraints', () => {
  const c = freshCustomer();
  assert.throws(() => validateVoucher('WELCOME10', c.id, 10000, ['photography']));
  assert.equal(validateVoucher('WELCOME10', c.id, 9000000, ['photography']).discount, 150000);
  assert.throws(() => validateVoucher('GOLD1500', c.id, 9000000, ['photography']));
  assert.throws(() => validateVoucher('WELCOME10', customer.id, 9000000, ['photography']));
  const base = {
    id: 'test-voucher',
    code: 'TEST',
    description: 'Test voucher',
    type: 'FIXED',
    value: 10000,
    min_spend: 0,
    valid_from: now(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    category_id: 'photography',
    owner_id: c.id,
    usage_limit: 1,
  };
  insert('vouchers', base);
  assert.throws(() => validateVoucher('TEST', c.id, 500000, ['catering']));
  assert.throws(() => validateVoucher('TEST', customer.id, 500000, ['photography']));
  run(
    'UPDATE vouchers SET expires_at=? WHERE id=?',
    new Date(Date.now() - 1000).toISOString(),
    base.id,
  );
  assert.throws(() => validateVoucher('TEST', c.id, 500000, ['photography']));
  run(
    'UPDATE vouchers SET expires_at=?,valid_from=? WHERE id=?',
    new Date(Date.now() + 86400000).toISOString(),
    new Date(Date.now() + 50000).toISOString(),
    base.id,
  );
  assert.throws(() => validateVoucher('TEST', c.id, 500000, ['photography']));
});
test('a voucher reserved on a request cannot be concurrently used; cancellation frees it', () => {
  const c = freshCustomer();
  const first = request(c, day(140), 'package-0-0-0', { voucher: 'WELCOME10' });
  assert.throws(() => request(c, day(141), 'package-0-0-0', { voucher: 'WELCOME10' }));
  b.cancelBooking(c, first, 'We selected another date.');
  const second = request(c, day(141), 'package-0-0-0', { voucher: 'WELCOME10' });
  assert.equal(booking(second, c).discount, 80000);
});
test('handshake tokens bind item, gate and counterparty; wrong attempts lock and expired tokens fail', () => {
  const c = freshCustomer();
  const bookingId = request(c, day(150));
  confirm(c, bookingId);
  const item = booking(bookingId, c).items[0];
  const token = b.issueHandshake(c, item.id, 'START');
  assert.throws(() => b.verifyHandshake(c, item.id, 'START', token.code));
  assert.throws(() => b.verifyHandshake(user('provider-user-1'), item.id, 'START', token.code));
  for (let i = 0; i < 5; i++)
    assert.throws(() => b.verifyHandshake(providerUser, item.id, 'START', 'NOTTHERIGHT1'));
  assert.throws(() => b.verifyHandshake(providerUser, item.id, 'START', token.code));
  const replacement = b.issueHandshake(c, item.id, 'START');
  assert.notEqual(replacement.code, token.code);
  run(
    'UPDATE handshake_tokens SET expires_at=? WHERE booking_item_id=?',
    new Date(Date.now() - 1000).toISOString(),
    item.id,
  );
  assert.throws(() => b.verifyHandshake(providerUser, item.id, 'START', replacement.code));
});
test('disputes freeze handshakes; only admin resolves, refunds once, logs decision', () => {
  const c = freshCustomer();
  const bookingId = request(c, day(151));
  confirm(c, bookingId);
  const item = booking(bookingId, c).items[0];
  const token = b.issueHandshake(c, item.id, 'START');
  b.openDispute(c, bookingId, 'The supplier needs an administrator to review our agreement.');
  assert.throws(() => b.verifyHandshake(providerUser, item.id, 'START', token.code));
  assert.throws(() =>
    b.adminEscrow(providerUser, bookingId, 'refund', 'The customer is entitled to a refund.', true),
  );
  b.adminEscrow(
    admin,
    bookingId,
    'refund',
    'Reviewed both sides and approved the full refund.',
    true,
  );
  assert.equal(booking(bookingId, c).escrow_status, 'REFUNDED');
  assert.equal(booking(bookingId, c).status, 'CANCELLED');
  assert.equal(available('provider-0', day(151)), true);
  assert.throws(() =>
    b.adminEscrow(admin, bookingId, 'refund', 'Trying to repeat the same refund.', true),
  );
  assert.equal(
    one<{ n: number }>(
      "SELECT COUNT(*) n FROM escrow_transactions WHERE booking_id=? AND type='REFUND'",
      bookingId,
    )!.n,
    1,
  );
});
test('admin release requires dispute review and confirmation; audit and ledger are append-only', () => {
  const c = freshCustomer();
  const bookingId = request(c, day(152));
  confirm(c, bookingId);
  assert.throws(() =>
    b.adminEscrow(admin, bookingId, 'release', 'A direct unsupported release attempt.', true),
  );
  b.adminEscrow(admin, bookingId, 'freeze', 'Completion requires an administrator review.', true);
  assert.throws(() =>
    b.adminEscrow(
      admin,
      bookingId,
      'release',
      'Reviewed the evidence and confirmed completion.',
      false,
    ),
  );
  b.adminEscrow(
    admin,
    bookingId,
    'release',
    'Reviewed the evidence and confirmed completion.',
    true,
  );
  assert.equal(booking(bookingId, c).escrow_status, 'RELEASED');
  assert.throws(() => run('UPDATE escrow_transactions SET amount=0 WHERE booking_id=?', bookingId));
  assert.throws(() => run('DELETE FROM booking_events WHERE booking_id=?', bookingId));
  assert.throws(() => run('DELETE FROM audit_log'));
});
test('incomplete bookings cannot be reviewed and submitted scores are validated', () => {
  assert.throws(() =>
    b.submitReview(customer, {
      itemId: 'item-request',
      rating: 5,
      body: 'Attempted premature review.',
    }),
  );
  assert.throws(() =>
    b.submitReview(customer, {
      itemId: 'item-request',
      rating: 6,
      body: 'Invalid rating submitted.',
    }),
  );
});
test('customer ranking and badges use configurable data; paid VIP never grants trust', () => {
  assert.equal(rankFor(0), 'BRONZE');
  assert.equal(rankFor(3), 'SILVER');
  assert.equal(rankFor(8), 'GOLD');
  assert.equal(rankFor(15), 'PLATINUM');
  assert.equal(badgeEligible(4.8, 6, 0, 'TRUSTED'), true);
  assert.equal(badgeEligible(4.8, 6, 1, 'TRUSTED'), false);
  assert.equal(badgeEligible(4.8, 6, 0, 'BEST_SERVICE'), false);
  assert.equal(badgeEligible(4.8, 10, 0, 'BEST_SERVICE'), true);
  m.subscription(user('provider-user-9'), { tier: 'VIP', confirmed: true });
  assert.equal(provider('provider-9')!.vip, 1);
  assert.equal(provider('provider-9')!.trusted, false);
});
test('referral rewards are granted once, to both customers, after completion', () => {
  const c = freshCustomer('CELEBRATE1');
  const bookingId = request(c, day(160));
  confirm(c, bookingId);
  const countBefore = one<{ n: number }>(
    "SELECT COUNT(*) n FROM vouchers WHERE code LIKE 'THANKS-%'",
  )!.n;
  assert.equal(
    one<{ rewarded_at: string | null }>(
      'SELECT rewarded_at FROM referrals WHERE referred_id=?',
      c.id,
    )!.rewarded_at,
    null,
  );
  finishItem(c, booking(bookingId, c).items[0].id);
  assert.ok(
    one<{ rewarded_at: string }>('SELECT rewarded_at FROM referrals WHERE referred_id=?', c.id)!
      .rewarded_at,
  );
  assert.equal(
    one<{ n: number }>("SELECT COUNT(*) n FROM vouchers WHERE code LIKE 'THANKS-%'")!.n,
    countBefore + 2,
  );
  rewardReferral(c.id);
  assert.equal(
    one<{ n: number }>("SELECT COUNT(*) n FROM vouchers WHERE code LIKE 'THANKS-%'")!.n,
    countBefore + 2,
  );
});
test('explicit price/rating order ignores paid priority and expired plans are inactive', () => {
  for (const sort of ['price-low', 'price-high', 'rating']) {
    const list = services({ sort });
    for (let i = 1; i < list.length; i++)
      assert.ok(
        sort === 'rating'
          ? list[i - 1].rating >= list[i].rating
          : sort === 'price-low'
            ? list[i - 1].base_price <= list[i].base_price
            : list[i - 1].base_price >= list[i].base_price,
      );
  }
  run("UPDATE subscriptions SET expires_at='2000-01-01T00:00:00Z' WHERE provider_id='provider-9'");
  assert.equal(provider('provider-9')!.vip, 0);
});
test('suspension invalidates sessions, settings persist, and foreign data is preserved', () => {
  const c = freshCustomer();
  const session = login({ email: c.email, password: DEMO_PASSWORD });
  m.adminUser(admin, c.id, 'SUSPENDED');
  assert.equal(userFromToken(session.token), null);
  assert.throws(() => login({ email: c.email, password: DEMO_PASSWORD }));
  m.adminUser(admin, c.id, 'ACTIVE');
  m.saveSettings(admin, { platformFee: 7, silver: 4, gold: 9, platinum: 16 });
  assert.equal(settings().platformFee, 7);
  assert.equal(rankFor(3, settings()), 'BRONZE');
  assert.throws(() => m.saveSettings(customer, { platformFee: 0 }));
  assert.throws(() => m.saveSettings(admin, { silver: 10, gold: 5, platinum: 3 }));
});
