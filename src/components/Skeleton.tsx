'use client';

import React from 'react';

/* ─── Base shimmer skeleton ─── */

const shimmerKeyframes = `
@keyframes sk-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: React.CSSProperties;
    className?: string;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style, className }: SkeletonProps) {
    return (
        <>
            <style>{shimmerKeyframes}</style>
            <div className={className} style={{
                width, height, borderRadius,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
                backgroundSize: '200% 100%',
                animation: 'sk-shimmer 1.8s ease-in-out infinite',
                ...style,
            }} />
        </>
    );
}

/* ─── Preset: Card skeleton ─── */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
            <Skeleton width="40%" height={14} borderRadius={6} />
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={12} borderRadius={6} />
            ))}
        </div>
    );
}

/* ─── Preset: Avatar + text row ─── */
export function SkeletonRow() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width="45%" height={13} borderRadius={6} />
                <Skeleton width="70%" height={10} borderRadius={5} />
            </div>
        </div>
    );
}

/* ─── Preset: Grid of cards ─── */
export function SkeletonGrid({ count = 6, columns = 2 }: { count?: number; columns?: number }) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '1rem',
        }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} lines={2} />
            ))}
        </div>
    );
}

/* ─── Preset: Page loading (centered) ─── */
export function SkeletonPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '0.5rem' }}>
                <Skeleton width={48} height={48} borderRadius={14} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Skeleton width="30%" height={20} borderRadius={8} />
                    <Skeleton width="50%" height={12} borderRadius={6} />
                </div>
            </div>
            <Skeleton width="100%" height={44} borderRadius={12} />
            <SkeletonGrid count={4} columns={2} />
        </div>
    );
}
