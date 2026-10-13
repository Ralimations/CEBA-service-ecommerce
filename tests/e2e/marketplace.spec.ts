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
  await c.getByRole('checkbox', { name: /agree to the Terms of Service/ }).check();
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
  const thread = c.locator('.booking-messages');
  await expect(thread).toBeVisible();
  const itemId = await thread.getAttribute('data-item-id');
  expect(itemId).toBeTruthy();
  const firstMessage = 'Could we confirm the setup arrival window?';
  await thread.getByLabel('Write a booking message').fill(firstMessage);
  await thread.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(thread.getByText(firstMessage)).toBeVisible();
  await login(p, 'provider');
  await p.goto(bookingPath);
  const providerThread = p.locator(`.booking-messages[data-item-id="${itemId}"]`);
  await expect(providerThread.getByText(firstMessage)).toBeVisible();
  await providerThread.getByLabel('Write a booking message').fill('The team will arrive during the agreed setup window.');
  await providerThread.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(providerThread.getByText('The team will arrive during the agreed setup window.')).toBeVisible();
  await c.reload();
  await expect(c.locator('.booking-messages').getByText('The team will arrive during the agreed setup window.')).toBeVisible();
  const unrelated = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(unrelated, 'provider2');
  const deniedMessages = await unrelated.request.get(`/api/messages?itemId=${encodeURIComponent(itemId!)}`);
  expect(deniedMessages.status()).toBe(404);
  await unrelated.close();
  await p.getByRole('button', { name: 'Accept booking request' }).click();
  await expect(p.getByText('Booking accepted. This date is now reserved.')).toBeVisible();
  await c.reload();
  await c.getByRole('link', { name: 'Continue to checkout' }).click();
  const depositPrototype = c.locator('.deposit-prototype');
  await expect(depositPrototype).toBeVisible();
  await depositPrototype.getByRole('button', { name: 'Record simulated deposit' }).click();
  await c.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(c.getByText('Deposit recorded in the non-settling prototype ledger.')).toBeVisible();
  await depositPrototype.getByRole('button', { name: 'Record simulated balance' }).click();
  await c.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(c.getByText('Balance recorded in the non-settling prototype ledger.')).toBeVisible();
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
  await page.locator('form').filter({ has: page.getByLabel('Service title', { exact: true }) })
    .getByLabel('Listing status', { exact: true }).first().selectOption('ACTIVE');
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
  browser,
}) => {
  await login(page, 'admin');
  await page.screenshot({ path: 'artifacts/admin-desktop.png', fullPage: true });
  await page.goto('/admin/users?q=Marco%20Dela%20Cruz');
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Suspended', { exact: true })).toBeVisible();
  await page.goto('/admin/providers/provider-0');
  await expect(page.getByRole('heading', { name: 'Account and profile' })).toBeVisible();
  await expect(page.getByText('Suspended', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Booking history \(/ })).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await noOverflow(page);
    await page.screenshot({ path: `artifacts/admin-provider-detail-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const customerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const customerPage = await customerContext.newPage();
  await login(customerPage, 'customer');
  await customerPage.goto('/admin/providers/provider-0');
  await expect(customerPage).toHaveURL(/\/forbidden$/);
  await customerContext.close();
  const providerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const providerPage = await providerContext.newPage();
  await login(providerPage, 'provider2');
  await providerPage.goto('/admin/providers/provider-0');
  await expect(providerPage).toHaveURL(/\/forbidden$/);
  await providerContext.close();
  const anonymousContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto('/admin/providers/provider-0');
  await expect(anonymousPage).toHaveURL(/\/login$/);
  await anonymousContext.close();
  const publicProfile = await page.request.get('/providers/provider-0');
  expect((await publicProfile.text())).not.toContain('Luna Lens Photography');
  await page.goto('/browse');
  await expect(page.getByRole('heading', { name: 'Find your kind of wonderful.' })).toBeVisible();
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
  await page.getByLabel('Service Fee (%)', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Save platform settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByText('Platform rules saved. New quotes use the updated fee.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Service Fee (%)', { exact: true })).toHaveValue('6');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/escrow');
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/admin-mobile.png', fullPage: true });
});

test('anonymous account appeal submits with a generic confirmation and appears in admin review', async ({ browser }) => {
  const requester = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  const email = `appeal-${Date.now()}@example.test`;
  await requester.goto('/support/appeal');
  await requester.getByLabel('Account email', { exact: true }).fill(email);
  await requester.getByLabel('Account type', { exact: true }).selectOption('PROVIDER');
  await requester.getByLabel('What do you need help with?', { exact: true }).selectOption('SUSPENSION_REVIEW');
  await requester.getByLabel('Message', { exact: true }).fill('Please review my account status. I can provide more information if required.');
  await requester.getByRole('button', { name: 'Submit request' }).click();
  await expect(requester.getByText(/Your request has been recorded/)).toBeVisible();
  await requester.close();

  const admin = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(admin, 'admin');
  await admin.goto('/admin/support');
  await expect(admin.getByText(new RegExp(email))).toBeVisible();
  await expect(admin.getByText(/not emailed/)).toBeVisible();
  const appealPanel = admin.locator('.panel').filter({ hasText: email });
  await appealPanel.getByLabel('Internal follow-up notes').fill('Review requested through the public account form.');
  await appealPanel.getByRole('button', { name: 'Save review' }).click();
  await expect(admin.getByText(/account access was not changed/)).toBeVisible();
  await admin.close();
});

test('light and dark themes respect system preference, persist, meet text contrast, and fit mobile', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('soiree-source-theme'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/theme-system-dark.png', fullPage: true });
  await page.goto('/browse');

  const contrast = async (selector: string) => page.locator(selector).evaluate((element) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
    const linear = (value: number) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (value: string) => {
      const [red, green, blue] = rgb(value).map(linear);
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };
    const style = getComputedStyle(element);
    const background = style.backgroundColor === 'rgba(0, 0, 0, 0)'
      ? getComputedStyle(document.body).backgroundColor : style.backgroundColor;
    const values = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
    return (values[0]! + 0.05) / (values[1]! + 0.05);
  });
  expect(await contrast('body')).toBeGreaterThanOrEqual(4.5);
  expect(await contrast('.service-card:first-of-type')).toBeGreaterThanOrEqual(4.5);

  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('soiree-source-theme'))).toBe('light');
  expect(await contrast('body')).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'artifacts/theme-light.png', fullPage: true });
  await page.goto('/browse');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await contrast('body')).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'artifacts/theme-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/theme-dark-mobile.png', fullPage: true });
});

test('provider cancellation inside the provisional date window waits for admin review', async ({ browser }) => {
  const customer = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(customer, 'customer');
  await customer.goto('/services/service-1-0');
  await customer.getByLabel('Event date', { exact: true }).fill(day(1));
  await customer.getByLabel('Venue / location').fill('A celebration venue, Quezon City');
  await customer.getByRole('button', { name: 'Request your date' }).click();
  await expect(customer).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
  const bookingPath = new URL(customer.url()).pathname;

  const provider = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(provider, 'provider2');
  await provider.goto(bookingPath);
  await expect(provider.getByText(/provisional 48-hour cancellation review window/)).toBeVisible();
  await provider.getByLabel('Primary cancellation reason').selectOption('EMERGENCY');
  await provider.getByRole('button', { name: 'Request urgent cancellation review' }).click();
  await provider.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(provider.getByText(/booking remains active until an administrator reviews it/i)).toBeVisible();
  await customer.reload();
  await expect(customer.getByText('Pending', { exact: true }).first()).toBeVisible();

  const admin = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(admin, 'admin');
  await admin.goto('/admin/support');
  await expect(admin.getByRole('heading', { name: 'Provider requests within the event window' })).toBeVisible();
  await expect(admin.getByText(/Personal emergency/)).toBeVisible();
  await admin.setViewportSize({ width: 390, height: 844 });
  await noOverflow(admin);
  await admin.screenshot({ path: 'artifacts/cancellation-review-mobile.png', fullPage: true });
  await admin.getByLabel('Request decision').selectOption('APPROVED');
  await admin.getByRole('button', { name: 'Record review decision' }).click();
  await expect(admin.getByText('Cancellation request approved.', { exact: true })).toBeVisible();
  await customer.reload();
  await expect(customer.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  await admin.close();
  await provider.close();
  await customer.close();
});

test('customer loyalty check-in updates once and displays nonredeemable XP', async ({ page }) => {
  await login(page, 'customer');
  await page.goto('/profile');
  const experience = page.locator('.experience-panel');
  await expect(experience).toBeVisible();
  const startingXp = Number((await experience.locator('strong').textContent())?.match(/\d+/)?.[0] || 0);
  await experience.getByRole('button', { name: 'Check in today · +5 XP' }).click();
  await expect(experience.getByText('Check-in complete. Five experience points added.')).toBeVisible();
  await expect(experience.locator('strong')).toHaveText(`${startingXp + 5} XP`);
  await experience.getByRole('button', { name: 'Check in today · +5 XP' }).click();
  await expect(experience.getByText('You already checked in for this Philippine calendar day.')).toBeVisible();
  await page.reload();
  await expect(experience.locator('strong')).toHaveText(`${startingXp + 5} XP`);
  await expect(experience).toContainText('Points cannot be withdrawn or spent.');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/loyalty-checkin-mobile.png', fullPage: true });
});
