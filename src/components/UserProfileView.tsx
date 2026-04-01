'use client';

import Avatar from '@/components/Avatar';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useBlock } from '@/context/BlockContext';
import { UserPlus, UserCheck, Clock, MessageCircle, ArrowLeft, Users, Check, Target, CalendarDays, Pencil, MapPin, ShieldOff, Flag, MoreHorizontal, ShieldAlert, X, Zap, Star, Lock } from 'lucide-react';
import { findCountry } from '@/lib/countries';
import { BADGES } from '@/context/GamificationContext';
import type { Badge } from '@/context/GamificationContext';

const fmtHours = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${parseFloat(h.toFixed(1))}h`;

function calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function xpForLevel(level: number): number {
    return Math.pow(level - 1, 2) * 100;
}

function xpForNextLevel(level: number): number {
    return Math.pow(level, 2) * 100;
}

export function UserProfileView({ uid: uidProp, redirectToUsername }: { uid?: string; redirectToUsername?: boolean }) {
    const params = useParams<{ uid: string }>();
    const uid = uidProp || params?.uid;
    const { user } = useAuth();
    const { t } = useLocale();
    const router = useRouter();
    const { isBlocked, blockedIds, blockUser, unblockUser, reportUser } = useBlock();

    const [profile, setProfile] = useState<any>(null);
    const [objectives, setObjectives] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [totalHours, setTotalHours] = useState(0);
    const [totalObjectives, setTotalObjectives] = useState(0);
    const [totalProjects, setTotalProjects] = useState(0);
    const [loading, setLoading] = useState(true);
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none');
    const [friendDocId, setFriendDocId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Block/Report state
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [reportSending, setReportSending] = useState(false);
    const [reportSent, setReportSent] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);

    const moreMenuRef = useRef<HTMLDivElement>(null);

    const isMyProfile = user?.uid === uid;
    const userIsBlocked = uid ? isBlocked(uid) : false;
    const iBlockedThem = uid ? blockedIds.has(uid) : false;

    useEffect(() => {
        if (!uid) return;
        const load = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    setProfile({ id: userDoc.id, ...userDoc.data() });
                }

                // Stats from objective memberships
                const memberQ = query(collection(db, 'memberships'), where('user_id', '==', uid));
                const memberSnap = await getDocs(memberQ);
                let hours = 0;
                const objIds: string[] = [];
                memberSnap.docs.forEach(d => {
                    hours += d.data().completed_hours || 0;
                    objIds.push(d.data().objective_id);
                });
                setTotalHours(hours);
                setTotalObjectives(memberSnap.docs.length);

                if (objIds.length > 0) {
                    const objPromises = objIds.map(id => getDoc(doc(db, 'objectives', id)));
                    const objDocs = await Promise.all(objPromises);
                    const objs = objDocs
                        .filter(d => d.exists() && d.data()?.is_public)
                        .map(d => ({ id: d.id, ...d.data() }));
                    setObjectives(objs);
                }

                // Stats from project memberships
                const projMemberQ = query(collection(db, 'project_memberships'), where('user_id', '==', uid));
                const projMemberSnap = await getDocs(projMemberQ);
                setTotalProjects(projMemberSnap.docs.length);
                const projIds = projMemberSnap.docs.map(d => d.data().project_id).filter(Boolean);

                if (projIds.length > 0) {
                    const projPromises = projIds.map(id => getDoc(doc(db, 'projects', id)));
                    const projDocs = await Promise.all(projPromises);
                    const projs = projDocs
                        .filter(d => d.exists() && d.data()?.is_public !== false)
                        .map(d => ({ id: d.id, ...d.data() }));
                    setProjects(projs);
                }

                // Check friendship
                if (user && user.uid !== uid) {
                    const fSnap = await getDocs(query(collection(db, 'friendships'),
                        where('user1_id', 'in', [user.uid, uid])));
                    for (const fdoc of fSnap.docs) {
                        const data = fdoc.data();
                        const involves = (data.user1_id === user.uid && data.user2_id === uid) ||
                            (data.user1_id === uid && data.user2_id === user.uid);
                        if (involves) {
                            setFriendDocId(fdoc.id);
                            if (data.status === 'accepted') setFriendStatus('accepted');
                            else if (data.sender_id === user.uid) setFriendStatus('pending_sent');
                            else setFriendStatus('pending_received');
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading profile', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [uid, user]);

    // Redirect /user/[uid] → /u/[username] when username is available
    useEffect(() => {
        if (redirectToUsername && profile?.username) {
            router.replace(`/u/${profile.username}`);
        }
    }, [profile, redirectToUsername, router]);

    const handleAddFriend = async () => {
        if (!user || !uid) return;
        setActionLoading(true);
        try {
            const docId = [user.uid, uid].sort().join('_');
            await setDoc(doc(db, 'friendships', docId), {
                user1_id: user.uid < uid ? user.uid : uid,
                user2_id: user.uid < uid ? uid : user.uid,
                sender_id: user.uid,
                status: 'pending',
                created_at: Timestamp.now(),
            });
            setFriendStatus('pending_sent');
            setFriendDocId(docId);
            await setDoc(doc(collection(db, 'users', uid, 'notifications')), {
                type: 'friend_request',
                from_uid: user.uid,
                from_name: user.displayName || user.email,
                message: `${user.displayName || user.email} vous a envoyé une demande d'ami`,
                read: false,
                created_at: Timestamp.now(),
            });
        } catch (err) { console.error(err); }
        finally { setActionLoading(false); }
    };

    const handleAccept = async () => {
        if (!friendDocId) return;
        setActionLoading(true);
        try {
            await setDoc(doc(db, 'friendships', friendDocId), { status: 'accepted' }, { merge: true });
            setFriendStatus('accepted');
        } catch (err) { console.error(err); }
        finally { setActionLoading(false); }
    };

    const handleReject = async () => {
        if (!friendDocId) return;
        setActionLoading(true);
        try {
            await deleteDoc(doc(db, 'friendships', friendDocId));
            setFriendStatus('none');
            setFriendDocId(null);
        } catch (err) { console.error(err); }
        finally { setActionLoading(false); }
    };

    const handleMessage = () => {
        if (!uid) return;
        const convId = [user!.uid, uid].sort().join('_');
        router.push(`/messages?conv=${convId}&to=${uid}`);
    };

    const handleBlock = async () => {
        if (!uid) return;
        setBlockLoading(true);
        try { await blockUser(uid); setShowMoreMenu(false); }
        catch (err) { console.error(err); }
        finally { setBlockLoading(false); }
    };

    const handleUnblock = async () => {
        if (!uid) return;
        setBlockLoading(true);
        try { await unblockUser(uid); }
        catch (err) { console.error(err); }
        finally { setBlockLoading(false); }
    };

    const handleReport = async () => {
        if (!uid || !reportReason) return;
        setReportSending(true);
        try {
            await reportUser(uid, reportReason, reportDetails);
            setReportSent(true);
            setTimeout(() => { setShowReportModal(false); setReportSent(false); setReportReason(''); setReportDetails(''); }, 2000);
        } catch (err) { console.error(err); }
        finally { setReportSending(false); }
    };

    // Close more menu on outside click
    useEffect(() => {
        if (!showMoreMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showMoreMenu]);

    if (loading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(200,169,96,0.3)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '3rem' }}>🔍</div>
                <h2 style={{ color: 'white', margin: 0 }}>Utilisateur introuvable</h2>
                <button className="btn btn-ghost" onClick={() => router.back()}>
                    <ArrowLeft size={15} /> Retour
                </button>
            </div>
        );
    }

    const joinedDate = profile.created_at?.toDate
        ? profile.created_at.toDate()
        : profile.created_at ? new Date(profile.created_at) : null;

    const dp = profile.discipline_profile;

    const accentColor = dp?.color || '#c8a960';

    // Gamification data from profile doc
    const userXP = profile.xp ?? 0;
    const userLevel = calculateLevel(userXP);
    const userBadges: string[] = profile.badges ?? [];
    const currentLevelXP = xpForLevel(userLevel);
    const nextLevelXP = xpForNextLevel(userLevel);
    const levelProgress = nextLevelXP > currentLevelXP ? (userXP - currentLevelXP) / (nextLevelXP - currentLevelXP) : 0;

    // Blocked state — show minimal page
    if (userIsBlocked && iBlockedThem) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <ShieldOff size={36} style={{ color: 'rgba(255,255,255,0.15)' }} />
                <h2 style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '1.1rem' }}>Utilisateur bloqué</h2>
                <p style={{ color: 'rgba(255,255,255,0.25)', margin: 0, fontSize: '0.85rem' }}>Vous avez bloqué cet utilisateur.</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                    <button onClick={handleUnblock} disabled={blockLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        {blockLoading ? 'Déblocage...' : 'Débloquer'}
                    </button>
                    <button onClick={() => router.back()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>
                        <ArrowLeft size={14} /> Retour
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
            <style>{`
                @keyframes profileFadeIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes profileSlideUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes levelRingDraw {
                    from { stroke-dashoffset: ${2 * Math.PI * 34}; }
                }
                @keyframes shimmerSweep {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .profile-action-btn {
                    transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
                }
                .profile-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                }
                .profile-action-btn:active {
                    transform: translateY(0);
                }
                .profile-obj-card {
                    transition: all 0.22s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
                }
                .profile-obj-card:hover {
                    border-color: ${accentColor}55 !important;
                    background: ${accentColor}08 !important;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 32px ${accentColor}10;
                }
                .badge-cell {
                    transition: all 0.2s ease !important;
                }
                .badge-cell:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
                }
                .more-menu-item {
                    transition: background 0.12s ease !important;
                }
                .more-menu-item:hover {
                    background: rgba(255,255,255,0.06) !important;
                }
            `}</style>

            {/* ── HERO SECTION ── */}
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                {/* Ambient gradient backdrop */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accentColor}14 0%, transparent 70%)`,
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: '-30%', right: '-10%', width: '40%', height: '100%',
                    background: `radial-gradient(ellipse, ${accentColor}08 0%, transparent 65%)`,
                    pointerEvents: 'none',
                }} />

                <div style={{
                    position: 'relative', maxWidth: '720px', margin: '0 auto',
                    padding: '1.75rem 2rem 2.25rem',
                }}>

                    {/* Back button */}
                    <button
                        onClick={() => router.back()}
                        className="profile-action-btn"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem',
                            fontWeight: 500, marginBottom: '2rem', padding: '4px 0',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                    >
                        <ArrowLeft size={14} /> Retour
                    </button>

                    {/* ── Profile Card ── */}
                    <div style={{
                        display: 'flex', gap: '2rem', alignItems: 'stretch',
                        animation: 'profileFadeIn 0.5s ease-out both',
                    }}>

                        {/* LEFT: Avatar + Level Ring */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            gap: '14px', flexShrink: 0,
                        }}>
                            {/* Avatar with ring */}
                            <div style={{ position: 'relative' }}>
                                <svg width={108} height={108} style={{
                                    position: 'absolute', top: -6, left: -6,
                                    transform: 'rotate(-90deg)',
                                    filter: `drop-shadow(0 0 6px ${accentColor}30)`,
                                }}>
                                    <circle cx={54} cy={54} r={51} fill="none"
                                        stroke={`${accentColor}15`} strokeWidth={3} />
                                    <circle cx={54} cy={54} r={51} fill="none"
                                        stroke={accentColor} strokeWidth={3}
                                        strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 51}
                                        strokeDashoffset={2 * Math.PI * 51 * (1 - Math.min(levelProgress, 1))}
                                        style={{ animation: 'levelRingDraw 1.2s cubic-bezier(0.25,0.1,0.25,1) both' }}
                                    />
                                </svg>
                                <Avatar
                                    uid={uid}
                                    avatarUrl={profile.avatar_url}
                                    avatarStyle={profile.avatar_style}
                                    size={96}
                                    style={{ borderRadius: '50%', display: 'block' }}
                                />
                                {/* Level badge */}
                                <div style={{
                                    position: 'absolute', bottom: -4, right: -4,
                                    width: 30, height: 30, borderRadius: '50%',
                                    background: '#131316', border: `2px solid ${accentColor}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 2px 10px ${accentColor}40`,
                                }}>
                                    <span style={{
                                        fontFamily: 'var(--font-display)', fontSize: '0.72rem',
                                        fontWeight: 800, color: accentColor, lineHeight: 1,
                                    }}>
                                        {userLevel}
                                    </span>
                                </div>
                            </div>

                            {/* XP indicator */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '3px 10px', borderRadius: '20px',
                                background: `${accentColor}0e`, border: `1px solid ${accentColor}20`,
                            }}>
                                <Zap size={10} style={{ color: accentColor }} />
                                <span style={{
                                    fontSize: '0.68rem', fontWeight: 700, color: accentColor,
                                    fontFamily: 'var(--font-display)',
                                }}>
                                    {userXP.toLocaleString()} XP
                                </span>
                            </div>
                        </div>

                        {/* CENTER: Name, meta, archetype */}
                        <div style={{
                            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                            justifyContent: 'center', gap: '2px',
                        }}>
                            <h1 style={{
                                fontSize: '1.65rem', fontWeight: 800, color: '#ede9e3',
                                margin: 0, letterSpacing: '-0.035em',
                                fontFamily: 'var(--font-display)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                lineHeight: 1.2,
                            }}>
                                {profile.full_name || 'Utilisateur'}
                            </h1>

                            {/* Meta line */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                flexWrap: 'wrap', marginTop: '4px', marginBottom: '12px',
                            }}>
                                {joinedDate && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        color: 'rgba(255,255,255,0.3)', fontSize: '0.76rem',
                                    }}>
                                        <CalendarDays size={11} style={{ opacity: 0.6 }} />
                                        Membre depuis {joinedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                    </span>
                                )}
                                {(profile.country || profile.city) && (() => {
                                    const c = profile.country ? findCountry(profile.country) : null;
                                    const parts = [profile.city, c?.name].filter(Boolean);
                                    if (parts.length === 0) return null;
                                    return (
                                        <>
                                            {joinedDate && <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>·</span>}
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                fontSize: '0.76rem', color: 'rgba(255,255,255,0.3)',
                                            }}>
                                                <MapPin size={10} style={{ opacity: 0.6 }} />
                                                {c?.flag && <span style={{ fontSize: '0.8rem', lineHeight: 1 }}>{c.flag}</span>}
                                                {parts.join(', ')}
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Archetype pill */}
                            {dp && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    padding: '6px 14px 6px 10px', borderRadius: '24px',
                                    background: `${dp.color}12`, border: `1px solid ${dp.color}30`,
                                    width: 'fit-content', marginBottom: '16px',
                                }}>
                                    <span style={{ fontSize: '1rem' }}>{dp.emoji}</span>
                                    <span style={{
                                        fontSize: '0.76rem', fontWeight: 700, color: dp.color,
                                        letterSpacing: '-0.01em',
                                    }}>
                                        {dp.type}
                                    </span>
                                    <span style={{
                                        width: '3px', height: '3px', borderRadius: '50%',
                                        background: `${dp.color}40`, flexShrink: 0,
                                    }} />
                                    <span style={{
                                        fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)',
                                        fontWeight: 500,
                                    }}>
                                        {dp.tagline}
                                    </span>
                                </div>
                            )}

                            {/* ── Action Buttons ── */}
                            {!isMyProfile && user && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {/* Primary action */}
                                    {friendStatus === 'none' && (
                                        <button
                                            onClick={handleAddFriend} disabled={actionLoading}
                                            className="profile-action-btn"
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                padding: '9px 20px', borderRadius: '12px',
                                                background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}15)`,
                                                border: `1px solid ${accentColor}50`,
                                                color: '#d4b872', fontSize: '0.82rem', fontWeight: 700,
                                                cursor: 'pointer', letterSpacing: '-0.01em',
                                            }}>
                                            <UserPlus size={14} /> {t('friends_btn_add')}
                                        </button>
                                    )}
                                    {friendStatus === 'pending_sent' && (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                                            padding: '9px 20px', borderRadius: '12px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', fontWeight: 600,
                                        }}>
                                            <Clock size={13} /> Demande envoyée
                                        </div>
                                    )}
                                    {friendStatus === 'pending_received' && (
                                        <>
                                            <button onClick={handleAccept} disabled={actionLoading}
                                                className="profile-action-btn"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                    padding: '9px 20px', borderRadius: '12px',
                                                    background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))',
                                                    border: '1px solid rgba(16,185,129,0.4)',
                                                    color: '#6ee7b7', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                                }}>
                                                <UserCheck size={14} /> {t('friends_btn_accept')}
                                            </button>
                                            <button onClick={handleReject} disabled={actionLoading}
                                                className="profile-action-btn"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                    padding: '9px 20px', borderRadius: '12px',
                                                    background: 'rgba(239,68,68,0.08)',
                                                    border: '1px solid rgba(239,68,68,0.25)',
                                                    color: '#fca5a5', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                                }}>
                                                {t('friends_btn_reject')}
                                            </button>
                                        </>
                                    )}
                                    {friendStatus === 'accepted' && (
                                        <>
                                            <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                padding: '9px 16px', borderRadius: '12px',
                                                background: 'rgba(16,185,129,0.08)',
                                                border: '1px solid rgba(16,185,129,0.2)',
                                                color: '#34d399', fontSize: '0.8rem', fontWeight: 600,
                                            }}>
                                                <UserCheck size={13} /> {t('friends_already')}
                                            </div>
                                            <button onClick={handleMessage}
                                                className="profile-action-btn"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                    padding: '9px 20px', borderRadius: '12px',
                                                    background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}10)`,
                                                    border: `1px solid ${accentColor}45`,
                                                    color: '#d4b872', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                                }}>
                                                <MessageCircle size={14} /> {t('friends_btn_message')}
                                            </button>
                                        </>
                                    )}

                                    {/* More menu (block/report) — subtle secondary action */}
                                    <div ref={moreMenuRef} style={{ position: 'relative', marginLeft: '2px' }}>
                                        <button
                                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                                            className="profile-action-btn"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: showMoreMenu ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                                            onMouseLeave={e => { if (!showMoreMenu) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; } }}
                                        >
                                            <MoreHorizontal size={15} />
                                        </button>
                                        {showMoreMenu && (
                                            <div style={{
                                                position: 'absolute', bottom: '42px', right: 0, zIndex: 200,
                                                background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '14px', padding: '5px', minWidth: '190px',
                                                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                                animation: 'profileFadeIn 0.15s ease-out both',
                                            }}>
                                                <button
                                                    onClick={iBlockedThem ? handleUnblock : handleBlock}
                                                    disabled={blockLoading}
                                                    className="more-menu-item"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                                                        padding: '10px 13px', borderRadius: '10px', border: 'none',
                                                        background: 'none', color: iBlockedThem ? '#5eead4' : '#fca5a5',
                                                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <ShieldOff size={14} />
                                                    {blockLoading ? '...' : iBlockedThem ? 'Débloquer' : 'Bloquer'}
                                                </button>
                                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2px 8px' }} />
                                                <button
                                                    onClick={() => { setShowMoreMenu(false); setShowReportModal(true); }}
                                                    className="more-menu-item"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                                                        padding: '10px 13px', borderRadius: '10px', border: 'none',
                                                        background: 'none', color: '#f59e0b',
                                                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <Flag size={14} />
                                                    Signaler
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {isMyProfile && (
                                <button onClick={() => router.push('/profile')}
                                    className="profile-action-btn"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                                        padding: '9px 20px', borderRadius: '12px',
                                        background: `${accentColor}15`,
                                        border: `1px solid ${accentColor}35`,
                                        color: '#d4b872', fontSize: '0.82rem', fontWeight: 700,
                                        cursor: 'pointer', width: 'fit-content',
                                    }}>
                                    <Pencil size={13} /> Modifier mon profil
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── STATS BAR ── */}
            <div style={{
                background: 'rgba(255,255,255,0.015)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{
                    maxWidth: '720px', margin: '0 auto',
                    padding: '0 2rem',
                    display: 'flex', alignItems: 'stretch',
                    gap: 0,
                    animation: 'profileFadeIn 0.5s ease-out 0.1s both',
                }}>
                    {[
                        {
                            icon: <Clock size={15} style={{ color: '#5eead4' }} />,
                            value: fmtHours(totalHours + (profile.total_hours ?? 0)),
                            label: t('profile_stat_hours'),
                            color: '#5eead4',
                        },
                        {
                            icon: <Target size={15} style={{ color: '#c8a960' }} />,
                            value: String(totalObjectives + totalProjects),
                            label: 'Salons rejoints',
                            color: '#c8a960',
                        },
                        {
                            icon: <Star size={15} style={{ color: '#f0abfc' }} />,
                            value: `${userBadges.length}/${BADGES.length}`,
                            label: 'Badges',
                            color: '#f0abfc',
                        },
                        {
                            icon: <Zap size={15} style={{ color: accentColor }} />,
                            value: `Niv. ${userLevel}`,
                            label: `${userXP.toLocaleString()} XP`,
                            color: accentColor,
                        },
                    ].map((stat, i) => (
                        <div key={i} style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '18px 16px',
                            borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            justifyContent: 'center',
                        }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '10px',
                                background: `${stat.color}0c`,
                                border: `1px solid ${stat.color}18`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <div style={{
                                    fontSize: '1rem', fontWeight: 800, color: '#ede9e3',
                                    fontFamily: 'var(--font-display)', lineHeight: 1.1,
                                    letterSpacing: '-0.02em',
                                }}>
                                    {stat.value}
                                </div>
                                <div style={{
                                    fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)',
                                    textTransform: 'uppercase', letterSpacing: '0.07em',
                                    fontWeight: 600, marginTop: '2px',
                                }}>
                                    {stat.label}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 2rem 0' }}>

                {/* ── Two-column layout: Main + Sidebar ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: (objectives.length > 0 || projects.length > 0 || dp) ? '1fr 260px' : '1fr',
                    gap: '1.75rem',
                    alignItems: 'start',
                }}>

                    {/* MAIN COLUMN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* ── BADGES SHOWCASE ── */}
                        {userBadges.length > 0 && (
                            <div style={{
                                animation: 'profileSlideUp 0.5s ease-out 0.2s both',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    marginBottom: '14px',
                                }}>
                                    <div style={{
                                        width: '3px', height: '14px', borderRadius: '2px',
                                        background: `linear-gradient(180deg, ${accentColor}, ${accentColor}40)`,
                                    }} />
                                    <h3 style={{
                                        fontSize: '0.78rem', fontWeight: 700,
                                        color: 'rgba(255,255,255,0.4)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                                    }}>
                                        Badges obtenus
                                    </h3>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                    gap: '8px',
                                }}>
                                    {BADGES.map((badge: Badge) => {
                                        const earned = userBadges.includes(badge.id);
                                        if (!earned) return null;
                                        return (
                                            <div key={badge.id} className="badge-cell" style={{
                                                padding: '14px 10px',
                                                borderRadius: '14px',
                                                background: `${accentColor}06`,
                                                border: `1px solid ${accentColor}15`,
                                                textAlign: 'center',
                                                cursor: 'default',
                                            }}>
                                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>
                                                    {badge.icon}
                                                </div>
                                                <div style={{
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: '0.76rem', fontWeight: 700,
                                                    color: '#ede9e3', marginBottom: '2px',
                                                    letterSpacing: '-0.01em',
                                                }}>
                                                    {badge.name}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.62rem',
                                                    color: 'rgba(200,169,96,0.55)',
                                                    lineHeight: 1.3,
                                                }}>
                                                    {badge.description}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Show locked badge count */}
                                    {BADGES.length - userBadges.length > 0 && (
                                        <div style={{
                                            padding: '14px 10px',
                                            borderRadius: '14px',
                                            background: 'rgba(255,255,255,0.015)',
                                            border: '1px solid rgba(255,255,255,0.04)',
                                            textAlign: 'center',
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center',
                                            gap: '4px',
                                        }}>
                                            <Lock size={16} style={{ color: 'rgba(255,255,255,0.12)' }} />
                                            <span style={{
                                                fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)',
                                                fontWeight: 600,
                                            }}>
                                                +{BADGES.length - userBadges.length}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── DISCIPLINE PROFILE CARD ── */}
                        {dp && (
                            <div style={{
                                borderRadius: '16px', overflow: 'hidden',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                animation: 'profileSlideUp 0.5s ease-out 0.25s both',
                            }}>
                                {/* Header */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${dp.color}15, ${dp.color}05)`,
                                    borderBottom: `1px solid ${dp.color}20`,
                                    padding: '1.25rem 1.5rem',
                                    display: 'flex', alignItems: 'flex-start', gap: '1rem',
                                }}>
                                    <div style={{
                                        width: '50px', height: '50px', borderRadius: '14px', flexShrink: 0,
                                        background: `${dp.color}15`, border: `1.5px solid ${dp.color}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.6rem',
                                        boxShadow: `0 4px 16px ${dp.color}15`,
                                    }}>
                                        {dp.emoji}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.57rem', fontWeight: 700, color: dp.color,
                                            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '3px',
                                        }}>
                                            Profil de discipline
                                        </div>
                                        <h3 style={{
                                            fontSize: '1.1rem', fontWeight: 800, color: 'white',
                                            margin: '0 0 2px', letterSpacing: '-0.025em',
                                        }}>
                                            {dp.type}
                                        </h3>
                                        <p style={{
                                            fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
                                            margin: 0, lineHeight: 1.6,
                                        }}>
                                            {dp.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Forces + Growth */}
                                <div style={{
                                    padding: '1.15rem 1.5rem',
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem',
                                }}>
                                    <div>
                                        <div style={{
                                            fontSize: '0.58rem', fontWeight: 700,
                                            color: 'rgba(255,255,255,0.25)',
                                            textTransform: 'uppercase', letterSpacing: '0.12em',
                                            marginBottom: '10px',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                        }}>
                                            <span style={{ color: '#10b981' }}>✦</span> Forces
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {dp.strengths?.map((s: string, i: number) => (
                                                <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                                                    <div style={{
                                                        width: '16px', height: '16px', borderRadius: '5px', flexShrink: 0, marginTop: '1px',
                                                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Check size={8} style={{ color: '#10b981' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{s}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '0.58rem', fontWeight: 700,
                                            color: 'rgba(255,255,255,0.25)',
                                            textTransform: 'uppercase', letterSpacing: '0.12em',
                                            marginBottom: '10px',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                        }}>
                                            <span style={{ color: '#f59e0b' }}>✦</span> À développer
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {dp.growth_areas?.map((g: string, i: number) => (
                                                <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                                                    <div style={{
                                                        width: '16px', height: '16px', borderRadius: '5px', flexShrink: 0, marginTop: '1px',
                                                        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '8px', color: '#f59e0b',
                                                    }}>
                                                        →
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{g}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Tip */}
                                {dp.tip && (
                                    <div style={{
                                        margin: '0 1.25rem 1.25rem',
                                        padding: '11px 14px', borderRadius: '11px',
                                        background: `${dp.color}0c`, border: `1px solid ${dp.color}1a`,
                                    }}>
                                        <div style={{
                                            fontSize: '0.58rem', fontWeight: 700, color: dp.color,
                                            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px',
                                        }}>
                                            💡 Conseil personnalisé
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
                                            {dp.tip}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SIDEBAR: Objectifs + Projets */}
                    {(objectives.length > 0 || projects.length > 0 || (!dp && objectives.length === 0)) && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '1.5rem',
                            animation: 'profileSlideUp 0.5s ease-out 0.3s both',
                        }}>
                            {/* Objectifs */}
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    marginBottom: '14px',
                                }}>
                                    <div style={{
                                        width: '3px', height: '14px', borderRadius: '2px',
                                        background: 'linear-gradient(180deg, #5eead4, #5eead480)',
                                    }} />
                                    <h3 style={{
                                        fontSize: '0.78rem', fontWeight: 700,
                                        color: 'rgba(255,255,255,0.4)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                                    }}>
                                        Objectifs
                                    </h3>
                                    {objectives.length > 0 && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700,
                                            color: 'rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '2px 8px', borderRadius: '20px',
                                        }}>
                                            {objectives.length}
                                        </span>
                                    )}
                                </div>

                                {objectives.length === 0 ? (
                                    <div style={{
                                        padding: '1.5rem', textAlign: 'center', borderRadius: '14px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    }}>
                                        <div style={{ fontSize: '1.4rem', marginBottom: '4px', opacity: 0.3 }}>📭</div>
                                        <p style={{
                                            color: 'rgba(255,255,255,0.22)', margin: 0, fontSize: '0.78rem',
                                        }}>
                                            Aucun objectif public
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {objectives.map((obj: any) => {
                                            const perc = Math.min(100, Math.round(((obj.completed_hours ?? 0) / (obj.target_hours || 1)) * 100));
                                            return (
                                                <div
                                                    key={obj.id}
                                                    onClick={() => router.push(`/objective/${obj.id}`)}
                                                    className="profile-obj-card"
                                                    style={{
                                                        padding: '14px 16px', borderRadius: '13px', cursor: 'pointer',
                                                        background: 'rgba(255,255,255,0.025)',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                    }}
                                                >
                                                    <h4 style={{
                                                        margin: '0 0 5px', fontWeight: 700, fontSize: '0.84rem',
                                                        color: '#ede9e3', overflow: 'hidden',
                                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {obj.title}
                                                    </h4>
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center',
                                                        justifyContent: 'space-between', marginBottom: '8px',
                                                    }}>
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                            color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem',
                                                        }}>
                                                            <Users size={11} /> {obj.participant_count ?? '?'}
                                                        </div>
                                                        {obj.category && (
                                                            <span style={{
                                                                fontSize: '0.62rem', fontWeight: 700,
                                                                padding: '2px 7px', borderRadius: '6px',
                                                                background: '#5eead410',
                                                                color: '#5eead4',
                                                                border: '1px solid #5eead418',
                                                            }}>
                                                                {obj.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{
                                                        height: '3px', borderRadius: '2px',
                                                        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                                                    }}>
                                                        <div style={{
                                                            height: '100%', width: `${perc}%`,
                                                            background: 'linear-gradient(90deg, #5eead4, #5eead4cc)',
                                                            borderRadius: '2px',
                                                            transition: 'width 0.6s ease',
                                                        }} />
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)',
                                                        fontWeight: 600, marginTop: '5px', textAlign: 'right',
                                                    }}>
                                                        {perc}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Projects */}
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    marginBottom: '14px',
                                }}>
                                    <div style={{
                                        width: '3px', height: '14px', borderRadius: '2px',
                                        background: 'linear-gradient(180deg, #a78bfa, #a78bfa80)',
                                    }} />
                                    <h3 style={{
                                        fontSize: '0.78rem', fontWeight: 700,
                                        color: 'rgba(255,255,255,0.4)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                                    }}>
                                        Projets
                                    </h3>
                                    {projects.length > 0 && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700,
                                            color: 'rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '2px 8px', borderRadius: '20px',
                                        }}>
                                            {projects.length}
                                        </span>
                                    )}
                                </div>

                                {projects.length === 0 ? (
                                    <div style={{
                                        padding: '1.5rem', textAlign: 'center', borderRadius: '14px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    }}>
                                        <div style={{ fontSize: '1.4rem', marginBottom: '4px', opacity: 0.3 }}>📁</div>
                                        <p style={{
                                            color: 'rgba(255,255,255,0.22)', margin: 0, fontSize: '0.78rem',
                                        }}>
                                            Aucun projet public
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {projects.map((proj: any) => (
                                            <div
                                                key={proj.id}
                                                onClick={() => router.push(`/project/${proj.id}`)}
                                                className="profile-obj-card"
                                                style={{
                                                    padding: '14px 16px', borderRadius: '13px', cursor: 'pointer',
                                                    background: 'rgba(255,255,255,0.025)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                <h4 style={{
                                                    margin: '0 0 5px', fontWeight: 700, fontSize: '0.84rem',
                                                    color: '#ede9e3', overflow: 'hidden',
                                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {proj.name || proj.title || 'Projet'}
                                                </h4>
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem',
                                                }}>
                                                    <Users size={11} /> {proj.member_count ?? proj.participant_count ?? '?'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── REPORT MODAL ── */}
            {showReportModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem',
                }}>
                    <div
                        onClick={() => { if (!reportSending) { setShowReportModal(false); setReportReason(''); setReportDetails(''); setReportSent(false); } }}
                        style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(0,0,0,0.75)',
                            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                        }}
                    />
                    <div style={{
                        position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px',
                        background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '18px', padding: '1.75rem',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                        animation: 'profileFadeIn 0.2s ease-out both',
                    }}>
                        {reportSent ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: 'rgba(16,185,129,0.15)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 1rem',
                                }}>
                                    <Check size={22} style={{ color: '#10b981' }} />
                                </div>
                                <h3 style={{ color: 'white', margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700 }}>Signalement envoyé</h3>
                                <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '0.82rem' }}>Merci, notre équipe examinera ce signalement.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between', marginBottom: '1.25rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                                        <h3 style={{ color: 'white', margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                                            Signaler cet utilisateur
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => { setShowReportModal(false); setReportReason(''); setReportDetails(''); }}
                                        style={{
                                            background: 'none', border: 'none',
                                            color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px',
                                        }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <p style={{
                                    color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem',
                                    margin: '0 0 1rem', lineHeight: 1.5,
                                }}>
                                    Sélectionnez la raison de votre signalement. Les faux signalements peuvent entraîner des sanctions.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                                    {[
                                        { value: 'harassment', label: 'Harcèlement' },
                                        { value: 'spam', label: 'Spam' },
                                        { value: 'inappropriate', label: 'Contenu inapproprié' },
                                        { value: 'impersonation', label: "Usurpation d'identité" },
                                        { value: 'other', label: 'Autre' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setReportReason(opt.value)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '10px 14px', borderRadius: '10px',
                                                background: reportReason === opt.value ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${reportReason === opt.value ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                                color: reportReason === opt.value ? '#f59e0b' : 'rgba(255,255,255,0.55)',
                                                fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
                                                transition: 'all 0.15s', textAlign: 'left',
                                            }}
                                        >
                                            <div style={{
                                                width: '16px', height: '16px', borderRadius: '50%',
                                                border: `2px solid ${reportReason === opt.value ? '#f59e0b' : 'rgba(255,255,255,0.15)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                {reportReason === opt.value && (
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                                                )}
                                            </div>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={reportDetails}
                                    onChange={e => setReportDetails(e.target.value)}
                                    placeholder="Détails supplémentaires (optionnel)..."
                                    rows={3}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'white', fontSize: '0.84rem', resize: 'vertical',
                                        outline: 'none', fontFamily: 'inherit', marginBottom: '1rem',
                                    }}
                                />

                                <button
                                    onClick={handleReport}
                                    disabled={!reportReason || reportSending}
                                    style={{
                                        width: '100%', padding: '11px', borderRadius: '10px',
                                        background: reportReason ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${reportReason ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                        color: reportReason ? '#f59e0b' : 'rgba(255,255,255,0.25)',
                                        fontSize: '0.85rem', fontWeight: 700,
                                        cursor: reportReason ? 'pointer' : 'default',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {reportSending ? 'Envoi...' : 'Envoyer le signalement'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
