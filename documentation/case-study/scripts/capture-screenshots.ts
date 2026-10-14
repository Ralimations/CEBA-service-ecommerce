import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = process.env.CASE_STUDY_ORIGIN || 'http://127.0.0.1:3000';
const password = process.env.CASE_STUDY_DEMO_PASSWORD || 'DemoPass!2026';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.locator('main').filter({ visible: true }).first().waitFor({ state: 'visible' });
}

async function capture(page: Page, path: string) {
  await settle(page);
  await page.screenshot({
    path: resolve(outputDirectory, path),
    type: 'jpeg',
    quality: 88,
    fullPage: false,
  });
}

async function signIn(browser: Browser, email: string, expectedPath: RegExp) {
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Welcome back', exact: true }).click();
  await page.waitForURL(expectedPath, { timeout: 30_000 });
  return { context, page };
}

async function close(contexts: BrowserContext[], browser: Browser) {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(localChrome) ? localChrome : undefined),
});
const contexts: BrowserContext[] = [];

try {
  const publicContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  contexts.push(publicContext);
  const publicPage = await publicContext.newPage();

  await publicPage.goto('/');
  await expect(publicPage.getByRole('heading', { name: /Big moments/ })).toBeVisible();
  await capture(publicPage, '01-homepage.jpg');

  await publicPage.goto('/services/service-0-0');
  await expect(publicPage.getByRole('heading', { name: 'Make it a date.' })).toBeVisible();
  await capture(publicPage, '02-service-detail.jpg');

  const customer = await signIn(browser, 'customer@demo.local', /\/dashboard$/);
  contexts.push(customer.context);
  await capture(customer.page, '03-customer-dashboard.jpg');

  const provider = await signIn(browser, 'provider@demo.local', /\/provider$/);
  contexts.push(provider.context);
  await capture(provider.page, '04-provider-dashboard.jpg');

  const administrator = await signIn(browser, 'admin@demo.local', /\/admin$/);
  contexts.push(administrator.context);
  await capture(administrator.page, '05-admin-dashboard.jpg');

  console.log(`Captured 5 case-study screenshots in ${outputDirectory}`);
} finally {
  await close(contexts, browser);
}
