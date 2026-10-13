import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { checkOrigin, errorResponse } from '@/server/http';
import { assert } from '@/lib/domain';
import { reportBookingMessage } from '@/server/messages';

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    assert(Number(request.headers.get('content-length') || 0) <= 5000, 'Report request is too large.', 413);
    const body = await request.text();
    assert(new TextEncoder().encode(body).byteLength <= 5000, 'Report request is too large.', 413);
    return NextResponse.json(await reportBookingMessage((await currentUser())!, JSON.parse(body)), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
