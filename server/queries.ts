import { all, one, settings, type Row } from './db';
import { recommendation } from '@/config/platform';
import { assert, badgeEligible, rankFor, type User, type Settings } from '@/lib/domain';
import type { Booking, BookingItem, Bundle, BundleItem, Provider, Service, Review, Package, } from '@/types/models';
export async function available(providerId: string, date: string, exceptBooking = '') {
    return !(await unavailableProviders([providerId], date, exceptBooking)).has(providerId);
}
// Live, set-based availability. Never shared-cache this result or booking checks.
export async function unavailableProviders(providerIds: string[], date: string, exceptBooking = '') {
    if (!providerIds.length) return new Set<string>();
    const rows = await all<{ provider_id: string }>(`WITH requested AS (
      SELECT value AS provider_id FROM jsonb_array_elements_text(?::text::jsonb)
    ) SELECT a.provider_id FROM availability a JOIN requested USING(provider_id)
      WHERE a.date=? AND a.status='UNAVAILABLE'
      UNION SELECT r.provider_id FROM reservations r JOIN requested USING(provider_id)
      WHERE r.date=? AND r.booking_id<>?`, JSON.stringify([...new Set(providerIds)]), date, date, exceptBooking);
    return new Set(rows.map(r => r.provider_id));
}
export async function providerByUser(userId: string) {
    const row = (await one<{
        id: string;
    }>('SELECT id FROM providers WHERE user_id=?', userId));
    assert(row, 'Provider profile not found.', 404);
    return (await provider(row.id))!;
}
export async function provider(providerId: string): Promise<Provider | undefined> {
    return (await providers(providerId))[0];
}
// Shared projection: correlated aggregates remain one SQL call, including badges.
export const providerSelect = `SELECT p.*,u.status,c.name category_name,
    COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.provider_id=p.id),0)::double precision rating,
    (SELECT COUNT(*)::int FROM reviews r WHERE r.provider_id=p.id) review_count,
    (SELECT COUNT(*)::int FROM booking_items i JOIN bookings b ON b.id=i.booking_id WHERE i.provider_id=p.id AND b.status='COMPLETED') completed,
    (SELECT COUNT(DISTINCT d.id)::int FROM disputes d JOIN booking_items i ON i.booking_id=d.booking_id WHERE i.provider_id=p.id AND d.status IN ('OPEN','UNDER_REVIEW')) disputes,
    CASE WHEN EXISTS(SELECT 1 FROM subscriptions s WHERE s.provider_id=p.id AND s.tier='VIP' AND s.status='ACTIVE' AND s.starts_at::timestamptz<=CURRENT_TIMESTAMP AND s.expires_at::timestamptz>CURRENT_TIMESTAMP) THEN 1 ELSE 0 END vip,
    CASE WHEN EXISTS(SELECT 1 FROM placements f WHERE f.provider_id=p.id AND f.status='ACTIVE' AND f.starts_at::timestamptz<=CURRENT_TIMESTAMP AND f.expires_at::timestamptz>CURRENT_TIMESTAMP) THEN 1 ELSE 0 END featured
    ,(SELECT granted FROM provider_badges WHERE provider_id=p.id AND badge='TRUSTED') trusted_override
    ,(SELECT granted FROM provider_badges WHERE provider_id=p.id AND badge='BEST_SERVICE') best_override
    FROM providers p JOIN users u ON u.id=p.user_id JOIN categories c ON c.id=p.category_id`;
