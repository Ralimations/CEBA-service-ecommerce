import Link from 'next/link';
import { CalendarDays, MapPin, Users, Phone, ArrowRight, ShieldCheck } from 'lucide-react';
import { booking, bookingsFor } from '@/server/view-data';
import { all } from '@/server/db';
import type { User } from '@/lib/domain';
import { Badge, Empty, Field, Heading, Panel, Status, Inclusions, DataTable, TrustNote, } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/action-form';
import { BookingCard } from '@/components/cards';
import { money, dateLabel, human, today } from '@/lib/format';
import { Handshake } from './handshake';
import { expireDueBookingsFor, expirePendingBooking } from '@/server/bookings';
import { cancellationReasonForBooking, providerCancellationReasons, otherReasonPendingCopy, providerCancellationWindowActive, providerCancellationLockHours } from '@/server/cancellations';
import { BookingMessages } from './messages';
import { simulatedDepositsEnabled, simulatedInstallments } from '@/server/deposits';
export async function BookingList({ user, status = '', base = '/bookings', }: {
    user: User;
    status?: string;
    base?: string;
}) {
    await expireDueBookingsFor(user);
    let list = (await bookingsFor(user));
    if (status === 'UPCOMING')
        list = list.filter((b) => b.event_date >= today() && !['CANCELLED', 'COMPLETED'].includes(b.status));
    else if (status)
        list = list.filter((b) => b.status === status);
    return (<>
      <Heading eyebrow={user.role === 'CUSTOMER' ? 'EVERY MOMENT, IN ONE PLACE' : 'KEEP THE DETAILS TOGETHER'} title={user.role === 'CUSTOMER' ? 'Your celebrations' : 'Bookings'} description="From the first request to the final thank-you." action={user.role === 'CUSTOMER' ? (<Link className="btn" href="/browse">
              Plan something special
              <ArrowRight size={16}/>
            </Link>) : undefined}/>
      <nav className="tabs" aria-label="Booking status">
        {[
            '',
            'PENDING',
            'ACCEPTED',
            'CONFIRMED',
            'UPCOMING',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'DISPUTED',
        ].map((s) => (<Link key={s} className={status === s ? 'active' : ''} href={`${base}${s ? `?status=${s}` : ''}`}>
            {s ? human(s) : 'All bookings'}
          </Link>))}
      </nav>
      <div className="booking-list">
        {list.map((b) => (<BookingCard key={b.id} booking={b}/>))}
      </div>
      {!list.length && (<Empty title="A little anticipation goes a long way." href={user.role === 'CUSTOMER' ? '/browse' : undefined}>
          No bookings in this view yet.
        </Empty>)}
    </>);
}
export async function BookingDetail({ user, bookingId }: {
    user: User;
    bookingId: string;
}) {
    let b = (await booking(bookingId, user));
    if (b.status === 'PENDING' && b.response_deadline_at) {
        await expirePendingBooking(bookingId);
        b = await booking(bookingId, user);
    }
    const customer = user.role === 'CUSTOMER';
    const admin = user.role === 'ADMIN';
    const mine = b.items.find((i) => i.provider_user_id === user.id);
    const providerCancellationRestricted = user.role === 'PROVIDER' &&
      process.env.FEATURE_PROVIDER_CANCELLATION_POLICY === 'true' && providerCancellationWindowActive(b.event_date);
    const cancellationReason = await cancellationReasonForBooking(b.id, user);
    const events = (await all<{
        id: string;
        event: string;
        detail: string;
        created_at: string;
        actor: string;
    }>('SELECT e.*,COALESCE(u.name,\'SoiréeSource system\') actor FROM booking_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.booking_id=? ORDER BY e.created_at,e.id', b.id));
    const ledger = (await all<{
        id: string;
        type: string;
        amount: number;
        fee: number;
        note: string;
        created_at: string;
        provider_id: string | null;
    }>('SELECT * FROM escrow_transactions WHERE booking_id=? ORDER BY created_at,id', b.id)).filter((t) => user.role !== 'PROVIDER' || !t.provider_id || t.provider_id === mine?.provider_id);
    return (<>
      <div className="breadcrumbs">
        <Link href={admin ? '/admin/bookings' : customer ? '/bookings' : '/provider/bookings'}>
          Bookings
        </Link>
        <span>/</span>
        <span>{b.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <Heading eyebrow="YOUR EVENT DETAILS" title={b.title} description={`Booking ${b.id.slice(0, 8).toUpperCase()} · ${b.event_type}`} action={<Status value={b.status}/>}/>
      {b.expired_at && <Panel><h2>Request expired</h2><p>All participating providers did not accept within 24 hours. Any accepted date reservations were released. No payment was taken.</p></Panel>}
      <div className="detail-layout">
        <div>
          <Panel>
            <h2>The plan</h2>
            {b.status === 'PENDING' && b.response_deadline_at && <p className="notice">All participating providers must accept by {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(b.response_deadline_at))} (Philippine time). Otherwise the whole request expires.</p>}
            <div className="event-facts">
              <span>
                <CalendarDays />
                {dateLabel(b.event_date)}
              </span>
              <span>
                <MapPin />
                {b.location}
              </span>
              <span>
                <Users />
                {b.guests} guests
              </span>
              <span>
                <Phone />
                {b.contact}
              </span>
            </div>
            <p>
              <strong>Customer:</strong> {b.customer_name} · {b.customer_email}
            </p>
            {b.requests && (<p>
                <strong>A few extra details:</strong> {b.requests}
              </p>)}
          </Panel>
          {b.items.map((item) => (<Panel key={item.id}>
              <div className="row between">
                <div>
                  <Link className="text-link" href={`/providers/${item.provider_id}`}>
                    {item.business_name}
                  </Link>
                  <h3>
                    {item.package_name} · {item.title}
                  </h3>
                </div>
                <Status value={item.status}/>
              </div>
              <Inclusions text={item.inclusions}/>
              <p className="muted pre-line">{item.terms}</p>
              <small>Provider contact: {item.provider_phone}</small>
              <div className="row between item-amount">
                <span>Agreed allocation after discounts</span>
                <strong>{money(item.allocation)}</strong>
              </div>
              {(customer || item.provider_user_id === user.id) &&
                b.escrow_status === 'HELD_IN_ESCROW' && (<>
                    {item.status === 'CONFIRMED' && (<Handshake itemId={item.id} gate="START" issue={customer}/>)}{' '}
                    {['IN_PROGRESS', 'COMPLETION_PENDING'].includes(item.status) && (<Handshake itemId={item.id} gate="COMPLETE" issue={!customer}/>)}
                  </>)}
              {process.env.FEATURE_BOOKING_MESSAGING === 'true' &&
                (customer || item.provider_user_id === user.id || (admin && b.status === 'DISPUTED')) &&
                <BookingMessages itemId={item.id} viewerId={user.id}/>}
              {customer &&
                b.status === 'COMPLETED' &&
                (item.review_id ? (<Badge tone="green">Your review is published</Badge>) : (<details className="review-form">
                    <summary>Leave a little love · write a review</summary>
                    <ActionForm action="review.create" data={{ itemId: item.id }}>
                      <Field label="Your rating">
                        <select name="rating">
                          {[5, 4, 3, 2, 1].map((n) => (<option key={n} value={n}>
                              {n} star{n > 1 ? 's' : ''}
                            </option>))}
                        </select>
                      </Field>
                      <Field label="Your experience">
                        <textarea name="body" minLength={10} maxLength={2000} required rows={3}/>
                      </Field>
                      <button className="btn" type="submit">
                        Publish verified review
                      </button>
                    </ActionForm>
                  </details>))}
            </Panel>))}
          <Panel>
            <h2>How it’s coming together</h2>
            <ol className="timeline">
              {events.map((e) => (<li key={e.id}>
                  <span className="timeline-dot"/>
                  <div>
                    <strong>{e.event}</strong>
                    {e.detail && (<p>
                        {!admin &&
                    ['Service check-in verified', 'Service completion verified'].includes(e.event)
                    ? e.detail.split('; token ')[0]
                    : e.detail}
                      </p>)}
                    <small>
                      {dateLabel(e.created_at)} · {e.actor}
                    </small>
                  </div>
                </li>))}
            </ol>
          </Panel>
          {cancellationReason && <Panel>
            <h2>Provider cancellation explanation</h2>
            {cancellationReason.reason_code !== 'OTHER'
              ? <p>{providerCancellationReasons[cancellationReason.reason_code]}</p>
              : customer
                ? cancellationReason.decision === 'APPROVED'
                  ? <p>{cancellationReason.customer_visible_reason}</p>
                  : <p>{otherReasonPendingCopy}</p>
                : admin || cancellationReason.requester_id === user.id
                  ? <p className="pre-line">{cancellationReason.submitted_text}{admin && cancellationReason.decision && ` · ${cancellationReason.decision}`}</p>
                  : <p>{otherReasonPendingCopy}</p>}
          </Panel>}
        </div>
        <aside>
          <Panel>
            <h2>Your booking summary</h2>
            <div className="price-summary">
              <div>
                <span>Package subtotal</span>
                <strong>{money(b.subtotal)}</strong>
              </div>
              <div>
                <span>Voucher {b.voucher_code || ''}</span>
                <span>−{money(b.discount)}</span>
              </div>
              <div className="total">
                <strong>Total</strong>
                <strong>{money(b.total)}</strong>
              </div>
              <div>
                <span>Service Fee (included)</span>
                <span>{money(b.platform_fee)}</span>
              </div>
              <div>
                <span>Supplier net</span>
                <span>{money(b.total - b.platform_fee)}</span>
              </div>
            </div>
            <div className="escrow-state">
              <ShieldCheck size={25}/>
              <div>
                <strong>Mock escrow</strong>
                <Status value={b.escrow_status}/>
              </div>
            </div>
            <p className="small-note">
              Development Payment Simulation. No real money is transferred.
            </p>
            {customer && b.status === 'ACCEPTED' && (<Link className="btn full" href={`/checkout/${b.id}`}>
                Continue to checkout
                <ArrowRight size={16}/>
              </Link>)}
            {b.status === 'PENDING' && (<p className="notice">
                Waiting for {b.items.filter((i) => i.status === 'PENDING').length} provider
                acceptance(s).
              </p>)}
            {mine?.status === 'PENDING' && b.status === 'PENDING' && (<ActionButton action="booking.accept" data={{ bookingId: b.id }} label="Accept booking request" variant="primary"/>)}
          </Panel>
          {!admin && !['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(b.status) && (<Panel>
              <h3>Need to change the plan?</h3>
              {providerCancellationRestricted &&
                <p className="notice">This event is inside the provisional {providerCancellationLockHours()}-hour cancellation review window. The boundary is based on the event calendar date in Philippine time. An urgent request goes to an administrator; the booking stays active during review.</p>}
              <ActionForm action="booking.cancel" data={{ bookingId: b.id }} confirm={providerCancellationRestricted
                ? 'Submit an urgent cancellation review request. The booking stays active until an administrator reviews it.'
                : b.escrow_status === 'UNPAID'
                ? 'Cancel this request and release its reserved dates?'
                : 'Request cancellation and freeze held escrow for administrator review?'}>
                {customer ? <Field label="Cancellation reason"><textarea name="reason" minLength={5} maxLength={1000} required rows={3}/></Field> : <>
                  <p className="muted">Provisional reason list · awaiting final product approval.</p>
                  <Field label="Primary cancellation reason"><select name="reasonCode" defaultValue="SCHEDULING">{Object.entries(providerCancellationReasons).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></Field>
                  <Field label="Other explanation" hint="Required only when Other is selected. An administrator must review it before customers can see it."><textarea name="otherReasonText" maxLength={500} rows={3}/></Field>
                </>}
                <button className="btn secondary full" type="submit">
                  {providerCancellationRestricted
                    ? 'Request urgent cancellation review'
                    : b.escrow_status === 'UNPAID'
                ? customer
                    ? 'Cancel request'
                    : 'Reject / cancel request'
                : 'Request cancellation'}
                </button>
              </ActionForm>
              {b.escrow_status === 'HELD_IN_ESCROW' && (<details>
                  <summary>Something went wrong? Open a dispute</summary>
                  <ActionForm action="booking.dispute" data={{ bookingId: b.id }}>
                    <Field label="What happened?">
                      <textarea name="reason" minLength={10} required rows={3}/>
                    </Field>
                    <button className="btn danger">Open dispute & freeze escrow</button>
                  </ActionForm>
                </details>)}
            </Panel>)}
          {admin && ['HELD_IN_ESCROW', 'DISPUTED'].includes(b.escrow_status) && (<EscrowControls bookingId={b.id} disputed={b.status === 'DISPUTED'}/>)}
          <TrustNote />
        </aside>
      </div>
      <Panel>
        <h2>Escrow transaction history</h2>
        {ledger.length ? (<DataTable headings={['Date', 'Transaction', 'Amount', 'Service Fee', 'Note']}>
            {ledger.map((t) => (<tr key={t.id}>
                <td>{dateLabel(t.created_at)}</td>
                <td>
                  <Status value={t.type}/>
                </td>
                <td>{money(t.amount)}</td>
                <td>{money(t.fee)}</td>
                <td>{t.note}</td>
              </tr>))}
          </DataTable>) : (<p className="muted">No payment has been made yet.</p>)}
      </Panel>
    </>);
}
export function EscrowControls({ bookingId, disputed }: {
    bookingId: string;
    disputed: boolean;
}) {
    return (<Panel>
      <h3>Administrator escrow review</h3>
      <ActionForm action="escrow.manage" data={{ bookingId, confirmed: true }} confirm="Record this administrator decision and update the simulated escrow ledger? Settlement cannot be repeated.">
        <Field label="Decision">
          <select name="decision">
            {disputed ? (<>
                <option value="refund">Refund customer</option>
                <option value="release">Confirm completion & release</option>
              </>) : (<option value="freeze">Freeze and open review</option>)}
          </select>
        </Field>
        <Field label="Review findings / reason">
          <textarea name="reason" required minLength={10} rows={3}/>
        </Field>
        <button className="btn full" type="submit">
          Review & confirm action
        </button>
      </ActionForm>
    </Panel>);
}
export async function Checkout({ user, bookingId }: {
    user: User;
    bookingId: string;
}) {
    const b = (await booking(bookingId, user));
    const installments = simulatedDepositsEnabled ? await simulatedInstallments(b.id) : [];
    return (<div className="checkout-layout">
      <Heading eyebrow="ONE STEP CLOSER" title="Make your date official." description="Review the details, then reserve your celebration."/>
      <Panel>
        <div className="simulation-banner">
          <ShieldCheck size={22}/>
          <div>
            <strong>Development Payment Simulation</strong>
            <p>
              No real currency is transferred. This checkout demonstrates the booking and escrow
              workflow.
            </p>
          </div>
        </div>
        <h2>{b.title}</h2>
        <p>
          {dateLabel(b.event_date)} · {b.location}
        </p>
        {b.items.map((i) => (<div key={i.id} className="checkout-item">
            <div>
              <strong>{i.business_name}</strong>
              <p>
                {i.package_name} · {i.title}
              </p>
            </div>
            <strong>{money(i.allocation)}</strong>
          </div>))}
        <div className="price-summary">
          <div>
            <span>Subtotal</span>
            <span>{money(b.subtotal)}</span>
          </div>
          <div>
            <span>Voucher {b.voucher_code || '—'}</span>
            <span>−{money(b.discount)}</span>
          </div>
          <div>
            <span>Service Fee (included)</span>
            <span>{money(b.platform_fee)}</span>
          </div>
          <div className="total">
            <strong>Total to reserve</strong>
            <strong>{money(b.total)}</strong>
          </div>
        </div>
        {b.status === 'ACCEPTED' && b.escrow_status === 'UNPAID' ? (<ActionForm action="booking.pay" data={{ bookingId: b.id }} confirm={`Simulate a ${money(b.total)} payment and hold it in mock escrow? No real money will be transferred.`}>
            <label className="check-label">
              <input type="checkbox" name="confirmed" required/>I understand this is a development
              mock payment.
            </label>
            <button className="btn full" type="submit">
              Pay & Reserve
              <ArrowRight size={18}/>
            </button>
          </ActionForm>) : (<div className="notice">
            {b.escrow_status !== 'UNPAID'
                ? 'This booking already has a payment record.'
                : 'Every provider must accept before checkout opens.'}
            <Link className="text-link" href={`/bookings/${b.id}`}>
              View booking
            </Link>
          </div>)}
        {simulatedDepositsEnabled && b.status === 'ACCEPTED' && b.escrow_status === 'UNPAID' && <div className="panel deposit-prototype">
          <h3>Installment flow prototype</h3>
          <p>Development-only accounting preview. Entries do not create payments, confirm the booking, hold escrow, or transfer money. The 50% deposit is rounded up to the next centavo.</p>
          <p>Prototype deposit: <strong>{money(Math.ceil(b.total / 2))}</strong> · remaining balance: <strong>{money(b.total - Math.ceil(b.total / 2))}</strong></p>
          <p>Recorded prototype entries: {installments.length ? installments.map((entry) => `${entry.stage.toLowerCase()} ${money(entry.amount)}`).join(' · ') : 'none'}</p>
          {!installments.some((entry) => entry.stage === 'DEPOSIT') ? <ActionForm action="booking.deposit-prototype" data={{ bookingId: b.id, stage: 'DEPOSIT' }} confirm="Record a simulated 50% deposit in the separate prototype ledger? This does not pay or confirm your booking.">
            <button className="btn secondary" type="submit">Record simulated deposit</button>
          </ActionForm> : !installments.some((entry) => entry.stage === 'BALANCE') ? <ActionForm action="booking.deposit-prototype" data={{ bookingId: b.id, stage: 'BALANCE' }} confirm="Record the remaining simulated balance in the prototype ledger? This does not pay or confirm your booking.">
            <button className="btn secondary" type="submit">Record simulated balance</button>
          </ActionForm> : <p className="notice">Both prototype milestones are recorded. Use the standard simulated checkout above to confirm the booking.</p>}
        </div>}
        <TrustNote />
      </Panel>
    </div>);
}
