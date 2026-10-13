import { timingSafeEqual } from 'node:crypto';

export function validCronAuthorization(header: string | null, secret = process.env.CRON_SECRET) {
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
