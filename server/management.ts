import { z } from 'zod';
import { all, one, run, insert, transaction, id, now, notify, audit, settings } from './db';
import { providerByUser, providers, bundles, booking } from './queries';
import { assert, requireRole, badgeEligible, type User } from '@/lib/domain';
import { eventDate } from './bookings';
import { defaults } from '@/config/platform';
import { money } from '@/lib/format';
const text = (min = 1, max = 200) => z.string().trim().min(min).max(max);
const cents = z.coerce
  .number()
  .min(0)
  .max(10000000)
  .transform((x) => Math.round(x * 100));
const imageUrl = z
  .string()
  .max(1000)
  .refine(
    (x) => !x || /^\/images\/[a-zA-Z0-9._/-]+$/.test(x) || /^https:\/\/[^\s]+$/.test(x),
    'Use an HTTPS image URL or an /images/ path.',
  );
export function updateProfile(user: User, input: unknown) {
  const data = z
    .object({
      name: text(2, 100),
      phone: z.string().max(40).default(''),
      email: z.email().max(200).optional(),
      businessName: text(2, 120).optional(),
      description: z.string().max(5000).optional(),
      categoryId: z.string().optional(),
      area: z.string().max(200).optional(),
      avatar: imageUrl.optional(),
      cover: imageUrl.optional(),
    })
    .parse(input);
  return transaction(() => {
    if (data.email)
      assert(
        !one('SELECT id FROM users WHERE email=? AND id<>?', data.email, user.id),
        'This email is already registered.',
      );
    run(
      'UPDATE users SET name=?,phone=?,email=? WHERE id=?',
      data.name,
      data.phone,
      data.email || user.email,
      user.id,
    );
    if (user.role === 'PROVIDER') {
      const p = providerByUser(user.id);
      assert(data.businessName && data.categoryId, 'Business name and category are required.');
      assert(
        one('SELECT id FROM categories WHERE id=? AND active=1', data.categoryId),
        'Choose an active category.',
      );
      run(
        'UPDATE providers SET business_name=?,description=?,phone=?,category_id=?,area=?,avatar=?,cover=? WHERE id=?',
        data.businessName,
        data.description || '',
        data.phone,
        data.categoryId,
        data.area || '',
        data.avatar || '',
        data.cover || '/images/event.jpg',
        p.id,
      );
    }
    return { message: 'Profile updated.' };
  });
}
export function saveService(user: User, input: unknown) {
  requireRole(user, 'PROVIDER');
  const data = z
    .object({
      id: z.string().optional(),
      title: text(3, 150),
      description: text(10, 6000),
      categoryId: text(),
      price: cents,
      duration: text(1, 100),
      unit: text(1, 60),
      minGuests: z.coerce.number().int().min(1).max(100000),
      maxGuests: z.coerce.number().int().min(1).max(100000),
      image: imageUrl,
      status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
    })
    .refine((d) => d.maxGuests >= d.minGuests, {
      path: ['maxGuests'],
      message: 'Maximum guests must be at least the minimum.',
    })
    .parse(input);
  return transaction(() => {
    const p = providerByUser(user.id);
    assert(
      one('SELECT id FROM categories WHERE id=? AND active=1', data.categoryId),
      'Choose an active category.',
    );
    if (data.id) {
      assert(
        one('SELECT id FROM services WHERE id=? AND provider_id=?', data.id, p.id),
        'Service not found.',
        404,
      );
      if (data.status === 'ACTIVE')
        assert(
          one('SELECT id FROM packages WHERE service_id=? AND active=1', data.id),
          'Add an active package before publishing.',
        );
      run(
        'UPDATE services SET title=?,description=?,category_id=?,base_price=?,duration=?,unit=?,min_guests=?,max_guests=?,image=?,status=? WHERE id=?',
        data.title,
        data.description,
        data.categoryId,
        data.price,
        data.duration,
        data.unit,
        data.minGuests,
        data.maxGuests,
        data.image || '/images/event.jpg',
        data.status,
        data.id,
      );
      return { message: 'Service updated.' };
    }
    const serviceId = id();
    insert('services', {
      id: serviceId,
      provider_id: p.id,
      title: data.title,
      description: data.description,
      category_id: data.categoryId,
      base_price: data.price,
      duration: data.duration,
      unit: data.unit,
      min_guests: data.minGuests,
      max_guests: data.maxGuests,
      image: data.image || '/images/event.jpg',
      status: 'DRAFT',
    });
    return {
      message: 'Draft created. Add a package, then publish.',
      redirect: `/provider/services/${serviceId}`,
    };
  });
}
export function savePackage(user: User, input: unknown) {
  requireRole(user, 'PROVIDER');
  const data = z
    .object({
      id: z.string().optional(),
      serviceId: text(),
      name: text(2, 100),
      description: z.string().max(3000).default(''),
      price: cents.refine((x) => x > 0, 'Price must be greater than zero.'),
      inclusions: text(3, 4000),
      exclusions: z.string().max(2000).default(''),
      duration: text(1, 100),
      terms: z.string().max(2000).default(''),
      active: z.coerce.number().int().min(0).max(1).default(1),
    })
    .parse(input);
  return transaction(() => {
    const p = providerByUser(user.id);
    assert(
      one('SELECT id FROM services WHERE id=? AND provider_id=?', data.serviceId, p.id),
      'Service not found.',
      404,
    );
    if (data.id) {
      assert(
        one('SELECT id FROM packages WHERE id=? AND service_id=?', data.id, data.serviceId),
        'Package not found.',
        404,
      );
      run(
        'UPDATE packages SET name=?,description=?,price=?,inclusions=?,exclusions=?,duration=?,terms=?,active=? WHERE id=?',
        data.name,
        data.description,
        data.price,
        data.inclusions,
        data.exclusions,
        data.duration,
        data.terms,
        data.active,
        data.id,
      );
    } else
      insert('packages', {
        id: id(),
        service_id: data.serviceId,
        name: data.name,
        description: data.description,
        price: data.price,
        inclusions: data.inclusions,
        exclusions: data.exclusions,
        duration: data.duration,
        terms: data.terms,
        active: data.active,
      });
    return { message: 'Package saved. Existing bookings keep their agreed price and terms.' };
  });
}
export function saveAddon(user: User, input: unknown) {
  requireRole(user, 'PROVIDER');
  const data = z.object({ serviceId: text(), name: text(2, 100), price: cents }).parse(input);
  const p = providerByUser(user.id);
  assert(
    one('SELECT id FROM services WHERE id=? AND provider_id=?', data.serviceId, p.id),
    'Service not found.',
    404,
  );
  insert('addons', { id: id(), service_id: data.serviceId, name: data.name, price: data.price });
  return { message: 'Add-on added.' };
}
export function removeAddon(user: User, addonId: string) {
  requireRole(user, 'PROVIDER');
  const p = providerByUser(user.id);
  assert(
    one(
      'SELECT a.id FROM addons a JOIN services s ON s.id=a.service_id WHERE a.id=? AND s.provider_id=?',
      addonId,
      p.id,
    ),
    'Add-on not found.',
    404,
  );
  run('UPDATE addons SET active=0 WHERE id=?', addonId);
  return { message: 'Add-on archived.' };
}
export function setAvailability(user: User, input: unknown) {
  requireRole(user, 'PROVIDER');
  const data = z
    .object({
      date: eventDate,
      status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
      note: z.string().max(300).default(''),
    })
    .parse(input);
  return transaction(() => {
    const p = providerByUser(user.id);
    assert(
      !one('SELECT 1 FROM reservations WHERE provider_id=? AND date=?', p.id, data.date),
      'This date has a reserved booking. Cancel through the booking flow before changing it.',
    );
    run(
      'INSERT INTO availability(provider_id,date,status,note) VALUES(?,?,?,?) ON CONFLICT(provider_id,date) DO UPDATE SET status=excluded.status,note=excluded.note',
      p.id,
      data.date,
      data.status,
      data.note,
    );
    return { message: `Availability updated for ${data.date}.` };
  });
}
export function portfolioAction(user: User, input: unknown) {
  requireRole(user, 'PROVIDER');
  const data = z
    .object({
      id: z.string().optional(),
      image: imageUrl.optional(),
      caption: z.string().max(200).default(''),
    })
    .parse(input);
  const p = providerByUser(user.id);
  if (data.id) run('DELETE FROM portfolio WHERE id=? AND provider_id=?', data.id, p.id);
  else {
    assert(data.image, 'Choose an image URL.');
    const n = one<{ n: number }>('SELECT COUNT(*) n FROM portfolio WHERE provider_id=?', p.id)!.n;
    assert(n < (p.vip ? 30 : 8), 'Your plan portfolio limit has been reached.');
    insert('portfolio', { id: id(), provider_id: p.id, image: data.image, caption: data.caption });
  }
  return { message: 'Portfolio updated.' };
}
export function saveBundle(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z
    .object({
      id: z.string().optional(),
      name: text(3, 150),
      description: text(10, 5000),
      image: imageUrl,
      discount: z.coerce.number().int().min(0).max(50),
    })
    .parse(input);
  return transaction(() => {
    const bundleId = data.id || id();
    if (data.id) {
      assert(one('SELECT id FROM bundles WHERE id=?', data.id), 'Bundle not found.');
      run(
        "UPDATE bundles SET name=?,description=?,image=?,discount_percent=?,status='DRAFT' WHERE id=?",
        data.name,
        data.description,
        data.image || '/images/event.jpg',
        data.discount,
        data.id,
      );
      run(
        "UPDATE bundle_items SET approval='PENDING',responded_at=NULL WHERE bundle_id=?",
        bundleId,
      );
      for (const item of all<{ user_id: string }>(
        'SELECT p.user_id FROM bundle_items i JOIN providers p ON p.id=i.provider_id WHERE i.bundle_id=?',
        bundleId,
      ))
        notify(
          item.user_id,
          'Bundle terms changed',
          'Review the updated bundle discount and participation terms.',
          '/provider/bundles',
        );
    } else
      insert('bundles', {
        id: bundleId,
        name: data.name,
        description: data.description,
        image: data.image || '/images/event.jpg',
        discount_percent: data.discount,
      });
    audit(user.id, 'Bundle draft saved', bundleId);
    return {
      message: 'Bundle saved as draft. Supplier approvals are required.',
      redirect: `/admin/bundles/${bundleId}`,
    };
  });
}
export function addBundleItem(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z
    .object({
      bundleId: text(),
      packageId: text(),
      price: cents.refine((x) => x > 0),
      terms: z.string().max(2000).default(''),
    })
    .parse(input);
  return transaction(() => {
    const b = one<{ status: string }>('SELECT status FROM bundles WHERE id=?', data.bundleId);
    assert(b?.status === 'DRAFT', 'Only draft bundles can be changed.');
    const pack = one<{
      provider_id: string;
      user_id: string;
      inclusions: string;
      exclusions: string;
    }>(
      'SELECT s.provider_id,p.user_id,k.inclusions,k.exclusions FROM packages k JOIN services s ON s.id=k.service_id JOIN providers p ON p.id=s.provider_id WHERE k.id=? AND k.active=1',
      data.packageId,
    );
    assert(pack, 'Package not found.');
    assert(
      !one(
        'SELECT id FROM bundle_items WHERE bundle_id=? AND provider_id=?',
        data.bundleId,
        pack.provider_id,
      ),
      'Each bundle must use different providers.',
    );
    insert('bundle_items', {
      id: id(),
      bundle_id: data.bundleId,
      provider_id: pack.provider_id,
      package_id: data.packageId,
      price: data.price,
      inclusions: pack.inclusions,
      exclusions: pack.exclusions,
      terms: data.terms,
    });
    notify(
      pack.user_id,
      'You have a bundle invitation',
      'Review your package terms and approve or decline.',
      '/provider/bundles',
    );
    return { message: 'Provider invited. Approval is required before publication.' };
  });
}
export function removeBundleItem(user: User, itemId: string) {
  requireRole(user, 'ADMIN');
  const item = one<{ bundle_id: string }>('SELECT bundle_id FROM bundle_items WHERE id=?', itemId);
  assert(item, 'Bundle item not found.');
  assert(
    one("SELECT id FROM bundles WHERE id=? AND status='DRAFT'", item.bundle_id),
    'Unpublish the bundle before removing a supplier.',
  );
  run('DELETE FROM bundle_items WHERE id=?', itemId);
  return { message: 'Supplier removed from draft.' };
}
export function respondBundle(user: User, input: unknown) {
  requireRole(user, 'PROVIDER');
  const data = z
    .object({
      itemId: text(),
      approval: z.enum(['ACCEPTED', 'REJECTED']),
      price: cents.refine((x) => x > 0),
      inclusions: text(3, 4000),
      exclusions: z.string().max(2000).default(''),
      terms: z.string().max(2000).default(''),
    })
    .parse(input);
  return transaction(() => {
    const p = providerByUser(user.id);
    const item = one<{ bundle_id: string }>(
      'SELECT bundle_id FROM bundle_items WHERE id=? AND provider_id=?',
      data.itemId,
      p.id,
    );
    assert(item, 'Invitation not found.', 404);
    run(
      'UPDATE bundle_items SET approval=?,price=?,inclusions=?,exclusions=?,terms=?,responded_at=? WHERE id=?',
      data.approval,
      data.price,
      data.inclusions,
      data.exclusions,
      data.terms,
      now(),
      data.itemId,
    );
    run("UPDATE bundles SET status='DRAFT' WHERE id=?", item.bundle_id);
    return {
      message:
        'Participation terms saved. The administrator can publish after all suppliers approve.',
    };
  });
}
export function bundleStatus(user: User, bundleId: string, status: string) {
  requireRole(user, 'ADMIN');
  assert(['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status), 'Invalid bundle status.');
  return transaction(() => {
    const b = bundles(undefined, true).find((b) => b.id === bundleId);
    assert(b, 'Bundle not found.');
    if (status === 'PUBLISHED')
      assert(b.ready, 'All suppliers must approve, and their packages must be active.');
    run('UPDATE bundles SET status=? WHERE id=?', status, bundleId);
    audit(user.id, `Bundle ${status}`, bundleId);
    return { message: `Bundle ${status.toLowerCase()}.` };
  });
}
export function subscription(user: User, input: unknown) {
  const data = z
    .object({
      providerId: z.string().optional(),
      tier: z.enum(['CLASSIC', 'VIP']),
      confirmed: z.union([z.boolean(), z.string()]).optional(),
    })
    .parse(input);
  requireRole(user, 'ADMIN', 'PROVIDER');
  assert(
    data.confirmed === true || data.confirmed === 'on',
    'Confirm the simulated subscription change.',
  );
  return transaction(() => {
    const p =
      user.role === 'PROVIDER'
        ? providerByUser(user.id)
        : providers().find((p) => p.id === data.providerId);
    assert(p, 'Provider not found.');
    run(
      "UPDATE subscriptions SET status='CANCELLED' WHERE provider_id=? AND status='ACTIVE'",
      p.id,
    );
    const paymentId = id();
    insert('payments', {
      id: paymentId,
      user_id: user.id,
      amount: data.tier === 'VIP' ? Math.round(settings().vipPrice * 100) : 0,
      purpose: `Development ${data.tier} subscription for ${p.business_name}`,
    });
    insert('subscriptions', {
      id: id(),
      provider_id: p.id,
      tier: data.tier,
      starts_at: now(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      payment_id: paymentId,
    });
    notify(
      p.user_id,
      'Subscription updated',
      `${data.tier} plan is active for 30 days.`,
      '/provider/subscription',
    );
    audit(user.id, 'Subscription changed', p.id, data.tier);
    return { message: `${data.tier} plan activated through development checkout.` };
  });
}
export function placement(user: User, input: unknown) {
  requireRole(user, 'ADMIN', 'PROVIDER');
  const data = z
    .object({
      providerId: z.string().optional(),
      placement: z.enum(['HOMEPAGE', 'CATEGORY', 'SEARCH']),
      days: z.coerce.number().refine((n) => [3, 7, 30].includes(n)),
      start: eventDate.optional(),
      confirmed: z.union([z.boolean(), z.string()]).optional(),
    })
    .parse(input);
  assert(
    data.confirmed === true || data.confirmed === 'on',
    'Confirm the simulated placement purchase.',
  );
  return transaction(() => {
    const p =
      user.role === 'PROVIDER'
        ? providerByUser(user.id)
        : providers().find((p) => p.id === data.providerId);
    assert(p, 'Provider not found.');
    const start = data.start ? new Date(`${data.start}T00:00:00+08:00`) : new Date();
    const end = new Date(start.getTime() + data.days * 86400000);
    assert(end.getTime() > Date.now(), 'The placement must end in the future.');
    const paymentId = id();
    const s = settings();
    insert('payments', {
      id: paymentId,
      user_id: user.id,
      amount: Math.round(
        data.days * s.featuredDaily * 100 * (p.vip ? 1 - s.vipFeaturedDiscount / 100 : 1),
      ),
      purpose: `Development ${data.placement} placement for ${p.business_name}`,
    });
    insert('placements', {
      id: id(),
      provider_id: p.id,
      placement: data.placement,
      starts_at: start.toISOString(),
      expires_at: end.toISOString(),
      payment_id: paymentId,
    });
    audit(user.id, 'Featured placement purchased', p.id, data.placement);
    return { message: 'Featured placement saved. Paid results are labeled Sponsored.' };
  });
}
export function saveVoucher(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z
    .object({
      id: z.string().optional(),
      code: text(3, 40)
        .transform((s) => s.toUpperCase())
        .refine((s) => /^[A-Z0-9-]+$/.test(s), 'Use letters, numbers, and hyphens.'),
      description: text(5, 500),
      type: z.enum(['FIXED', 'PERCENTAGE']),
      value: z.coerce.number().positive().max(1000000),
      minSpend: cents,
      maxDiscount: cents,
      validFrom: eventDate,
      expiresAt: eventDate,
      usageLimit: z.coerce.number().int().min(1).max(1000000),
      perUserLimit: z.coerce.number().int().min(1).max(100),
      rankRequired: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']),
      firstOnly: z.coerce.number().int().min(0).max(1),
      categoryId: z.string().default(''),
      active: z.coerce.number().int().min(0).max(1),
    })
    .refine((d) => d.expiresAt > d.validFrom, {
      path: ['expiresAt'],
      message: 'Expiry must be after the start date.',
    })
    .refine((d) => d.type !== 'PERCENTAGE' || d.value <= 100, {
      path: ['value'],
      message: 'Percentage cannot exceed 100.',
    })
    .parse(input);
  return transaction(() => {
    if (data.categoryId)
      assert(one('SELECT id FROM categories WHERE id=?', data.categoryId), 'Category not found.');
    assert(
      !one('SELECT id FROM vouchers WHERE code=? AND id<>?', data.code, data.id || ''),
      'That voucher code already exists.',
    );
    const values = {
      code: data.code,
      description: data.description,
      type: data.type,
      value: data.type === 'FIXED' ? Math.round(data.value * 100) : data.value,
      min_spend: data.minSpend,
      max_discount: data.maxDiscount,
      valid_from: new Date(`${data.validFrom}T00:00:00+08:00`).toISOString(),
      expires_at: new Date(`${data.expiresAt}T23:59:59+08:00`).toISOString(),
      usage_limit: data.usageLimit,
      per_user_limit: data.perUserLimit,
      rank_required: data.rankRequired,
      first_only: data.firstOnly,
      category_id: data.categoryId || null,
      active: data.active,
    };
    if (data.id) {
      assert(one('SELECT id FROM vouchers WHERE id=?', data.id), 'Voucher not found.');
      const keys = Object.keys(values);
      run(
        `UPDATE vouchers SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`,
        ...Object.values(values),
        data.id,
      );
    } else insert('vouchers', { id: id(), ...values });
    audit(user.id, 'Voucher saved', data.code);
    return { message: 'Voucher saved.', redirect: '/admin/vouchers' };
  });
}
export function saveCategory(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z
    .object({
      id: z.string().optional(),
      name: text(2, 80),
      active: z.coerce.number().int().min(0).max(1),
    })
    .parse(input);
  assert(
    !one(
      'SELECT id FROM categories WHERE lower(name)=lower(?) AND id<>?',
      data.name,
      data.id || '',
    ),
    'Category already exists.',
  );
  if (data.id)
    run('UPDATE categories SET name=?,active=? WHERE id=?', data.name, data.active, data.id);
  else insert('categories', { id: id(), name: data.name, active: data.active });
  return { message: 'Category saved.' };
}
export function adminUser(user: User, target: string, status: string) {
  requireRole(user, 'ADMIN');
  assert(['ACTIVE', 'SUSPENDED'].includes(status), 'Invalid account status.');
  assert(target !== user.id, 'You cannot suspend your own account.');
  assert(
    one("SELECT id FROM users WHERE id=? AND role<>'ADMIN'", target),
    'Only customer and provider accounts can be managed here.',
  );
  return transaction(() => {
    run('UPDATE users SET status=? WHERE id=?', status, target);
    if (status === 'SUSPENDED') run('DELETE FROM sessions WHERE user_id=?', target);
    audit(user.id, `Account ${status}`, target);
    return { message: 'Account status updated.' };
  });
}
export function adminProvider(user: User, providerId: string, verified: number) {
  requireRole(user, 'ADMIN');
  assert([0, 1].includes(verified), 'Invalid verification status.');
  run('UPDATE providers SET verified=? WHERE id=?', verified, providerId);
  audit(user.id, 'Provider verification changed', providerId, String(verified));
  return {
    message:
      'Provider verification updated. This is a local profile review, not identity verification.',
  };
}
export function adminService(user: User, serviceId: string, disabled: number) {
  requireRole(user, 'ADMIN');
  assert([0, 1].includes(disabled), 'Invalid moderation status.');
  run('UPDATE services SET moderated=? WHERE id=?', disabled, serviceId);
  audit(user.id, 'Service moderation', serviceId, String(disabled));
  return { message: 'Listing moderation updated.' };
}
export function grantBadge(user: User, providerId: string, badge: string, granted: number) {
  requireRole(user, 'ADMIN');
  assert(
    ['TRUSTED', 'BEST_SERVICE'].includes(badge) && [0, 1].includes(granted),
    'Invalid badge action.',
  );
  const p = providers().find((p) => p.id === providerId);
  assert(p, 'Provider not found.');
  if (granted)
    assert(
      badgeEligible(p.rating, p.completed, p.disputes, badge, settings()),
      'This provider does not meet the configured eligibility rules.',
    );
  run(
    'INSERT INTO provider_badges(provider_id,badge,granted,admin_id) VALUES(?,?,?,?) ON CONFLICT(provider_id,badge) DO UPDATE SET granted=excluded.granted,admin_id=excluded.admin_id',
    providerId,
    badge,
    granted,
    user.id,
  );
  audit(user.id, 'Badge changed', providerId, `${badge}: ${granted}`);
  return { message: 'Badge decision saved.' };
}
export function saveSettings(user: User, input: Record<string, unknown>) {
  requireRole(user, 'ADMIN');
  const next = { ...settings() };
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    if (input[key] !== undefined)
      next[key] = z.coerce.number().min(0).max(1000000).parse(input[key]);
  }
  assert(
    next.platformFee <= 30 &&
      next.welcomePercent > 0 &&
      next.welcomePercent <= 100 &&
      next.vipFeaturedDiscount <= 100,
    'Check percentage settings. Platform fee must be 0–30%.',
  );
  assert(next.trustedRating <= 5 && next.bestRating <= 5, 'Ratings must be 0–5.');
  assert(
    next.silver > 0 && next.gold > next.silver && next.platinum > next.gold,
    'Rank thresholds must increase from Silver to Platinum.',
  );
  for (const key of ['silver', 'gold', 'platinum', 'trustedJobs', 'bestJobs'] as const)
    assert(Number.isInteger(next[key]), 'Booking and job thresholds must be whole numbers.');
  return transaction(() => {
    for (const [key, value] of Object.entries(next))
      run(
        'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        key,
        value,
      );
    run(
      "UPDATE vouchers SET value=?,max_discount=?,min_spend=?,description=? WHERE code='WELCOME10'",
      next.welcomePercent,
      Math.round(next.welcomeCap * 100),
      Math.round(next.welcomeMin * 100),
      `A warm welcome to your first celebration. ${next.welcomePercent}% off, up to ${money(next.welcomeCap * 100)}.`,
    );
    audit(user.id, 'Platform settings updated', 'settings', JSON.stringify(next));
    return { message: 'Platform rules saved. New quotes use the updated fee.' };
  });
}
export function createTicket(user: User, input: unknown) {
  const data = z
    .object({ subject: text(3, 150), message: text(10, 5000), bookingId: z.string().default('') })
    .parse(input);
  if (data.bookingId) booking(data.bookingId, user);
  insert('support_tickets', {
    id: id(),
    user_id: user.id,
    booking_id: data.bookingId || null,
    subject: data.subject,
    message: data.message,
  });
  for (const a of all<{ id: string }>("SELECT id FROM users WHERE role='ADMIN'"))
    notify(a.id, 'New support request', data.subject, '/admin/support');
  return {
    message: 'Support ticket created. Responses will appear here and in your notifications.',
  };
}
export function respondTicket(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z
    .object({
      id: text(),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
      response: text(3, 5000),
    })
    .parse(input);
  const ticket = one<{ user_id: string; subject: string }>(
    'SELECT * FROM support_tickets WHERE id=?',
    data.id,
  );
  assert(ticket, 'Ticket not found.');
  return transaction(() => {
    run(
      'UPDATE support_tickets SET status=?,response=? WHERE id=?',
      data.status,
      data.response,
      data.id,
    );
    notify(ticket.user_id, 'Support replied', ticket.subject, '/support');
    audit(user.id, 'Support ticket replied', data.id);
    return { message: 'Response sent through in-app support.' };
  });
}
