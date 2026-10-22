'use client';
import Link from 'next/link';
import { AuthLink } from './auth-link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  Bell,
  ArrowUpRight,
  LogOut,
  LayoutDashboard,
  CalendarDays,
  Package,
  Store,
  UserRound,
  Ticket,
  LifeBuoy,
  Settings,
  Users,
  ShieldCheck,
  Wallet,
  Star,
  Megaphone,
  Layers,
  ChartNoAxesCombined,
  Sun,
  MessageSquareWarning,
} from 'lucide-react';
import { platform } from '@/config/platform';
import { dateLabel } from '@/lib/format';
import { ActionForm } from './action-form';
import type { User } from '@/lib/domain';
const dashboardFor = (role: string) =>
  role === 'ADMIN' ? '/admin' : role === 'PROVIDER' ? '/provider' : '/dashboard';
export type HeaderNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};
export function Header(props: {
  user: User | null;
  unread: number;
  notifications: HeaderNotification[];
}) {
  const path = usePathname();
  return <HeaderView {...props} path={path}/>;
}
export function HeaderPlaceholder() {
  return <HeaderView user={null} unread={0} notifications={[]} pending path=""/>;
}
function HeaderView({ user, unread, notifications, pending = false, path }: {
  user: User | null;
  unread: number;
  notifications: HeaderNotification[];
  pending?: boolean;
  path: string;
}) {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationsRef.current?.contains(event.target))
        setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        notificationButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);
  function toggleTheme() {
    const current = localStorage.getItem('soiree-source-theme') || 'system';
    const next = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
    localStorage.setItem('soiree-source-theme', next);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = next === 'system' ? systemTheme : next;
  }
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label={`${platform.name} home`}>
          <span className="brand-mark">
            <img src="/soiree-source-logo.webp" alt="SoiréeSource logo" className="brand-image" width={320} height={336} />
          </span>
          <span>
            {platform.name}
            <small>MAKE IT A MOMENT.</small>
          </span>
        </Link>
        <nav className={`top-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
          <Link
            className={path === '/browse' ? 'active' : ''}
            href="/browse"
            onClick={() => setOpen(false)}
          >
            Explore services
          </Link>
          <Link
            className={path.startsWith('/bundles') ? 'active' : ''}
            href="/bundles"
            onClick={() => setOpen(false)}
          >
            Curated bundles
          </Link>
          <Link href="/support" onClick={() => setOpen(false)}>
            How it works
          </Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button theme-toggle" type="button" onClick={toggleTheme}
            aria-label="Cycle color theme preference: system, light, and dark"
            title="Change color theme">
            <Sun size={18}/>
          </button>
          {pending ? <span className="muted" role="status">Loading account…</span> : user ? (
            <>
              <div
                className="notification-menu"
                ref={notificationsRef}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget))
                    setNotificationsOpen(false);
                }}
              >
                <button
                  ref={notificationButtonRef}
                  className="icon-button notification-bell"
                  type="button"
                  aria-label={`Notifications, ${unread} unread`}
                  aria-haspopup="dialog"
                  aria-expanded={notificationsOpen}
                  aria-controls="notification-popover"
                  onClick={() => setNotificationsOpen((value) => !value)}
                >
                  <Bell size={19} />
                  {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
                </button>
                <div
                  className="notification-popover"
                  id="notification-popover"
                  role="dialog"
                  aria-label="Recent notifications"
                  hidden={!notificationsOpen}
                >
                  <div className="notification-popover-header">
                    <strong>Notifications</strong>
                    {unread > 0 && <span>{unread > 99 ? '99+' : unread} unread</span>}
                  </div>
                  {notifications.length ? (
                    <div className="notification-preview-list">
                      {notifications.map((notification) => (
                        <Link
                          key={notification.id}
                          href={`/notifications#notification-${notification.id}`}
                          className={`notification-preview ${notification.read_at ? '' : 'unread'}`}
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <span className="notification-preview-dot" aria-hidden="true" />
                          <span className="notification-preview-content">
                            <strong>{notification.title}</strong>
                            <span>{notification.body}</span>
                            <time dateTime={notification.created_at}>
                              {dateLabel(notification.created_at)}
                            </time>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="notification-empty">You’re all caught up.</p>
                  )}
                  <Link
                    className="notification-view-all"
                    href="/notifications"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
              <Link className="account-link" href={dashboardFor(user.role)}>
                <span className="avatar small">{user.name.slice(0, 1)}</span>
                <span>
                  {user.name.split(' ')[0]}
                  <small>{user.role.toLowerCase()}</small>
                </span>
              </Link>
            </>
          ) : (
            <>
              <AuthLink className="login-link" href="/login">
                Log in
              </AuthLink>
              <AuthLink href="/register" className="btn small">
                Get started
                <ArrowUpRight size={15} />
              </AuthLink>
            </>
          )}
          <button
            className="icon-button mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
