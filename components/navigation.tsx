'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
} from 'lucide-react';
import { platform } from '@/config/platform';
import { ActionForm } from './action-form';
import type { User } from '@/lib/domain';
const dashboardFor = (role: string) =>
  role === 'ADMIN' ? '/admin' : role === 'PROVIDER' ? '/provider' : '/dashboard';
export function Header(props: { user: User | null; unread: number }) {
  const path = usePathname();
  return <HeaderView {...props} path={path}/>;
}
export function HeaderPlaceholder() {
  return <HeaderView user={null} unread={0} pending path=""/>;
}
function HeaderView({ user, unread, pending = false, path }: { user: User | null; unread: number; pending?: boolean; path: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label={`${platform.name} home`}>
          <span className="brand-mark">
            <img src="/soiree-source-logo.png" alt="SoiréeSource logo" className="brand-image" />
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
          {pending ? <span className="muted" role="status">Loading account…</span> : user ? (
            <>
              <Link
                href="/notifications"
                className="icon-button notification-bell"
                aria-label={`Notifications, ${unread} unread`}
              >
                <Bell size={19} />
                {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
              </Link>
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
              <Link className="login-link" href="/login">
                Log in
              </Link>
              <Link href="/register" className="btn small">
                Get started
                <ArrowUpRight size={15} />
              </Link>
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

