// Explicit opt-in: only UUID-named test records are changed. No reset or deletes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { one, all, closeDb } from '../server/db';
if (!process.argv.includes('--write'))
  throw new Error('Pass --write to create isolated API test records.');
if (!process.env.POSTGRES_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3302';
const runId = randomUUID();
const password = `Perf!${randomUUID()}`;
const actors: {
  id: string;
  cookie: string;
  role: string;
  providerId?: string;
  serviceId?: string;
  packageId?: string;
}[] = [];
const checks: string[] = [];
const pass = (message: string) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
let admin = '',
  categoryId = '',
  bundleId = '',
  voucherId = '';
const categoryName = `Perf category ${runId}`;
const voucher = {
  code: `PERF-${runId.slice(0, 12).toUpperCase()}`,
  description: 'Isolated performance test voucher',
  type: 'PERCENTAGE',
  value: 10,
  minSpend: 0,
  maxDiscount: 0,
  validFrom: '2026-01-01',
  expiresAt: '2030-12-31',
  usageLimit: 1,
  perUserLimit: 1,
  rankRequired: 'BRONZE',
  firstOnly: 1,
  categoryId: '',
  active: 1,
};
const serviceData = {
  title: `Perf service ${runId}`,
  description: 'Isolated performance regression service. Not a real offer.',
  categoryId: '',
  price: 5000,
  duration: '2 hours',
  unit: 'event',
  minGuests: 1,
  maxGuests: 100,
  image: '/images/event.jpg',
  status: 'DRAFT',
};
async function post(path: string, data: unknown, cookie = '', expected = 200) {
  const r = await fetch(origin + path, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(60000),
  });
  const body = await r.json();
  assert.equal(r.status, expected, JSON.stringify(body));
  return {
    body: body as Record<string, string | number>,
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join(';'),
  };
}
async function action(cookie: string, action: string, data: unknown, expected = 200) {
  return (await post('/api/actions', { action, data }, cookie, expected)).body;
}
async function page(path: string, cookie = '', missing = false) {
  const r = await fetch(origin + path, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(60000),
  });
  const body = await r.text();
  if (missing)
    assert.ok(body.includes('NEXT_HTTP_ERROR_FALLBACK;404'), path + ' must be hidden/not found');
  else assert.ok(!/:E\{|data-dgst=|A little hiccup/.test(body), path + ' streamed an error');
  return body;
}
try {
  admin = (await post('/api/auth/login', { email: 'admin@demo.local', password: 'DemoPass!2026' }))
    .cookie;
  await action(admin, 'category.save', { name: categoryName, active: 1 });
  categoryId = (await one<{ id: string }>('SELECT id FROM categories WHERE name=?', categoryName))!
    .id;
  serviceData.categoryId = categoryId;
  for (const role of ['CUSTOMER', 'PROVIDER', 'PROVIDER']) {
    const email = `perf-${randomUUID()}@example.invalid`;
    const data = {
      name: `Perf ${role} ${runId.slice(0, 8)}`,
      email,
      password,
      confirmPassword: password,
      role,
      phone: '09000000000',
      businessName: `Perf team ${randomUUID()}`,
      description: 'Disposable cache regression test account.',
      categoryId,
    };
    await post('/api/auth/register', { ...data, termsAccepted: false }, '', 400);
    const registered = await post('/api/auth/register', { ...data, termsAccepted: true });
    const row = (await one<{ id: string; terms_version: string }>(
      'SELECT id,terms_version FROM users WHERE email=?',
      email,
    ))!;
    assert.ok(row.terms_version);
    const actor = {
      id: row.id,
      cookie: registered.cookie,
      role,
      providerId:
        role === 'PROVIDER'
          ? (await one<{ id: string }>('SELECT id FROM providers WHERE user_id=?', row.id))!.id
          : undefined,
    };
    actors.push(actor);
  }
  pass('Customer/provider registration, required terms, persisted consent');
  for (const [index, p] of actors.filter((a) => a.role === 'PROVIDER').entries()) {
    const draft = await action(p.cookie, 'service.save', {
      ...serviceData,
      title: `${serviceData.title} ${index}`,
    });
    p.serviceId = String(draft.redirect).split('/').at(-1)!;
    await page(`/services/${p.serviceId}`, '', true); // Warm the missing public detail.
    await action(p.cookie, 'package.save', {
      serviceId: p.serviceId,
      name: 'Perf package',
      price: 5000,
      inclusions: 'Isolated test inclusion',
      duration: '2 hours',
      active: 1,
    });
    p.packageId = (await one<{ id: string }>(
      'SELECT id FROM packages WHERE service_id=?',
      p.serviceId,
    ))!.id;
    await action(p.cookie, 'service.save', { ...serviceData, id: p.serviceId, status: 'ACTIVE' });
    assert.ok((await page(`/services/${p.serviceId}`)).includes(serviceData.title));
  }
  const [customer, p, p2] = actors;
  await page('/browse');
  await page(`/providers/${p.providerId}`);
  const edited = `Edited ${runId}`;
  await action(p.cookie, 'service.save', {
    ...serviceData,
    id: p.serviceId,
    title: edited,
    status: 'ACTIVE',
  });
  assert.ok((await page('/browse')).includes(edited));
  assert.ok((await page(`/services/${p.serviceId}`)).includes(edited));
  assert.ok((await page(`/providers/${p.providerId}`)).includes(edited));
  pass(
    'Service publication and edit immediately invalidate catalog, detail, provider, and negative entries',
  );
  await page('/browse');
  await action(admin, 'category.save', { id: categoryId, name: `Renamed ${runId}`, active: 1 });
  assert.ok((await page('/browse')).includes(`Renamed ${runId}`));
  pass('Category edit immediately invalidates public categories');
  const date = '2029-02-14';
  const filtered = `/browse?q=${encodeURIComponent(edited)}&date=${date}&available=1`;
  assert.ok((await page(filtered)).includes(p.serviceId!));
  await action(p.cookie, 'calendar.save', {
    date,
    status: 'UNAVAILABLE',
    note: 'Isolated test block',
  });
  assert.ok(!(await page(filtered)).includes(p.serviceId!));
  await action(p.cookie, 'calendar.save', { date, status: 'AVAILABLE', note: '' });
  assert.ok((await page(filtered)).includes(p.serviceId!));
  pass('Date availability is fresh across consecutive blocked/unblocked requests');
  await action(admin, 'voucher.save', voucher);
  voucherId = (await one<{ id: string }>('SELECT id FROM vouchers WHERE code=?', voucher.code))!.id;
  const quote = (
    await post('/api/quote', { packageId: p.packageId, voucher: voucher.code }, customer.cookie)
  ).body;
  assert.equal(quote.subtotal, 500000);
  assert.equal(quote.discount, 50000);
  assert.equal(quote.total, 450000);
  const created = await action(customer.cookie, 'booking.create', {
    packageId: p.packageId,
    eventDate: date,
    eventType: 'Test',
    location: 'Isolated test venue',
    guests: 10,
    contact: '09000000000',
    voucher: voucher.code,
  });
  const bookingId = String(created.redirect).split('/').at(-1)!;
  assert.ok((await page(`/bookings/${bookingId}`, customer.cookie)).includes(edited));
  assert.ok(!(await page('/bookings', p2.cookie)).includes(bookingId));
  const denied = await page(`/bookings/${bookingId}`, p2.cookie, true);
  assert.ok(!denied.includes('Isolated test venue'));
  await action(p2.cookie, 'booking.accept', { bookingId }, 404);
  await action(p.cookie, 'booking.accept', { bookingId });
  assert.ok(!(await page(filtered)).includes(p.serviceId!));
  await action(customer.cookie, 'booking.pay', { bookingId, confirmed: true });
  const item = (await one<{ id: string }>(
    'SELECT id FROM booking_items WHERE booking_id=?',
    bookingId,
  ))!;
  const start = await action(customer.cookie, 'handshake.issue', {
    itemId: item.id,
    gate: 'START',
  });
  await action(p.cookie, 'handshake.verify', { itemId: item.id, gate: 'START', code: start.code });
  const end = await action(p.cookie, 'handshake.issue', { itemId: item.id, gate: 'COMPLETE' });
  await action(customer.cookie, 'handshake.verify', {
    itemId: item.id,
    gate: 'COMPLETE',
    code: end.code,
  });
  const settled = (await one<{ status: string; escrow_status: string; total: number }>(
    'SELECT status,escrow_status,total FROM bookings WHERE id=?',
    bookingId,
  ))!;
  assert.deepEqual(settled, { status: 'COMPLETED', escrow_status: 'RELEASED', total: 450000 });
  pass(
    'Booking creation, ownership, reservation freshness, voucher cents, simulated escrow, both handshake gates',
  );
  await page(`/providers/${p.providerId}`);
  await page(`/services/${p.serviceId}`);
  const review = `Verified performance review ${runId}`;
  await action(customer.cookie, 'review.create', { itemId: item.id, rating: 5, body: review });
  assert.ok((await page(`/providers/${p.providerId}`)).includes(review));
  assert.ok((await page(`/services/${p.serviceId}`)).includes(review));
  pass('Review submission immediately invalidates provider/service ratings and reviews');
  const bundle = await action(admin, 'bundle.save', {
    name: `Perf bundle ${runId}`,
    description: 'Isolated bundle for cache regression testing.',
    image: '/images/event.jpg',
    discount: 5,
  });
  bundleId = String(bundle.redirect).split('/').at(-1)!;
  for (const supplier of [p, p2]) {
    await action(admin, 'bundle.add', { bundleId, packageId: supplier.packageId, price: 5000 });
    const invitation = (await one<{ id: string }>(
      'SELECT id FROM bundle_items WHERE bundle_id=? AND provider_id=?',
      bundleId,
      supplier.providerId!,
    ))!;
    await action(supplier.cookie, 'bundle.respond', {
      itemId: invitation.id,
      approval: 'ACCEPTED',
      price: 5000,
      inclusions: 'Isolated test inclusion',
    });
  }
  await page('/bundles');
  await page(`/bundles/${bundleId}`, '', true);
  await action(admin, 'bundle.status', { id: bundleId, status: 'PUBLISHED' });
  assert.ok((await page('/bundles')).includes(bundleId));
  assert.ok((await page(`/bundles/${bundleId}`)).includes(`Perf bundle ${runId}`));
  await action(admin, 'bundle.save', {
    id: bundleId,
    name: `Changed bundle ${runId}`,
    description: 'Isolated bundle for cache regression testing.',
    image: '/images/event.jpg',
    discount: 10,
  });
  assert.ok(!(await page('/bundles')).includes(bundleId));
  pass(
    'Bundle publication/edit invalidates listing and cached missing details; edits restore draft',
  );
  await page(`/services/${p.serviceId}`);
  await action(admin, 'service.moderate', { id: p.serviceId, disabled: 1 });
  assert.ok(!(await page('/browse')).includes(p.serviceId!));
  pass('Moderation immediately removes cached public listings');
  // Above-pool-size concurrency: distinct bound values must never cross requests.
  const values = await Promise.all(
    Array.from({ length: 16 }, (_, n) => one<{ n: number }>('SELECT ?::int n', n)),
  );
  assert.deepEqual(
    values.map((x) => x!.n),
    Array.from({ length: 16 }, (_, n) => n),
  );
  pass('16 concurrent bound queries retain their own result values');
} finally {
  // Deactivate only records created by this run. Preserve append-only audit/ledger.
  if (admin) {
    if (bundleId) await action(admin, 'bundle.status', { id: bundleId, status: 'ARCHIVED' });
    for (const p of actors.filter((a) => a.serviceId))
      await action(p.cookie, 'service.save', {
        ...serviceData,
        id: p.serviceId,
        status: 'ARCHIVED',
      });
    if (voucherId) await action(admin, 'voucher.save', { ...voucher, id: voucherId, active: 0 });
    if (categoryId)
      await action(admin, 'category.save', { id: categoryId, name: categoryName, active: 0 });
    for (const actor of actors)
      await action(admin, 'user.status', { id: actor.id, status: 'SUSPENDED' });
    for (const actor of actors) {
      assert.equal((await all('SELECT user_id FROM sessions WHERE user_id=?', actor.id)).length, 0);
    }
    await post('/api/auth/logout', {}, admin);
  }
  writeFileSync(
    `artifacts/cache-regression-${runId}.json`,
    JSON.stringify(
      { runId, checks, users: actors.map((a) => a.id), categoryId, bundleId, voucherId },
      null,
      2,
    ),
  );
  await closeDb();
}