type ProviderRow = Provider & { trusted_override: number | null; best_override: number | null };
function decorateProvider(row: ProviderRow, rules: Settings): Provider {
    const { trusted_override, best_override, ...p } = row;
    return { ...p,
      trusted: badgeEligible(p.rating, p.completed, p.disputes, 'TRUSTED', rules) && trusted_override !== 0,
      best: badgeEligible(p.rating, p.completed, p.disputes, 'BEST_SERVICE', rules) && best_override !== 0,
    };
}
export async function providers(providerId?: string): Promise<Provider[]> {
    const [rows, rules] = await Promise.all([
      all<ProviderRow>(providerSelect + (providerId ? ' WHERE p.id=?' : ''), ...(providerId ? [providerId] : [])),
      settings(),
    ]);
    return rows.map(p => decorateProvider(p, rules));
}
export type Search = {
    q?: string;
    category?: string;
    min?: string;
    max?: string;
    date?: string;
    rating?: string;
    available?: string;
    trusted?: string;
    vip?: string;
    sort?: string;
    placement?: string;
};
export type MarketplaceService = Service & { provider: Provider; placements: string[] };
const serviceSelect = `SELECT s.*,c.name category_name,k.price base_price,
    COALESCE((SELECT json_agg(f.placement) FROM placements f WHERE f.provider_id=s.provider_id
      AND f.status='ACTIVE' AND f.starts_at::timestamptz<=CURRENT_TIMESTAMP
      AND f.expires_at::timestamptz>CURRENT_TIMESTAMP),'[]'::json) placements
    FROM services s JOIN categories c ON c.id=s.category_id
    JOIN providers owner ON owner.id=s.provider_id JOIN users u ON u.id=owner.user_id
    JOIN LATERAL (SELECT MIN(price) price FROM packages WHERE service_id=s.id AND active=1) k ON k.price IS NOT NULL
    WHERE s.status='ACTIVE' AND s.moderated=0 AND c.active=1 AND u.status='ACTIVE'`;
