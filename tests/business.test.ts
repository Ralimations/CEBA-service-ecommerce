import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, closeDb, one, all, run, insert, id, now, settings } from '@/server/db';
import { seed, day, DEMO_PASSWORD } from '@/database/seed';
import { register, login, userFromToken, logout } from '@/server/auth';
import { executeAction } from '@/server/actions';
import { available, booking, bookingItems, bundles, services, provider } from '@/server/queries';
import { validateVoucher, rewardReferral } from '@/server/vouchers';
import { deliverReminders } from '@/server/reminders';
import { requireRole, checkTransition, rankFor, badgeEligible, DomainError, type User, } from '@/lib/domain';
import * as b from '@/server/bookings';
import * as m from '@/server/management';
process.env.DATABASE_PATH = ':memory:';
let admin: User, customer: User, providerUser: User;
const user = async (id: string) => (await one<User>('SELECT * FROM users WHERE id=?', id))!;
const freshCustomer = async (referralCode = '') => {
    const result = (await register({
        name: 'Test Customer',
        email: `${id()}@test.local`,
        password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD,
        role: 'CUSTOMER',
        referralCode,
    }));
    return (await userFromToken(result.token))!;
};
const request = async (who: User, date = day(120), packageId = 'package-0-0-0', extra: Record<string, unknown> = {}) => (await b
    .createBooking(who, {
    packageId,
    eventDate: date,
    eventType: 'Birthday',
    location: 'A test venue in Quezon City',
    guests: 50,
    contact: '09170000000',
    ...extra,
})).redirect.split('/')
    .at(-1)!;
