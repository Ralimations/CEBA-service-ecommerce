import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { DEMO_PASSWORD } from '../database/seed';

const origin = process.env.PERF_ORIGIN || 'http://127.0.0.1:3000';
const phase = process.env.PERF_PHASE || 'baseline';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync('artifacts', { recursive: true });

async function sample(viewport: { width: number; height: number }, mobile: boolean) {
  const browser = await chromium.launch({ headless: true, executablePath: existsSync(chromePath) ? chromePath : undefined, args: ['--disable-extensions'] });
  const context = await browser.newContext({ viewport, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const cdp = await context.newCDPSession(page);
  const transfers = new Map<string, { bytes: number; type: string }>();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: false, detailed: true });
  if (mobile) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: 'cellular3g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  cdp.on('Network.responseReceived', (event) => transfers.set(event.requestId, { bytes: 0, type: event.type }));
  cdp.on('Network.loadingFinished', (event) => {
    const current = transfers.get(event.requestId);
    if (current) current.bytes = event.encodedDataLength;
  });
  await page.addInitScript(() => {
    const w = window as Window & { __vitals?: { lcp: number; cls: number; inp: number; react: unknown[] } };
    w.__vitals = { lcp: 0, cls: 0, inp: 0, react: [] };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__vitals!.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntry[]) {
          if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput)
            w.__vitals!.cls += (entry as PerformanceEntry & { value?: number }).value || 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { duration: number; interactionId?: number })[])
          if (entry.interactionId) w.__vitals!.inp = Math.max(w.__vitals!.inp, entry.duration);
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number });
    } catch { /* Metric unsupported by this local Chromium build. */ }
  });

  const dbLog = 'artifacts/perf-queries.jsonl';
  const dbOffset = existsSync(dbLog) ? readFileSync(dbLog, 'utf8').length : 0;
  const homeStarted = performance.now();
  const homeResponse = await page.goto(origin, { waitUntil: 'networkidle', timeout: 90_000 });
  assert.equal(homeResponse?.status(), 200);
  await page.waitForTimeout(500);
  const home = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((entry) => ({
      name: entry.name, transferSize: entry.transferSize || 0, duration: entry.duration,
    }));
    const vitals = (window as Window & { __vitals?: { lcp: number; cls: number; inp: number } }).__vitals;
    return {
      ttfbMs: Math.round(nav.responseStart - nav.requestStart),
      lcpMs: Math.round(vitals?.lcp || 0),
      inpMs: Math.round(vitals?.inp || 0),
      cls: Number((vitals?.cls || 0).toFixed(4)),
      jsTransferredBytes: resources.filter((entry) => /\.js(?:\?|$)/.test(entry.name)).reduce((sum, entry) => sum + entry.transferSize, 0),
      resources,
      imageEntries: resources.filter((entry) => /\.(?:webp|png|jpe?g|avif)(?:\?|$)/i.test(entry.name)),
    };
  });
  const homeWallMs = Math.round(performance.now() - homeStarted);
  const homeCoverage = await cdp.send('Profiler.takePreciseCoverage');
  const homeJsExecutedBytes = homeCoverage.result.reduce((sum: number, script: { functions: { ranges: { startOffset: number; endOffset: number; count: number }[] }[] }) => {
    const ranges = script.functions.flatMap((fn) => fn.ranges).filter((range) => range.count > 0).sort((a, b) => a.startOffset - b.startOffset);
    let end = -1;
    for (const range of ranges) { const start = Math.max(range.startOffset, end); if (range.endOffset > start) sum += range.endOffset - start; end = Math.max(end, range.endOffset); }
    return sum;
  }, 0);
  const login = await page.request.post(`${origin}/api/auth/login`, {
    headers: { Origin: origin }, data: { email: 'customer@demo.local', password: DEMO_PASSWORD },
  });
  assert.equal(login.status(), 200, await login.text());
  const cookie = (await login.headersArray()).find((header) => header.name.toLowerCase() === 'set-cookie')?.value.split(';')[0];
  assert.ok(cookie, 'Local demo login did not set its session cookie.');
  const [cookieName, ...cookieParts] = cookie.split('=');
  await context.addCookies([{ name: cookieName, value: cookieParts.join('='), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const bookingCreate = await page.request.post(`${origin}/api/actions`, {
    headers: { Origin: origin },
    data: { action: 'booking.create', data: {
      packageId: 'package-0-0-0', eventDate: '2027-02-01', eventType: 'Performance sample',
      location: 'A representative demo venue in Quezon City', guests: 30,
      contact: '09170000000', requests: 'Synthetic performance test booking.', addons: [], voucher: '',
    } },
  });
  assert.equal(bookingCreate.status(), 200, await bookingCreate.text());
  const bookingResult = await bookingCreate.json() as { redirect: string };
  const bookingResponse = await page.goto(`${origin}${bookingResult.redirect}?reactProfile=1`, { waitUntil: 'domcontentloaded' });
  assert.equal(bookingResponse?.status(), 200);
  await page.locator('.booking-messages').waitFor({ timeout: 90_000 });
  const composerReady = await page.getByLabel('Write a booking message').isVisible({ timeout: 5_000 }).catch(() => false);
  if (composerReady) {
    const composer = page.getByLabel('Write a booking message');
    await composer.pressSequentially('render profile sample', { delay: 20 });
    await page.waitForTimeout(250);
  }
  const interaction = await page.evaluate(() => ({
    profiler: (window as Window & { __reactProfileRecords?: { id: string; phase: string; actualDuration: number; baseDuration: number }[] }).__reactProfileRecords || [],
    events: performance.getEntriesByType('event').map((entry) => ({ name: entry.name, duration: (entry as PerformanceEntry & { duration: number }).duration })),
  }));
  const networkRequests = [...transfers.values()];
  const jsBytes = networkRequests.filter((request) => request.type === 'Script').reduce((sum, request) => sum + request.bytes, 0);
  const imageBytes = networkRequests.filter((request) => request.type === 'Image').reduce((sum, request) => sum + request.bytes, 0);
  const dbRows = existsSync(dbLog) ? readFileSync(dbLog, 'utf8').slice(dbOffset).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { elapsedMs: number; sql: string }) : [];
  const result = {
    phase,
    browser: await browser.version(),
    viewport,
    throttling: mobile ? { rttMs: 150, downlinkMbps: 1.6, cpuRate: 4 } : null,
    home: {
      ...home,
      resourceCount: home.resources.length,
      imageTransferBytes: home.imageEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      jsExecutedBytes: homeJsExecutedBytes,
      wallMs: homeWallMs,
      resources: undefined,
      imageEntries: home.imageEntries.map((entry) => ({ name: entry.name, transferSize: entry.transferSize || 0, duration: Math.round(entry.duration) })),
    },
    bookingMessaging: {
      composerReady,
      panelText: await page.locator('.booking-messages').innerText().catch(() => 'missing message panel'),
      profileCommits: interaction.profiler.filter((entry) => entry.id === 'booking-message-list').length,
      actualRenderMs: Number(interaction.profiler.filter((entry) => entry.id === 'booking-message-list').reduce((sum, entry) => sum + entry.actualDuration, 0).toFixed(2)),
      commits: interaction.profiler,
    },
    network: { requestCount: networkRequests.length, jsBytes, imageBytes },
    sql: { queryCount: dbRows.length, totalQueryMs: Number(dbRows.reduce((sum, row) => sum + row.elapsedMs, 0).toFixed(2)), slowest: [...dbRows].sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 5) },
  };
  await browser.close();
  return result;
}

const desktop = await sample({ width: 1440, height: 1000 }, false);
const mobile = await sample({ width: 390, height: 844 }, true);
const report = { completedAt: new Date().toISOString(), origin, evidenceType: 'synthetic local browser run', desktop, mobile };
writeFileSync(`artifacts/performance-audit-${phase}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ desktop: { home: desktop.home, messaging: desktop.bookingMessaging, network: desktop.network, sql: desktop.sql }, mobile: { home: mobile.home, messaging: mobile.bookingMessaging, network: mobile.network, sql: mobile.sql } }, null, 2));
