export const faqs = [
  {
    question: 'How do I book a service?',
    keywords: ['book', 'reserve', 'request'],
    answer:
      'Choose a service and package, pick your date, and send a booking request. After every provider accepts, open checkout and select Pay & Reserve. Your confirmed booking appears in My Bookings.',
  },
  {
    question: 'How do payments and escrow work?',
    keywords: ['payment', 'pay', 'escrow', 'money', 'gcash'],
    answer:
      'Phase 1 uses Development Payment Simulation. No real money is transferred. The mock payment stays in escrow until both verification gates are complete for every supplier. A dispute freezes release for administrator review.',
  },
  {
    question: 'Can I cancel or request a refund?',
    keywords: ['cancel', 'refund', 'dispute', 'no-show'],
    answer:
      'Before payment, open your booking and cancel with a reason. After payment, a cancellation or dispute freezes escrow. An administrator reviews the details and can refund the customer or release the agreed payment.',
  },
  {
    question: 'What does a Trusted Provider badge mean?',
    keywords: ['trust', 'badge', 'verified', 'verification'],
    answer:
      'Trusted status depends on review ratings, completed jobs, and unresolved disputes. The default is at least 4.5 stars and 5 completed jobs, with no open disputes. Paid VIP plans and Sponsored placements do not confer trust badges. Profile reviewed is a local administrative review, not legal identity verification.',
  },
  {
    question: 'How do I use a voucher?',
    keywords: ['voucher', 'discount', 'promo', 'welcome'],
    answer:
      'Enter a voucher code in the booking form and check your price. Minimum spend, dates, use limits, category, and customer rank apply. WELCOME10 is for the first paid booking. Codes reserved on an active request cannot be reused until that request is cancelled.',
  },
  {
    question: 'How do customer rewards work?',
    keywords: ['rank', 'reward', 'referral', 'loyalty', 'silver', 'gold'],
    answer:
      'Completed bookings grow your rank: Bronze starts at 0, Silver at 3, Gold at 8, and Platinum at 15 by default. Share your referral code from your profile. Both customers receive a voucher after the referred customer completes their first booking.',
  },
  {
    question: 'What is included in a curated bundle?',
    keywords: ['bundle', 'suppliers', 'package'],
    answer:
      'A bundle combines agreed packages from different providers in one booking. All suppliers must approve their participation before publication, be available on your date, and accept your request. Each supplier verifies their own service; escrow releases when everyone is complete.',
  },
  {
    question: 'When can I leave a review?',
    keywords: ['review', 'rating', 'stars'],
    answer:
      'After a booking is completed, open its details and review each supplier once. Your verified review updates the provider rating and badge eligibility.',
  },
  {
    question: 'How can I become a provider?',
    keywords: ['become', 'join', 'provider', 'supplier', 'listing'],
    answer:
      'Create an account and choose Service Provider. Complete your business profile, create a service, add a package, then publish it. Manage your dates in Availability. Provider Studio includes your requests, earnings, and bundle invitations.',
  },
  {
    question: 'How do the two verification gates work?',
    keywords: ['code', 'qr', 'gate', 'handshake', 'start', 'completion'],
    answer:
      'For Gate 1, the customer generates a check-in QR/code and the provider verifies it. For Gate 2, the provider generates a completion QR/code and the customer verifies it. Codes expire in 30 minutes and can be used once. Entering a code manually always works without a camera.',
  },
];
export function answerFaq(input: string) {
  const normalized = input.toLowerCase();
  return faqs
    .map((f) => ({ ...f, score: f.keywords.filter((k) => normalized.includes(k)).length }))
    .sort((a, b) => b.score - a.score)
    .find((f) => f.score > 0);
}
