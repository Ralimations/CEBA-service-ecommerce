import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { day, DEMO_PASSWORD } from '@/database/seed';
mkdirSync('artifacts', { recursive: true });
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(`${role}@demo.local`);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Welcome back', exact: true }).click();
  await expect(page).toHaveURL(
    role === 'admin' ? /\/admin$/ : role.startsWith('provider') ? /\/provider$/ : /\/dashboard$/,
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}
test('bundle draft, supplier terms, publication, and multi-provider customer request', async ({
  browser,
}) => {
  const ac = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const a = await ac.newPage();
  await login(a, 'admin');
  await a.goto('/admin/bundles/new');
  await a.getByLabel('Bundle name', { exact: true }).fill('Milestone celebration team');
  await a
    .getByLabel('Description', { exact: true })
    .fill('A thoughtful photography and beauty team for an intimate milestone celebration.');
  await a.getByRole('button', { name: 'Save bundle draft' }).click();
  await expect(a).toHaveURL(/\/admin\/bundles\/[a-f0-9-]+$/);
  const adminPath = new URL(a.url()).pathname;
  const bundleId = adminPath.split('/').at(-1)!;
  for (const [packageId, price] of [
    ['package-0-0-0', '8000'],
    ['package-4-0-0', '6000'],
  ]) {
    await a.getByLabel('Eligible service package').selectOption(packageId);
    await a.getByLabel('Proposed bundle-specific price (PHP)').fill(price);
    await a.getByRole('button', { name: 'Send provider invitation' }).click();
    await expect(
      a.getByText('Provider invited. Approval is required before publication.'),
    ).toBeVisible();
  }
  await a.getByRole('button', { name: 'Publish bundle', exact: true }).click();
  await expect(
    a.getByText('All suppliers must approve, and their packages must be active.'),
  ).toBeVisible();
  for (const role of ['provider', 'provider5']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    const page = await context.newPage();
    await login(page, role);
    await page.goto('/provider/bundles');
    const panel = page.locator('section.panel').filter({
      has: page.getByRole('heading', { name: 'Milestone celebration team', exact: true }),
    });
    await panel.getByRole('button', { name: 'Save participation decision' }).click();
    await expect(
      panel.getByText(
        'Participation terms saved. The administrator can publish after all suppliers approve.',
      ),
    ).toBeVisible();
    await context.close();
  }
  await a.reload();
  await a.getByRole('button', { name: 'Publish bundle', exact: true }).click();
  await expect(a.getByText('Bundle published.', { exact: true })).toBeVisible();
  const cc = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const c = await cc.newPage();
  await login(c, 'customer3');
  await c.goto(`/bundles/${bundleId}`);
  await expect(
    c.getByRole('heading', { name: 'Milestone celebration team', exact: true }),
  ).toBeVisible();
  await c.getByLabel('Event date', { exact: true }).fill(day(230));
  await c.getByLabel('Venue / location').fill('A quiet celebration garden in Manila');
  await c.getByRole('button', { name: 'Request your date' }).click();
  await expect(c).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
  await expect(c.getByText('Waiting for 2 provider acceptance(s).')).toBeVisible();
  await expect(c.getByRole('link', { name: 'Luna Lens Photography', exact: true })).toBeVisible();
  await expect(c.getByRole('link', { name: 'Velvet Glow Makeup', exact: true })).toBeVisible();
  await c.screenshot({ path: 'artifacts/bundle-booking.png', fullPage: true });
  await cc.close();
  await ac.close();
});
test('admin creates a voucher and provider purchases VIP and a sponsored placement', async ({
  browser,
}) => {
  const ac = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const a = await ac.newPage();
  await login(a, 'admin');
  await a.goto('/admin/vouchers/new');
  await a.getByLabel('Voucher code', { exact: true }).fill('BROWSER20');
  await a
    .getByLabel('Description', { exact: true })
    .fill('A seasonal twenty percent celebration offer.');
  await a.getByLabel('Discount type').selectOption('PERCENTAGE');
  await a.getByLabel('Discount value (PHP or %)').fill('20');
  await a.getByLabel('Expires on').fill(day(60));
  await a.getByRole('button', { name: 'Save voucher', exact: true }).click();
  await expect(a).toHaveURL(/\/admin\/vouchers$/);
  await expect(a.getByText('BROWSER20', { exact: true })).toBeVisible();
  const pc = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const p = await pc.newPage();
  await login(p, 'provider8');
  await p.goto('/provider/subscription');
  await p.getByRole('button', { name: 'Choose VIP · mock checkout' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(p.getByText('VIP plan activated through development checkout.')).toBeVisible();
  await p.goto('/provider/promotions');
  await p.getByLabel('Where to appear').selectOption('CATEGORY');
  await p.getByRole('button', { name: 'Review simulated purchase' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    p.getByText('Featured placement saved. Paid results are labeled Sponsored.'),
  ).toBeVisible();
  await p.goto('/browse?category=planning');
  await expect(
    p.locator('.service-card').first().getByText('Sponsored', { exact: true }),
  ).toBeVisible();
  await pc.close();
  await ac.close();
});
test('marketplace discovery and responsive desktop, tablet, and mobile layouts', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Big moments/ })).toBeVisible();
  await expect(page.locator('img').first()).toBeVisible();
  expect(
    await page
      .locator('img')
      .evaluateAll(
        (images) =>
          images.filter(
            (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0,
          ).length,
      ),
  ).toBe(0);
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/home-tablet.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Explore services' })
    .click();
  await expect(page.getByRole('heading', { name: 'Find your kind of wonderful.' })).toBeVisible();
  await page.getByLabel('Service category', { exact: true }).selectOption('photography');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('.service-card')).toHaveCount(2);
  await noOverflow(page);
  await page.locator('.service-card').first().getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Make it a date.' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Open event help' }).click();
  await page.getByRole('button', { name: 'How do payments and escrow work?' }).click();
  await expect(page.locator('.chat-widget')).toContainText('No real money is transferred');
});
test('customer registration through payment, provider acceptance, two QR gates, escrow release, review', async ({
  browser,
}) => {
  const cc = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const pc = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const c = await cc.newPage();
  const p = await pc.newPage();
  await c.goto('/register');
  await c.getByLabel('Full name', { exact: true }).fill('Mara Test');
  await c.getByLabel('Email address', { exact: true }).fill('mara-browser@test.local');
  await c.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await c.getByLabel('Confirm password', { exact: true }).fill(DEMO_PASSWORD);
  await c.getByLabel('Phone (optional)', { exact: true }).fill('09171112222');
  await c.getByLabel('Referral code (optional)', { exact: true }).fill('CELEBRATE1');
  await c.getByRole('button', { name: 'Create your account' }).click();
  await expect(c).toHaveURL(/\/dashboard$/);
  await c.goto('/vouchers');
  await expect(c.getByRole('heading', { name: 'WELCOME10', exact: true })).toBeVisible();
  await c.goto('/services/service-0-0');
  await c.getByLabel('Event date', { exact: true }).fill(day(200));
  await c.getByLabel('Venue / location').fill('The Courtyard, Quezon City');
  await c.getByLabel('Voucher code', { exact: true }).fill('WELCOME10');
  await c.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(c.getByText('Voucher applied to this estimate.')).toBeVisible();
  await c.getByRole('button', { name: 'Request your date' }).click();
  await expect(c).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
  const bookingPath = new URL(c.url()).pathname;
  await login(p, 'provider');
  await p.goto(bookingPath);
  await p.getByRole('button', { name: 'Accept booking request' }).click();
  await expect(p.getByText('Booking accepted. This date is now reserved.')).toBeVisible();
  await c.reload();
  await c.getByRole('link', { name: 'Continue to checkout' }).click();
  await c
    .getByRole('checkbox', { name: 'I understand this is a development mock payment.' })
    .check();
  await c.getByRole('button', { name: 'Pay & Reserve' }).click();
  await c.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(c).toHaveURL(new RegExp(bookingPath + '$'));
  await expect(c.getByText('Held in escrow', { exact: true })).toBeVisible();
  await c.getByRole('button', { name: 'Generate QR & code' }).click();
  await expect(c.locator('.verification-code')).toBeVisible();
  const start = (await c.locator('.verification-code').textContent())!;
  await expect(c.getByAltText('Check-in verification QR code')).toBeVisible();
  await p.reload();
  await p.getByLabel('Enter verification code').fill(start);
  await p.getByRole('button', { name: 'Verify & start service' }).click();
  await expect(p.getByRole('heading', { name: 'Gate 2 · Service completion' })).toBeVisible();
  await p.getByRole('button', { name: 'Generate QR & code' }).click();
  await expect(p.locator('.verification-code')).toBeVisible();
  const end = (await p.locator('.verification-code').textContent())!;
  await c.reload();
  await c.getByLabel('Enter verification code').fill(end);
  await c.getByRole('button', { name: 'Verify service completion' }).click();
  await c.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(c.getByText('Released', { exact: true })).toBeVisible();
  await c.getByText('Leave a little love · write a review', { exact: true }).click();
  await c
    .getByLabel('Your experience')
    .fill('A wonderful celebration, with every little detail taken care of.');
  await c.getByRole('button', { name: 'Publish verified review' }).click();
  await expect(c.getByText('Your review is published')).toBeVisible();
  await c.goto(c.url());
  await expect(c.getByText('Your review is published')).toBeVisible();
  await c.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await c.screenshot({ path: 'artifacts/booking-completed.png', fullPage: true });
  await c.goto('/provider');
  await expect(
    c.getByRole('heading', { name: 'This space belongs to another role.' }),
  ).toBeVisible();
  await p.goto('/admin');
  await expect(
    p.getByRole('heading', { name: 'This space belongs to another role.' }),
  ).toBeVisible();
  await c.goto('/profile');
  await expect(c.getByText('Your referred friends will appear here.')).toBeVisible();
  await c.goto('/vouchers');
  await expect(c.getByRole('heading', { name: /THANKS-/ })).toBeVisible();
  await cc.close();
  await pc.close();
});
test('provider creates a service and package, publishes, blocks calendar, and updates profile', async ({
  page,
}) => {
  await login(page, 'provider');
  await page.screenshot({ path: 'artifacts/provider-desktop.png', fullPage: true });
  await page.goto('/provider/services/new');
  await page.getByLabel('Service title', { exact: true }).fill('Milestone photo stories');
  await page
    .getByLabel('Service description')
    .fill('A thoughtful photography package for every family milestone and celebration.');
  await page.getByRole('button', { name: 'Create draft service' }).click();
  await expect(page).toHaveURL(/\/provider\/services\/[a-f0-9-]+$/);
  await page.getByLabel('Package name', { exact: true }).fill('Family signature');
  await page.getByLabel('Package price (PHP)', { exact: true }).fill('9000');
  await page
    .getByLabel('Inclusions (one per line)', { exact: true })
    .fill('4 hours of coverage\nA thoughtful planning call\nDigital gallery');
  await page.getByRole('button', { name: 'Add package', exact: true }).click();
  await expect(
    page.getByText('Package saved. Existing bookings keep their agreed price and terms.'),
  ).toBeVisible();
  await page.getByLabel('Listing status').selectOption('ACTIVE');
  await page.getByRole('button', { name: 'Save service', exact: true }).click();
  await expect(page.getByText('Service updated.', { exact: true })).toBeVisible();
  await page.goto('/browse?q=Milestone+photo+stories');
  await expect(page.locator('.service-card')).toHaveCount(1);
  await page.goto('/provider/calendar');
  await page.getByLabel('Date', { exact: true }).fill(day(220));
  await page.getByLabel('Availability', { exact: true }).selectOption('UNAVAILABLE');
  await page.getByLabel('Note (private)').fill('A day for the team');
  await page.getByRole('button', { name: 'Save availability' }).click();
  await expect(page.getByText(`Availability updated for ${day(220)}.`)).toBeVisible();
  await page.goto('/provider/profile');
  await page.getByLabel('Service area', { exact: true }).fill('Metro Manila, Cavite & Laguna');
  await page.getByRole('button', { name: 'Save business profile' }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Service area', { exact: true })).toHaveValue(
    'Metro Manila, Cavite & Laguna',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/provider/bookings');
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/provider-mobile.png', fullPage: true });
});
test('administrator handles support, refund, categories, and settings; mobile tables stay contained', async ({
  page,
}) => {
  await login(page, 'admin');
  await page.screenshot({ path: 'artifacts/admin-desktop.png', fullPage: true });
  await page.goto('/admin/support');
  await page
    .getByLabel('Administrator response', { exact: true })
    .fill(
      'We can help coordinate the arrival times. Please add the timeline to your booking notes.',
    );
  await page.getByLabel('Ticket status', { exact: true }).selectOption('RESOLVED');
  await page.getByRole('button', { name: 'Save reply & notify customer' }).click();
  await expect(page.getByText('Response sent through in-app support.')).toBeVisible();
  await page.goto('/bookings/demo-disputed');
  await page.getByLabel('Decision', { exact: true }).selectOption('refund');
  await page
    .getByLabel('Review findings / reason')
    .fill('Reviewed the package terms with both parties and approved a full simulated refund.');
  await page.getByRole('button', { name: 'Review & confirm action' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Refunded', { exact: true })).toBeVisible();
  await page.goto('/admin/categories');
  await page.getByLabel('Category name', { exact: true }).first().fill('Transport & arrivals');
  await page.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByText('Category saved.', { exact: true })).toBeVisible();
  await page.goto('/admin/settings');
  await page.getByLabel('Platform fee (%)', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Save platform settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByText('Platform rules saved. New quotes use the updated fee.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Platform fee (%)', { exact: true })).toHaveValue('6');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/escrow');
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/admin-mobile.png', fullPage: true });
});
