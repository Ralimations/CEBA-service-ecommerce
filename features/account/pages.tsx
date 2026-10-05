import { mapAsync } from '@/lib/async';
import Link from 'next/link';
import { ArrowRight, Ticket, Gift, ShieldCheck, CalendarDays, Bell, CheckCircle2, } from 'lucide-react';
import { all, one, settings, now } from '@/server/db';
import { bookingsFor, customerStats, dashboardStats } from '@/server/queries';
import type { User } from '@/lib/domain';
import type { Voucher } from '@/types/models';
import { Badge, Heading, Metrics, Panel, SectionHeading, Empty, Field, Status, } from '@/components/ui';
import { BookingCard } from '@/components/cards';
import { ActionForm, ActionButton } from '@/components/action-form';
import { FaqChat } from '@/components/faq-chat';
import { money, dateLabel, human } from '@/lib/format';
import { faqs } from '@/lib/faq';
export async function CustomerOverview({ user }: {
    user: User;
}) {
    const stats = (await dashboardStats(user));
    const loyalty = (await customerStats(user.id));
    const bookings = (await bookingsFor(user)).filter((b) => !['COMPLETED', 'CANCELLED'].includes(b.status))
        .slice(0, 4);
    return (<>
      <Heading eyebrow="A LITTLE LESS PLANNING. A LOT MORE JOY." title={`Hello, ${user.name.split(' ')[0]}.`} description="Your next great memory starts here." action={<Link className="btn" href="/browse">
            Plan a celebration
            <ArrowRight size={17}/>
          </Link>}/>
      <Metrics items={[
            { label: 'Upcoming celebrations', value: stats.upcoming },
            { label: 'Completed bookings', value: loyalty.completed },
            { label: 'Celebration spending', value: money(loyalty.spending) },
            {
                label: 'Your membership',
                value: human(loyalty.rank),
                hint: 'Based on completed bookings',
            },
        ]}/>
      <div className="dashboard-banner">
        <div>
          <Badge>YOUR PEOPLE ARE OUT THERE</Badge>
          <h2>What are we celebrating next?</h2>
          <p>A big milestone or a small just-because. Find the team to make it yours.</p>
          <Link href="/browse" className="text-link">
            Explore services
            <ArrowRight size={17}/>
          </Link>
        </div>
        <span className="banner-icon">
          <CalendarDays size={64} strokeWidth={1}/>
        </span>
      </div>
      <SectionHeading title="Your plans in motion" href="/bookings" label="All bookings"/>
      <div className="booking-list">
        {bookings.map((b) => (<BookingCard key={b.id} booking={b}/>))}
      </div>
      {!bookings.length && (<Empty title="Room for something wonderful." href="/browse">
          You have no upcoming celebrations.
        </Empty>)}
      <div className="two-grid account-extras">
        <Panel>
          <Gift size={25}/>
          <h3>Good things are better shared.</h3>
          <p>
            Share your referral code. You both receive a voucher after their first completed
            booking.
          </p>
          <code className="referral-code">{user.referral_code}</code>
          <Link className="text-link" href="/profile">
            See your rewards
            <ArrowRight size={16}/>
          </Link>
        </Panel>
        <Panel>
          <Ticket size={25}/>
          <h3>A little extra for your next event.</h3>
          <p>Check your wallet for welcome gifts, seasonal promotions, and loyalty rewards.</p>
          <Link className="btn secondary" href="/vouchers">
            Open voucher wallet
            <ArrowRight size={16}/>
          </Link>
        </Panel>
      </div>
    </>);
}
export async function ProfilePage({ user }: {
    user: User;
}) {
    const loyalty = user.role === 'CUSTOMER' ? (await customerStats(user.id)) : null;
    const rules = (await settings());
    const next = loyalty
        ? ([
            ['SILVER', rules.silver],
            ['GOLD', rules.gold],
            ['PLATINUM', rules.platinum],
        ] as const).find(([, n]) => loyalty.completed < n)
        : null;
    const referrals = (await all<{
        name: string;
        rewarded_at: string | null;
    }>('SELECT u.name,r.rewarded_at FROM referrals r JOIN users u ON u.id=r.referred_id WHERE r.referrer_id=?', user.id));
    return (<>
      <Heading eyebrow="YOUR LITTLE CORNER" title="Profile & rewards" description="A few details, and a growing collection of good moments."/>
      <div className="two-grid">
        <Panel>
          <h2>Your details</h2>
          <ActionForm action="profile.save">
            <Field label="Full name">
              <input name="name" required minLength={2} defaultValue={user.name}/>
            </Field>
            <Field label="Email address">
              <input name="email" type="email" required defaultValue={user.email}/>
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={user.phone}/>
            </Field>
            <button className="btn">Save profile</button>
          </ActionForm>
        </Panel>
        {loyalty && (<Panel className="loyalty-panel">
            <ShieldCheck size={32}/>
            <span className="eyebrow">EVERY CELEBRATION COUNTS</span>
            <h2>{human(loyalty.rank)} member</h2>
            <p>
              {loyalty.completed} completed bookings · {money(loyalty.spending)} celebrated
            </p>
            <progress max={next?.[1] || rules.platinum} value={loyalty.completed}/>
            <p>
              {next
                ? `${next[1] - loyalty.completed} more completed bookings to ${human(next[0])}.`
                : 'You’ve reached our highest membership tier. Thank you for celebrating with us.'}
            </p>
            <div className="rank-scale">
              {['Bronze', 'Silver', 'Gold', 'Platinum'].map((r) => (<span key={r}>{r}</span>))}
            </div>
            <Link href="/vouchers" className="text-link">
              Explore your member vouchers
              <ArrowRight size={15}/>
            </Link>
          </Panel>)}
      </div>
      {loyalty && (<>
          <Panel>
            <SectionHeading title="Share a little celebration" description={`Both of you receive a ${money(rules.referralReward * 100)} voucher after your friend completes their first booking.`}/>
            <code className="referral-code">{user.referral_code}</code>
            {referrals.length ? (<div className="referral-list">
                {referrals.map((r, i) => (<div key={i} className="row between">
                    <span>{r.name}</span>
                    <Badge tone={r.rewarded_at ? 'green' : 'neutral'}>
                      {r.rewarded_at ? 'Reward received' : 'Awaiting first completed booking'}
                    </Badge>
                  </div>))}
              </div>) : (<p className="muted">Your referred friends will appear here.</p>)}
          </Panel>
          <Panel>
            <h2>Your reviews</h2>
            {(await all<{
                id: string;
                body: string;
                rating: number;
                business_name: string;
            }>('SELECT r.*,p.business_name FROM reviews r JOIN providers p ON p.id=r.provider_id WHERE r.customer_id=? ORDER BY r.created_at DESC', user.id)).map((r) => (<div className="review" key={r.id}>
                <strong>
                  {r.business_name} · {r.rating}/5
                </strong>
                <p>{r.body}</p>
              </div>))}
          </Panel>
        </>)}
    </>);
}
export async function VoucherWallet({ user }: {
    user: User;
}) {
    const list = (await all<Voucher>(`SELECT v.* FROM vouchers v WHERE v.active=1 AND v.expires_at>? AND (v.owner_id IS NULL OR v.owner_id=?) ORDER BY v.first_only DESC`, now(), user.id));
    return (<>
      <Heading eyebrow="A LITTLE SOMETHING FOR YOU" title="Your voucher wallet" description="More room in your budget for the details you love."/>
      <div className="voucher-grid">
        {(await mapAsync(list, async (v) => {
            const used = (await one<{
                n: number;
            }>('SELECT COUNT(*) n FROM voucher_redemptions WHERE voucher_id=? AND user_id=?', v.id, user.id))!.n;
            return (<article className="voucher-card" key={v.id}>
              <div className="voucher-value">
                <Ticket size={26}/>
                <strong>
                  {v.type === 'PERCENTAGE' ? `${v.value}%` : money(v.value)}
                  <small>OFF YOUR CELEBRATION</small>
                </strong>
              </div>
              <div className="voucher-details">
                <h3>{v.code}</h3>
                <p>{v.description}</p>
                <div className="row wrap">
                  <Badge>{human(v.rank_required)}+ members</Badge>
                  {!!v.first_only && <Badge>First paid booking</Badge>}
                  {used >= v.per_user_limit && <Badge>Already used</Badge>}
                </div>
                <small>
                  Minimum {money(v.min_spend)}
                  {v.max_discount > 0 ? ` · Maximum saving ${money(v.max_discount)}` : ''}
                  <br />
                  Valid {dateLabel(v.valid_from)}–{dateLabel(v.expires_at)}
                </small>
                <Link className="text-link" href="/browse">
                  Find a celebration for it
                  <ArrowRight size={15}/>
                </Link>
              </div>
            </article>);
        }))}
      </div>
      {!list.length && (<Empty title="More good things are on the way.">No active vouchers right now.</Empty>)}
      <p className="subtle-note">
        Eligibility and availability are checked when you request and pay for a booking. Codes are
        entered at booking, with one reserved use per active request by default.
      </p>
    </>);
}
export async function Notifications({ user }: {
    user: User;
}) {
    const list = (await all<{
        id: string;
        title: string;
        body: string;
        href: string;
        read_at: string | null;
        created_at: string;
    }>('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200', user.id));
    return (<>
      <Heading eyebrow="IN THE KNOW" title="Your updates" description="The little things that keep your plans moving." action={<ActionButton action="notifications.read" label="Mark all as read"/>}/>
      {list.length ? (<div className="notification-list">
          {list.map((n) => (<article className={`notification-item ${n.read_at ? '' : 'unread'}`} key={n.id}>
              <span className="notification-icon">
                {n.read_at ? <CheckCircle2 size={20}/> : <Bell size={20}/>}
              </span>
              <div>
                <Link href={n.href}>
                  <h3>{n.title}</h3>
                </Link>
                <p>{n.body}</p>
                <small>{dateLabel(n.created_at)}</small>
              </div>
              {!n.read_at && (<ActionButton action="notifications.read" data={{ id: n.id }} label="Mark read"/>)}
            </article>))}
        </div>) : (<Empty title="All quiet for now.">Your booking and account updates will appear here.</Empty>)}
    </>);
}
export async function SupportPage({ user }: {
    user: User | null;
}) {
    const tickets = user
        ? (await all<{
            id: string;
            subject: string;
            message: string;
            status: string;
            response: string;
            created_at: string;
        }>('SELECT * FROM support_tickets WHERE user_id=? ORDER BY created_at DESC', user.id)) : [];
    return (<>
      <Heading eyebrow="WE’RE HERE FOR THE LITTLE DETAILS" title="A little help goes a long way." description="Find a quick answer, or get a real person involved."/>
      <div className="two-grid support-layout">
        <div>
          <FaqChat />
          <section className="detail-section">
            <h2>Good questions, clear answers.</h2>
            {faqs.map((f) => (<details className="faq-detail" key={f.question}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>))}
          </section>
        </div>
        <div>
          <Panel className="support-ticket">
            <div id="ticket">
              <h2>Ask an administrator</h2>
              <p>Tell us what you need. We’ll keep the conversation in the app.</p>
              {user ? (<ActionForm action="ticket.create" reset>
                  <Field label="Subject">
                    <input name="subject" minLength={3} required/>
                  </Field>
                  <Field label="Related booking (optional)">
                    <select name="bookingId">
                      <option value="">General question</option>
                      {(await bookingsFor(user)).slice(0, 50)
                .map((b) => (<option key={b.id} value={b.id}>
                            {b.title} · {b.event_date}
                          </option>))}
                    </select>
                  </Field>
                  <Field label="How can we help?">
                    <textarea name="message" rows={5} minLength={10} required/>
                  </Field>
                  <button className="btn">
                    Send support request
                    <ArrowRight size={16}/>
                  </button>
                </ActionForm>) : (<Link href="/login" className="btn">
                  Sign in to contact support
                </Link>)}
            </div>
          </Panel>
          {user && (<>
              <SectionHeading title="Your support conversations"/>
              {tickets.length ? (tickets.map((t) => (<Panel key={t.id}>
                    <div className="row between">
                      <h3>{t.subject}</h3>
                      <Status value={t.status}/>
                    </div>
                    <p>{t.message}</p>
                    {t.response && (<div className="support-response">
                        <strong>Administrator reply</strong>
                        <p>{t.response}</p>
                      </div>)}
                    <small>{dateLabel(t.created_at)}</small>
                  </Panel>))) : (<Empty title="No support requests yet.">We’re here whenever you need a hand.</Empty>)}
            </>)}
        </div>
      </div>
    </>);
}
