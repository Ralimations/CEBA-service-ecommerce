// All destructive fixture operations stay in this disposable, in-memory server.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, host: '127.0.0.1', port: 55439 });
await server.start();
try {
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...process.argv.slice(2), 'tests/business.test.ts'], {
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      POSTGRES_URL: 'postgres://postgres:postgres@127.0.0.1:55439/postgres',
      POSTGRES_POOL_MAX: '1',
      TEST_ISOLATED: '1',
      DB_PERF: '0',
    },
  });
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await server.stop();
  await database.close();
}
