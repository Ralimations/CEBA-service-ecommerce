import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3302';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: existsSync(chrome) ? chrome : undefined });
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + '/browse', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Find your kind of wonderful.' })).toBeVisible();
    await expect(page.locator('header .brand')).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    );
    if (viewport.width < 500) await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Curated bundles' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'A whole team. One lovely plan.' }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Find your kind of wonderful.' })).toBeVisible();
    await page.screenshot({ path: `artifacts/navigation-${viewport.width}.png` });
    await page.goto(origin + '/register', { waitUntil: 'networkidle' });
    await expect(page.locator('[name="termsAccepted"]')).toHaveAttribute('required', '');
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${viewport.width}px header, client navigation/back, registration form; no hydration errors`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
