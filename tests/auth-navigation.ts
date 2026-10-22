import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

// Production-mode regression: no production database, accounts, or mutations.
const origin = 'http://127.0.0.1:3117';
const env = {
  ...process.env,
  POSTGRES_URL: 'postgres://offline:offline@127.0.0.1:1/offline',
  DATABASE_TARGET: 'local',
  APP_ORIGIN: origin,
  NEXT_DIST_DIR: '.next',
};
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3117'], {
  env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += String(chunk); });
server.stderr.on('data', chunk => { serverOutput += String(chunk); });
const checks: { name: string; ms: number }[] = [];
mkdirSync('artifacts/auth-navigation', { recursive: true });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Production test server exited before readiness.');
    try {
      const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) { await response.text(); break; }
    } catch { /* Wait only for the isolated server to become ready. */ }
    if (attempt === 59) throw new Error('Production test server did not become ready.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(chrome) ? chrome : undefined) });
  const page = await browser.newPage();
  const documents: string[] = [];
  let categoryRequests = 0;
  page.on('request', request => {
    if (request.isNavigationRequest()) documents.push(new URL(request.url()).pathname);
    if (new URL(request.url()).pathname === '/api/auth/categories') categoryRequests++;
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['/login', '/register'].includes(url.pathname) && route.request().headers().rsc === '1')
      return route.abort();
    return route.continue();
  });
  const check = async (name: string, run: () => Promise<void>) => {
    const start = Date.now(); await run(); checks.push({ name, ms: Date.now() - start });
  };
  await check('landing to login uses a fresh document despite blocked auth prefetch and offline database', async () => {
    await page.goto(origin, { waitUntil: 'commit' });
    await page.getByRole('link', { name: 'Log in', exact: true }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible({ timeout: 5000 });
    expect(documents).toContain('/login');
    expect(categoryRequests).toBe(0);
  });
  await check('customer signup renders without any category request', async () => {
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    await expect(page.getByLabel('Full name', { exact: true })).toBeVisible({ timeout: 5000 });
    expect(documents).toContain('/register');
    expect(categoryRequests).toBe(0);
    await expect(page.getByRole('button', { name: 'Create your account', exact: true })).toBeEnabled();
  });
  await page.route('**/api/auth/categories', route => route.fulfill({ status: 503, json: { error: 'Test outage' } }));
  await check('provider category failure is visible and customer mode remains usable', async () => {
    await page.getByRole('button', { name: 'I offer a service' }).click();
    await expect(page.locator('.auth-form').getByRole('alert')).toContainText('Service categories could not load');
    await expect(page.getByRole('button', { name: 'Create your account', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'I’m planning an event' }).click();
    await expect(page.getByRole('button', { name: 'Create your account', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'I offer a service' }).click();
  });
  await page.unroute('**/api/auth/categories');
  await page.route('**/api/auth/categories', route => route.fulfill({ json: { categories: [{ id: 'photography', name: 'Photography' }] } }));
  await check('provider retries categories successfully', async () => {
    await page.getByRole('button', { name: 'Retry categories' }).click();
    await expect(page.getByLabel('Primary service', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Primary service', { exact: true })).toHaveValue('photography');
    await expect(page.getByRole('button', { name: 'Create your account', exact: true })).toBeEnabled();
  });
  await page.screenshot({ path: 'artifacts/auth-navigation/provider-recovered.png', fullPage: true });
  await check('mobile landing Get started opens a fresh signup document', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin, { waitUntil: 'commit' });
    await page.getByRole('link', { name: 'Get started', exact: true }).click();
    await expect(page.getByLabel('Full name', { exact: true })).toBeVisible({ timeout: 5000 });
    expect(documents.at(-1)).toBe('/register');
  });
  await page.unroute('**/api/auth/categories');
  await page.route('**/api/auth/categories', async route => {
    await new Promise(resolve => setTimeout(resolve, 10000));
    await route.fulfill({ json: { categories: [] } }).catch(() => {});
  });
  await check('slow provider category lookup times out with retry instead of blocking the page', async () => {
    await page.getByRole('button', { name: 'I offer a service' }).click();
    await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
    await expect(page.locator('.auth-form').getByRole('alert')).toContainText('Service categories could not load', { timeout: 11000 });
    await expect(page.getByRole('button', { name: 'Retry categories' })).toBeVisible();
  });
  console.log(JSON.stringify({ passed: checks.length, checks, documents, categoryRequests }, null, 2));
  writeFileSync('artifacts/auth-navigation/result.json', JSON.stringify({ checks, documents, categoryRequests }, null, 2));
} finally {
  await browser?.close();
  server.kill();
  writeFileSync('artifacts/auth-navigation/server.log', serverOutput);
}
