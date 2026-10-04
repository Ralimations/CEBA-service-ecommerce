import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    actionTimeout: 15000,
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(localChrome) ? localChrome : undefined),
    },
  },
  webServer: {
    command: 'npm run test:serve',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
