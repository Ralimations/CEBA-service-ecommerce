import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Explicit local diagnostic opt-in. Never records bound parameters, returned rows,
// credentials or errors. Disabled on normal deployments.
export async function measureQuery<T>(sql: string, execute: () => Promise<T>): Promise<T> {
  if (process.env.DB_PERF !== '1') return execute();
  const start = performance.now();
  try {
    return await execute();
  } finally {
    const elapsedMs = performance.now() - start;
    const shape = sql
      .replace(/'(?:''|[^'])*'/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
    mkdirSync(resolve('artifacts'), { recursive: true });
    appendFileSync(
      resolve('artifacts/perf-queries.jsonl'),
      JSON.stringify({
        timestamp: Date.now(),
        elapsedMs,
        sql: shape,
      }) + '\n',
    );
  }
}
