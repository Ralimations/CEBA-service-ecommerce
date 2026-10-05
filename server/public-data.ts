// Public display reads only. Booking, payment, authorization, and administration
// must continue to use the uncached domain queries in queries.ts and db.ts.
import { all, one, settings as readSettings } from './db';
import { activeCategories as readCategories } from './auth';
import { cacheLife, cacheTag } from 'next/cache';
import * as query from './queries';
import type { Package, Review } from '@/types/models';

export async function catalog() {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('marketplace', 'services', 'providers', 'settings', 'categories');
  return query.marketplaceServices();
}
export async function settings() {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('settings');
  return readSettings();
}
export async function activeCategories() {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('categories');
  return readCategories();
}
export async function providerSummaries() {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('providers', 'settings', 'categories');
  return query.providers();
}
export async function services(filters: query.Search = {}) {
  return query.filterServices(await catalog(), filters);
}

// Aggregate small related collections in SQL, without multiplying joined rows.
const reviewSelect = `SELECT r.*,u.name customer_name,s.title service_title,p.business_name
  FROM reviews r JOIN users u ON u.id=r.customer_id JOIN services s ON s.id=r.service_id
  JOIN providers p ON p.id=r.provider_id WHERE r.provider_id=? ORDER BY r.created_at DESC`;
type Addon = { id: string; name: string; price: number };
export async function serviceContent(id: string) {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('services', 'providers', 'categories', 'settings', `service:${id}`);
  const service = await query.service(id);
  if (!service) return null;
  const extras = (await one<{ packages: Package[]; addons: Addon[]; reviews: Review[] }>(
    `SELECT
    COALESCE((SELECT json_agg(k) FROM (SELECT * FROM packages WHERE service_id=? AND active=1 ORDER BY price) k),'[]'::json) packages,
    COALESCE((SELECT json_agg(a) FROM (SELECT id,name,price FROM addons WHERE service_id=? AND active=1) a),'[]'::json) addons,
    COALESCE((SELECT json_agg(r) FROM (${reviewSelect}) r),'[]'::json) reviews`,
    id,
    id,
    service.provider_id,
  ))!;
  return { service, provider: service.provider, ...extras };
}
export async function providerContent(id: string) {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('providers', 'services', 'categories', 'settings', `provider:${id}`);
  const provider = await query.provider(id);
  if (!provider || provider.status !== 'ACTIVE') return null;
  const [services, extras] = await Promise.all([
    query.marketplaceServices(undefined, provider),
    one<{
      packages: Package[];
      portfolio: { id: string; image: string; caption: string }[];
      reviews: Review[];
    }>(
      `SELECT
      COALESCE((SELECT json_agg(k) FROM (SELECT k.* FROM packages k JOIN services s ON s.id=k.service_id
        WHERE s.provider_id=? AND k.active=1 ORDER BY k.price) k),'[]'::json) packages,
      COALESCE((SELECT json_agg(p) FROM (SELECT id,image,caption FROM portfolio WHERE provider_id=?) p),'[]'::json) portfolio,
      COALESCE((SELECT json_agg(r) FROM (${reviewSelect}) r),'[]'::json) reviews`,
      id,
      id,
      id,
    ),
  ]);
  return { provider, services, ...extras! };
}
// Calendar state is read every request; dates/notes are not in shared caches.
export async function providerCalendar(id: string, from: string) {
  const rows = await all<{ date: string; status: string; note: string; reserved: boolean }>(
    `
    (SELECT date,status,note,FALSE reserved FROM availability WHERE provider_id=? AND date>=? ORDER BY date LIMIT 12)
    UNION ALL
    (SELECT date,'RESERVED' status,'' note,TRUE reserved FROM reservations WHERE provider_id=? AND date>=? ORDER BY date LIMIT 12)`,
    id,
    from,
    id,
    from,
  );
  return { dates: rows.filter((r) => !r.reserved), booked: rows.filter((r) => r.reserved) };
}
export async function bundleCatalog() {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('bundles', 'services', 'providers', 'categories');
  return query.bundles();
}
export async function bundleContent(id: string) {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag('bundles', 'services', 'providers', 'categories', `bundle:${id}`);
  return (await query.bundles(undefined, false, id))[0] || null;
}
async function withAvailability(list: Awaited<ReturnType<typeof query.bundles>>, date?: string) {
  if (!date) return list;
  const blocked = await query.unavailableProviders(
    list.flatMap((b) => b.items.map((i) => i.provider_id)),
    date,
  );
  return list.map((b) => ({
    ...b,
    available: b.ready && b.items.every((i) => !blocked.has(i.provider_id)),
  }));
}
export async function bundles(date?: string) {
  return withAvailability(await bundleCatalog(), date);
}
export async function bundle(id: string, date?: string) {
  const b = await bundleContent(id);
  return b ? (await withAvailability([b], date))[0] : null;
}
export async function searchBundles(filters: query.Search = {}) {
  const [list, providers] = await Promise.all([bundles(filters.date), providerSummaries()]);
  return query.filterBundles(list, providers, filters);
}
