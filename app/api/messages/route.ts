import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assert } from '@/lib/domain';
import { currentUser } from '@/server/auth';
import { checkOrigin, errorResponse } from '@/server/http';
import { readConversation, sendBookingMessage } from '@/server/messages';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    const itemId = z.string().uuid().parse(request.nextUrl.searchParams.get('itemId'));
    return NextResponse.json(await readConversation(user!, itemId), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const length = Number(request.headers.get('content-length') || 0);
    assert(!length || length <= 10_000, 'Message request is too large.', 413);
    const body = await request.text();
    assert(new TextEncoder().encode(body).byteLength <= 10_000, 'Message request is too large.', 413);
    return NextResponse.json(await sendBookingMessage((await currentUser())!, JSON.parse(body)), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
