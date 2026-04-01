'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { X, TrendingUp, TrendingDown, Minus, Award, Flame, Clock, Timer, ChevronRight } from 'lucide-react';
import { useGamification } from '@/context/GamificationContext';

export default function WeeklyReport({ sessionLogs = [] }: { sessionLogs?: any[] }) {
    const { user } = useAuth();
    const { stats, badges } = useGamification();
    const [show, setShow] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Calculate week ID (ISO week)
    const getWeekId = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil((((now.getTime() - firstDay.getTime()) / 86400000) + firstDay.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${week}`;
    };

    // Check if already dismissed this week
    useEffect(() => {
        if (!user) return;
        const weekId = getWeekId();
        const key = `brilliplan_weekreport_${user.uid}_${weekId}`;
        if (localStorage.getItem(key)) {
            setDismissed(true);
            return;
        }
        // Only show on first visit of the week (Mon–Sun, show from Mon)
        const now = new Date();
        const day = now.getDay();
        // Show from Monday (1) onwards
        if (day >= 1) {
            const timer = setTimeout(() => setShow(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleDismiss = () => {
        setShow(false);
        if (user) {
            localStorage.setItem(`brilliplan_weekreport_${user.uid}_${getWeekId()}`, '1');
        }
    };

    // Compute weekly stats
    const report = useMemo(() => {
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const thisWeek = sessionLogs.filter(s => {
            const d = s.started_at?.toDate?.() || new Date(s.started_at);
            return d >= weekAgo;
        });
        const lastWeek = sessionLogs.filter(s => {
            const d = s.started_at?.toDate?.() || new Date(s.started_at);
            return d >= twoWeeksAgo && d < weekAgo;
        });

        const thisHours = thisWeek.reduce((sum: number, s: any) => sum + (s.duration_hours || 0), 0);
        const lastHours = lastWeek.reduce((sum: number, s: any) => sum + (s.duration_hours || 0), 0);
        const thisSessions = thisWeek.length;
        const lastSessions = lastWeek.length;
        const thisPomodoros = thisWeek.reduce((sum: number, s: any) => sum + (s.pomodoros || 0), 0);

        const hoursDelta = lastHours > 0 ? ((thisHours - lastHours) / lastHours * 100) : thisHours > 0 ? 100 : 0;
        const sessionsDelta = lastSessions > 0 ? ((thisSessions - lastSessions) / lastSessions * 100) : thisSessions > 0 ? 100 : 0;

        return { thisHours, lastHours, thisSessions, lastSessions, thisPomodoros, hoursDelta, sessionsDelta };
    }, [sessionLogs]);

    if (dismissed || !show || !user) return null;

    const fmtH = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${h.toFixed(1)}h`;

    const DeltaChip = ({ value }: { value: number }) => {
        const icon = value > 0 ? <TrendingUp size={10} /> : value < 0 ? <TrendingDown size={10} /> : <Minus size={10} />;
        const color = value > 0 ? '#34d399' : value < 0 ? '#f87171' : '#71717a';
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 6,
                background: `${color}15`, color,
                fontSize: '0.65rem', fontWeight: 700,
            }}>
                {icon} {value > 0 ? '+' : ''}{value.toFixed(0)}%
            </span>
        );
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleDismiss}
                style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                    animation: 'wr-fade-in 0.3s ease',
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                width: '90%', maxWidth: 420,
                background: 'rgba(16,16,20,0.98)',
                border: '1px solid rgba(200,169,96,0.15)',
                borderRadius: 22,
                overflow: 'hidden',
                boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 60px rgba(200,169,96,0.06)',
                animation: 'wr-slide-up 0.4s cubic-bezier(0.16,1,0.3,1)',
            }}>
                {/* Gradient header */}
                <div style={{
                    background: 'linear-gradient(145deg, rgba(200,169,96,0.12), rgba(94,234,212,0.05))',
                    padding: '1.5rem 1.5rem 1.25rem',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    position: 'relative',
                }}>
                    <button
                        onClick={handleDismiss}
                        style={{
                            position: 'absolute', top: 14, right: 14,
                            width: 28, height: 28, borderRadius: 8,
                            border: 'none', background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <X size={14} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Award size={16} style={{ color: '#c8a960' }} />
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Bilan de la semaine
                        </span>
                    </div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.4rem', fontWeight: 900, color: '#f4f4f5',
                        margin: 0, letterSpacing: '-0.03em',
                    }}>
                        {report.thisHours > report.lastHours
                            ? 'Semaine productive ! 🚀'
                            : report.thisHours > 0
                                ? 'Continue comme ça 💪'
                                : 'Prêt pour une nouvelle semaine ?'
                        }
                    </h2>
                </div>

                {/* Stats Grid */}
                <div style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1.25rem' }}>
                        {[
                            { label: 'Heures', value: fmtH(report.thisHours), delta: report.hoursDelta, Icon: Clock, color: '#c8a960' },
                            { label: 'Sessions', value: String(report.thisSessions), delta: report.sessionsDelta, Icon: Timer, color: '#10b981' },
                            { label: 'Streak', value: `${stats.streak_days}j`, delta: 0, Icon: Flame, color: '#f59e0b' },
                        ].map((s, i) => (
                            <div key={i} style={{
                                padding: '12px',
                                borderRadius: 14,
                                background: `${s.color}08`,
                                border: `1px solid ${s.color}18`,
                                textAlign: 'center',
                            }}>
                                <s.Icon size={15} style={{ color: s.color, marginBottom: 4 }} />
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f4f4f5', fontFamily: 'var(--font-display)' }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginBottom: 2 }}>
                                    {s.label}
                                </div>
                                {s.delta !== 0 && <DeltaChip value={s.delta} />}
                            </div>
                        ))}
                    </div>

                    {/* New badges this week */}
                    {badges.length > 0 && (
                        <div style={{
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: 'rgba(200,169,96,0.05)',
                            border: '1px solid rgba(200,169,96,0.12)',
                            display: 'flex', alignItems: 'center', gap: 8,
                            marginBottom: '1rem',
                        }}>
                            <span style={{ fontSize: '0.72rem', color: '#c8a960', fontWeight: 700, flex: 1 }}>
                                🏅 {badges.length} badge{badges.length > 1 ? 's' : ''} débloqué{badges.length > 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {/* CTA buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleDismiss}
                            style={{
                                flex: 1, padding: '11px', borderRadius: 12,
                                background: '#c8a960', border: 'none',
                                color: '#0b0b0d', fontSize: '0.85rem', fontWeight: 700,
                                cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#d4b872')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#c8a960')}
                        >
                            C&apos;est parti ! 💪
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes wr-fade-in { from { opacity:0 } to { opacity:1 } }
                @keyframes wr-slide-up { from { opacity:0; transform:translate(-50%,-48%) scale(0.95) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
            `}</style>
        </>
    );
}
