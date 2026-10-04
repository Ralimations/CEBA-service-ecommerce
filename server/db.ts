import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaults } from '@/config/platform';
import type { Settings } from '@/lib/domain';
export type Row = Record<string, string | number | null>;
let connection: DatabaseSync | undefined;
export function db() {
  if (!connection) {
    const path = process.env.DATABASE_PATH || './data/marketplace.sqlite';
    if (path !== ':memory:')
      mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), { recursive: true });
    connection = new DatabaseSync(path);
    connection.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  }
  return connection;
}
export function migrate() {
  db().exec(readFileSync(resolve('database/schema.sql'), 'utf8'));
}
export function closeDb() {
  connection?.close();
  connection = undefined;
}
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
// node:sqlite returns null-prototype records. Normalize them at the boundary so
// they remain safe, plain serializable values for React Server Components.
export function all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
  return db()
    .prepare(sql)
    .all(...params)
    .map((row) => ({ ...row })) as T[];
}
export function one<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
  const row = db()
    .prepare(sql)
    .get(...params);
  return row ? ({ ...row } as T) : undefined;
}
export function run(sql: string, ...params: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .run(...params);
}
export function insert(table: string, fields: Record<string, SQLInputValue>) {
  // Table and column names are exclusively developer-owned constants, never request parameters.
  const keys = Object.keys(fields);
  run(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    ...Object.values(fields),
  );
}
export function transaction<T>(fn: () => T): T {
  db().exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db().exec('COMMIT');
    return result;
  } catch (error) {
    db().exec('ROLLBACK');
    throw error;
  }
}
export function settings(): Settings {
  const result = { ...defaults };
  for (const row of all<{ key: keyof Settings; value: number }>('SELECT * FROM settings'))
    if (row.key in result) result[row.key] = row.value;
  return result;
}
export function notify(userId: string, title: string, body: string, href = '/notifications') {
  insert('notifications', { id: id(), user_id: userId, title, body, href });
}
export function admins(title: string, body: string, href: string) {
  all<{ id: string }>("SELECT id FROM users WHERE role='ADMIN' AND status='ACTIVE'").forEach((u) =>
    notify(u.id, title, body, href),
  );
}
export function audit(actor: string, action: string, target: string, detail = '') {
  insert('audit_log', { id: id(), actor_id: actor, action, target, detail });
}
