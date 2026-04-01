'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft, ChevronRight, Calendar, Clock, Users, ArrowRight,
    Target, Rocket, Handshake, Flag, Zap, X, ExternalLink,
    Bell, BellOff, Filter, CalendarDays, Phone, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

/* ─── Constants ── */
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/* ─── Event sources ── */
type EventSource = 'objective-session' | 'project-session' | 'accountability-session' | 'milestone' | 'sprint' | 'recruiting-call';

type CalEvent = {
    id: string;
    title: string;
    subtitle: string;        // salon/pair name
    type: string;            // travail/discussion/recherche/milestone/deadline/launch/review/sprint-start/sprint-end/recruiting
    source: EventSource;
    date: Date;
    sourceId: string;        // objective_id / project_id / accountability_id
    sourceName: string;      // objective_title / project_title / pair name
    href: string;            // direct navigation link
    attendees?: string[];
    sprintGoal?: string;
    isRecruitingCall?: boolean;
};

const SOURCE_META: Record<EventSource, { icon: typeof Target; label: string; color: string }> = {
    'objective-session': { icon: Target, label: 'Objectif', color: '#c8a960' },
    'project-session':  { icon: Rocket, label: 'Projet', color: '#3b82f6' },
    'accountability-session': { icon: Handshake, label: 'Accountability', color: '#f59e0b' },
    'milestone':        { icon: Flag, label: 'Jalon', color: '#10b981' },
    'sprint':           { icon: Zap, label: 'Sprint', color: '#5eead4' },
    'recruiting-call':  { icon: Phone, label: 'Recrutement', color: '#8b5cf6' },
};

const REMINDER_OPTIONS = [
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 heure' },
];

const TYPE_LABELS: Record<string, string> = {
    'travail': '💼 Travail',
    'discussion': '💬 Discussion',
    'recherche': '🔎 Recherche',
    'milestone': '🏁 Jalon',
    'deadline': '⏰ Deadline',
    'launch': '🚀 Lancement',
    'review': '📋 Revue',
    'sprint-start': '⚡ Début sprint',
    'sprint-end': '🏁 Fin sprint',
    'recruiting': '📞 Recrutement',
};

