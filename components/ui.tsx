import Link from 'next/link';
import { ArrowUpRight, Check, Star, ShieldCheck, Inbox } from 'lucide-react';
import { human, money } from '@/lib/format';
import type { ReactNode } from 'react';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Status({ value }: { value: string }) {
  const tone = [
    'ACTIVE',
    'ACCEPTED',
    'CONFIRMED',
    'COMPLETED',
    'RELEASED',
    'PUBLISHED',
    'RESOLVED_PROVIDER',
    'RESOLVED_CUSTOMER',
  ].includes(value)
    ? 'green'
    : ['DISPUTED', 'SUSPENDED', 'REJECTED', 'UNAVAILABLE'].includes(value)
      ? 'red'
      : ['PENDING', 'UNPAID', 'DRAFT', 'OPEN', 'COMPLETION_PENDING'].includes(value)
        ? 'amber'
        : 'neutral';
  return <Badge tone={tone}>{human(value)}</Badge>;
}
export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="rating">
      <Star size={14} fill="currentColor" />
      {value ? value.toFixed(1) : 'New'}
      {count !== undefined && <span className="muted">({count})</span>}
    </span>
  );
}
export function Price({ value, from = false }: { value: number; from?: boolean }) {
  return (
    <span className="price">
      {from && <small>From </small>}
      {money(value)}
    </span>
  );
}
export function Empty({
  title = 'Nothing here yet',
  children,
  href,
  label,
}: {
  title?: string;
  children?: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {href && (
        <Link className="btn" href={href}>
          {label || 'Explore services'}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  href,
  label = 'View all',
}: {
  title: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-link">
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Metrics({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <div className="metrics">
      {items.map((i) => (
        <div className="metric" key={i.label}>
          <span>{i.label}</span>
          <strong>{i.value}</strong>
          {i.hint && <small>{i.hint}</small>}
        </div>
      ))}
    </div>
  );
}
export function Inclusions({ text }: { text: string }) {
  return (
    <ul className="inclusions">
      {text
        .split('\n')
        .filter(Boolean)
        .map((s, i) => (
          <li key={i}>
            <Check size={15} />
            {s}
          </li>
        ))}
    </ul>
  );
}
export function TrustNote() {
  return (
    <div className="trust-note">
      <ShieldCheck size={20} />
      <span>
        Book with peace of mind. Your simulated payment stays in escrow until completion is
        verified.
      </span>
    </div>
  );
}
export { Field } from './field';
export function DataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
