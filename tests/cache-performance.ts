// One fresh production server per route: independent cold caches, then warm hit.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:3303';
const log = 'artifacts/perf-queries.jsonl';
const rows = [];
for (const path of [
  '/',
  '/browse',
  '/browse?date=2028-03-01',
  '/services/service-0-0',
  '/providers/provider-0',
  '/bundles',
  '/bundles/bundle-wedding',
]) {
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3303'],
    {
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_DIST_DIR: '.next-test/optimized-production',
        DB_PERF: '1',
        APP_ORIGIN: origin,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 20000);
      server.stdout.on('data', (b) => {
        if (String(b).includes('Ready')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      server.once('error', reject);
      server.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}`));
      });
    });
    for (const sample of ['cold', 'warm']) {
      const offset = existsSync(log) ? readFileSync(log, 'utf8').length : 0;
      const start = performance.now();
      const response = await fetch(origin + path);
      const headersMs = Math.round(performance.now() - start);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.ok(!/:E\{|data-dgst=|A little hiccup/.test(body), path);
      const totalMs = Math.round(performance.now() - start);
      const queries: { elapsedMs: number }[] = readFileSync(log, 'utf8')
        .slice(offset)
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((x) => JSON.parse(x));
      const row = {
        path,
        sample,
        queries: queries.length,
        dbMs: Math.round(queries.reduce((n, q) => n + q.elapsedMs, 0)),
        headersMs,
        totalMs,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
      writeFileSync('artifacts/perf-isolated-prod.json', JSON.stringify(rows, null, 2));
      if (sample === 'warm')
        assert.equal(
          queries.length,
          path.startsWith('/providers/') || path.includes('?date=') ? 1 : 0,
          'Only live availability may query on warm public reads',
        );
    }
  } finally {
    server.kill();
    await exited;
  }
}
