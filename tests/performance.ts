// Serial HTTP measurements against a dedicated DB_PERF=1 local server.
// Auth uses existing demo accounts; no fixtures, reset, or booking mutations.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3300';
const phase = process.env.PERF_PHASE || 'baseline';
const logPath = 'artifacts/perf-queries.jsonl';
type Query = { timestamp: number; elapsedMs: number; sql: string };
const rows: {
  path: string;
  role: string;
  sample: string;
  queries: number;
  dbMs: number;
  totalMs: number;
  slowest: Query[];
}[] = [];
const cookies: Record<string, string> = {};
for (const role of ['customer', 'provider', 'admin']) {
  const r = await fetch(origin + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${role}@demo.local`, password: 'DemoPass!2026' }),
  });
  assert.equal(r.status, 200, await r.text());
  cookies[role] = r.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join(';');
}
const paths: [string, string, boolean][] = [
  ['/', 'public', true],
  ['/browse', 'public', true],
  ['/browse?date=2028-03-01', 'public', false],
  ['/services/service-0-0', 'public', true],
  ['/providers/provider-0', 'public', true],
  ['/bundles', 'public', true],
  ['/bundles/bundle-wedding', 'public', true],
  ['/login', 'public', false],
  ['/dashboard', 'customer', false],
  ['/provider', 'provider', false],
  ['/admin', 'admin', false],
  ['/bookings', 'customer', false],
  ['/bookings/demo-confirmed', 'customer', false],
];
try {
  for (const [path, role, repeat] of paths) {
    for (const sample of repeat ? ['first', 'repeat'] : ['first']) {
      const offset = existsSync(logPath) ? readFileSync(logPath, 'utf8').length : 0;
      const start = performance.now();
      const r = await fetch(origin + path, {
        headers: role === 'public' ? {} : { Cookie: cookies[role] },
      });
      const body = await r.text();
      const totalMs = performance.now() - start;
      assert.equal(r.status, 200, path);
      assert.ok(
        !/A little hiccup|value.toFixed is not a function|:E\{|data-dgst=/.test(body),
        `${path} streamed an error`,
      );
      const queries: Query[] = existsSync(logPath)
        ? readFileSync(logPath, 'utf8')
            .slice(offset)
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((x) => JSON.parse(x))
        : [];
      const row = {
        path,
        role,
        sample,
        queries: queries.length,
        dbMs: Math.round(queries.reduce((n, q) => n + q.elapsedMs, 0)),
        totalMs: Math.round(totalMs),
        slowest: [...queries].sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 3),
      };
      rows.push(row);
      mkdirSync('artifacts', { recursive: true });
      writeFileSync(`artifacts/perf-${phase}.json`, JSON.stringify(rows, null, 2));
      console.log(JSON.stringify({ ...row, slowest: undefined }));
    }
  }
} finally {
  for (const Cookie of Object.values(cookies))
    await fetch(origin + '/api/auth/logout', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie },
      body: '{}',
    });
}