const confirm = async (who: User, bookingId: string) => {
    const items = (await bookingItems(bookingId));
    for (const item of items)
        (await b.acceptBooking((await user(item.provider_user_id)), bookingId));
    (await b.payBooking(who, bookingId, true));
};
const finishItem = async (who: User, itemId: string) => {
    const row = (await one<{
        provider_id: string;
    }>('SELECT provider_id FROM booking_items WHERE id=?', itemId))!;
    const p = (await provider(row.provider_id))!;
    const supplier = (await user(p.user_id));
    const start = (await b.issueHandshake(who, itemId, 'START'));
    (await b.verifyHandshake(supplier, itemId, 'START', start.code));
    const end = (await b.issueHandshake(supplier, itemId, 'COMPLETE'));
    (await b.verifyHandshake(who, itemId, 'COMPLETE', end.code));
    return { start, end };
};
before(async () => {
    (await migrate());
    (await seed());
    admin = (await user('admin-demo'));
    customer = (await user('customer-0'));
    providerUser = (await user('provider-user-0'));
});
after(async () => (await closeDb()));
test('SQLite results use plain prototypes for React serialization', async () => {
    assert.equal(Object.getPrototypeOf((await one('SELECT id FROM users LIMIT 1'))), Object.prototype);
    assert.equal(Object.getPrototypeOf((await all('SELECT id FROM users LIMIT 1'))[0]), Object.prototype);
});
test('visit-driven booking and featured expiry reminders are delivered only once', async () => {
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(1)));
    (await confirm(c, bookingId));
    (await deliverReminders(c));
    (await deliverReminders(c));
    assert.equal((await one<{
        n: number;
    }>('SELECT COUNT(*) n FROM notifications WHERE id=?', `reminder-${bookingId}-${c.id}`))!.n, 1);
    const placementId = id();
    (await insert('placements', {
        id: placementId,
        provider_id: 'provider-0',
        placement: 'SEARCH',
        starts_at: now(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
    }));
    (await deliverReminders(providerUser));
    (await deliverReminders(providerUser));
    assert.equal((await one<{
        n: number;
    }>('SELECT COUNT(*) n FROM notifications WHERE id=?', `placement-reminder-${placementId}`))!.n, 1);
});
test('registration hashes passwords, persists sessions, welcomes customers, rejects public admin role', async () => {
    const c = (await freshCustomer());
    const row = (await one<{
        password_hash: string;
    }>('SELECT password_hash FROM users WHERE id=?', c.id))!;
    assert.notEqual(row.password_hash, DEMO_PASSWORD);
    assert.ok(row.password_hash.includes(':'));
    assert.ok((await one('SELECT 1 FROM voucher_wallet WHERE user_id=?', c.id)));
    (await assert.rejects(async () => (await register({
        name: 'Attacker',
        email: 'evil@test.local',
        password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD,
        role: 'ADMIN',
    }))));
    const session = (await login({ email: c.email, password: DEMO_PASSWORD, remember: true }));
    assert.equal((await userFromToken(session.token))?.id, c.id);
    (await logout(session.token));
    assert.equal((await userFromToken(session.token)), null);
});
test('provider registration creates business profile and no customer welcome voucher', async () => {
    const session = (await register({
        name: 'Studio Owner',
        email: 'studio@test.local',
        password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD,
        role: 'PROVIDER',
        businessName: 'Test Studio',
        description: 'A thoughtful test provider business.',
        phone: '09170001111',
        categoryId: 'photography',
    }));
    const p = (await userFromToken(session.token))!;
    assert.equal(p.role, 'PROVIDER');
    assert.ok((await one('SELECT id FROM providers WHERE user_id=?', p.id)));
    assert.equal((await one('SELECT 1 FROM voucher_wallet WHERE user_id=?', p.id)), undefined);
});
test('server role enforcement and ownership reject cross-role and cross-provider access', async () => {
    assert.throws(() => requireRole(customer, 'ADMIN'), (e: unknown) => e instanceof DomainError && e.status === 403);
    (await assert.rejects(async () => (await executeAction(customer, 'settings.save', {}))));
    (await assert.rejects(async () => (await m.savePackage(providerUser, {
        serviceId: 'service-1-0',
        name: 'Stolen',
        price: 5,
        inclusions: 'Something',
        duration: '1 hour',
    }))));
    (await assert.rejects(async () => (await booking('demo-confirmed', (await user('customer-2')))), (e: unknown) => e instanceof DomainError && e.status === 404));
    (await assert.rejects(async () => (await b.acceptBooking((await user('provider-user-1')), 'demo-request'))));
});
test('booking state machine rejects jumps, repeat completion, and payment before acceptance', async () => {
    assert.throws(() => checkTransition('PENDING', 'COMPLETED'));
    assert.throws(() => checkTransition('COMPLETED', 'CONFIRMED'));
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(121)));
    (await assert.rejects(async () => (await b.payBooking(c, bookingId, true))));
    assert.equal((await booking(bookingId, c)).status, 'PENDING');
});
test('full individual lifecycle: voucher, acceptance, escrow, both gates, single-use, review', async () => {
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(122), 'package-0-0-0', { voucher: 'WELCOME10' }));
    let state = (await booking(bookingId, c));
    assert.equal(state.discount, 80000);
    assert.equal(state.total, 720000);
    (await confirm(c, bookingId));
    state = (await booking(bookingId, c));
    assert.equal(state.escrow_status, 'HELD_IN_ESCROW');
    (await assert.rejects(async () => (await b.payBooking(c, bookingId, true))));
    const item = state.items[0];
    const { start, end } = (await finishItem(c, item.id));
    (await assert.rejects(async () => (await b.verifyHandshake(providerUser, item.id, 'START', start.code))));
    (await assert.rejects(async () => (await b.verifyHandshake(c, item.id, 'COMPLETE', end.code))));
    state = (await booking(bookingId, c));
    assert.equal(state.status, 'COMPLETED');
    assert.equal(state.escrow_status, 'RELEASED');
    const ledger = (await all<{
        type: string;
        amount: number;
        fee: number;
    }>('SELECT * FROM escrow_transactions WHERE booking_id=?', bookingId));
    assert.equal(ledger.filter((t) => t.type === 'HOLD').length, 1);
    assert.equal(ledger.filter((t) => t.type === 'RELEASE').length, 1);
    assert.equal(ledger[1].amount + ledger[1].fee, state.total);
    (await b.submitReview(c, {
        itemId: item.id,
        rating: 5,
        body: 'A beautifully coordinated test celebration.',
    }));
    (await assert.rejects(async () => (await b.submitReview(c, { itemId: item.id, rating: 5, body: 'A duplicate test review.' }))));
    assert.ok((await all('SELECT * FROM booking_events WHERE booking_id=?', bookingId)).length >= 8);
});
test('reservation uniqueness prevents double acceptance and manual blocking of booked dates', async () => {
    const c = (await freshCustomer()), other = (await freshCustomer()), date = day(123);
    const first = (await request(c, date));
    const second = (await request(other, date));
    (await b.acceptBooking(providerUser, first));
    assert.equal((await available('provider-0', date)), false);
    (await assert.rejects(async () => (await b.acceptBooking(providerUser, second))));
    (await assert.rejects(async () => (await m.setAvailability(providerUser, { date, status: 'UNAVAILABLE' }))));
    assert.equal((await booking(second, other)).status, 'PENDING');
    (await b.cancelBooking(c, first, 'Our plans have changed.'));
    assert.equal((await available('provider-0', date)), true);
    (await b.acceptBooking(providerUser, second));
    assert.equal((await booking(second, other)).status, 'ACCEPTED');
});
test('calendar blocking and guest/package validation prevent impossible requests', async () => {
    const c = (await freshCustomer());
    (await m.setAvailability(providerUser, { date: day(124), status: 'UNAVAILABLE', note: 'Private date' }));
    (await assert.rejects(async () => (await request(c, day(124)))));
    (await assert.rejects(async () => (await request(c, day(125), 'missing-package'))));
    (await assert.rejects(async () => (await request(c, day(-1)))));
    (await assert.rejects(async () => (await request(c, '2027-02-30'))));
    (await assert.rejects(async () => (await request(c, day(125), 'package-0-0-0', { guests: 900 }))));
});
test('bundle availability is the intersection; all accept and all finish before release', async () => {
    const c = (await freshCustomer());
    const date = day(130);
    assert.equal((await bundles(day(14))).find((x) => x.id === 'bundle-wedding')!.available, false);
    const create = (await b.createBooking(c, {
        bundleId: 'bundle-wedding',
        eventDate: date,
        eventType: 'Wedding',
        location: 'Garden venue in Manila',
        guests: 80,
        contact: '09170001111',
    }));
    const bookingId = create.redirect.split('/').at(-1)!;
    let state = (await booking(bookingId, c));
    assert.equal(state.items.length, 3);
    assert.equal(state.items.reduce((n, i) => n + i.allocation, 0), state.total);
    assert.equal(state.items.reduce((n, i) => n + i.platform_fee, 0), state.platform_fee);
    (await b.acceptBooking(providerUser, bookingId));
    assert.equal((await booking(bookingId, c)).status, 'PENDING');
    (await assert.rejects(async () => (await b.payBooking(c, bookingId, true))));
    for (const i of state.items.filter((i) => i.provider_user_id !== providerUser.id))
        (await b.acceptBooking((await user(i.provider_user_id)), bookingId));
    (await b.payBooking(c, bookingId, true));
    for (const item of state.items.slice(0, 2)) {
        (await finishItem(c, item.id));
        assert.equal((await booking(bookingId, c)).escrow_status, 'HELD_IN_ESCROW');
    }
    (await finishItem(c, state.items[2].id));
    state = (await booking(bookingId, c));
    assert.equal(state.status, 'COMPLETED');
    const releases = (await all<{
        amount: number;
        fee: number;
    }>("SELECT * FROM escrow_transactions WHERE booking_id=? AND type='RELEASE'", bookingId));
    assert.equal(releases.length, 3);
    assert.equal(releases.reduce((n, t) => n + t.amount + t.fee, 0), state.total);
});
test('draft bundles cannot publish without approvals; supplier revisions force a draft', async () => {
    (await assert.rejects(async () => (await m.bundleStatus(admin, 'bundle-party', 'PUBLISHED'))));
    (await m.respondBundle((await user('provider-user-1')), {
        itemId: 'party-item-1',
        approval: 'ACCEPTED',
        price: 28000,
        inclusions: 'Agreed catering service',
        exclusions: 'Travel',
        terms: 'Agreed 5% bundle discount',
    }));
    (await m.bundleStatus(admin, 'bundle-party', 'PUBLISHED'));
    assert.equal((await bundles()).some((x) => x.id === 'bundle-party'), true);
    (await m.respondBundle((await user('provider-user-1')), {
        itemId: 'party-item-1',
        approval: 'REJECTED',
        price: 28000,
        inclusions: 'Agreed catering service',
    }));
    assert.equal((await bundles()).some((x) => x.id === 'bundle-party'), false);
});
test('expired, future, used, rank-restricted, category, owner, minimum and capped voucher constraints', async () => {
    const c = (await freshCustomer());
    (await assert.rejects(async () => (await validateVoucher('WELCOME10', c.id, 10000, ['photography']))));
    assert.equal((await validateVoucher('WELCOME10', c.id, 9000000, ['photography'])).discount, 150000);
    (await assert.rejects(async () => (await validateVoucher('GOLD1500', c.id, 9000000, ['photography']))));
    (await assert.rejects(async () => (await validateVoucher('WELCOME10', customer.id, 9000000, ['photography']))));
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
    (await insert('vouchers', base));
    (await assert.rejects(async () => (await validateVoucher('TEST', c.id, 500000, ['catering']))));
    (await assert.rejects(async () => (await validateVoucher('TEST', customer.id, 500000, ['photography']))));
    (await run('UPDATE vouchers SET expires_at=? WHERE id=?', new Date(Date.now() - 1000).toISOString(), base.id));
    (await assert.rejects(async () => (await validateVoucher('TEST', c.id, 500000, ['photography']))));
    (await run('UPDATE vouchers SET expires_at=?,valid_from=? WHERE id=?', new Date(Date.now() + 86400000).toISOString(), new Date(Date.now() + 50000).toISOString(), base.id));
    (await assert.rejects(async () => (await validateVoucher('TEST', c.id, 500000, ['photography']))));
});
test('a voucher reserved on a request cannot be concurrently used; cancellation frees it', async () => {
    const c = (await freshCustomer());
    const first = (await request(c, day(140), 'package-0-0-0', { voucher: 'WELCOME10' }));
    (await assert.rejects(async () => (await request(c, day(141), 'package-0-0-0', { voucher: 'WELCOME10' }))));
    (await b.cancelBooking(c, first, 'We selected another date.'));
    const second = (await request(c, day(141), 'package-0-0-0', { voucher: 'WELCOME10' }));
    assert.equal((await booking(second, c)).discount, 80000);
});
test('handshake tokens bind item, gate and counterparty; wrong attempts lock and expired tokens fail', async () => {
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(150)));
    (await confirm(c, bookingId));
    const item = (await booking(bookingId, c)).items[0];
    const token = (await b.issueHandshake(c, item.id, 'START'));
    (await assert.rejects(async () => (await b.verifyHandshake(c, item.id, 'START', token.code))));
    (await assert.rejects(async () => (await b.verifyHandshake((await user('provider-user-1')), item.id, 'START', token.code))));
    for (let i = 0; i < 5; i++)
        (await assert.rejects(async () => (await b.verifyHandshake(providerUser, item.id, 'START', 'NOTTHERIGHT1'))));
    (await assert.rejects(async () => (await b.verifyHandshake(providerUser, item.id, 'START', token.code))));
    const replacement = (await b.issueHandshake(c, item.id, 'START'));
    assert.notEqual(replacement.code, token.code);
    (await run('UPDATE handshake_tokens SET expires_at=? WHERE booking_item_id=?', new Date(Date.now() - 1000).toISOString(), item.id));
    (await assert.rejects(async () => (await b.verifyHandshake(providerUser, item.id, 'START', replacement.code))));
});
test('disputes freeze handshakes; only admin resolves, refunds once, logs decision', async () => {
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(151)));
    (await confirm(c, bookingId));
    const item = (await booking(bookingId, c)).items[0];
    const token = (await b.issueHandshake(c, item.id, 'START'));
    (await b.openDispute(c, bookingId, 'The supplier needs an administrator to review our agreement.'));
    (await assert.rejects(async () => (await b.verifyHandshake(providerUser, item.id, 'START', token.code))));
    (await assert.rejects(async () => (await b.adminEscrow(providerUser, bookingId, 'refund', 'The customer is entitled to a refund.', true))));
    (await b.adminEscrow(admin, bookingId, 'refund', 'Reviewed both sides and approved the full refund.', true));
    assert.equal((await booking(bookingId, c)).escrow_status, 'REFUNDED');
    assert.equal((await booking(bookingId, c)).status, 'CANCELLED');
    assert.equal((await available('provider-0', day(151))), true);
    (await assert.rejects(async () => (await b.adminEscrow(admin, bookingId, 'refund', 'Trying to repeat the same refund.', true))));
    assert.equal((await one<{
        n: number;
    }>("SELECT COUNT(*) n FROM escrow_transactions WHERE booking_id=? AND type='REFUND'", bookingId))!.n, 1);
});
test('admin release requires dispute review and confirmation; audit and ledger are append-only', async () => {
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(152)));
    (await confirm(c, bookingId));
    (await assert.rejects(async () => (await b.adminEscrow(admin, bookingId, 'release', 'A direct unsupported release attempt.', true))));
    (await b.adminEscrow(admin, bookingId, 'freeze', 'Completion requires an administrator review.', true));
    (await assert.rejects(async () => (await b.adminEscrow(admin, bookingId, 'release', 'Reviewed the evidence and confirmed completion.', false))));
    (await b.adminEscrow(admin, bookingId, 'release', 'Reviewed the evidence and confirmed completion.', true));
    assert.equal((await booking(bookingId, c)).escrow_status, 'RELEASED');
    (await assert.rejects(async () => (await run('UPDATE escrow_transactions SET amount=0 WHERE booking_id=?', bookingId))));
    (await assert.rejects(async () => (await run('DELETE FROM booking_events WHERE booking_id=?', bookingId))));
    (await assert.rejects(async () => (await run('DELETE FROM audit_log'))));
});
test('incomplete bookings cannot be reviewed and submitted scores are validated', async () => {
    (await assert.rejects(async () => (await b.submitReview(customer, {
        itemId: 'item-request',
        rating: 5,
        body: 'Attempted premature review.',
    }))));
    (await assert.rejects(async () => (await b.submitReview(customer, {
        itemId: 'item-request',
        rating: 6,
        body: 'Invalid rating submitted.',
    }))));
});
test('customer ranking and badges use configurable data; paid VIP never grants trust', async () => {
    assert.equal(rankFor(0), 'BRONZE');
    assert.equal(rankFor(3), 'SILVER');
    assert.equal(rankFor(8), 'GOLD');
    assert.equal(rankFor(15), 'PLATINUM');
    assert.equal(badgeEligible(4.8, 6, 0, 'TRUSTED'), true);
    assert.equal(badgeEligible(4.8, 6, 1, 'TRUSTED'), false);
    assert.equal(badgeEligible(4.8, 6, 0, 'BEST_SERVICE'), false);
    assert.equal(badgeEligible(4.8, 10, 0, 'BEST_SERVICE'), true);
    (await m.subscription((await user('provider-user-9')), { tier: 'VIP', confirmed: true }));
    assert.equal((await provider('provider-9'))!.vip, 1);
    assert.equal((await provider('provider-9'))!.trusted, false);
});
test('referral rewards are granted once, to both customers, after completion', async () => {
    const c = (await freshCustomer('CELEBRATE1'));
    const bookingId = (await request(c, day(160)));
    (await confirm(c, bookingId));
    const countBefore = (await one<{
        n: number;
    }>("SELECT COUNT(*) n FROM vouchers WHERE code LIKE 'THANKS-%'"))!.n;
    assert.equal((await one<{
        rewarded_at: string | null;
    }>('SELECT rewarded_at FROM referrals WHERE referred_id=?', c.id))!.rewarded_at, null);
    (await finishItem(c, (await booking(bookingId, c)).items[0].id));
    assert.ok((await one<{
        rewarded_at: string;
    }>('SELECT rewarded_at FROM referrals WHERE referred_id=?', c.id))!
        .rewarded_at);
    assert.equal((await one<{
        n: number;
    }>("SELECT COUNT(*) n FROM vouchers WHERE code LIKE 'THANKS-%'"))!.n, countBefore + 2);
    (await rewardReferral(c.id));
    assert.equal((await one<{
        n: number;
    }>("SELECT COUNT(*) n FROM vouchers WHERE code LIKE 'THANKS-%'"))!.n, countBefore + 2);
});
test('explicit price/rating order ignores paid priority and expired plans are inactive', async () => {
    for (const sort of ['price-low', 'price-high', 'rating']) {
        const list = (await services({ sort }));
        for (let i = 1; i < list.length; i++)
            assert.ok(sort === 'rating'
                ? list[i - 1].rating >= list[i].rating
                : sort === 'price-low'
                    ? list[i - 1].base_price <= list[i].base_price
                    : list[i - 1].base_price >= list[i].base_price);
    }
    (await run("UPDATE subscriptions SET expires_at='2000-01-01T00:00:00Z' WHERE provider_id='provider-9'"));
    assert.equal((await provider('provider-9'))!.vip, 0);
});
test('suspension invalidates sessions, settings persist, and foreign data is preserved', async () => {
    const c = (await freshCustomer());
    const session = (await login({ email: c.email, password: DEMO_PASSWORD }));
    (await m.adminUser(admin, c.id, 'SUSPENDED'));
    assert.equal((await userFromToken(session.token)), null);
    (await assert.rejects(async () => (await login({ email: c.email, password: DEMO_PASSWORD }))));
    (await m.adminUser(admin, c.id, 'ACTIVE'));
    (await m.saveSettings(admin, { platformFee: 7, silver: 4, gold: 9, platinum: 16 }));
    assert.equal((await settings()).platformFee, 7);
    assert.equal(rankFor(3, (await settings())), 'BRONZE');
    (await assert.rejects(async () => (await m.saveSettings(customer, { platformFee: 0 }))));
    (await assert.rejects(async () => (await m.saveSettings(admin, { silver: 10, gold: 5, platinum: 3 }))));
});
