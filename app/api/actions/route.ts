import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth';
import { executeAction } from '@/server/actions';
import { assert, requireRole } from '@/lib/domain';
import { checkOrigin, errorResponse } from '@/server/http';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    assert(
      Number(request.headers.get('content-length') || 0) < 100000,
      'Request is too large.',
      413,
    );
    const user = await currentUser();
    requireRole(user, 'CUSTOMER', 'PROVIDER', 'ADMIN');
    const body = z
      .object({ action: z.string(), data: z.record(z.string(), z.unknown()) })
      .parse(await request.json());
    return NextResponse.json(executeAction(user, body.action, body.data));
  } catch (error) {
    return errorResponse(error);
  }
}
