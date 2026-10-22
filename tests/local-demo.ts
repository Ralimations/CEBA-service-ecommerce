// Run the local demo against disposable in-memory Postgres data only.
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const database = await PGlite.create();
const databasePort = Number(process.env.LOCAL_DEMO_DB_PORT || 15441);
const appPort = Number(process.env.LOCAL_DEMO_PORT || 3000);
const server = new PGLiteSocketServer({ db: database, host: '127.0.0.1', port: databasePort, maxConnections: 10 });
await server.start();

process.env.POSTGRES_URL = `postgres://postgres:postgres@127.0.0.1:${databasePort}/postgres`;
process.env.POSTGRES_POOL_MAX = '1';
process.env.DATABASE_TARGET = 'local';
process.env.TEST_ISOLATED = '1';
process.env.APP_ORIGIN = `http://127.0.0.1:${appPort}`;
process.env.FEATURE_BOOKING_MESSAGING = 'true';
process.env.FEATURE_PROVIDER_CANCELLATION_POLICY = 'true';
process.env.PROVIDER_CANCELLATION_LOCK_HOURS = '48';
process.env.FEATURE_LOYALTY_BETA = 'true';
process.env.FEATURE_LOYALTY_MONETARY_REWARDS = 'false';
process.env.FEATURE_SIMULATED_DEPOSITS = 'true';
process.env.DB_PERF ||= '0';
process.env.NEXT_DIST_DIR ||= '.next-local-demo';

const [{ migrate, closeDb }, { seed }] = await Promise.all([
  import('@/server/db'),
  import('@/database/seed'),
]);

let child: ReturnType<typeof spawn> | undefined;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (child && child.exitCode === null) child.kill('SIGTERM');
  await closeDb().catch(() => undefined);
  await server.stop();
  await database.close();
  process.exitCode = code;
}

try {
  await migrate();
  await seed();
  await closeDb();
  console.log('Local demo database is ready (disposable in-memory PGlite).');
  console.log('Demo accounts use password: DemoPass!2026');
  console.log(`Starting the site at http://127.0.0.1:${appPort}`);

  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(appPort)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', (error) => {
    console.error(error);
    void shutdown(1);
  });
  child.on('exit', (code) => void shutdown(code ?? 1));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (child?.exitCode === null) child.kill(signal);
      else void shutdown();
    });
  }
} catch (error) {
  console.error(error);
  await shutdown(1);
}
