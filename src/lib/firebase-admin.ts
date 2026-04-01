import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'project-test-53a83';
const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!getApps().length) {
    if (hasServiceAccount) {
        const adminConfig: ServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
        initializeApp({ credential: cert(adminConfig), projectId });
    } else {
        initializeApp({ projectId });
    }
}

const adminAuth = hasServiceAccount ? getAuth() : null;

// Google's public keys for verifying Firebase ID tokens (cached)
let cachedKeys: Record<string, string> | null = null;
let keysExpiry = 0;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
    if (cachedKeys && Date.now() < keysExpiry) return cachedKeys;
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    const cacheControl = res.headers.get('cache-control');
    const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
    keysExpiry = Date.now() + (maxAge ? parseInt(maxAge) * 1000 : 3600_000);
    cachedKeys = await res.json();
    return cachedKeys!;
}

/**
 * Verify a Firebase ID token manually by decoding the JWT and checking
 * the signature against Google's public keys. Works without a service account.
 */
async function verifyTokenManually(token: string): Promise<string | null> {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) return null;

        const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

        // Check basic claims
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) return null; // expired
        if (payload.iat > now + 60) return null; // issued in future (with 60s tolerance)
        if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
        if (payload.aud !== projectId) return null;
        if (!payload.sub || typeof payload.sub !== 'string') return null;

        // Verify signature with Google's public key
        const keys = await getGooglePublicKeys();
        const publicKeyPem = keys[header.kid];
        if (!publicKeyPem) return null;

        const crypto = await import('crypto');
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        const isValid = verifier.verify(publicKeyPem, Buffer.from(signatureB64, 'base64url'));
        if (!isValid) return null;

        return payload.sub; // uid
    } catch {
        return null;
    }
}

/**
 * Verify the Firebase ID token from an Authorization header.
 * Uses Admin SDK if service account is available, otherwise falls back
 * to manual JWT verification against Google's public keys.
 */
export async function verifyAuth(req: Request): Promise<string | null> {
    const header = req.headers.get('Authorization');
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7);

    // Use Admin SDK if available (has service account)
    if (adminAuth) {
        try {
            const decoded = await adminAuth.verifyIdToken(token);
            return decoded.uid;
        } catch {
            return null;
        }
    }

    // Fallback: manual verification
    return verifyTokenManually(token);
}
