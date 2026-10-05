// Run alone against a DB_PERF=1 production server to measure hard expiry.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3302';
async function read() {
  const log = 'artifacts/perf-queries.jsonl';
  const offset = readFileSync(log, 'utf8').length;
  const start = performance.now();
  const response = await fetch(origin + '/services/service-0-0');
  assert.equal(response.status, 200);
  assert.ok(!/:E\{|data-dgst=/.test(await response.text()));
  return {
    queries: readFileSync(log, 'utf8').slice(offset).trim().split('\n').filter(Boolean).length,
    ms: Math.round(performance.now() - start),
  };
}
await read();
const warm = await read();
assert.equal(warm.queries, 0);
console.log('Warm hit verified. Waiting 65 seconds for hard expiry.');
await new Promise((resolve) => setTimeout(resolve, 65000));
const expired = await read();
assert.equal(expired.queries, 3);
const result = { warm, expired };
writeFileSync('artifacts/cache-lifetime.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
