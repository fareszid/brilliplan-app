'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, limit, onSnapshot, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Users, Target, CheckCircle, X, ChevronRight, MapPin, Plus, Flame, Shield, TrendingUp, Zap, Clock, AlertCircle } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useBlock } from '@/context/BlockContext';

/* ─── Types ─── */

interface Partner {
    id: string;
    pairId: string;
    full_name: string;
    avatar_url?: string;
    avatar_style?: string;
    weeklyGoal: number;
    goalFrequency?: string;
    objective_id?: string;
    isInviter: boolean;
    status: string;
    invite_title?: string;
    last_nudged_at?: any;
    streak: number;
    reliability: number;
    todayCheckedIn: boolean;
    partnerTodayCheckedIn: boolean;
    created_at?: any;
}

/* ─── Helpers ─── */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceBadge(km: number): { label: string; color: string } {
    if (km < 1.5) return { label: 'Votre quartier', color: '#10b981' };
    if (km < 15) return { label: 'Votre ville', color: '#c8a960' };
    return { label: `${Math.round(km)} km`, color: '#8b5cf6' };
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AccountabilityPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { isBlocked } = useBlock();

    const [partners, setPartners] = useState<Partner[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [myObjectives, setMyObjectives] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<any>(null);
    const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
    const [weeklyGoalInput, setWeeklyGoalInput] = useState('5');
    const [goalFrequencyInput, setGoalFrequencyInput] = useState('weekly');
    const [goalEnabled, setGoalEnabled] = useState(true);
    const [salonEnabled, setSalonEnabled] = useState(false);
    const [inviteTitle, setInviteTitle] = useState('');
    const [sending, setSending] = useState(false);

    // Geo
    const [myGeo, setMyGeo] = useState<{ lat: number; lng: number; city: string; neighborhood?: string; visible: boolean } | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
    const [invitingNearby, setInvitingNearby] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        loadMyGeo();

        const q1 = query(collection(db, 'accountability_pairs'), where('user1_id', '==', user.uid));
        const q2 = query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid));

        let snap1Docs: any[] = [];
        let snap2Docs: any[] = [];
        let gotFirst = false;

        const processPairs = async () => {
            const allPairs = [...snap1Docs, ...snap2Docs];
            const seen = new Set<string>();
            const uniquePairs = allPairs.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });

            const partnerList: Partner[] = [];
            for (const pdoc of uniquePairs) {
                const data = pdoc.data();
                const partnerUid = data.user1_id === user.uid ? data.user2_id : data.user1_id;
                const profileDoc = await getDoc(doc(db, 'users', partnerUid));
                const profile = profileDoc.exists() ? { id: profileDoc.id, ...profileDoc.data() } : { id: partnerUid, full_name: 'Utilisateur' };

                // Load streak & reliability from pair doc
                let streak = data.streak || 0;
                let reliability = data[`reliability_${user.uid}`] || 0;
                let todayCheckedIn = false;
                let partnerTodayCheckedIn = false;

                // Check if today's check-in exists
                try {
                    const todayKey = today();
                    const myCI = await getDoc(doc(db, 'accountability_pairs', pdoc.id, 'checkins', `${todayKey}_${user.uid}`));
                    const partnerCI = await getDoc(doc(db, 'accountability_pairs', pdoc.id, 'checkins', `${todayKey}_${partnerUid}`));
                    todayCheckedIn = myCI.exists();
                    partnerTodayCheckedIn = partnerCI.exists();
                } catch { /* ignore */ }

                partnerList.push({
                    id: partnerUid,
                    pairId: pdoc.id,
                    full_name: (profile as any).full_name || 'Utilisateur',
                    avatar_url: (profile as any).avatar_url || '',
                    avatar_style: (profile as any).avatar_style || '',
                    weeklyGoal: data.weekly_hours_goal ?? 5,
                    goalFrequency: data.goal_frequency ?? 'weekly',
                    objective_id: data.objective_id,
                    isInviter: data.inviter_id === user.uid,
                    status: data.status,
                    invite_title: data.invite_title || undefined,
                    last_nudged_at: data.last_nudged_at,
                    streak,
                    reliability,
                    todayCheckedIn,
                    partnerTodayCheckedIn,
                    created_at: data.created_at,
                });
            }
            setPartners(partnerList);
            setLoading(false);
        };

        const unsub1 = onSnapshot(q1, (snap) => { snap1Docs = snap.docs; if (gotFirst) processPairs(); gotFirst = true; });
        const unsub2 = onSnapshot(q2, (snap) => { snap2Docs = snap.docs; if (gotFirst) processPairs(); gotFirst = true; });

        // Friends
        const fq1 = query(collection(db, 'friendships'), where('user1_id', '==', user.uid), where('status', '==', 'accepted'));
        const fq2 = query(collection(db, 'friendships'), where('user2_id', '==', user.uid), where('status', '==', 'accepted'));
        let fSnap1: any[] = [], fSnap2: any[] = [], fGotFirst = false;

        const processFriends = async () => {
            const allFriends = [...fSnap1, ...fSnap2];
            const seenF = new Set<string>();
            const uniqueFriends = allFriends.filter(d => { if (seenF.has(d.id)) return false; seenF.add(d.id); return true; });
            const friendList: any[] = [];
            for (const fdoc of uniqueFriends) {
                const data = fdoc.data();
                const friendUid = data.user1_id === user.uid ? data.user2_id : data.user1_id;
                const userDoc = await getDoc(doc(db, 'users', friendUid));
                const profile = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : { id: friendUid, full_name: 'Utilisateur' };
                friendList.push(profile);
            }
            setFriends(friendList);
        };

        const unsubF1 = onSnapshot(fq1, (snap) => { fSnap1 = snap.docs; if (fGotFirst) processFriends(); fGotFirst = true; });
        const unsubF2 = onSnapshot(fq2, (snap) => { fSnap2 = snap.docs; if (fGotFirst) processFriends(); fGotFirst = true; });

        // Objectives
        const unsubMem = onSnapshot(query(collection(db, 'memberships'), where('user_id', '==', user.uid)), async (snap) => {
            const objIds = snap.docs.map(d => d.data().objective_id as string);
            const objDocs = await Promise.all(objIds.map(oid => getDoc(doc(db, 'objectives', oid))));
            setMyObjectives(objDocs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsub1(); unsub2(); unsubF1(); unsubF2(); unsubMem(); };
    }, [user]);

    // ── Invite handler ──
    const handleSendInvite = async () => {
        if (!user || !selectedFriend || sending) return;
        setSending(true);
        try {
            const goal = goalEnabled ? (parseFloat(weeklyGoalInput) || 5) : 0;
            await addDoc(collection(db, 'accountability_pairs'), {
                user1_id: user.uid,
                user2_id: selectedFriend.id,
                inviter_id: user.uid,
                weekly_hours_goal: goal,
                goal_frequency: goalEnabled ? goalFrequencyInput : 'weekly',
                objective_id: (salonEnabled && selectedObjectiveId) ? selectedObjectiveId : null,
                invite_title: inviteTitle.trim() || null,
                status: 'pending',
                streak: 0,
                [`reliability_${user.uid}`]: 0,
                [`reliability_${selectedFriend.id}`]: 0,
                created_at: serverTimestamp(),
            });
            const senderName = user.displayName || user.email?.split('@')[0] || 'Un utilisateur';
            await addDoc(collection(db, 'users', selectedFriend.id, 'notifications'), {
                type: 'accountability_invite',
                message: `${senderName} te propose un Pacte de Discipline${inviteTitle.trim() ? ` : "${inviteTitle.trim()}"` : ''} !`,
                link: '/accountability',
                read: false,
                created_at: serverTimestamp(),
            });
            setShowInviteForm(false);
            setSelectedFriend(null);
            setWeeklyGoalInput('5');
            setSelectedObjectiveId('');
            setInviteTitle('');
        } catch (err) { console.error(err); }
        finally { setSending(false); }
    };

    const handleAccept = async (pairId: string, partnerUid: string) => {
        await updateDoc(doc(db, 'accountability_pairs', pairId), { status: 'active' });
        // Track accountability_partners for both users
        updateDoc(doc(db, 'users', user!.uid), { accountability_partners: increment(1) }).catch(console.error);
        updateDoc(doc(db, 'users', partnerUid), { accountability_partners: increment(1) }).catch(console.error);
        await addDoc(collection(db, 'users', partnerUid, 'notifications'), {
            type: 'accountability_accepted',
            message: `${user!.displayName || 'Ton partenaire'} a accepté le Pacte de Discipline !`,
            link: '/accountability',
            read: false,
            created_at: serverTimestamp(),
        });
    };

    const handleDecline = async (pairId: string) => {
        await deleteDoc(doc(db, 'accountability_pairs', pairId));
    };

    // ── Geo ──
    const loadMyGeo = async () => {
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().geo_visible) {
            const d = snap.data();
            setMyGeo({ lat: d.geo_lat, lng: d.geo_lng, city: d.geo_city || '', neighborhood: d.geo_neighborhood, visible: true });
            await loadNearbyUsers(d.geo_lat, d.geo_lng);
        }
    };

    const loadNearbyUsers = async (myLat: number, myLng: number) => {
        if (!user) return;
        setGeoLoading(true);
        try {
            const q = query(collection(db, 'users'), where('geo_visible', '==', true), limit(80));
            const snap = await getDocs(q);
            const existing = new Set(partners.map(p => p.id));
            const results: any[] = [];
            snap.forEach(d => {
                if (d.id === user.uid || existing.has(d.id)) return;
                const data = d.data();
                const km = haversineKm(myLat, myLng, data.geo_lat, data.geo_lng);
                if (km > 50) return;
                results.push({ id: d.id, ...data, _distanceKm: km });
            });
            results.sort((a, b) => a._distanceKm - b._distanceKm);
            setNearbyUsers(results.slice(0, 12));
        } catch (err) { console.error(err); }
        finally { setGeoLoading(false); }
    };

    const handleEnableGeo = async () => {
        if (!user || geoLoading) return;
        setGeoLoading(true);
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
            );
            const { latitude: lat, longitude: lng } = pos.coords;
            let city = '', neighborhood = '';
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'fr' } });
                const data = await res.json();
                const addr = data.address || {};
                city = addr.city || addr.town || addr.village || addr.county || '';
                neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || '';
            } catch { /* ignore */ }
            await setDoc(doc(db, 'users', user.uid), { geo_visible: true, geo_lat: lat, geo_lng: lng, geo_city: city, geo_neighborhood: neighborhood, geo_updated_at: serverTimestamp() }, { merge: true });
            setMyGeo({ lat, lng, city, neighborhood, visible: true });
            await loadNearbyUsers(lat, lng);
        } catch (err: any) {
            if (err?.code === 1) alert('Accès à la géolocalisation refusé.');
        } finally { setGeoLoading(false); }
    };

    const handleDisableGeo = async () => {
        if (!user) return;
        await setDoc(doc(db, 'users', user.uid), { geo_visible: false }, { merge: true });
        setMyGeo(null);
        setNearbyUsers([]);
    };

    const handleInviteNearby = async (nearbyUser: any) => {
        if (!user || invitingNearby) return;
        setInvitingNearby(nearbyUser.id);
        try {
            await addDoc(collection(db, 'accountability_pairs'), {
                user1_id: user.uid, user2_id: nearbyUser.id, inviter_id: user.uid,
                weekly_hours_goal: 5, goal_frequency: 'weekly',
                objective_id: null, invite_title: null,
                status: 'pending', streak: 0,
                [`reliability_${user.uid}`]: 0, [`reliability_${nearbyUser.id}`]: 0,
                created_at: serverTimestamp(), source: 'geo',
            });
            await addDoc(collection(db, 'users', nearbyUser.id, 'notifications'), {
                type: 'accountability_invite',
                message: `${user.displayName || 'Un utilisateur'} près de chez toi te propose un Pacte de Discipline !`,
                link: '/accountability', read: false, created_at: serverTimestamp(),
            });
            setNearbyUsers(prev => prev.filter(u => u.id !== nearbyUser.id));
        } catch (err) { console.error(err); }
        finally { setInvitingNearby(null); }
    };

    if (!user) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <h2 style={{ color: '#f4f4f5' }}>Connectez-vous</h2>
                <button onClick={() => router.push('/login')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#d97706,#f59e0b)', border: 'none', color: '#0a0a10', fontWeight: 700, cursor: 'pointer' }}>Connexion</button>
            </div>
        );
    }

    const activePartners = partners.filter(p => p.status === 'active' && !isBlocked(p.id));
    const pendingReceived = partners.filter(p => p.status === 'pending' && !p.isInviter && !isBlocked(p.id));
    const pendingSent = partners.filter(p => p.status === 'pending' && p.isInviter && !isBlocked(p.id));
    const totalStreak = activePartners.reduce((max, p) => Math.max(max, p.streak), 0);
    const needsCheckin = activePartners.some(p => !p.todayCheckedIn);

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem 4rem' }}>
            <style>{`
                /* fonts loaded via next/font */
                @keyframes pd-fade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
                @keyframes pd-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); } 50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); } }
                @keyframes pd-flame { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            {/* ══ HERO ══ */}
            <div style={{
                position: 'relative', marginBottom: '2.5rem', padding: '2.5rem 0 0',
                animation: 'pd-fade 0.5s ease-out',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))',
                                border: '1px solid rgba(245,158,11,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Shield size={18} style={{ color: '#f59e0b' }} />
                            </div>
                            <h1 style={{
                                margin: 0, fontFamily: 'Outfit, system-ui', fontWeight: 900,
                                fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '-0.04em',
                                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #f59e0b 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                                Pactes de Discipline
                            </h1>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, system-ui', maxWidth: 420 }}>
                            Engage-toi, check-in chaque jour, maintiens ton streak. Ton partenaire te tient responsable.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {/* Streak counter */}
                        {totalStreak > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 16px', borderRadius: 14,
                                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                            }}>
                                <Flame size={18} style={{ color: '#f59e0b', animation: 'pd-flame 2s ease-in-out infinite' }} />
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24', fontFamily: 'Outfit, system-ui', lineHeight: 1 }}>{totalStreak}</div>
                                    <div style={{ fontSize: '0.58rem', color: 'rgba(245,158,11,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>jours</div>
                                </div>
                            </div>
                        )}

                        {/* Check-in reminder */}
                        {needsCheckin && activePartners.length > 0 && (
                            <div style={{
                                padding: '8px 14px', borderRadius: 10,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                fontSize: '0.78rem', fontWeight: 600, color: '#fca5a5',
                                display: 'flex', alignItems: 'center', gap: 6,
                                animation: 'pd-pulse 2s infinite',
                            }}>
                                <AlertCircle size={13} /> Check-in du jour
                            </div>
                        )}

                        {friends.length > 0 && (
                            <button onClick={() => setShowInviteForm(v => !v)} style={{
                                padding: '10px 20px', borderRadius: 12, border: 'none',
                                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                                color: '#0a0a10', fontFamily: 'Outfit, system-ui',
                                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 4px 16px rgba(217,119,6,0.3)',
                                transition: 'all 0.15s',
                            }}>
                                {showInviteForm ? <><X size={13} /> Annuler</> : <><Plus size={13} /> Nouveau Pacte</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ══ INVITE FORM ══ */}
            {showInviteForm && (
                <div style={{
                    marginBottom: '2rem', borderRadius: 18, overflow: 'hidden',
                    border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(12,12,20,0.98)',
                    animation: 'pd-fade 0.3s ease-out',
                }}>
                    <div style={{
                        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(217,119,6,0.02))',
                    }}>
                        <div style={{ fontFamily: 'Outfit, system-ui', fontSize: '1rem', fontWeight: 700, color: '#f4f4f5' }}>Proposer un Pacte</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Choisis un ami et définis les termes du pacte</div>
                    </div>
                    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Friend selector */}
                        <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 6 }}>Partenaire</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {friends.map(f => {
                                    const sel = selectedFriend?.id === f.id;
                                    return (
                                        <button key={f.id} onClick={() => setSelectedFriend(f)} style={{
                                            padding: '8px 14px', borderRadius: 10,
                                            border: `1.5px solid ${sel ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                            background: sel ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                                            color: sel ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                                            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                                        }}>
                                            <Avatar uid={f.id} avatarUrl={f.avatar_url} avatarStyle={f.avatar_style} size={22} />
                                            {f.full_name}
                                            {sel && <CheckCircle size={13} style={{ color: '#f59e0b' }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedFriend && (
                            <>
                                {/* Title */}
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 6 }}>Nom du pacte (optionnel)</label>
                                    <input value={inviteTitle} onChange={e => setInviteTitle(e.target.value)}
                                        placeholder="Ex: Challenge 30 jours code"
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                            color: '#f4f4f5', fontSize: '0.9rem', outline: 'none', fontFamily: 'DM Sans, system-ui',
                                        }}
                                    />
                                </div>

                                {/* Goal toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Objectif horaire</label>
                                    <button onClick={() => setGoalEnabled(v => !v)} style={{
                                        width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                                        background: goalEnabled ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s',
                                    }}>
                                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: goalEnabled ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                    </button>
                                </div>
                                {goalEnabled && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input type="number" min="1" max="500" value={weeklyGoalInput} onChange={e => setWeeklyGoalInput(e.target.value)}
                                            style={{ width: 64, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                        />
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>heures /</span>
                                        <select value={goalFrequencyInput} onChange={e => setGoalFrequencyInput(e.target.value)}
                                            style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}>
                                            <option value="daily">jour</option>
                                            <option value="weekly">semaine</option>
                                            <option value="monthly">mois</option>
                                        </select>
                                    </div>
                                )}

                                {/* Salon link */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Lier un objectif</label>
                                    <button onClick={() => setSalonEnabled(v => !v)} style={{
                                        width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                                        background: salonEnabled ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s',
                                    }}>
                                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: salonEnabled ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                    </button>
                                </div>
                                {salonEnabled && myObjectives.length > 0 && (
                                    <select value={selectedObjectiveId} onChange={e => setSelectedObjectiveId(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}>
                                        <option value="">— Choisir un objectif</option>
                                        {myObjectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                                    </select>
                                )}

                                <button onClick={handleSendInvite} disabled={sending || !selectedFriend} style={{
                                    alignSelf: 'flex-end', padding: '10px 22px', borderRadius: 10, border: 'none',
                                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                                    color: '#0a0a10', fontFamily: 'Outfit, system-ui', fontSize: '0.85rem', fontWeight: 700,
                                    cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1,
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    boxShadow: '0 3px 12px rgba(217,119,6,0.3)',
                                }}>
                                    {sending ? 'Envoi...' : 'Proposer le Pacte →'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ══ PENDING RECEIVED ══ */}
            {pendingReceived.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a960', boxShadow: '0 0 6px rgba(200,169,96,0.7)' }} />
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Invitations reçues</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {pendingReceived.map((p, i) => (
                            <div key={p.pairId} style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                                borderRadius: 14, border: '1px solid rgba(200,169,96,0.15)',
                                background: 'rgba(200,169,96,0.04)',
                                animation: 'pd-fade 0.3s ease-out', animationDelay: `${i * 0.06}s`, animationFillMode: 'both',
                            }}>
                                <Avatar uid={p.id} avatarUrl={p.avatar_url} avatarStyle={p.avatar_style} size={36} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontFamily: 'Outfit, system-ui', fontWeight: 700, fontSize: '0.92rem', color: '#f4f4f5' }}>{p.full_name}</div>
                                    {p.invite_title && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>"{p.invite_title}"</div>}
                                    {p.weeklyGoal > 0 && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>
                                            <Target size={10} /> {p.weeklyGoal}h / {p.goalFrequency === 'daily' ? 'jour' : p.goalFrequency === 'monthly' ? 'mois' : 'sem.'}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => handleAccept(p.pairId, p.id)} style={{
                                        padding: '8px 16px', borderRadius: 10, border: 'none',
                                        background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                                        color: '#0a0a10', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 5,
                                    }}>
                                        <CheckCircle size={13} /> Accepter
                                    </button>
                                    <button onClick={() => handleDecline(p.pairId)} style={{
                                        padding: '8px 12px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                    }}>
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══ ACTIVE PACTS ══ */}
            <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px rgba(245,158,11,0.6)', animation: 'pd-pulse 2s infinite' }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                        Pactes actifs · {activePartners.length}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid rgba(245,158,11,0.15)', borderTopColor: '#f59e0b', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : activePartners.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 ? (
                    <div style={{
                        borderRadius: 20, border: '1px dashed rgba(245,158,11,0.15)',
                        padding: '3.5rem 2rem', textAlign: 'center', background: 'rgba(245,158,11,0.02)',
                    }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 16,
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <Shield size={26} style={{ color: '#f59e0b' }} />
                        </div>
                        <div style={{ fontFamily: 'Outfit, system-ui', fontWeight: 800, fontSize: '1.15rem', color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                            Aucun pacte encore
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', margin: '0 0 20px', maxWidth: 340, marginInline: 'auto', lineHeight: 1.6 }}>
                            Propose un Pacte de Discipline à un ami. Engagez-vous mutuellement, check-in chaque jour, et maintenez votre streak.
                        </p>
                        <button onClick={() => setShowInviteForm(true)} style={{
                            padding: '11px 24px', borderRadius: 12, border: 'none',
                            background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                            color: '#0a0a10', fontFamily: 'Outfit, system-ui', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            boxShadow: '0 4px 16px rgba(217,119,6,0.3)',
                        }}>
                            <Plus size={14} /> Nouveau Pacte
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {activePartners.map((p, i) => (
                            <div key={p.pairId} onClick={() => router.push(`/accountability/${p.pairId}`)}
                                style={{
                                    borderRadius: 18, padding: '20px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    background: 'rgba(14,14,22,0.9)',
                                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                                    animation: 'pd-fade 0.4s ease-out', animationDelay: `${i * 0.08}s`, animationFillMode: 'both',
                                    transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                {/* Top accent */}
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #d97706, #f59e0b)', opacity: 0, transition: 'opacity 0.2s' }}
                                    className="pd-accent" />

                                {/* Header row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                    <div style={{ position: 'relative' }}>
                                        <Avatar uid={p.id} avatarUrl={p.avatar_url} avatarStyle={p.avatar_style} size={42} />
                                        {/* Check-in status dot */}
                                        <div style={{
                                            position: 'absolute', bottom: -2, right: -2,
                                            width: 14, height: 14, borderRadius: '50%',
                                            background: p.partnerTodayCheckedIn ? '#10b981' : 'rgba(255,255,255,0.1)',
                                            border: '2px solid rgba(14,14,22,0.9)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {p.partnerTodayCheckedIn && <CheckCircle size={8} style={{ color: '#fff' }} />}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontFamily: 'Outfit, system-ui', fontWeight: 700, fontSize: '0.95rem', color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.full_name}
                                        </div>
                                        {p.invite_title && (
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.invite_title}
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                                </div>

                                {/* Stats row */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {/* Streak */}
                                    <div style={{
                                        flex: 1, padding: '10px', borderRadius: 10,
                                        background: p.streak > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${p.streak > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)'}`,
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                                            <Flame size={13} style={{ color: p.streak > 0 ? '#f59e0b' : 'rgba(255,255,255,0.2)' }} />
                                            <span style={{ fontSize: '1.05rem', fontWeight: 900, fontFamily: 'Outfit, system-ui', color: p.streak > 0 ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}>{p.streak}</span>
                                        </div>
                                        <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>streak</div>
                                    </div>

                                    {/* My check-in status */}
                                    <div style={{
                                        flex: 1, padding: '10px', borderRadius: 10,
                                        background: p.todayCheckedIn ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.04)',
                                        border: `1px solid ${p.todayCheckedIn ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)'}`,
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ marginBottom: 2 }}>
                                            {p.todayCheckedIn
                                                ? <CheckCircle size={15} style={{ color: '#10b981' }} />
                                                : <Clock size={15} style={{ color: '#ef4444' }} />
                                            }
                                        </div>
                                        <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            {p.todayCheckedIn ? 'fait' : 'à faire'}
                                        </div>
                                    </div>

                                    {/* Goal */}
                                    {p.weeklyGoal > 0 && (
                                        <div style={{
                                            flex: 1, padding: '10px', borderRadius: 10,
                                            background: 'rgba(200,169,96,0.04)',
                                            border: '1px solid rgba(200,169,96,0.1)',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 900, fontFamily: 'Outfit, system-ui', color: '#d4b872', marginBottom: 2 }}>{p.weeklyGoal}h</div>
                                            <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                / {p.goalFrequency === 'daily' ? 'jour' : p.goalFrequency === 'monthly' ? 'mois' : 'sem.'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pending sent */}
                {pendingSent.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                        {pendingSent.map(p => (
                            <div key={p.pairId} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                            }}>
                                <Avatar uid={p.id} avatarUrl={p.avatar_url} avatarStyle={p.avatar_style} size={28} />
                                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', flex: 1 }}>{p.full_name}</span>
                                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>En attente...</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ══ NEARBY USERS (GEO) ══ */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <MapPin size={13} style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Près de chez toi</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                    {myGeo && (
                        <button onClick={handleDisableGeo} style={{
                            fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                        }}>Désactiver</button>
                    )}
                </div>

                {!myGeo ? (
                    <div style={{
                        borderRadius: 16, border: '1px dashed rgba(16,185,129,0.15)',
                        padding: '2rem', textAlign: 'center', background: 'rgba(16,185,129,0.02)',
                    }}>
                        <MapPin size={22} style={{ color: '#10b981', margin: '0 auto 10px', display: 'block' }} />
                        <div style={{ fontFamily: 'Outfit, system-ui', fontWeight: 700, fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                            Trouve des partenaires proches
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', margin: '0 0 14px' }}>Active la géolocalisation pour découvrir des utilisateurs à proximité.</p>
                        <button onClick={handleEnableGeo} disabled={geoLoading} style={{
                            padding: '9px 20px', borderRadius: 10, border: 'none',
                            background: 'rgba(16,185,129,0.15)', color: '#34d399',
                            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}>
                            <MapPin size={13} /> {geoLoading ? 'Localisation...' : 'Activer la localisation'}
                        </button>
                    </div>
                ) : nearbyUsers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                        {geoLoading ? (
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.15)', borderTopColor: '#10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                        ) : (
                            <>Aucun utilisateur trouvé à proximité{myGeo.city ? ` de ${myGeo.city}` : ''}.</>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {nearbyUsers.map((u, i) => {
                            const badge = distanceBadge(u._distanceKm);
                            return (
                                <div key={u.id} style={{
                                    padding: '14px', borderRadius: 14,
                                    border: '1px solid rgba(16,185,129,0.1)',
                                    background: 'rgba(14,14,22,0.8)',
                                    display: 'flex', flexDirection: 'column', gap: 10,
                                    animation: 'pd-fade 0.3s ease-out', animationDelay: `${i * 0.05}s`, animationFillMode: 'both',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Avatar uid={u.id} avatarUrl={u.avatar_url} avatarStyle={u.avatar_style} size={32} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'Outfit, system-ui', fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || 'Utilisateur'}</div>
                                            <div style={{ fontSize: '0.7rem', color: badge.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <MapPin size={9} /> {badge.label}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleInviteNearby(u)} disabled={invitingNearby === u.id} style={{
                                        width: '100%', padding: '7px', borderRadius: 8, border: 'none',
                                        background: 'rgba(16,185,129,0.1)', color: '#34d399',
                                        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                                        opacity: invitingNearby === u.id ? 0.5 : 1,
                                    }}>
                                        {invitingNearby === u.id ? 'Envoyé !' : 'Proposer un Pacte'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
