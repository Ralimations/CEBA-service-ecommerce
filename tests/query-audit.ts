// Read-only plans and pool comparison; no migration or data modification.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { providerSelect } from '../server/queries';
if (!process.env.POSTGRES_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.POSTGRES_URL!;
const reserved = process.argv.includes('--reserved');
const ssl = process.argv.includes('--tls') ? ('require' as const) : undefined;
const sql = postgres(url, { prepare: false, ssl, max: 1, idle_timeout: 20, connect_timeout: 10 });
try {
  const before = execFileSync('git', ['show', '6217039:server/queries.ts'], { encoding: 'utf8' });
  console.log('Loaded baseline SQL');
  const original = before.match(/all<Provider>\(`([\s\S]*?)`\)/)![1];
  const plans: Record<string, unknown> = {};
  for (const [name, query] of Object.entries({
    originalProvider: original,
    currentProvider: providerSelect,
    packages: "SELECT MIN(price) FROM packages WHERE service_id='service-0-0' AND active=1",
    bookingItems: "SELECT * FROM booking_items WHERE booking_id='demo-confirmed'",
  })) {
    plans[name] = (await sql.unsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`))[0][
      'QUERY PLAN'
    ];
    console.log(`EXPLAIN complete: ${name}`);
  }
  const indexes = await sql.unsafe(
    "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  );
  const tls = await sql.unsafe('SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
  const pools = [];
  console.log('Index and TLS inspection complete');
  for (const max of [1, 5]) {
    const client = postgres(url, {
      prepare: false,
      ssl,
      max,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    async function read(text: string) {
      if (!reserved) return client.unsafe(text);
      const connection = await client.reserve();
      try {
        return await connection.unsafe(text);
      } finally {
        connection.release();
      }
    }
    try {
      for (let sample = 0; sample < 4; sample++) {
        const start = performance.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            Promise.all([
              read(providerSelect),
              read('SELECT * FROM settings'),
              read('SELECT * FROM categories WHERE active=1'),
            ]),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Pool sample exceeded 15 seconds')), 15000);
            }),
          ]);
        } catch {
          pools.push({ max, sample, ms: Math.round(performance.now() - start), timeout: true });
          break;
        } finally {
          clearTimeout(timer);
        }
        pools.push({ max, sample, ms: Math.round(performance.now() - start) });
        console.log(JSON.stringify(pools.at(-1)));
      }
    } finally {
      await client.end({ timeout: 5 });
    }
  }
  const result = {
    endpointHost: new URL(url).hostname,
    port: new URL(url).port,
    plans,
    indexes,
    tls,
    pools,
    reserved,
    ssl,
  };
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(
    `artifacts/query-audit${reserved ? '-reserved' : ''}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      endpointHost: result.endpointHost,
      port: result.port,
      tls,
      pools,
      plans: Object.fromEntries(
        Object.entries(plans).map(([k, v]) => [
          k,
          (v as { 'Execution Time': number }[])[0]['Execution Time'],
        ]),
      ),
    }),
  );
} finally {
  await sql.end();
}
