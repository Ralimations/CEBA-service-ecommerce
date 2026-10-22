import { revalidateTag } from 'next/cache';

type ActionData = Record<string, unknown>;

// Only public catalog mutations invalidate shared cache entries. Booking
// lifecycle writes, private account changes, and read receipts do not change
// the public marketplace and should not trigger expensive cache refills.
export function publicDataTagsForAction(action: string, data: ActionData = {}) {
  switch (action) {
    case 'service.save':
    case 'service.moderate':
    case 'package.save':
    case 'addon.save':
    case 'addon.remove':
      return ['services'];
    case 'review.create':
      return ['providers'];
    case 'profile.save':
    case 'portfolio.save':
    case 'provider.verify':
    case 'user.status':
    case 'badge.save':
    case 'subscription.save':
    case 'placement.save':
    case 'placement.expire':
      return ['providers'];
    case 'handshake.verify':
      return data.gate === 'COMPLETE' ? ['providers'] : [];
    case 'escrow.manage':
      return data.decision === 'release' ? ['providers'] : [];
    case 'bundle.save':
    case 'bundle.add':
    case 'bundle.remove':
    case 'bundle.respond':
    case 'bundle.status':
      return ['bundles'];
    case 'category.save':
      return ['categories'];
    case 'settings.save':
      return ['settings'];
    default:
      return [];
  }
}

// Called after a successful mutation/transaction commit. These tags cover only
// shared public display data; stale-while-revalidate prevents a burst of page
// requests from all waiting on the same database refill. Booking and auth
// decisions always read uncached live data.
export function invalidatePublicData(action: string, data: ActionData = {}) {
  for (const tag of publicDataTagsForAction(action, data)) {
    revalidateTag(tag, 'max');
  }
}
