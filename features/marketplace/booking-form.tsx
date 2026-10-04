'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { Field, Badge } from '@/components/ui';
import { money, today } from '@/lib/format';
import type { User } from '@/lib/domain';
import type { Service, Package, Bundle } from '@/types/models';
export function BookingForm({
  user,
  service,
  packages = [],
  addons = [],
  bundle,
  date,
}: {
  user: User | null;
  service?: Service;
  packages?: Package[];
  addons?: { id: string; name: string; price: number }[];
  bundle?: Bundle;
  date?: string;
}) {
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [voucher, setVoucher] = useState('');
  const [discount, setDiscount] = useState(0);
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const subtotal = bundle
    ? bundle.total
    : (packages.find((p) => p.id === packageId)?.price || 0) +
      addons.filter((a) => selectedAddons.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const invalidate = () => {
    setDiscount(0);
    setQuoteMessage('');
  };
  async function quote() {
    setQuoteBusy(true);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: bundle ? undefined : packageId,
          bundleId: bundle?.id,
          addons: selectedAddons,
          voucher,
        }),
      });
      const result = await res.json();
      setDiscount(result.discount || 0);
      setQuoteMessage(result.error || result.message);
    } catch {
      setQuoteMessage('Could not update the quote. Please try again.');
    } finally {
      setQuoteBusy(false);
    }
  }
  return (
    <section className="booking-form panel">
      <div className="row between">
        <h2>Make it a date.</h2>
        <CalendarDays size={22} />
      </div>
      <p>Tell us a little about your celebration.</p>
      {bundle && <Badge tone="green">{bundle.discount_percent}% bundle savings included</Badge>}
      {bundle && !bundle.ready ? (
        <p className="notice">
          This bundle is temporarily unavailable while supplier participation is reviewed.
        </p>
      ) : !user ? (
        <div>
          <p>Sign in to request your date and keep all the details together.</p>
          <Link className="btn full" href="/login">
            Sign in to book
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : user.role !== 'CUSTOMER' ? (
        <p className="notice">
          Customer accounts can book services. Sign in with a customer account to try the booking
          experience.
        </p>
      ) : (
        <ActionForm action="booking.create" data={bundle ? { bundleId: bundle.id } : { packageId }}>
          <input name="voucher" type="hidden" value={voucher} />
          {!bundle && (
            <Field label="Your package">
              <select
                name="packageId"
                value={packageId}
                onChange={(e) => {
                  setPackageId(e.target.value);
                  invalidate();
                }}
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {money(p.price)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Event date">
            <input name="eventDate" type="date" required min={today()} defaultValue={date} />
          </Field>
          <div className="two-grid">
            <Field label="Occasion">
              <select name="eventType">
                <option>Wedding</option>
                <option>Birthday</option>
                <option>Corporate event</option>
                <option>Anniversary</option>
                <option>Graduation</option>
                <option>Other celebration</option>
              </select>
            </Field>
            <Field label="Guests">
              <input
                name="guests"
                type="number"
                min={service?.min_guests || 1}
                max={service?.max_guests || 100000}
                required
                defaultValue={50}
              />
            </Field>
          </div>
          <Field label="Venue / location">
            <input name="location" required minLength={5} placeholder="Venue name and city" />
          </Field>
          <Field label="Contact number or email">
            <input name="contact" required minLength={5} defaultValue={user.phone || user.email} />
          </Field>
          <Field label="Anything else we should know? (optional)">
            <textarea
              name="requests"
              rows={3}
              placeholder="The little details that matter to you…"
            />
          </Field>
          {addons.length > 0 && (
            <div className="addon-options">
              <strong>A little extra?</strong>
              {addons.map((a) => (
                <label className="check-label" key={a.id}>
                  <input
                    type="checkbox"
                    name="addons"
                    value={a.id}
                    checked={selectedAddons.includes(a.id)}
                    onChange={(e) => {
                      setSelectedAddons((old) =>
                        e.target.checked ? [...old, a.id] : old.filter((x) => x !== a.id),
                      );
                      invalidate();
                    }}
                  />
                  {a.name}
                  <span>{money(a.price)}</span>
                </label>
              ))}
            </div>
          )}
          <Field label="Have a voucher?">
            <div className="input-button">
              <input
                aria-label="Voucher code"
                value={voucher}
                onChange={(e) => {
                  setVoucher(e.target.value.toUpperCase());
                  invalidate();
                }}
                placeholder="e.g. CELEBRATE500"
              />
              <button
                type="button"
                className="btn secondary small"
                disabled={quoteBusy}
                onClick={quote}
              >
                {quoteBusy ? 'Checking…' : 'Apply'}
              </button>
            </div>
          </Field>
          {quoteMessage && (
            <p className="small-note" role="status">
              {quoteMessage}
            </p>
          )}
          <div className="price-summary">
            <div>
              <span>Package subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="green-text">
                <span>Voucher savings</span>
                <span>−{money(discount)}</span>
              </div>
            )}
            <div className="total">
              <strong>Estimated total</strong>
              <strong>{money(subtotal - discount)}</strong>
            </div>
          </div>
          <button className="btn full" type="submit">
            Request your date
            <ArrowRight size={17} />
          </button>
          <small className="center muted">No payment yet. Your providers accept first.</small>
        </ActionForm>
      )}
    </section>
  );
}
