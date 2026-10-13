import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { migrate, closeDb, one, all, run, insert, id, now, settings } from '@/server/db';
import { seed, day, DEMO_PASSWORD } from '@/database/seed';
import { register, login, userFromToken, logout } from '@/server/auth';
import { executeAction } from '@/server/actions';
import { available, booking, bookingItems, bookingsFor, bookingsForProviderAdmin, bundles, services, provider } from '@/server/queries';
import { validateVoucher, rewardReferral } from '@/server/vouchers';
import { deliverReminders } from '@/server/reminders';
import { requireRole, checkTransition, rankFor, badgeEligible, DomainError, type User, } from '@/lib/domain';
import * as b from '@/server/bookings';
import * as m from '@/server/management';
import { submitPublicAppeal, reviewPublicAppeal } from '@/server/public-support';
import { cancellationReasonForBooking, reviewProviderCancellation, pendingProviderCancellationReasons, pendingEmergencyCancellationRequests, providerCancellationWindowActive } from '@/server/cancellations';
import { readConversation, sendBookingMessage } from '@/server/messages';
import { awardCompletedBookingExperience, dailyCheckIn, experienceSummary, manilaDateKey, monetaryLoyaltyRewardsEnabled } from '@/server/loyalty';
import { expireDueBookings } from '@/server/bookings';
import { validCronAuthorization } from '@/server/cron-auth';
import { recordSimulatedInstallment, simulatedInstallments, splitCentavos } from '@/server/deposits';
if (process.env.POSTGRES_URL === undefined && existsSync('.env.local')) process.loadEnvFile('.env.local');
assert.equal(process.env.TEST_ISOLATED, '1', 'Run npm test to use the disposable database; never run these fixtures on Supabase.');
assert.equal(new URL(process.env.POSTGRES_URL!).hostname, '127.0.0.1');
let admin: User, customer: User, providerUser: User;
const user = async (id: string) => (await one<User>('SELECT * FROM users WHERE id=?', id))!;
const freshCustomer = async (referralCode = '') => {
    const result = (await register({
        name: 'Test Customer',
        email: `${id()}@test.local`,
        password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD,
        role: 'CUSTOMER',
        termsAccepted: true,
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
// PGlite's socket bridge multiplexes one backend. Give independent cases fresh
// client connections after intentional SQL errors; pool concurrency is tested
// separately against the actual Supabase transaction pooler.
afterEach(async () => (await closeDb()));
test('PostgreSQL results use plain prototypes for React serialization', async () => {
    assert.equal(Object.getPrototypeOf((await one('SELECT id FROM users LIMIT 1'))), Object.prototype);
    assert.equal(Object.getPrototypeOf((await all('SELECT id FROM users LIMIT 1'))[0]), Object.prototype);
});
test('numbered additive migrations preserve existing rows and rerun idempotently', async () => {
    const isolated = await PGlite.create();
    try {
        await isolated.exec(`
          CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE users(id TEXT PRIMARY KEY);
          CREATE TABLE bookings(id TEXT PRIMARY KEY, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE booking_events(id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), actor_id TEXT NOT NULL REFERENCES users(id), event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
          CREATE OR REPLACE FUNCTION soiree_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END; $$;
          INSERT INTO users(id) VALUES('existing-user');
          INSERT INTO bookings(id,status) VALUES('old-pending','PENDING');
          INSERT INTO booking_events(id,booking_id,actor_id,event) VALUES('old-event','old-pending','existing-user','Existing event');
        `);
        const migration002 = readFileSync(resolve('database/migrations/002_public_account_support.sql'), 'utf8');
        const migration003 = readFileSync(resolve('database/migrations/003_booking_response_and_cancellation_review.sql'), 'utf8');
        await isolated.exec(migration002);
        await isolated.exec(migration003);
        await isolated.exec(migration002);
        await isolated.exec(migration003);
        const oldBooking = (await isolated.query<{ response_deadline_at: string | null; status: string }>("SELECT id,status,response_deadline_at FROM bookings WHERE id='old-pending'")).rows[0];
        assert.deepEqual(oldBooking, { id: 'old-pending', status: 'PENDING', response_deadline_at: null });
        assert.equal((await isolated.query("SELECT id,event FROM booking_events WHERE id='old-event'")).rows.length, 1);
        assert.equal((await isolated.query("SELECT id FROM public_account_support WHERE id='nonexistent'")).rows.length, 0);
        assert.equal((await isolated.query('SELECT version FROM schema_migrations WHERE version IN (2,3) ORDER BY version')).rows.length, 2);
        const actorNullable = await isolated.query<{ is_nullable: string }>("SELECT is_nullable FROM information_schema.columns WHERE table_name='booking_events' AND column_name='actor_id'");
        assert.equal(actorNullable.rows[0]?.is_nullable, 'YES');
    } finally {
        await isolated.close();
    }
});
test('batched booking lists preserve customer and provider ownership and item snapshots', async () => {
    const a = await freshCustomer();
    const other = await freshCustomer();
    const aId = await request(a, day(180));
    const otherId = await request(other, day(181), 'package-1-0-0');
    const mine = await bookingsFor(a);
    assert.deepEqual(mine.map(b => b.id), [aId]);
    assert.deepEqual(mine[0], await booking(aId, a));
    assert.deepEqual((await bookingsFor(other)).map(b => b.id), [otherId]);
    const supplier = await bookingsFor(providerUser);
    assert.ok(supplier.some(b => b.id === aId));
    assert.ok(!supplier.some(b => b.id === otherId));
    assert.ok(supplier.every(b => b.items.some(i => i.provider_user_id === providerUser.id)));
    const adminList = await bookingsFor(admin);
    assert.ok(adminList.some(b => b.id === aId) && adminList.some(b => b.id === otherId));
});
test('admin provider history is scoped to the requested provider and requires admin access', async () => {
    const history = await bookingsForProviderAdmin(admin, 'provider-0');
    assert.ok(history.length > 0);
    assert.ok(history.every((item) => item.items.some((bookingItem) => bookingItem.provider_id === 'provider-0')));
    await assert.rejects(
        () => bookingsForProviderAdmin(customer, 'provider-0'),
        (error: unknown) => error instanceof DomainError && error.status === 403,
    );
});
test('visit-driven booking and featured expiry reminders are delivered only once', async () => {
    const c = (await freshCustomer());
    const bookingId = (await request(c, day(1)));
    (await confirm(c, bookingId));
    (await deliverReminders(c));
    (await deliverReminders(c));
    assert.equal((await one<{
        n: number;
    }>('SELECT COUNT(*)::int n FROM notifications WHERE id=?', `reminder-${bookingId}-${c.id}`))!.n, 1);
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
    }>('SELECT COUNT(*)::int n FROM notifications WHERE id=?', `placement-reminder-${placementId}`))!.n, 1);
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
        termsAccepted: true,
    }));
    const p = (await userFromToken(session.token))!;
    assert.equal(p.role, 'PROVIDER');
    assert.ok((await one('SELECT id FROM providers WHERE user_id=?', p.id)));
    assert.equal((await one('SELECT 1 FROM voucher_wallet WHERE user_id=?', p.id)), undefined);
});
test('customer and provider registrations require and record the Terms version', async () => {
    await assert.rejects(() => register({
        name: 'No Terms', email: `${id()}@terms.local`, password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD, role: 'CUSTOMER',
    }));
    await assert.rejects(() => register({
        name: 'No Terms Provider', email: `${id()}@terms.local`, password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD, role: 'PROVIDER', businessName: 'Terms Studio',
        description: 'A provider used to verify terms validation.', phone: '09170009999', categoryId: 'photography',
    }));
    const accepted = await register({
        name: 'Terms Customer', email: `${id()}@terms.local`, password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD, role: 'CUSTOMER', termsAccepted: true,
    });
    const row = await one<{ terms_accepted_at: string; terms_version: string }>(
        'SELECT terms_accepted_at,terms_version FROM users WHERE id=(SELECT user_id FROM sessions WHERE token_hash=?)',
        (await import('@/server/security')).hashToken(accepted.token),
    );
    assert.ok(row?.terms_accepted_at);
    assert.equal(row?.terms_version, '2026-10-05');
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
    }>("SELECT COUNT(*)::int n FROM escrow_transactions WHERE booking_id=? AND type='REFUND'", bookingId))!.n, 1);
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
    assert.ok((await all<{ id: string }>('SELECT id FROM escrow_transactions WHERE booking_id=? LIMIT 1', bookingId)).length > 0);
    (await assert.rejects(async () => (await run('UPDATE escrow_transactions SET amount=0 WHERE booking_id=?', bookingId))));
    assert.ok((await all<{ id: string }>('SELECT id FROM booking_events WHERE booking_id=? LIMIT 1', bookingId)).length > 0);
    (await assert.rejects(async () => (await run('DELETE FROM booking_events WHERE booking_id=?', bookingId))));
    assert.ok((await all<{ id: string }>('SELECT id FROM audit_log LIMIT 1')).length > 0);
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
    }>("SELECT COUNT(*)::int n FROM vouchers WHERE code LIKE 'THANKS-%'"))!.n;
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
    }>("SELECT COUNT(*)::int n FROM vouchers WHERE code LIKE 'THANKS-%'"))!.n, countBefore + 2);
    (await rewardReferral(c.id));
    assert.equal((await one<{
        n: number;
    }>("SELECT COUNT(*)::int n FROM vouchers WHERE code LIKE 'THANKS-%'"))!.n, countBefore + 2);
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
    const bookingsBefore = (await one<{ n: number }>('SELECT COUNT(*)::int n FROM bookings'))!.n;
    await assert.rejects(() => executeAction(null, 'booking.create', {
        packageId: 'package-0-0-0', eventDate: day(150), eventType: 'Birthday',
        location: 'A test venue in Quezon City', guests: 50, contact: '09170000000',
    }), (error: unknown) => error instanceof DomainError && error.status === 401);
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM bookings'))!.n, bookingsBefore);
    assert.equal((await userFromToken(session.token)), null, 'The pre-suspension token remains invalid after a direct booking attempt.');
    (await m.adminUser(admin, c.id, 'ACTIVE'));
    const providerSession = await login({ email: providerUser.email, password: DEMO_PASSWORD });
    (await m.adminUser(admin, providerUser.id, 'SUSPENDED'));
    assert.equal((await userFromToken(providerSession.token)), null);
    await assert.rejects(() => executeAction(null, 'calendar.save', {
        date: day(150), status: 'UNAVAILABLE', note: 'Unavailable',
    }), (error: unknown) => error instanceof DomainError && error.status === 401);
    (await m.adminUser(admin, providerUser.id, 'ACTIVE'));
    (await m.saveSettings(admin, { platformFee: 7, silver: 4, gold: 9, platinum: 16 }));
    assert.equal((await settings()).platformFee, 7);
    assert.equal(rankFor(3, (await settings())), 'BRONZE');
    (await assert.rejects(async () => (await m.saveSettings(customer, { platformFee: 0 }))));
    (await assert.rejects(async () => (await m.saveSettings(admin, { silver: 10, gold: 5, platinum: 3 }))));
});
test('public account appeals are rate-limited, admin-only, and never change account access', async () => {
    const email = `${id()}@appeal.test`;
    const input = { email, accountType: 'PROVIDER', category: 'SUSPENSION_REVIEW', message: 'Please review the status of my provider account and let me know what information is needed.' };
    for (let i = 0; i < 4; i++)
        assert.equal((await submitPublicAppeal(input)).message, (await submitPublicAppeal({ ...input, website: 'bot' })).message);
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM public_account_support WHERE submitted_email=?', email))!.n, 3);
    const appeal = await one<{ id: string }>('SELECT id FROM public_account_support WHERE submitted_email=? LIMIT 1', email);
    assert.ok(appeal);
    await assert.rejects(() => reviewPublicAppeal(customer, { id: appeal!.id, status: 'RESOLVED', internalNotes: 'Reviewed.' }));
    const response = await reviewPublicAppeal(admin, { id: appeal!.id, status: 'IN_REVIEW', internalNotes: 'Manual follow-up required.', followUpRequired: false });
    assert.match(response.message, /No email was sent/);
    assert.equal((await one<{ status: string }>('SELECT status FROM public_account_support WHERE id=?', appeal!.id))!.status, 'IN_REVIEW');
    assert.equal((await one<{ follow_up_required: boolean }>('SELECT follow_up_required FROM public_account_support WHERE id=?', appeal!.id))!.follow_up_required, false);
    assert.equal((await user(providerUser.id)).status, 'ACTIVE');
});

