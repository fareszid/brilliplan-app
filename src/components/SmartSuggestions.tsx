'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit as fbLimit } from 'firebase/firestore';
import { Brain, Clock, CalendarDays, Sparkles, Users, ChevronRight, TrendingUp, Lightbulb } from 'lucide-react';
import Link from 'next/link';

export default function SmartSuggestions({ sessionLogs = [] }: { sessionLogs?: any[] }) {
    const { user } = useAuth();
    const [pairSuggestion, setPairSuggestion] = useState<any>(null);

    // Analyze session patterns
    const insights = useMemo(() => {
        if (sessionLogs.length < 3) return null;

        // Most productive hour
        const hourCounts: Record<number, number> = {};
        const hourDurations: Record<number, number> = {};
        sessionLogs.forEach((s: any) => {
            const d = s.started_at?.toDate?.() || new Date(s.started_at);
            const hour = d.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            hourDurations[hour] = (hourDurations[hour] || 0) + (s.duration_hours || 0);
        });

        const bestHour = Object.entries(hourDurations)
            .sort(([, a], [, b]) => b - a)[0];

        // Average session duration
        const avgDuration = sessionLogs.reduce((sum: number, s: any) => sum + (s.duration_hours || 0), 0) / sessionLogs.length;

        // Most active day of week
        const dayCounts: Record<number, number> = {};
        sessionLogs.forEach((s: any) => {
            const d = s.started_at?.toDate?.() || new Date(s.started_at);
            const day = d.getDay();
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
        const bestDay = Object.entries(dayCounts)
            .sort(([, a], [, b]) => b - a)[0];
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

        return {
            bestHour: bestHour ? parseInt(bestHour[0]) : null,
            avgDuration,
            bestDay: bestDay ? dayNames[parseInt(bestDay[0])] : null,
            totalSessions: sessionLogs.length,
        };
    }, [sessionLogs]);

    // Load pair suggestion
    useEffect(() => {
        if (!user) return;
        const loadSuggestion = async () => {
            // Find users with similar categories/hours
            const usersSnap = await getDocs(
                query(collection(db, 'users'), fbLimit(20))
            );
            const suggestions = usersSnap.docs
                .filter(d => d.id !== user.uid && (d.data().total_hours || 0) > 1)
                .map(d => ({
                    uid: d.id,
                    full_name: d.data().full_name || 'Utilisateur',
                    avatar_url: d.data().avatar_url,
                    avatar_style: d.data().avatar_style,
                    total_hours: d.data().total_hours || 0,
                }))
                .slice(0, 1);
            if (suggestions.length > 0) setPairSuggestion(suggestions[0]);
        };
        loadSuggestion();
    }, [user]);

    if (!user) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Smart scheduling suggestion */}
            {insights && insights.bestHour !== null && (
                <div style={{
                    background: 'linear-gradient(145deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))',
                    border: '1px solid rgba(139,92,246,0.12)',
                    borderRadius: 16, padding: '1rem 1.15rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <Brain size={14} style={{ color: '#a78bfa' }} />
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700,
                            color: 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>
                            Focus insight
                        </span>
                    </div>
                    <p style={{ color: 'rgba(237,233,227,0.65)', fontSize: '0.82rem', margin: '0 0 6px', lineHeight: 1.55 }}>
                        Tu es le plus productif entre{' '}
                        <span style={{ color: '#a78bfa', fontWeight: 700 }}>{insights.bestHour}h</span>{' '}et{' '}
                        <span style={{ color: '#a78bfa', fontWeight: 700 }}>{(insights.bestHour + 2) % 24}h</span>
                        {insights.bestDay && (
                            <>, surtout le <span style={{ color: '#a78bfa', fontWeight: 700 }}>{insights.bestDay}</span></>
                        )}.
                    </p>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 0 0',
                        fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)',
                    }}>
                        <Lightbulb size={10} style={{ color: '#a78bfa', opacity: 0.5 }} />
                        Durée moyenne: {insights.avgDuration < 1 ? `${Math.round(insights.avgDuration * 60)}min` : `${insights.avgDuration.toFixed(1)}h`} · {insights.totalSessions} sessions analysées
                    </div>
                </div>
            )}

            {/* AI pair matching suggestion */}
            {pairSuggestion && (
                <Link
                    href="/find-teammates"
                    style={{
                        display: 'block', textDecoration: 'none',
                        background: 'linear-gradient(145deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
                        border: '1px solid rgba(16,185,129,0.12)',
                        borderRadius: 16, padding: '1rem 1.15rem',
                        transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.12)')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <Users size={14} style={{ color: '#34d399' }} />
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700,
                            color: 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            flex: 1,
                        }}>
                            Suggestion de partenaire
                        </span>
                        <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.15)' }} />
                    </div>
                    <p style={{ color: 'rgba(237,233,227,0.55)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
                        <span style={{ color: '#34d399', fontWeight: 600 }}>Trouve un partenaire</span> pour rester motivé et progresser ensemble
                    </p>
                </Link>
            )}
        </div>
    );
}
