import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus, ArrowUpRight } from 'lucide-react';
import { all, one } from '@/server/db';
import { providerByUser } from '@/server/queries';
import { activeCategories } from '@/server/auth';
import type { User } from '@/lib/domain';
import type { Service, Package } from '@/types/models';
import {
  Heading,
  Panel,
  Field,
  Status,
  Empty,
  Price,
  SectionHeading,
  Badge,
} from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/action-form';
import { money } from '@/lib/format';
export function ProviderServices({ user }: { user: User }) {
  const p = providerByUser(user.id);
  const list = all<Service>(
    'SELECT * FROM services WHERE provider_id=? ORDER BY created_at DESC',
    p.id,
  );
  return (
    <>
      <Heading
        eyebrow="YOUR WORK, YOUR WAY"
        title="Your services"
        description="Build thoughtful experiences for your next customers."
        action={
          <Link className="btn" href="/provider/services/new">
            <Plus size={17} />
            Create service
          </Link>
        }
      />
      <div className="service-grid provider-service-grid">
        {list.map((s) => (
          <Panel key={s.id}>
            <img className="management-image" src={s.image} alt={s.title} />
            <div className="row between">
              <Status value={s.status} />
              {!!s.moderated && <Badge tone="red">Disabled by admin</Badge>}
            </div>
            <h3>{s.title}</h3>
            <Price value={s.base_price} from />
            <div className="button-row">
              <Link className="btn small secondary" href={`/provider/services/${s.id}`}>
                Manage service
              </Link>
              {s.status === 'ACTIVE' && !s.moderated && (
                <Link className="text-link" href={`/services/${s.id}`}>
                  Preview
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </Panel>
        ))}
      </div>
      {!list.length && (
        <Empty
          title="Your first service starts here."
          href="/provider/services/new"
          label="Create your first service"
        >
          Add a service, set your packages, and open the door to new celebrations.
        </Empty>
      )}
    </>
  );
}
export function ServiceEditor({ user, serviceId }: { user: User; serviceId?: string }) {
  const p = providerByUser(user.id);
  const s = serviceId
    ? one<Service>('SELECT * FROM services WHERE id=? AND provider_id=?', serviceId, p.id)
    : undefined;
  if (serviceId && !s) notFound();
  const packs = s
    ? all<Package>('SELECT * FROM packages WHERE service_id=? ORDER BY price', s.id)
    : [];
  return (
    <>
      <Heading
        eyebrow="PROVIDER STUDIO"
        title={s ? 'Shape your service' : 'Create something worth celebrating'}
        description={
          s
            ? 'Update your listing, packages, and optional extras.'
            : 'Start with the essentials. Your listing stays a draft until you add a package.'
        }
      />
      <Panel>
        <ActionForm action="service.save" data={s ? { id: s.id } : {}}>
          <div className="two-grid">
            <Field label="Service title">
              <input name="title" required minLength={3} defaultValue={s?.title} />
            </Field>
            <Field label="Category">
              <select name="categoryId" defaultValue={s?.category_id || p.category_id}>
                {activeCategories().map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Service description">
            <textarea
              name="description"
              required
              minLength={10}
              rows={5}
              defaultValue={s?.description}
            />
          </Field>
          <div className="three-grid">
            <Field label="Starting price (PHP)">
              <input
                name="price"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={s ? s.base_price / 100 : 5000}
              />
            </Field>
            <Field label="Pricing unit">
              <input name="unit" required defaultValue={s?.unit || 'event'} />
            </Field>
            <Field label="Estimated duration">
              <input name="duration" required defaultValue={s?.duration || '4 hours'} />
            </Field>
            <Field label="Minimum guests">
              <input
                name="minGuests"
                type="number"
                min={1}
                required
                defaultValue={s?.min_guests || 1}
              />
            </Field>
            <Field label="Maximum guests">
              <input
                name="maxGuests"
                type="number"
                min={1}
                required
                defaultValue={s?.max_guests || 500}
              />
            </Field>
            <Field label="Listing status">
              <select name="status" defaultValue={s?.status || 'DRAFT'}>
                {['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'].map((st) => (
                  <option value={st} key={st} disabled={!s && st === 'ACTIVE'}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Cover image URL"
            hint="Use an HTTPS image URL or a bundled /images/ file. The local demo includes photography.jpg, catering.jpg, decor.jpg, makeup.jpg, bar.jpg, venue.jpg, and event.jpg."
          >
            <input name="image" defaultValue={s?.image || '/images/event.jpg'} />
          </Field>
          <button className="btn">{s ? 'Save service' : 'Create draft service'}</button>
        </ActionForm>
      </Panel>
      {s && (
        <>
          <SectionHeading
            title="Packages"
            description="At least one active package is needed before publishing. Existing bookings keep their original terms."
          />
          {packs.map((pack) => (
            <details className="editor-details" key={pack.id}>
              <summary>
                <span>
                  {pack.name} · {money(pack.price)}
                </span>
                <Status value={pack.active ? 'ACTIVE' : 'ARCHIVED'} />
              </summary>
              <PackageEditor serviceId={s.id} pack={pack} />
            </details>
          ))}
          <Panel>
            <h3>Add a package</h3>
            <PackageEditor serviceId={s.id} />
          </Panel>
          <Panel>
            <h3>A little extra · add-ons</h3>
            {all<{ id: string; name: string; price: number }>(
              'SELECT * FROM addons WHERE service_id=? AND active=1',
              s.id,
            ).map((a) => (
              <div className="row between list-row" key={a.id}>
                <span>
                  {a.name} · {money(a.price)}
                </span>
                <ActionButton action="addon.remove" data={{ id: a.id }} label="Archive" />
              </div>
            ))}
            <ActionForm action="addon.save" data={{ serviceId: s.id }} reset>
              <div className="two-grid">
                <Field label="Add-on name">
                  <input name="name" required minLength={2} />
                </Field>
                <Field label="Price (PHP)">
                  <input name="price" type="number" min={0} step="0.01" required />
                </Field>
              </div>
              <button className="btn secondary">Add optional extra</button>
            </ActionForm>
          </Panel>
        </>
      )}
    </>
  );
}
function PackageEditor({ serviceId, pack }: { serviceId: string; pack?: Package }) {
  return (
    <ActionForm
      action="package.save"
      data={{ serviceId, ...(pack ? { id: pack.id } : {}) }}
      reset={!pack}
    >
      <div className="three-grid">
        <Field label="Package name">
          <input name="name" required minLength={2} defaultValue={pack?.name} />
        </Field>
        <Field label="Package price (PHP)">
          <input
            name="price"
            type="number"
            min={0.01}
            step="0.01"
            required
            defaultValue={pack ? pack.price / 100 : undefined}
          />
        </Field>
        <Field label="Duration">
          <input name="duration" required defaultValue={pack?.duration || '4 hours'} />
        </Field>
      </div>
      <Field label="Description">
        <textarea name="description" rows={2} defaultValue={pack?.description} />
      </Field>
      <div className="two-grid">
        <Field label="Inclusions (one per line)">
          <textarea
            name="inclusions"
            minLength={3}
            rows={4}
            required
            defaultValue={pack?.inclusions}
          />
        </Field>
        <Field label="Exclusions">
          <textarea name="exclusions" rows={4} defaultValue={pack?.exclusions} />
        </Field>
      </div>
      <Field label="Custom terms">
        <textarea name="terms" rows={2} defaultValue={pack?.terms} />
      </Field>
      <Field label="Availability for new bookings">
        <select name="active" defaultValue={pack?.active ?? 1}>
          <option value="1">Active</option>
          <option value="0">Archived</option>
        </select>
      </Field>
      <button className="btn secondary">{pack ? 'Save package' : 'Add package'}</button>
    </ActionForm>
  );
}
export function ProviderPackages({ user }: { user: User }) {
  const p = providerByUser(user.id);
  const services = all<{ id: string; title: string }>(
    'SELECT id,title FROM services WHERE provider_id=?',
    p.id,
  );
  return (
    <>
      <Heading
        title="Your packages"
        description="The clear, thoughtful options that help customers choose."
      />
      {services.map((s) => (
        <Panel key={s.id}>
          <SectionHeading
            title={s.title}
            href={`/provider/services/${s.id}`}
            label="Manage packages"
          />
          <div className="three-grid">
            {all<Package>('SELECT * FROM packages WHERE service_id=?', s.id).map((k) => (
              <div key={k.id}>
                <h3>{k.name}</h3>
                <Price value={k.price} />
                <p>{k.description}</p>
                <Badge>{k.active ? 'Active' : 'Archived'}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      ))}
      {!services.length && (
        <Empty title="Start with a service." href="/provider/services/new" label="Create a service">
          Packages belong to your service listings.
        </Empty>
      )}
    </>
  );
}
