'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import type { ReactNode } from 'react';

export function SkeletonBlock({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <span className={`skeleton-block ${className}`}>{children}</span>;
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <SkeletonBlock className={`skeleton-line ${className}`} />;
}

export function SkeletonCircle({ className = '' }: { className?: string }) {
  return <SkeletonBlock className={`skeleton-circle ${className}`} />;
}

function Lines({ count = 3, className = '' }: { count?: number; className?: string }) {
  return <div className={`skeleton-lines ${className}`}>{Array.from({ length: count }, (_, i) => <SkeletonLine key={i} />)}</div>;
}

function CardGrid({ count = 6, className = '', compact = false }: { count?: number; className?: string; compact?: boolean }) {
  return <div className={`skeleton-card-grid ${compact ? 'compact' : ''} ${className}`}>{Array.from({ length: count }, (_, i) => <SkeletonCard key={i} compact={compact} />)}</div>;
}

export function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return <div className={`skeleton-card ${compact ? 'compact' : ''}`}>
    <SkeletonBlock className="skeleton-card-image" />
    <div className="skeleton-card-body">
      <SkeletonLine className="short" />
      <SkeletonLine className="wide" />
      <SkeletonLine className="medium" />
      <div className="skeleton-card-foot"><SkeletonLine className="small" /><SkeletonLine className="price" /></div>
    </div>
  </div>;
}

function PageFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`container page-space route-skeleton ${className}`} aria-busy="true" aria-describedby="loading-status">
    <span id="loading-status" className="sr-only" role="status">Loading your next moment…</span>
    <div aria-hidden="true">{children}</div>
  </main>;
}

function HeadingSkeleton({ narrow = false }: { narrow?: boolean }) {
  return <div className="skeleton-heading">
    <SkeletonLine className="eyebrow-line" />
    <SkeletonLine className={narrow ? 'heading-line narrow' : 'heading-line'} />
    <Lines count={2} className="heading-copy" />
  </div>;
}

function HomeSkeleton() {
  return <PageFrame className="home-skeleton-frame">
    <div className="skeleton-promo"><SkeletonLine className="small" /><SkeletonLine className="promo-copy" /></div>
    <section className="skeleton-home-hero">
      <div><SkeletonLine className="eyebrow-line" /><SkeletonLine className="hero-heading" /><SkeletonLine className="hero-heading short" /><Lines count={3} /><div className="skeleton-proof"><SkeletonCircle /><SkeletonLine className="medium" /></div></div>
      <SkeletonBlock className="skeleton-hero-image" />
    </section>
    <div className="skeleton-search"><SkeletonLine /><SkeletonLine /><SkeletonBlock className="skeleton-button" /></div>
    <HeadingSkeleton narrow />
    <CardGrid count={4} />
  </PageFrame>;
}

function BrowseSkeleton() {
  return <PageFrame><HeadingSkeleton /><div className="skeleton-filter"><SkeletonLine /><SkeletonLine /><SkeletonBlock className="skeleton-button" /></div><div className="skeleton-chip-row">{Array.from({ length: 5 }, (_, i) => <SkeletonBlock className="skeleton-chip" key={i} />)}</div><CardGrid /></PageFrame>;
}

function DetailSkeleton({ provider = false }: { provider?: boolean }) {
  return <PageFrame><div className="skeleton-breadcrumb"><SkeletonLine className="small" /></div><div className="skeleton-detail-top"><SkeletonBlock className={provider ? 'skeleton-cover' : 'skeleton-detail-image'} /><div className="skeleton-detail-copy"><SkeletonLine className="eyebrow-line" /><SkeletonLine className="heading-line" /><SkeletonLine className="heading-line short" /><Lines count={4} /><div className="skeleton-action-row"><SkeletonBlock className="skeleton-button" /><SkeletonBlock className="skeleton-button secondary" /></div></div></div><HeadingSkeleton narrow /><CardGrid count={provider ? 3 : 2} /><HeadingSkeleton narrow /></PageFrame>;
}

function BundleSkeleton({ detail = false }: { detail?: boolean }) {
  return <PageFrame>{detail ? <><div className="skeleton-detail-top"><SkeletonBlock className="skeleton-detail-image" /><div className="skeleton-detail-copy"><SkeletonLine className="eyebrow-line" /><SkeletonLine className="heading-line" /><Lines count={4} /><SkeletonBlock className="skeleton-button" /></div></div><HeadingSkeleton narrow /><CardGrid count={3} /></> : <><HeadingSkeleton /><div className="skeleton-filter"><SkeletonLine /><SkeletonBlock className="skeleton-button" /></div><CardGrid count={3} /></>}</PageFrame>;
}

