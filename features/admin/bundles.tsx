import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { all } from '@/server/db';
import { bundles } from '@/server/queries';
import { Heading, Panel, Field, Status, DataTable, Price, Empty } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/action-form';
import { money } from '@/lib/format';
export function AdminBundles() {
  const list = bundles(undefined, true);
  return (
    <>
      <Heading
        title="Thoughtful teams, brought together."
        description="Curate packages from different suppliers. All must approve before a bundle is bookable."
        action={
          <Link href="/admin/bundles/new" className="btn">
            <Plus size={17} />
            Create bundle
          </Link>
        }
      />
      <div className="management-grid">
        {list.map((b) => (
          <Panel key={b.id}>
            <img className="management-image" src={b.image} alt={b.name} />
            <Status value={b.status} />
            <h3>{b.name}</h3>
            <p>{b.description}</p>
            <Price value={b.total} />
            <p>
              {b.items.filter((i) => i.approval === 'ACCEPTED').length} / {b.items.length} providers
              approved · {b.discount_percent}% discount
            </p>
            <Link className="btn secondary" href={`/admin/bundles/${b.id}`}>
              Manage bundle
            </Link>
          </Panel>
        ))}
      </div>
      {!list.length && (
        <Empty title="Your first celebration team is waiting.">
          Create a bundle to invite participating providers.
        </Empty>
      )}
    </>
  );
}
export function AdminBundleEditor({ bundleId }: { bundleId?: string }) {
  const b = bundleId ? bundles(undefined, true).find((b) => b.id === bundleId) : undefined;
  if (bundleId && !b) notFound();
  const packages = all<{
    id: string;
    name: string;
    price: number;
    title: string;
    business_name: string;
  }>(
    "SELECT k.*,s.title,p.business_name FROM packages k JOIN services s ON s.id=k.service_id JOIN providers p ON p.id=s.provider_id WHERE k.active=1 AND s.status='ACTIVE' AND s.moderated=0 ORDER BY p.business_name",
  );
  return (
    <>
      <Heading
        title={b ? b.name : 'Bring a celebration team together.'}
        description="Saving bundle details returns it to draft and requests fresh supplier approval."
      />
      <Panel>
        <ActionForm action="bundle.save" data={b ? { id: b.id } : {}}>
          <Field label="Bundle name">
            <input name="name" required minLength={3} defaultValue={b?.name} />
          </Field>
          <Field label="Description">
            <textarea
              name="description"
              rows={4}
              required
              minLength={10}
              defaultValue={b?.description}
            />
          </Field>
          <div className="two-grid">
            <Field label="Cover image URL">
              <input name="image" defaultValue={b?.image || '/images/decor.jpg'} />
            </Field>
            <Field label="Bundle discount (%)">
              <input
                name="discount"
                type="number"
                min={0}
                max={50}
                required
                defaultValue={b?.discount_percent ?? 5}
              />
            </Field>
          </div>
          <button className="btn">Save bundle draft</button>
        </ActionForm>
      </Panel>
      {b && (
        <>
          <Panel>
            <div className="row between">
              <h2>Participation & terms</h2>
              <Status value={b.status} />
            </div>
            <DataTable
              headings={['Provider / package', 'Agreed price', 'Terms', 'Approval', 'Actions']}
            >
              {b.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.business_name}</strong>
                    <small>
                      {i.package_name} · {i.service_title}
                    </small>
                  </td>
                  <td>{money(i.price)}</td>
                  <td>
                    <details>
                      <summary>Read terms</summary>
                      <p className="pre-line">{i.inclusions}</p>
                      <p>Exclusions: {i.exclusions}</p>
                      <p>{i.terms}</p>
                    </details>
                  </td>
                  <td>
                    <Status value={i.approval} />
                  </td>
                  <td>
                    {b.status === 'DRAFT' && (
                      <ActionButton
                        action="bundle.remove"
                        data={{ id: i.id }}
                        label="Remove"
                        confirm="Remove this supplier from the draft bundle? Existing booking snapshots are retained."
                      />
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
            <div className="row between">
              <p>
                Bundle customer price · <strong>{money(b.total)}</strong>
              </p>
              <div className="button-row">
                {b.status !== 'PUBLISHED' && (
                  <ActionButton
                    action="bundle.status"
                    data={{ id: b.id, status: 'PUBLISHED' }}
                    label="Publish bundle"
                    variant="primary"
                  />
                )}
                {b.status === 'PUBLISHED' && (
                  <ActionButton
                    action="bundle.status"
                    data={{ id: b.id, status: 'DRAFT' }}
                    label="Unpublish"
                  />
                )}
                {b.status !== 'ARCHIVED' && (
                  <ActionButton
                    action="bundle.status"
                    data={{ id: b.id, status: 'ARCHIVED' }}
                    label="Archive"
                  />
                )}
                {b.status === 'ARCHIVED' && (
                  <ActionButton
                    action="bundle.status"
                    data={{ id: b.id, status: 'DRAFT' }}
                    label="Restore draft"
                  />
                )}
              </div>
            </div>
          </Panel>
          {b.status === 'DRAFT' && (
            <Panel>
              <h2>Invite a supplier package</h2>
              <ActionForm action="bundle.add" data={{ bundleId: b.id }} reset>
                <Field label="Eligible service package">
                  <select name="packageId">
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.business_name} · {p.title} · {p.name} ({money(p.price)})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Proposed bundle-specific price (PHP)">
                  <input name="price" type="number" step="0.01" min={0.01} required />
                </Field>
                <Field label="Proposed participation terms">
                  <textarea
                    name="terms"
                    rows={3}
                    defaultValue={`Subject to ${b.discount_percent}% bundle discount, eligible vouchers, and the platform fee. Supplier may revise before accepting.`}
                  />
                </Field>
                <button className="btn">Send provider invitation</button>
              </ActionForm>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
