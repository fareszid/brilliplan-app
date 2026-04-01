import { verifyAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import crypto from 'crypto';

/**
 * ZegoCloud token generation — exact replica of the SDK's generateKitTokenForTest algorithm.
 * Server-side only, secret never sent to client.
 */
function generateToken04(appID: number, userID: string, secret: string, effectiveTimeInSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const tokenInfo = {
        app_id: appID,
        user_id: userID,
        nonce: (Math.random() * 2147483647) | 0,
        ctime: now,
        expire: now + effectiveTimeInSeconds,
    };

    const plainText = JSON.stringify(tokenInfo);

    // IV: 16-char random digit string (matching SDK behavior)
    let iv = Math.random().toString().substring(2, 18);
    if (iv.length < 16) iv += iv.substring(0, 16 - iv.length);
    const ivBytes = Buffer.from(iv, 'utf8');

    // AES-256-CBC encryption with secret as UTF-8 key
    const key = Buffer.from(secret.substring(0, 32).padEnd(32, '0'), 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBytes);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

    // Build binary token: [4 zero bytes][4-byte expire BE][2-byte IV len][16-byte IV][2-byte enc len][encrypted]
    const buf = Buffer.alloc(28 + encrypted.length);
    // bytes 0-3: zeros
    buf.writeUInt32BE(0, 0);
    // bytes 4-7: expire time as 32-bit big-endian
    buf.writeUInt32BE(tokenInfo.expire, 4);
    // bytes 8-9: IV length
    buf.writeUInt16BE(ivBytes.length, 8);
    // bytes 10-25: IV
    ivBytes.copy(buf, 10);
    // bytes 26-27: encrypted length
    buf.writeUInt16BE(encrypted.length, 26);
    // bytes 28+: encrypted data
    encrypted.copy(buf, 28);

    return '04' + buf.toString('base64');
}

export async function POST(req: Request) {
    const rl = checkRateLimit(getRateLimitKey(req, 'zego-token'), { maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;
    const uid = await verifyAuth(req);
    if (!uid) return new Response('Unauthorized', { status: 401 });

    try {
        const { roomID, userName } = await req.json();
        if (!roomID || typeof roomID !== 'string' || roomID.length > 200) {
            return new Response('Invalid roomID', { status: 400 });
        }

        const appID = parseInt(process.env.ZEGO_APP_ID || process.env.NEXT_PUBLIC_ZEGO_APP_ID || '0');
        const serverSecret = process.env.ZEGO_SERVER_SECRET || '';

        if (!appID || !serverSecret) {
            return new Response('ZegoCloud not configured', { status: 500 });
        }

        const sanitizedName = String(userName || 'User').slice(0, 64);
        const token04 = generateToken04(appID, uid, serverSecret, 7200);

        // ZegoUIKitPrebuilt.create() expects a "kitToken" in the format:
        // {token04}#{base64({userID, roomID, userName, appID})}
        const kitMeta = Buffer.from(JSON.stringify({
            userID: uid,
            roomID,
            userName: encodeURIComponent(sanitizedName),
            appID,
        })).toString('base64');
        const kitToken = `${token04}#${kitMeta}`;

        return Response.json({ token: kitToken, appID });
    } catch {
        return new Response('Token generation failed', { status: 500 });
    }
}
