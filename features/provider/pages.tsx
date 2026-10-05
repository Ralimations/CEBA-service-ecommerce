import Link from 'next/link';
import { ArrowRight, CheckCircle2, Camera, ShieldCheck, Star, TrendingUp } from 'lucide-react';
import { all, one, settings } from '@/server/db';
import { providerByUser, bookingsFor, dashboardStats, bundles, reviews } from '@/server/queries';
import { activeCategories } from '@/server/auth';
import type { User } from '@/lib/domain';
import { Heading, Metrics, Panel, SectionHeading, Field, Status, Empty, Badge, Rating, DataTable, } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/action-form';
import { BookingCard } from '@/components/cards';
import { money, dateLabel, today } from '@/lib/format';
export async function ProviderOverview({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const stats = (await dashboardStats(user));
    const list = (await bookingsFor(user)).filter((b) => !['COMPLETED', 'CANCELLED'].includes(b.status))
        .slice(0, 5);
    const serviceCount = (await one<{
        n: number;
    }>('SELECT COUNT(*) n FROM services WHERE provider_id=?', p.id))!.n;
    const packageCount = (await one<{
        n: number;
    }>('SELECT COUNT(*) n FROM packages k JOIN services s ON s.id=k.service_id WHERE s.provider_id=?', p.id))!.n;
    const calendar = !!(await one('SELECT 1 FROM availability WHERE provider_id=?', p.id));
    const steps = [
        {
            title: 'Business information',
            done: p.description.length > 10 && !!p.phone,
            href: '/provider/profile',
        },
        { title: 'Service category', done: !!p.category_id, href: '/provider/profile' },
        { title: 'First service', done: serviceCount > 0, href: '/provider/services/new' },
        { title: 'Service packages', done: packageCount > 0, href: '/provider/packages' },
        { title: 'Availability', done: calendar, href: '/provider/calendar' },
        {
            title: 'Profile presentation',
            done: !!p.cover && !!(await one('SELECT id FROM portfolio WHERE provider_id=?', p.id)),
            href: '/provider/profile',
        },
    ];
    const completion = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
    return (<>
      <Heading eyebrow="PROVIDER STUDIO" title={`Good to see you, ${user.name.split(' ')[0]}.`} description={`${p.business_name} · A little care makes a big difference.`} action={<Link href={`/providers/${p.id}`} className="btn secondary">
            View public profile
            <ArrowRight size={16}/>
          </Link>}/>
      <Metrics items={[
            { label: 'Upcoming events', value: stats.upcoming },
            { label: 'Pending requests', value: stats.pending },
            { label: 'Completed events', value: stats.completed },
            {
                label: 'Your rating',
                value: p.rating ? p.rating.toFixed(1) : 'New',
                hint: `${p.review_count} verified reviews`,
            },
        ]}/>
      <div className="two-grid">
        <Panel>
          <SectionHeading title="Your studio is taking shape" description={`${completion}% profile completeness`}/>
          <progress value={completion} max={100}/>
          <div className="onboarding-list">
            {steps.map((s, i) => (<Link href={s.href} key={s.title}>
                <span>
                  {s.done ? <CheckCircle2 size={18}/> : <span className="step-dot">{i + 1}</span>}
                  {s.title}
                </span>
                <ArrowRight size={15}/>
              </Link>))}
          </div>
        </Panel>
        <Panel className="earnings-teaser">
          <TrendingUp size={28}/>
          <span className="eyebrow">YOUR WORK, REWARDED</span>
          <h2>{money(stats.released)}</h2>
          <p>Released earnings · development simulation</p>
          <div className="row between">
            <span>Pending in escrow</span>
            <strong>{money(stats.held)}</strong>
          </div>
          <Link href="/provider/earnings" className="btn secondary">
            View earnings
            <ArrowRight size={16}/>
          </Link>
        </Panel>
      </div>
      <SectionHeading title="Your next celebrations" href="/provider/bookings" label="All bookings"/>
      {list.map((b) => (<BookingCard key={b.id} booking={b}/>))}
      {!list.length && (<Empty title="Your next request is on its way.">
          Keep your services and calendar up to date so customers can find you.
        </Empty>)}
    </>);
}
export async function ProviderProfile({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const portfolio = (await all<{
        id: string;
        image: string;
        caption: string;
    }>('SELECT * FROM portfolio WHERE provider_id=?', p.id));
    return (<>
      <Heading title="Your business, beautifully introduced." description="Give customers a clear picture of the people behind their celebration." action={<Link href={`/providers/${p.id}`} className="btn secondary">
            Preview profile
          </Link>}/>
      <Panel>
        <ActionForm action="profile.save">
          <div className="two-grid">
            <Field label="Owner / contact name">
              <input name="name" required defaultValue={user.name}/>
            </Field>
            <Field label="Business name">
              <input name="businessName" required defaultValue={p.business_name}/>
            </Field>
            <Field label="Contact email">
              <input name="email" type="email" required defaultValue={user.email}/>
            </Field>
            <Field label="Contact phone">
              <input name="phone" required defaultValue={p.phone}/>
            </Field>
            <Field label="Primary category">
              <select name="categoryId" defaultValue={p.category_id}>
                {(await activeCategories()).map((c) => (<option key={c.id} value={c.id}>
                    {c.name}
                  </option>))}
              </select>
            </Field>
            <Field label="Service area">
              <input name="area" defaultValue={p.area}/>
            </Field>
          </div>
          <Field label="Your business story">
            <textarea name="description" defaultValue={p.description} rows={5}/>
          </Field>
          <div className="two-grid">
            <Field label="Logo / avatar URL (optional)">
              <input name="avatar" defaultValue={p.avatar} placeholder="https://…"/>
            </Field>
            <Field label="Cover image URL">
              <input name="cover" defaultValue={p.cover}/>
            </Field>
          </div>
          <button className="btn">Save business profile</button>
        </ActionForm>
      </Panel>
      <Panel>
        <SectionHeading title="Your portfolio" description={`${portfolio.length} of ${p.vip ? 30 : 8} images · use HTTPS URLs or local /images/ assets.`}/>
        <div className="portfolio-grid">
          {portfolio.map((i) => (<figure key={i.id}>
              <img src={i.image} alt={i.caption}/>
              <figcaption>{i.caption}</figcaption>
              <ActionButton action="portfolio.save" data={{ id: i.id }} label="Remove image"/>
            </figure>))}
        </div>
        <ActionForm action="portfolio.save" reset>
          <div className="two-grid">
            <Field label="Image URL">
              <input name="image" required placeholder="/images/photography.jpg"/>
            </Field>
            <Field label="Caption / image description">
              <input name="caption" required/>
            </Field>
          </div>
          <button className="btn secondary">
            <Camera size={16}/>
            Add portfolio image
          </button>
        </ActionForm>
      </Panel>
    </>);
}
export async function ProviderCalendar({ user, month }: {
    user: User;
    month?: string;
}) {
    const p = (await providerByUser(user.id));
    const selected = /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') ? month! : today().slice(0, 7);
    const start = new Date(`${selected}-01T12:00:00Z`);
    const days = new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0).getUTCDate();
    const blocks = (await all<{
        date: string;
        status: string;
        note: string;
    }>('SELECT * FROM availability WHERE provider_id=? ORDER BY date', p.id));
    const list = (await bookingsFor(user));
    return (<>
      <Heading title="Make room for the right moments." description="Manage your availability. Accepted requests reserve the entire day for one event."/>
      <div className="two-grid">
        <Panel>
          <form className="row between calendar-filter">
            <Field label="Calendar month">
              <input name="month" type="month" defaultValue={selected}/>
            </Field>
            <button className="btn secondary small">Go to month</button>
          </form>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (<strong key={d}>{d}</strong>))}
            {Array.from({ length: start.getUTCDay() }, (_, i) => (<span key={`empty${i}`}/>))}
            {Array.from({ length: days }, (_, i) => {
            const date = `${selected}-${String(i + 1).padStart(2, '0')}`;
            const bookings = list.filter((b) => b.event_date === date && b.status !== 'CANCELLED');
            const reserved = bookings.find((b) => b.status !== 'PENDING');
            const blocked = blocks.find((b) => b.date === date && b.status === 'UNAVAILABLE');
            return (<div className={`calendar-day ${reserved ? 'booked' : blocked ? 'blocked' : bookings.length ? 'pending' : ''}`} key={date}>
                  <span>{i + 1}</span>
                  {reserved ? (<Link href={`/bookings/${reserved.id}`}>
                      {reserved.status === 'COMPLETED' ? 'Done' : 'Booked'}
                    </Link>) : blocked ? (<small>Blocked</small>) : bookings.length ? (<Link href={`/bookings/${bookings[0].id}`}>Request</Link>) : (<small>Open</small>)}
                </div>);
        })}
          </div>
          <div className="row wrap calendar-legend">
            <Badge tone="green">Booked / reserved</Badge>
            <Badge tone="amber">Unavailable</Badge>
            <Badge>Unmarked dates are open</Badge>
          </div>
        </Panel>
        <Panel>
          <h2>Update a date</h2>
          <ActionForm action="calendar.save">
            <Field label="Date">
              <input name="date" type="date" required min={today()}/>
            </Field>
            <Field label="Availability">
              <select name="status">
                <option value="UNAVAILABLE">Unavailable</option>
                <option value="AVAILABLE">Available</option>
              </select>
            </Field>
            <Field label="Note (private)">
              <input name="note" placeholder="Team day, personal time, travel…"/>
            </Field>
            <button className="btn">Save availability</button>
          </ActionForm>
          <p className="notice">
            Reserved dates cannot be blocked. Use the booking cancellation flow so the customer is
            informed and any held escrow is reviewed.
          </p>
        </Panel>
      </div>
      <Panel>
        <h2>Upcoming availability notes</h2>
        {blocks
            .filter((b) => b.date >= today())
            .map((b) => (<div className="row between list-row" key={b.date}>
              <div>
                <strong>{dateLabel(b.date)}</strong>
                <p>{b.note}</p>
              </div>
              <Status value={b.status}/>
            </div>))}
      </Panel>
    </>);
}
export async function ProviderBundles({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const invitations = (await bundles(undefined, true)).flatMap((b) => b.items.filter((i) => i.provider_id === p.id).map((i) => ({ bundle: b, item: i })));
    return (<>
      <Heading title="Good things come together." description="Review invitations and define exactly what you’re happy to contribute."/>
      {invitations.map(({ bundle: b, item: i }) => (<Panel key={i.id}>
          <div className="row between">
            <div>
              <span className="eyebrow">{b.status}</span>
              <h2>{b.name}</h2>
            </div>
            <Status value={i.approval}/>
          </div>
          <p>{b.description}</p>
          <p className="notice">
            Bundle discount: {b.discount_percent}%. Your agreed price is reduced proportionally by
            this discount, any valid customer voucher, and the configured platform fee. Changing
            participation returns the bundle to draft for administrator review.
          </p>
          <h3>
            {i.service_title} · {i.package_name}
          </h3>
          <ActionForm action="bundle.respond" data={{ itemId: i.id }}>
            <div className="two-grid">
              <Field label="Bundle-specific package price (PHP)">
                <input name="price" type="number" step="0.01" min={0.01} required defaultValue={i.price / 100}/>
              </Field>
              <Field label="Your decision">
                <select name="approval" defaultValue={i.approval === 'REJECTED' ? 'REJECTED' : 'ACCEPTED'}>
                  <option value="ACCEPTED">Accept participation</option>
                  <option value="REJECTED">Decline participation</option>
                </select>
              </Field>
              <Field label="Agreed inclusions">
                <textarea name="inclusions" rows={4} minLength={3} required defaultValue={i.inclusions}/>
              </Field>
              <Field label="Exclusions">
                <textarea name="exclusions" rows={4} defaultValue={i.exclusions}/>
              </Field>
            </div>
            <Field label="Your special terms">
              <textarea name="terms" rows={3} defaultValue={i.terms}/>
            </Field>
            <button className="btn">Save participation decision</button>
          </ActionForm>
        </Panel>))}
      {!invitations.length && (<Empty title="Your next team-up is still taking shape.">
          Administrator bundle invitations will appear here.
        </Empty>)}
    </>);
}
export async function ProviderReviews({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const list = (await reviews(p.id));
    return (<>
      <Heading title="A little love from your customers." description="Verified reviews help the right people find your work."/>
      <Metrics items={[
            { label: 'Average rating', value: p.rating.toFixed(1) },
            { label: 'Verified reviews', value: p.review_count },
            { label: 'Completed events', value: p.completed },
            { label: 'Trusted eligibility', value: p.trusted ? 'Eligible' : 'Growing' },
        ]}/>
      {list.map((r) => (<Panel key={r.id}>
          <div className="row between">
            <h3>{r.customer_name}</h3>
            <Rating value={r.rating}/>
          </div>
          <p>{r.body}</p>
          <small>
            {r.service_title} · {dateLabel(r.created_at)}
          </small>
        </Panel>))}
      {!list.length && (<Empty title="Your first kind word is coming.">
          Customers can review once a booking is complete.
        </Empty>)}
    </>);
}
export async function ProviderEarnings({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const stats = (await dashboardStats(user));
    const transactions = (await all<{
        id: string;
        booking_id: string;
        type: string;
        amount: number;
        fee: number;
        created_at: string;
        customer_name: string;
        note: string;
    }>(`SELECT t.*,u.name customer_name FROM escrow_transactions t JOIN bookings b ON b.id=t.booking_id JOIN users u ON u.id=b.customer_id WHERE t.provider_id=? OR (t.provider_id IS NULL AND EXISTS(SELECT 1 FROM booking_items i WHERE i.booking_id=b.id AND i.provider_id=?)) ORDER BY t.created_at DESC`, p.id, p.id));
    return (<>
      <Heading eyebrow="DEVELOPMENT FINANCIAL SIMULATION" title="Your work, accounted for." description="No real funds are transferred. Gross booking holds are shared; releases are allocated per supplier."/>
      <Metrics items={[
            { label: 'Released earnings', value: money(stats.released) },
            { label: 'Pending in escrow', value: money(stats.held) },
            { label: 'Gross booking allocations', value: money(stats.volume) },
            { label: 'Completed events', value: stats.completed },
        ]}/>
      <Panel>
        <h2>Your booking allocations</h2>
        <DataTable headings={[
            'Booking',
            'Customer',
            'Gross allocation',
            'Platform fee',
            'Supplier net',
            'Escrow',
        ]}>
          {(await bookingsFor(user)).flatMap((b) => b.items
            .filter((i) => i.provider_id === p.id)
            .map((i) => (<tr key={i.id}>
                  <td>
                    <Link href={`/bookings/${b.id}`}>{b.title}</Link>
                  </td>
                  <td>{b.customer_name}</td>
                  <td>{money(i.allocation)}</td>
                  <td>{money(i.platform_fee)}</td>
                  <td>{money(i.allocation - i.platform_fee)}</td>
                  <td>
                    <Status value={b.escrow_status}/>
                  </td>
                </tr>)))}
        </DataTable>
      </Panel>
      <Panel>
        <h2>Transaction ledger</h2>
        <DataTable headings={['Date', 'Booking', 'Transaction', 'Amount', 'Fee', 'Note']}>
          {transactions.map((t) => (<tr key={t.id}>
              <td>{dateLabel(t.created_at)}</td>
              <td>
                <Link href={`/bookings/${t.booking_id}`}>{t.customer_name}</Link>
              </td>
              <td>
                <Status value={t.type}/>
              </td>
              <td>{money(t.amount)}</td>
              <td>{money(t.fee)}</td>
              <td>{t.note}</td>
            </tr>))}
        </DataTable>
      </Panel>
    </>);
}
export async function ProviderSubscription({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const rules = (await settings());
    return (<>
      <Heading title="A little more room to grow." description="Plans support your visibility. Trust badges are earned separately."/>
      <div className="two-grid">
        <Panel>
          <ShieldCheck size={30}/>
          <h2>Classic</h2>
          <strong className="plan-price">Free</strong>
          <p>The essentials for a growing event business.</p>
          <ul className="simple-list">
            <li>Service listings and packages</li>
            <li>Bookings, calendar, and mock escrow</li>
            <li>8 portfolio images</li>
            <li>Ratings and eligibility-based badges</li>
          </ul>
          {!p.vip ? (<Badge tone="green">Your current plan</Badge>) : (<ActionForm action="subscription.save" data={{ tier: 'CLASSIC', confirmed: true }} confirm="Switch to Classic now? Your existing bookings remain active.">
              <button className="btn secondary">Switch to Classic</button>
            </ActionForm>)}
        </Panel>
        <Panel className="vip-panel">
          <Star size={30}/>
          <Badge tone="amber">PAID VISIBILITY</Badge>
          <h2>VIP</h2>
          <strong className="plan-price">
            {money(rules.vipPrice * 100)}
            <small>/ 30 days</small>
          </strong>
          <p>A wider stage for your work.</p>
          <ul className="simple-list">
            <li>Priority in Recommended sorting</li>
            <li>30 portfolio images</li>
            <li>{rules.vipFeaturedDiscount}% off featured placements</li>
            <li>VIP indicator on your public profile</li>
          </ul>
          <ActionForm action="subscription.save" data={{ tier: 'VIP', confirmed: true }} confirm="Activate a 30-day VIP subscription through development checkout? No real payment or recurring charge will occur.">
            <button className="btn">
              {p.vip ? 'Renew VIP · mock checkout' : 'Choose VIP · mock checkout'}
            </button>
          </ActionForm>
        </Panel>
      </div>
      <Panel>
        <h2>Subscription history</h2>
        <DataTable headings={['Tier', 'Started', 'Expires', 'Status']}>
          {(await all<{
            id: string;
            tier: string;
            starts_at: string;
            expires_at: string;
            status: string;
        }>('SELECT * FROM subscriptions WHERE provider_id=? ORDER BY starts_at DESC', p.id)).map((s) => (<tr key={s.id}>
              <td>{s.tier}</td>
              <td>{dateLabel(s.starts_at)}</td>
              <td>{dateLabel(s.expires_at)}</td>
              <td>
                <Status value={s.expires_at < new Date().toISOString() ? 'EXPIRED' : s.status}/>
              </td>
            </tr>))}
        </DataTable>
      </Panel>
    </>);
}
export async function ProviderPromotions({ user }: {
    user: User;
}) {
    const p = (await providerByUser(user.id));
    const rules = (await settings());
    return (<>
      <Heading title="Put your work in the spotlight." description="All paid placements are clearly labeled Sponsored, and expire automatically."/>
      <div className="two-grid">
        <Panel>
          <h2>Choose your placement</h2>
          <p>
            {money(Math.round(rules.featuredDaily * 100 * (p.vip ? 1 - rules.vipFeaturedDiscount / 100 : 1)))}{' '}
            per day{p.vip ? ' · VIP discount included' : ''}
          </p>
          <ActionForm action="placement.save" data={{ confirmed: true }} confirm="Purchase this featured placement through development checkout? No real currency will be transferred.">
            <Field label="Where to appear">
              <select name="placement">
                <option value="HOMEPAGE">Homepage feature</option>
                <option value="CATEGORY">Category feature</option>
                <option value="SEARCH">Recommended search priority</option>
              </select>
            </Field>
            <Field label="Duration">
              <select name="days">
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
            </Field>
            <Field label="Start date">
              <input name="start" type="date" min={today()} defaultValue={today()} required/>
            </Field>
            <button className="btn">Review simulated purchase</button>
          </ActionForm>
        </Panel>
        <Panel>
          <h2>A little clarity on paid priority.</h2>
          <p>
            Featured placements influence Recommended results in their chosen area. Explicit price
            and rating sorts keep their selected order.
          </p>
          <p>
            VIP and Sponsored labels describe paid features. Trusted and Best Service badges depend
            on verified reviews, completed bookings, and dispute history.
          </p>
          <Link href="/browse" className="text-link">
            See the marketplace
            <ArrowRight size={16}/>
          </Link>
        </Panel>
      </div>
      <Panel>
        <h2>Your placements</h2>
        <DataTable headings={['Placement', 'Starts', 'Ends', 'Status']}>
          {(await all<{
            id: string;
            placement: string;
            starts_at: string;
            expires_at: string;
            status: string;
        }>('SELECT * FROM placements WHERE provider_id=? ORDER BY starts_at DESC', p.id)).map((f) => (<tr key={f.id}>
                <td>{f.placement}</td>
                <td>{dateLabel(f.starts_at)}</td>
                <td>{dateLabel(f.expires_at)}</td>
                <td>
                  <Status value={f.expires_at < new Date().toISOString()
                ? 'EXPIRED'
                : f.starts_at > new Date().toISOString()
                    ? 'SCHEDULED'
                    : f.status}/>
                </td>
              </tr>))}
        </DataTable>
      </Panel>
    </>);
}
