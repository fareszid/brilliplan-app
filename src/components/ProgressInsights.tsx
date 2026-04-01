'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Brain, Calendar, Clock, Zap, Sun, Moon, Sunrise } from 'lucide-react';

interface SessionLog {
    id: string;
    title: string;
    duration_hours: number;
    pomodoros: number;
    started_at: Date;
    ended_at: Date;
    type: string;
}

interface Insight {
    icon: React.ReactNode;
    label: string;
    value: string;
    detail: string;
    color: string;
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function fmtH(h: number): string {
    if (h < 1 / 60) return '0min';
    if (h < 1) return `${Math.round(h * 60)}min`;
    const hr = Math.floor(h);
    const mn = Math.round((h - hr) * 60);
    return mn > 0 ? `${hr}h${mn.toString().padStart(2, '0')}` : `${hr}h`;
}

export default function ProgressInsights({ sessions }: { sessions: SessionLog[] }) {
    const insights = useMemo<Insight[]>(() => {
        if (sessions.length < 3) return [];

        const result: Insight[] = [];

        // 1. Best day of the week
        const dayTotals = [0, 0, 0, 0, 0, 0, 0];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        sessions.forEach(s => {
            const d = s.started_at.getDay();
            dayTotals[d] += s.duration_hours;
            dayCounts[d]++;
        });
        const bestDay = dayTotals.indexOf(Math.max(...dayTotals));
        if (dayTotals[bestDay] > 0) {
            result.push({
                icon: <Calendar size={16} />,
                label: 'Jour le plus productif',
                value: DAYS_FR[bestDay],
                detail: `${fmtH(dayTotals[bestDay])} total · ${dayCounts[bestDay]} sessions`,
                color: '#c8a960',
            });
        }

        // 2. Most productive time of day
        const hourBuckets = new Array(24).fill(0);
        sessions.forEach(s => {
            hourBuckets[s.started_at.getHours()] += s.duration_hours;
        });
        const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
        const timeLabel = peakHour < 6 ? 'Nuit' : peakHour < 12 ? 'Matin' : peakHour < 18 ? 'Après-midi' : 'Soir';
        const TimeIcon = peakHour < 6 ? Moon : peakHour < 12 ? Sunrise : peakHour < 18 ? Sun : Moon;
        result.push({
            icon: <TimeIcon size={16} />,
            label: 'Créneau favori',
            value: `${peakHour}h – ${peakHour + 1}h`,
            detail: `${fmtH(hourBuckets[peakHour])} de focus · ${timeLabel}`,
            color: '#5eead4',
        });

        // 3. Average session duration
        const avgDuration = sessions.reduce((s, x) => s + x.duration_hours, 0) / sessions.length;
        result.push({
            icon: <Clock size={16} />,
            label: 'Durée moyenne',
            value: fmtH(avgDuration),
            detail: `par session · sur ${sessions.length} sessions`,
            color: '#4ade80',
        });

        // 4. Weekly trend (this week vs last week)
        const now = new Date();
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
        thisWeekStart.setHours(0, 0, 0, 0);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const thisWeek = sessions.filter(s => s.started_at >= thisWeekStart).reduce((a, s) => a + s.duration_hours, 0);
        const lastWeek = sessions.filter(s => s.started_at >= lastWeekStart && s.started_at < thisWeekStart).reduce((a, s) => a + s.duration_hours, 0);

        if (lastWeek > 0) {
            const pctChange = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
            const trending = pctChange > 5 ? 'up' : pctChange < -5 ? 'down' : 'flat';
            const TrendIcon = trending === 'up' ? TrendingUp : trending === 'down' ? TrendingDown : Minus;
            result.push({
                icon: <TrendIcon size={16} />,
                label: 'Tendance hebdo',
                value: `${pctChange > 0 ? '+' : ''}${pctChange}%`,
                detail: `${fmtH(thisWeek)} cette semaine vs ${fmtH(lastWeek)}`,
                color: trending === 'up' ? '#4ade80' : trending === 'down' ? '#f87171' : '#fbbf24',
            });
        }

        // 5. Focus efficiency (avg pomodoros per hour)
        const totalPoms = sessions.reduce((s, x) => s + x.pomodoros, 0);
        const totalHrs = sessions.reduce((s, x) => s + x.duration_hours, 0);
        if (totalHrs > 0 && totalPoms > 0) {
            const pomPerHour = totalPoms / totalHrs;
            result.push({
                icon: <Zap size={16} />,
                label: 'Efficacité focus',
                value: `${pomPerHour.toFixed(1)}/h`,
                detail: `${totalPoms} pomodoros en ${fmtH(totalHrs)}`,
                color: '#a78bfa',
            });
        }

        // 6. Most worked on
        const titleMap: Record<string, number> = {};
        sessions.forEach(s => { titleMap[s.title] = (titleMap[s.title] || 0) + s.duration_hours; });
        const topTitle = Object.entries(titleMap).sort((a, b) => b[1] - a[1])[0];
        if (topTitle) {
            result.push({
                icon: <Brain size={16} />,
                label: 'Plus travaillé',
                value: topTitle[0].length > 22 ? topTitle[0].slice(0, 22) + '…' : topTitle[0],
                detail: `${fmtH(topTitle[1])} total`,
                color: '#f59e0b',
            });
        }

        return result;
    }, [sessions]);

    if (insights.length === 0) return null;

    return (
        <div style={{
            borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.015)',
            padding: '1.25rem 1.5rem',
        }}>
            <h3 style={{
                fontSize: '0.88rem', fontWeight: 700, color: '#ede9e3',
                margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <Brain size={15} style={{ color: '#c8a960' }} />
                Insights
            </h3>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
            }}>
                {insights.map((ins, i) => (
                    <motion.div
                        key={ins.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06 }}
                        style={{
                            padding: '12px 14px', borderRadius: 12,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${ins.color}30`; e.currentTarget.style.background = `${ins.color}08`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <div style={{ color: ins.color }}>{ins.icon}</div>
                            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {ins.label}
                            </span>
                        </div>
                        <div style={{
                            fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800,
                            color: '#ede9e3', letterSpacing: '-0.02em', lineHeight: 1.2,
                        }}>
                            {ins.value}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                            {ins.detail}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
