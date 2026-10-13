import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';

assert.equal(process.env.TEST_ISOLATED, '1');
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString, 'TEST_DATABASE_URL must be supplied explicitly by the isolated runner.');
const target = new URL(connectionString);
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
assert.equal(target.username, 'phase2_test');
assert.equal(target.pathname, '/soiree_phase2_test');

const schema = `phase2_migration_${randomUUID().replaceAll('-', '')}`;
const sql = postgres(connectionString, { max: 1, ssl: false });
let reserved: Awaited<ReturnType<typeof sql.reserve>> | undefined;
try {
  await sql.unsafe(`CREATE SCHEMA "${schema}"`);
  reserved = await sql.reserve();
  await reserved.unsafe(`SET search_path TO "${schema}"`);
  await reserved.unsafe(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE bookings(id TEXT PRIMARY KEY, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE booking_items(id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id));
    CREATE TABLE booking_events(
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      actor_id TEXT NOT NULL REFERENCES users(id),
      event TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE OR REPLACE FUNCTION soiree_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END; $$;
    INSERT INTO users(id) VALUES('preserved-user');
    INSERT INTO bookings(id,status) VALUES('old-pending','PENDING');
    INSERT INTO booking_events(id,booking_id,actor_id,event)
      VALUES('preserved-event','old-pending','preserved-user','Existing event');
  `);

  const migration002 = await readFile(resolve('database/migrations/002_public_account_support.sql'), 'utf8');
  const migration003 = await readFile(resolve('database/migrations/003_booking_response_and_cancellation_review.sql'), 'utf8');
  const migration004 = await readFile(resolve('database/migrations/004_booking_messaging.sql'), 'utf8');
  const migration005 = await readFile(resolve('database/migrations/005_provider_cancellation_window.sql'), 'utf8');
  const migration006 = await readFile(resolve('database/migrations/006_loyalty_experience.sql'), 'utf8');
  const migration007 = await readFile(resolve('database/migrations/007_simulated_deposit_prototype.sql'), 'utf8');
  const migration008 = await readFile(resolve('database/migrations/008_booking_message_reports.sql'), 'utf8');
  await reserved.unsafe(migration002);
  await reserved.unsafe(migration003);
  await reserved.unsafe(migration004);
  await reserved.unsafe(migration005);
  await reserved.unsafe(migration006);
  await reserved.unsafe(migration007);
  await reserved.unsafe(migration008);
  await reserved.unsafe(migration002);
  await reserved.unsafe(migration003);
  await reserved.unsafe(migration004);
  await reserved.unsafe(migration005);
  await reserved.unsafe(migration006);
  await reserved.unsafe(migration007);
  await reserved.unsafe(migration008);

  const rows = await reserved.unsafe(`SELECT id,status,response_deadline_at FROM bookings WHERE id='old-pending'`);
  assert.deepEqual({ ...rows[0] }, { id: 'old-pending', status: 'PENDING', response_deadline_at: null });
  assert.equal((await reserved.unsafe(`SELECT id FROM booking_events WHERE id='preserved-event'`)).length, 1);
  const actorNullable = await reserved.unsafe<{ is_nullable: string }[]>(
    `SELECT is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='booking_events' AND column_name='actor_id'`,
    [schema],
  );
  assert.equal(actorNullable[0]?.is_nullable, 'YES');
  assert.equal((await reserved.unsafe(`SELECT version FROM schema_migrations WHERE version BETWEEN 2 AND 8 ORDER BY version`)).length, 7);
  assert.equal((await reserved.unsafe(`SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name='booking_message_reports'`, [schema])).length, 1);
  const supportExists = await reserved.unsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name='public_account_support'`,
    [schema],
  );
  assert.equal(supportExists.length, 1);
  console.log('PostgreSQL migrations 002–008 passed twice in a disposable schema; historical rows, null deadlines, and private message reports were preserved.');
} finally {
  reserved?.release();
  await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await sql.end();
}
