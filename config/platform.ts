export const platform = {
  name: 'Soiree Source',
  currency: 'PHP',
  locale: 'en-PH',
  timezone: 'Asia/Manila',
};
export const CURRENT_TERMS_VERSION = '2026-10-05';
export const recommendation = { featured: 100, vip: 20, rating: 5, completed: 1, completedCap: 20 };
export const defaults = {
  platformFee: 5,
  trustedRating: 4.5,
  trustedJobs: 5,
  bestRating: 4.7,
  bestJobs: 10,
  silver: 3,
  gold: 8,
  platinum: 15,
  welcomePercent: 10,
  welcomeCap: 1500,
  welcomeMin: 3000,
  referralReward: 500,
  vipPrice: 999,
  featuredDaily: 150,
  vipFeaturedDiscount: 20,
};
export const settingLabels: Record<keyof typeof defaults, string> = {
  platformFee: 'Platform fee (%)',
  trustedRating: 'Trusted minimum rating',
  trustedJobs: 'Trusted completed jobs',
  bestRating: 'Best Service minimum rating',
  bestJobs: 'Best Service completed jobs',
  silver: 'Silver completed bookings',
  gold: 'Gold completed bookings',
  platinum: 'Platinum completed bookings',
  welcomePercent: 'Welcome discount (%)',
  welcomeCap: 'Welcome discount cap (PHP)',
  welcomeMin: 'Welcome minimum spend (PHP)',
  referralReward: 'Referral voucher (PHP)',
  vipPrice: 'VIP monthly price (PHP)',
  featuredDaily: 'Featured daily price (PHP)',
  vipFeaturedDiscount: 'VIP featured discount (%)',
};
