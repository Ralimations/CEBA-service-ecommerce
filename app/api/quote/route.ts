import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkOrigin, errorResponse } from '@/server/http';
import { currentUser } from '@/server/auth';
import { requireRole, assert } from '@/lib/domain';
import { one } from '@/server/db';
import { bundles, service } from '@/server/queries';
import { validateVoucher } from '@/server/vouchers';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const user = await currentUser();
    requireRole(user, 'CUSTOMER');
    const d = z
      .object({
        packageId: z.string().optional(),
        bundleId: z.string().optional(),
        addons: z.array(z.string()).default([]),
        voucher: z.string().default(''),
      })
      .parse(await request.json());
    let subtotal = 0;
    let categories: string[] = [];
    if (d.bundleId) {
      const b = bundles().find((b) => b.id === d.bundleId);
      assert(b?.ready, 'Bundle is unavailable.');
      subtotal = b.total;
      categories = b.items.map((i) => i.category_id);
    } else {
      const p = one<{ price: number; service_id: string }>(
        'SELECT * FROM packages WHERE id=? AND active=1',
        d.packageId || '',
      );
      assert(p, 'Choose an available package.');
      const s = service(p.service_id);
      assert(s, 'Service is unavailable.');
      subtotal = p.price;
      categories = [s.category_id];
      assert(new Set(d.addons).size === d.addons.length, 'Duplicate add-ons.');
      for (const addonId of d.addons) {
        const a = one<{ price: number }>(
          'SELECT price FROM addons WHERE id=? AND service_id=? AND active=1',
          addonId,
          s.id,
        );
        assert(a, 'Add-on unavailable.');
        subtotal += a.price;
      }
    }
    const discount = d.voucher
      ? validateVoucher(d.voucher, user.id, subtotal, categories).discount
      : 0;
    return NextResponse.json({
      subtotal,
      discount,
      total: subtotal - discount,
      message: d.voucher ? 'Voucher applied to this estimate.' : 'Estimate updated.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
