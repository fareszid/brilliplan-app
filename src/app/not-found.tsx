'use client';

import Link from 'next/link';
import { Compass, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-bg-base, #0a0a0b)', padding: '2rem',
            fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
                {/* Glowing 404 */}
                <div style={{ position: 'relative', marginBottom: 32 }}>
                    <div style={{
                        fontSize: '8rem', fontWeight: 900, letterSpacing: '-0.04em',
                        background: 'linear-gradient(135deg, #c8a960 0%, #8b5cf6 40%, #d4b872 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        lineHeight: 1, userSelect: 'none',
                    }}>404</div>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 200, height: 200, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(200,169,96,0.15) 0%, transparent 70%)',
                        filter: 'blur(40px)', pointerEvents: 'none',
                    }} />
                </div>

                {/* Icon */}
                <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                }}>
                    <Compass size={26} style={{ color: '#c8a960' }} />
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5',
                    marginBottom: 10, letterSpacing: '-0.02em',
                }}>Page introuvable</h1>

                {/* Description */}
                <p style={{
                    color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem',
                    lineHeight: 1.6, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px',
                }}>
                    Cette page n&apos;existe pas ou a été déplacée. Pas de panique, tu peux revenir en terrain connu.
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/dashboard" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '12px 24px', borderRadius: 12,
                        background: 'linear-gradient(135deg, #c8a960, #8b5cf6)',
                        color: '#fff', fontWeight: 600, fontSize: '0.9rem',
                        textDecoration: 'none', boxShadow: '0 4px 16px -4px rgba(200,169,96,0.4)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                    }}>
                        <Home size={16} /> Dashboard
                    </Link>
                    <Link href="/explore" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '12px 24px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.9rem',
                        textDecoration: 'none', transition: 'border-color 0.15s',
                    }}>
                        <Compass size={16} /> Explorer
                    </Link>
                </div>
            </div>
        </div>
    );
}
