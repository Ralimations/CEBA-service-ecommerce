import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { platform } from '@/config/platform';
import { currentUser } from '@/server/auth';
import { one } from '@/server/db';
import { deliverReminders } from '@/server/reminders';
import { Header } from '@/components/navigation';
import { FaqChat } from '@/components/faq-chat';
import './globals.css';
export const metadata: Metadata = {
  title: { default: `${platform.name} · Make it a moment`, template: `%s · ${platform.name}` },
  description:
    'Find thoughtful event services, trusted providers, and curated celebration bundles. A functional local event marketplace.',
  icons: { icon: '/favicon.svg' },
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user) deliverReminders(user);
  const unread = user
    ? one<{ n: number }>(
        'SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL',
        user.id,
      )!.n
    : 0;
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Header user={user} unread={unread} />
        <div id="main-content">{children}</div>
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/">
              <span className="brand-mark">
                <Sparkles size={21} />
              </span>
              <span>{platform.name}</span>
            </Link>
            <p>
              Good people. Great celebrations.
              <br />
              All the little details, in one place.
            </p>
          </div>
          <nav aria-label="Footer">
            <Link href="/browse">Explore services</Link>
            <Link href="/bundles">Curated bundles</Link>
            <Link href="/register?role=PROVIDER">
              Become a provider
              <ArrowUpRight size={13} />
            </Link>
            <Link href="/support">Help & support</Link>
          </nav>
          <div className="footer-note">
            <span>Made for moments worth celebrating.</span>
            <small>
              Phase 1 local demo · Fictional businesses and reviews.
              <br />
              All payments are simulated. No real money is transferred.
            </small>
          </div>
        </footer>
        <FaqChat floating />
      </body>
    </html>
  );
}