test('24-hour deadline expires a partially accepted bundle once and releases every reservation', async () => {
    const c = await freshCustomer();
    const other = await freshCustomer();
    const candidate = (await bundles(day(170))).find((value) => value.ready && value.available);
    assert.ok(candidate);
    const bookingId = (await b.createBooking(c, {
        bundleId: candidate.id, eventDate: day(170), eventType: 'Birthday', location: 'A test venue in Quezon City',
        guests: 50, contact: '09170000000',
    })).redirect.split('/').at(-1)!;
    const items = await bookingItems(bookingId);
    assert.ok(items.length > 1);
    await b.acceptBooking(await user(items[0].provider_user_id), bookingId);
    assert.ok(await one('SELECT 1 FROM reservations WHERE booking_id=?', bookingId));
    const expiredAt = new Date(Date.now() + 1_000);
    await run('UPDATE bookings SET response_deadline_at=? WHERE id=?', new Date(Date.now() - 1_000).toISOString(), bookingId);
    assert.equal(await b.expireDueBookingsFor(other, expiredAt), 0, 'An unrelated customer cannot cause another account’s expiry operation.');
    assert.equal((await booking(bookingId, c)).status, 'PENDING');
    const results = await Promise.allSettled([
        b.expirePendingBooking(bookingId, expiredAt),
        b.acceptBooking(await user(items[1].provider_user_id), bookingId),
        b.cancelBooking(c, bookingId, 'Our plans have changed.'),
    ]);
    assert.ok(results.some((value) => value.status === 'fulfilled'));
    const result = await booking(bookingId, c);
    assert.equal(result.status, 'CANCELLED');
    assert.ok(result.expired_at);
    assert.ok(result.items.every((item) => item.status === 'CANCELLED'));
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM reservations WHERE booking_id=?', bookingId))!.n, 0);
    assert.equal((await one<{ n: number }>("SELECT COUNT(*)::int n FROM booking_events WHERE booking_id=? AND event='Booking request expired'", bookingId))!.n, 1);
    assert.equal((await one<{ n: number }>("SELECT COUNT(*)::int n FROM notifications WHERE user_id=? AND title='Booking request expired'", c.id))!.n, 1);
    for (const item of items)
        assert.equal((await one<{ n: number }>("SELECT COUNT(*)::int n FROM notifications WHERE user_id=? AND title='Booking request expired'", item.provider_user_id))!.n, 1);
    assert.equal(await b.expirePendingBooking(bookingId, expiredAt), false);
});
test('deadline leaves old pending records alone, releases voucher reservations, and never expires accepted bookings', async () => {
    const c = await freshCustomer();
    const previous = await one<{ id: string }>("SELECT id FROM bookings WHERE status='PENDING' AND response_deadline_at IS NULL LIMIT 1");
    assert.ok(previous, 'Pre-migration pending records keep a NULL deadline.');
    const first = await request(c, day(172), 'package-0-0-0', { voucher: 'WELCOME10' });
    const expiredAt = new Date(Date.now() + 1_000);
    await run('UPDATE bookings SET response_deadline_at=? WHERE id=?', new Date(expiredAt.getTime() - 1).toISOString(), first);
    assert.equal(await b.expirePendingBooking(first, expiredAt), true);
    const second = await request(c, day(173), 'package-0-0-0', { voucher: 'WELCOME10' });
    assert.equal((await booking(second, c)).discount, (await booking(first, c)).discount);
    const accepted = await request(c, day(174));
    await b.acceptBooking(providerUser, accepted);
    assert.equal(await b.expirePendingBooking(accepted, new Date(Date.now() + 25 * 60 * 60_000)), false);
    assert.equal((await booking(accepted, c)).status, 'ACCEPTED');
});
test('provider cancellation reasons preserve bundle transitions and moderate Other text', async () => {
    const c = await freshCustomer();
    const fixedReasonBooking = await request(c, day(175));
    await b.cancelBooking(providerUser, fixedReasonBooking, { reasonCode: 'SCHEDULING' });
    const fixedReason = await one<{ reason_code: string; submitted_text: string }>('SELECT reason_code,submitted_text FROM provider_cancellation_reasons WHERE booking_id=?', fixedReasonBooking);
    assert.deepEqual(fixedReason, { reason_code: 'SCHEDULING', submitted_text: '' });
    assert.equal((await cancellationReasonForBooking(fixedReasonBooking, c))?.reason_code, 'SCHEDULING');

    const bundleCandidate = (await bundles(day(176))).find((value) => value.ready && value.available && value.items.some((item) => item.user_id === providerUser.id));
    assert.ok(bundleCandidate);
    const bundleBooking = (await b.createBooking(c, {
        bundleId: bundleCandidate.id, eventDate: day(176), eventType: 'Birthday', location: 'A test venue in Quezon City',
        guests: 50, contact: '09170000000',
    })).redirect.split('/').at(-1)!;
    await b.cancelBooking(providerUser, bundleBooking, { reasonCode: 'WEATHER_SAFETY' });
    const cancelledBundle = await booking(bundleBooking, c);
    assert.equal(cancelledBundle.status, 'CANCELLED');
    assert.ok(cancelledBundle.items.every((item) => item.status === 'CANCELLED'));

    const bookingId = await request(c, day(171));
    await assert.rejects(() => b.cancelBooking(providerUser, bookingId, { reasonCode: 'NOT_A_REASON' }));
    await assert.rejects(() => b.cancelBooking(providerUser, bookingId, { reasonCode: 'OTHER', otherReasonText: 'short' }));
    const privateText = 'We had an unexpected staffing problem and need help finding a replacement.';
    await b.cancelBooking(providerUser, bookingId, { reasonCode: 'OTHER', otherReasonText: privateText });
    assert.equal((await booking(bookingId, c)).status, 'CANCELLED');
    const reason = await one<{ id: string }>('SELECT id FROM provider_cancellation_reasons WHERE booking_id=?', bookingId);
    assert.ok(reason);
    assert.equal((await cancellationReasonForBooking(bookingId, c))?.submitted_text, '');
    assert.equal((await cancellationReasonForBooking(bookingId, providerUser))?.submitted_text, privateText);
    assert.ok((await pendingProviderCancellationReasons(admin)).some((item) => item.id === reason!.id));
    assert.equal((await one<{ n: number }>("SELECT COUNT(*)::int n FROM notifications WHERE user_id=? AND title='Booking cancelled' AND body LIKE '%'||?||'%'", c.id, privateText))!.n, 0);
    await assert.rejects(() => reviewProviderCancellation(customer, { id: reason!.id, decision: 'APPROVED', customerVisibleReason: 'Professional explanation.' }));
    const note = 'Reviewed the wording and approved a concise customer-facing version.';
    await reviewProviderCancellation(admin, { id: reason!.id, decision: 'APPROVED', customerVisibleReason: 'Provider had a staffing issue.', moderationNote: note });
    const customerView = await cancellationReasonForBooking(bookingId, c);
    assert.equal(customerView?.submitted_text, '');
    assert.equal(customerView?.customer_visible_reason, 'Provider had a staffing issue.');
    assert.equal((await cancellationReasonForBooking(bookingId, providerUser))?.submitted_text, privateText);
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM provider_cancellation_reviews WHERE reason_id=?', reason!.id))!.n, 1);
    await assert.rejects(() => run('UPDATE provider_cancellation_reasons SET submitted_text=\'removed\' WHERE id=?', reason!.id));
});

