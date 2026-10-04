import { mapAsync, everyAsync } from '@/lib/async';
import { all, one, settings, type Row } from './db';
import { recommendation } from '@/config/platform';
import { assert, badgeEligible, rankFor, type User } from '@/lib/domain';
import type { Booking, BookingItem, Bundle, BundleItem, Provider, Service, Review, Package, } from '@/types/models';
export async function available(providerId: string, date: string, exceptBooking = '') {
    return (!(await one("SELECT 1 FROM availability WHERE provider_id=? AND date=? AND status='UNAVAILABLE'", providerId, date)) &&
        !(await one('SELECT 1 FROM reservations WHERE provider_id=? AND date=? AND booking_id<>?', providerId, date, exceptBooking)));
}
export async function providerByUser(userId: string) {
    const row = (await one<{
        id: string;
    }>('SELECT id FROM providers WHERE user_id=?', userId));
    assert(row, 'Provider profile not found.', 404);
    return (await provider(row.id))!;
}
export async function provider(providerId: string): Promise<Provider | undefined> {
    return (await providers()).find((p) => p.id === providerId);
}
export async function providers(): Promise<Provider[]> {
    const result = (await all<Provider>(`SELECT p.*,u.status,c.name category_name,
    COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.provider_id=p.id),0) rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.provider_id=p.id) review_count,
    (SELECT COUNT(*) FROM booking_items i JOIN bookings b ON b.id=i.booking_id WHERE i.provider_id=p.id AND b.status='COMPLETED') completed,
    (SELECT COUNT(DISTINCT d.id) FROM disputes d JOIN booking_items i ON i.booking_id=d.booking_id WHERE i.provider_id=p.id AND d.status IN ('OPEN','UNDER_REVIEW')) disputes,
    EXISTS(SELECT 1 FROM subscriptions s WHERE s.provider_id=p.id AND s.tier='VIP' AND s.status='ACTIVE' AND s.starts_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')) vip,
    EXISTS(SELECT 1 FROM placements f WHERE f.provider_id=p.id AND f.status='ACTIVE' AND f.starts_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') AND f.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')) featured
    FROM providers p JOIN users u ON u.id=p.user_id JOIN categories c ON c.id=p.category_id`));
    const rules = (await settings());
    const badges = (await all<{
        provider_id: string;
        badge: string;
        granted: number;
    }>('SELECT * FROM provider_badges'));
    for (const p of result) {
        const has = (type: string) => {
            const override = badges.find((b) => b.provider_id === p.id && b.badge === type);
            return (badgeEligible(p.rating, p.completed, p.disputes, type, rules) &&
                (!override || !!override.granted));
        };
        p.trusted = has('TRUSTED');
        p.best = has('BEST_SERVICE');
    }
    return result;
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
export async function services(filters: Search = {}): Promise<Service[]> {
    const providerMap = new Map((await providers()).map((p) => [p.id, p]));
    const placed = new Set((await all<{
        provider_id: string;
    }>(`SELECT provider_id FROM placements WHERE placement=? AND status='ACTIVE' AND starts_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')`, filters.placement || (filters.category ? 'CATEGORY' : 'SEARCH'))).map((x) => x.provider_id));
    let result = (await mapAsync((await all<Service>(`SELECT s.*,c.name category_name FROM services s JOIN categories c ON c.id=s.category_id JOIN users u ON u.id=(SELECT user_id FROM providers p WHERE p.id=s.provider_id) WHERE s.status='ACTIVE' AND s.moderated=0 AND c.active=1 AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM packages k WHERE k.service_id=s.id AND k.active=1)`)), async (s) => {
        const p = providerMap.get(s.provider_id)!;
        const minimum = (await one<{
            price: number;
        }>('SELECT MIN(price) price FROM packages WHERE service_id=? AND active=1', s.id))!.price;
        return {
            ...s,
            base_price: minimum,
            business_name: p.business_name,
            rating: p.rating,
            review_count: p.review_count,
            completed: p.completed,
            vip: p.vip,
            featured: +placed.has(p.id),
            trusted: p.trusted,
            available: !filters.date || (await available(s.provider_id, filters.date)),
        };
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
    return (await services()).find((s) => s.id === serviceId);
}
export const packagesFor = async (serviceId: string) => (await all<Package>('SELECT * FROM packages WHERE service_id=? AND active=1 ORDER BY price', serviceId));
export async function bundles(date?: string, includeDraft = false): Promise<Bundle[]> {
    return (await mapAsync((await all<Bundle>(`SELECT * FROM bundles ${includeDraft ? '' : "WHERE status='PUBLISHED'"}`)), async (b) => {
        const items = (await all<BundleItem>(`SELECT i.*,p.business_name,p.user_id,k.name package_name,k.active package_active,s.title service_title,s.id service_id,s.category_id,s.status service_status,s.moderated,u.status provider_status,c.active category_active FROM bundle_items i JOIN providers p ON p.id=i.provider_id JOIN users u ON u.id=p.user_id JOIN packages k ON k.id=i.package_id JOIN services s ON s.id=k.service_id JOIN categories c ON c.id=s.category_id WHERE i.bundle_id=?`, b.id));
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
            available: ready && (!date || (await everyAsync(items, async (i) => (await available(i.provider_id, date))))),
        };
    }));
}
export const bookingItems = async (bookingId: string) => (await all<BookingItem>(`SELECT i.*,p.business_name,p.user_id provider_user_id,p.phone provider_phone,r.id review_id FROM booking_items i JOIN providers p ON p.id=i.provider_id LEFT JOIN reviews r ON r.booking_item_id=i.id WHERE i.booking_id=?`, bookingId));
export async function searchBundles(filters: Search = {}) {
    const teams = new Map((await providers()).map((p) => [p.id, p]));
    const keyword = filters.q?.trim().toLowerCase();
    const list = (await bundles(filters.date)).map((b) => {
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
    const ids = (await all<{
        id: string;
    }>(`SELECT DISTINCT b.id FROM bookings b LEFT JOIN booking_items i ON i.booking_id=b.id LEFT JOIN providers p ON p.id=i.provider_id WHERE (?='ADMIN' OR (?='CUSTOMER' AND b.customer_id=?) OR (?='PROVIDER' AND p.user_id=?)) ORDER BY b.created_at DESC`, user.role, user.role, user.id, user.role, user.id));
    return (await mapAsync(ids, async (b) => (await booking(b.id, user))));
}
export async function reviews(providerId?: string): Promise<Review[]> {
    return (await all<Review>(`SELECT r.*,u.name customer_name,s.title service_title,p.business_name FROM reviews r JOIN users u ON u.id=r.customer_id JOIN services s ON s.id=r.service_id JOIN providers p ON p.id=r.provider_id ${providerId ? 'WHERE r.provider_id=?' : ''} ORDER BY r.created_at DESC`, ...(providerId ? [providerId] : [])));
}
export async function customerStats(userId: string) {
    const row = (await one<{
        completed: number;
        spending: number;
    }>("SELECT COUNT(*) completed,COALESCE(SUM(total),0) spending FROM bookings WHERE customer_id=? AND status='COMPLETED'", userId))!;
    return { ...row, rank: rankFor(row.completed, (await settings())) };
}
export async function dashboardStats(user: User) {
    const bookings = (await bookingsFor(user));
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
