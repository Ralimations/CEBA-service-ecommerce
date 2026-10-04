import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { migrate, closeDb } from '@/server/db';
import { seed } from '@/database/seed';
process.env.DATABASE_PATH = resolve('data', `browser-test-${Date.now()}.sqlite`);
process.env.NEXT_DIST_DIR = '.next-test';
process.env.APP_ORIGIN = 'http://127.0.0.1:3100';
migrate();
seed();
closeDb();
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
  { cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    child.kill(signal);
    process.exit();
  });
child.on('exit', (code) => process.exit(code || 0));
