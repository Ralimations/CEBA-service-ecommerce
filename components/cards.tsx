import Link from 'next/link';
import { ArrowUpRight, MapPin, ShieldCheck, CalendarDays } from 'lucide-react';
import type { Service, Bundle, Booking, Provider } from '@/types/models';
import { Badge, Rating, Price, Status } from './ui';
import { dateLabel, money } from '@/lib/format';
export function ServiceCard({ service, date }: { service: Service; date?: string }) {
  return (
    <article className="service-card">
      <Link className="card-image" href={`/services/${service.id}${date ? `?date=${date}` : ''}`}>
        <img src={service.image} alt={service.title} loading="lazy" />
        {!!service.featured && <span className="image-label">Sponsored</span>}
        {!service.available && <span className="unavailable-label">Unavailable on this date</span>}
        <span className="card-arrow">
          <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="card-body">
        <div className="card-kicker">
          <span>{service.category_name}</span>
          <Rating value={service.rating} count={service.review_count} />
        </div>
        <Link href={`/services/${service.id}${date ? `?date=${date}` : ''}`}>
          <h3>{service.title}</h3>
        </Link>
        <Link className="provider-line" href={`/providers/${service.provider_id}`}>
          {service.business_name}
          {service.trusted && <ShieldCheck size={14} aria-label="Trusted provider" />}
        </Link>
        <div className="card-bottom">
          <Price value={service.base_price} from />
          <span>/ {service.unit}</span>
          {!!service.vip && <Badge>VIP plan</Badge>}
        </div>
      </div>
    </article>
  );
}
export function BundleCard({ bundle, date }: { bundle: Bundle; date?: string }) {
  return (
    <article className="bundle-card">
      <Link href={`/bundles/${bundle.id}${date ? `?date=${date}` : ''}`} className="bundle-image">
        <img src={bundle.image} alt={bundle.name} loading="lazy" />
        <span className="image-label">Save {bundle.discount_percent}%</span>
      </Link>
      <div className="card-body">
        <span className="eyebrow">CURATED TO COME TOGETHER</span>
        <Link href={`/bundles/${bundle.id}${date ? `?date=${date}` : ''}`}>
          <h3>{bundle.name}</h3>
        </Link>
        <p>{bundle.description}</p>
        <div className="bundle-suppliers">
          {bundle.items.map((i) => (
            <Badge key={i.id}>{i.business_name.split(' ').slice(0, 2).join(' ')}</Badge>
          ))}
        </div>
        <div className="card-bottom">
          <Price value={bundle.total} />
          <s>{money(bundle.original)}</s>
          <Link
            className="round-link"
            href={`/bundles/${bundle.id}${date ? `?date=${date}` : ''}`}
            aria-label={`Explore ${bundle.name}`}
          >
            <ArrowUpRight size={19} />
          </Link>
        </div>
        {date && !bundle.available && <p className="error-text">Unavailable on your chosen date</p>}
      </div>
    </article>
  );
}
export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Link href={`/bookings/${booking.id}`} className="booking-card">
      <div className="booking-icon">
        <CalendarDays size={23} />
      </div>
      <div className="booking-main">
        <div className="row between">
          <h3>{booking.title}</h3>
          <Status value={booking.status} />
        </div>
        <p>{booking.items.map((i) => i.business_name).join(' · ')}</p>
        <div className="booking-meta">
          <span>
            <CalendarDays size={14} />
            {dateLabel(booking.event_date)}
          </span>
          <span>
            <MapPin size={14} />
            {booking.location}
          </span>
        </div>
      </div>
      <div className="booking-price">
        <strong>{money(booking.total)}</strong>
        <small>
          {booking.items.length} supplier{booking.items.length > 1 ? 's' : ''}
        </small>
        <ArrowUpRight size={18} />
      </div>
    </Link>
  );
}
export function ProviderMini({ provider }: { provider: Provider }) {
  return (
    <Link href={`/providers/${provider.id}`} className="provider-mini">
      <span className="avatar">{provider.business_name.slice(0, 1)}</span>
      <span>
        <strong>{provider.business_name}</strong>
        <small>{provider.area}</small>
        <Rating value={provider.rating} count={provider.review_count} />
      </span>
      {provider.trusted && <ShieldCheck className="green-text" size={22} />}
    </Link>
  );
}
