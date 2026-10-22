import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkOrigin, errorResponse } from '@/server/http';
import { currentUser } from '@/server/auth';
import { requireRole, assert } from '@/lib/domain';
import { all, one } from '@/server/db';
import { bundles, service } from '@/server/queries';
import { validateVoucher } from '@/server/vouchers';
export async function POST(request: NextRequest) {
    try {
        checkOrigin(request);
        const user = await currentUser();
        requireRole(user, 'CUSTOMER');
        const d = z
            .object({
            packageId: z.string().max(128).optional(),
            bundleId: z.string().max(128).optional(),
            addons: z.array(z.string().max(128)).max(20).default([]),
            voucher: z.string().max(128).default(''),
        })
            .parse(await request.json());
        let subtotal = 0;
        let categories: string[] = [];
        if (d.bundleId) {
            const b = (await bundles(undefined, false, d.bundleId))[0];
            assert(b?.ready, 'Bundle is unavailable.');
            subtotal = b.total;
            categories = b.items.map((i) => i.category_id);
        }
        else {
            const p = (await one<{
                price: number;
                service_id: string;
            }>('SELECT price,service_id FROM packages WHERE id=? AND active=1', d.packageId || ''));
            assert(p, 'Choose an available package.');
            const s = (await service(p.service_id));
            assert(s, 'Service is unavailable.');
            subtotal = p.price;
            categories = [s.category_id];
            assert(new Set(d.addons).size === d.addons.length, 'Duplicate add-ons.');
            const addons = d.addons.length
                ? await all<{ id: string; price: number }>(
                    `SELECT id,price FROM addons WHERE service_id=? AND active=1
                     AND id IN (SELECT value FROM jsonb_array_elements_text(?::text::jsonb))`,
                    s.id,
                    JSON.stringify(d.addons),
                )
                : [];
            assert(addons.length === d.addons.length, 'Add-on unavailable.');
            subtotal += addons.reduce((sum, addon) => sum + addon.price, 0);
        }
        const discount = d.voucher
            ? (await validateVoucher(d.voucher, user.id, subtotal, categories)).discount
            : 0;
        return NextResponse.json({
            subtotal,
            discount,
            total: subtotal - discount,
            message: d.voucher ? 'Voucher applied to this estimate.' : 'Estimate updated.',
        });
    }
    catch (error) {
        return errorResponse(error);
    }
}
