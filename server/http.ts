import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assert, DomainError } from '@/lib/domain';
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowed = new Set([process.env.APP_ORIGIN || request.nextUrl.origin]);
  // Next normalizes local request hostnames. Permit loopback aliases only for
  // a loopback application origin, with the exact configured protocol and port.
  const base = new URL(process.env.APP_ORIGIN || request.nextUrl.origin);
  if (['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
    for (const host of ['localhost', '127.0.0.1', '[::1]'])
      allowed.add(`${base.protocol}//${host}${base.port ? `:${base.port}` : ''}`);
  }
  assert(!!origin && allowed.has(origin), 'Request origin is not allowed.', 403);
  assert(
    (request.headers.get('content-type') || '').includes('application/json'),
    'Use a JSON request.',
    415,
  );
}
export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      {
        error: 'Please check the highlighted fields.',
        fields: Object.fromEntries(error.issues.map((i) => [i.path.join('.'), i.message])),
      },
      { status: 400 },
    );
  if (error instanceof DomainError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Marketplace request failed:', error);
  return NextResponse.json(
    { error: 'Something went wrong. Your change was not completed. Please try again.' },
    { status: 500 },
  );
}
