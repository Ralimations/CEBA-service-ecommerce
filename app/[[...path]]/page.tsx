import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { currentUser, requireUser, homeFor } from '@/server/auth';
import { activeCategories } from '@/server/public-data';
import { Suspense } from 'react';
import { Sidebar } from '@/components/navigation';
import { AuthForm } from '@/components/auth-form';
import { Home, Browse, ServiceDetail, ProviderDetail, BundlesPage, BundleDetail, } from '@/features/marketplace/pages';
import { CustomerOverview, ProfilePage, VoucherWallet, Notifications, SupportPage, } from '@/features/account/pages';
import { BookingList, BookingDetail, Checkout } from '@/features/bookings/pages';
import { ProviderOverview, ProviderProfile, ProviderCalendar, ProviderBundles, ProviderReviews, ProviderEarnings, ProviderSubscription, ProviderPromotions, } from '@/features/provider/pages';
import { ProviderServices, ServiceEditor, ProviderPackages } from '@/features/provider/services';
import { AdminOverview, AdminUsers, AdminProviders, AdminServices, AdminCategories, AdminBadges, AdminSettings, AdminAudit, } from '@/features/admin/pages';
import { AdminBundles, AdminBundleEditor } from '@/features/admin/bundles';
import { AdminVouchers, VoucherEditor, AdminSubscriptions, AdminPlacements, AdminDisputes, AdminEscrow, AdminSupport, } from '@/features/admin/operations';
import { DomainError } from '@/lib/domain';
import { eventDate } from '@/server/bookings';
import { RouteLoadingSkeleton } from '@/components/loading-skeleton';
import type { ReactNode } from 'react';
type Props = {
    params: Promise<{
        path?: string[];
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export default function Page(props: Props) {
    return <Suspense fallback={<RouteLoadingSkeleton />}>
      <RouteContent {...props}/>
    </Suspense>;
}
async function RouteContent({ params, searchParams }: Props) {
    const { path = [] } = await params;
    const search = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || '']));
    const [root, section, itemId] = path;
    const user = await currentUser();
    if (path.length > 3)
        notFound();
    if (search.date && !eventDate.safeParse(search.date).success)
        return (<main className="container page-space">
        <h1>That event date is not valid.</h1>
        <p>Please choose a valid calendar date to check availability.</p>
        <Link href="/browse" className="btn">
          Choose another date
        </Link>
      </main>);
    if (!root)
        return <Home date={search.date}/>;
    if (root === 'browse' && path.length === 1)
        return <Browse search={search}/>;
    if (root === 'services' && section && path.length === 2)
        return <ServiceDetail serviceId={section} date={search.date} user={user}/>;
    if (root === 'providers' && section && path.length === 2)
        return <ProviderDetail providerId={section} date={search.date}/>;
    if (root === 'bundles' && path.length <= 2)
        return section ? (<BundleDetail bundleId={section} date={search.date} user={user}/>) : (<BundlesPage date={search.date}/>);
    if (['login', 'register'].includes(root) && path.length === 1) {
        if (user)
            redirect(homeFor(user.role));
        return (<main className="auth-layout">
        <div className="auth-visual">
          <img src="/images/hero.jpg" alt="A beautiful celebration waiting to happen"/>
          <div>
            <Sparkles size={34}/>
            <h1>
              A little planning.
              <br />
              <em>A lifetime of moments.</em>
            </h1>
            <p>Your people, your plans, and every lovely detail in between.</p>
          </div>
        </div>
        <div className="auth-content">
          <span className="eyebrow">LET’S MAKE SOMETHING MEMORABLE</span>
          <h1>{root === 'register' ? 'Your next chapter starts here.' : 'Hello again.'}</h1>
          <p>
            {root === 'register'
                ? 'Join a community that brings celebrations to life.'
                : 'Sign in and pick up where your plans left off.'}
          </p>
          <AuthForm register={root === 'register'} categories={(await activeCategories())} initialRole={search.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER'}/>
        </div>
      </main>);
    }
    if (root === 'forbidden')
        return (<main className="container page-space">
        <h1>This space belongs to another role.</h1>
        <p>Your account does not have access to this workspace.</p>
        <Link className="btn" href={user ? homeFor(user.role) : '/login'}>
          Return to your dashboard
        </Link>
      </main>);
  if (root === 'terms' && path.length === 1)
    return (
      <main className="container page-space legal-page">
        <span className="eyebrow">SOIRÉESOURCE</span>
        <h1>Terms of Service</h1>
        <p className="muted">Version 2026-10-05 · Draft for product and legal review</p>
        <h2>Using SoiréeSource</h2>
        <p>SoiréeSource connects customers with independent event service providers. Accounts must use accurate information and remain responsible for activity under their credentials.</p>
        <h2>Bookings and simulated payments</h2>
        <p>Booking details, provider terms, dates, cancellations, and disputes are recorded in the application. Phase 1 checkout and escrow are demonstrations only; no real money is collected or transferred.</p>
        <h2>Provider content</h2>
        <p>Providers are responsible for the accuracy and rights of their business details, service descriptions, prices, terms, and images. Platform review badges do not replace external verification.</p>
        <h2>Reviews and respectful use</h2>
        <p>Reviews should describe a genuine completed booking. Do not misuse another person’s account, submit harmful content, or attempt to bypass booking, verification, or access controls.</p>
        <h2>Privacy</h2>
        <p>SoiréeSource stores account, booking, communication, and audit data needed to operate the marketplace. A separate Privacy Policy will be published after the product team completes its legal review.</p>
        <p><Link href="/register" className="btn">Create an account</Link></p>
      </main>
    );
    if (root === 'support' && !user)
        return (<main className="container page-space">
        <SupportPage user={null}/>
      </main>);
    const active = await requireUser(...(root === 'admin'
        ? ['ADMIN' as const]
        : root === 'provider'
            ? ['PROVIDER' as const]
            : ['dashboard', 'vouchers', 'profile', 'checkout'].includes(root)
                ? ['CUSTOMER' as const]
                : []));
    let page: ReactNode;
    if ((root === 'bookings' || root === 'checkout') && section) {
        try {
            const { booking } = await import('@/server/view-data');
            (await booking(section, active));
        }
        catch (error) {
            if (error instanceof DomainError && error.status === 404)
                notFound();
            throw error;
        }
    }
    if (root === 'dashboard' && path.length === 1)
        page = <CustomerOverview user={active}/>;
    else if (root === 'profile' && path.length === 1)
        page = <ProfilePage user={active}/>;
    else if (root === 'vouchers' && path.length === 1)
        page = <VoucherWallet user={active}/>;
    else if (root === 'notifications' && path.length === 1)
        page = <Notifications user={active}/>;
    else if (root === 'support' && path.length === 1)
        page = <SupportPage user={active}/>;
    else if (root === 'bookings' && path.length <= 2) {
        if (section) {
            page = <BookingDetail user={active} bookingId={section}/>;
        }
        else
            page = <BookingList user={active} status={search.status}/>;
    }
    else if (root === 'checkout' && section && path.length === 2) {
        page = <Checkout user={active} bookingId={section}/>;
    }
    else if (root === 'provider') {
        if (itemId && section !== 'services')
            notFound();
        switch (section) {
            case undefined:
                page = <ProviderOverview user={active}/>;
                break;
            case 'services':
                page = itemId ? (<ServiceEditor user={active} serviceId={itemId === 'new' ? undefined : itemId}/>) : (<ProviderServices user={active}/>);
                break;
            case 'packages':
                page = <ProviderPackages user={active}/>;
                break;
            case 'bookings':
                page = <BookingList user={active} status={search.status} base="/provider/bookings"/>;
                break;
            case 'calendar':
                page = <ProviderCalendar user={active} month={search.month}/>;
                break;
            case 'profile':
                page = <ProviderProfile user={active}/>;
                break;
            case 'bundles':
                page = <ProviderBundles user={active}/>;
                break;
            case 'reviews':
                page = <ProviderReviews user={active}/>;
                break;
            case 'earnings':
                page = <ProviderEarnings user={active}/>;
                break;
            case 'subscription':
                page = <ProviderSubscription user={active}/>;
                break;
            case 'promotions':
                page = <ProviderPromotions user={active}/>;
                break;
            default:
                notFound();
        }
    }
    else if (root === 'admin') {
        if (itemId && !['bundles', 'vouchers'].includes(section))
            notFound();
        switch (section) {
            case undefined:
                page = <AdminOverview user={active}/>;
                break;
            case 'users':
                page = <AdminUsers q={search.q} role={search.role}/>;
                break;
            case 'providers':
                page = <AdminProviders />;
                break;
            case 'services':
                page = <AdminServices q={search.q}/>;
                break;
            case 'categories':
                page = <AdminCategories />;
                break;
            case 'bookings':
                page = <BookingList user={active} status={search.status} base="/admin/bookings"/>;
                break;
            case 'bundles':
                page = itemId ? (<AdminBundleEditor bundleId={itemId === 'new' ? undefined : itemId}/>) : (<AdminBundles />);
                break;
            case 'vouchers':
                page = itemId ? (<VoucherEditor voucherId={itemId === 'new' ? undefined : itemId}/>) : (<AdminVouchers />);
                break;
            case 'subscriptions':
                page = <AdminSubscriptions />;
                break;
            case 'placements':
                page = <AdminPlacements />;
                break;
            case 'badges':
                page = <AdminBadges />;
                break;
            case 'disputes':
                page = <AdminDisputes />;
                break;
            case 'escrow':
                page = <AdminEscrow user={active}/>;
                break;
            case 'support':
                page = <AdminSupport />;
                break;
            case 'settings':
                page = <AdminSettings />;
                break;
            case 'audit':
                page = <AdminAudit />;
                break;
            default:
                notFound();
        }
    }
    else
        notFound();
    return (<div className="dashboard-layout">
      <Sidebar user={active}/>
      <main className="dashboard-main">{page}</main>
    </div>);
}
