import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
    const rl = checkRateLimit(getRateLimitKey(req, 'proxy-file'), { maxRequests: 30, windowMs: 60_000 });
    if (rl) return rl;

    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
        return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Only allow Firebase/Google Storage URLs
    if (!url.includes('firebasestorage.googleapis.com') && !url.includes('storage.googleapis.com') && !url.includes('googleapis.com')) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 403 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({ error: 'Fetch failed' }, { status: response.status });
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Extract filename from URL path for Content-Disposition
        const urlPath = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file');
        // Clean up Firebase path encoding (e.g. user_timestamp_filename)
        const fileName = urlPath.includes('_') ? urlPath.replace(/^[^_]+_\d+_/, '') : urlPath;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
    }
}
