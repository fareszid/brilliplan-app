import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = ['archive.org', 'ia800', 'ia600', 'ia400', 'ia200'];

function isAllowed(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return ALLOWED_HOSTS.some(h => hostname.includes(h));
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url || !isAllowed(url)) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 403 });
    }

    try {
        // Follow redirects (archive.org does 302 → CDN node)
        const upstream = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow',
        });

        if (!upstream.ok) {
            return NextResponse.json({ error: 'Upstream error' }, { status: upstream.status });
        }

        const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
        const contentLength = upstream.headers.get('content-length');

        // Stream the body through — no buffering in memory
        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
        };
        if (contentLength) headers['Content-Length'] = contentLength;

        return new NextResponse(upstream.body, { headers });
    } catch {
        return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
    }
}
