// PAGE DISABLED — code preserved below, restore by removing the null export at the bottom
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as fbLimit } from 'firebase/firestore';
import Link from 'next/link';
import { Trophy, Clock, Flame, Timer, Crown, Medal, Award } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useSearchParams } from 'next/navigation';

type LeaderboardEntry = {
    uid: string;
    username?: string;
    full_name: string;
    avatar_url?: string;
    avatar_style?: string;
    value: number;
};

type TabType = 'hours' | 'streak' | 'sessions';

function LeaderboardContent() {
    const { user, loading } = useAuth();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'hours');
    const [filter, setFilter] = useState<'global' | 'friends'>('global');
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [fetching, setFetching] = useState(true);
    const [friendUids, setFriendUids] = useState<string[]>([]);

    // Load friend UIDs
    useEffect(() => {
        if (!user) return;
        const loadFriends = async () => {
            const q1 = query(collection(db, 'friendships'), where('user1_id', '==', user.uid), where('status', '==', 'accepted'));
            const q2 = query(collection(db, 'friendships'), where('user2_id', '==', user.uid), where('status', '==', 'accepted'));
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const uids: string[] = [];
            s1.docs.forEach(d => uids.push(d.data().user2_id));
            s2.docs.forEach(d => uids.push(d.data().user1_id));
            setFriendUids([...new Set(uids)]);
        };
        loadFriends();
    }, [user]);

    // Load leaderboard data
    useEffect(() => {
        if (!user) return;
        const loadData = async () => {
            setFetching(true);
            try {
                const field = tab === 'hours' ? 'total_hours' : tab === 'streak' ? 'streak_days' : 'total_sessions';
                const usersSnap = await getDocs(
                    query(collection(db, 'users'), orderBy(field, 'desc'), fbLimit(50))
                );

                let all: LeaderboardEntry[] = usersSnap.docs.map(d => {
                    const data = d.data();
                    return {
                        uid: d.id,
                        username: data.username,
                        full_name: data.full_name || data.email?.split('@')[0] || 'Utilisateur',
                        avatar_url: data.avatar_url,
                        avatar_style: data.avatar_style,
                        value: data[field] || 0,
                    };
                }).filter(e => e.value > 0);

                if (filter === 'friends') {
                    const friendSet = new Set([...friendUids, user.uid]);
                    all = all.filter(e => friendSet.has(e.uid));
                }

                setEntries(all.slice(0, 20));
            } catch (err) {
                console.error('Leaderboard error:', err);
            } finally {
                setFetching(false);
            }
        };
        loadData();
    }, [user, tab, filter, friendUids]);

    if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(200,169,96,0.2)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite' }} /></div>;

    const TABS: { id: TabType; label: string; Icon: typeof Clock; color: string; unit: string }[] = [
        { id: 'hours', label: 'Heures', Icon: Clock, color: '#c8a960', unit: 'h' },
        { id: 'streak', label: 'Streak', Icon: Flame, color: '#f59e0b', unit: 'j' },
        { id: 'sessions', label: 'Sessions', Icon: Timer, color: '#10b981', unit: '' },
    ];

    const fmtVal = (val: number, t: TabType) => {
        if (t === 'hours') return val < 1 ? `${Math.round(val * 60)}min` : `${val.toFixed(1)}h`;
        if (t === 'streak') return `${val}j`;
        return String(val);
    };

    const rankIcon = (i: number) => {
        if (i === 0) return <Crown size={16} style={{ color: '#fbbf24' }} />;
        if (i === 1) return <Medal size={16} style={{ color: '#94a3b8' }} />;
        if (i === 2) return <Award size={16} style={{ color: '#cd7f32' }} />;
        return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', width: 16, textAlign: 'center' as const, display: 'inline-block' }}>{i + 1}</span>;
    };

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Trophy size={20} style={{ color: '#fbbf24' }} />
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: '#f4f4f5' }}>
                        Classement
                    </h1>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem', margin: 0 }}>
                    Les membres les plus actifs de la communauté BrilliPlan
                </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: tab === t.id ? t.color : 'transparent', color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: tab === t.id ? `0 2px 10px ${t.color}44` : 'none' }}>
                            <t.Icon size={14} /> {t.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {([{ id: 'global' as const, label: '🌍 Global' }, { id: 'friends' as const, label: '👥 Amis' }]).map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: filter === f.id ? 'rgba(200,169,96,0.15)' : 'transparent', color: filter === f.id ? '#d4b872' : 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {fetching ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(200,169,96,0.2)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                </div>
            ) : entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18 }}>
                    <Trophy size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.88rem', margin: 0 }}>
                        {filter === 'friends' ? 'Aucun ami avec des statistiques pour le moment' : 'Le classement se construit...'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {entries.map((entry, i) => {
                        const isMe = entry.uid === user?.uid;
                        const tabInfo = TABS.find(t => t.id === tab)!;
                        const barPct = entries[0]?.value > 0 ? (entry.value / entries[0].value) * 100 : 0;
                        return (
                            <Link key={entry.uid} href={entry.username ? `/u/${entry.username}` : `/user/${entry.uid}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: isMe ? `linear-gradient(135deg, ${tabInfo.color}10, ${tabInfo.color}05)` : i < 3 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)', border: `1px solid ${isMe ? `${tabInfo.color}25` : i < 3 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`, textDecoration: 'none', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
                            >
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barPct}%`, background: `linear-gradient(90deg, ${tabInfo.color}06, transparent)`, pointerEvents: 'none' }} />
                                <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>{rankIcon(i)}</div>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <Avatar uid={entry.uid} avatarUrl={entry.avatar_url} avatarStyle={entry.avatar_style} size={36} />
                                    {isMe && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: tabInfo.color, border: '2px solid #0b0b0d' }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                                    <div style={{ fontSize: '0.88rem', fontWeight: isMe ? 700 : 600, color: isMe ? '#ede9e3' : 'rgba(237,233,227,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {entry.full_name}
                                        {isMe && <span style={{ fontSize: '0.65rem', color: tabInfo.color, marginLeft: 6 }}>vous</span>}
                                    </div>
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: i < 3 ? tabInfo.color : 'rgba(237,233,227,0.45)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', flexShrink: 0, position: 'relative' }}>
                                    {fmtVal(entry.value, tab)}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function _LeaderboardPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(200,169,96,0.2)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite' }} /></div>}>
            <LeaderboardContent />
        </Suspense>
    );
}

// TO RESTORE: replace the export below with: export default _LeaderboardPage;
export default function LeaderboardPage() { return null; }
