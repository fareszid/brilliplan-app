// Simple in-memory rate limiter for API routes
// In production with multiple instances, use Redis (e.g. Upstash) instead

const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store) {
        if (val.resetAt < now) store.delete(key);
    }
}, 5 * 60 * 1000);

interface RateLimitOptions {
    maxRequests?: number;   // max requests per window (default: 10)
    windowMs?: number;      // window in ms (default: 60000 = 1 min)
}

/**
 * Check rate limit for a given key (typically IP or user ID).
 * Returns null if allowed, or a Response if rate limited.
 */
export function checkRateLimit(key: string, opts?: RateLimitOptions): Response | null {
    const maxRequests = opts?.maxRequests ?? 10;
    const windowMs = opts?.windowMs ?? 60_000;
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return null;
    }

    entry.count++;
    if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new Response('Too many requests', {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Limit': String(maxRequests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
            },
        });
    }

    return null;
}

/**
 * Get a rate limit key from the request.
 * Priority: x-real-ip (set by Vercel edge, not spoofable) > x-forwarded-for first entry > fallback.
 * Optionally include authenticated uid for stronger per-user limiting.
 */
export function getRateLimitKey(req: Request, prefix: string = '', uid?: string): string {
    // x-real-ip is set at the edge by Vercel/reverse proxy and cannot be spoofed by clients
    const realIp = req.headers.get('x-real-ip');
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = realIp || forwarded?.split(',')[0]?.trim() || 'unknown';
    // If uid is provided, use it as the primary key (stronger than IP)
    if (uid) return `${prefix}:uid:${uid}`;
    return `${prefix}:${ip}`;
}
