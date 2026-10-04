import { flatMapAsync } from '@/lib/async';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Search, CalendarDays, MapPin, ShieldCheck, Sparkles, Camera, Utensils, Mic, Flower2, Brush, Wine, Music2, Heart, Building2, Check, Layers, SlidersHorizontal, } from 'lucide-react';
import { services, service, provider, packagesFor, bundles, searchBundles, reviews, available, type Search as Filters, } from '@/server/queries';
import { all, settings } from '@/server/db';
import { activeCategories } from '@/server/auth';
import type { User } from '@/lib/domain';
import { ServiceCard, BundleCard, ProviderMini } from '@/components/cards';
import { Badge, Rating, Price, Heading, SectionHeading, Empty, Panel, Field, Inclusions, TrustNote, } from '@/components/ui';
import { BookingForm } from './booking-form';
import { dateLabel, today } from '@/lib/format';
const icons: Record<string, typeof Camera> = {
    Camera,
    Utensils,
    Mic,
    Flower2,
    Brush,
    Wine,
    Music2,
    Heart,
    Building2,
    Sparkles,
};
export async function Home({ date }: {
    date?: string;
}) {
    const picks = (await services({ placement: 'HOMEPAGE' })).filter((s, i, list) => list.findIndex((x) => x.provider_id === s.provider_id) === i)
        .slice(0, 4);
    const top = (await services({ sort: 'rating', placement: 'ORGANIC' })).filter((s, i, list) => list.findIndex((x) => x.provider_id === s.provider_id) === i)
        .slice(0, 4);
    return (<>
      <div className="promo-strip">
        <Sparkles size={13}/>A little welcome for your first celebration.{' '}
        <Link href="/vouchers">
          Get {(await settings()).welcomePercent}% off with WELCOME10 <ArrowRight size={13}/>
        </Link>
      </div>
      <main className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-dot"/>
              GOOD PEOPLE. GREAT CELEBRATIONS.
            </span>
            <h1>
              Big moments.
              <br />
              Little details.
              <br />
              <em>All in one place.</em>
            </h1>
            <p>
              Find the people who bring your celebration to life.
              <br className="desktop-only"/>
              Thoughtful services, for whatever you’re celebrating.
            </p>
            <div className="hero-proof">
              <span className="mini-avatars">
                <span>JL</span>
                <span>AR</span>
                <span>MC</span>
              </span>
              <div>
                <span className="stars">★★★★★</span>
                <small>Your next great team is here.</small>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <img src="/images/hero.jpg" alt="An intimate outdoor celebration with a beautifully set table" fetchPriority="high"/>
            <span className="hero-caption">FOR THE MOMENTS THAT MATTER.</span>
            <div className="hero-floating">
              <span className="floating-icon">
                <ShieldCheck size={25}/>
              </span>
              <div>
                <strong>Less planning stress.</strong>
                <span>More being in the moment.</span>
              </div>
              <span className="floating-check">
                <Check size={15}/>
              </span>
            </div>
            <div className="hero-scribble">
              Let’s make
              <br />
              <em>memories.</em>
            </div>
          </div>
        </section>
        <form className="hero-search" action="/browse">
          <label>
            <Search size={20}/>
            <span>
              <small>WHAT ARE YOU PLANNING?</small>
              <input name="q" placeholder="Photography, catering, a little magic…"/>
            </span>
          </label>
          <label>
            <CalendarDays size={20}/>
            <span>
              <small>WHEN’S THE CELEBRATION?</small>
              <input type="date" name="date" min={today()} aria-label="Event date"/>
            </span>
          </label>
          <label>
            <span>
              <small>YOUR BUDGET</small>
              <select name="max" aria-label="Maximum budget">
                <option value="">Any budget</option>
                <option value="10000">Under ₱10,000</option>
                <option value="25000">Under ₱25,000</option>
                <option value="50000">Under ₱50,000</option>
              </select>
            </span>
          </label>
          <button className="btn" type="submit">
            Find your people
            <Search size={17}/>
          </button>
        </form>
        {date && (<section className="home-section">
            <SectionHeading title={`Available for ${dateLabel(date)}`} description="Teams with room for your chosen celebration date." href={`/browse?date=${date}&available=1`}/>
            <div className="service-grid">
              {(await services({ date, available: '1' })).slice(0, 4)
                .map((s) => (<ServiceCard key={s.id} service={s} date={date}/>))}
            </div>
          </section>)}
        <section className="home-section categories-section">
          <SectionHeading title="Every detail, covered." description="Start with what you need. We’ll help you find your people." href="/browse" label="Explore all services"/>
          <div className="category-grid">
            {(await activeCategories()).map((c) => {
            const Icon = icons[c.icon] || Sparkles;
            return (<Link href={`/browse?category=${c.id}`} key={c.id}>
                  <span className={`category-icon ${c.id}`}>
                    <Icon size={25} strokeWidth={1.5}/>
                  </span>
                  <span>{c.name}</span>
                </Link>);
        })}
          </div>
        </section>
        <section className="home-section">
          <SectionHeading title="Good people. Beautiful work." description="Discover a few of the teams making celebrations feel special." href="/browse"/>
          <div className="service-grid">
            {picks.map((s) => (<ServiceCard key={s.id} service={s}/>))}
          </div>
          <p className="subtle-note">
            Sponsored placements are paid visibility. Ratings come from completed demo bookings.
          </p>
        </section>
        <section className="bundle-section">
          <div className="bundle-intro">
            <span className="eyebrow">BETTER TOGETHER</span>
            <h2>
              Your dream team,
              <br />
              <em>already assembled.</em>
            </h2>
            <p>
              Complementary services. One thoughtful package. Our curated bundles bring all the
              right people together, so you don’t have to.
            </p>
            <Link href="/bundles" className="btn secondary">
              Explore curated bundles
              <ArrowUpRight size={17}/>
            </Link>
            <span className="bundle-line">
              <Layers size={18}/>
              Multiple suppliers. One simple booking.
            </span>
          </div>
          <div className="home-bundle">
            {(await bundles()).slice(0, 1)
            .map((b) => (<BundleCard key={b.id} bundle={b}/>))}
          </div>
        </section>
        <section className="home-section">
          <SectionHeading title="Loved for the little things." description="Highly rated teams, chosen by the people they’ve celebrated with." href="/browse?sort=rating" label="Meet the top-rated teams"/>
          <div className="service-grid">
            {top.map((s) => (<ServiceCard key={s.id} service={s}/>))}
          </div>
        </section>
        <section className="how-section">
          <span className="eyebrow">FROM AN IDEA TO “WHAT A DAY.”</span>
          <h2>A little simpler, from the start.</h2>
          <div className="three-grid">
            {[
            [
                '01',
                'Find your people',
                'Explore services, compare packages, and find a team that feels right.',
            ],
            [
                '02',
                'Make it official',
                'Send your request. Once accepted, reserve your date with simulated escrow.',
            ],
            [
                '03',
                'Enjoy your moment',
                'Verify service start and completion together, then share a little love in a review.',
            ],
        ].map(([n, t, d]) => (<div key={n}>
                <span className="step-number">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>))}
          </div>
        </section>
        <section className="provider-banner">
          <div>
            <span className="eyebrow">MAKE A LIVING MAKING MOMENTS.</span>
            <h2>
              You bring the talent.
              <br />
              We’ll help bring the celebrations.
            </h2>
          </div>
          <Link href="/register?role=PROVIDER" className="btn">
            Join as a provider
            <ArrowUpRight size={18}/>
          </Link>
        </section>
      </main>
    </>);
}
export async function Browse({ search }: {
    search: Filters & {
        type?: string;
    };
}) {
    const results = (await services(search));
    const bundleResults = search.type === 'bundles' ? (await searchBundles(search)) : [];
    const resultCount = search.type === 'bundles' ? bundleResults.length : results.length;
    const categories = (await activeCategories());
    return (<main className="container page-space">
      <Heading eyebrow="YOUR CELEBRATION STARTS HERE" title="Find your kind of wonderful." description="Thoughtful people and services for every moment worth celebrating."/>
      <form action="/browse" className="browse-search">
        <Search size={20}/>
        <input name="q" defaultValue={search.q} placeholder="Search services, providers, or a little inspiration…" aria-label="Search services"/>
        {search.category && <input type="hidden" name="category" value={search.category}/>}
        {search.type && <input type="hidden" name="type" value={search.type}/>}
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      <div className="browse-layout">
        <aside className="filters">
          <h3>
            <SlidersHorizontal size={17}/>
            Make it yours
          </h3>
          <form action="/browse">
            <input type="hidden" name="q" value={search.q || ''}/>
            <Field label="Booking type">
              <select name="type" defaultValue={search.type || 'services'}>
                <option value="services">Individual services</option>
                <option value="bundles">Curated bundles</option>
              </select>
            </Field>
            <Field label="Service category">
              <select name="category" defaultValue={search.category || ''}>
                <option value="">All services</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>
                    {c.name}
                  </option>))}
              </select>
            </Field>
            <Field label="Event date">
              <input name="date" type="date" min={today()} defaultValue={search.date}/>
            </Field>
            <div className="two-grid">
              <Field label="Min budget (₱)">
                <input name="min" type="number" min={0} defaultValue={search.min} placeholder="0"/>
              </Field>
              <Field label="Max budget (₱)">
                <input name="max" type="number" min={0} defaultValue={search.max} placeholder="Any"/>
              </Field>
            </div>
            <Field label="Minimum rating">
              <select name="rating" defaultValue={search.rating || ''}>
                <option value="">Any rating</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
                <option value="4.8">4.8+ stars</option>
              </select>
            </Field>
            <Field label="Sort by">
              <select name="sort" defaultValue={search.sort || 'recommended'}>
                <option value="recommended">Recommended</option>
                <option value="rating">Highest rated</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="popular">Most popular</option>
              </select>
            </Field>
            <label className="check-label">
              <input type="checkbox" name="available" value="1" defaultChecked={!!search.available}/>
              Available on my date
            </label>
            <label className="check-label">
              <input type="checkbox" name="trusted" value="1" defaultChecked={!!search.trusted}/>
              Trusted providers
            </label>
            <label className="check-label">
              <input type="checkbox" name="vip" value="1" defaultChecked={!!search.vip}/>
              VIP plan providers
            </label>
            <button type="submit" className="btn full">
              Apply filters
            </button>
            <Link className="reset-link" href="/browse">
              Clear filters
            </Link>
          </form>
          <Link className="filter-bundle-link" href={`/bundles${search.date ? `?date=${search.date}` : ''}`}>
            <Layers size={20}/>
            <span>
              Looking for a whole team?<strong>Explore bundles →</strong>
            </span>
          </Link>
        </aside>
        <section>
          <div className="results-header">
            <p>
              <strong>{resultCount}</strong> {search.type === 'bundles' ? 'bundles' : 'services'} to
              make it memorable
              {search.date && <small>For {dateLabel(search.date)}</small>}
            </p>
            <Badge>Metro Manila & beyond</Badge>
          </div>
          {resultCount ? (search.type === 'bundles' ? (<div className="bundle-grid">
                {bundleResults.map((b) => (<BundleCard key={b.id} bundle={b} date={search.date}/>))}
              </div>) : (<div className="service-grid browse-grid">
                {results.map((s) => (<ServiceCard key={s.id} service={s} date={search.date}/>))}
              </div>)) : (<Empty title="A little room to explore.">
              No services match these filters. Try a different date, budget, or category.
            </Empty>)}
        </section>
      </div>
    </main>);
}
export async function ServiceDetail({ serviceId, date, user, }: {
    serviceId: string;
    date?: string;
    user: User | null;
}) {
    const s = (await service(serviceId));
    if (!s)
        notFound();
    const p = (await provider(s.provider_id))!;
    const packs = (await packagesFor(s.id));
    return (<main className="container page-space">
      <div className="breadcrumbs">
        <Link href="/browse">Explore services</Link>
        <span>/</span>
        <Link href={`/browse?category=${s.category_id}`}>{s.category_name}</Link>
        <span>/</span>
        <span>{p.business_name}</span>
      </div>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">{s.category_name}</span>
          <h1>{s.title}</h1>
          <div className="row wrap">
            <Rating value={s.rating} count={s.review_count}/>
            <span className="muted">
              <MapPin size={14}/>
              {p.area}
            </span>
            {p.trusted && <Badge tone="green">Trusted provider</Badge>}
            {p.best && <Badge tone="amber">Best Service</Badge>}
          </div>
        </div>
        <Price value={s.base_price} from/>
      </div>
      <img className="detail-cover" src={s.image} alt={s.title}/>
      <div className="detail-layout">
        <div>
          <ProviderMini provider={p}/>
          <section className="detail-section">
            <h2>A little about the experience</h2>
            <p className="pre-line">{s.description}</p>
            <div className="detail-facts">
              <span>
                <CalendarDays size={18}/>
                {s.duration}
              </span>
              <span>
                {s.min_guests}–{s.max_guests} guests
              </span>
              <span>Priced per {s.unit}</span>
            </div>
          </section>
          <section className="detail-section" id="packages">
            <h2>Choose your kind of celebration</h2>
            <div className="package-grid">
              {packs.map((pack, i) => (<Panel key={pack.id} className={i === 1 ? 'package highlighted' : 'package'}>
                  {i === 1 && <Badge tone="green">A little extra</Badge>}
                  <h3>{pack.name}</h3>
                  <Price value={pack.price}/>
                  <p>{pack.description}</p>
                  <Inclusions text={pack.inclusions}/>
                  <small>{pack.duration}</small>
                  {pack.exclusions && (<p>
                      <strong>Not included:</strong> {pack.exclusions}
                    </p>)}
                  <details>
                    <summary>Package terms</summary>
                    <p>{pack.terms}</p>
                  </details>
                  <a href="#booking" className="text-link">
                    Choose your package
                    <ArrowRight size={15}/>
                  </a>
                </Panel>))}
            </div>
          </section>
          <ReviewSection providerId={p.id}/>
        </div>
        <aside id="booking">
          <BookingForm user={user} service={s} packages={packs} addons={(await all<{
            id: string;
            name: string;
            price: number;
        }>('SELECT * FROM addons WHERE service_id=? AND active=1', s.id))} date={date}/>
          <TrustNote />
        </aside>
      </div>
    </main>);
}
export async function ReviewSection({ providerId }: {
    providerId: string;
}) {
    const list = (await reviews(providerId));
    return (<section className="detail-section" id="reviews">
      <SectionHeading title="Kind words, real experiences." description="Reviews from completed development bookings."/>
      {list.length ? (list.slice(0, 12).map((r) => (<article className="review" key={r.id}>
            <div className="row between">
              <div className="row">
                <span className="avatar small">{r.customer_name[0]}</span>
                <strong>{r.customer_name}</strong>
                <Badge tone="green">Verified booking</Badge>
              </div>
              <Rating value={r.rating}/>
            </div>
            <p>{r.body}</p>
            <small>
              {r.service_title} · {dateLabel(r.created_at)}
            </small>
          </article>))) : (<Empty title="The first kind word could be yours.">
          Reviews appear after completed bookings.
        </Empty>)}
    </section>);
}
export async function ProviderDetail({ providerId, date }: {
    providerId: string;
    date?: string;
}) {
    const p = (await provider(providerId));
    if (!p || p.status !== 'ACTIVE')
        notFound();
    const listing = (await services({ date })).filter((s) => s.provider_id === p.id);
    const portfolio = (await all<{
        id: string;
        image: string;
        caption: string;
    }>('SELECT * FROM portfolio WHERE provider_id=?', p.id));
    const dates = (await all<{
        date: string;
        status: string;
        note: string;
    }>('SELECT date,status,note FROM availability WHERE provider_id=? AND date>=? ORDER BY date LIMIT 12', p.id, today()));
    const booked = (await all<{
        date: string;
    }>('SELECT date FROM reservations WHERE provider_id=? AND date>=? ORDER BY date LIMIT 12', p.id, today()));
    return (<main className="container page-space">
      <img className="profile-cover" src={p.cover} alt={`${p.business_name} portfolio cover`}/>
      <div className="provider-profile-head">
        <span className="avatar huge">
          {p.avatar ? <img src={p.avatar} alt="Provider logo"/> : p.business_name[0]}
        </span>
        <div>
          <h1>{p.business_name}</h1>
          <p>
            <MapPin size={16}/>
            {p.area}
          </p>
          <div className="row wrap">
            <Rating value={p.rating} count={p.review_count}/>
            {p.trusted && <Badge tone="green">Trusted provider</Badge>}
            {p.best && <Badge tone="amber">Best Service</Badge>}
            {!!p.verified && <Badge>Profile reviewed</Badge>}
            {!!p.vip && <Badge>VIP plan · paid</Badge>}
          </div>
        </div>
        <a href="#services" className="btn">
          Find your package
          <ArrowUpRight size={17}/>
        </a>
      </div>
      <nav className="tabs" aria-label="Provider sections">
        {['Overview', 'Services', 'Packages', 'Portfolio', 'Reviews', 'Availability'].map((t) => (<a key={t} href={`#${t.toLowerCase()}`}>
            {t}
          </a>))}
      </nav>
      <section className="detail-section" id="overview">
        <div className="two-grid">
          <div>
            <h2>Thoughtful people, thoughtful work.</h2>
            <p className="pre-line">{p.description}</p>
          </div>
          <Panel>
            <div className="row wrap">
              <div>
                <strong className="big-number">{p.completed}</strong>
                <p>Completed events</p>
              </div>
              <div>
                <strong className="big-number">{p.rating.toFixed(1)}</strong>
                <p>Average rating</p>
              </div>
              <div>
                <strong className="big-number">{listing.length}</strong>
                <p>Active services</p>
              </div>
            </div>
          </Panel>
        </div>
      </section>
      <section id="services" className="detail-section">
        <SectionHeading title="Made for your moments"/>
        <div className="service-grid">
          {listing.map((s) => (<ServiceCard key={s.id} service={s} date={date}/>))}
        </div>
      </section>
      <section id="packages" className="detail-section">
        <SectionHeading title="A package for your plans"/>
        <div className="three-grid">
          {(await flatMapAsync(listing, async (s) => (await packagesFor(s.id)).map((k) => (<Panel key={k.id}>
                <small>{s.title}</small>
                <h3>{k.name}</h3>
                <Price value={k.price}/>
                <Inclusions text={k.inclusions}/>
                <Link className="btn secondary small" href={`/services/${s.id}#booking`}>
                  Choose package
                </Link>
              </Panel>))))}
        </div>
      </section>
      <section id="portfolio" className="detail-section">
        <SectionHeading title="A glimpse of the good moments"/>
        <div className="portfolio-grid">
          {portfolio.map((i) => (<figure key={i.id}>
              <img src={i.image} alt={i.caption}/>
              <figcaption>{i.caption}</figcaption>
            </figure>))}
        </div>
      </section>
      <section id="availability" className="detail-section">
        <SectionHeading title="Let’s find your date" description="Unlisted dates are available unless another request has already reserved them."/>
        <form className="row wrap">
          <Field label="Check an event date">
            <input name="date" type="date" min={today()} defaultValue={date} required/>
          </Field>
          <button className="btn secondary">Check availability</button>
        </form>
        {date && (<p className={(await available(p.id, date)) ? 'success-text' : 'error-text'}>
            {(await available(p.id, date)) ? 'Available' : 'Unavailable'} on {dateLabel(date)}.
          </p>)}
        <div className="row wrap">
          {dates.map((d) => (<Badge key={d.date} tone={d.status === 'AVAILABLE' ? 'green' : 'amber'}>
              {dateLabel(d.date)} · {d.status.toLowerCase()}
            </Badge>))}
          {booked.map((d) => (<Badge key={d.date}>{dateLabel(d.date)} · booked</Badge>))}
        </div>
      </section>
      <ReviewSection providerId={p.id}/>
    </main>);
}
export async function BundlesPage({ date }: {
    date?: string;
}) {
    const list = (await bundles(date));
    return (<main className="container page-space">
      <Heading eyebrow="BETTER TOGETHER" title="A whole team. One lovely plan." description="Administrator-curated bundles, with every supplier’s terms agreed up front."/>
      <form className="row bundle-date">
        <Field label="When is your celebration?">
          <input type="date" name="date" min={today()} defaultValue={date}/>
        </Field>
        <button className="btn secondary">Check all suppliers</button>
      </form>
      <div className="bundle-grid">
        {list.map((b) => (<BundleCard key={b.id} bundle={b} date={date}/>))}
      </div>
      {!list.length && (<Empty title="Something good is coming together.">
          Bundles appear here once all suppliers approve.
        </Empty>)}
    </main>);
}
export async function BundleDetail({ bundleId, date, user, }: {
    bundleId: string;
    date?: string;
    user: User | null;
}) {
    const b = (await bundles(date)).find((b) => b.id === bundleId);
    if (!b)
        notFound();
    return (<main className="container page-space">
      <Heading eyebrow="CURATED BUNDLE" title={b.name} description={b.description}/>
      <img className="detail-cover" src={b.image} alt={b.name}/>
      <div className="detail-layout">
        <div>
          <SectionHeading title="Meet your celebration team" description="Each supplier has approved these package terms. Your booking reserves them together."/>
          {b.items.map((i) => (<Panel key={i.id}>
              <div className="row between">
                <div>
                  <Link href={`/providers/${i.provider_id}`}>
                    <h3>
                      {i.business_name}
                      <ArrowUpRight size={16}/>
                    </h3>
                  </Link>
                  <p>
                    {i.service_title} · {i.package_name}
                  </p>
                </div>
                <Price value={i.price}/>
              </div>
              <Inclusions text={i.inclusions}/>
              <p>
                <strong>Exclusions:</strong> {i.exclusions || 'None specified.'}
              </p>
              <p className="muted">{i.terms}</p>
              <Badge tone="green">Supplier approved</Badge>
            </Panel>))}
        </div>
        <aside>
          <BookingForm user={user} bundle={b} date={date}/>
          <TrustNote />
        </aside>
      </div>
    </main>);
}