/* ─── Helpers ── */
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function fmtTime(d: Date) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function fmtDate(d: Date) { return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

const REMINDER_KEY = 'cal-reminders'; // stores { [eventId]: minutesBefore }

/* ─── Component ── */
export default function CalendarPage() {
    const { user } = useAuth();
    const router = useRouter();
    const today = new Date();

    const [events, setEvents] = useState<CalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
    const [view, setView] = useState<'month' | 'list'>('month');

    // Filters
    const [activeFilters, setActiveFilters] = useState<Set<EventSource>>(new Set(['objective-session', 'project-session', 'accountability-session', 'milestone', 'sprint', 'recruiting-call']));
    const [showFilters, setShowFilters] = useState(false);

    // Detail modal
    const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

    // Reminders — stored as { eventId: minutesBefore }
    const [reminders, setReminders] = useState<Record<string, number>>({});
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

    // Load reminders from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(REMINDER_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Handle legacy Set format (array of strings)
                if (Array.isArray(parsed)) {
                    const migrated: Record<string, number> = {};
                    parsed.forEach((id: string) => { migrated[id] = 15; });
                    setReminders(migrated);
                } else {
                    setReminders(parsed);
                }
            }
        } catch { }
        if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
    }, []);

    // Save reminders
    const saveReminders = (r: Record<string, number>) => {
        setReminders(r);
        localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
    };

    // Request notification permission
    const requestNotifPermission = async () => {
        if (typeof Notification === 'undefined') return;
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
    };

    const setReminder = (eventId: string, minutes: number) => {
        if (notifPermission !== 'granted') {
            requestNotifPermission();
            return;
        }
        const next = { ...reminders };
        if (next[eventId] === minutes) {
            delete next[eventId]; // toggle off
        } else {
            next[eventId] = minutes;
        }
        saveReminders(next);
    };

    const removeReminder = (eventId: string) => {
        const next = { ...reminders };
        delete next[eventId];
        saveReminders(next);
    };

    // Reminder check interval removed... handled globally by GlobalReminders.tsx


    /* ─── Fetch all events (real-time via membership listeners) ── */
    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const allEvents: CalEvent[] = [];

                // ── 1. Objective sessions + milestones ──
                const memQ = query(collection(db, 'memberships'), where('user_id', '==', user.uid));
                const memSnap = await getDocs(memQ);
                const objectiveIds = memSnap.docs.map(d => d.data().objective_id as string);

                if (objectiveIds.length > 0) {
                    const objTitles: Record<string, string> = {};
                    await Promise.all(objectiveIds.map(async (oid) => {
                        const objSnap = await getDocs(query(collection(db, 'objectives'), where('__name__', '==', oid)));
                        if (!objSnap.empty) objTitles[oid] = objSnap.docs[0].data().title;
                    }));

                    await Promise.all(objectiveIds.map(async (oid) => {
                        // Sessions
                        const sessSnap = await getDocs(collection(db, 'objectives', oid, 'sessions'));
                        sessSnap.docs.forEach(d => {
                            const data = d.data();
                            const rawDate = data.scheduled_at?.toDate ? data.scheduled_at.toDate() : new Date(data.scheduled_at);
                            allEvents.push({
                                id: `obj-sess-${d.id}`,
                                title: data.title || 'Session',
                                subtitle: objTitles[oid] ?? 'Objectif',
                                type: data.type ?? 'travail',
                                source: 'objective-session',
                                date: rawDate,
                                sourceId: oid,
                                sourceName: objTitles[oid] ?? 'Objectif',
                                href: `/objective/${oid}`,
                                attendees: data.attendees ?? [],
                            });
                        });

                        // Roadmap milestones
                        const msSnap = await getDocs(collection(db, 'objectives', oid, 'roadmap_milestones'));
                        msSnap.docs.forEach(d => {
                            const data = d.data();
                            if (!data.date) return;
                            const msDate = new Date(data.date + 'T09:00:00');
                            allEvents.push({
                                id: `obj-ms-${d.id}`,
                                title: data.title || 'Jalon',
                                subtitle: objTitles[oid] ?? 'Objectif',
                                type: data.type || 'milestone',
                                source: 'milestone',
                                date: msDate,
                                sourceId: oid,
                                sourceName: objTitles[oid] ?? 'Objectif',
                                href: `/objective/${oid}`,
                            });
                        });
                    }));
                }

                // ── 2. Project sessions + milestones + sprints ──
                const projMemQ = query(collection(db, 'project_memberships'), where('user_id', '==', user.uid));
                const projMemSnap = await getDocs(projMemQ);
                const projectIds = projMemSnap.docs.map(d => d.data().project_id as string);

                if (projectIds.length > 0) {
                    const projTitles: Record<string, string> = {};
                    await Promise.all(projectIds.map(async (pid) => {
                        const pSnap = await getDoc(doc(db, 'projects', pid));
                        if (pSnap.exists()) projTitles[pid] = pSnap.data().title;
                    }));

                    await Promise.all(projectIds.map(async (pid) => {
                        // Sessions
                        const sessSnap = await getDocs(collection(db, 'projects', pid, 'sessions'));
                        sessSnap.docs.forEach(d => {
                            const data = d.data();
                            const rawDate = data.scheduled_at?.toDate ? data.scheduled_at.toDate() : new Date(data.scheduled_at);
                            allEvents.push({
                                id: `proj-sess-${d.id}`,
                                title: data.title || 'Session',
                                subtitle: projTitles[pid] ?? 'Projet',
                                type: data.type ?? 'travail',
                                source: 'project-session',
                                date: rawDate,
                                sourceId: pid,
                                sourceName: projTitles[pid] ?? 'Projet',
                                href: `/project/${pid}`,
                                attendees: data.attendees ?? [],
                            });
                        });

                        // Roadmap milestones
                        const msSnap = await getDocs(collection(db, 'projects', pid, 'roadmap_milestones'));
                        msSnap.docs.forEach(d => {
                            const data = d.data();
                            if (!data.date) return;
                            const msDate = new Date(data.date + 'T09:00:00');
                            allEvents.push({
                                id: `proj-ms-${d.id}`,
                                title: data.title || 'Jalon',
                                subtitle: projTitles[pid] ?? 'Projet',
                                type: data.type || 'milestone',
                                source: 'milestone',
                                date: msDate,
                                sourceId: pid,
                                sourceName: projTitles[pid] ?? 'Projet',
                                href: `/project/${pid}`,
                            });
                        });

                        // Sprints
                        const sprintSnap = await getDocs(collection(db, 'projects', pid, 'sprints'));
                        sprintSnap.docs.forEach(d => {
                            const data = d.data();
                            if (data.start_date) {
                                allEvents.push({
                                    id: `sprint-start-${d.id}`,
                                    title: `Sprint: ${data.title}`,
                                    subtitle: projTitles[pid] ?? 'Projet',
                                    type: 'sprint-start',
                                    source: 'sprint',
                                    date: new Date(data.start_date + 'T08:00:00'),
                                    sourceId: pid,
                                    sourceName: projTitles[pid] ?? 'Projet',
                                    href: `/project/${pid}`,
                                    sprintGoal: data.goal,
                                });
                            }
                            if (data.end_date) {
                                allEvents.push({
                                    id: `sprint-end-${d.id}`,
                                    title: `Fin sprint: ${data.title}`,
                                    subtitle: projTitles[pid] ?? 'Projet',
                                    type: 'sprint-end',
                                    source: 'sprint',
                                    date: new Date(data.end_date + 'T18:00:00'),
                                    sourceId: pid,
                                    sourceName: projTitles[pid] ?? 'Projet',
                                    href: `/project/${pid}`,
                                    sprintGoal: data.goal,
                                });
                            }
                        });
                    }));
                }

                // ── 3. Accountability pair sessions ──
                const accQ1 = query(collection(db, 'accountability_pairs'), where('user1_id', '==', user.uid));
                const accQ2 = query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid));
                const [accSnap1, accSnap2] = await Promise.all([getDocs(accQ1), getDocs(accQ2)]);
                const accPairs = [...accSnap1.docs, ...accSnap2.docs];

                if (accPairs.length > 0) {
                    await Promise.all(accPairs.map(async (pairDoc) => {
                        const pairData = pairDoc.data();
                        const partnerUid = pairData.user1_id === user.uid ? pairData.user2_id : pairData.user1_id;
                        let partnerName = 'Partenaire';
                        try {
                            const pSnap = await getDoc(doc(db, 'users', partnerUid));
                            if (pSnap.exists()) partnerName = pSnap.data().full_name || 'Partenaire';
                        } catch { }

                        const sessSnap = await getDocs(collection(db, 'accountability_pairs', pairDoc.id, 'sessions'));
                        sessSnap.docs.forEach(d => {
                            const data = d.data();
                            const rawDate = data.scheduled_at?.toDate ? data.scheduled_at.toDate() : new Date(data.scheduled_at);
                            allEvents.push({
                                id: `acc-sess-${d.id}`,
                                title: data.title || 'Session Accountability',
                                subtitle: `avec ${partnerName}`,
                                type: data.type ?? 'travail',
                                source: 'accountability-session',
                                date: rawDate,
                                sourceId: pairDoc.id,
                                sourceName: `Accountability avec ${partnerName}`,
                                href: `/accountability/${pairDoc.id}`,
                                attendees: [user.uid, partnerUid],
                            });
                        });
                    }));
                }

                // ── 4. Recruiting call sessions (from teammate_requests) ──
                // Fetch requests where user is creator
                const trCreatorQ = query(collection(db, 'teammate_requests'), where('creator_id', '==', user.uid));
                const trCreatorSnap = await getDocs(trCreatorQ);
                // Also fetch requests where user is an applicant (we check all open requests and filter)
                const trOpenQ = query(collection(db, 'teammate_requests'), where('status', '==', 'open'));
                const trOpenSnap = await getDocs(trOpenQ);
                
                const recruitingRequestIds = new Set<string>();
                const recruitingRequestTitles: Record<string, string> = {};
                
                trCreatorSnap.docs.forEach(d => {
                    recruitingRequestIds.add(d.id);
                    recruitingRequestTitles[d.id] = d.data().target_title;
                });
                trOpenSnap.docs.forEach(d => {
                    const data = d.data();
                    const applicants = data.applicants || [];
                    if (applicants.some((a: any) => a.user_id === user.uid)) {
                        recruitingRequestIds.add(d.id);
                        recruitingRequestTitles[d.id] = data.target_title;
                    }
                });

                if (recruitingRequestIds.size > 0) {
                    await Promise.all([...recruitingRequestIds].map(async (trId) => {
                        const sessSnap = await getDocs(collection(db, 'teammate_requests', trId, 'sessions'));
                        sessSnap.docs.forEach(d => {
                            const data = d.data();
                            const rawDate = data.scheduled_at?.toDate ? data.scheduled_at.toDate() : new Date(data.scheduled_at);
                            allEvents.push({
                                id: `recruit-${d.id}`,
                                title: data.title || 'Appel recrutement',
                                subtitle: recruitingRequestTitles[trId] ?? 'Recrutement',
                                type: 'recruiting',
                                source: 'recruiting-call',
                                date: rawDate,
                                sourceId: trId,
                                sourceName: recruitingRequestTitles[trId] ?? 'Recrutement',
                                href: `/find-teammates/${trId}`,
                                attendees: data.attendees ?? [],
                                isRecruitingCall: true,
                            });
                        });
                    }));
                }

                allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
                setEvents(allEvents);
            } catch (err) {
                console.error('Calendar load error', err);
            } finally {
                setLoading(false);
            }
        };
        // Real-time: re-fetch events when memberships change
        let skip1 = true, skip2 = true;
        const unsub1 = onSnapshot(query(collection(db, 'memberships'), where('user_id', '==', user.uid)), () => { if (skip1) { skip1 = false; load(); } else { load(); } });
        const unsub2 = onSnapshot(query(collection(db, 'project_memberships'), where('user_id', '==', user.uid)), () => { if (skip2) { skip2 = false; return; } load(); });

        return () => { unsub1(); unsub2(); };
    }, [user]);

    /* ─── Filtered events ── */
    const filteredEvents = useMemo(() =>
        events.filter(e => activeFilters.has(e.source)),
    [events, activeFilters]);

    /* ─── Events for selected day ── */
    const eventsForDay = useMemo(() => {
        if (!selectedDay) return [];
        return filteredEvents.filter(e =>
            e.date.getFullYear() === viewYear &&
            e.date.getMonth() === viewMonth &&
            e.date.getDate() === selectedDay
        );
    }, [filteredEvents, viewYear, viewMonth, selectedDay]);

    /* ─── Events by day for month grid ── */
    const eventsByDay = useMemo(() => {
        const map: Record<number, CalEvent[]> = {};
        filteredEvents.forEach(e => {
            if (e.date.getFullYear() === viewYear && e.date.getMonth() === viewMonth) {
                const d = e.date.getDate();
                if (!map[d]) map[d] = [];
                map[d].push(e);
            }
        });
        return map;
    }, [filteredEvents, viewYear, viewMonth]);

    /* ─── Upcoming events (30 days) ── */
    const upcomingEvents = useMemo(() => {
        const now = new Date();
        const limit = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
        return filteredEvents.filter(e => e.date >= now && e.date <= limit).slice(0, 30);
    }, [filteredEvents]);

    /* ─── Upcoming grouped by date for list view ── */
    const upcomingGrouped = useMemo(() => {
        const groups: { dateKey: string; label: string; events: CalEvent[] }[] = [];
        const map = new Map<string, CalEvent[]>();
        upcomingEvents.forEach(ev => {
            const key = ev.date.toDateString();
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        });
        map.forEach((evts, key) => {
            const d = evts[0].date;
            const isToday = isSameDay(d, today);
            const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
            const isTomorrow = isSameDay(d, tomorrow);
            const label = isToday ? "Aujourd'hui" : isTomorrow ? 'Demain' : fmtDate(d);
            groups.push({ dateKey: key, label, events: evts });
        });
        return groups;
    }, [upcomingEvents]);

    /* ─── Stats ── */
    const stats = useMemo(() => {
        const now = new Date();
        const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
        const thisWeek = filteredEvents.filter(e => e.date >= now && e.date <= weekEnd);
        const sessions = thisWeek.filter(e => e.source.endsWith('-session')).length;
        const milestones = thisWeek.filter(e => e.source === 'milestone').length;
        const sprints = thisWeek.filter(e => e.source === 'sprint').length;
        return { sessions, milestones, sprints, total: thisWeek.length };
    }, [filteredEvents]);

    /* ─── Navigation ── */
    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
        setSelectedDay(null);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
        setSelectedDay(null);
    };
    const goToToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDay(today.getDate());
    };

    const toggleFilter = (source: EventSource) => {
        const next = new Set(activeFilters);
        if (next.has(source)) next.delete(source);
        else next.add(source);
        setActiveFilters(next);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const getEventColor = (ev: CalEvent) => SOURCE_META[ev.source]?.color ?? '#c8a960';

    return (
        <div className="container fade-enter" style={{ maxWidth: '1060px', padding: '2rem 1.5rem' }}>
            <style>{`
                .cal-modal-overlay {
                    position: fixed; inset: 0; z-index: 200;
                    background: rgba(0,0,0,.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                    display: flex; align-items: center; justify-content: center;
                    animation: cal-fade-in 0.2s ease;
                }
                .cal-modal {
                    animation: cal-slide-up 0.3s cubic-bezier(0.22,1,0.36,1);
                    width: 480px; max-width: 92vw;
                    background: #111114; border: 1px solid rgba(255,255,255,.08);
                    border-radius: 24px;
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05);
                    overflow: hidden;
                }
                @keyframes cal-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes cal-slide-up { from { opacity: 0; transform: translateY(20px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .cal-filter-chip {
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 5px 12px; border-radius: 20px; font-size: 0.72rem; font-weight: 700;
                    cursor: pointer; transition: all 0.15s; user-select: none;
                }
                .cal-filter-chip:hover { transform: translateY(-1px); }
                .cal-day-cell {
                    border-radius: 10px; padding: 6px 4px; cursor: pointer;
                    min-height: 52px; display: flex; flex-direction: column;
                    align-items: center; gap: 3px; transition: all 0.15s ease;
                }
                .cal-day-cell:hover { background: rgba(255,255,255,.06) !important; }
                .cal-event-card {
                    padding: 0.75rem; cursor: pointer; transition: all 0.15s ease;
                    border-radius: 12px; background: rgba(255,255,255,.02);
                    border: 1px solid rgba(255,255,255,.06);
                }
                .cal-event-card:hover { background: rgba(255,255,255,.05) !important; border-color: rgba(255,255,255,.12) !important; transform: translateY(-1px); }
                .cal-list-card {
                    display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem;
                    text-decoration: none; transition: all 0.2s ease; cursor: pointer;
                    border-radius: 14px; background: rgba(255,255,255,.02);
                    border: 1px solid rgba(255,255,255,.06);
                }
                .cal-list-card:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); transform: translateY(-1px); }
                .cal-stat-card {
                    padding: 0.8rem 1rem; border-radius: 14px;
                    background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.06);
                    text-align: center; flex: 1;
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>Planning</p>
                    <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Calendar size={22} style={{ color: '#c8a960', flexShrink: 0 }} /> Mon Calendrier
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.88rem', margin: '4px 0 0' }}>Tous vos événements — sessions, jalons, sprints, accountability</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Today button */}
                    <button onClick={goToToday} style={{
                        padding: '7px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                        background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.2)', color: '#c8a960',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                        <CalendarDays size={13} /> Aujourd&apos;hui
                    </button>

                    {/* Filters toggle */}
                    <button onClick={() => setShowFilters(!showFilters)} style={{
                        padding: '7px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                        background: showFilters ? 'rgba(200,169,96,0.12)' : 'rgba(255,255,255,.03)',
                        border: showFilters ? '1px solid rgba(200,169,96,0.3)' : '1px solid rgba(255,255,255,0.07)',
                        color: showFilters ? '#c8a960' : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                        <Filter size={13} /> Filtres
                    </button>

                    {/* View toggle */}
                    <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '3px', gap: '2px' }}>
                        {([['month', '📅 Mois'], ['list', '📋 Liste']] as const).map(([v, label]) => (
                            <button key={v} onClick={() => setView(v)} style={{
                                padding: '7px 18px', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                                border: view === v ? '1px solid rgba(200,169,96,0.35)' : '1px solid transparent',
                                background: view === v ? 'rgba(200,169,96,0.15)' : 'transparent',
                                color: view === v ? '#c8a960' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s'
                            }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter chips */}
            {showFilters && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem', animation: 'cal-fade-in 0.2s ease' }}>
                    {(Object.entries(SOURCE_META) as [EventSource, typeof SOURCE_META[EventSource]][]).map(([key, meta]) => {
                        const active = activeFilters.has(key);
                        const Icon = meta.icon;
                        return (
                            <div
                                key={key}
                                className="cal-filter-chip"
                                onClick={() => toggleFilter(key)}
                                style={{
                                    background: active ? `${meta.color}15` : 'rgba(255,255,255,.03)',
                                    border: `1px solid ${active ? meta.color + '35' : 'rgba(255,255,255,.08)'}`,
                                    color: active ? meta.color : 'rgba(255,255,255,.3)',
                                    opacity: active ? 1 : 0.6,
                                }}
                            >
                                <Icon size={12} /> {meta.label}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Week stats */}
            {!loading && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                    <div className="cal-stat-card">
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c8a960' }}>{stats.total}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cette semaine</div>
                    </div>
                    <div className="cal-stat-card">
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c8a960' }}>{stats.sessions}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions</div>
                    </div>
                    <div className="cal-stat-card">
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{stats.milestones}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jalons</div>
                    </div>
                    <div className="cal-stat-card">
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#5eead4' }}>{stats.sprints}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sprints</div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="card card-glass text-center py-16">
                    <div className="loader mx-auto" style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
                    <p className="text-secondary mt-4">Chargement de vos événements...</p>
                </div>
            ) : view === 'list' ? (
                /* ═══ LIST VIEW ═══ */
                <div>
                    <h4 className="text-secondary mb-4" style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Événements à venir — 30 prochains jours
                    </h4>
                    {upcomingGrouped.length === 0 ? (
                        <div className="card card-glass text-center fade-enter" style={{ padding: '4rem 2rem', border: '1px dashed rgba(200,169,96,0.2)', background: 'rgba(200,169,96,0.02)' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <Calendar size={28} style={{ color: '#c8a960' }} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>Aucun événement à venir</h3>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', lineHeight: 1.5, maxWidth: 340, margin: '0 auto' }}>
                                Programmez des sessions dans vos salons via l&apos;onglet Agenda pour les voir ici.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {upcomingGrouped.map((group) => (
                                <div key={group.dateKey}>
                                    <h5 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,.5)', marginBottom: '0.6rem', textTransform: 'capitalize' }}>
                                        {group.label}
                                    </h5>
                                    <div className="flex flex-col gap-3">
                                        {group.events.map((ev, i) => {
                                            const color = getEventColor(ev);
                                            const meta = SOURCE_META[ev.source];
                                            const Icon = meta.icon;
                                            const isPast = ev.date < new Date();
                                            return (
                                                <div
                                                    key={ev.id}
                                                    className="cal-list-card fade-enter"
                                                    onClick={() => setSelectedEvent(ev)}
                                                    style={{
                                                        borderLeft: `3px solid ${color}`,
                                                        opacity: isPast ? 0.5 : 1,
                                                        animationDelay: `${i * 0.04}s`,
                                                    }}
                                                >
                                                    {/* Date block */}
                                                    <div style={{ textAlign: 'center', minWidth: '52px', background: `${color}18`, borderRadius: '10px', padding: '0.5rem 0.25rem' }}>
                                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color }}>{ev.date.getDate()}</div>
                                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, opacity: 0.7, letterSpacing: '0.06em' }}>
                                                            {MONTHS_FR[ev.date.getMonth()].substring(0, 3)}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span style={{ fontSize: '0.68rem', background: `${color}18`, color, padding: '2px 8px', borderRadius: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Icon size={10} /> {meta.label}
                                                            </span>
                                                            {ev.type !== 'recruiting' && (
                                                                <span style={{ fontSize: '0.68rem', opacity: 0.5, fontWeight: 600 }}>
                                                                    {TYPE_LABELS[ev.type] || ev.type}
                                                                </span>
                                                            )}
                                                            {isPast && <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>Passé</span>}
                                                        </div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }} className="truncate">{ev.title}</div>
                                                        <div className="flex items-center gap-3 mt-1" style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                                                            <span><Clock size={11} className="inline mr-1" />{fmtTime(ev.date)}</span>
                                                            <span className="truncate">{ev.sourceName}</span>
                                                            {ev.attendees && ev.attendees.length > 0 && (
                                                                <span><Users size={11} className="inline mr-1" />{ev.attendees.length}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ArrowRight size={16} style={{ opacity: 0.2, flexShrink: 0 }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* ═══ MONTH VIEW ═══ */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
                    {/* Calendar grid */}
                    <div className="card card-glass" style={{ padding: '1.25rem' }}>
                        {/* Month nav */}
                        <div className="flex items-center justify-between mb-4">
                            <button className="btn btn-sm btn-ghost" onClick={prevMonth}><ChevronLeft size={18} /></button>
                            <h3 className="m-0" style={{ fontSize: '1.1rem' }}>{MONTHS_FR[viewMonth]} {viewYear}</h3>
                            <button className="btn btn-sm btn-ghost" onClick={nextMonth}><ChevronRight size={18} /></button>
                        </div>

                        {/* Day headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
                            {DAYS_FR.map(d => (
                                <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, opacity: 0.4, paddingBottom: '4px' }}>{d}</div>
                            ))}
                        </div>

                        {/* Day cells */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dayEvents = eventsByDay[day] ?? [];
                                const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
                                const isSelected = selectedDay === day;
                                const isPast = new Date(viewYear, viewMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                                // Get unique source colors for dots
                                const uniqueColors = [...new Set(dayEvents.map(e => getEventColor(e)))];

                                return (
                                    <div
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        className="cal-day-cell"
                                        style={{
                                            background: isSelected
                                                ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                                                : isToday
                                                    ? 'rgba(200,169,96,0.12)'
                                                    : dayEvents.length > 0
                                                        ? 'rgba(255,255,255,0.04)'
                                                        : 'transparent',
                                            outline: isToday && !isSelected ? '1px solid var(--color-primary)' : 'none',
                                            opacity: isPast && !isSelected ? 0.5 : 1,
                                        }}
                                    >
                                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected || isToday ? 700 : 400, color: isSelected ? '#fff' : 'inherit' }}>
                                            {day}
                                        </span>
                                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {uniqueColors.slice(0, 4).map((color, di) => (
                                                <div key={di} style={{
                                                    width: '6px', height: '6px', borderRadius: '50%',
                                                    background: isSelected ? 'rgba(255,255,255,0.8)' : color,
                                                }} />
                                            ))}
                                            {dayEvents.length > 4 && (
                                                <div style={{ fontSize: '0.5rem', fontWeight: 700, opacity: 0.6, color: isSelected ? '#fff' : 'inherit' }}>+{dayEvents.length - 4}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-4 justify-center mt-5 flex-wrap" style={{ fontSize: '0.7rem', opacity: 0.45 }}>
                            {(Object.entries(SOURCE_META) as [EventSource, typeof SOURCE_META[EventSource]][]).map(([key, meta]) => {
                                if (!activeFilters.has(key)) return null;
                                const Icon = meta.icon;
                                return (
                                    <span key={key} className="flex items-center gap-1">
                                        <Icon size={9} style={{ color: meta.color }} />
                                        <span style={{ color: meta.color }}>{meta.label}</span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Day detail panel */}
                    <div className="card card-glass" style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: '560px' }}>
                        {selectedDay ? (
                            <>
                                <h4 className="m-0 mb-4" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                                    📅 {selectedDay} {MONTHS_FR[viewMonth]}
                                    <span style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.4, marginLeft: '8px' }}>
                                        {eventsForDay.length} événement{eventsForDay.length !== 1 ? 's' : ''}
                                    </span>
                                </h4>
                                {eventsForDay.length === 0 ? (
                                    <div className="text-center" style={{ padding: '2.5rem 1rem' }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                            <Calendar size={20} style={{ color: '#c8a960', opacity: 0.6 }} />
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Aucun événement ce jour</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {eventsForDay.map(ev => {
                                            const color = getEventColor(ev);
                                            const meta = SOURCE_META[ev.source];
                                            const Icon = meta.icon;
                                            return (
                                                <div
                                                    key={ev.id}
                                                    className="cal-event-card"
                                                    onClick={() => setSelectedEvent(ev)}
                                                    style={{ borderLeft: `3px solid ${color}` }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                        <span style={{
                                                            fontSize: '0.65rem', background: `${color}18`, color, padding: '2px 8px',
                                                            borderRadius: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px'
                                                        }}>
                                                            <Icon size={9} /> {meta.label}
                                                        </span>
                                                        {ev.type !== 'recruiting' && (
                                                            <span style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 600 }}>
                                                                {TYPE_LABELS[ev.type] || ev.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{ev.title}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                        <span><Clock size={10} className="inline mr-1" />{fmtTime(ev.date)}</span>
                                                        {ev.attendees && ev.attendees.length > 0 && (
                                                            <span><Users size={10} className="inline mr-1" />{ev.attendees.length}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', opacity: 0.35, marginTop: '4px' }}>
                                                        {ev.sourceName}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8" style={{ opacity: 0.3 }}>
                                <Calendar size={40} className="mx-auto mb-3" />
                                <p style={{ fontSize: '0.85rem' }}>Sélectionnez un jour pour voir les événements</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ EVENT DETAIL MODAL ═══ */}
            {selectedEvent && (
                <div className="cal-modal-overlay" onClick={() => setSelectedEvent(null)}>
                    <div className="cal-modal" onClick={e => e.stopPropagation()}>
                        {/* Header bar */}
                        <div style={{
                            height: '4px',
                            background: `linear-gradient(90deg, ${getEventColor(selectedEvent)}, ${getEventColor(selectedEvent)}80, transparent)`,
                        }} />
                        <div style={{ padding: '1.5rem' }}>
                            {/* Close */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {(() => {
                                        const meta = SOURCE_META[selectedEvent.source];
                                        const Icon = meta.icon;
                                        const color = meta.color;
                                        return (
                                            <>
                                                <span style={{
                                                    fontSize: '0.7rem', background: `${color}15`, color, padding: '3px 10px',
                                                    borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    border: `1px solid ${color}25`
                                                }}>
                                                    <Icon size={11} /> {meta.label}
                                                </span>
                                                {selectedEvent.type !== 'recruiting' && (
                                                    <span style={{
                                                        fontSize: '0.7rem', padding: '3px 10px', borderRadius: '12px', fontWeight: 600,
                                                        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                                                        color: 'rgba(255,255,255,.45)'
                                                    }}>
                                                        {TYPE_LABELS[selectedEvent.type] || selectedEvent.type}
                                                    </span>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                <button onClick={() => setSelectedEvent(null)} style={{
                                    width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                                    color: 'rgba(255,255,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Title */}
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800, color: '#ede9e3', letterSpacing: '-0.02em' }}>
                                {selectedEvent.title}
                            </h3>

                            {/* Details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,.55)' }}>
                                    <Calendar size={14} style={{ color: getEventColor(selectedEvent), flexShrink: 0 }} />
                                    {fmtDate(selectedEvent.date)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,.55)' }}>
                                    <Clock size={14} style={{ color: getEventColor(selectedEvent), flexShrink: 0 }} />
                                    {fmtTime(selectedEvent.date)}
                                </div>
                                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,.55)' }}>
                                        <Users size={14} style={{ color: getEventColor(selectedEvent), flexShrink: 0 }} />
                                        {selectedEvent.attendees.length} participant{selectedEvent.attendees.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                                {selectedEvent.sprintGoal && (
                                    <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.15)', fontSize: '0.8rem', color: 'rgba(255,255,255,.5)' }}>
                                        <span style={{ fontWeight: 700, color: '#5eead4', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Objectif sprint</span>
                                        <br />{selectedEvent.sprintGoal}
                                    </div>
                                )}
                            </div>

                            {/* Source salon */}
                            <div style={{
                                padding: '0.8rem', borderRadius: '12px',
                                background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    Salon source
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>
                                    {selectedEvent.sourceName}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                                <Link
                                    href={selectedEvent.href}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        padding: '10px 16px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700,
                                        background: `linear-gradient(135deg, ${getEventColor(selectedEvent)}25, ${getEventColor(selectedEvent)}10)`,
                                        border: `1px solid ${getEventColor(selectedEvent)}35`,
                                        color: getEventColor(selectedEvent), textDecoration: 'none', transition: 'all 0.15s',
                                    }}
                                >
                                    <ExternalLink size={14} />
                                    {selectedEvent.isRecruitingCall ? 'Voir la conversation' : 'Aller au salon'}
                                </Link>
                            </div>

                            {/* Reminder time picker */}
                            <div style={{
                                padding: '0.8rem', borderRadius: '12px',
                                background: reminders[selectedEvent.id] !== undefined ? 'rgba(251,146,60,0.05)' : 'rgba(255,255,255,.02)',
                                border: `1px solid ${reminders[selectedEvent.id] !== undefined ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,.06)'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: reminders[selectedEvent.id] !== undefined ? '#fb923c' : 'rgba(255,255,255,.4)' }}>
                                        <Bell size={13} /> Rappel
                                    </div>
                                    {reminders[selectedEvent.id] !== undefined && (
                                        <button onClick={() => removeReminder(selectedEvent.id)} style={{
                                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 600,
                                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                                            color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s',
                                        }}>
                                            Désactiver
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {REMINDER_OPTIONS.map(opt => {
                                        const isActive = reminders[selectedEvent.id] === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => setReminder(selectedEvent.id, opt.value)}
                                                style={{
                                                    padding: '6px 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                    background: isActive ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,.03)',
                                                    border: isActive ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(255,255,255,.08)',
                                                    color: isActive ? '#fb923c' : 'rgba(255,255,255,.35)',
                                                }}
                                            >
                                                {opt.label} avant
                                            </button>
                                        );
                                    })}
                                </div>
                                {notifPermission === 'denied' && (
                                    <p style={{ fontSize: '0.7rem', color: '#ef4444', margin: '0.5rem 0 0', opacity: 0.7 }}>
                                        ⚠️ Les notifications sont bloquées. Autorisez-les dans les paramètres du navigateur.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
