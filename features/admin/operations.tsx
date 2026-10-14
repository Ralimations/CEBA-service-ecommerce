import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { all, one, settings, now } from '@/server/db';
import { providers, bookingsFor } from '@/server/queries';
import { activeCategories } from '@/server/auth';
import type { User } from '@/lib/domain';
import type { Voucher } from '@/types/models';
import { Heading, Panel, DataTable, Field, Status, Empty } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/action-form';
import { money, dateLabel, today, human } from '@/lib/format';
import { publicAppealsForAdmin } from '@/server/public-support';
import { pendingEmergencyCancellationRequests, pendingProviderCancellationReasons, providerCancellationReasons } from '@/server/cancellations';
import { bookingMessageReports } from '@/server/messages';
export async function AdminVouchers() {
    const list = (await all<Voucher>('SELECT * FROM vouchers ORDER BY id DESC'));
    return (<>
      <Heading title="A little generosity, well managed." description="Create welcome gifts, seasonal offers, and membership rewards." action={<Link className="btn" href="/admin/vouchers/new">
            <Plus size={17}/>
            Create voucher
          </Link>}/>
      <Panel>
        <DataTable headings={['Code', 'Offer', 'Eligibility', 'Dates', 'Status', 'Actions']}>
          {list.map((v) => (<tr key={v.id}>
              <td>
                <strong>{v.code}</strong>
                <small>{v.description}</small>
              </td>
              <td>
                {v.type === 'PERCENTAGE' ? `${v.value}%` : money(v.value)}
                <small>Min {money(v.min_spend)}</small>
              </td>
              <td>
                {human(v.rank_required)}+{v.first_only ? ' · first paid booking' : ''}
                <small>
                  {v.per_user_limit} per customer / {v.usage_limit} total
                </small>
              </td>
              <td>
                {dateLabel(v.valid_from)}
                <small>Until {dateLabel(v.expires_at)}</small>
              </td>
              <td>
                <Status value={Date.parse(v.expires_at) < Date.parse(now())
                ? 'EXPIRED'
                : v.active
                    ? 'ACTIVE'
                    : 'PAUSED'}/>
              </td>
              <td>
                <Link href={`/admin/vouchers/${v.id}`} className="btn small secondary">
                  Edit / archive
                </Link>
              </td>
            </tr>))}
        </DataTable>
      </Panel>
    </>);
}
export async function VoucherEditor({ voucherId }: {
    voucherId?: string;
}) {
    const v = voucherId ? (await one<Voucher>('SELECT * FROM vouchers WHERE id=?', voucherId)) : undefined;
    if (voucherId && !v)
        notFound();
    const dateInput = (s: string) => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(s));
    return (<>
      <Heading title={v ? `Edit ${v.code}` : 'Give a little extra joy.'} description="Voucher rules are checked on the server when a request is created and paid."/>
      <Panel>
        <ActionForm action="voucher.save" data={v ? { id: v.id } : {}}>
          <div className="two-grid">
            <Field label="Voucher code">
              <input name="code" required minLength={3} pattern="[A-Za-z0-9-]+" defaultValue={v?.code}/>
            </Field>
            <Field label="Description">
              <input name="description" required minLength={5} defaultValue={v?.description}/>
            </Field>
            <Field label="Discount type">
              <select name="type" defaultValue={v?.type || 'FIXED'}>
                <option value="FIXED">Fixed PHP amount</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
            </Field>
            <Field label="Discount value (PHP or %)">
              <input name="value" type="number" step="0.01" min={0.01} required defaultValue={v ? (v.type === 'FIXED' ? v.value / 100 : v.value) : 500}/>
            </Field>
            <Field label="Minimum booking value (PHP)">
              <input name="minSpend" type="number" min={0} required defaultValue={v ? v.min_spend / 100 : 3000}/>
            </Field>
            <Field label="Maximum discount (PHP, 0 = uncapped)">
              <input name="maxDiscount" type="number" min={0} required defaultValue={v ? v.max_discount / 100 : 1500}/>
            </Field>
            <Field label="Valid from">
              <input name="validFrom" type="date" required defaultValue={v ? dateInput(v.valid_from) : today()}/>
            </Field>
            <Field label="Expires on">
              <input name="expiresAt" type="date" required defaultValue={v ? dateInput(v.expires_at) : undefined}/>
            </Field>
            <Field label="Global usage limit">
              <input name="usageLimit" type="number" min={1} required defaultValue={v?.usage_limit || 1000}/>
            </Field>
            <Field label="Per-customer limit">
              <input name="perUserLimit" type="number" min={1} required defaultValue={v?.per_user_limit || 1}/>
            </Field>
            <Field label="Minimum rank">
              <select name="rankRequired" defaultValue={v?.rank_required || 'BRONZE'}>
                {['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((r) => (<option key={r}>{r}</option>))}
              </select>
            </Field>
            <Field label="First paid booking only">
              <select name="firstOnly" defaultValue={v?.first_only || 0}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </Field>
            <Field label="Category restriction">
              <select name="categoryId" defaultValue={v?.category_id || ''}>
                <option value="">All categories</option>
                {(await activeCategories()).map((c) => (<option key={c.id} value={c.id}>
                    {c.name}
                  </option>))}
              </select>
            </Field>
            <Field label="Status">
              <select name="active" defaultValue={v?.active ?? 1}>
                <option value="1">Active</option>
                <option value="0">Inactive / archived</option>
              </select>
            </Field>
          </div>
          <button className="btn">Save voucher</button>
        </ActionForm>
      </Panel>
    </>);
}
export async function AdminSubscriptions() {
    const ps = (await providers());
    return (<>
      <Heading title="Plans that help providers grow." description="Manage Classic and VIP subscriptions through development checkout."/>
      <Panel>
        <ActionForm action="subscription.save" data={{ confirmed: true }} confirm="Update this provider’s plan for the next 30 days through a simulated payment?">
          <div className="three-grid">
            <Field label="Provider">
              <select name="providerId">
                {ps.map((p) => (<option key={p.id} value={p.id}>
                    {p.business_name} · {p.vip ? 'VIP' : 'Classic'}
                  </option>))}
              </select>
            </Field>
            <Field label="Plan">
              <select name="tier">
                <option>CLASSIC</option>
                <option>VIP</option>
              </select>
            </Field>
            <div className="align-bottom">
              <button className="btn">Update subscription</button>
            </div>
          </div>
        </ActionForm>
      </Panel>
      <Panel>
        <DataTable headings={['Provider', 'Tier', 'Starts', 'Expires', 'Status', 'Mock payment']}>
          {(await all<{
            id: string;
            business_name: string;
            tier: string;
            starts_at: string;
            expires_at: string;
            status: string;
            amount: number | null;
        }>(`SELECT s.*,p.business_name,m.amount FROM subscriptions s JOIN providers p ON p.id=s.provider_id LEFT JOIN payments m ON m.id=s.payment_id ORDER BY s.starts_at DESC`)).map((s) => (<tr key={s.id}>
              <td>{s.business_name}</td>
              <td>{s.tier}</td>
              <td>{dateLabel(s.starts_at)}</td>
              <td>{dateLabel(s.expires_at)}</td>
              <td>
                <Status value={Date.parse(s.expires_at) < Date.parse(now()) ? 'EXPIRED' : s.status}/>
              </td>
              <td>{s.amount === null ? 'Seeded demo' : money(s.amount)}</td>
            </tr>))}
        </DataTable>
      </Panel>
    </>);
}
export async function AdminPlacements() {
    return (<>
      <Heading title="The spotlight, thoughtfully placed." description={`Current price: ${money((await settings()).featuredDaily * 100)} per day before VIP discounts. All visibility is labeled Sponsored.`}/>
      <Panel>
        <ActionForm action="placement.save" data={{ confirmed: true }} confirm="Create and approve this scheduled featured placement through development checkout?">
          <div className="two-grid">
            <Field label="Provider">
              <select name="providerId">
                {(await providers()).map((p) => (<option key={p.id} value={p.id}>
                    {p.business_name}
                  </option>))}
              </select>
            </Field>
            <Field label="Placement">
              <select name="placement">
                <option value="HOMEPAGE">Homepage</option>
                <option value="CATEGORY">Category</option>
                <option value="SEARCH">Recommended search</option>
              </select>
            </Field>
            <Field label="Start date">
              <input name="start" type="date" required defaultValue={today()}/>
            </Field>
            <Field label="Duration">
              <select name="days">
                {[3, 7, 30].map((n) => (<option key={n} value={n}>
                    {n} days
                  </option>))}
              </select>
            </Field>
          </div>
          <button className="btn">Create featured placement</button>
        </ActionForm>
      </Panel>
      <Panel>
        <DataTable headings={['Provider', 'Placement', 'Schedule', 'Status', 'Mock revenue', 'Actions']}>
          {(await all<{
            id: string;
            business_name: string;
            placement: string;
            starts_at: string;
            expires_at: string;
            status: string;
            amount: number | null;
        }>('SELECT f.*,p.business_name,m.amount FROM placements f JOIN providers p ON p.id=f.provider_id LEFT JOIN payments m ON m.id=f.payment_id ORDER BY f.starts_at DESC')).map((f) => (<tr key={f.id}>
              <td>{f.business_name}</td>
              <td>{f.placement}</td>
              <td>
                {dateLabel(f.starts_at)}
                <small>until {dateLabel(f.expires_at)}</small>
              </td>
              <td>
                <Status value={Date.parse(f.expires_at) < Date.parse(now())
                ? 'EXPIRED'
                : Date.parse(f.starts_at) > Date.parse(now())
                    ? 'SCHEDULED'
                    : f.status}/>
              </td>
              <td>{f.amount === null ? 'Seeded demo' : money(f.amount)}</td>
              <td>
                {f.status === 'ACTIVE' && (<ActionButton action="placement.expire" data={{ id: f.id }} label="Expire now"/>)}
              </td>
            </tr>))}
        </DataTable>
      </Panel>
    </>);
}
export async function AdminDisputes() {
    const list = (await all<{
        id: string;
        booking_id: string;
        reason: string;
        status: string;
        resolution: string;
        created_at: string;
        name: string;
        title: string;
    }>('SELECT d.*,u.name,b.title FROM disputes d JOIN users u ON u.id=d.user_id JOIN bookings b ON b.id=d.booking_id ORDER BY d.created_at DESC'));
    return (<>
      <Heading title="Listen carefully. Resolve fairly." description="Review the event history before deciding whether to refund or release held escrow."/>
      {list.map((d) => (<Panel key={d.id}>
          <div className="row between">
            <h2>{d.title}</h2>
            <Status value={d.status}/>
          </div>
          <p>{d.reason}</p>
          <small>
            Opened by {d.name} · {dateLabel(d.created_at)}
          </small>
          {d.resolution && (<div className="support-response">
              <strong>Resolution</strong>
              <p>{d.resolution}</p>
            </div>)}
          <div className="button-row">
            {d.status === 'OPEN' && (<ActionButton action="dispute.review" data={{ id: d.id }} label="Mark under review"/>)}
            <Link href={`/bookings/${d.booking_id}`} className="btn secondary">
              Inspect booking & escrow
            </Link>
          </div>
        </Panel>))}
      {!list.length && <Empty title="No disputes to review.">Everything is coming together.</Empty>}
    </>);
}
export async function AdminEscrow({ user }: {
    user: User;
}) {
    const list = (await bookingsFor(user)).filter((b) => b.escrow_status !== 'UNPAID');
    return (<>
      <Heading eyebrow="DEVELOPMENT PAYMENT SIMULATION" title="Every amount, accounted for." description="Funds release after all supplier handshakes, or a logged administrator dispute resolution."/>
      <Panel>
        <DataTable headings={[
            'Booking / customer',
            'Gross / fee',
            'Escrow status',
            'Service progress',
            'Actions',
        ]}>
          {list.map((b) => (<tr key={b.id}>
              <td>
                <strong>{b.title}</strong>
                <small>{b.customer_name}</small>
              </td>
              <td>
                {money(b.total)}
                <small>{money(b.platform_fee)} Service Fee</small>
              </td>
              <td>
                <Status value={b.escrow_status}/>
              </td>
              <td>
                {b.items.map((i) => (<div key={i.id}>
                    <small>{i.business_name}</small>
                    <Status value={i.status}/>
                  </div>))}
              </td>
              <td>
                <Link className="btn small secondary" href={`/bookings/${b.id}`}>
                  Review ledger / manage
                </Link>
              </td>
            </tr>))}
        </DataTable>
      </Panel>
      <Panel>
        <h2>Append-only transaction ledger</h2>
        <DataTable headings={['Date', 'Booking', 'Type', 'Amount', 'Fee', 'Actor', 'Note']}>
          {(await all<{
            id: string;
            booking_id: string;
            type: string;
            amount: number;
            fee: number;
            name: string;
            note: string;
            created_at: string;
        }>('SELECT t.*,u.name FROM escrow_transactions t JOIN users u ON u.id=t.actor_id ORDER BY t.created_at DESC LIMIT 200')).map((t) => (<tr key={t.id}>
              <td>{dateLabel(t.created_at)}</td>
              <td>
                <Link href={`/bookings/${t.booking_id}`}>{t.booking_id.slice(0, 12)}</Link>
              </td>
              <td>{t.type}</td>
              <td>{money(t.amount)}</td>
              <td>{money(t.fee)}</td>
              <td>{t.name}</td>
              <td>{t.note}</td>
            </tr>))}
        </DataTable>
      </Panel>
    </>);
}
export async function AdminSupport({ user }: { user: User }) {
    const appeals = await publicAppealsForAdmin(user);
    const cancellations = await pendingProviderCancellationReasons(user);
    const emergencyRequests = await pendingEmergencyCancellationRequests(user);
    const list = (await all<{
        id: string;
        subject: string;
        message: string;
        response: string;
        status: string;
        created_at: string;
        name: string;
        email: string;
        booking_id: string | null;
    }>('SELECT t.*,u.name,u.email FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC'));
    return (<>
      <Heading title="A person on the other side." description="Reply to questions the FAQ assistant could not solve."/>
      <Heading eyebrow="PUBLIC ACCOUNT SUPPORT" title="Account review requests" description="Anonymous account-support intake. Review notes are internal and are not emailed."/>
      {appeals.map((appeal) => (<Panel key={appeal.id}>
          <div className="row between"><h2>{appeal.category === 'SUSPENSION_REVIEW' ? 'Suspension review' : 'Account help'}</h2><Status value={appeal.status}/></div>
          <small>{appeal.submitted_email} · {human(appeal.account_type)} · {dateLabel(appeal.created_at)}</small>
          {appeal.reference_number && <p><strong>Reference:</strong> {appeal.reference_number}</p>}
          <p className="pre-line">{appeal.message}</p>
          <p><strong>Follow-up needed:</strong> {appeal.follow_up_required ? 'Yes' : 'No'}</p>
          <ActionForm action="appeal.review" data={{ id: appeal.id }}>
            <Field label="Review status"><select name="status" defaultValue={appeal.status}>{['OPEN','IN_REVIEW','RESOLVED'].map((status) => <option key={status}>{status}</option>)}</select></Field>
            <Field label="Internal follow-up notes" hint="These notes are not sent to the submitter."><textarea name="internalNotes" rows={3} maxLength={3000} defaultValue={appeal.internal_notes}/></Field>
            <label className="check-label"><input type="checkbox" name="followUpRequired" defaultChecked={appeal.follow_up_required}/><span>Further follow-up is required</span></label>
            <button className="btn">Save review</button>
          </ActionForm>
        </Panel>))}
      {!appeals.length && <Empty title="No account-review requests yet.">Public account-support requests will appear here.</Empty>}
      <Heading eyebrow="URGENT CANCELLATION REVIEW" title="Provider requests within the event window" description="The provisional restricted window is measured against the event calendar date in Philippine time. No money is charged or refunded."/>
      {emergencyRequests.map((request) => <Panel key={request.id}>
        <div className="row between"><h2>{request.title}</h2><Status value="IN_REVIEW"/></div>
        <small>{request.requester_name} · {dateLabel(request.event_date)} · {providerCancellationReasons[request.reason_code]}</small>
        {request.submitted_text && <p className="pre-line">{request.submitted_text}</p>}
        <Link href={`/bookings/${request.booking_id}`} className="text-link">Open booking details</Link>
        <ActionForm action="cancellation-request.review" data={{ id: request.id }}>
          <Field label="Request decision"><select name="decision" defaultValue=""><option value="" disabled>Choose an outcome</option><option value="APPROVED">Approve cancellation request</option><option value="REJECTED">Keep booking active</option></select></Field>
          <Field label="Review note"><textarea name="note" maxLength={2000} rows={3}/></Field>
          <button className="btn">Record review decision</button>
        </ActionForm>
      </Panel>)}
      {!emergencyRequests.length && <Empty title="No urgent cancellation requests.">Requests inside the provisional event window will appear here.</Empty>}
      <Heading eyebrow="PROVIDER CANCELLATIONS" title="Review custom explanations" description="Unreviewed Other text is visible to administrators only. The original submission is retained after a decision."/>
      {cancellations.map((reason) => <Panel key={reason.id}>
        <div className="row between"><h2>{reason.title}</h2><Status value="IN_REVIEW"/></div>
        <small>{reason.requester_name} · {dateLabel(reason.event_date)}</small>
        <p className="pre-line">{reason.submitted_text}</p>
        <Link href={`/bookings/${reason.booking_id}`} className="text-link">Open booking details</Link>
        <ActionForm action="cancellation.review" data={{ id: reason.id }}>
          <Field label="Moderation decision"><select name="decision" defaultValue="APPROVED"><option value="APPROVED">Approve for customer visibility</option><option value="REJECTED">Reject custom wording</option></select></Field>
          <Field label="Approved customer explanation" hint="Used only when approving. The original wording remains preserved."><textarea name="customerVisibleReason" minLength={5} maxLength={500} rows={3}/></Field>
          <Field label="Internal moderation note"><textarea name="moderationNote" maxLength={2000} rows={2}/></Field>
          <button className="btn">Record moderation decision</button>
        </ActionForm>
      </Panel>)}
      {!cancellations.length && <Empty title="No custom cancellation explanations need review.">Other explanations will wait here until an administrator reviews them.</Empty>}
      {list.map((t) => (<Panel key={t.id}>
          <div className="row between">
            <h2>{t.subject}</h2>
            <Status value={t.status}/>
          </div>
          <small>
            {t.name} · {t.email} · {dateLabel(t.created_at)}
          </small>
          <p className="pre-line">{t.message}</p>
          {t.booking_id && (<Link href={`/bookings/${t.booking_id}`} className="text-link">
              View related booking
            </Link>)}
          <ActionForm action="ticket.respond" data={{ id: t.id }}>
            <Field label="Administrator response">
              <textarea name="response" minLength={3} required rows={3} defaultValue={t.response}/>
            </Field>
            <Field label="Ticket status">
              <select name="status" defaultValue={t.status}>
                {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (<option key={s}>{s}</option>))}
              </select>
            </Field>
            <button className="btn">Save reply & notify customer</button>
          </ActionForm>
        </Panel>))}
      {!list.length && <Empty title="All caught up.">No support tickets yet.</Empty>}
    </>);
}

