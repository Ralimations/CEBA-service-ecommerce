// Read-only audit against the explicitly configured PostgreSQL project. Never seeds or resets.
import { existsSync } from 'node:fs';
import { db, closeDb } from '../server/db';
if (!process.env.POSTGRES_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
try {
  const columns = await db().unsafe<
    { table_name: string; column_name: string; data_type: string }[]
  >(
    `SELECT table_name,column_name,data_type FROM information_schema.columns
     WHERE table_schema='public' AND (column_name LIKE '%\\_at' ESCAPE '\\' OR column_name IN ('date','event_date','valid_from'))
     ORDER BY table_name,column_name`,
  );
  for (const c of columns) {
    // Identifiers come only from database metadata, quoted defensively.
    const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    const type = ['date', 'event_date'].includes(c.column_name) ? 'date' : 'timestamptz';
    const result = await db().unsafe(
      `SELECT COUNT(${quote(c.column_name)}::${type})::int n FROM public.${quote(c.table_name)}`,
    );
    console.log(
      `${c.table_name}.${c.column_name}: ${c.data_type}; ${result[0].n} valid ${type} values`,
    );
  }
  try {
    await db().unsafe('SELECT starts_at <= CURRENT_TIMESTAMP FROM subscriptions LIMIT 1');
  } catch (error) {
    const e = error as { code?: string; message: string };
    console.log(`Original uncast timestamp comparison: ${e.code} ${e.message}`);
  }
  const [rating] = await db().unsafe('SELECT AVG(rating) rating FROM reviews');
  console.log(`Uncast AVG JS type: ${typeof rating.rating}`);
  try {
    await db().unsafe('SELECT DISTINCT b.id FROM bookings b ORDER BY b.created_at DESC LIMIT 1');
  } catch (error) {
    const e = error as { code?: string; message: string };
    console.log(`Original booking ordering: ${e.code} ${e.message}`);
  }
  const flags = await db()
    .unsafe(`SELECT table_name,column_name,data_type FROM information_schema.columns
    WHERE table_schema='public' AND column_name IN ('active','moderated','rating') ORDER BY table_name,column_name`);
  for (const c of flags) console.log(`${c.table_name}.${c.column_name}: ${c.data_type}`);
} finally {
  await closeDb();
}