test('48-hour provider cancellation window uses Philippine calendar boundaries and administrator review', async () => {
    const eventStart = Date.parse('2030-05-10T00:00:00+08:00');
    assert.equal(providerCancellationWindowActive('2030-05-10', new Date(eventStart - 48 * 60 * 60_000 - 1)), false);
    assert.equal(providerCancellationWindowActive('2030-05-10', new Date(eventStart - 48 * 60 * 60_000)), true);
    assert.equal(providerCancellationWindowActive('2030-05-10', new Date(eventStart + 23 * 60 * 60_000)), true);
    assert.equal(providerCancellationWindowActive('2030-05-10', new Date(eventStart + 24 * 60 * 60_000)), false);

    const c = await freshCustomer();
    const rejectedDate = day(250);
    const rejectedEventStart = Date.parse(`${rejectedDate}T00:00:00+08:00`);
    const rejectedBooking = await request(c, rejectedDate);
    await b.cancelBooking(providerUser, rejectedBooking, { reasonCode: 'EMERGENCY', otherReasonText: '' }, new Date(rejectedEventStart - 24 * 60 * 60_000));
    const rejectedRequest = await one<{ id: string }>("SELECT id FROM provider_cancellation_requests WHERE booking_id=? AND status='PENDING'", rejectedBooking);
    assert.ok(rejectedRequest);
    assert.equal((await booking(rejectedBooking, c)).status, 'PENDING');
    assert.ok((await pendingEmergencyCancellationRequests(admin)).some((item) => item.id === rejectedRequest!.id));
    await assert.rejects(() => b.reviewProviderCancellationRequest(c, { id: rejectedRequest!.id, decision: 'APPROVED' }));
    await assert.rejects(() => b.acceptBooking(providerUser, rejectedBooking));
    await b.reviewProviderCancellationRequest(admin, { id: rejectedRequest!.id, decision: 'REJECTED', note: 'Booking remains active.' });
    assert.equal((await booking(rejectedBooking, c)).status, 'PENDING');

    const approvedDate = day(251);
    const approvedEventStart = Date.parse(`${approvedDate}T00:00:00+08:00`);
    const approvedBooking = await request(c, approvedDate);
    await b.cancelBooking(providerUser, approvedBooking, { reasonCode: 'STAFFING', otherReasonText: '' }, new Date(approvedEventStart - 24 * 60 * 60_000));
    const approvedRequest = await one<{ id: string }>("SELECT id FROM provider_cancellation_requests WHERE booking_id=? AND status='PENDING'", approvedBooking);
    assert.ok(approvedRequest);
    await b.reviewProviderCancellationRequest(admin, { id: approvedRequest!.id, decision: 'APPROVED', note: 'Urgent unavailability confirmed.' });
    assert.equal((await booking(approvedBooking, c)).status, 'CANCELLED');
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM reservations WHERE booking_id=?', approvedBooking))!.n, 0);
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM provider_cancellation_request_reviews WHERE request_id=?', approvedRequest!.id))!.n, 1);

    const paidDate = day(252);
    const paidEventStart = Date.parse(`${paidDate}T00:00:00+08:00`);
    const paidBooking = await request(c, paidDate);
    await b.acceptBooking(providerUser, paidBooking);
    await b.payBooking(c, paidBooking, true);
    await b.cancelBooking(providerUser, paidBooking, { reasonCode: 'EMERGENCY', otherReasonText: '' }, new Date(paidEventStart - 24 * 60 * 60_000));
    const paidRequest = await one<{ id: string }>("SELECT id FROM provider_cancellation_requests WHERE booking_id=? AND status='PENDING'", paidBooking);
    assert.ok(paidRequest);
    await b.reviewProviderCancellationRequest(admin, { id: paidRequest!.id, decision: 'APPROVED', note: 'Escalated to dispute review.' });
    assert.equal((await booking(paidBooking, c)).status, 'DISPUTED');
    assert.equal((await booking(paidBooking, c)).escrow_status, 'DISPUTED');
    await assert.rejects(() => run('DELETE FROM provider_cancellation_request_reviews WHERE request_id=?', paidRequest!.id));
});