export async function AdminMessageReports({ user }: { user: User }) {
    const reports = await bookingMessageReports(user);
    return (<>
      <Heading eyebrow="TRUST & SAFETY" title="Message reports" description="Review only the reported message and its booking context. Full conversation histories are not shown here."/>
      {reports.map((report) => <Panel key={report.id}>
        <div className="row between">
          <div><h2>{human(report.category)} report</h2><small>Reported by {report.reporter_name} · sent by {report.sender_name} · {dateLabel(report.created_at)}</small></div>
          <Status value={report.status}/>
        </div>
        <blockquote className="reported-message">{report.message_body}</blockquote>
        {report.details && <p className="pre-line"><strong>Report details:</strong> {report.details}</p>}
        <p><strong>Provider:</strong> {report.provider_name} · <strong>Booking:</strong> {report.booking_title}</p>
        <Link href={`/bookings/${report.booking_id}`} className="text-link">Open booking context</Link>
        {report.status === 'OPEN' ? <ActionForm action="message-report.review" data={{ id: report.id }}>
          <Field label="Review outcome"><select name="status" defaultValue="REVIEWED"><option value="REVIEWED">Reviewed; no further action</option><option value="RESOLVED">Resolved; follow-up completed</option></select></Field>
          <Field label="Internal review note" hint="Visible to administrators only."><textarea name="internalNote" maxLength={2000} rows={3}/></Field>
          <button className="btn">Save report review</button>
        </ActionForm> : report.internal_note && <p className="pre-line"><strong>Internal note:</strong> {report.internal_note}</p>}
      </Panel>)}
      {!reports.length && <Empty title="No message reports." >Reports submitted by booking participants will appear here.</Empty>}
    </>);
}
