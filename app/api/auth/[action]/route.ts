import { NextRequest, NextResponse } from 'next/server';
import { login, register, logout, COOKIE, homeFor } from '@/server/auth';
import { checkOrigin, errorResponse } from '@/server/http';
import { assert } from '@/lib/domain';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: {
    params: Promise<{
        action: string;
    }>;
}) {
    try {
        checkOrigin(request);
        const { action } = await context.params;
        assert(['login', 'register', 'logout'].includes(action), 'Not found.', 404);
        if (action === 'logout') {
            (await logout(request.cookies.get(COOKIE)?.value));
            const response = NextResponse.json({ redirect: '/', message: 'Signed out.' });
            response.cookies.set(COOKIE, '', { maxAge: 0, path: '/' });
            return response;
        }
        const body = await request.json();
        const result = action === 'login' ? (await login(body)) : (await register(body));
        const response = NextResponse.json({
            redirect: homeFor(result.role),
            message: action === 'login' ? 'Welcome back.' : 'Your account is ready.',
        });
        response.cookies.set(COOKIE, result.token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.COOKIE_SECURE === 'true',
            path: '/',
            expires: result.expires,
        });
        return response;
    }
    catch (error) {
        return errorResponse(error);
    }
}
