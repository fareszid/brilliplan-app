'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/Avatar';
import { Timer, Flame, Target, CheckCircle2, Users, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedItem {
    id: string;
    uid: string;
    userName: string;
    avatarUrl?: string;
    avatarStyle?: string;
    type: 'session' | 'milestone' | 'streak' | 'joined';
    title: string;
    detail: string;
    timestamp: Date;
    meta?: { duration?: number; pomodoros?: number; streak?: number };
}

const FEED_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    session: { icon: <Timer size={14} />, color: '#c8a960', bg: 'rgba(200,169,96,0.1)' },
    milestone: { icon: <CheckCircle2 size={14} />, color: '#5eead4', bg: 'rgba(94,234,212,0.1)' },
    streak: { icon: <Flame size={14} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    joined: { icon: <Users size={14} />, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
};

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'à l\'instant';
    if (min < 60) return `il y a ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'hier';
    if (d < 7) return `il y a ${d}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function fmtDuration(hours: number): string {
    if (hours < 1 / 60) return '<1min';
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export default function ActivityFeed() {
    const { user } = useAuth();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [friendIds, setFriendIds] = useState<string[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

    // Load friend IDs
    useEffect(() => {
        if (!user) return;
        const q1 = query(collection(db, 'friendships'), where('user1_id', '==', user.uid), where('status', '==', 'accepted'));
        const q2 = query(collection(db, 'friendships'), where('user2_id', '==', user.uid), where('status', '==', 'accepted'));

        const load = async () => {
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const ids = new Set<string>();
            s1.docs.forEach(d => ids.add(d.data().user2_id));
            s2.docs.forEach(d => ids.add(d.data().user1_id));
            setFriendIds(Array.from(ids));
        };
        load();
    }, [user]);

    // Load friend profiles
    useEffect(() => {
        if (friendIds.length === 0) return;
        const load = async () => {
            const profiles: Record<string, any> = {};
            // Batch in groups of 10 (Firestore 'in' limit)
            for (let i = 0; i < friendIds.length; i += 10) {
                const batch = friendIds.slice(i, i + 10);
                const snap = await getDocs(query(collection(db, 'users'), where('__name__', 'in', batch)));
                snap.docs.forEach(d => { profiles[d.id] = { id: d.id, ...d.data() }; });
            }
            setUserProfiles(profiles);
        };
        load();
    }, [friendIds]);

    // Listen to session_logs from friends
    useEffect(() => {
        if (friendIds.length === 0) { setLoading(false); return; }

        const unsubs: (() => void)[] = [];

        // Listen in batches of 10
        for (let i = 0; i < friendIds.length; i += 10) {
            const batch = friendIds.slice(i, i + 10);
            const q = query(
                collection(db, 'session_logs'),
                where('user_id', 'in', batch),
                orderBy('created_at', 'desc'),
                limit(30)
            );
            const unsub = onSnapshot(q, snap => {
                const newItems: FeedItem[] = snap.docs.map(d => {
                    const data = d.data();
                    const profile = userProfiles[data.user_id];
                    const ts = data.created_at?.toDate?.() || data.ended_at?.toDate?.() || new Date();
                    return {
                        id: d.id,
                        uid: data.user_id,
                        userName: profile?.full_name || profile?.first_name || 'Membre',
                        avatarUrl: profile?.avatar_url,
                        avatarStyle: profile?.avatar_style,
                        type: 'session' as const,
                        title: data.title || 'Session de travail',
                        detail: `${fmtDuration(data.duration_hours || 0)} de focus${data.pomodoros > 0 ? ` · ${data.pomodoros} pomodoro${data.pomodoros > 1 ? 's' : ''}` : ''}`,
                        timestamp: ts,
                        meta: { duration: data.duration_hours, pomodoros: data.pomodoros },
                    };
                });
                setItems(prev => {
                    const merged = [...newItems, ...prev.filter(p => !newItems.find(n => n.id === p.id))];
                    return merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50);
                });
                setLoading(false);
            });
            unsubs.push(unsub);
        }

        return () => unsubs.forEach(u => u());
    }, [friendIds, userProfiles]);

    if (!user) return null;

    return (
        <div style={{
            borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.015)',
        }}>
            {/* Header */}
            <div style={{
                padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Trophy size={14} style={{ color: '#c8a960' }} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ede9e3' }}>Activité des amis</span>
                {items.length > 0 && (
                    <span style={{
                        marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: 12,
                        background: 'rgba(200,169,96,0.1)', color: '#c8a960',
                    }}>
                        {items.length}
                    </span>
                )}
            </div>

            {/* Feed */}
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0' }}>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>
                        Chargement...
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem', margin: 0 }}>
                            {friendIds.length === 0
                                ? 'Ajoute des amis pour voir leur activité ici'
                                : 'Aucune activité récente'}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {items.map((item, i) => {
                            const style = FEED_ICONS[item.type] || FEED_ICONS.session;
                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.2, delay: i * 0.03 }}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        padding: '10px 18px',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Avatar uid={item.uid} avatarUrl={item.avatarUrl} avatarStyle={item.avatarStyle} size={32} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 650, color: '#ede9e3' }}>
                                                {item.userName}
                                            </span>
                                            <div style={{
                                                width: 20, height: 20, borderRadius: 6,
                                                background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: style.color,
                                            }}>
                                                {style.icon}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '0.78rem', color: 'rgba(237,233,227,0.5)', margin: 0, lineHeight: 1.4 }}>
                                            {item.detail} sur <span style={{ color: 'rgba(237,233,227,0.7)', fontWeight: 500 }}>{item.title}</span>
                                        </p>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: 2 }}>
                                        {timeAgo(item.timestamp)}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
