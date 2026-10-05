import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth';
import { executeAction } from '@/server/actions';
import { invalidatePublicData } from '@/server/cache-invalidation';
import { assert, requireRole } from '@/lib/domain';
import { checkOrigin, errorResponse } from '@/server/http';
export async function POST(request: NextRequest) {
    try {
        checkOrigin(request);
        assert(Number(request.headers.get('content-length') || 0) < 100000, 'Request is too large.', 413);
        const user = await currentUser();
        requireRole(user, 'CUSTOMER', 'PROVIDER', 'ADMIN');
        const body = z
            .object({ action: z.string(), data: z.record(z.string(), z.unknown()) })
            .parse(await request.json());
        const result = await executeAction(user, body.action, body.data);
        invalidatePublicData(body.action);
        return NextResponse.json(result);
    }
    catch (error) {
        return errorResponse(error);
    }
}
