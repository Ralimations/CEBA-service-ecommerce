import { defaults } from '@/config/platform';
export const roles = ['CUSTOMER', 'PROVIDER', 'ADMIN'] as const;
export type Role = (typeof roles)[number];
export const bookingStatuses = [
  'PENDING',
  'ACCEPTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETION_PENDING',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const serviceStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export const escrowStatuses = [
  'UNPAID',
  'HELD_IN_ESCROW',
  'PARTIALLY_RELEASED',
  'RELEASED',
  'REFUNDED',
  'DISPUTED',
] as const;
export type Settings = typeof defaults;
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: string;
  referral_code: string;
  created_at: string;
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export function requireRole(user: User | null, ...allowed: Role[]): asserts user is User {
  assert(user, 'Please sign in to continue.', 401);
  assert(user.status === 'ACTIVE', 'This account is suspended.', 403);
  assert(allowed.includes(user.role), 'You do not have permission to do that.', 403);
}
const transitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'DISPUTED'],
  IN_PROGRESS: ['COMPLETION_PENDING', 'DISPUTED'],
  COMPLETION_PENDING: ['COMPLETED', 'DISPUTED'],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
export function checkTransition(from: BookingStatus, to: BookingStatus) {
  assert(
    transitions[from]?.includes(to),
    `Cannot change ${from.toLowerCase()} to ${to.toLowerCase()}.`,
  );
}
export function rankFor(completed: number, settings: Settings = defaults) {
  return completed >= settings.platinum
    ? 'PLATINUM'
    : completed >= settings.gold
      ? 'GOLD'
      : completed >= settings.silver
        ? 'SILVER'
        : 'BRONZE';
}
export function badgeEligible(
  rating: number,
  jobs: number,
  disputes: number,
  badge: string,
  settings: Settings = defaults,
) {
  return (
    disputes === 0 &&
    rating >= (badge === 'TRUSTED' ? settings.trustedRating : settings.bestRating) &&
    jobs >= (badge === 'TRUSTED' ? settings.trustedJobs : settings.bestJobs)
  );
}
