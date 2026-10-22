import assert from 'node:assert/strict';
import test from 'node:test';
import { publicDataTagsForAction } from '../server/cache-invalidation';

test('routine booking writes do not force public catalog cache misses', () => {
  for (const action of [
    'booking.create',
    'booking.accept',
    'booking.cancel',
    'booking.pay',
    'booking.deposit-prototype',
    'booking.dispute',
    'handshake.issue',
    'notifications.read',
  ]) {
    assert.deepEqual(publicDataTagsForAction(action), [], action);
  }
});

test('public catalog changes invalidate only their dependent cache family', () => {
  assert.deepEqual(publicDataTagsForAction('service.save'), ['services']);
  assert.deepEqual(publicDataTagsForAction('bundle.status'), ['bundles']);
  assert.deepEqual(publicDataTagsForAction('settings.save'), ['settings']);
  assert.deepEqual(publicDataTagsForAction('review.create'), ['providers']);
  assert.deepEqual(publicDataTagsForAction('handshake.verify', { gate: 'START' }), []);
  assert.deepEqual(publicDataTagsForAction('handshake.verify', { gate: 'COMPLETE' }), ['providers']);
  assert.deepEqual(publicDataTagsForAction('escrow.manage', { decision: 'release' }), ['providers']);
});
