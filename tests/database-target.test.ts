import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseTargetIssue } from '../database/target-guard';

const project = 'abcdefghijklmnopqrst';
const production = 'zyxwvutsrqponmlkjihg';

test('local database mutations require an explicitly selected loopback database', () => {
  assert.equal(databaseTargetIssue('postgres://dev:dev@127.0.0.1:5432/soiree', { DATABASE_TARGET: 'local' }, 'migration'), undefined);
  assert.match(databaseTargetIssue('postgres://dev:dev@db.example.com/soiree', { DATABASE_TARGET: 'local' }, 'migration') ?? '', /loopback/);
  assert.match(databaseTargetIssue('postgres://dev:dev@127.0.0.1:5432/soiree', {}, 'migration') ?? '', /explicitly set/);
});

test('staging database mutations require distinct verified project references and a matching direct host', () => {
  const env = {
    DATABASE_TARGET: 'staging',
    STAGING_SUPABASE_PROJECT_REF: project,
    PRODUCTION_SUPABASE_PROJECT_REF: production,
  };
  assert.equal(databaseTargetIssue(`postgres://postgres:secret@db.${project}.supabase.co:5432/postgres`, env, 'migration'), undefined);
  assert.match(databaseTargetIssue(`postgres://postgres:secret@db.${project}.supabase.co/postgres`, { ...env, PRODUCTION_SUPABASE_PROJECT_REF: project }, 'migration') ?? '', /must differ/);
  assert.match(databaseTargetIssue('postgres://postgres:secret@aws-0.pooler.supabase.com:6543/postgres', env, 'migration') ?? '', /identify the configured staging/);
  assert.match(databaseTargetIssue(`postgres://postgres:secret@db.${project}.supabase.co/postgres`, { ...env, PRODUCTION_SUPABASE_PROJECT_REF: undefined }, 'migration') ?? '', /PRODUCTION_SUPABASE_PROJECT_REF/);
});

test('production permits runtime connections but rejects migrations and fixture seeding', () => {
  const url = 'postgres://postgres:secret@db.production.supabase.co:5432/postgres';
  const productionEnv = { VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' };
  assert.equal(databaseTargetIssue(url, productionEnv, 'runtime'), undefined);
  assert.match(databaseTargetIssue(url, productionEnv, 'migration') ?? '', /blocked/);
  assert.match(databaseTargetIssue(url, { VERCEL_ENV: 'preview' }, 'runtime') ?? '', /explicitly set/);
  assert.match(databaseTargetIssue(url, { VERCEL_ENV: 'production', NODE_ENV: 'production' }, 'runtime') ?? '', /explicitly set/);
});

test('isolated test databases are allowed only on loopback', () => {
  assert.equal(databaseTargetIssue('postgres://phase2_test:test@localhost:5432/soiree_phase2_test', { TEST_ISOLATED: '1' }), undefined);
  assert.match(databaseTargetIssue('postgres://user:secret@db.production.supabase.co/postgres', { TEST_ISOLATED: '1' }) ?? '', /explicitly set/);
});
