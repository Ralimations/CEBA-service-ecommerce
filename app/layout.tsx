import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { AuthLink } from '@/components/auth-link';
import { ArrowUpRight } from 'lucide-react';
import { platform } from '@/config/platform';
import { currentUser } from '@/server/auth';
import { all } from '@/server/db';
import { deliverReminders } from '@/server/reminders';
import { Header, HeaderPlaceholder, type HeaderNotification } from '@/components/navigation';
import { FaqChat } from '@/components/faq-chat';
import './globals.css';
export const metadata: Metadata = {
    title: { default: `${platform.name} · Make it a moment`, template: `%s · ${platform.name}` },
    description: 'Find thoughtful event services, trusted providers, and curated celebration bundles with SoiréeSource.',
    icons: { icon: '/soiree-source-logo.webp' },
};
async function SessionHeader() {
    const user = await currentUser();
    if (user)
        (await deliverReminders(user));
    const notifications = user
        ? (await all<HeaderNotification & { unread_count: number }>(`SELECT id,title,body,href,read_at,created_at,
            COUNT(*) FILTER (WHERE read_at IS NULL) OVER()::int unread_count
          FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 5`, user.id))
        : [];
    const unread = notifications[0]?.unread_count ?? 0;
    return <Header user={user} unread={unread} notifications={notifications}/>;
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (<html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="soireesource-theme-init" strategy="beforeInteractive">{`(function(){try{var key='soiree-source-theme';var media=window.matchMedia('(prefers-color-scheme: dark)');var mode=localStorage.getItem(key)||'system';var apply=function(){document.documentElement.dataset.theme=mode==='system'?(media.matches?'dark':'light'):mode};apply();if(media.addEventListener)media.addEventListener('change',function(){if(localStorage.getItem(key)==='system')apply()})}catch(_){document.documentElement.dataset.theme='light'}})()`}</Script>
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Suspense fallback={<HeaderPlaceholder/>}>
          <SessionHeader />
        </Suspense>
        <div id="main-content">{children}</div>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div>
              <Link className="brand" href="/">
                <span className="brand-mark">
                  <img src="/soiree-source-logo.webp" alt="SoiréeSource logo" className="brand-image" width={320} height={336} />
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
              <AuthLink href="/register?role=PROVIDER">
                Become a provider
                <ArrowUpRight size={13}/>
              </AuthLink>
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
          </div>
        </footer>
        <FaqChat floating/>
      </body>
    </html>);
}

