import postgres from 'postgres';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';

const databaseName = 'soiree_phase2_test';
const databaseUser = 'phase2_test';
const containerName = `soiree-phase2-pg-${process.pid}-${Date.now()}`;
const steps: { command: string; code: number | null; durationMs: number }[] = [];
let transcript = '';
let containerStarted = false;
let url = process.env.TEST_DATABASE_URL;
let testIdentity: Record<string, unknown> | undefined;

function child(command: string, args: string[], env = process.env) {
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: process.cwd(),
      env,
      windowsHide: true,
      shell: process.platform === 'win32' && command.endsWith('.cmd'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      transcript += text;
      process.stdout.write(text);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      transcript += text;
      process.stderr.write(text);
    });
    proc.on('error', reject);
    proc.on('exit', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not select an ephemeral test port.');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function runStep(label: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`\n=== ${label} ===`);
  const startedAt = Date.now();
  const result = await child(command, args, env);
  steps.push({ command: label, code: result.code, durationMs: Date.now() - startedAt });
  if (result.code !== 0) throw new Error(`${label} failed with exit code ${result.code}.`);
  return result.output;
}

async function requireEmptyDatabase(client: ReturnType<typeof postgres>) {
  const tables = await client.unsafe(`
    SELECT COUNT(*)::text AS count FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name NOT IN ('spatial_ref_sys')`) as unknown as { count: string }[];
  if (Number(tables[0]?.count ?? 0) !== 0) {
    throw new Error('The designated test database is not empty. Refusing to run fixtures against existing data.');
  }
}

async function startLocalPostgres() {
  const port = await freePort();
  const password = randomBytes(32).toString('hex');
  const result = await child('docker', [
    'run', '--detach', '--rm', '--name', containerName,
    '--env', `POSTGRES_USER=${databaseUser}`,
    '--env', `POSTGRES_PASSWORD=${password}`,
    '--env', `POSTGRES_DB=${databaseName}`,
    '--publish', `127.0.0.1:${port}:5432`,
    'postgres:17-alpine',
  ]);
  if (result.code !== 0) throw new Error('Could not start the disposable PostgreSQL container.');
  containerStarted = true;
  url = `postgres://${databaseUser}:${password}@127.0.0.1:${port}/${databaseName}`;
}

async function verifyDatabase() {
  if (!url) await startLocalPostgres();
  const parsed = new URL(url!);
  const permittedHost = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  if (!permittedHost || parsed.username !== databaseUser || parsed.pathname !== `/${databaseName}` ||
      parsed.hostname.includes('supabase') || parsed.hostname.endsWith('.supabase.com')) {
    throw new Error('Refusing test database: expected the explicitly named local phase2 test database and user.');
  }

  const client = postgres(url!, { max: 1, connect_timeout: 5, ssl: false });
  try {
    let identity: Record<string, unknown> | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const rows = await client`
          SELECT current_database() AS database, current_user AS username,
                 version() AS version, inet_server_addr()::text AS server_address`;
        identity = rows[0] as Record<string, unknown>;
        break;
      } catch (error) {
        if (attempt === 39) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (identity?.database !== databaseName || identity?.username !== databaseUser ||
        !String(identity?.version).startsWith('PostgreSQL ')) {
      throw new Error('Database identity did not match the dedicated PostgreSQL test database.');
    }
    await requireEmptyDatabase(client);
    testIdentity = {
      database: identity.database,
      username: identity.username,
      version: String(identity.version).split(' ').slice(0, 2).join(' '),
      serverAddress: identity.server_address,
      hostname: parsed.hostname,
      port: parsed.port,
      container: containerStarted ? containerName : 'provided isolated test service',
    };
  } finally {
    await client.end();
  }
}

const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  POSTGRES_URL: '',
  POSTGRES_POOL_MAX: '5',
  TEST_ISOLATED: '1',
  TEST_DATABASE_URL: '',
  NEXT_DIST_DIR: '.next-test',
  APP_ORIGIN: 'http://127.0.0.1:3100',
  DB_PERF: '0',
  FEATURE_BOOKING_MESSAGING: 'true',
  FEATURE_PROVIDER_CANCELLATION_POLICY: 'true',
  PROVIDER_CANCELLATION_LOCK_HOURS: '48',
  FEATURE_LOYALTY_BETA: 'true',
  FEATURE_LOYALTY_MONETARY_REWARDS: 'false',
  FEATURE_SIMULATED_DEPOSITS: 'true',
};
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this command through npm so the selected npm CLI is explicit.');

let failure: unknown;
try {
  await verifyDatabase();
  baseEnv.POSTGRES_URL = url!;
  baseEnv.TEST_DATABASE_URL = url!;
  console.log(`Verified isolated PostgreSQL ${String(testIdentity?.version)} at ${String(testIdentity?.hostname)}:${String(testIdentity?.port)}; credentials are redacted.`);

  await runStep('TypeScript', process.execPath, [npmCli, 'run', 'typecheck'], baseEnv);
  await runStep('ESLint', process.execPath, [npmCli, 'run', 'lint'], baseEnv);
  await runStep('PostgreSQL migration semantics 002–008', process.execPath,
    ['--import', 'tsx', 'tests/postgres-migrations.ts'], baseEnv);
  const realPgOutput = await runStep(
    'PostgreSQL business integration suite', process.execPath,
    ['--import', 'tsx', '--test', '--test-reporter=spec', 'tests/business.test.ts'], baseEnv,
  );
  const testCount = realPgOutput.match(/ℹ tests (\d+)/)?.[1];
  const passCount = realPgOutput.match(/ℹ pass (\d+)/)?.[1];
  const failCount = realPgOutput.match(/ℹ fail (\d+)/)?.[1];
  if (!testCount || !passCount || failCount !== '0' || testCount !== passCount) {
    throw new Error('PostgreSQL test output did not report a fully passing test count.');
  }
  await runStep('Production build', process.execPath, [npmCli, 'run', 'build'], baseEnv);
  const browserOutput = await runStep('Playwright browser suite', process.execPath, [npmCli, 'run', 'test:e2e'], baseEnv);
  const browserPass = browserOutput.match(/(\d+) passed/)?.[1];
  const browserFail = browserOutput.match(/(\d+) failed/)?.[1] ?? '0';
  if (!browserPass || browserFail !== '0') throw new Error('Playwright did not report a fully passing browser suite.');
  steps.push({ command: `Playwright cases: ${browserPass} passed, ${browserFail} failed`, code: 0, durationMs: 0 });
} catch (error) {
  failure = error;
} finally {
  if (containerStarted) {
    const stop = await child('docker', ['stop', containerName]).catch((error) => {
      console.error('Failed to stop disposable PostgreSQL container.', error);
      return { code: 1, output: '' };
    });
    steps.push({ command: 'Disposable PostgreSQL cleanup', code: stop.code, durationMs: 0 });
    if (stop.code !== 0 && !failure) failure = new Error('Disposable PostgreSQL container cleanup failed.');
  }
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/phase2-verification.json', JSON.stringify({
    completedAt: new Date().toISOString(),
    database: testIdentity,
    steps,
    status: failure ? 'failed' : 'passed',
    error: failure instanceof Error ? failure.message : failure ? String(failure) : null,
  }, null, 2));
  writeFileSync('artifacts/phase2-verification.log', transcript);
}

if (failure) throw failure;
console.log('\nPhase 2 verification completed successfully. See artifacts/phase2-verification.json.');
