import { spawn } from 'node:child_process';
import { migrate, closeDb } from '@/server/db';
import { seed } from '@/database/seed';
const configured = process.env.POSTGRES_URL;
const parsed = configured ? new URL(configured) : null;
const pglite = process.env.TEST_ISOLATED === '1' && parsed?.hostname === '127.0.0.1' &&
  parsed.port === '55441' && parsed.pathname === '/postgres';
const realPostgres = !!configured && process.env.TEST_DATABASE_URL === configured &&
  ['127.0.0.1', 'localhost'].includes(parsed?.hostname || '') &&
  parsed?.username === 'phase2_test' && parsed.pathname === '/soiree_phase2_test';
if (!pglite && !realPostgres)
  throw new Error('Refusing to start the browser test server without an explicitly isolated test database.');
process.env.NEXT_DIST_DIR = '.next-test';
process.env.APP_ORIGIN = 'http://127.0.0.1:3100';
process.env.FEATURE_BOOKING_MESSAGING = 'true';
process.env.FEATURE_PROVIDER_CANCELLATION_POLICY = 'true';
process.env.PROVIDER_CANCELLATION_LOCK_HOURS = '48';
process.env.FEATURE_LOYALTY_BETA = 'true';
process.env.FEATURE_LOYALTY_MONETARY_REWARDS = 'false';
process.env.FEATURE_SIMULATED_DEPOSITS = 'true';
(await migrate());
(await seed());
(await closeDb());
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'], { cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
        child.kill(signal);
        process.exit();
    });
child.on('exit', (code) => process.exit(code || 0));
