import { forEachAsync } from '@/lib/async';
import { insert, id, one, transaction, now, notify, run } from '@/server/db';
import { hashPassword } from '@/server/security';
import { defaults } from '@/config/platform';
import { today } from '@/lib/format';
export const DEMO_PASSWORD = 'DemoPass!2026';
export const day = (offset: number) => new Date(new Date(`${today()}T12:00:00Z`).getTime() + offset * 86400000)
    .toISOString()
    .slice(0, 10);
export async function seed() {
    if ((await one('SELECT id FROM users LIMIT 1')))
        return false;
    return (await transaction(async () => {
        const password_hash = hashPassword(DEMO_PASSWORD);
        (await insert('users', {
            id: 'admin-demo',
            name: 'Mika Reyes',
            email: 'admin@demo.local',
            password_hash,
            role: 'ADMIN',
            phone: '0917 000 1000',
        }));
        (await forEachAsync(['Sofia Cruz', 'Miguel Santos', 'Isabel Ramos'], async (name, i) => (await insert('users', {
            id: `customer-${i}`,
            name,
            email: i === 0 ? 'customer@demo.local' : `customer${i + 1}@demo.local`,
            password_hash,
            role: 'CUSTOMER',
            phone: `0917 000 200${i}`,
            referral_code: `CELEBRATE${i + 1}`,
        }))));
        const categories = [
            ['catering', 'Catering', 'Utensils'],
            ['hosts', 'Event Hosts', 'Mic'],
            ['design', 'Event Design', 'Flower2'],
            ['photography', 'Photography', 'Camera'],
            ['makeup', 'Hair & Makeup', 'Brush'],
            ['bars', 'Pop-up Bars', 'Wine'],
            ['performers', 'Performers', 'Music2'],
            ['planning', 'Wedding Planning', 'Heart'],
            ['venues', 'Venues', 'Building2'],
            ['other', 'Other Services', 'Sparkles'],
        ];
        for (const [id, name, icon] of categories)
            (await insert('categories', { id, name, icon }));
        const data = [
            [
                'Luna Lens Photography',
                'photography',
                'Quezon City & Metro Manila',
                'photography.jpg',
                8000,
                'Wedding stories, beautifully told',
                'Portraits for every milestone',
            ],
            [
                'Golden Table Catering',
                'catering',
                'Makati & Metro Manila',
                'catering.jpg',
                28000,
                'A feast worth gathering for',
                'Intimate celebrations, exceptional food',
            ],
            [
                'Northstar Event Hosting',
                'hosts',
                'Metro Manila & Cavite',
                'event.jpg',
                7000,
                'Your celebration, a little brighter',
                'Corporate events with personality',
            ],
            [
                'Petal & Pine Events',
                'design',
                'Taguig & Metro Manila',
                'decor.jpg',
                18000,
                'Thoughtfully styled celebrations',
                'Florals that set the scene',
            ],
            [
                'Velvet Glow Makeup',
                'makeup',
                'Pasig & Metro Manila',
                'makeup.jpg',
                6000,
                'Your most radiant moment',
                'Beautiful looks for your whole party',
            ],
            [
                'After Hours Mobile Bar',
                'bars',
                'Metro Manila & Laguna',
                'bar.jpg',
                14000,
                'Good company, great cocktails',
                'A toast to your next chapter',
            ],
            [
                'Serenade Live Performers',
                'performers',
                'Quezon City & Rizal',
                'event.jpg',
                12000,
                'The soundtrack to your celebration',
                'Acoustic moments, lasting memories',
            ],
            [
                'Ever After Wedding Planning',
                'planning',
                'Metro Manila & Tagaytay',
                'decor.jpg',
                25000,
                'Your day, thoughtfully planned',
                'Relax. We have the details covered.',
            ],
            [
                'The Glasshouse Garden',
                'venues',
                'Antipolo, Rizal',
                'venue.jpg',
                35000,
                'A garden made for gathering',
                'An intimate space for big moments',
            ],
            [
                'Little Joys Event Studio',
                'other',
                'Metro Manila',
                'event.jpg',
                4500,
                'Playful details for happy occasions',
                'Keepsakes your guests will love',
            ],
        ] as const;
        (await forEachAsync(data, async ([business_name, category_id, area, image, base, title, second], i) => {
            const userId = `provider-user-${i}`, providerId = `provider-${i}`;
            (await insert('users', {
                id: userId,
                name: [
                    'Marco Dela Cruz',
                    'Ana Navarro',
                    'Paolo Reyes',
                    'Nina Flores',
                    'Bea Castillo',
                    'Rafael Lim',
                    'Carlo Mendoza',
                    'Elena Bautista',
                    'Jules Garcia',
                    'Toni Reyes',
                ][i],
                email: i === 0 ? 'provider@demo.local' : `provider${i + 1}@demo.local`,
                password_hash,
                role: 'PROVIDER',
                phone: `0918 000 300${i}`,
            }));
            (await insert('providers', {
                id: providerId,
                user_id: userId,
                business_name,
                category_id,
                area,
                cover: `/images/${image}`,
                phone: `0918 000 300${i}`,
                description: `We're ${business_name}, a small team with a big love for meaningful celebrations. From intimate gatherings to once-in-a-lifetime occasions, we bring a thoughtful approach, clear communication, and a little extra care to every detail. Serving ${area}.`,
                verified: i < 7 ? 1 : 0,
            }));
            for (let j = 0; j < 2; j++) {
                const serviceId = `service-${i}-${j}`;
                (await insert('services', {
                    id: serviceId,
                    provider_id: providerId,
                    category_id,
                    title: j === 0 ? title : second,
                    description: `Make room for the moments that matter. Our ${j === 0 ? 'signature' : 'intimate'} ${categories.find((c) => c[0] === category_id)![1].toLowerCase()} service brings together thoughtful planning and personal attention. We work with you before the event to understand your vision, prepare every detail, and help your celebration feel effortless. A dedicated coordinator is included from your first conversation.`,
                    base_price: base * 100,
                    unit: 'event',
                    duration: '4 hours',
                    min_guests: 1,
                    max_guests: 500,
                    image: `/images/${image}`,
                    status: 'ACTIVE',
                }));
                (await forEachAsync(['Essential', 'Signature', 'Premium'], async (name, k) => (await insert('packages', {
                    id: `package-${i}-${j}-${k}`,
                    service_id: serviceId,
                    name,
                    description: [
                        'Everything you need for a beautiful start.',
                        'Our most-loved package, with room for the little extras.',
                        'A complete experience with our fullest attention.',
                    ][k],
                    price: Math.round(base * (1 + k * 0.5)) * 100,
                    inclusions: `${4 + k * 2} hours of service\nPre-event consultation\nDedicated event professional\n${k > 0 ? 'Personalized planning session' : 'Standard event coverage'}\n${k === 2 ? 'Premium finishing touches' : 'Travel within Metro Manila'}`,
                    exclusions: 'Out-of-town travel; overtime beyond the selected duration.',
                    duration: `${4 + k * 2} hours`,
                    terms: 'Final details agreed 7 days before the event. Venue permits are arranged by the customer.',
                }))));
                (await insert('addons', {
                    id: `addon-${i}-${j}`,
                    service_id: serviceId,
                    name: 'One extra hour',
                    price: 150000,
                }));
            }
            (await insert('portfolio', {
                id: id(),
                provider_id: providerId,
                image: `/images/${image}`,
                caption: 'A glimpse of our celebration style — development portfolio',
            }));
            (await insert('availability', {
                provider_id: providerId,
                date: day(10 + i),
                status: 'UNAVAILABLE',
                note: 'Team preparation day',
            }));
            if (i < 3)
                (await insert('subscriptions', {
                    id: id(),
                    provider_id: providerId,
                    tier: 'VIP',
                    starts_at: new Date(Date.now() - 86400000).toISOString(),
                    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
                }));
        }));
        for (const placement of ['HOMEPAGE', 'CATEGORY', 'SEARCH'])
            (await insert('placements', {
                id: id(),
                provider_id: placement === 'HOMEPAGE' ? 'provider-1' : 'provider-0',
                placement,
                starts_at: new Date(Date.now() - 86400000).toISOString(),
                expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            }));
        (await insert('bundles', {
            id: 'bundle-wedding',
            name: 'The intimate wedding edit',
            description: 'The people who bring your day together. Photography, bridal beauty, and thoughtful styling — coordinated in one simple booking.',
            image: '/images/decor.jpg',
            discount_percent: 8,
            status: 'PUBLISHED',
        }));
        (await forEachAsync([0, 4, 3], async (i) => (await insert('bundle_items', {
            id: `bundle-item-${i}`,
            bundle_id: 'bundle-wedding',
            provider_id: `provider-${i}`,
            package_id: `package-${i}-0-1`,
            price: Math.round(data[i][4] * 1.5) * 100,
            inclusions: 'Signature package inclusions\nShared event planning consultation',
            exclusions: 'Out-of-town travel and overtime.',
            terms: 'Supplier agrees to the displayed 8% bundle discount, voucher allocation, and platform fee.',
            approval: 'ACCEPTED',
            responded_at: now(),
        }))));
        (await insert('bundles', {
            id: 'bundle-party',
            name: 'A reason to celebrate',
            description: 'Good food, great music, and someone to keep the evening flowing. A complete party team for your next milestone.',
            image: '/images/catering.jpg',
            discount_percent: 5,
            status: 'DRAFT',
        }));
        (await forEachAsync([1, 2, 6], async (i) => (await insert('bundle_items', {
            id: `party-item-${i}`,
            bundle_id: 'bundle-party',
            provider_id: `provider-${i}`,
            package_id: `package-${i}-0-0`,
            price: data[i][4] * 100,
            inclusions: 'Essential package inclusions',
            terms: 'Includes a 5% bundle discount before the platform fee.',
            approval: i === 1 ? 'PENDING' : 'ACCEPTED',
        }))));
        const valid_from = new Date(Date.now() - 30 * 86400000).toISOString(), expires_at = new Date(Date.now() + 365 * 86400000).toISOString();
        (await insert('vouchers', {
            id: 'welcome-voucher',
            code: 'WELCOME10',
            description: 'A warm welcome to your first celebration. 10% off, up to ₱1,500.',
            type: 'PERCENTAGE',
            value: 10,
            min_spend: 300000,
            max_discount: 150000,
            valid_from,
            expires_at,
            usage_limit: 10000,
            first_only: 1,
        }));
        (await insert('vouchers', {
            id: 'seasonal-voucher',
            code: 'CELEBRATE500',
            description: 'A little extra joy for your next gathering. ₱500 off bookings from ₱5,000.',
            type: 'FIXED',
            value: 50000,
            min_spend: 500000,
            valid_from,
            expires_at,
            usage_limit: 1000,
        }));
        (await insert('vouchers', {
            id: 'gold-voucher',
            code: 'GOLD1500',
            description: 'A thank-you for our Gold and Platinum members.',
            type: 'FIXED',
            value: 150000,
            min_spend: 1500000,
            valid_from,
            expires_at,
            rank_required: 'GOLD',
        }));
        for (let i = 0; i < 3; i++)
            (await insert('voucher_wallet', { user_id: `customer-${i}`, voucher_id: 'welcome-voucher' }));
        const seedBooking = async (providerIndex: number, customerIndex: number, offset: number, status: string, suffix: string) => {
            const bookingId = `demo-${suffix}`, itemId = `item-${suffix}`, price = data[providerIndex][4] * 100, fee = Math.round(price * 0.05), providerId = `provider-${providerIndex}`, customerId = `customer-${customerIndex}`;
            const escrow = ['PENDING', 'ACCEPTED', 'CANCELLED'].includes(status)
                ? 'UNPAID'
                : status === 'COMPLETED'
                    ? 'RELEASED'
                    : status === 'DISPUTED'
                        ? 'DISPUTED'
                        : 'HELD_IN_ESCROW';
            (await insert('bookings', {
                id: bookingId,
                customer_id: customerId,
                title: data[providerIndex][5],
                event_date: day(offset),
                event_type: 'Birthday celebration',
                location: 'The Courtyard, Quezon City',
                guests: 50,
                contact: '0917 000 2000',
                requests: 'Warm, intimate atmosphere with family and friends.',
                subtotal: price,
                total: price,
                platform_fee: fee,
                status,
                escrow_status: escrow,
                created_at: new Date(Date.now() + (offset - 10) * 86400000).toISOString(),
            }));
            (await insert('booking_items', {
                id: itemId,
                booking_id: bookingId,
                provider_id: providerId,
                service_id: `service-${providerIndex}-0`,
                package_id: `package-${providerIndex}-0-0`,
                title: data[providerIndex][5],
                package_name: 'Essential',
                inclusions: '4 hours of service\nPre-event consultation\nDedicated professional',
                terms: 'Seeded demonstration booking.',
                price,
                allocation: price,
                platform_fee: fee,
                status: status === 'DISPUTED' ? 'CONFIRMED' : status,
            }));
            (await insert('booking_events', {
                id: id(),
                booking_id: bookingId,
                actor_id: customerId,
                event: 'Booking submitted',
                detail: 'Seeded development example.',
            }));
            if (!['PENDING', 'CANCELLED'].includes(status))
                (await insert('reservations', {
                    provider_id: providerId,
                    date: day(offset),
                    booking_id: bookingId,
                }));
            if (escrow !== 'UNPAID') {
                (await insert('payments', {
                    id: id(),
                    booking_id: bookingId,
                    user_id: customerId,
                    amount: price,
                    purpose: 'Seeded development booking payment',
                }));
                (await insert('escrow_transactions', {
                    id: id(),
                    booking_id: bookingId,
                    type: 'HOLD',
                    amount: price,
                    fee,
                    actor_id: customerId,
                    note: 'Seeded development escrow hold',
                }));
                (await insert('booking_events', {
                    id: id(),
                    booking_id: bookingId,
                    actor_id: customerId,
                    event: 'Payment placed in escrow',
                }));
            }
            if (status === 'COMPLETED') {
                (await insert('escrow_transactions', {
                    id: id(),
                    booking_id: bookingId,
                    provider_id: providerId,
                    type: 'RELEASE',
                    amount: price - fee,
                    fee,
                    actor_id: customerId,
                    note: 'Seeded completed development event',
                }));
                for (const label of [
                    'Service check-in verified',
                    'Service completion verified',
                    'Booking completed',
                    'Escrow released',
                ])
                    (await insert('booking_events', {
                        id: id(),
                        booking_id: bookingId,
                        actor_id: customerId,
                        event: label,
                        detail: 'Historical demo fixture.',
                    }));
                (await insert('reviews', {
                    id: id(),
                    booking_item_id: itemId,
                    customer_id: customerId,
                    provider_id: providerId,
                    service_id: `service-${providerIndex}-0`,
                    rating: suffix.endsWith('0') ? 4 : 5,
                    body: [
                        'The team made everything feel easy. Thoughtful, on time, and so lovely to work with.',
                        'Clear communication from the very first conversation. We loved every little detail.',
                        'Such a memorable celebration. Our guests are still talking about it!',
                    ][Number(suffix.slice(-1)) % 3 || 0],
                }));
            }
            if (status === 'DISPUTED') {
                (await insert('disputes', {
                    id: 'demo-dispute',
                    booking_id: bookingId,
                    user_id: customerId,
                    reason: 'Please review the agreed coverage and discuss a resolution with the supplier.',
                }));
                (await insert('escrow_transactions', {
                    id: id(),
                    booking_id: bookingId,
                    type: 'FREEZE',
                    amount: 0,
                    actor_id: customerId,
                    note: 'Seeded dispute awaiting review',
                }));
            }
        };
        for (let i = 0; i < 10; i++)
            for (let j = 0; j < (i === 1 ? 11 : i === 0 ? 6 : 3); j++)
                (await seedBooking(i, j % 2, -60 - j, 'COMPLETED', `history-${i}-${j}`));
        (await seedBooking(0, 0, 14, 'PENDING', 'request'));
        (await seedBooking(1, 0, 18, 'ACCEPTED', 'accepted'));
        (await seedBooking(0, 0, 21, 'CONFIRMED', 'confirmed'));
        (await seedBooking(4, 1, 0, 'IN_PROGRESS', 'progress'));
        (await seedBooking(3, 0, 28, 'DISPUTED', 'disputed'));
        (await seedBooking(2, 1, 31, 'CANCELLED', 'cancelled'));
        (await insert('support_tickets', {
            id: 'demo-ticket',
            user_id: 'customer-0',
            subject: 'Help coordinating arrival times',
            message: 'Could you help me coordinate the photographer and makeup artist for our event?',
        }));
        (await insert('referrals', {
            id: 'demo-referral',
            referrer_id: 'customer-0',
            referred_id: 'customer-2',
        }));
        for (const [key, value] of Object.entries(defaults))
            (await insert('settings', { key, value }));
        (await notify('customer-0', 'Your celebration is coming together', 'Golden Table Catering accepted your booking. Review your checkout.', '/checkout/demo-accepted'));
        (await notify('provider-user-0', 'A new celebration is waiting', 'Sofia has requested your photography package.', '/bookings/demo-request'));
        (await notify('admin-demo', 'Welcome to your marketplace', 'Your seeded marketplace is ready to explore.', '/admin'));
        (await run('INSERT INTO audit_log(id,actor_id,action,target,detail) VALUES(?,?,?,?,?)', id(), 'admin-demo', 'Development seed created', 'platform', 'All people, businesses, reviews, and transactions are fictional.'));
        return true;
    }));
}
