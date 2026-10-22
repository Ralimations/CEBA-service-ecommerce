import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register, login, userFromToken } from '@/server/auth';
import { updateProfile } from '@/server/management';
import { closeDb } from '@/server/db';

// Run against the already migrated disposable QA database, never hosted data.
const target = new URL(process.env.POSTGRES_URL || 'postgres://invalid/invalid');
assert.equal(process.env.TEST_ISOLATED, '1');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.username, 'phase2_test');
assert.equal(target.pathname, '/soiree_business_test');
after(closeDb);

test('demo QA: changing email capitalization must not prevent subsequent login', async () => {
  const email = `qa-${randomUUID()}@test.local`;
  const password = 'QA-only-passphrase-2026';
  const registration = await register({
    name: 'QA Email Case', email, password, confirmPassword: password,
    role: 'CUSTOMER', termsAccepted: true,
  });
  const user = await userFromToken(registration.token);
  assert.ok(user);
  await updateProfile(user, { name: user.name, email: email.toUpperCase(), phone: '' });
  const signedIn = await login({ email, password });
  assert.equal(signedIn.role, 'CUSTOMER');
});
