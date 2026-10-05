// Explicit opt-in smoke test. Creates two unique accounts and ONE unpaid booking;
// no migrations, seeding, deletion, acceptance, or payments against the shared DB.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { one, closeDb } from '../server/db';
import { providers, services, customerStats } from '../server/queries';
import { CURRENT_TERMS_VERSION } from '../config/platform';
import { hashToken } from '../server/security';

if (!process.env.POSTGRES_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3000';
const readOnly = process.argv.includes('--public-only');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: existsSync(chrome) ? chrome : undefined });
const errors: string[] = [];
const password = `Hotfix!${randomUUID()}`;
const runId = randomUUID();
async function context() {
  const ctx = await browser.newContext();
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  return ctx;
}
async function visit(page: Page, path: string) {
  const response = await page.goto(origin + path, { timeout: 180000, waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, path);
  const body = await page.locator('body').innerText();
  assert.ok(!/A little hiccup|Application error|Internal Server Error/.test(body), path);
  assert.ok(body.includes('SoiréeSource'), path);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(`PASS ${path}`);
  return body;
}
async function post(ctx: BrowserContext, path: string, data: unknown) {
  return ctx.request.post(origin + path, { data, headers: { Origin: origin }, timeout: 180000 });
}
try {
  const listings = await services();
  assert.ok(listings.length > 0);
  for (const p of await providers()) {
    for (const key of [
      'rating',
      'review_count',
      'completed',
      'disputes',
      'vip',
      'featured',
    ] as const) {
      assert.equal(typeof p[key], 'number', `${key} must be a JS number`);
      assert.ok(Number.isFinite(p[key]));
    }
  }
  const selected = listings.find((s) => s.provider_id === 'provider-0')!;
  assert.ok(selected);
  const pack = await one<{ id: string; active: number }>(
    'SELECT id,active FROM packages WHERE service_id=? AND active=1 ORDER BY price LIMIT 1',
    selected.id,
  );
  assert.equal(pack?.active, 1);
  const bundle = await one<{ id: string }>(
    "SELECT id FROM bundles WHERE status='PUBLISHED' LIMIT 1",
  );
  assert.ok(bundle);
  const temporal = await one<{ same_instant: boolean; earlier: boolean }>(
    `SELECT '2026-10-05T08:00:00+08:00'::timestamptz = '2026-10-05T00:00:00Z'::timestamptz same_instant,
    '2026-10-05T01:00:00Z'::timestamptz < '2026-10-05 02:00:00+00'::timestamptz earlier`,
  );
  assert.deepEqual(temporal, { same_instant: true, earlier: true });
  console.log('PASS aggregate numbers and timestamp semantics');
  const publicContext = await context();
  const page = await publicContext.newPage();
  for (const path of process.argv.includes('--auth-only')
    ? []
    : [
        '/',
        '/browse',
        '/browse?sort=rating',
        '/browse?sort=price-low',
        `/services/${selected.id}`,
        `/providers/${selected.provider_id}`,
        '/bundles',
        `/bundles/${bundle.id}`,
        '/register',
        '/login',
        '/terms',
      ]) {
    await visit(page, path);
  }
  if (!readOnly) {
    const actors: { role: string; email: string; ctx: BrowserContext; page: Page; id: string }[] =
      [];
    for (const role of ['CUSTOMER', 'PROVIDER']) {
      const ctx = await context();
      const p = await ctx.newPage();
      const email = `hotfix-${role.toLowerCase()}-${runId}@example.invalid`;
      const data = {
        name: `Hotfix ${role}`,
        email,
        password,
        confirmPassword: password,
        role,
        phone: '09000000000',
        businessName: `Hotfix test ${runId}`,
        description: 'Runtime verification account, not a real service provider.',
        categoryId: selected.category_id,
      };
      for (const accepted of [undefined, false]) {
        const r = await post(ctx, '/api/auth/register', { ...data, termsAccepted: accepted });
        assert.equal(r.status(), 400, await r.text());
        assert.ok((await r.json()).fields.termsAccepted);
      }
      assert.equal(await one('SELECT id FROM users WHERE email=?', email), undefined);
      await visit(p, `/register?role=${role}`);
      for (const name of ['name', 'email', 'password', 'confirmPassword', 'phone'] as const)
        await p.locator(`[name="${name}"]`).fill(data[name]);
      if (role === 'PROVIDER') {
        await p.locator('[name="businessName"]').fill(data.businessName);
        await p.locator('textarea[name="description"]').fill(data.description);
        await p.locator('[name="categoryId"]').selectOption(data.categoryId);
      }
      const terms = p.locator('[name="termsAccepted"]');
      assert.equal(await terms.getAttribute('required'), '');
      assert.equal(await terms.isChecked(), false);
      assert.equal(await p.locator('a[href="/terms"]').first().getAttribute('target'), '_blank');
      await p.getByRole('button', { name: 'Create your account' }).click();
      assert.equal(
        await terms.evaluate((input: HTMLInputElement) => input.validity.valueMissing),
        true,
      );
      await terms.check();
      const registered = p.waitForResponse((r) => r.url().endsWith('/api/auth/register'));
      await p.getByRole('button', { name: 'Create your account' }).click();
      assert.equal((await registered).status(), 200);
      const home = role === 'CUSTOMER' ? '/dashboard' : '/provider';
      await p.waitForURL(origin + home, { timeout: 180000 });
      await visit(p, home);
      const user = await one<{ id: string; terms_version: string; accepted: string }>(
        'SELECT id,terms_version,terms_accepted_at::text accepted FROM users WHERE email=?',
        email,
      );
      assert.ok(user?.accepted);
      assert.equal(user.terms_version, CURRENT_TERMS_VERSION);
      const cookies = await ctx.cookies();
      const session = cookies.find((c) => c.name === 'event_session');
      assert.ok(session?.httpOnly);
      assert.equal(session.sameSite, 'Lax');
      const oldCookie = `event_session=${session.value}`;
      assert.equal((await post(ctx, '/api/auth/logout', {})).status(), 200);
      const oldSession = await ctx.request.get(origin + home, {
        headers: { Cookie: oldCookie },
        maxRedirects: 0,
      });
      assert.ok(oldSession.status() === 307 || (await oldSession.text()).includes('url=/login'));
      assert.equal(
        await one('SELECT user_id FROM sessions WHERE token_hash=?', hashToken(session.value)),
        undefined,
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        assert.equal(
          (await post(ctx, '/api/auth/login', { email, password: 'WrongPassword!' })).status(),
          401,
        );
      }
      await visit(p, '/login');
      await p.locator('[name="email"]').fill(email);
      await p.locator('[name="password"]').fill(password);
      await p.getByRole('button', { name: 'Welcome back', exact: true }).click();
      await p.waitForURL(origin + home, { timeout: 180000 });
      await visit(p, home);
      actors.push({ role, email, ctx, page: p, id: user.id });
      console.log(
        `PASS ${role}: browser registration, required terms, persisted consent, login, logout, invalidated session`,
      );
    }
    const customer = actors[0];
    const stats = await customerStats(customer.id);
    assert.equal(stats.completed, 0);
    assert.equal(stats.spending, 0);
    const date = new Date(Date.now() + 500 * 86400000).toISOString().slice(0, 10);
    await visit(customer.page, `/services/${selected.id}`);
    await customer.page.locator('[name="packageId"]').selectOption(pack!.id);
    for (const [name, value] of Object.entries({
      eventDate: date,
      location: 'Test only - no actual event',
      guests: String(Math.max(selected.min_guests, 1)),
      contact: customer.email,
      requests: `Hotfix ${runId}: unpaid runtime verification; no service expected.`,
    })) {
      await customer.page.locator(`[name="${name}"]`).fill(value);
    }
    const bookingRequest = customer.page.waitForResponse((r) => r.url().endsWith('/api/actions'), {
      timeout: 180000,
    });
    await customer.page.getByRole('button', { name: 'Request your date' }).click();
    const bookingResponse = await bookingRequest;
    const result = await bookingResponse.json();
    assert.equal(bookingResponse.status(), 200, JSON.stringify(result));
    assert.match(result.redirect, /^\/bookings\//);
    await visit(customer.page, result.redirect);
    const bookingId = result.redirect.split('/').pop();
    const row = await one<{ status: string; escrow_status: string }>(
      'SELECT status,escrow_status FROM bookings WHERE id=? AND customer_id=?',
      bookingId,
      customer.id,
    );
    assert.deepEqual(row, { status: 'PENDING', escrow_status: 'UNPAID' });
    // A pending unpaid booking gives SUM(... paid) = 0, which must not be a truthy "0".
    const quote = await post(customer.ctx, '/api/quote', {
      packageId: pack!.id,
      addons: [],
      voucher: 'WELCOME10',
    });
    assert.equal(quote.status(), 200, await quote.text());
    assert.ok((await quote.json()).discount > 0);
    for (const [email, path] of [
      ['provider@demo.local', '/provider'],
      ['admin@demo.local', '/admin'],
    ]) {
      const ctx = await context();
      const p = await ctx.newPage();
      const login = await post(ctx, '/api/auth/login', { email, password: 'DemoPass!2026' });
      assert.equal(login.status(), 200, await login.text());
      await visit(p, path);
      if (path === '/provider') {
        await visit(p, '/provider/bookings');
        assert.ok((await p.locator(`a[href="${result.redirect}"]`).count()) > 0);
        await visit(p, result.redirect);
      }
      await post(ctx, '/api/auth/logout', {});
    }
    for (const actor of actors) await post(actor.ctx, '/api/auth/logout', {});
    console.log(
      `PASS booking ${bookingId}: customer and provider can view; PENDING/UNPAID; test accounts retained (${runId})`,
    );
  }
  console.log(`PASS runtime smoke (${readOnly ? 'public-only' : 'full'}, ${origin})`);
} finally {
  await browser.close();
  await closeDb();
}
