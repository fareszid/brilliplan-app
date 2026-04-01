/**
 * Sanitize user input before including in AI prompts.
 * Strips injection patterns and truncates to a safe length.
 */
export function sanitizeForPrompt(input: string | undefined | null, maxLength: number = 2000): string {
    if (!input) return '';
    let s = String(input).slice(0, maxLength);
    // Strip common prompt injection patterns
    s = s.replace(/(?:ignore|oublie|forget|disregard)\s+(?:all\s+)?(?:previous|above|prior|preceding)\s+(?:instructions?|prompts?|rules?|context)/gi, '[filtered]');
    s = s.replace(/(?:you are now|tu es maintenant|act as|pretend to be|ignore everything)/gi, '[filtered]');
    s = s.replace(/(?:system:|assistant:|user:|<\|im_start\|>|<\|im_end\|>|<\/?system>|<\/?user>|<\/?assistant>)/gi, '[filtered]');
    return s.trim();
}

/**
 * Recursively sanitize all string values in an object/array before AI prompt interpolation.
 * Prevents prompt injection via nested fields (e.g. milestone titles, message content).
 */
export function sanitizeObjectForPrompt<T>(obj: T, maxStringLength: number = 500): T {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeForPrompt(obj, maxStringLength) as unknown as T;
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObjectForPrompt(item, maxStringLength)) as unknown as T;
    }
    if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            result[key] = sanitizeObjectForPrompt(value, maxStringLength);
        }
        return result as T;
    }
    return obj;
}

/**
 * Sanitize a Firestore text field — strips control characters and limits length.
 */
export function sanitizeText(input: string, maxLength: number = 5000): string {
    // eslint-disable-next-line no-control-regex
    return String(input).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLength).trim();
}

/**
 * Validate and sanitize a URL string.
 */
export function sanitizeUrl(url: string): string | null {
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        if (!['http:', 'https:'].includes(u.protocol)) return null;
        return u.href;
    } catch {
        return null;
    }
}
