// Read-only route smoke checks against an already-running local development server.
import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3000';
const publicRoutes = [
  '/',
  '/browse',
  '/browse?category=photography&sort=rating',
  '/services/service-0-0',
  '/providers/provider-0',
  '/bundles',
  '/bundles/bundle-wedding',
  '/support',
  '/login',
  '/register',
];
const routes: Record<string, string[]> = {
  customer: [
    '/dashboard',
    '/bookings',
    '/bookings/demo-confirmed',
    '/checkout/demo-accepted',
    '/profile',
    '/vouchers',
    '/notifications',
  ],
  provider: [
    '/provider',
    '/provider/services',
    '/provider/services/new',
    '/provider/services/service-0-0',
    '/provider/packages',
    '/provider/bookings',
    '/provider/calendar',
    '/provider/bundles',
    '/provider/reviews',
    '/provider/earnings',
    '/provider/subscription',
    '/provider/promotions',
    '/provider/profile',
    '/notifications',
    '/support',
  ],
  admin: [
    '/admin',
    '/admin/users',
    '/admin/providers',
    '/admin/services',
    '/admin/categories',
    '/admin/bookings',
    '/admin/bundles',
    '/admin/bundles/bundle-wedding',
    '/admin/bundles/new',
    '/admin/vouchers',
    '/admin/vouchers/welcome-voucher',
    '/admin/vouchers/new',
    '/admin/subscriptions',
    '/admin/placements',
    '/admin/badges',
    '/admin/disputes',
    '/admin/escrow',
    '/admin/support',
    '/admin/settings',
    '/admin/audit',
    '/bookings/demo-disputed',
  ],
};
let total = 0;
for (const path of publicRoutes) {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200, path);
  const body = await r.text();
  assert.ok(!body.includes('A little hiccup in the plans.'), `${path} rendered an error boundary`);
  total++;
}
for (const [role, paths] of Object.entries(routes)) {
  const login = await fetch(origin + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${role}@demo.local`, password: 'DemoPass!2026' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join(';');
  for (const path of paths) {
    const r = await fetch(origin + path, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200, path);
    const body = await r.text();
    assert.ok(
      !body.includes('A little hiccup in the plans.'),
      `${path} rendered an error boundary`,
    );
    total++;
  }
  const wrong =
    role === 'admin'
      ? null
      : await fetch(origin + (role === 'provider' ? '/admin' : '/provider'), {
          headers: { Cookie: cookie },
          redirect: 'manual',
        });
  if (wrong)
    assert.ok(
      [303, 307].includes(wrong.status) || (await wrong.text()).includes('url=/forbidden'),
      'role route must redirect',
    );
  await fetch(origin + '/api/auth/logout', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  });
}
const unauth = await fetch(origin + '/admin', { redirect: 'manual' });
assert.ok(unauth.status === 307 || (await unauth.text()).includes('url=/login'));
const crossOrigin = await fetch(origin + '/api/auth/login', {
  method: 'POST',
  headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@demo.local', password: 'DemoPass!2026' }),
});
assert.equal(crossOrigin.status, 403);
console.log(
  `${total} public and authenticated routes passed; role redirects and CSRF origin checks passed.`,
);