export async function marketplaceServices(serviceId?: string, owner?: Provider): Promise<MarketplaceService[]> {
    const rows = await all<Service & { placements: string[]; provider: ProviderRow }>(
      `SELECT s.*${owner ? '' : ',row_to_json(p) provider'} FROM (${serviceSelect}${serviceId ? ' AND s.id=?' : owner ? ' AND s.provider_id=?' : ''}) s
       ${owner ? '' : `JOIN (${providerSelect}) p ON p.id=s.provider_id`}`,
      ...(serviceId ? [serviceId] : owner ? [owner.id] : []));
    const rules = owner ? undefined : await settings();
    return rows.map(s => {
      const p = owner || decorateProvider(s.provider, rules!);
      return { ...s, provider: p, business_name: p.business_name, rating: p.rating,
        review_count: p.review_count, completed: p.completed, vip: p.vip, trusted: p.trusted,
        featured: +s.placements.includes('SEARCH'), available: true };
    });
}
export async function services(filters: Search = {}): Promise<Service[]> {
    return filterServices(await marketplaceServices(), filters);
}
export async function filterServices(list: MarketplaceService[], filters: Search = {}): Promise<Service[]> {
    const blocked = filters.date ? await unavailableProviders(list.map(s => s.provider_id), filters.date) : new Set<string>();
    let result = list.map(s => ({ ...s,
      featured: +s.placements.includes(filters.placement || (filters.category ? 'CATEGORY' : 'SEARCH')),
      available: !blocked.has(s.provider_id),
    }));
    const keyword = filters.q?.trim().toLowerCase();
    result = result.filter((s) => (!keyword ||
        `${s.title} ${s.business_name} ${s.description} ${s.category_name}`
            .toLowerCase()
            .includes(keyword)) &&
        (!filters.category || s.category_id === filters.category) &&
        (!filters.min || s.base_price >= Number(filters.min) * 100) &&
        (!filters.max || s.base_price <= Number(filters.max) * 100) &&
        (!filters.rating || s.rating >= Number(filters.rating)) &&
        (!filters.available || s.available) &&
        (!filters.trusted || s.trusted) &&
        (!filters.vip || s.vip));
    const score = (s: Service) => s.featured * recommendation.featured +
        s.vip * recommendation.vip +
        s.rating * recommendation.rating +
        Math.min(s.completed, recommendation.completedCap) * recommendation.completed;
    result.sort((a, b) => filters.sort === 'price-low'
        ? a.base_price - b.base_price
        : filters.sort === 'price-high'
            ? b.base_price - a.base_price
            : filters.sort === 'rating'
                ? b.rating - a.rating || b.review_count - a.review_count
                : filters.sort === 'popular'
                    ? b.completed - a.completed
                    : score(b) - score(a));
    return result;
}
export async function service(serviceId: string) {
    return (await marketplaceServices(serviceId))[0];
}
export const packagesFor = async (serviceId: string) => (await all<Package>('SELECT * FROM packages WHERE service_id=? AND active=1 ORDER BY price', serviceId));
export async function bundles(date?: string, includeDraft = false, bundleId?: string): Promise<Bundle[]> {
    const list = await all<Bundle>(`SELECT * FROM bundles WHERE ${includeDraft ? 'TRUE' : "status='PUBLISHED'"}${bundleId ? ' AND id=?' : ''}`, ...(bundleId ? [bundleId] : []));
    if (!list.length) return [];
    const rows = await all<BundleItem>(`SELECT i.*,p.business_name,p.user_id,k.name package_name,k.active package_active,s.title service_title,s.id service_id,s.category_id,s.status service_status,s.moderated,u.status provider_status,c.active category_active FROM bundle_items i JOIN providers p ON p.id=i.provider_id JOIN users u ON u.id=p.user_id JOIN packages k ON k.id=i.package_id JOIN services s ON s.id=k.service_id JOIN categories c ON c.id=s.category_id WHERE i.bundle_id IN (SELECT value FROM jsonb_array_elements_text(?::text::jsonb))`, JSON.stringify(list.map(b => b.id)));
    const grouped = Map.groupBy(rows, i => i.bundle_id);
    const blocked = date ? await unavailableProviders(rows.map(i => i.provider_id), date) : new Set<string>();
    return list.map(b => {
        const items = grouped.get(b.id) || [];
        const original = items.reduce((sum, i) => sum + i.price, 0);
        const ready = items.length >= 2 &&
            items.every((i) => i.approval === 'ACCEPTED' &&
                i.package_active &&
                i.service_status === 'ACTIVE' &&
                !i.moderated &&
                i.provider_status === 'ACTIVE' &&
                i.category_active);
        return {
            ...b,
            items,
            original,
            total: Math.round(original * (1 - b.discount_percent / 100)),
            ready,
            available: ready && items.every(i => !blocked.has(i.provider_id)),
        };
    });
}
export const bookingItems = async (bookingId: string) => (await all<BookingItem>(`SELECT i.*,p.business_name,p.user_id provider_user_id,p.phone provider_phone,r.id review_id FROM booking_items i JOIN providers p ON p.id=i.provider_id LEFT JOIN reviews r ON r.booking_item_id=i.id WHERE i.booking_id=?`, bookingId));
export async function searchBundles(filters: Search = {}) {
    return filterBundles(await bundles(filters.date), await providers(), filters);
}
export function filterBundles(bundles: Bundle[], providers: Provider[], filters: Search = {}) {
    const teams = new Map(providers.map((p) => [p.id, p]));
    const keyword = filters.q?.trim().toLowerCase();
    const list = bundles.map((b) => {
        const participants = b.items.map((i) => teams.get(i.provider_id)!);
        return {
            ...b,
            rating: participants.reduce((n, p) => n + p.rating, 0) / Math.max(1, participants.length),
            popular: participants.reduce((n, p) => n + p.completed, 0),
            trusted: participants.every((p) => p.trusted),
            vip: participants.some((p) => p.vip),
        };
    })
        .filter((b) => (!keyword ||
        `${b.name} ${b.description} ${b.items.map((i) => `${i.business_name} ${i.service_title}`).join(' ')}`
            .toLowerCase()
            .includes(keyword)) &&
        (!filters.category || b.items.some((i) => i.category_id === filters.category)) &&
        (!filters.min || b.total >= Number(filters.min) * 100) &&
        (!filters.max || b.total <= Number(filters.max) * 100) &&
        (!filters.rating || b.rating >= Number(filters.rating)) &&
        (!filters.available || b.available) &&
        (!filters.trusted || b.trusted) &&
        (!filters.vip || b.vip));
    return list.sort((a, b) => filters.sort === 'price-low'
        ? a.total - b.total
        : filters.sort === 'price-high'
            ? b.total - a.total
            : filters.sort === 'popular'
                ? b.popular - a.popular
                : b.rating - a.rating);
}
export async function booking(bookingId: string, user: User): Promise<Booking> {
    const b = (await one<Booking>(`SELECT b.*,u.name customer_name,u.email customer_email,v.code voucher_code FROM bookings b JOIN users u ON u.id=b.customer_id LEFT JOIN vouchers v ON v.id=b.voucher_id WHERE b.id=?`, bookingId));
    assert(b, 'Booking not found.', 404);
    b.items = (await bookingItems(b.id));
    assert(user.role === 'ADMIN' ||
        (user.role === 'CUSTOMER' && b.customer_id === user.id) ||
        (user.role === 'PROVIDER' && b.items.some((i) => i.provider_user_id === user.id)), 'Booking not found.', 404);
    return b;
}
export async function bookingsFor(user: User): Promise<Booking[]> {
    const list = await all<Booking>(`SELECT b.*,u.name customer_name,u.email customer_email,v.code voucher_code
      FROM bookings b JOIN users u ON u.id=b.customer_id LEFT JOIN vouchers v ON v.id=b.voucher_id
      WHERE (?='ADMIN' OR (?='CUSTOMER' AND b.customer_id=?) OR (?='PROVIDER' AND EXISTS(
        SELECT 1 FROM booking_items i JOIN providers p ON p.id=i.provider_id WHERE i.booking_id=b.id AND p.user_id=?)))
      ORDER BY b.created_at::timestamptz DESC`, user.role, user.role, user.id, user.role, user.id);
    if (!list.length) return [];
    const rows = await all<BookingItem>(`SELECT i.*,p.business_name,p.user_id provider_user_id,p.phone provider_phone,r.id review_id
      FROM booking_items i JOIN providers p ON p.id=i.provider_id LEFT JOIN reviews r ON r.booking_item_id=i.id
      WHERE i.booking_id IN (SELECT value FROM jsonb_array_elements_text(?::text::jsonb))`, JSON.stringify(list.map(b => b.id)));
    const grouped = Map.groupBy(rows, i => i.booking_id);
    return list.map(b => ({ ...b, items: grouped.get(b.id) || [] }));
}
export async function reviews(providerId?: string): Promise<Review[]> {
    return (await all<Review>(`SELECT r.*,u.name customer_name,s.title service_title,p.business_name FROM reviews r JOIN users u ON u.id=r.customer_id JOIN services s ON s.id=r.service_id JOIN providers p ON p.id=r.provider_id ${providerId ? 'WHERE r.provider_id=?' : ''} ORDER BY r.created_at DESC`, ...(providerId ? [providerId] : [])));
}
export async function customerStats(userId: string) {
    const row = (await one<{
        completed: number;
        spending: number;
    }>("SELECT COUNT(*)::int completed,COALESCE(SUM(total),0)::double precision spending FROM bookings WHERE customer_id=? AND status='COMPLETED'", userId))!;
    return { ...row, rank: rankFor(row.completed, (await settings())) };
}
export async function dashboardStats(user: User) {
    return statsForBookings(await bookingsFor(user), user);
}
export function statsForBookings(bookings: Booking[], user: User) {
    const mine = (b: Booking) => b.items.filter((i) => user.role !== 'PROVIDER' || i.provider_user_id === user.id);
    return {
        bookings: bookings.length,
        completed: bookings.filter((b) => b.status === 'COMPLETED').length,
        pending: bookings.filter((b) => b.status === 'PENDING').length,
        upcoming: bookings.filter((b) => ['ACCEPTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETION_PENDING'].includes(b.status)).length,
        volume: bookings
            .filter((b) => b.escrow_status !== 'UNPAID')
            .reduce((s, b) => s + (user.role === 'PROVIDER' ? mine(b).reduce((s, i) => s + i.allocation, 0) : b.total), 0),
        held: bookings
            .filter((b) => ['HELD_IN_ESCROW', 'DISPUTED'].includes(b.escrow_status))
            .reduce((s, b) => s + mine(b).reduce((n, i) => n + i.allocation - i.platform_fee, 0), 0),
        released: bookings
            .filter((b) => b.escrow_status === 'RELEASED')
            .reduce((s, b) => s + mine(b).reduce((n, i) => n + i.allocation - i.platform_fee, 0), 0),
    };
}
export const scalar = async (sql: string) => Number(Object.values((await one<Row>(sql)) || { n: 0 })[0]);
