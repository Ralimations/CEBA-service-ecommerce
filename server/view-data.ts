// React cache() lasts for one server render only. Domain mutations import raw
// queries instead, so transaction reads never reuse a pre-mutation snapshot.
import { cache } from 'react';
import * as queries from './queries';
import { settings as readSettings } from './db';
import type { User } from '@/lib/domain';

export * from './queries';
export const settings = cache(readSettings);
export const provider = cache(queries.provider);
export const providerByUser = cache(queries.providerByUser);
export const bookingsFor = cache(queries.bookingsFor);
export const booking = cache(queries.booking);
export const dashboardStats = cache(async (user: User) =>
  queries.statsForBookings(await bookingsFor(user), user),
);
