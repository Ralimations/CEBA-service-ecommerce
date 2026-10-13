import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not select a production probe port.');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function runPerformance(origin: string) {
  const result = await new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/performance.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, TEST_ORIGIN: origin, PERF_PHASE: 'rc1', DB_PERF: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); process.stdout.write(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('exit', code => resolve({ code: code ?? 1, output }));
  });
  assert.equal(result.code, 0, `Production performance sampling failed with exit code ${result.code}.`);
  const rows = result.output.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.ok(rows.length > 0, 'Production performance probe emitted no route measurements.');
  assert.ok(rows.every(row => typeof row.totalMs === 'number' && typeof row.queries === 'number'), 'Performance probe output was incomplete.');
}

mkdirSync('artifacts', { recursive: true });

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  APP_ORIGIN: origin,
  DB_PERF: '1',
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-test',
  FEATURE_BOOKING_MESSAGING: 'true',
  FEATURE_PROVIDER_CANCELLATION_POLICY: 'true',
  FEATURE_LOYALTY_BETA: 'true',
  FEATURE_LOYALTY_MONETARY_REWARDS: 'false',
  FEATURE_SIMULATED_DEPOSITS: 'true',
};
const server = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port),
], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); process.stdout.write(chunk); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); process.stderr.write(chunk); });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production server exited before readiness. ${serverOutput}`);
    try {
      const response = await fetch(origin);
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for local Next.js startup. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Production server did not become ready. ${serverOutput}`);

  const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(localChrome) ? localChrome : undefined),
    args: ['--disable-extensions'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const initScript = `
    const target = window;
    target.__caretAudit = [];
    target.__layoutShifts = 0;
    const record = (entry) => target.__caretAudit?.push(entry);
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (name.toLowerCase() === 'style' && /caret-color/i.test(value))
        record({ kind: 'setAttribute', value, stack: new Error().stack });
      return setAttribute.call(this, name, value);
    };
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function(name, value, priority) {
      if (name.toLowerCase() === 'caret-color' || /caret-color/i.test(value))
        record({ kind: 'setProperty', name, value, stack: new Error().stack });
      return setProperty.call(this, name, value, priority);
    };
    new MutationObserver(changes => {
      for (const change of changes) {
        const element = change.target;
        if (element instanceof HTMLInputElement && /caret-color/i.test(element.getAttribute('style') || ''))
          record({ kind: 'mutation', value: element.getAttribute('style'), stack: new Error().stack });
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['style'] });
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput)
            target.__layoutShifts = (target.__layoutShifts || 0) + entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* Unsupported in older local browsers. */ }
  `;
  new Function(initScript);
  await context.addInitScript({ content: initScript });
  const page = await context.newPage();
  const consoleErrors: { route: string; type: string; message: string }[] = [];
  const pageErrors: { route: string; message: string }[] = [];
  let activeRoute = '';
  page.on('console', message => {
    if (message.type() === 'error' || /hydration|caret-color/i.test(message.text()))
      consoleErrors.push({ route: activeRoute, type: message.type(), message: message.text().slice(0, 1400) });
  });
  page.on('pageerror', error => pageErrors.push({ route: activeRoute, message: error.message }));

  const hydration: Record<string, unknown>[] = [];
  for (const route of ['/', '/browse', '/login']) {
    activeRoute = route;
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    assert.ok(response && response.status() < 400, `Production route failed: ${route}`);
    const serverHtml = await response!.text();
    await page.waitForTimeout(150);
    const { clientInputs, ...browserEvidence } = await page.evaluate(`(() => ({
      clientInputs: [...document.querySelectorAll('input')].map(input => ({
        name: input.getAttribute('name'),
        serverStyle: input.getAttribute('style'),
        computedCaretColor: getComputedStyle(input).caretColor,
        html: input.outerHTML,
      })),
      mutations: window.__caretAudit || [],
      layoutShift: window.__layoutShifts || 0,
      navigation: performance.getEntriesByType('navigation').map(entry => ({
        responseStart: Math.round(entry.responseStart),
        domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
        load: Math.round(entry.loadEventEnd),
      })),
      javascriptTransferBytes: performance.getEntriesByType('resource')
        .filter(entry => entry.name.endsWith('.js') || entry.name.includes('.js?'))
        .reduce((total, entry) => total + (entry.transferSize || 0), 0),
      images: [...document.images].map(image => ({ src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 })),
    }))()`) as { clientInputs: { serverStyle: string | null }[]; [key: string]: unknown };
    assert.ok(Array.isArray(clientInputs), `Production input probe returned no input list for ${route}.`);
    const serverCaretStyles = [...serverHtml.matchAll(/<input\b[^>]*style="[^"]*caret-color[^\"]*"[^>]*>/gi)].map(match => match[0]);
    assert.equal(serverCaretStyles.length, 0, `Production server HTML contains caret styles on ${route}.`);
    assert.equal(clientInputs.some(input => /caret-color/i.test(input.serverStyle || '')), false, `Production inputs contain inline caret styles on ${route}.`);
    assert.equal((browserEvidence.mutations as unknown[]).length, 0, `Production browser observed style mutations on ${route}.`);
    assert.equal(browserEvidence.layoutShift, 0, `Production browser observed layout shift on ${route}.`);
    hydration.push({
      route,
      serverCaretStyles,
      clientInputs,
      ...browserEvidence,
    });
    if (route === '/') await page.screenshot({ path: 'artifacts/rc1-production-home.png', fullPage: true });
  }
  writeFileSync('artifacts/rc1-production-browser.json', JSON.stringify({
    completedAt: new Date().toISOString(), browser: await browser.version(),
    extensionDisabled: true, hydration, consoleErrors, pageErrors,
  }, null, 2));
  assert.equal(consoleErrors.length, 0, `Production console errors: ${JSON.stringify(consoleErrors)}`);
  assert.equal(pageErrors.length, 0, `Production client errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
  await browser.close();
  browser = undefined;

  await runPerformance(origin);
  console.log('Production browser probe and performance sampling completed. See artifacts/rc1-production-browser.json and artifacts/perf-rc1.json.');
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([
      new Promise<void>(resolve => server.once('exit', () => resolve())),
      new Promise<void>(resolve => setTimeout(resolve, 5000)),
    ]);
    if (server.exitCode === null) server.kill();
  }
}
