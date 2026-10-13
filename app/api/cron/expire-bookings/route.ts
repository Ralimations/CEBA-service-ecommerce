import { NextRequest, NextResponse } from 'next/server';
import { expireDueBookings } from '@/server/bookings';
import { validCronAuthorization } from '@/server/cron-auth';

export async function GET(request: NextRequest) {
  if (!validCronAuthorization(request.headers.get('authorization')))
    return NextResponse.json({ error: 'Unauthorized.' }, {
      status: process.env.CRON_SECRET ? 401 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  const result = await expireDueBookings();
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
