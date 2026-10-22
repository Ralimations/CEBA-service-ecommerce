import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { faqs } from '@/lib/faq';
import { DEMO_PASSWORD } from '@/database/seed';

const origin = 'http://127.0.0.1:3100';
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(`${role}@demo.local`);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Welcome back', exact: true }).click();
  await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/dashboard$/);
}

test('demo QA: customer profile persists, empty discovery recovers, logout protects account', async ({ page }) => {
  await login(page, 'customer2');
  await page.goto('/profile');
  await page.getByLabel('Full name', { exact: true }).fill('Demo QA Customer');
  await page.getByLabel('Phone', { exact: true }).fill('09171234567');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Demo QA Customer');
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('09171234567');
  await page.goto('/browse?q=zxqvnonexistentservice');
  await expect(page.locator('.service-card')).toHaveCount(0);
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.service-card').first()).toBeVisible();
  await page.getByLabel('Sort by', { exact: true }).selectOption('price-low');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/sort=price-low/);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).not.toHaveURL(/\/profile$/);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});

test('demo QA: every FAQ answers its own canonical question', async ({ page }) => {
  await page.goto('/support');
  const chat = page.locator('.faq-chat');
  for (const faq of faqs) {
    await chat.getByLabel('Ask a question').fill(faq.question);
    await chat.getByRole('button', { name: 'Send question' }).click();
    await expect.soft(chat.getByRole('status'), faq.question).toHaveText(faq.answer, { timeout: 1000 });
  }
});

test('demo QA: FAQ intent accuracy, unknown fallback and mobile handoff', async ({ page }) => {
  await page.goto('/support');
  const chat = page.locator('.faq-chat');
  const observations = [];
  for (const [question, expected] of [
    ['Can I cancel my booking?', 'Before payment'],
    ['How do I pay for my booking?', 'No real money'],
    ['How do I reset my password?', 'support team'],
    ['I forgot my password', 'support team'],
    ['What is my booking status?', 'support team'],
    ['Paano mag-book ng photographer?', 'Choose a service'],
    ['zxqv unrelated question', 'support team'],
  ]) {
    await chat.getByLabel('Ask a question').fill(question);
    await chat.getByRole('button', { name: 'Send question' }).click();
    observations.push({ question, expected, actual: await chat.getByRole('status').innerText() });
    await expect.soft(chat.getByRole('status'), question).toContainText(expected, { timeout: 1000 });
  }
  mkdirSync('artifacts/demo-qa', { recursive: true });
  writeFileSync('artifacts/demo-qa/faq-observations.json', JSON.stringify(observations, null, 2));
  await page.setViewportSize({ width: 390, height: 844 });
  await chat.getByRole('link', { name: 'Ask an administrator' }).click();
  await expect(page).toHaveURL(/\/support#ticket$/);
  await expect(page.getByRole('link', { name: 'Sign in to contact support' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/demo-qa/faq-mobile.png', fullPage: true });
});

test('demo QA: customer support submission, admin reply, notifications and isolation', async ({ browser }) => {
  const customerContext = await browser.newContext({ baseURL: origin });
  const adminContext = await browser.newContext({ baseURL: origin });
  const otherContext = await browser.newContext({ baseURL: origin });
  const c = await customerContext.newPage();
  const a = await adminContext.newPage();
  const other = await otherContext.newPage();
  const subject = `Demo QA arrival question ${Date.now()}`;
  const message = 'Please help coordinate my event arrival. <img src=x onerror=alert(1)>';
  const firstReply = 'First reply: the administrator is checking your arrival details.';
  const secondReply = 'Second reply: please confirm your preferred arrival time.';
  try {
    await login(c, 'customer2');
    await c.goto('/support');
    await c.getByLabel('Subject', { exact: true }).fill(subject);
    await c.getByLabel('How can we help?', { exact: true }).fill(message);
    await c.getByRole('button', { name: 'Send support request' }).click();
    await expect(c.getByText('Support ticket created. Responses will appear here and in your notifications.')).toBeVisible();
    const customerTicket = c.locator('section.panel').filter({ has: c.getByRole('heading', { name: subject, exact: true }) });
    await expect(customerTicket).toContainText(message);
    await expect(customerTicket.locator('img')).toHaveCount(0);
    const invalid = await c.request.post('/api/actions', {
      headers: { Origin: origin }, data: { action: 'ticket.create', data: { subject: 'a', message: 'short' } },
    });
    expect(invalid.status()).toBe(400);
    const forbidden = await c.request.post('/api/actions', {
      headers: { Origin: origin }, data: { action: 'ticket.respond', data: { id: 'not-a-ticket', status: 'CLOSED', response: 'Unauthorized reply' } },
    });
    expect(forbidden.status()).toBe(403);
    await login(a, 'admin');
    await a.goto('/notifications');
    await expect(a.getByText(subject, { exact: true })).toBeVisible();
    await a.goto('/admin/support');
    const adminTicket = a.locator('section.panel').filter({ has: a.getByRole('heading', { name: subject, exact: true }) });
    await expect(adminTicket).toContainText(message);
    await adminTicket.getByLabel('Administrator response').fill(firstReply);
    await adminTicket.getByLabel('Ticket status').selectOption('IN_PROGRESS');
    await adminTicket.getByRole('button', { name: 'Save reply & notify customer' }).click();
    await expect(adminTicket.getByText('Response sent through in-app support.')).toBeVisible();
    await c.reload();
    await expect(customerTicket).toContainText(firstReply);
    await c.goto('/notifications');
    await expect(c.getByText(subject, { exact: true })).toBeVisible();
    await c.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(c.getByText('Notifications marked as read.')).toBeVisible();
    await login(other, 'customer3');
    await other.goto('/support');
    await expect(other.getByRole('heading', { name: subject })).toHaveCount(0);
    await other.goto('/admin/support');
    await expect(other).toHaveURL(/\/forbidden$/);
    await adminTicket.getByLabel('Administrator response').fill(secondReply);
    await adminTicket.getByRole('button', { name: 'Save reply & notify customer' }).click();
    await expect(adminTicket.getByText('Response sent through in-app support.')).toBeVisible();
    await c.goto('/support');
    await expect(customerTicket).toContainText(secondReply);
    // Record current product limitations explicitly, rather than claiming threaded chat.
    await expect(customerTicket).not.toContainText(firstReply);
    await expect(customerTicket.locator('textarea')).toHaveCount(0);
    await c.setViewportSize({ width: 390, height: 844 });
    expect(await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await c.screenshot({ path: 'artifacts/demo-qa/support-mobile.png', fullPage: true });
  } finally {
    await customerContext.close();
    await adminContext.close();
    await otherContext.close();
  }
});
