import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { all, one, run, insert, id, now, transaction, notify, admins } from './db';
import { hashPassword, verifyPassword, hashToken, sessionToken } from './security';
import { assert, type User, type Role } from '@/lib/domain';
export const COOKIE = 'event_session';
export async function userFromToken(token?: string): Promise<User | null> {
    if (!token)
        return null;
    return ((await one<User>(`SELECT u.id,u.name,u.email,u.phone,u.role,u.status,u.referral_code,u.created_at FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.status='ACTIVE'`, hashToken(token), now())) ?? null);
}
export async function currentUser() {
    return (await userFromToken((await cookies()).get(COOKIE)?.value));
}
export async function requireUser(...roles: Role[]) {
    const user = await currentUser();
    if (!user)
        redirect('/login');
    if (roles.length && !roles.includes(user.role))
        redirect('/forbidden');
    return user;
}
export function homeFor(role: Role) {
    return role === 'ADMIN' ? '/admin' : role === 'PROVIDER' ? '/provider' : '/dashboard';
}
export const loginSchema = z.object({
    email: z
        .email()
        .max(200)
        .transform((x) => x.toLowerCase().trim()),
    password: z.string().min(1).max(128),
    remember: z.boolean().optional(),
});
export const registerSchema = z
    .object({
    name: z.string().trim().min(2).max(100),
    email: z
        .email()
        .max(200)
        .transform((x) => x.toLowerCase().trim()),
    password: z.string().min(10, 'Use at least 10 characters.').max(128),
    confirmPassword: z.string(),
    role: z.enum(['CUSTOMER', 'PROVIDER']),
    phone: z.string().max(40).default(''),
    businessName: z.string().max(120).default(''),
    description: z.string().max(3000).default(''),
    categoryId: z.string().default(''),
    referralCode: z.string().max(30).default(''),
})
    .refine((x) => x.password === x.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
})
    .refine((x) => x.role !== 'PROVIDER' ||
    (x.businessName.trim().length > 1 &&
        x.description.trim().length > 9 &&
        x.phone.length > 5 &&
        !!x.categoryId), {
    path: ['businessName'],
    message: 'Providers need a business name, description, category, and phone.',
});
async function createSession(userId: string, remember: boolean) {
    const token = sessionToken();
    const expires = new Date(Date.now() + (remember ? 30 : 1) * 86400000);
    (await insert('sessions', {
        token_hash: hashToken(token),
        user_id: userId,
        expires_at: expires.toISOString(),
    }));
    return { token, expires };
}
export async function login(input: unknown) {
    const data = loginSchema.parse(input);
    const key = hashToken(data.email);
    const attempt = (await one<{
        attempts: number;
        reset_at: string;
    }>('SELECT * FROM auth_attempts WHERE key=?', key));
    assert(!attempt || attempt.reset_at < now() || attempt.attempts < 10, 'Too many sign-in attempts. Try again in 15 minutes.', 429);
    const user = (await one<User & {
        password_hash: string;
    }>('SELECT * FROM users WHERE email=?', data.email));
    // Use the same expensive hash path for unknown accounts.
    const valid = verifyPassword(data.password, user?.password_hash ?? hashPassword('unknown-account-timing'));
    if (!user || !valid) {
        (await run(`INSERT INTO auth_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END`, key, new Date(Date.now() + 900000).toISOString(), now(), now()));
        assert(false, 'Email or password is incorrect.', 401);
    }
    assert(user.status === 'ACTIVE', 'This account is suspended. Contact support.', 403);
    (await run('DELETE FROM auth_attempts WHERE key=?', key));
    return { ...(await createSession(user.id, !!data.remember)), role: user.role };
}
export async function register(input: unknown) {
    const data = registerSchema.parse(input);
    return (await transaction(async () => {
        assert(!(await one('SELECT id FROM users WHERE email=?', data.email)), 'An account with this email already exists.');
        if (data.role === 'PROVIDER')
            assert((await one('SELECT id FROM categories WHERE id=? AND active=1', data.categoryId)), 'Choose an active category.');
        const referrer = data.referralCode
            ? (await one<User>("SELECT * FROM users WHERE referral_code=? AND role='CUSTOMER' AND status='ACTIVE'", data.referralCode.toUpperCase())) : null;
        assert(!data.referralCode || referrer, 'That referral code was not found.');
        const userId = id();
        (await insert('users', {
            id: userId,
            name: data.name,
            email: data.email,
            password_hash: hashPassword(data.password),
            role: data.role,
            phone: data.phone,
            referral_code: data.role === 'CUSTOMER' ? `EV${id().slice(0, 8).toUpperCase()}` : null,
        }));
        if (data.role === 'PROVIDER') {
            (await insert('providers', {
                id: id(),
                user_id: userId,
                business_name: data.businessName,
                description: data.description,
                phone: data.phone,
                category_id: data.categoryId,
            }));
            (await admins('New provider joined', `${data.businessName} is ready for profile review.`, '/admin/providers'));
        }
        else {
            const voucher = (await one<{
                id: string;
            }>("SELECT id FROM vouchers WHERE code='WELCOME10' AND active=1"));
            if (voucher)
                (await insert('voucher_wallet', { user_id: userId, voucher_id: voucher.id }));
            if (referrer)
                (await insert('referrals', { id: id(), referrer_id: referrer.id, referred_id: userId }));
            (await notify(userId, 'Your next celebration starts here', 'Your welcome voucher is ready in your wallet.', '/vouchers'));
        }
        return { ...(await createSession(userId, false)), role: data.role };
    }));
}
export async function logout(token?: string) {
    if (token)
        (await run('DELETE FROM sessions WHERE token_hash=?', hashToken(token)));
}
export const activeCategories = async () => (await all<{
    id: string;
    name: string;
    icon: string;
}>('SELECT * FROM categories WHERE active=1 ORDER BY rowid'));
