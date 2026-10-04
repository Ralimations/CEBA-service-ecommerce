import { all, one, settings, insert, id, notify, now, run } from './db';
import { assert, rankFor } from '@/lib/domain';
import type { Voucher } from '@/types/models';
export function validateVoucher(
  code: string,
  userId: string,
  subtotal: number,
  categories: string[],
  exceptBooking = '',
) {
  const voucher = one<Voucher>('SELECT * FROM vouchers WHERE code=?', code.trim().toUpperCase());
  assert(voucher, 'Voucher code was not found.');
  assert(
    voucher.active && voucher.valid_from <= now() && voucher.expires_at > now(),
    'This voucher is inactive, not yet valid, or expired.',
  );
  assert(
    !voucher.owner_id || voucher.owner_id === userId,
    'This voucher belongs to another customer.',
  );
  assert(subtotal >= voucher.min_spend, 'This booking does not meet the voucher minimum spend.');
  const redeemed = all<{ user_id: string }>(
    'SELECT user_id FROM voucher_redemptions WHERE voucher_id=? AND booking_id<>?',
    voucher.id,
    exceptBooking,
  );
  assert(redeemed.length < voucher.usage_limit, 'This voucher has reached its usage limit.');
  assert(
    redeemed.filter((r) => r.user_id === userId).length < voucher.per_user_limit,
    'You have already used this voucher.',
  );
  // Reserved vouchers on unpaid, active bookings count toward limits as well.
  const reserved = all<{ customer_id: string }>(
    "SELECT customer_id FROM bookings WHERE voucher_id=? AND id<>? AND escrow_status='UNPAID' AND status IN ('PENDING','ACCEPTED')",
    voucher.id,
    exceptBooking,
  );
  assert(
    redeemed.length + reserved.length < voucher.usage_limit &&
      redeemed.filter((r) => r.user_id === userId).length +
        reserved.filter((r) => r.customer_id === userId).length <
        voucher.per_user_limit,
    'This voucher is already reserved on an active booking.',
  );
  const history = one<{ paid: number; completed: number }>(
    `SELECT SUM(CASE WHEN escrow_status IN ('HELD_IN_ESCROW','RELEASED','DISPUTED') THEN 1 ELSE 0 END) paid,SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) completed FROM bookings WHERE customer_id=? AND id<>?`,
    userId,
    exceptBooking,
  )!;
  assert(!voucher.first_only || !history.paid, 'This voucher is for your first paid booking only.');
  const ranks = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  assert(
    ranks.indexOf(rankFor(history.completed || 0, settings())) >=
      ranks.indexOf(voucher.rank_required),
    `This voucher requires ${voucher.rank_required.toLowerCase()} rank.`,
  );
  assert(
    !voucher.category_id || categories.every((c) => c === voucher.category_id),
    'This voucher is restricted to a different service category.',
  );
  let discount =
    voucher.type === 'FIXED' ? voucher.value : Math.round((subtotal * voucher.value) / 100);
  if (voucher.max_discount > 0) discount = Math.min(discount, voucher.max_discount);
  return { voucher, discount: Math.min(subtotal, discount) };
}
// Called only inside the booking completion transaction; the unique referral row and conditional update make this once-only.
export function rewardReferral(userId: string) {
  const referral = one<{ id: string; referrer_id: string; referred_id: string }>(
    'SELECT * FROM referrals WHERE referred_id=? AND rewarded_at IS NULL',
    userId,
  );
  if (!referral) return;
  const completed = one<{ n: number }>(
    "SELECT COUNT(*) n FROM bookings WHERE customer_id=? AND status='COMPLETED'",
    userId,
  )!.n;
  if (completed < 1) return;
  const updated = run(
    'UPDATE referrals SET rewarded_at=? WHERE id=? AND rewarded_at IS NULL',
    now(),
    referral.id,
  );
  if (!updated.changes) return;
  for (const recipient of [referral.referrer_id, referral.referred_id]) {
    const voucherId = id();
    const code = `THANKS-${id().slice(0, 8).toUpperCase()}`;
    insert('vouchers', {
      id: voucherId,
      code,
      description: 'A little thank-you for celebrating together.',
      type: 'FIXED',
      value: Math.round(settings().referralReward * 100),
      min_spend: 100000,
      max_discount: 0,
      valid_from: now(),
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
      usage_limit: 1,
      per_user_limit: 1,
      owner_id: recipient,
    });
    insert('voucher_wallet', { user_id: recipient, voucher_id: voucherId });
    notify(
      recipient,
      'Your referral reward is here',
      `Use ${code} on your next event.`,
      '/vouchers',
    );
  }
}
