import { z } from 'zod';
import { hashToken } from './security';
import { all, id, insert, one, run, transaction, now, audit } from './db';
import { assert, requireRole, type User } from '@/lib/domain';

const appealSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  accountType: z.enum(['CUSTOMER', 'PROVIDER', 'UNSURE']).default('UNSURE'),
  category: z.enum(['SUSPENSION_REVIEW', 'ACCOUNT_HELP']),
  reference: z.string().trim().max(100).default(''),
  message: z.string().trim().min(20).max(3000),
  website: z.string().max(200).optional().default(''),
});

export const publicAppealConfirmation =
  'Thank you. Your request has been recorded for administrator review. This form does not restore account access, and no email reply is sent.';

export async function submitPublicAppeal(input: unknown) {
  const data = appealSchema.parse(input);
  if (data.website) return { message: publicAppealConfirmation };

  const emailHash = hashToken(data.email);
  return transaction(async () => {
    const at = now();
    const rate = await one<{ request_count: number }>(
      `INSERT INTO public_support_rate_limits(email_hash,window_started_at,request_count)
       VALUES(?,?,1)
       ON CONFLICT(email_hash) DO UPDATE SET
         window_started_at=CASE WHEN public_support_rate_limits.window_started_at < ?::timestamptz THEN excluded.window_started_at ELSE public_support_rate_limits.window_started_at END,
         request_count=CASE WHEN public_support_rate_limits.window_started_at < ?::timestamptz THEN 1 ELSE public_support_rate_limits.request_count+1 END
       RETURNING request_count`,
      emailHash,
      at,
      new Date(Date.now() - 15 * 60_000).toISOString(),
      new Date(Date.now() - 15 * 60_000).toISOString(),
    );
    if (!rate || rate.request_count > 3) return { message: publicAppealConfirmation };

    await insert('public_account_support', {
      id: id(),
      submitted_email: data.email,
      email_hash: emailHash,
      account_type: data.accountType,
      category: data.category,
      message: data.message,
      reference_number: data.reference,
    });
    await run('DELETE FROM public_support_rate_limits WHERE window_started_at < ?::timestamptz', new Date(Date.now() - 24 * 60 * 60_000).toISOString());
    return { message: publicAppealConfirmation };
  });
}

export async function reviewPublicAppeal(user: User, input: unknown) {
  requireRole(user, 'ADMIN');
  const data = z.object({
    id: z.string().uuid(),
    status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']),
    internalNotes: z.string().trim().max(3000).default(''),
    followUpRequired: z.boolean().default(true),
  }).parse(input);
  return transaction(async () => {
    const result = await run(
      'UPDATE public_account_support SET status=?,internal_notes=?,follow_up_required=?,reviewed_at=?,reviewed_by=? WHERE id=?',
      data.status,
      data.internalNotes,
      data.followUpRequired,
      now(),
      user.id,
      data.id,
    );
    assert(result.changes === 1, 'Account-support request not found.', 404);
    await audit(user.id, 'Public account-support request reviewed', data.id, data.status);
    return { message: 'Review status and internal notes saved. No email was sent and account access was not changed.' };
  });
}

export async function publicAppealsForAdmin(user: User) {
  requireRole(user, 'ADMIN');
  return all<{
    id: string;
    submitted_email: string;
    account_type: string;
    category: string;
    message: string;
    reference_number: string;
    status: string;
    internal_notes: string;
    follow_up_required: boolean;
    created_at: string;
    reviewed_at: string | null;
  }>('SELECT id,submitted_email,account_type,category,message,reference_number,status,internal_notes,follow_up_required,created_at,reviewed_at FROM public_account_support ORDER BY created_at DESC LIMIT 200');
}
