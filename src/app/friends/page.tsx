'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, onSnapshot, addDoc, Timestamp, limit as fbLimit, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, UserX, MessageCircle, Clock, Search, UserPlus, Send, Compass, Inbox, Sparkles, MapPin, Target, ArrowRight, RefreshCw } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useTabParam } from '@/hooks/useTabParam';
import { findCountry } from '@/lib/countries';
import { useBlock } from '@/context/BlockContext';

const CATEGORY_COLORS: Record<string, string> = {
    'Code': '#c8a960', 'Design': '#5eead4', 'Lecture': '#f59e0b', 'Musique': '#10b981',
    'Sport': '#ef4444', 'Science': '#3b82f6', 'Business': '#8b5cf6', 'Écriture': '#f97316', 'Autre': '#64748b',
};

interface FriendData {
    docId: string;
    friendUid: string;
    profile: any;
    status: 'pending' | 'accepted';
    isSender: boolean;
}

interface SuggestedUser {
    uid: string;
    profile: any;
    matchReasons: { type: 'location' | 'category' | 'discipline'; label: string; color: string }[];
    score: number;
}

function FriendsContent() {
    const { user } = useAuth();
    const { t } = useLocale();
    const router = useRouter();
    const { isBlocked } = useBlock();
    const [tab, setTab] = useTabParam<'list' | 'requests' | 'discover'>('tab', 'list');
    const [friends, setFriends] = useState<FriendData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [emailInput, setEmailInput] = useState('');
    const [emailSearchResult, setEmailSearchResult] = useState<any>(null);
    const [emailSearchStatus, setEmailSearchStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'self' | 'already'>('idle');
    const [sendingRequest, setSendingRequest] = useState(false);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

    // Discover tab state
    const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
    const [discoverLoading, setDiscoverLoading] = useState(false);
    const [discoverLoaded, setDiscoverLoaded] = useState(false);
    const [discoverSearch, setDiscoverSearch] = useState('');
    const [discoverFilter, setDiscoverFilter] = useState<'all' | 'location' | 'category'>('all');
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;

        const q1 = query(collection(db, 'friendships'), where('user1_id', '==', user.uid));
        const q2 = query(collection(db, 'friendships'), where('user2_id', '==', user.uid));

        let snap1Docs: any[] = [];
        let snap2Docs: any[] = [];
        let gotFirst = false;

        const processSnapshots = async () => {
            const allDocs = [...snap1Docs, ...snap2Docs];
            const seen = new Set<string>();
            const unique = allDocs.filter(d => {
                if (seen.has(d.id)) return false;
                seen.add(d.id);
                return true;
            });

            const items: FriendData[] = [];
            for (const fdoc of unique) {
                const data = fdoc.data();
                const friendUid = data.user1_id === user.uid ? data.user2_id : data.user1_id;
                const userDoc = await getDoc(doc(db, 'users', friendUid));
                const profile = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : { id: friendUid, full_name: 'Utilisateur', email: '' };
                items.push({ docId: fdoc.id, friendUid, profile, status: data.status, isSender: data.sender_id === user.uid });
            }
            setFriends(items);
            setLoading(false);
        };

        const unsub1 = onSnapshot(q1, (snap) => {
            snap1Docs = snap.docs;
            if (gotFirst) processSnapshots();
            gotFirst = true;
        });
        const unsub2 = onSnapshot(q2, (snap) => {
            snap2Docs = snap.docs;
            if (gotFirst) processSnapshots();
            gotFirst = true;
        });

        return () => { unsub1(); unsub2(); };
    }, [user]);

    // Load discover suggestions when tab is active
    useEffect(() => {
        if (tab !== 'discover' || !user || discoverLoaded) return;
        const loadSuggestions = async () => {
            setDiscoverLoading(true);
            try {
                // 1) Get current user's profile
                const myDoc = await getDoc(doc(db, 'users', user.uid));
                const myData = myDoc.exists() ? myDoc.data() : {};
                const myCountry = myData.country || '';
                const myCity = (myData.city || '').toLowerCase();

                // 2) Get current user's objective categories
                const myMemSnap = await getDocs(query(collection(db, 'memberships'), where('user_id', '==', user.uid)));
                const myObjIds = myMemSnap.docs.map(d => d.data().objective_id as string);
                const myCats = new Set<string>();
                for (const oid of myObjIds.slice(0, 20)) {
                    const objSnap = await getDoc(doc(db, 'objectives', oid));
                    if (objSnap.exists()) {
                        const cat = objSnap.data().category;
                        if (Array.isArray(cat)) cat.forEach((c: string) => myCats.add(c));
                        else if (cat) myCats.add(cat);
                    }
                }

                // 3) Get existing friend UIDs to exclude
                const friendUids = new Set(friends.map(f => f.friendUid));
                friendUids.add(user.uid);

                // 4) Fetch a pool of users (limit to avoid reading entire DB)
                const usersSnap = await getDocs(query(collection(db, 'users'), fbLimit(200)));
                const candidates: SuggestedUser[] = [];

                for (const uDoc of usersSnap.docs) {
                    if (friendUids.has(uDoc.id)) continue;
                    const profile = { id: uDoc.id, ...uDoc.data() };
                    const reasons: SuggestedUser['matchReasons'] = [];
                    let score = 0;

                    // Location match
                    const uCountry = (profile as any).country || '';
                    const uCity = ((profile as any).city || '').toLowerCase();
                    if (myCity && uCity && myCity === uCity && myCountry === uCountry) {
                        const country = findCountry(uCountry);
                        reasons.push({ type: 'location', label: `${country?.flag || ''} Même ville`, color: '#10b981' });
                        score += 3;
                    } else if (myCountry && uCountry === myCountry) {
                        const country = findCountry(uCountry);
                        reasons.push({ type: 'location', label: `${country?.flag || ''} Même pays`, color: '#06b6d4' });
                        score += 1;
                    }

                    // Category match — check user's objectives
                    const uMemSnap = await getDocs(query(collection(db, 'memberships'), where('user_id', '==', uDoc.id)));
                    const uObjIds = uMemSnap.docs.map(d => d.data().objective_id as string);
                    const sharedCats = new Set<string>();
                    for (const oid of uObjIds.slice(0, 10)) {
                        const objSnap = await getDoc(doc(db, 'objectives', oid));
                        if (objSnap.exists()) {
                            const cat = objSnap.data().category;
                            const cats = Array.isArray(cat) ? cat : cat ? [cat] : [];
                            cats.forEach((c: string) => { if (myCats.has(c)) sharedCats.add(c); });
                        }
                    }
                    sharedCats.forEach(c => {
                        reasons.push({ type: 'category', label: c, color: CATEGORY_COLORS[c] || '#c8a960' });
                        score += 2;
                    });

                    // Discipline match
                    const myDiscipline = myData.discipline_profile?.type;
                    const uDiscipline = (profile as any).discipline_profile?.type;
                    if (myDiscipline && uDiscipline && myDiscipline === uDiscipline) {
                        reasons.push({ type: 'discipline', label: `${(profile as any).discipline_profile?.emoji || '🎯'} Même profil`, color: '#8b5cf6' });
                        score += 1;
                    }

                    if (reasons.length > 0) {
                        candidates.push({ uid: uDoc.id, profile, matchReasons: reasons, score });
                    }
                }

                // Sort by score descending
                candidates.sort((a, b) => b.score - a.score);
                setSuggestions(candidates);
                setDiscoverLoaded(true);
            } catch (err) {
                console.error('Error loading suggestions', err);
            } finally {
                setDiscoverLoading(false);
            }
        };
        loadSuggestions();
    }, [tab, user, discoverLoaded, friends]);

    const filteredSuggestions = useMemo(() => {
        let list = suggestions.filter(s => !isBlocked(s.uid));
        if (discoverFilter === 'location') list = list.filter(s => s.matchReasons.some(r => r.type === 'location'));
        if (discoverFilter === 'category') list = list.filter(s => s.matchReasons.some(r => r.type === 'category'));
        if (discoverSearch.trim()) {
            const q = discoverSearch.toLowerCase();
            list = list.filter(s =>
                s.profile.full_name?.toLowerCase().includes(q) ||
                s.profile.city?.toLowerCase().includes(q) ||
                s.matchReasons.some(r => r.label.toLowerCase().includes(q))
            );
        }
        return list;
    }, [suggestions, discoverFilter, discoverSearch]);

    const handleSendDiscover = async (targetUid: string) => {
        if (!user || sentRequests.has(targetUid)) return;
        setSentRequests(prev => new Set(prev).add(targetUid));
        try {
            const newDocRef = doc(collection(db, 'friendships'));
            await setDoc(newDocRef, {
                user1_id: user.uid,
                user2_id: targetUid,
                sender_id: user.uid,
                status: 'pending',
                created_at: Timestamp.now(),
            });
            await addDoc(collection(db, 'users', targetUid, 'notifications'), {
                type: 'friend_request',
                message: `${user.displayName || user.email?.split('@')[0] || "Quelqu'un"} vous a envoyé une demande d'ami.`,
                read: false,
                link: '/friends',
                created_at: Timestamp.now(),
            });
        } catch (err) {
            console.error(err);
            setSentRequests(prev => { const s = new Set(prev); s.delete(targetUid); return s; });
        }
    };

    if (!user) {
        return (
            <div className="container py-16 text-center fade-enter">
                <h2>Connectez-vous pour voir vos amis</h2>
                <button className="btn btn-primary mt-4" onClick={() => router.push('/login')}>Connexion</button>
            </div>
        );
    }

    const accepted = friends.filter(f => f.status === 'accepted' && !isBlocked(f.friendUid));
    const pendingReceived = friends.filter(f => f.status === 'pending' && !f.isSender && !isBlocked(f.friendUid));
    const pendingSent = friends.filter(f => f.status === 'pending' && f.isSender && !isBlocked(f.friendUid));

    const filteredAccepted = accepted.filter(f =>
        !search.trim() ||
        f.profile.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.profile.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleAccept = async (docId: string, friendUid: string) => {
        await setDoc(doc(db, 'friendships', docId), { status: 'accepted' }, { merge: true });

        // Notify the sender
        await addDoc(collection(db, 'users', friendUid, 'notifications'), {
            message: `${user?.displayName || user?.email?.split('@')[0] || "Quelqu'un"} a accepté votre demande d'ami.`,
            read: false,
            created_at: Timestamp.now()
        });

        // Update friends_count for gamification (both users)
        if (user) {
            try {
                updateDoc(doc(db, 'users', user.uid), { friends_count: increment(1) });
                updateDoc(doc(db, 'users', friendUid), { friends_count: increment(1) });
            } catch { /* ignore */ }
        }

        setFriends(prev => prev.map(f => f.docId === docId ? { ...f, status: 'accepted' } : f));
    };

    const handleReject = async (docId: string) => {
        await deleteDoc(doc(db, 'friendships', docId));
        setFriends(prev => prev.filter(f => f.docId !== docId));
    };

    const handleMessage = (friendUid: string) => {
        const convId = [user.uid, friendUid].sort().join('_');
        router.push(`/messages?conv=${convId}&to=${friendUid}`);
    };

    const handleSearchByEmail = async () => {
        const emailTrimmed = emailInput.trim();
        const emailLower = emailTrimmed.toLowerCase();
        if (!emailTrimmed) return;
        setEmailSearchStatus('loading');
        setEmailSearchResult(null);
        try {
            // Check if searching for self
            if (emailLower === user.email?.toLowerCase()) {
                setEmailSearchStatus('self');
                return;
            }
            // Try lowercase first, then original casing as fallback
            let snap = await getDocs(query(collection(db, 'users'), where('email', '==', emailLower)));
            if (snap.empty && emailTrimmed !== emailLower) {
                snap = await getDocs(query(collection(db, 'users'), where('email', '==', emailTrimmed)));
            }
            if (snap.empty) {
                setEmailSearchStatus('not_found');
                return;
            }
            const foundDoc = snap.docs[0];
            const foundUid = foundDoc.id;
            const foundProfile = { id: foundUid, ...foundDoc.data() };

            // Check if already friends or pending
            const alreadyLinked = friends.find(f => f.friendUid === foundUid);
            if (alreadyLinked) {
                setEmailSearchStatus('already');
                setEmailSearchResult(foundProfile);
                return;
            }
            setEmailSearchResult(foundProfile);
            setEmailSearchStatus('found');
        } catch (err) {
            console.error(err);
            setEmailSearchStatus('not_found');
        }
    };

    const handleSendRequest = async () => {
        if (!emailSearchResult || sendingRequest) return;
        setSendingRequest(true);
        try {
            const newDocRef = doc(collection(db, 'friendships'));
            await setDoc(newDocRef, {
                user1_id: user.uid,
                user2_id: emailSearchResult.id,
                sender_id: user.uid,
                status: 'pending',
                created_at: Timestamp.now(),
            });
            // Notify the target user
            await addDoc(collection(db, 'users', emailSearchResult.id, 'notifications'), {
                type: 'friend_request',
                message: `${user.displayName || user.email?.split('@')[0] || 'Quelqu\'un'} vous a envoyé une demande d'ami.`,
                read: false,
                link: '/friends',
                created_at: Timestamp.now(),
            });
            setFriends(prev => [...prev, {
                docId: newDocRef.id,
                friendUid: emailSearchResult.id,
                profile: emailSearchResult,
                status: 'pending',
                isSender: true,
            }]);
            setEmailSearchStatus('already');
        } catch (err) {
            console.error(err);
        } finally {
            setSendingRequest(false);
        }
    };

    return (
        <div className="container py-10 mx-auto fade-enter" style={{ maxWidth: '820px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>Réseau social</p>
                    <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: '#f4f4f5' }}>
                        {t('friends_title')}
                    </h1>
                </div>
                {pendingReceived.length > 0 && tab !== 'requests' && (
                    <button onClick={() => setTab('requests')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '20px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                        {pendingReceived.length} demande{pendingReceived.length > 1 ? 's' : ''} en attente
                    </button>
                )}
            </div>

            {/* Premium Segmented Control Tabs */}
            <div className="mb-8 relative flex items-center p-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                {/* Animated Background Highlight */}
                <div
                    style={{
                        position: 'absolute', top: '4px', bottom: '4px', width: 'calc(33.33% - 4px)', borderRadius: '12px', background: 'var(--color-primary)', transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                        left: tab === 'list' ? '4px' : tab === 'requests' ? 'calc(33.33%)' : 'calc(66.66%)',
                        boxShadow: '0 4px 12px rgba(200, 169, 96, 0.3)',
                    }}
                />

                <button
                    onClick={() => setTab('list')}
                    style={{
                        position: 'relative', zIndex: 1, padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', transition: 'color 0.3s', margin: 0, border: 'none', background: 'transparent',
                        color: tab === 'list' ? '#ffffff' : '#a1a1aa',
                    }}
                >
                    <UserCheck size={16} /> {t('friends_tab_list')} <span style={{ opacity: tab === 'list' ? 0.8 : 0.5, fontSize: '0.78rem' }}>({accepted.length})</span>
                </button>
                <button
                    onClick={() => setTab('requests')}
                    style={{
                        position: 'relative', zIndex: 1, padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', transition: 'color 0.3s', margin: 0, border: 'none', background: 'transparent',
                        color: tab === 'requests' ? '#ffffff' : '#a1a1aa',
                    }}
                >
                    <Clock size={16} /> {t('friends_tab_requests')}
                    {pendingReceived.length > 0 && (
                        <span style={{
                            background: tab === 'requests' ? '#ffffff' : '#ef4444',
                            color: tab === 'requests' ? 'var(--color-primary)' : '#fff',
                            borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, marginLeft: '4px',
                            transition: 'all 0.3s', boxShadow: tab === 'requests' ? '0 2px 5px rgba(0,0,0,0.2)' : 'none'
                        }}>
                            {pendingReceived.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('discover')}
                    style={{
                        position: 'relative', zIndex: 1, padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', transition: 'color 0.3s', margin: 0, border: 'none', background: 'transparent',
                        color: tab === 'discover' ? '#ffffff' : '#a1a1aa',
                    }}
                >
                    <Sparkles size={16} /> Découvrir
                </button>
            </div>

            {loading && (
                <div className="text-center py-8">
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                </div>
            )}

            {/* TAB: Friends List */}
            {!loading && tab === 'list' && (
                <div className="fade-enter">
                    {/* Add by email */}
                    <div className="mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <UserPlus size={16} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.7 }}>Ajouter un ami par email</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 flex-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.5rem 0.9rem' }}>
                                <Search size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                                <input
                                    type="email"
                                    value={emailInput}
                                    onChange={e => { setEmailInput(e.target.value); setEmailSearchStatus('idle'); setEmailSearchResult(null); }}
                                    onKeyDown={e => e.key === 'Enter' && handleSearchByEmail()}
                                    placeholder="adresse@email.com"
                                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: '100%', fontSize: '0.88rem' }}
                                />
                            </div>
                            <button
                                onClick={handleSearchByEmail}
                                disabled={emailSearchStatus === 'loading' || !emailInput.trim()}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600,
                                    background: 'var(--color-primary)', color: '#fff', border: 'none',
                                    cursor: emailSearchStatus === 'loading' || !emailInput.trim() ? 'not-allowed' : 'pointer',
                                    opacity: !emailInput.trim() ? 0.5 : 1, flexShrink: 0,
                                }}
                            >
                                {emailSearchStatus === 'loading' ? '...' : 'Rechercher'}
                            </button>
                        </div>

                        {/* Results */}
                        {emailSearchStatus === 'not_found' && (
                            <p style={{ fontSize: '0.83rem', color: '#f87171', marginTop: '0.75rem', opacity: 0.8 }}>Aucun utilisateur trouvé avec cet email.</p>
                        )}
                        {emailSearchStatus === 'self' && (
                            <p style={{ fontSize: '0.83rem', color: '#f87171', marginTop: '0.75rem', opacity: 0.8 }}>C'est votre propre adresse email.</p>
                        )}
                        {(emailSearchStatus === 'found' || emailSearchStatus === 'already') && emailSearchResult && (
                            <div className="flex items-center gap-3 mt-3" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <Avatar uid={emailSearchResult.id} avatarUrl={emailSearchResult.avatar_url} avatarStyle={emailSearchResult.avatar_style} size={40} />
                                <div className="flex-1 min-w-0">
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{emailSearchResult.full_name || emailSearchResult.email}</div>
                                    <div style={{ fontSize: '0.78rem', opacity: 0.45 }}>{emailSearchResult.email}</div>
                                </div>
                                {emailSearchStatus === 'found' ? (
                                    <button
                                        onClick={handleSendRequest}
                                        disabled={sendingRequest}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600,
                                            background: 'rgba(200,169,96,0.2)', color: '#c8a960', border: '1px solid rgba(200,169,96,0.35)',
                                            cursor: sendingRequest ? 'not-allowed' : 'pointer', flexShrink: 0,
                                        }}
                                    >
                                        <Send size={14} /> {sendingRequest ? 'Envoi...' : 'Envoyer une demande'}
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '0.8rem', opacity: 0.5, flexShrink: 0 }}>Déjà ami / En attente</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Search existing friends */}
                    {accepted.length > 0 && (
                        <div className="flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '0.6rem 1rem', marginBottom: '1.5rem' }}>
                            <Search size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Rechercher un ami..."
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: '100%', fontSize: '0.9rem' }}
                            />
                        </div>
                    )}

                    {/* Friends count label */}
                    {accepted.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                                {filteredAccepted.length} ami{filteredAccepted.length > 1 ? 's' : ''}
                                {search.trim() && ` · "${search}"`}
                            </span>
                        </div>
                    )}

                    {filteredAccepted.length === 0 ? (
                        <div className="card card-glass text-center fade-enter" style={{ padding: '4rem 2rem', border: '1px dashed rgba(200,169,96,0.2)', background: 'rgba(200,169,96,0.02)' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <Users size={28} style={{ color: '#c8a960' }} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>{t('friends_empty')}</h3>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', lineHeight: 1.5, maxWidth: 320, margin: '0 auto 1.5rem' }}>
                                Rejoignez des salons pour rencontrer d&apos;autres membres et les ajouter en amis.
                            </p>
                            <button className="btn btn-primary" style={{ boxShadow: '0 4px 14px -4px rgba(200,169,96,0.4)' }} onClick={() => router.push('/explore')}>
                                <Compass size={16} /> Explorer les salons
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                            {filteredAccepted.map(f => (
                                <div
                                    key={f.docId}
                                    className="card card-glass fade-enter"
                                    style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                                >
                                    {/* Top: avatar + name */}
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                                        onClick={() => router.push(f.profile.username ? `/u/${f.profile.username}` : `/user/${f.friendUid}`)}
                                    >
                                        <Avatar
                                            uid={f.friendUid}
                                            avatarUrl={f.profile.avatar_url}
                                            avatarStyle={f.profile.avatar_style}
                                            size={40}
                                            style={{ flexShrink: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)' }}
                                        />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {f.profile.full_name}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {f.profile.email}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom: action buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                        {confirmRemoveId === f.docId ? (
                                            <>
                                                <button
                                                    onClick={() => { handleReject(f.docId); setConfirmRemoveId(null); }}
                                                    style={{ flex: 1, padding: '6px 0', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                                                >
                                                    Confirmer
                                                </button>
                                                <button
                                                    onClick={() => setConfirmRemoveId(null)}
                                                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                                >
                                                    ✕
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleMessage(f.friendUid)}
                                                    title="Message"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '32px', flexShrink: 0,
                                                        borderRadius: '8px', background: 'rgba(200,169,96,0.12)', color: '#c8a960',
                                                        border: '1px solid rgba(200,169,96,0.25)', cursor: 'pointer', transition: 'background 0.2s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,96,0.25)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200,169,96,0.12)')}
                                                >
                                                    <MessageCircle size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmRemoveId(f.docId)}
                                                    style={{
                                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', height: '32px',
                                                        borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                                                        background: 'rgba(239,68,68,0.08)', color: '#f87171',
                                                        border: '1px solid rgba(239,68,68,0.18)', cursor: 'pointer', transition: 'background 0.2s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                                                >
                                                    <UserX size={13} /> Retirer
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div >
            )}

            {/* TAB: Discover */}
            {!loading && tab === 'discover' && (
                <div className="fade-enter">
                    {/* Filter chips + search */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                        {([['all', 'Tous', null], ['location', 'Localisation', MapPin], ['category', 'Centres d\'intérêt', Target]] as const).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                onClick={() => setDiscoverFilter(key as any)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '20px',
                                    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.25s',
                                    background: discoverFilter === key ? 'rgba(200,169,96,0.18)' : 'rgba(255,255,255,0.04)',
                                    color: discoverFilter === key ? '#d4b872' : 'rgba(255,255,255,0.5)',
                                    border: `1px solid ${discoverFilter === key ? 'rgba(200,169,96,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                }}
                            >
                                {Icon && <Icon size={14} />} {label}
                            </button>
                        ))}
                        <div style={{ flex: 1, minWidth: '180px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '7px 14px' }}>
                                <Search size={14} style={{ opacity: 0.35, flexShrink: 0 }} />
                                <input
                                    type="text"
                                    value={discoverSearch}
                                    onChange={e => setDiscoverSearch(e.target.value)}
                                    placeholder="Rechercher..."
                                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: '100%', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>
                        {discoverLoaded && (
                            <button
                                onClick={() => { setDiscoverLoaded(false); setSuggestions([]); }}
                                title="Rafraîchir"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}
                            >
                                <RefreshCw size={15} />
                            </button>
                        )}
                    </div>

                    {/* Loading skeleton */}
                    {discoverLoading && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ width: '65%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                            <div style={{ width: '40%', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <div style={{ width: 70, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                        <div style={{ width: 55, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!discoverLoading && discoverLoaded && filteredSuggestions.length === 0 && (
                        <div className="card card-glass text-center fade-enter" style={{ padding: '4rem 2rem', border: '1px dashed rgba(200,169,96,0.15)', background: 'rgba(200,169,96,0.02)' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <Sparkles size={28} style={{ color: '#d4b872' }} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>
                                {discoverSearch.trim() || discoverFilter !== 'all' ? 'Aucun résultat' : 'Pas encore de suggestions'}
                            </h3>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', lineHeight: 1.5, maxWidth: 360, margin: '0 auto' }}>
                                {discoverSearch.trim() || discoverFilter !== 'all'
                                    ? 'Essayez avec d\'autres filtres ou termes de recherche.'
                                    : 'Complétez votre profil et créez des objectifs pour que nous puissions vous recommander des personnes similaires.'}
                            </p>
                        </div>
                    )}

                    {/* Results count */}
                    {!discoverLoading && discoverLoaded && filteredSuggestions.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                                {filteredSuggestions.length} suggestion{filteredSuggestions.length > 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {/* Suggestion cards grid */}
                    {!discoverLoading && filteredSuggestions.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
                            {filteredSuggestions.map((s, idx) => {
                                const isSent = sentRequests.has(s.uid);
                                const alreadyPending = friends.some(f => f.friendUid === s.uid);
                                return (
                                    <div
                                        key={s.uid}
                                        className="fade-enter"
                                        style={{
                                            padding: '1.25rem', borderRadius: '16px', position: 'relative', overflow: 'hidden',
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            animationDelay: `${idx * 50}ms`,
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,169,96,0.25)'; e.currentTarget.style.background = 'rgba(200,169,96,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        {/* Score indicator */}
                                        {s.score >= 5 && (
                                            <div style={{
                                                position: 'absolute', top: '12px', right: '12px',
                                                padding: '3px 9px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 800,
                                                background: 'linear-gradient(135deg, rgba(200,169,96,0.2), rgba(200,169,96,0.2))',
                                                color: '#ede9e3', border: '1px solid rgba(200,169,96,0.25)',
                                                letterSpacing: '0.04em',
                                            }}>
                                                TOP MATCH
                                            </div>
                                        )}

                                        {/* Avatar + Name + Location */}
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '0.9rem' }}>
                                            <div
                                                style={{ cursor: 'pointer', flexShrink: 0 }}
                                                onClick={() => router.push(s.profile.username ? `/u/${s.profile.username}` : `/user/${s.uid}`)}
                                            >
                                                <Avatar
                                                    uid={s.uid}
                                                    avatarUrl={s.profile.avatar_url}
                                                    avatarStyle={s.profile.avatar_style}
                                                    size={48}
                                                    style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)' }}
                                                />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div
                                                    style={{ fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                    onClick={() => router.push(s.profile.username ? `/u/${s.profile.username}` : `/user/${s.uid}`)}
                                                >
                                                    {s.profile.full_name || 'Utilisateur'}
                                                </div>
                                                {(s.profile.city || s.profile.country) && (
                                                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        <MapPin size={11} style={{ opacity: 0.6 }} />
                                                        {[s.profile.city, (() => { const c = findCountry(s.profile.country); return c ? `${c.flag} ${c.name}` : s.profile.country; })()].filter(Boolean).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Match reason tags */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem' }}>
                                            {s.matchReasons.map((r, ri) => (
                                                <span
                                                    key={ri}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        padding: '4px 10px', borderRadius: '10px', fontSize: '0.73rem', fontWeight: 600,
                                                        background: `${r.color}15`, color: r.color,
                                                        border: `1px solid ${r.color}30`,
                                                    }}
                                                >
                                                    {r.type === 'location' && <MapPin size={10} />}
                                                    {r.type === 'category' && <Target size={10} />}
                                                    {r.label}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Action button */}
                                        {alreadyPending ? (
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textAlign: 'center', padding: '8px 0' }}>
                                                Déjà ajouté
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleSendDiscover(s.uid)}
                                                disabled={isSent}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '9px 0', borderRadius: '11px', fontSize: '0.83rem', fontWeight: 700,
                                                    background: isSent ? 'rgba(16,185,129,0.12)' : 'rgba(200,169,96,0.12)',
                                                    color: isSent ? '#34d399' : '#d4b872',
                                                    border: `1px solid ${isSent ? 'rgba(16,185,129,0.25)' : 'rgba(200,169,96,0.25)'}`,
                                                    cursor: isSent ? 'default' : 'pointer',
                                                    transition: 'all 0.25s',
                                                }}
                                                onMouseEnter={e => { if (!isSent) { e.currentTarget.style.background = 'rgba(200,169,96,0.22)'; e.currentTarget.style.borderColor = 'rgba(200,169,96,0.4)'; } }}
                                                onMouseLeave={e => { if (!isSent) { e.currentTarget.style.background = 'rgba(200,169,96,0.12)'; e.currentTarget.style.borderColor = 'rgba(200,169,96,0.25)'; } }}
                                            >
                                                {isSent ? (
                                                    <><UserCheck size={15} /> Demande envoyée</>
                                                ) : (
                                                    <><UserPlus size={15} /> Ajouter</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Requests */}
            {
                !loading && tab === 'requests' && (
                    <div className="fade-enter">
                        {/* Received */}
                        <h4 className="mb-3" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5 }}>{t('friends_received_title')}</h4>
                        {pendingReceived.length === 0 ? (
                            <div className="card card-glass text-center mb-6 fade-enter" style={{ padding: '2.5rem 1.5rem', border: '1px dashed rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.02)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <Inbox size={22} style={{ color: '#f59e0b' }} />
                                </div>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', fontWeight: 600, margin: 0 }}>{t('friends_requests_empty')}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
                                {pendingReceived.map(f => (
                                    <div key={f.docId} className="card card-glass fade-enter" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #f59e0b' }}>
                                        <div className="flex items-center gap-4">
                                            <Avatar
                                                uid={f.friendUid}
                                                avatarUrl={f.profile.avatar_url}
                                                avatarStyle={f.profile.avatar_style}
                                                size={44}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => router.push(f.profile.username ? `/u/${f.profile.username}` : `/user/${f.friendUid}`)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div style={{ fontWeight: 700 }}>{f.profile.full_name}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '2px' }}>{f.profile.email}</div>
                                            </div>
                                            <div className="flex gap-2" style={{ flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleAccept(f.docId, f.friendUid)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                                                        background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)',
                                                        cursor: 'pointer', transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.transform = 'translateY(0)' }}
                                                >
                                                    {t('friends_btn_accept')}
                                                </button>
                                                <button
                                                    onClick={() => handleReject(f.docId)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                                                        background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        cursor: 'pointer', transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
                                                >
                                                    {t('friends_btn_reject')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Sent */}
                        <h4 className="mb-3" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5 }}>{t('friends_sent_title')}</h4>
                        {pendingSent.length === 0 ? (
                            <div className="card card-glass text-center" style={{ padding: '2rem', opacity: 0.5 }}>
                                <p>{t('friends_sent_empty')}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {pendingSent.map(f => (
                                    <div key={f.docId} className="card card-glass fade-enter" style={{ padding: '1.25rem 1.5rem', opacity: 0.7 }}>
                                        <div className="flex items-center gap-4">
                                            <Avatar
                                                uid={f.friendUid}
                                                avatarUrl={f.profile.avatar_url}
                                                avatarStyle={f.profile.avatar_style}
                                                size={44}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div style={{ fontWeight: 700 }}>{f.profile.full_name}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '2px' }}>{t('friends_btn_pending')}</div>
                                            </div>
                                            <button className="btn btn-sm btn-ghost" onClick={() => handleReject(f.docId)} style={{ color: '#ef4444', opacity: 0.6 }}>
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}

export default function Friends() {
    return (
        <Suspense fallback={<div className="container py-16 text-center">Chargement...</div>}>
            <FriendsContent />
        </Suspense>
    );
}