const customerNav = [
  ['/dashboard', 'Overview', LayoutDashboard],
  ['/bookings', 'My bookings', CalendarDays],
  ['/vouchers', 'Voucher wallet', Ticket],
  ['/profile', 'Profile & rewards', UserRound],
  ['/notifications', 'Notifications', Bell],
  ['/support', 'Help & support', LifeBuoy],
] as const;
const providerNav = [
  ['/provider', 'Overview', LayoutDashboard],
  ['/provider/services', 'My services', Store],
  ['/provider/packages', 'Packages', Package],
  ['/provider/bookings', 'Bookings', CalendarDays],
  ['/provider/calendar', 'Availability', CalendarDays],
  ['/provider/bundles', 'Bundle invitations', Layers],
  ['/provider/reviews', 'Reviews', Star],
  ['/provider/earnings', 'Earnings', Wallet],
  ['/provider/subscription', 'Subscription', ShieldCheck],
  ['/provider/promotions', 'Promotions', Megaphone],
  ['/provider/profile', 'Business profile', UserRound],
  ['/notifications', 'Notifications', Bell],
  ['/support', 'Help & support', LifeBuoy],
] as const;
const adminNav = [
  ['/admin', 'Overview', LayoutDashboard],
  ['/admin/users', 'Users', Users],
  ['/admin/providers', 'Providers', Store],
  ['/admin/services', 'Services', Package],
  ['/admin/categories', 'Categories', Layers],
  ['/admin/bookings', 'Bookings', CalendarDays],
  ['/admin/bundles', 'Bundles', Layers],
  ['/admin/vouchers', 'Vouchers', Ticket],
  ['/admin/subscriptions', 'Subscriptions', ShieldCheck],
  ['/admin/placements', 'Featured placements', Megaphone],
  ['/admin/badges', 'Provider badges', Star],
  ['/admin/disputes', 'Disputes', ShieldCheck],
  ['/admin/escrow', 'Escrow ledger', Wallet],
  ['/admin/support', 'Support tickets', LifeBuoy],
  ['/admin/messages', 'Message reports', MessageSquareWarning],
  ['/admin/settings', 'Platform settings', Settings],
  ['/admin/audit', 'Audit trail', ChartNoAxesCombined],
] as const;
export function Sidebar({ user }: { user: User }) {
  const path = usePathname();
  const nav =
    user.role === 'ADMIN' ? adminNav : user.role === 'PROVIDER' ? providerNav : customerNav;
  return (
    <aside className="sidebar">
      <div className="sidebar-label">
        {user.role === 'PROVIDER'
          ? 'PROVIDER STUDIO'
          : user.role === 'ADMIN'
            ? 'PLATFORM WORKSPACE'
            : 'YOUR CELEBRATIONS'}
      </div>
      <nav aria-label="Dashboard navigation">
        {nav.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={
              path === href || (href.split('/').length > 2 && path.startsWith(href + '/'))
                ? 'active'
                : ''
            }
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="badge green">Phase 1 · Local demo</span>
        <ActionForm endpoint="/api/auth/logout">
          <button className="logout" type="submit">
            <LogOut size={17} />
            Sign out
          </button>
        </ActionForm>
      </div>
    </aside>
  );
}

