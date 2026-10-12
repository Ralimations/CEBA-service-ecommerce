import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

// The browser suite's dev server inherits this explicit in-memory database URL.
// POSTGRES_URL is set before Playwright starts, so tests/serve.ts will not load .env.local.
const database = await PGlite.create();
const server = new PGLiteSocketServer({
  db: database,
  host: '127.0.0.1',
  port: 55441,
  maxConnections: 1,
});
await server.start();
const env = {
  ...process.env,
  POSTGRES_URL: 'postgres://postgres:postgres@127.0.0.1:55441/postgres',
  POSTGRES_POOL_MAX: '1',
  APP_ORIGIN: 'http://127.0.0.1:3100',
  DB_PERF: '0',
};
try {
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
    stdio: 'inherit',
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  await server.stop();
  await database.close();
}
