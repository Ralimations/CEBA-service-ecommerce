import type { ComponentProps } from 'react';

// Authentication entry must start a fresh document/session check, independent
// of a stale or unfinished App Router prefetch from the marketplace.
export function AuthLink(props: ComponentProps<'a'>) {
  return <a {...props} />;
}
