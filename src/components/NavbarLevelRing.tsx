'use client';

import { useGamification } from '@/context/GamificationContext';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function NavbarLevelRing() {
    const { user } = useAuth();
    const { xp, level, xpForLevel, xpForNextLevel } = useGamification();

    if (!user) return null;

    const currentLevelXP = xpForLevel(level);
    const nextLevelXP = xpForNextLevel(level);
    const progress = nextLevelXP > currentLevelXP
        ? (xp - currentLevelXP) / (nextLevelXP - currentLevelXP)
        : 0;

    // SVG ring params
    const size = 30;
    const strokeWidth = 2.5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(progress, 1));

    return (
        <Link
            href="/profile?tab=activity"
            title={`Niveau ${level} · ${xp} XP`}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background .15s',
                textDecoration: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,169,96,.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="rgba(200,169,96,0.1)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress arc */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="#c8a960"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: 'stroke-dashoffset 0.6s cubic-bezier(0.25,0.1,0.25,1)',
                        filter: 'drop-shadow(0 0 3px rgba(200,169,96,0.4))',
                    }}
                />
            </svg>
            {/* Level number */}
            <span style={{
                position: 'absolute',
                fontFamily: 'var(--font-display)',
                fontSize: level >= 10 ? '.55rem' : '.62rem',
                fontWeight: 800,
                color: '#c8a960',
                letterSpacing: '-0.02em',
                lineHeight: 1,
            }}>
                {level}
            </span>
        </Link>
    );
}
