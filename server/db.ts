import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaults } from '@/config/platform';
import type { Settings } from '@/lib/domain';

export type Row = Record<string, string | number | boolean | null>;

type SQLValue = string | number | boolean | Date | null;

type DatabaseClient = ReturnType<typeof postgres>;

let connection: DatabaseClient | undefined;

const transactionStorage = new AsyncLocalStorage<DatabaseClient>();

function databaseUrl() {
  const url = process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      'POSTGRES_URL is missing. Add the Supabase PostgreSQL connection string to your environment.',
    );
  }

  return url;
}

export function db(): DatabaseClient {
  const transaction = transactionStorage.getStore();

  if (transaction) {
    return transaction;
  }

  if (!connection) {
    connection = postgres(databaseUrl(), {
      prepare: false,

      // Keep the pool deliberately small for Vercel/serverless.
      max: 5,

      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return connection;
}

/**
 * The repository keeps its concise `?` placeholders.
 *
 * PostgreSQL expects:
 *
 *   $1, $2, $3...
 *
 * This lets the existing queries be migrated gradually without manually
 * rewriting every placeholder.
 */
function postgresQuery(sql: string) {
  let index = 0;
  let singleQuoted = false;
  let doubleQuoted = false;

  let output = '';

  for (let i = 0; i < sql.length; i++) {
    const character = sql[i];

    if (character === "'" && !doubleQuoted) {
      // SQL escapes single quotes using ''
      if (singleQuoted && sql[i + 1] === "'") {
        output += "''";
        i++;
        continue;
      }

      singleQuoted = !singleQuoted;
      output += character;
      continue;
    }

    if (character === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      output += character;
      continue;
    }

    if (character === '?' && !singleQuoted && !doubleQuoted) {
      index++;
      output += `$${index}`;
      continue;
    }

    output += character;
  }

  return output;
}

export async function migrate() {
  const postgresSchema = resolve('database/schema.postgres.sql');

  if (!existsSync(postgresSchema)) {
    throw new Error(
      'database/schema.postgres.sql was not found. The PostgreSQL schema is required.',
    );
  }

  await db().unsafe(readFileSync(postgresSchema, 'utf8'));
}

export async function closeDb() {
  if (connection) {
    await connection.end();
    connection = undefined;
  }
}

export const id = () => randomUUID();

export const now = () => new Date().toISOString();

export async function all<T = Row>(
  sql: string,
  ...params: SQLValue[]
): Promise<T[]> {
  const result = await db().unsafe(postgresQuery(sql), params);

  return result.map((row) => ({ ...row })) as T[];
}

export async function one<T = Row>(
  sql: string,
  ...params: SQLValue[]
): Promise<T | undefined> {
  const result = await db().unsafe(postgresQuery(sql), params);

  const row = result[0];

  return row ? ({ ...row } as T) : undefined;
}

export async function run(
  sql: string,
  ...params: SQLValue[]
): Promise<{
  changes: number;
}> {
  const result = await db().unsafe(postgresQuery(sql), params);

  return {
    changes: result.count ?? 0,
  };
}

export async function insert(
  table: string,
  fields: Record<string, SQLValue>,
) {
  // Table and column names remain developer-owned constants.
  // Request/user values are still passed separately as parameters.
  const keys = Object.keys(fields);
  const values = Object.values(fields);

  const placeholders = keys.map((_, index) => `$${index + 1}`);

  await db().unsafe(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders.join(',')})`,
    values,
  );
}

export async function transaction<T>(
  fn: () => Promise<T> | T,
): Promise<T> {
  const root = db();

  return root.begin(async (tx) => {
    return transactionStorage.run(
      tx as unknown as DatabaseClient,
      async () => await fn(),
    );
  }) as Promise<T>;
}

export async function settings(): Promise<Settings> {
  const result = { ...defaults };

  for (const row of await all<{
    key: keyof Settings;
    value: number;
  }>('SELECT * FROM settings')) {
    if (row.key in result) {
      result[row.key] = row.value;
    }
  }

  return result;
}

export async function notify(
  userId: string,
  title: string,
  body: string,
  href = '/notifications',
) {
  await insert('notifications', {
    id: id(),
    user_id: userId,
    title,
    body,
    href,
  });
}

export async function admins(
  title: string,
  body: string,
  href: string,
) {
  const users = await all<{ id: string }>(
    "SELECT id FROM users WHERE role='ADMIN' AND status='ACTIVE'",
  );

  await Promise.all(
    users.map((user) => notify(user.id, title, body, href)),
  );
}

export async function audit(
  actor: string,
  action: string,
  target: string,
  detail = '',
) {
  await insert('audit_log', {
    id: id(),
    actor_id: actor,
    action,
    target,
    detail,
  });
}