test('booking messages are private to each item, notify once, track reads, and reject suspended users', async () => {
    const c = await freshCustomer();
    const bookingId = await request(c, day(178));
    const item = (await bookingItems(bookingId))[0]!;
    const p = await user(item.provider_user_id);
    const text = '<script>alert("safe text")</script> Please confirm the setup time.';
    const sent = await sendBookingMessage(c, { itemId: item.id, body: text });
    const providerView = await readConversation(p, item.id);
    assert.equal(providerView.unread, 1);
    assert.equal(providerView.messages[0]?.body, text);
    assert.ok(providerView.messages[0]?.read_at);
    assert.equal((await one<{ n: number }>("SELECT COUNT(*)::int n FROM notifications WHERE id=? AND user_id=?", `booking-message-${sent.messageId}`, p.id))!.n, 1);
    await sendBookingMessage(p, { itemId: item.id, body: 'The team will arrive at the agreed setup window.' });
    const customerView = await readConversation(c, item.id);
    assert.equal(customerView.unread, 1);
    assert.equal(customerView.messages.length, 2);
    assert.equal(customerView.canSend, true);
    const unrelatedProvider = await user('provider-user-1');
    await assert.rejects(() => readConversation(unrelatedProvider, item.id));
    await assert.rejects(() => sendBookingMessage(unrelatedProvider, { itemId: item.id, body: 'Cross-provider message' }));
    await assert.rejects(() => sendBookingMessage(c, { itemId: item.id, body: '   ' }));
    await assert.rejects(() => sendBookingMessage(c, { itemId: item.id, body: 'x'.repeat(4001) }));

    await m.adminUser(admin, c.id, 'SUSPENDED');
    await assert.rejects(() => readConversation({ ...c, status: 'SUSPENDED' }, item.id));
    await assert.rejects(() => sendBookingMessage({ ...c, status: 'SUSPENDED' }, { itemId: item.id, body: 'Not allowed.' }));
});

