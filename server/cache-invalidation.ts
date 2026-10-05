import { revalidateTag } from 'next/cache';

// Called by route handlers only AFTER a successful mutation/transaction commit.
// Broad domain tags also invalidate every detail entry that depends on that data.
// expire:0 blocks the next read on fresh data; the deprecated single-argument API
// and the stale-while-revalidate 'max' profile do not give that guarantee.
export function invalidatePublicData(action: string) {
  const tags = new Set<string>();
  const domain = action.split('.')[0];
  if (['service', 'package', 'addon'].includes(domain)) tags.add('services');
  if (
    [
      'profile',
      'portfolio',
      'provider',
      'user',
      'badge',
      'subscription',
      'placement',
      'review',
      'booking',
      'handshake',
      'escrow',
      'dispute',
      'register',
    ].includes(domain)
  )
    tags.add('providers');
  if (domain === 'bundle') tags.add('bundles');
  if (domain === 'category') tags.add('categories');
  if (domain === 'settings') tags.add('settings');
  if (tags.size) tags.add('marketplace');
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
