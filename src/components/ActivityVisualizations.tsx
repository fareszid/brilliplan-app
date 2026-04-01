'use client';

import { useMemo, useState } from 'react';
import { Flame, Calendar, Clock, TrendingUp } from 'lucide-react';

interface SessionLog {
    id: string;
    objective_id: string;
    type: string;
    title: string;
    started_at: Date;
    ended_at: Date;
    duration_hours: number;
    pomodoros: number;
}

function fmtH(h: number): string {
    if (h < 1 / 60) return '0min';
    if (h < 1) return `${Math.round(h * 60)}min`;
    const hr = Math.floor(h);
    const mn = Math.round((h - hr) * 60);
    return mn > 0 ? `${hr}h${mn.toString().padStart(2, '0')}` : `${hr}h`;
}

function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════
   1. GITHUB-STYLE HEATMAP
   ═══════════════════════════════════════════════════════════ */

export function ActivityHeatmap({ sessions }: { sessions: SessionLog[] }) {
    const { weeks, dayMap, maxHrs, totalDays } = useMemo(() => {
        const map: Record<string, number> = {};
        sessions.forEach(s => {
            const key = toDateKey(s.started_at);
            map[key] = (map[key] || 0) + s.duration_hours;
        });
        const max = Math.max(...Object.values(map), 0.5);

        // Build 26 weeks (~ 6 months)
        const weeksArr: string[][] = [];
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - (26 * 7 - 1) - start.getDay());

        let activeDays = 0;
        let currentWeek: string[] = [];
        const cursor = new Date(start);
        while (cursor <= today) {
            const key = toDateKey(cursor);
            currentWeek.push(key);
            if (map[key]) activeDays++;
            if (currentWeek.length === 7) {
                weeksArr.push(currentWeek);
                currentWeek = [];
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        if (currentWeek.length > 0) weeksArr.push(currentWeek);

        return { weeks: weeksArr, dayMap: map, maxHrs: max, totalDays: activeDays };
    }, [sessions]);

    const getColor = (hrs: number) => {
        if (hrs === 0) return 'rgba(237,233,227,0.04)';
        const intensity = Math.min(hrs / maxHrs, 1);
        if (intensity < 0.25) return 'rgba(200,169,96,0.2)';
        if (intensity < 0.5) return 'rgba(200,169,96,0.4)';
        if (intensity < 0.75) return 'rgba(200,169,96,0.65)';
        return '#c8a960';
    };

    const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const DAYS_FR = ['', 'L', '', 'M', '', 'V', ''];

    // Month labels
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wIdx) => {
        const firstDay = new Date(week[0]);
        if (firstDay.getMonth() !== lastMonth) {
            lastMonth = firstDay.getMonth();
            monthLabels.push({ label: MONTHS_FR[lastMonth], col: wIdx });
        }
    });

    return (
        <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18, padding: '1.5rem 1.75rem', overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ede9e3', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={15} style={{ color: '#c8a960' }} />
                    Activité sur 6 mois
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                    {totalDays} jour{totalDays !== 1 ? 's' : ''} actif{totalDays !== 1 ? 's' : ''}
                </span>
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                {/* Month labels row */}
                <div style={{ display: 'flex', gap: 1, marginBottom: 4, marginLeft: 22 }}>
                    {weeks.map((_, wIdx) => {
                        const ml = monthLabels.find(m => m.col === wIdx);
                        return (
                            <div key={wIdx} style={{ width: 11, minWidth: 11, fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', fontWeight: 600, textAlign: 'left' }}>
                                {ml ? ml.label : ''}
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: 1 }}>
                    {/* Day labels */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 4 }}>
                        {DAYS_FR.map((d, i) => (
                            <div key={i} style={{ width: 14, height: 11, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    {weeks.map((week, wIdx) => (
                        <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {Array.from({ length: 7 }, (_, dayIdx) => {
                                const key = week[dayIdx];
                                if (!key) return <div key={dayIdx} style={{ width: 11, height: 11 }} />;
                                const hrs = dayMap[key] || 0;
                                const d = new Date(key);
                                return (
                                    <div
                                        key={dayIdx}
                                        title={`${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}: ${hrs > 0 ? fmtH(hrs) : 'Aucune activité'}`}
                                        style={{
                                            width: 11, height: 11, borderRadius: 3,
                                            background: getColor(hrs),
                                            transition: 'transform 0.1s',
                                            cursor: 'default',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12 }}>
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginRight: 4 }}>Moins</span>
                {[0, 0.15, 0.35, 0.65, 1].map((v, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: getColor(v * maxHrs) }} />
                ))}
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>Plus</span>
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════
   2. 24-HOUR RADIAL CLOCK
   ═══════════════════════════════════════════════════════════ */

export function RadialClock({ sessions }: { sessions: SessionLog[] }) {
    const { hourData, peakHour, maxHrs } = useMemo(() => {
        const buckets = new Array(24).fill(0);
        sessions.forEach(s => {
            buckets[s.started_at.getHours()] += s.duration_hours;
        });
        const max = Math.max(...buckets, 0.1);
        const peak = buckets.indexOf(max);
        return { hourData: buckets, peakHour: peak, maxHrs: max };
    }, [sessions]);

    const cx = 100, cy = 100, outerR = 82, innerR = 34;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18, padding: '1.5rem 1.75rem',
            display: 'flex', flexDirection: 'column',
        }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ede9e3', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} style={{ color: '#5eead4' }} />
                Rythme circadien
            </h3>

            {/* Chart centered */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                    {/* Background ring */}
                    <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={outerR - innerR} />

                    {/* Hour segments */}
                    {hourData.map((hrs, hour) => {
                        if (hrs === 0) return null;
                        const ratio = hrs / maxHrs;
                        const segR = innerR + (outerR - innerR) * ratio;
                        const startAngle = (hour / 24) * 360 - 90;
                        const endAngle = ((hour + 1) / 24) * 360 - 90;
                        const gap = 0.8;
                        const s = (startAngle + gap) * (Math.PI / 180);
                        const e = (endAngle - gap) * (Math.PI / 180);
                        const x1 = cx + innerR * Math.cos(s);
                        const y1 = cy + innerR * Math.sin(s);
                        const x2 = cx + segR * Math.cos(s);
                        const y2 = cy + segR * Math.sin(s);
                        const x3 = cx + segR * Math.cos(e);
                        const y3 = cy + segR * Math.sin(e);
                        const x4 = cx + innerR * Math.cos(e);
                        const y4 = cy + innerR * Math.sin(e);

                        const isPeak = hour === peakHour;
                        return (
                            <path
                                key={hour}
                                d={`M${x1},${y1} L${x2},${y2} A${segR},${segR} 0 0,1 ${x3},${y3} L${x4},${y4} A${innerR},${innerR} 0 0,0 ${x1},${y1}`}
                                fill={isPeak ? '#5eead4' : `rgba(94,234,212,${0.15 + ratio * 0.5})`}
                                style={{ transition: 'fill 0.3s' }}
                            >
                                <title>{hour}h – {hour + 1}h: {fmtH(hrs)}</title>
                            </path>
                        );
                    })}

                    {/* Hour labels (every 6h) */}
                    {[0, 6, 12, 18].map(h => {
                        const angle = (h / 24) * 360 - 90;
                        const labelR = outerR + 12;
                        const x = cx + labelR * Math.cos(angle * Math.PI / 180);
                        const y = cy + labelR * Math.sin(angle * Math.PI / 180);
                        return (
                            <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central"
                                style={{ fontSize: '0.55rem', fill: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                                {h}h
                            </text>
                        );
                    })}

                    {/* Center label */}
                    <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '1.2rem', fontWeight: 900, fill: '#ede9e3', fontFamily: 'var(--font-display)' }}>
                        {peakHour}h
                    </text>
                    <text x={cx} y={cy + 9} textAnchor="middle" style={{ fontSize: '0.45rem', fill: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        pic d'activité
                    </text>
                </svg>
            </div>

            {/* Legend – compact horizontal grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {[
                    { label: 'Matin', hours: hourData.slice(6, 12).reduce((a, b) => a + b, 0), color: '#fbbf24', emoji: '🌅' },
                    { label: 'Après-midi', hours: hourData.slice(12, 18).reduce((a, b) => a + b, 0), color: '#f59e0b', emoji: '☀️' },
                    { label: 'Soir', hours: hourData.slice(18, 24).reduce((a, b) => a + b, 0), color: '#a78bfa', emoji: '🌙' },
                    { label: 'Nuit', hours: hourData.slice(0, 6).reduce((a, b) => a + b, 0), color: '#6366f1', emoji: '🌑' },
                ].map(p => {
                    const total = hourData.reduce((a, b) => a + b, 0) || 1;
                    const pct = Math.round((p.hours / total) * 100);
                    return (
                        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.85rem' }}>{p.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{p.label}</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: p.color }}>{pct}%</span>
                                </div>
                                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: p.color, transition: 'width 0.5s ease' }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════
   3. CATEGORY / OBJECTIVE DONUT CHART
   ═══════════════════════════════════════════════════════════ */

const DONUT_COLORS = ['#c8a960', '#5eead4', '#f59e0b', '#a78bfa', '#f472b6', '#4ade80', '#60a5fa', '#fb923c'];

export function CategoryDonut({ sessions }: { sessions: SessionLog[] }) {
    const { slices, total } = useMemo(() => {
        const titleMap: Record<string, number> = {};
        sessions.forEach(s => {
            const name = s.title || 'Sans titre';
            titleMap[name] = (titleMap[name] || 0) + s.duration_hours;
        });
        const sorted = Object.entries(titleMap).sort((a, b) => b[1] - a[1]);
        const totalHrs = sorted.reduce((a, [, h]) => a + h, 0);

        // Top 6 + "Autres"
        const top = sorted.slice(0, 6);
        const rest = sorted.slice(6).reduce((a, [, h]) => a + h, 0);
        if (rest > 0) top.push(['Autres', rest]);

        return {
            slices: top.map(([name, hrs], i) => ({
                name,
                hours: hrs,
                pct: totalHrs > 0 ? (hrs / totalHrs) * 100 : 0,
                color: DONUT_COLORS[i % DONUT_COLORS.length],
            })),
            total: totalHrs,
        };
    }, [sessions]);

    const [hovered, setHovered] = useState<number | null>(null);

    const cx = 100, cy = 100, r = 80, strokeW = 22;

    // Build arc segments
    let cumAngle = -90;
    const arcs = slices.map((s, i) => {
        const sweep = (s.pct / 100) * 360;
        const start = cumAngle;
        cumAngle += sweep;
        const gap = slices.length > 1 ? 2 : 0;
        const s1 = (start + gap / 2) * (Math.PI / 180);
        const e1 = (start + sweep - gap / 2) * (Math.PI / 180);
        const largeArc = sweep - gap > 180 ? 1 : 0;
        const arcR = r;
        const x1 = cx + arcR * Math.cos(s1);
        const y1 = cy + arcR * Math.sin(s1);
        const x2 = cx + arcR * Math.cos(e1);
        const y2 = cy + arcR * Math.sin(e1);
        return { ...s, idx: i, d: `M${x1},${y1} A${arcR},${arcR} 0 ${largeArc},1 ${x2},${y2}` };
    });

    return (
        <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18, padding: '1.5rem 1.75rem',
            display: 'flex', flexDirection: 'column',
        }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ede9e3', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} style={{ color: '#a78bfa' }} />
                Répartition par objectif
            </h3>

            {slices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Aucune donnée</div>
            ) : (
                <>
                    {/* Chart centered */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                        <svg width="200" height="200" viewBox="0 0 200 200">
                            {arcs.map(a => (
                                <path
                                    key={a.idx}
                                    d={a.d}
                                    fill="none"
                                    stroke={a.color}
                                    strokeWidth={hovered === a.idx ? strokeW + 6 : strokeW}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-width 0.2s, opacity 0.2s', opacity: hovered !== null && hovered !== a.idx ? 0.3 : 1, cursor: 'pointer' }}
                                    onMouseEnter={() => setHovered(a.idx)}
                                    onMouseLeave={() => setHovered(null)}
                                />
                            ))}
                            <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '1.3rem', fontWeight: 900, fill: '#ede9e3', fontFamily: 'var(--font-display)' }}>
                                {fmtH(total)}
                            </text>
                            <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: '0.58rem', fill: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                total
                            </text>
                        </svg>
                    </div>

                    {/* Legend below */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {slices.map((s, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8,
                                    background: hovered === i ? `${s.color}12` : 'transparent',
                                    transition: 'background 0.15s', cursor: 'default',
                                }}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                                    {s.name}
                                </div>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: s.color, flexShrink: 0 }}>
                                    {Math.round(s.pct)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════
   4. STREAK CALENDAR
   ═══════════════════════════════════════════════════════════ */

export function StreakCalendar({ streak, sessions }: { streak: number; sessions: SessionLog[] }) {
    const [monthOffset, setMonthOffset] = useState(0);

    const data = useMemo(() => {
        const now = new Date();
        const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = toDateKey(now);

        // Track all session days
        const sessionDays = new Set<string>();
        sessions.forEach(s => sessionDays.add(toDateKey(s.started_at)));

        const cells: { day: number; key: string; hasSession: boolean; isToday: boolean; isFuture: boolean }[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(year, month, d);
            const key = toDateKey(dt);
            cells.push({
                day: d,
                key,
                hasSession: sessionDays.has(key),
                isToday: key === today,
                isFuture: dt > now,
            });
        }

        const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        return { cells, firstDay, monthLabel: `${MONTHS_FR[month]} ${year}`, activeDays: cells.filter(c => c.hasSession).length, daysInMonth };
    }, [sessions, monthOffset]);

    const DAYS_HEADER = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    return (
        <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18, padding: '1.5rem 1.75rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ede9e3', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flame size={15} style={{ color: '#fbbf24' }} />
                    Calendrier de streak
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                        fontSize: '0.72rem', fontWeight: 700,
                        color: streak > 0 ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                        background: streak > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                        padding: '3px 10px', borderRadius: 8,
                        border: `1px solid ${streak > 0 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                        🔥 {streak}j
                    </span>
                </div>
            </div>

            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <button onClick={() => setMonthOffset(o => o - 1)} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600,
                }}>←</button>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ede9e3' }}>{data.monthLabel}</span>
                <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600,
                    opacity: monthOffset >= 0 ? 0.3 : 1,
                }} disabled={monthOffset >= 0}>→</button>
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {/* Day headers */}
                {DAYS_HEADER.map(d => (
                    <div key={d} style={{
                        textAlign: 'center', fontSize: '0.6rem', fontWeight: 600,
                        color: 'rgba(255,255,255,0.2)', padding: '4px 0',
                    }}>{d}</div>
                ))}

                {/* Empty cells before first day */}
                {Array.from({ length: data.firstDay }, (_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {/* Day cells */}
                {data.cells.map(cell => (
                    <div key={cell.key} style={{
                        aspectRatio: '1', borderRadius: 10, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', position: 'relative',
                        background: cell.isToday
                            ? 'rgba(200,169,96,0.15)'
                            : cell.hasSession
                                ? 'rgba(251,191,36,0.08)'
                                : 'rgba(255,255,255,0.02)',
                        border: cell.isToday
                            ? '1.5px solid rgba(200,169,96,0.4)'
                            : '1px solid rgba(255,255,255,0.04)',
                        opacity: cell.isFuture ? 0.3 : 1,
                        transition: 'transform 0.1s',
                    }}>
                        <span style={{
                            fontSize: '0.72rem', fontWeight: cell.isToday ? 800 : 600,
                            color: cell.hasSession ? '#fbbf24' : cell.isToday ? '#c8a960' : 'rgba(255,255,255,0.3)',
                        }}>
                            {cell.day}
                        </span>
                        {cell.hasSession && !cell.isFuture && (
                            <div style={{ fontSize: '0.5rem', marginTop: 1 }}>🔥</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12, padding: '8px 0' }}>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                    <strong style={{ color: '#fbbf24' }}>{data.activeDays}</strong> / {data.daysInMonth} jours actifs
                </span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                    Taux : <strong style={{ color: data.activeDays / data.daysInMonth > 0.7 ? '#4ade80' : data.activeDays / data.daysInMonth > 0.4 ? '#fbbf24' : '#f87171' }}>
                        {Math.round((data.activeDays / data.daysInMonth) * 100)}%
                    </strong>
                </span>
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════
   5. CUMULATIVE PROGRESS LINE
   ═══════════════════════════════════════════════════════════ */

export function CumulativeLine({ sessions }: { sessions: SessionLog[] }) {
    const { points, labels, maxHrs, totalHrs, avgPerDay } = useMemo(() => {
        if (sessions.length === 0) return { points: '', labels: [], maxHrs: 0, totalHrs: 0, avgPerDay: 0 };

        // Sort by date
        const sorted = [...sessions].sort((a, b) => a.started_at.getTime() - b.started_at.getTime());
        const firstDate = sorted[0].started_at;
        const lastDate = new Date();
        const totalDaysRange = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86400000));

        // Build cumulative by day
        const dayMap: Record<string, number> = {};
        sorted.forEach(s => {
            const key = toDateKey(s.started_at);
            dayMap[key] = (dayMap[key] || 0) + s.duration_hours;
        });

        const w = 580, h = 140, padX = 0, padY = 10;

        let cumulative = 0;
        const pts: string[] = [];
        const fillPts: string[] = [];
        const allLabels: { x: number; label: string }[] = [];
        let lastMonthLabel = -1;

        const cursor = new Date(firstDate);
        let dayIdx = 0;
        while (cursor <= lastDate) {
            const key = toDateKey(cursor);
            cumulative += dayMap[key] || 0;

            const x = padX + (dayIdx / Math.max(totalDaysRange - 1, 1)) * (w - padX * 2);
            const y = padY + h - padY * 2 - (cumulative / Math.max(cumulative, 1)) * (h - padY * 2);

            pts.push(`${x},${y}`);
            fillPts.push(`${x},${y}`);

            // Month labels
            if (cursor.getMonth() !== lastMonthLabel && totalDaysRange > 14) {
                lastMonthLabel = cursor.getMonth();
                const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
                allLabels.push({ x, label: MONTHS[cursor.getMonth()] });
            }

            cursor.setDate(cursor.getDate() + 1);
            dayIdx++;
        }

        // Normalize y-values
        const total = cumulative;
        const normalizedPts: string[] = [];
        const normalizedFill: string[] = [];
        let cumNorm = 0;
        const cursor2 = new Date(firstDate);
        dayIdx = 0;
        while (cursor2 <= lastDate) {
            const key = toDateKey(cursor2);
            cumNorm += dayMap[key] || 0;
            const x = padX + (dayIdx / Math.max(totalDaysRange - 1, 1)) * (w - padX * 2);
            const y = padY + (h - padY * 2) - (cumNorm / Math.max(total, 0.1)) * (h - padY * 2);
            normalizedPts.push(`${x},${y}`);
            normalizedFill.push(`${x},${y}`);
            cursor2.setDate(cursor2.getDate() + 1);
            dayIdx++;
        }

        // Close fill path
        normalizedFill.push(`${w},${h}`);
        normalizedFill.push(`0,${h}`);

        return {
            points: normalizedPts.join(' '),
            labels: allLabels,
            maxHrs: total,
            totalHrs: total,
            avgPerDay: totalDaysRange > 0 ? total / totalDaysRange : 0,
            fillPath: normalizedFill.join(' '),
        };
    }, [sessions]) as any;

    if (sessions.length < 2) return null;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18, padding: '1.5rem 1.75rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ede9e3', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={15} style={{ color: '#4ade80' }} />
                    Progression cumulée
                </h3>
                <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                        Total : <strong style={{ color: '#4ade80' }}>{fmtH(totalHrs)}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                        Moy : <strong style={{ color: '#5eead4' }}>{fmtH(avgPerDay)}/j</strong>
                    </span>
                </div>
            </div>

            <svg width="100%" height="160" viewBox="0 0 580 160" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="cumLine" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#5eead4" />
                        <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                    <linearGradient id="cumFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(v => (
                    <line key={v} x1="0" y1={10 + 140 * (1 - v)} x2="580" y2={10 + 140 * (1 - v)}
                        stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}

                {/* Fill area */}
                {points && (
                    <polygon
                        points={`${points} 580,160 0,160`}
                        fill="url(#cumFill)"
                    />
                )}

                {/* Line */}
                {points && (
                    <polyline
                        points={points}
                        fill="none"
                        stroke="url(#cumLine)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Month labels */}
                {labels.map((l: any, i: number) => (
                    <text key={i} x={l.x} y="156" style={{ fontSize: '0.55rem', fill: 'rgba(255,255,255,0.18)', fontWeight: 500 }}>
                        {l.label}
                    </text>
                ))}
            </svg>
        </div>
    );
}