test('loyalty beta awards idempotent Manila-day check-ins and referred rank milestones only', async () => {
    const c = await freshCustomer();
    const firstMoment = new Date('2030-05-09T15:59:59.000Z');
    const nextDayMoment = new Date('2030-05-09T16:00:00.000Z');
    assert.equal(manilaDateKey(firstMoment), '2030-05-09');
    assert.equal(manilaDateKey(nextDayMoment), '2030-05-10');
    await dailyCheckIn(c, firstMoment);
    await dailyCheckIn(c, firstMoment);
    await dailyCheckIn(c, nextDayMoment);
    assert.equal((await experienceSummary(c.id)).total, 10);
    await assert.rejects(() => dailyCheckIn(providerUser, firstMoment));
    assert.equal(monetaryLoyaltyRewardsEnabled, false);

    const referrer = await freshCustomer();
    const referred = await freshCustomer(referrer.referral_code);
    await run("INSERT INTO settings(key,value) VALUES('silver',1),('gold',2),('platinum',3) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value");
    const bookingId = await request(referred, day(260));
    await confirm(referred, bookingId);
    await finishItem(referred, (await bookingItems(bookingId))[0]!.id);
    await awardCompletedBookingExperience(referred.id, bookingId);
    assert.equal((await experienceSummary(referred.id)).completedBookings, 1);
    assert.equal((await experienceSummary(referrer.id)).referralMilestones, 1);
    assert.equal((await one<{ points: number }>("SELECT points FROM experience_ledger WHERE user_id=? AND event_type='REFERRAL_RANK_UP'", referrer.id))?.points, 25);
    assert.equal((await one<{ n: number }>("SELECT COUNT(*)::int n FROM experience_ledger WHERE user_id=? AND event_type='BOOKING_COMPLETED'", referred.id))!.n, 1);
});

