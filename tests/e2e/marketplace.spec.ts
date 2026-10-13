import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
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
  const bookingPath = new URL(c.url()).pathname;
  await expect(c.getByText('Waiting for 2 provider acceptance(s).')).toBeVisible();
  await expect(c.getByRole('link', { name: 'Luna Lens Photography', exact: true })).toBeVisible();
  await expect(c.getByRole('link', { name: 'Velvet Glow Makeup', exact: true })).toBeVisible();
  const customerThreads = c.locator('.booking-messages');
  await expect(customerThreads).toHaveCount(2);
  const conversationIds = await customerThreads.evaluateAll((threads) =>
    threads.map((thread) => (thread as HTMLElement).dataset.itemId!),
  );
  const bundleMessages = [
    'Can we confirm the photography arrival time?',
    'Could you share the makeup preparation schedule?',
  ];
  for (const [index, message] of bundleMessages.entries()) {
    const thread = c.locator(`.booking-messages[data-item-id="${conversationIds[index]}"]`);
    await thread.getByLabel('Write a booking message').fill(message);
    await thread.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(thread.getByText(message)).toBeVisible();
  }
  const injectionText = '<img src=x onerror=alert(1)>';
  const injectionThread = c.locator(`.booking-messages[data-item-id="${conversationIds[0]}"]`);
  await injectionThread.getByLabel('Write a booking message').fill(injectionText);
  await injectionThread.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(injectionThread.locator('.message-body').getByText(injectionText)).toBeVisible();
  await expect(injectionThread.locator('.message-body img')).toHaveCount(0);
  const oversized = await c.request.post('/api/messages', {
    data: { itemId: conversationIds[0], body: 'x'.repeat(4001) },
    headers: { Origin: 'http://127.0.0.1:3100' },
  });
  expect(oversized.status()).toBe(400);
  await c.setViewportSize({ width: 390, height: 844 });
  await noOverflow(c);
  await c.screenshot({ path: 'artifacts/bundle-messages-mobile.png', fullPage: true });
  for (const [index, role] of ['provider', 'provider5'].entries()) {
    const providerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    const provider = await providerContext.newPage();
    await login(provider, role);
    await provider.goto(bookingPath);
    const providerThreads = provider.locator('.booking-messages');
    await expect(providerThreads).toHaveCount(1);
    await expect(provider.locator(`.booking-messages[data-item-id="${conversationIds[index]}"]`)
      .getByText(bundleMessages[index])).toBeVisible();
    await expect(provider.locator('.booking-messages').getByText(bundleMessages[1 - index]))
      .toHaveCount(0);
    const reply = `Supplier ${index + 1} has received the event notes.`;
    const providerThread = provider.locator(`.booking-messages[data-item-id="${conversationIds[index]}"]`);
    await providerThread.getByLabel('Write a booking message').fill(reply);
    await providerThread.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(providerThread.getByText(reply)).toBeVisible();
    await c.reload();
    await expect(c.locator(`.booking-messages[data-item-id="${conversationIds[index]}"]`).getByText(reply))
      .toBeVisible();
    await providerContext.close();
  }
  const otherCustomerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const otherCustomer = await otherCustomerContext.newPage();
  await login(otherCustomer, 'customer');
  for (const itemId of conversationIds) {
    const denied = await otherCustomer.request.get(`/api/messages?itemId=${encodeURIComponent(itemId)}`);
    expect(denied.status()).toBe(404);
  }
  await otherCustomerContext.close();
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
  await expect(page.getByRole('heading', { name: /Make it a moment/ })).toBeVisible();
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
  for (const [width, height, name] of [
    [1440, 1000, 'home-desktop'], [1024, 900, 'home-1024'], [768, 1024, 'home-tablet'],
    [430, 932, 'home-430'], [390, 844, 'home-mobile'], [360, 800, 'home-360'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
  }
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
  await page.screenshot({ path: 'artifacts/browse-filtered-light-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/browse-filtered-light.png', fullPage: true });
  await page.locator('.service-card').first().getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Make it a date.' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/service-detail-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/service-detail-light-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/providers/provider-0');
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/provider-detail-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/provider-detail-light-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/bundles');
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/bundles-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/bundles-light-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/login-light.png', fullPage: true });
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'A little help goes a long way.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/support-light.png', fullPage: true });
  await page.goto('/');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.setItem('soiree-source-theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/home-dark-desktop.png', fullPage: true });
  await page.goto('/browse');
  await page.screenshot({ path: 'artifacts/browse-dark.png', fullPage: true });
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
  await c.screenshot({ path: 'artifacts/customer-dashboard-light.png', fullPage: true });
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
  const received = c.locator('.booking-messages').locator('.message-bubble').filter({
    hasText: 'The team will arrive during the agreed setup window.',
  });
  await received.getByText('Report message', { exact: true }).click();
  await received.getByLabel('Reason').selectOption('OTHER');
  await received.getByLabel('Details (optional)').fill('Please review this booking message.');
  await received.getByRole('button', { name: 'Send report' }).click();
  await expect(received.getByText('Report sent for administrator review.')).toBeVisible();
  const reportAdmin = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(reportAdmin, 'admin');
  await reportAdmin.goto('/admin/messages');
  await expect(reportAdmin.locator('.reported-message')).toHaveText('The team will arrive during the agreed setup window.');
  await expect(reportAdmin.getByText('Please review this booking message.')).toBeVisible();
  await expect(reportAdmin.getByText(firstMessage, { exact: true })).toHaveCount(0);
  await reportAdmin.getByLabel('Review outcome').selectOption('RESOLVED');
  await reportAdmin.getByLabel('Internal review note').fill('Reviewed the reported message in booking context.');
  await reportAdmin.getByRole('button', { name: 'Save report review' }).click();
  await expect(reportAdmin.getByText('Resolved', { exact: true })).toBeVisible();
  await reportAdmin.close();
  const unrelated = await browser.newPage({ baseURL: 'http://127.0.0.1:3100' });
  await login(unrelated, 'provider2');
  const deniedMessages = await unrelated.request.get(`/api/messages?itemId=${encodeURIComponent(itemId!)}`);
  expect(deniedMessages.status()).toBe(404);
  await unrelated.close();
  await p.getByRole('button', { name: 'Accept booking request' }).click();
  await expect(p.getByText('All providers accepted', { exact: true })).toBeVisible();
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
  for (const [width, height] of [[1440, 1000], [1024, 900], [768, 1024], [430, 932], [390, 844], [360, 800]]) {
    await page.setViewportSize({ width, height });
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

  await page.getByRole('button', { name: /Cycle color theme preference/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('soiree-source-theme'))).toBe('light');
  expect(await contrast('body')).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'artifacts/theme-light.png', fullPage: true });
  await page.goto('/browse');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: /Cycle color theme preference/ }).click();
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
  // Successful review refreshes the pending queue, unmounting the inline form
  // before its local success message can persist. Verify durable state instead.
  await expect(admin.getByText('No urgent cancellation requests.', { exact: true })).toBeVisible();
  await customer.reload();
  await expect(customer.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  await admin.goto('/admin/audit');
  await expect(admin.getByText('Provider cancellation request approved', { exact: true }).first()).toBeVisible();
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

test('feature flags respect enabled and disabled server configuration @release-flags', async ({ page }) => {
  const enabled = (name: string) => process.env[name] === 'true';
  const messaging = enabled('FEATURE_BOOKING_MESSAGING');
  const loyalty = enabled('FEATURE_LOYALTY_BETA');
  const deposits = enabled('FEATURE_SIMULATED_DEPOSITS');
  const cancellationPolicy = enabled('FEATURE_PROVIDER_CANCELLATION_POLICY');
  const requestDate = cancellationPolicy ? day(1) : day(300);

  await login(page, 'customer');
  await page.goto('/profile');
  await expect(page.locator('.experience-panel')).toHaveCount(loyalty ? 1 : 0);
  await page.goto('/bookings/demo-accepted');
  await expect(page.locator('.booking-messages')).toHaveCount(messaging ? 1 : 0);

  const origin = 'http://127.0.0.1:3100';
  const messageResponse = await page.request.post('/api/messages', {
    headers: { Origin: origin },
    data: { itemId: '00000000-0000-0000-0000-000000000000', body: 'Flag check only.' },
  });
  expect(messageResponse.status()).toBe(404);
  const messageError = await messageResponse.text();
  expect(messageError).toContain(messaging ? 'not found' : 'not enabled');

  if (!deposits) {
    const response = await page.request.post('/api/actions', {
      headers: { Origin: origin },
      data: { action: 'booking.deposit-prototype', data: { bookingId: 'demo-accepted', stage: 'DEPOSIT' } },
    });
    expect(await response.text()).toContain('prototype is disabled');
  }
  if (!loyalty) {
    const response = await page.request.post('/api/actions', {
      headers: { Origin: origin },
      data: { action: 'loyalty.checkin', data: {} },
    });
    expect(await response.text()).toContain('loyalty beta is not enabled');
  }

  const customer = page;
  await customer.goto('/services/service-1-0');
  await customer.getByLabel('Event date', { exact: true }).fill(requestDate);
  await customer.getByLabel('Venue / location').fill('A celebration venue, Quezon City');
  await customer.getByRole('button', { name: 'Request your date' }).click();
  await expect(customer).toHaveURL(/\/(?:bookings|checkout)\/[a-f0-9-]+$/);
  const bookingId = new URL(customer.url()).pathname.split('/').at(-1)!;
  const bookingPath = `/bookings/${bookingId}`;
  const providerContext = await page.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const provider = await providerContext.newPage();
  await login(provider, 'provider2');
  await provider.goto(bookingPath);
  await provider.getByRole('button', { name: 'Accept booking request' }).click();
  await expect(provider.getByText('All providers accepted', { exact: true })).toBeVisible();
  await customer.reload();
  await customer.goto(`/checkout/${bookingId}`);
  await expect(customer.locator('.deposit-prototype')).toHaveCount(deposits ? 1 : 0);
  const policyMessage = /provisional 48-hour cancellation review window/i;
  if (cancellationPolicy && requestDate === day(1)) await expect(provider.getByText(policyMessage)).toBeVisible();
  else await expect(provider.getByText(policyMessage)).toHaveCount(0);
  await providerContext.close();
});

test('axe WCAG 2.2 AA audit across major routes and themes', async ({ browser }) => {
  test.setTimeout(300_000);
  const publicRoutes = [
    '/', '/browse', '/services/service-0-0', '/providers/provider-0', '/bundles',
    '/login', '/register', '/support',
  ];
  const roleRoutes: Record<string, string[]> = {
    customer: ['/dashboard', '/bookings', '/bookings/demo-accepted', '/checkout/demo-accepted', '/profile', '/vouchers', '/notifications'],
    provider: ['/provider', '/provider/services', '/provider/packages', '/provider/calendar', '/provider/bookings', '/provider/promotions', '/bookings/demo-request'],
    admin: ['/admin', '/admin/users', '/admin/providers', '/admin/services', '/admin/categories', '/admin/bookings', '/admin/bundles', '/admin/vouchers', '/admin/subscriptions', '/admin/placements', '/admin/badges', '/admin/disputes', '/admin/escrow', '/admin/support', '/admin/messages', '/admin/settings', '/admin/audit'],
  };
  const violations: {
    theme: string; route: string; id: string; impact: string | null; help: string;
    nodes: { target: unknown; html: string; failureSummary: string | undefined; checks: unknown[] }[];
  }[] = [];
  const auditRoute = async (page: Page, route: string, theme: string) => {
    const response = await page.goto(route);
    expect(response?.status(), `${theme} ${route} response`).toBeLessThan(400);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    for (const item of result.violations) violations.push({
      theme, route, id: item.id, impact: item.impact ?? null, help: item.help,
      nodes: item.nodes.map(node => ({
        target: node.target, html: node.html, failureSummary: node.failureSummary,
        checks: node.any.map(check => ({ message: check.message, data: check.data })),
      })),
    });
    if (theme === 'dark' && ['/', '/services/service-0-0', '/dashboard', '/provider', '/admin'].includes(route)) {
      const name = route === '/' ? 'dark-home' : `dark-${route.slice(1).replaceAll('/', '-')}`;
      await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
    }
    for (const [width, height] of [[1440, 1000], [1024, 900], [768, 1024], [430, 932], [390, 844], [360, 800]]) {
      await page.setViewportSize({ width, height });
      await noOverflow(page);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  };

  for (const theme of ['light', 'dark']) {
    const publicContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    await publicContext.addInitScript(value => localStorage.setItem('soiree-source-theme', value), theme);
    const publicPage = await publicContext.newPage();
    for (const route of publicRoutes) await auditRoute(publicPage, route, theme);
    await publicContext.close();

    for (const [role, routes] of Object.entries(roleRoutes)) {
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
      await context.addInitScript(value => localStorage.setItem('soiree-source-theme', value), theme);
      const page = await context.newPage();
      await login(page, role === 'provider' ? 'provider2' : role);
      for (const route of routes) await auditRoute(page, route, theme);
      await context.close();
    }
  }

  writeFileSync('artifacts/axe-wcag22aa.json', JSON.stringify({
    completedAt: new Date().toISOString(), routeCount: publicRoutes.length + Object.values(roleRoutes).flat().length,
    themes: ['light', 'dark'], violations,
  }, null, 2));
  expect(violations.length, `Found ${violations.length} axe WCAG 2.2 AA violations; see artifacts/axe-wcag22aa.json.`).toBe(0);
});

test('clean development browser records hydration and injected caret styles', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  await context.addInitScript(() => {
    const target = window as typeof window & { __caretAudit?: unknown[] };
    target.__caretAudit = [];
    const record = (entry: unknown) => target.__caretAudit?.push(entry);
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (name.toLowerCase() === 'style' && /caret-color/i.test(value))
        record({ kind: 'setAttribute', value, stack: new Error().stack });
      return setAttribute.call(this, name, value);
    };
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function(name: string, value: string, priority?: string) {
      if (name.toLowerCase() === 'caret-color' || /caret-color/i.test(value))
        record({ kind: 'setProperty', name, value, stack: new Error().stack });
      return setProperty.call(this, name, value, priority);
    };
    new MutationObserver(changes => {
      for (const change of changes) {
        const element = change.target as HTMLElement;
        if (element instanceof HTMLInputElement && /caret-color/i.test(element.getAttribute('style') || ''))
          record({ kind: 'mutation', value: element.getAttribute('style'), stack: new Error().stack });
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['style'] });
  });
  const page = await context.newPage();
  const errors: { route: string; type: string; message: string }[] = [];
  let route = '';
  page.on('console', message => {
    if (/hydration|caret-color/i.test(message.text()))
      errors.push({ route, type: message.type(), message: message.text().slice(0, 1400) });
  });
  page.on('pageerror', error => errors.push({ route, type: 'pageerror', message: error.message }));
  const routes = [];
  for (route of ['/', '/browse', '/login']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBeLessThan(400);
    const html = await response!.text();
    await page.waitForTimeout(250);
    routes.push({
      route,
      serverCaretStyles: [...html.matchAll(/<input\b[^>]*style="[^"]*caret-color[^\"]*"[^>]*>/gi)].map(match => match[0]),
      clientInputs: await page.locator('input').evaluateAll(inputs => inputs.map(input => ({
        name: input.getAttribute('name'), style: input.getAttribute('style'), caretColor: getComputedStyle(input).caretColor,
      }))),
      mutations: await page.evaluate(() => (window as typeof window & { __caretAudit?: unknown[] }).__caretAudit || []),
    });
  }
  writeFileSync('artifacts/rc1-development-hydration.json', JSON.stringify({
    completedAt: new Date().toISOString(), browserVersion: await browser.version(), cleanContext: true,
    extensionsDisabled: true, routes, errors,
  }, null, 2));
  await context.close();
});
