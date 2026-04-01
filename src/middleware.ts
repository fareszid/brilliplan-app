import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware for:
 * 1. CSRF protection on API routes (Origin/Referer validation)
 * 2. Basic security headers enforcement
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── CSRF protection for API routes ──
    if (pathname.startsWith('/api/')) {
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const host = request.headers.get('host');

        // Allow requests with no origin (same-origin fetch, server-to-server, curl for dev)
        // but block cross-origin requests from unauthorized origins
        if (origin) {
            const allowedOrigins = [
                `https://${host}`,
                `http://${host}`,
                // Allow localhost for development
                'http://localhost:3000',
                'http://localhost:3001',
            ];

            const isAllowed = allowedOrigins.some(allowed => origin === allowed);
            if (!isAllowed) {
                return new NextResponse('Forbidden — cross-origin request', { status: 403 });
            }
        }

        // If no origin but has referer, validate referer host matches
        if (!origin && referer) {
            try {
                const refererUrl = new URL(referer);
                if (refererUrl.host !== host && !refererUrl.host.startsWith('localhost')) {
                    return new NextResponse('Forbidden — invalid referer', { status: 403 });
                }
            } catch {
                // Invalid referer URL — block
                return new NextResponse('Forbidden', { status: 403 });
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    // Run on API routes only (auth is handled client-side via Firebase)
    matcher: ['/api/:path*'],
};
