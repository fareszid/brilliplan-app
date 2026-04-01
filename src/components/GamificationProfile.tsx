'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Star, Lock, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useGamification, BADGES } from '@/context/GamificationContext';
import type { Badge } from '@/context/GamificationContext';

function fmtXP(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

const INITIAL_BADGES_SHOWN = 8;

export default function GamificationProfile() {
    const { xp, level, badges, xpForLevel, xpForNextLevel } = useGamification();
    const [showAllBadges, setShowAllBadges] = useState(false);

    const currentLevelXP = xpForLevel(level);
    const nextLevelXP = xpForNextLevel(level);
    const progress = nextLevelXP > currentLevelXP
        ? (xp - currentLevelXP) / (nextLevelXP - currentLevelXP)
        : 0;
    const xpInLevel = xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;

    // Sort badges: earned first, then unearned
    const sortedBadges = [...BADGES].sort((a, b) => {
        const aEarned = badges.includes(a.id) ? 0 : 1;
        const bEarned = badges.includes(b.id) ? 0 : 1;
        return aEarned - bEarned;
    });

    const displayedBadges = showAllBadges ? sortedBadges : sortedBadges.slice(0, INITIAL_BADGES_SHOWN);
    const hasMoreBadges = sortedBadges.length > INITIAL_BADGES_SHOWN;
    const earnedCount = badges.length;
    const totalCount = BADGES.length;
    const completionPct = Math.round((earnedCount / totalCount) * 100);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── Level & XP Card ── */}
            <div style={{
                position: 'relative',
                borderRadius: 20,
                padding: '1.75rem 2rem',
                background: 'linear-gradient(145deg, rgba(200,169,96,0.07), rgba(200,169,96,0.015))',
                border: '1px solid rgba(200,169,96,0.12)',
                overflow: 'hidden',
            }}>
                {/* Ambient glow */}
                <div style={{
                    position: 'absolute', top: '-40%', right: '-20%',
                    width: '60%', height: '120%',
                    background: 'radial-gradient(ellipse, rgba(200,169,96,0.06) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

                    {/* Level ring */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                        style={{ position: 'relative', flexShrink: 0 }}
                    >
                        <svg width={82} height={82} style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx={41} cy={41} r={35} fill="none" stroke="rgba(200,169,96,0.08)" strokeWidth={5} />
                            <circle
                                cx={41} cy={41} r={35}
                                fill="none" stroke="url(#levelGrad)" strokeWidth={5}
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 35}
                                strokeDashoffset={2 * Math.PI * 35 * (1 - Math.min(progress, 1))}
                                style={{
                                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.25,0.1,0.25,1)',
                                    filter: 'drop-shadow(0 0 8px rgba(200,169,96,0.35))',
                                }}
                            />
                            <defs>
                                <linearGradient id="levelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#c8a960" />
                                    <stop offset="100%" stopColor="#5eead4" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: level >= 100 ? '1.1rem' : level >= 10 ? '1.4rem' : '1.7rem',
                                fontWeight: 900, color: '#c8a960',
                                letterSpacing: '-0.03em', lineHeight: 1,
                            }}>
                                {level}
                            </span>
                            <span style={{
                                fontSize: '0.5rem', fontWeight: 700,
                                color: 'rgba(200,169,96,0.5)',
                                textTransform: 'uppercase', letterSpacing: '0.12em',
                                marginTop: 2,
                            }}>
                                Niveau
                            </span>
                        </div>
                    </motion.div>

                    {/* XP info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                            <span style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '1.6rem', fontWeight: 900,
                                color: '#ede9e3', letterSpacing: '-0.03em',
                            }}>
                                {fmtXP(xp)}
                            </span>
                            <span style={{
                                fontSize: '0.78rem', fontWeight: 600,
                                color: 'rgba(200,169,96,0.6)',
                            }}>
                                XP
                            </span>
                        </div>

                        {/* Progress bar */}
                        <div style={{
                            width: '100%', height: 7, borderRadius: 4,
                            background: 'rgba(200,169,96,0.06)',
                            overflow: 'hidden',
                            marginBottom: 8,
                        }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{
                                    height: '100%', borderRadius: 4,
                                    background: 'linear-gradient(90deg, #c8a960, #5eead4)',
                                    boxShadow: '0 0 12px rgba(200,169,96,0.25)',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.68rem', color: 'rgba(237,233,227,0.28)', fontWeight: 500 }}>
                                {fmtXP(xpInLevel)} / {fmtXP(xpNeeded)} XP
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'rgba(200,169,96,0.4)', fontWeight: 600 }}>
                                Prochain: Niv. {level + 1}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Badges Section ── */}
            <div style={{
                borderRadius: 20,
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.75rem 1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 16, borderRadius: 2, background: '#c8a960' }} />
                        <h3 style={{
                            fontSize: '0.9rem', fontWeight: 800, color: '#ede9e3',
                            margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                            Badges
                        </h3>
                        <span style={{
                            fontSize: '0.62rem', fontWeight: 700,
                            padding: '3px 9px', borderRadius: 8,
                            background: earnedCount > 0 ? 'rgba(200,169,96,0.1)' : 'rgba(255,255,255,0.04)',
                            color: earnedCount > 0 ? '#c8a960' : 'rgba(255,255,255,0.25)',
                            border: `1px solid ${earnedCount > 0 ? 'rgba(200,169,96,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                            {earnedCount} / {totalCount}
                        </span>
                    </div>
                </div>

                {/* Completion progress */}
                <div style={{ padding: '0 1.75rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <Trophy size={12} style={{ color: completionPct >= 100 ? '#fbbf24' : 'rgba(255,255,255,0.2)' }} />
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                            Progression collection
                        </span>
                        <span style={{
                            fontSize: '0.7rem', fontWeight: 700, marginLeft: 'auto',
                            color: completionPct >= 80 ? '#4ade80' : completionPct >= 40 ? '#fbbf24' : 'rgba(255,255,255,0.25)',
                        }}>
                            {completionPct}%
                        </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${completionPct}%`,
                            background: completionPct >= 80
                                ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
                                : completionPct >= 40
                                    ? 'linear-gradient(90deg, #fbbf24, #c8a960)'
                                    : 'rgba(255,255,255,0.15)',
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                </div>

                {/* Badges grid */}
                <div style={{ padding: '0 1.5rem 1.25rem' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                        gap: 8,
                    }}>
                        {displayedBadges.map((badge: Badge, i: number) => {
                            const earned = badges.includes(badge.id);
                            return (
                                <motion.div
                                    key={badge.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: i * 0.03 }}
                                    style={{
                                        position: 'relative',
                                        padding: '14px 12px 12px',
                                        borderRadius: 14,
                                        background: earned
                                            ? 'linear-gradient(145deg, rgba(200,169,96,0.07), rgba(200,169,96,0.02))'
                                            : 'rgba(255,255,255,0.01)',
                                        border: `1px solid ${earned
                                            ? 'rgba(200,169,96,0.15)'
                                            : 'rgba(255,255,255,0.04)'}`,
                                        textAlign: 'center',
                                        transition: 'all 0.2s',
                                        cursor: 'default',
                                        opacity: earned ? 1 : 0.4,
                                    }}
                                    onMouseEnter={e => {
                                        if (earned) {
                                            e.currentTarget.style.borderColor = 'rgba(200,169,96,0.3)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = earned ? 'rgba(200,169,96,0.15)' : 'rgba(255,255,255,0.04)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Badge emoji */}
                                    <div style={{
                                        fontSize: '1.5rem',
                                        marginBottom: 5,
                                        filter: earned ? 'none' : 'grayscale(1)',
                                        transition: 'filter 0.3s, transform 0.2s',
                                    }}>
                                        {badge.icon}
                                    </div>

                                    {/* Lock */}
                                    {!earned && (
                                        <div style={{
                                            position: 'absolute', top: 8, right: 8,
                                            color: 'rgba(255,255,255,0.12)',
                                        }}>
                                            <Lock size={9} />
                                        </div>
                                    )}

                                    <div style={{
                                        fontFamily: 'var(--font-display)',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        color: earned ? '#ede9e3' : 'rgba(237,233,227,0.3)',
                                        marginBottom: 2,
                                        letterSpacing: '-0.01em',
                                    }}>
                                        {badge.name}
                                    </div>

                                    <div style={{
                                        fontSize: '0.6rem',
                                        color: earned ? 'rgba(200,169,96,0.55)' : 'rgba(255,255,255,0.12)',
                                        lineHeight: 1.35,
                                    }}>
                                        {badge.description}
                                    </div>

                                    {earned && (
                                        <div style={{
                                            marginTop: 5,
                                            display: 'inline-flex', alignItems: 'center', gap: 3,
                                            fontSize: '0.55rem', fontWeight: 700,
                                            color: '#c8a960',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            background: 'rgba(200,169,96,0.08)',
                                            padding: '2px 7px', borderRadius: 5,
                                        }}>
                                            <Zap size={8} /> Obtenu
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Voir plus / moins */}
                    {hasMoreBadges && (
                        <button
                            onClick={() => setShowAllBadges(!showAllBadges)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                width: '100%', padding: '10px', marginTop: '10px',
                                borderRadius: 10, cursor: 'pointer',
                                background: 'rgba(255,255,255,0.025)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.78rem', fontWeight: 600,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#c8a960'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                        >
                            {showAllBadges ? (
                                <><ChevronUp size={14} /> Voir moins</>
                            ) : (
                                <><ChevronDown size={14} /> Voir les {sortedBadges.length - INITIAL_BADGES_SHOWN} badges restants</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
