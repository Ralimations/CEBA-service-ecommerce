import { assert, requireRole, type User } from '@/lib/domain';
import { booking } from './queries';
import { all, id, insert, one, transaction } from './db';

export const simulatedDepositsEnabled = process.env.FEATURE_SIMULATED_DEPOSITS === 'true';

// Split integer centavos proportionally with largest-remainder allocation so each
// installment sums exactly to the booking-level amount, including odd centavos.
export function splitCentavos(total: number, weights: { id: string; amount: number }[]) {
  const denominator = weights.reduce((sum, item) => sum + item.amount, 0);
  assert(Number.isSafeInteger(total) && total >= 0 && denominator > 0, 'Invalid simulated allocation.');
  const parts = weights.map((item) => {
    const exact = total * item.amount / denominator;
    return { id: item.id, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = total - parts.reduce((sum, part) => sum + part.amount, 0);
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))) {
    if (!left) break;
    part.amount += 1;
    left -= 1;
  }
  return parts.sort((a, b) => a.id.localeCompare(b.id)).map(({ id: itemId, amount }) => ({ itemId, amount }));
}

export async function recordSimulatedInstallment(user: User, bookingId: string, stage: 'DEPOSIT' | 'BALANCE') {
  requireRole(user, 'CUSTOMER');
  assert(simulatedDepositsEnabled, 'The simulated deposit prototype is disabled.');
  return transaction(async () => {
    await one('SELECT id FROM bookings WHERE id=? FOR UPDATE', bookingId);
    const locked = await booking(bookingId, user);
    assert(locked.status === 'ACCEPTED' && locked.escrow_status === 'UNPAID', 'The prototype is available only for accepted, unpaid bookings.');
    assert(!(await one("SELECT id FROM provider_cancellation_requests WHERE booking_id=? AND status='PENDING'", bookingId)), 'Payment is paused while a cancellation request is reviewed.');
    const existing = await all<{ stage: string }>('SELECT DISTINCT stage FROM simulated_deposit_entries WHERE booking_id=?', bookingId);
    assert(stage === 'DEPOSIT' ? !existing.some((x) => x.stage === 'DEPOSIT') : existing.some((x) => x.stage === 'DEPOSIT') && !existing.some((x) => x.stage === 'BALANCE'),
      stage === 'DEPOSIT' ? 'The simulated deposit was already recorded.' : 'Record the deposit once before the balance.');
    const amount = stage === 'DEPOSIT' ? Math.ceil(locked.total / 2) : locked.total - Math.ceil(locked.total / 2);
    const allocations = splitCentavos(amount, locked.items.map((item) => ({ id: item.id, amount: item.allocation })));
    for (const allocation of allocations) {
      await insert('simulated_deposit_entries', {
        id: id(), booking_id: bookingId, booking_item_id: allocation.itemId, stage, amount: allocation.amount,
      });
    }
    return { message: `${stage === 'DEPOSIT' ? 'Deposit' : 'Balance'} recorded in the non-settling prototype ledger.`, amount };
  });
}

export async function simulatedInstallments(bookingId: string) {
  return all<{ stage: string; amount: number }>(
    'SELECT stage,SUM(amount)::int amount FROM simulated_deposit_entries WHERE booking_id=? GROUP BY stage ORDER BY stage', bookingId,
  );
}