test('scheduled expiry uses the same idempotent reconciliation and requires its bearer secret', async () => {
    const secret = 'isolated-cron-test-secret-at-least-32-chars';
    assert.equal(validCronAuthorization(`Bearer ${secret}`, secret), true);
    assert.equal(validCronAuthorization('Bearer incorrect', secret), false);
    assert.equal(validCronAuthorization(null, secret), false);
    assert.equal(validCronAuthorization(`Bearer ${secret}`, ''), false);
    const c = await freshCustomer();
    const bookingId = await request(c, day(240));
    const dueAt = new Date(Date.now() + 1000);
    await run('UPDATE bookings SET response_deadline_at=? WHERE id=?', new Date(dueAt.getTime() - 1).toISOString(), bookingId);
    const result = await expireDueBookings(dueAt, 10);
    assert.ok(result.checked >= 1);
    assert.ok(result.expired >= 1);
    assert.equal((await booking(bookingId, c)).status, 'CANCELLED');
    assert.equal(await expireDueBookings(dueAt, 10).then((again) => again.expired), 0);
});

test('deposit prototype handles odd centavos, bundle allocations, and retries without touching escrow', async () => {
    assert.equal(Math.ceil(10001 / 2), 5001);
    assert.deepEqual(splitCentavos(5001, [{ id: 'a', amount: 3333 }, { id: 'b', amount: 6668 }]), [
      { itemId: 'a', amount: 1667 }, { itemId: 'b', amount: 3334 },
    ]);
    const c = await freshCustomer();
    const bundleCandidate = (await bundles(day(265))).find((value) => value.ready && value.available);
    assert.ok(bundleCandidate);
    const bookingId = (await b.createBooking(c, {
      bundleId: bundleCandidate.id, eventDate: day(265), eventType: 'Wedding', location: 'A test venue in Manila',
      guests: 50, contact: '09170000000',
    })).redirect.split('/').at(-1)!;
    for (const item of await bookingItems(bookingId)) await b.acceptBooking(await user(item.provider_user_id), bookingId);
    const before = await booking(bookingId, c);
    const deposit = await recordSimulatedInstallment(c, bookingId, 'DEPOSIT');
    assert.equal(deposit.amount, Math.ceil(before.total / 2));
    assert.equal((await one<{ n: number }>('SELECT SUM(amount)::int n FROM simulated_deposit_entries WHERE booking_id=? AND stage=\'DEPOSIT\'', bookingId))!.n, deposit.amount);
    await assert.rejects(() => recordSimulatedInstallment(c, bookingId, 'DEPOSIT'));
    const balance = await recordSimulatedInstallment(c, bookingId, 'BALANCE');
    assert.equal(balance.amount, before.total - deposit.amount);
    assert.equal((await simulatedInstallments(bookingId)).reduce((sum, row) => sum + row.amount, 0), before.total);
    assert.equal((await booking(bookingId, c)).status, 'ACCEPTED');
    assert.equal((await booking(bookingId, c)).escrow_status, 'UNPAID');
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM payments WHERE booking_id=?', bookingId))!.n, 0);
    assert.equal((await one<{ n: number }>('SELECT COUNT(*)::int n FROM escrow_transactions WHERE booking_id=?', bookingId))!.n, 0);
    assert.ok((await one<{ n: number }>('SELECT COUNT(DISTINCT booking_item_id)::int n FROM simulated_deposit_entries WHERE booking_id=?', bookingId))!.n > 1);
});
