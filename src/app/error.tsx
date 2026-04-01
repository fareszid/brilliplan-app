'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[BrilliPlan Error Boundary]', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem', fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
                {/* Icon */}
                <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px',
                }}>
                    <AlertTriangle size={30} style={{ color: '#f87171' }} />
                </div>

                <h1 style={{
                    fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5',
                    marginBottom: 10, letterSpacing: '-0.02em',
                }}>
                    Oups, quelque chose a planté
                </h1>

                <p style={{
                    color: 'rgba(255,255,255,0.45)', fontSize: '0.92rem',
                    lineHeight: 1.6, marginBottom: 32, maxWidth: 380, margin: '0 auto 32px',
                }}>
                    Une erreur inattendue s&apos;est produite. Tu peux réessayer ou retourner au dashboard.
                </p>

                {/* Error detail (dev) */}
                {process.env.NODE_ENV === 'development' && error.message && (
                    <div style={{
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: '12px', padding: '12px 16px', marginBottom: '24px',
                        textAlign: 'left', fontSize: '0.78rem', color: '#fca5a5',
                        fontFamily: 'monospace', maxHeight: '120px', overflow: 'auto',
                        wordBreak: 'break-all',
                    }}>
                        {error.message}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={reset} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '12px 24px', borderRadius: 12,
                        background: 'linear-gradient(135deg, #c8a960, #8b5cf6)',
                        color: '#fff', fontWeight: 600, fontSize: '0.9rem',
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 4px 16px -4px rgba(200,169,96,0.4)',
                    }}>
                        <RefreshCw size={16} /> Réessayer
                    </button>
                    <Link href="/dashboard" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '12px 24px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.9rem',
                        textDecoration: 'none',
                    }}>
                        <Home size={16} /> Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
