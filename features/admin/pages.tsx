import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { all, settings } from '@/server/db';
import { providers, dashboardStats, bookingsFor, scalar } from '@/server/queries';
import type { User } from '@/lib/domain';
import { badgeEligible } from '@/lib/domain';
import { settingLabels, defaults } from '@/config/platform';
import {
  Heading,
  Metrics,
  Panel,
  DataTable,
  Field,
  Badge,
  Status,
  SectionHeading,
  Empty,
  Rating,
} from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/action-form';
import { BookingCard } from '@/components/cards';
import { money, dateLabel, human } from '@/lib/format';
export function AdminOverview({ user }: { user: User }) {
  const stats = dashboardStats(user);
  const ps = providers();
  const monthly = all<{ month: string; count: number; volume: number }>(
    'SELECT substr(event_date,1,7) month,COUNT(*) count,SUM(total) volume FROM bookings GROUP BY month ORDER BY month DESC LIMIT 6',
  ).reverse();
  const max = Math.max(1, ...monthly.map((m) => m.volume));
  return (
    <>
      <Heading
        eyebrow="PLATFORM WORKSPACE"
        title="The bigger picture."
        description="Every person, every booking, every little detail — working together."
        action={<Badge tone="green">Local development environment</Badge>}
      />
      <Metrics
        items={[
          { label: 'Customers', value: scalar("SELECT COUNT(*) FROM users WHERE role='CUSTOMER'") },
          {
            label: 'Providers',
            value: ps.length,
            hint: `${ps.filter((p) => p.status === 'ACTIVE').length} active · ${ps.filter((p) => p.vip).length} VIP`,
          },
          { label: 'Bookings', value: stats.bookings, hint: `${stats.completed} completed` },
          { label: 'Simulated payment volume', value: money(stats.volume) },
        ]}
      />
      <Metrics
        items={[
          {
            label: 'Gross escrow held / frozen',
            value: money(
              scalar(
                "SELECT COALESCE(SUM(total),0) FROM bookings WHERE escrow_status IN ('HELD_IN_ESCROW','DISPUTED')",
              ),
            ),
          },
          {
            label: 'Open disputes',
            value: scalar("SELECT COUNT(*) FROM disputes WHERE status IN ('OPEN','UNDER_REVIEW')"),
          },
          {
            label: 'Active placements',
            value: scalar(
              "SELECT COUNT(*) FROM placements WHERE status='ACTIVE' AND starts_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')",
            ),
          },
          {
            label: 'Support queue',
            value: scalar(
              "SELECT COUNT(*) FROM support_tickets WHERE status IN ('OPEN','IN_PROGRESS')",
            ),
          },
        ]}
      />
      <div className="two-grid">
        <Panel>
          <SectionHeading
            title="Celebrations over time"
            description="Booking value by event month, from the local database."
          />
          <div className="bar-chart" role="img" aria-label="Booking value by month">
            {monthly.map((m) => (
              <div className="bar-column" key={m.month}>
                <small>{money(m.volume)}</small>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max(5, (m.volume / max) * 150)}px` }}
                />
                <strong>{m.month}</strong>
                <small>{m.count} events</small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2>A little attention goes a long way.</h2>
          <div className="admin-quick-links">
            {[
              ['/admin/disputes', 'Review open disputes', 'Protect both sides of a booking.'],
              [
                '/admin/bundles',
                'Curate a celebration team',
                'Review supplier approvals and publish bundles.',
              ],
              ['/admin/support', 'Answer a support request', 'Keep people and their plans moving.'],
              [
                '/admin/settings',
                'Tune platform rules',
                'Fees, loyalty, badges, and promotion defaults.',
              ],
            ].map(([href, title, description]) => (
              <Link key={href} href={href}>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <SectionHeading title="Recent booking activity" href="/admin/bookings" />
      {bookingsFor(user)
        .slice(0, 5)
        .map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
    </>
  );
}
export function AdminUsers({ q = '', role = '' }: { q?: string; role?: string }) {
  const users = all<User>(
    "SELECT id,name,email,phone,role,status,referral_code,created_at FROM users WHERE (name LIKE ? OR email LIKE ?) AND (?='' OR role=?) ORDER BY created_at DESC",
    `%${q}%`,
    `%${q}%`,
    role,
    role,
  );
  return (
    <>
      <Heading
        title="The people behind the plans."
        description="Manage customer and provider access. Suspending an account also ends its sessions."
      />
      <form className="admin-search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          aria-label="Search users"
        />
        <select name="role" defaultValue={role} aria-label="Filter user role">
          <option value="">All roles</option>
          <option>CUSTOMER</option>
          <option>PROVIDER</option>
          <option>ADMIN</option>
        </select>
        <button className="btn secondary">Filter users</button>
      </form>
      <Panel>
        <DataTable headings={['Person', 'Role', 'Joined', 'Status', 'Actions']}>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <strong>{u.name}</strong>
                <small>{u.email}</small>
              </td>
              <td>{human(u.role)}</td>
              <td>{dateLabel(u.created_at)}</td>
              <td>
                <Status value={u.status} />
              </td>
              <td>
                {u.role !== 'ADMIN' && (
                  <ActionButton
                    action="user.status"
                    data={{ id: u.id, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }}
                    label={u.status === 'ACTIVE' ? 'Suspend' : 'Restore access'}
                    confirm={
                      u.status === 'ACTIVE'
                        ? `Suspend ${u.name} and end all active sessions?`
                        : undefined
                    }
                  />
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      {!users.length && <Empty title="No matching people.">Try a different search.</Empty>}
    </>
  );
}
export function AdminProviders() {
  return (
    <>
      <Heading
        title="Good people, thoughtfully managed."
        description="Review profiles, visibility plans, and marketplace standing."
      />
      <div className="management-grid">
        {providers().map((p) => (
          <Panel key={p.id}>
            <div className="row between">
              <span className="avatar">{p.business_name[0]}</span>
              <Status value={p.status} />
            </div>
            <h3>{p.business_name}</h3>
            <p>
              {p.category_name} · {p.area}
            </p>
            <Rating value={p.rating} count={p.review_count} />
            <p>
              {p.completed} completed jobs · {p.disputes} open disputes
            </p>
            <div className="row wrap">
              <Badge>{p.vip ? 'VIP plan' : 'Classic plan'}</Badge>
              {p.trusted && <Badge tone="green">Trusted</Badge>}
              {p.best && <Badge tone="amber">Best Service</Badge>}
            </div>
            <div className="button-row">
              <ActionButton
                action="provider.verify"
                data={{ id: p.id, verified: p.verified ? 0 : 1 }}
                label={p.verified ? 'Undo profile review' : 'Approve profile'}
              />
              <Link href={`/providers/${p.id}`} className="btn secondary small">
                Inspect profile
              </Link>
            </div>
            <ActionButton
              action="user.status"
              data={{ id: p.user_id, status: p.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }}
              label={p.status === 'ACTIVE' ? 'Suspend provider' : 'Restore provider'}
              confirm="Change this provider’s account access? Existing booking records will be retained."
            />
          </Panel>
        ))}
      </div>
    </>
  );
}
export function AdminServices({ q = '' }: { q?: string }) {
  const list = all<{
    id: string;
    title: string;
    business_name: string;
    category: string;
    status: string;
    moderated: number;
  }>(
    `SELECT s.*,p.business_name,c.name category FROM services s JOIN providers p ON p.id=s.provider_id JOIN categories c ON c.id=s.category_id WHERE s.title LIKE ? OR p.business_name LIKE ? ORDER BY s.created_at DESC`,
    `%${q}%`,
    `%${q}%`,
  );
  return (
    <>
      <Heading
        title="A marketplace worth browsing."
        description="Inspect listings and disable or restore inappropriate content."
      />
      <form className="admin-search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search a service or business"
          aria-label="Search listings"
        />
        <button className="btn secondary">Search</button>
      </form>
      <Panel>
        <DataTable
          headings={['Service / provider', 'Category', 'Status', 'Packages', 'Moderation']}
        >
          {list.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/services/${s.id}`}>{s.title}</Link>
                <small>{s.business_name}</small>
              </td>
              <td>{s.category}</td>
              <td>
                <Status value={s.status} />
              </td>
              <td>
                <details>
                  <summary>Inspect packages</summary>
                  {all<{ name: string; price: number; inclusions: string }>(
                    'SELECT * FROM packages WHERE service_id=?',
                    s.id,
                  ).map((p, i) => (
                    <div key={i}>
                      <strong>
                        {p.name} · {money(p.price)}
                      </strong>
                      <p className="pre-line">{p.inclusions}</p>
                    </div>
                  ))}
                </details>
              </td>
              <td>
                <ActionButton
                  action="service.moderate"
                  data={{ id: s.id, disabled: s.moderated ? 0 : 1 }}
                  label={s.moderated ? 'Restore listing' : 'Disable listing'}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
export function AdminCategories() {
  const list = all<{ id: string; name: string; active: number }>(
    'SELECT * FROM categories ORDER BY rowid',
  );
  return (
    <>
      <Heading
        title="A place for every kind of talent."
        description="Manage service categories. Deactivated categories disappear from discovery."
      />
      <Panel>
        <h2>Add a category</h2>
        <ActionForm action="category.save" data={{ active: 1 }} reset>
          <div className="row">
            <Field label="Category name">
              <input name="name" required minLength={2} />
            </Field>
            <button className="btn">Create category</button>
          </div>
        </ActionForm>
      </Panel>
      <div className="management-grid">
        {list.map((c) => (
          <Panel key={c.id}>
            <ActionForm action="category.save" data={{ id: c.id }}>
              <Field label="Category name">
                <input name="name" defaultValue={c.name} required minLength={2} />
              </Field>
              <Field label="Visibility">
                <select name="active" defaultValue={c.active}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </Field>
              <button className="btn secondary">Save category</button>
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
export function AdminBadges() {
  const rules = settings();
  return (
    <>
      <Heading
        title="Trust is earned in the details."
        description={`Trusted: ${rules.trustedRating}+ stars and ${rules.trustedJobs}+ jobs. Best Service: ${rules.bestRating}+ stars and ${rules.bestJobs}+ jobs. Both require no unresolved disputes.`}
        action={
          <Link href="/admin/settings" className="btn secondary">
            Edit eligibility rules
          </Link>
        }
      />
      <Panel>
        <p className="notice">
          Eligible providers earn badges automatically unless an administrator revokes them. Grants
          must still meet the current rules; payment never grants a trust badge.
        </p>
        <DataTable
          headings={['Provider', 'Rating / jobs', 'Disputes', 'Trusted Provider', 'Best Service']}
        >
          {providers().map((p) => (
            <tr key={p.id}>
              <td>{p.business_name}</td>
              <td>
                {p.rating.toFixed(1)} / {p.completed} jobs
              </td>
              <td>{p.disputes}</td>
              {['TRUSTED', 'BEST_SERVICE'].map((b) => {
                const eligible = badgeEligible(p.rating, p.completed, p.disputes, b, rules);
                const held = b === 'TRUSTED' ? p.trusted : p.best;
                return (
                  <td key={b}>
                    <Badge tone={held ? 'green' : 'neutral'}>
                      {held ? 'Awarded' : eligible ? 'Eligible' : 'Not yet eligible'}
                    </Badge>
                    <ActionButton
                      action="badge.save"
                      data={{ providerId: p.id, badge: b, granted: held ? 0 : 1 }}
                      label={held ? 'Revoke' : 'Grant'}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
export function AdminSettings() {
  const values = settings();
  return (
    <>
      <Heading
        title="The rules behind good experiences."
        description="Persisted development values, centrally applied across the marketplace."
      />
      <Panel>
        <ActionForm
          action="settings.save"
          confirm="Save these platform rules? New bookings and eligibility calculations will use the updated values."
        >
          <div className="three-grid">
            {(Object.keys(defaults) as (keyof typeof defaults)[]).map((key) => (
              <Field key={key} label={settingLabels[key]}>
                <input
                  name={key}
                  type="number"
                  required
                  min={0}
                  max={key.includes('Rating') ? 5 : undefined}
                  step={['trustedRating', 'bestRating', 'platformFee'].includes(key) ? 0.1 : 1}
                  defaultValue={values[key]}
                />
              </Field>
            ))}
          </div>
          <button className="btn">Save platform settings</button>
        </ActionForm>
      </Panel>
      <p className="subtle-note">
        Fees are included in the customer total and deducted from supplier allocations. Historical
        bookings retain their agreed amounts. Welcome voucher changes can require an unpaid request
        to be recreated.
      </p>
    </>
  );
}
export function AdminAudit() {
  const list = all<{
    id: string;
    action: string;
    target: string;
    detail: string;
    created_at: string;
    name: string;
  }>(
    'SELECT a.*,u.name FROM audit_log a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200',
  );
  return (
    <>
      <Heading
        title="A clear record of every decision."
        description="Append-only administrator audit trail. Booking-specific events also appear on each booking."
      />
      <Panel>
        <DataTable headings={['When', 'Actor', 'Action', 'Target', 'Details']}>
          {list.map((a) => (
            <tr key={a.id}>
              <td>{dateLabel(a.created_at)}</td>
              <td>{a.name}</td>
              <td>{a.action}</td>
              <td className="mono">{a.target}</td>
              <td className="break-text">{a.detail}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
