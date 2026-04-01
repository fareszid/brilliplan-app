import { auth } from './firebase';

/**
 * Wrapper around fetch that automatically attaches the Firebase ID token.
 * Use this for all /api/* calls to ensure server-side auth validation.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await auth.currentUser?.getIdToken();
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...options, headers });
}