function AuthSkeleton() {
  return <main className="auth-layout route-skeleton" aria-busy="true" aria-describedby="loading-status"><span id="loading-status" className="sr-only" role="status">Loading your next moment…</span><div className="auth-visual" aria-hidden="true"><SkeletonBlock className="skeleton-auth-image" /><div><SkeletonLine className="heading-line" /><SkeletonLine className="heading-line short" /><Lines count={2} /></div></div><div className="auth-content" aria-hidden="true"><SkeletonLine className="eyebrow-line" /><SkeletonLine className="heading-line" /><Lines count={2} /><div className="skeleton-form"><SkeletonLine /><SkeletonLine /><SkeletonLine /><SkeletonBlock className="skeleton-button" /><SkeletonLine className="small" /></div></div></main>;
}

function DashboardSkeleton({ admin = false }: { admin?: boolean }) {
  return <PageFrame className="dashboard-skeleton"><HeadingSkeleton /><div className="skeleton-metrics">{Array.from({ length: 4 }, (_, i) => <div className="skeleton-metric" key={i}><SkeletonLine className="small" /><SkeletonLine className="metric-value" /><SkeletonLine className="medium" /></div>)}</div><div className="skeleton-panel-grid"><div className="skeleton-panel"><SkeletonLine className="heading-line short" /><Lines count={admin ? 5 : 3} /></div><div className="skeleton-panel"><SkeletonLine className="heading-line short" /><Lines count={4} /></div></div>{admin ? <div className="skeleton-table">{Array.from({ length: 7 }, (_, i) => <div className="skeleton-table-row" key={i}><SkeletonLine /><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>)}</div> : <CardGrid count={3} compact />}</PageFrame>;
}

function BookingSkeleton({ detail = false }: { detail?: boolean }) {
  return <PageFrame><HeadingSkeleton /><div className="skeleton-tabs">{Array.from({ length: 5 }, (_, i) => <SkeletonBlock className="skeleton-chip" key={i} />)}</div>{detail ? <><div className="skeleton-panel"><SkeletonLine className="heading-line short" /><Lines count={6} /></div><div className="skeleton-panel"><SkeletonLine className="heading-line short" /><Lines count={5} /></div></> : <CardGrid count={4} compact />}</PageFrame>;
}

function TermsSkeleton() {
  return <PageFrame className="legal-skeleton"><HeadingSkeleton narrow /><SkeletonLine className="heading-line short" />{Array.from({ length: 4 }, (_, i) => <section className="skeleton-article-section" key={i}><SkeletonLine className="heading-line short" /><Lines count={4} /></section>)}</PageFrame>;
}

function GenericSkeleton() {
  return <PageFrame><HeadingSkeleton /><div className="skeleton-panel"><SkeletonLine className="heading-line short" /><Lines count={5} /></div><CardGrid count={3} /></PageFrame>;
}

function RouteLoadingVariant() {
  const pathname = usePathname() || '/';
  if (pathname === '/') return <HomeSkeleton />;
  if (pathname === '/login' || pathname === '/register') return <AuthSkeleton />;
  if (pathname === '/terms') return <TermsSkeleton />;
  if (pathname === '/browse' || pathname.startsWith('/browse?')) return <BrowseSkeleton />;
  if (pathname.startsWith('/services/')) return <DetailSkeleton />;
  if (pathname.startsWith('/providers/')) return <DetailSkeleton provider />;
  if (pathname === '/bundles') return <BundleSkeleton />;
  if (pathname.startsWith('/bundles/')) return <BundleSkeleton detail />;
  if (pathname === '/bookings' || pathname.startsWith('/provider/bookings') || pathname.startsWith('/admin/bookings')) return <BookingSkeleton />;
  if (pathname.startsWith('/bookings/') || pathname.startsWith('/checkout/')) return <BookingSkeleton detail />;
  if (pathname.startsWith('/admin')) return <DashboardSkeleton admin />;
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/provider')) return <DashboardSkeleton />;
  return <GenericSkeleton />;
}

export function RouteLoadingSkeleton() {
  return <Suspense fallback={<GenericSkeleton />}><RouteLoadingVariant /></Suspense>;
}
