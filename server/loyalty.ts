import { assert, rankFor, requireRole, type User } from '@/lib/domain';
import { all, id, now, notify, one, run, settings, transaction } from './db';

export const loyaltyPoints = { DAILY_CHECK_IN: 5, BOOKING_COMPLETED: 50, REFERRAL_RANK_UP: 25 } as const;
export const monetaryLoyaltyRewardsEnabled = process.env.FEATURE_LOYALTY_MONETARY_REWARDS === 'true';
const betaEnabled = () => process.env.FEATURE_LOYALTY_BETA === 'true';

export function manilaDateKey(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const part = (type: string) => parts.find((value) => value.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function award(userId: string, eventType: keyof typeof loyaltyPoints, referenceKey: string) {
  const result = await run(
    'INSERT INTO experience_ledger(id,user_id,event_type,reference_key,points,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,event_type,reference_key) DO NOTHING',
    id(), userId, eventType, referenceKey, loyaltyPoints[eventType], now(),
  );
  if (result.changes === 1) {
    await notify(userId, 'Experience points added', `You earned ${loyaltyPoints[eventType]} nonredeemable experience points.`, '/profile');
  }
  return result.changes === 1;
}

export async function experienceSummary(userId: string) {
  const rows = await all<{ event_type: keyof typeof loyaltyPoints; points: number; count: number }>(
    'SELECT event_type,SUM(points)::int points,COUNT(*)::int count FROM experience_ledger WHERE user_id=? GROUP BY event_type', userId,
  );
  const result = { total: 0, checkIns: 0, completedBookings: 0, referralMilestones: 0 };
  for (const row of rows) {
    result.total += row.points;
    if (row.event_type === 'DAILY_CHECK_IN') result.checkIns = row.count;
    if (row.event_type === 'BOOKING_COMPLETED') result.completedBookings = row.count;
    if (row.event_type === 'REFERRAL_RANK_UP') result.referralMilestones = row.count;
  }
  return result;
}

export async function dailyCheckIn(user: User, at = new Date()) {
  requireRole(user, 'CUSTOMER');
  assert(betaEnabled(), 'The loyalty beta is not enabled.', 404);
  const dateKey = manilaDateKey(at);
  return transaction(async () => {
    const earned = await award(user.id, 'DAILY_CHECK_IN', dateKey);
    return { message: earned ? 'Check-in complete. Five experience points added.' : 'You already checked in for this Philippine calendar day.' };
  });
}

export async function awardCompletedBookingExperience(customerId: string, bookingId: string) {
  if (!betaEnabled()) return;
  const completed = await one<{ id: string }>(
    "SELECT id FROM bookings WHERE id=? AND customer_id=? AND status='COMPLETED'", bookingId, customerId,
  );
  assert(completed, 'Experience points require a completed eligible booking.', 409);
  await award(customerId, 'BOOKING_COMPLETED', bookingId);

  const history = await one<{ count: number }>(
    "SELECT COUNT(*)::int count FROM bookings WHERE customer_id=? AND status='COMPLETED'", customerId,
  );
  const count = history?.count ?? 0;
  const rules = await settings();
  const current = rankFor(count, rules);
  const previous = rankFor(Math.max(0, count - 1), rules);
  if (current !== previous && ['SILVER', 'GOLD', 'PLATINUM'].includes(current)) {
    const referral = await one<{ referrer_id: string }>('SELECT referrer_id FROM referrals WHERE referred_id=?', customerId);
    if (referral) await award(referral.referrer_id, 'REFERRAL_RANK_UP', `${customerId}:${current}`);
  }
}

export async function loyaltyPreferences(user: User) {
  requireRole(user, 'CUSTOMER');
  const last = await one<{ reference_key: string; created_at: string }>(
    "SELECT reference_key,created_at FROM experience_ledger WHERE user_id=? AND event_type='DAILY_CHECK_IN' ORDER BY created_at DESC LIMIT 1", user.id,
  );
  return { enabled: betaEnabled(), monetaryRewardsEnabled: monetaryLoyaltyRewardsEnabled, lastCheckIn: last?.reference_key || null,
    summary: await experienceSummary(user.id) };
}
