'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Bell, LogOut, User as UserIcon, Settings, ChevronDown, LayoutDashboard, Compass, Calendar as CalendarIcon, MessageCircle, Headphones } from 'lucide-react';
import { ConceptAIcon } from '@/components/BrilliPlanLogo';
import { useUI } from '@/context/UIContext';
import { useLiveSession } from '@/context/LiveSessionContext';
import Avatar from './Avatar';
import NavbarLevelRing from './NavbarLevelRing';
import AmbientPlayer from './AmbientPlayer';

export default function Navbar() {
    const { user, loading } = useAuth();
    const { locale, setLocale, t } = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const { isNavbarVisible, isWorking } = useUI();
    const { sessionInfo } = useLiveSession();
    const isSession = pathname?.startsWith('/session');

    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const [unreadMessagesMap, setUnreadMessagesMap] = useState<Record<string, number>>({});
    const [friendRequestCount, setFriendRequestCount] = useState(0);
    const [accountabilityCount, setAccountabilityCount] = useState(0);
    const [showAmbient, setShowAmbient] = useState(false);
    const [ambientCount, setAmbientCount] = useState(0);
    const notifRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const ambientRef = useRef<HTMLDivElement>(null);

    const activeSession = !isSession ? sessionInfo : null;

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'users', user.uid, 'notifications'), orderBy('created_at', 'desc'));
        const unsubNotifs = onSnapshot(q, snap => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        let unsubs: (() => void)[] = [];
        const loadConversations = async () => {
            const q1 = query(collection(db, 'friendships'), where('user1_id', '==', user.uid), where('status', '==', 'accepted'));
            const q2 = query(collection(db, 'friendships'), where('user2_id', '==', user.uid), where('status', '==', 'accepted'));
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const seen = new Set<string>();
            const unique = [...s1.docs, ...s2.docs].filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
            unique.forEach(d => {
                const data = d.data();
                const friendUid = data.user1_id === user.uid ? data.user2_id : data.user1_id;
                const convId = [user.uid, friendUid].sort().join('_');
                const msgQ = query(collection(db, 'direct_messages', convId, 'messages'), where('sender_id', '==', friendUid), where('read', '==', false));
                unsubs.push(onSnapshot(msgQ, snap => { setUnreadMessagesMap(prev => ({ ...prev, [convId]: snap.size })); }));
            });
        };
        loadConversations();
        return () => { unsubNotifs(); unsubs.forEach(u => u()); };
    }, [user]);

    useEffect(() => {
        if (!user) { setUserData(null); return; }
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) setUserData(docSnap.data());
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user) { setFriendRequestCount(0); setAccountabilityCount(0); return; }
        const unsubFriends = onSnapshot(query(collection(db, 'friendships'), where('user2_id', '==', user.uid), where('status', '==', 'pending')), snap => setFriendRequestCount(snap.size));
        const unsubAcc = onSnapshot(query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid), where('status', '==', 'pending')), snap => setAccountabilityCount(snap.size));
        return () => { unsubFriends(); unsubAcc(); };
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifs(false);
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false);
            if (ambientRef.current && !ambientRef.current.contains(event.target as Node)) setShowAmbient(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        const onAmbient = (e: Event) => setAmbientCount((e as CustomEvent).detail.count);
        window.addEventListener('brilliplan-ambient-change', onAmbient);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('brilliplan-ambient-change', onAmbient);
        };
    }, []);

    const SHOWN_TYPES = ['session_add', 'session_update', 'friend_request', 'friend_accept', 'accountability_invite', 'accountability_accepted', 'accountability_nudge', 'project_invite', 'teammate_application', 'teammate_accepted', 'teammate_declined', 'teammate_message'];
    const visibleNotifications = notifications.filter((n: any) => SHOWN_TYPES.includes(n.type));
    const unreadCount = visibleNotifications.filter((n: any) => !n.read).length;
    const totalUnreadMessages = Object.values(unreadMessagesMap).reduce((a, b) => a + b, 0);

    const notifLink = (n: any): string => {
        if (n.link) return n.link;
        if (n.type === 'friend_request' || n.type === 'friend_accept') return '/friends';
        if (n.type === 'session_add' || n.type === 'session_update') return '/calendar';
        if (n.type === 'project_invite' && n.project_id) return `/project/${n.project_id}`;
        return '/dashboard';
    };
    const notifIcon = (type: string) => {
        if (type === 'friend_request' || type === 'friend_accept') return '👥';
        if (type === 'session_add' || type === 'session_update') return '📅';
        if (type === 'accountability_invite' || type === 'accountability_accepted') return '🤝';
        if (type === 'accountability_nudge') return '💪';
        if (type === 'project_invite') return '🚀';
        if (type === 'teammate_application') return '🙋';
        if (type === 'teammate_accepted') return '🎉';
        if (type === 'teammate_declined') return '😔';
        if (type === 'teammate_message') return '💬';
        return '🔔';
    };

    const handleAcceptProjectInvite = async (n: any) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'project_memberships', `${user.uid}_${n.project_id}`), { user_id: user.uid, project_id: n.project_id, role: n.role || 'member', joined_at: new Date().toISOString() });
            await updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true, accepted: true });
            router.push(`/project/${n.project_id}`); setShowNotifs(false);
        } catch (err) { console.error(err); }
    };
    const handleDeclineProjectInvite = async (n: any) => {
        if (!user) return;
        try { await deleteDoc(doc(db, 'users', user.uid, 'notifications', n.id)); }
        catch (err) { console.error(err); }
    };
    const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));
    const handleMarkAllRead = async () => {
        if (!user) return;
        for (const n of notifications.filter((n: any) => !n.read))
            await updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
    };
    const handleLogout = async () => { await signOut(auth); router.push('/'); };

    if (!isNavbarVisible) return null;

    const NAV_LINKS = [
        { href: '/dashboard',      label: t('nav_dashboard'),  badge: 0 },
        { href: '/explore',        label: t('nav_explore'),    badge: 0 },
        { href: '/find-teammates', label: t('nav_find_teammates'), badge: 0 },
        { href: '/calendar',       label: 'Agenda',            badge: 0 },
        { href: '/friends',        label: t('nav_friends'),    badge: friendRequestCount },
        { href: '/accountability', label: 'Pactes',            badge: accountabilityCount },
        { href: '/messages',       label: t('nav_messages'),   badge: totalUnreadMessages },
    ];

    const MOBILE_LINKS = [
        { href: '/dashboard',      label: t('nav_dashboard'),  Icon: LayoutDashboard },
        { href: '/explore',        label: t('nav_explore'),    Icon: Compass },
        { href: '/calendar',       label: 'Agenda',            Icon: CalendarIcon },
        { href: '/messages',       label: t('nav_messages'),   Icon: MessageCircle, badge: totalUnreadMessages },
    ];

    return (
        <>
            <style>{`
                @keyframes nb-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.5)} 50%{box-shadow:0 0 0 4px rgba(74,222,128,0)} }
                @keyframes nb-in      { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
                @keyframes nb-dot     { 0%,100%{opacity:1} 50%{opacity:.4} }
                @keyframes nb-amb-bar  { from{height:2px} to{height:7px} }
                @keyframes nb-amb-ring {
                    0%   { transform: scale(0.6); opacity: 0.7; }
                    100% { transform: scale(1.9); opacity: 0; }
                }
                @keyframes nb-amb-glow {
                    0%,100% { box-shadow: 0 0 0 0 rgba(200,169,96,0); }
                    50%     { box-shadow: 0 0 10px 2px rgba(200,169,96,0.25); }
                }

                .nb-navlink {
                    position: relative;
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: .79rem;
                    font-weight: 500;
                    letter-spacing: -.01em;
                    text-decoration: none;
                    white-space: nowrap;
                    transition: color .2s, background .2s;
                    color: rgba(237,233,227,.32);
                }
                .nb-navlink:hover { color: rgba(237,233,227,.7) !important; background: rgba(237,233,227,.03) !important; }
                .nb-navlink.active {
                    color: #c8a960 !important;
                    background: rgba(200,169,96,.06) !important;
                    font-weight: 600;
                }
                .nb-navlink.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0; left: 50%;
                    transform: translateX(-50%);
                    width: 16px; height: 2px;
                    border-radius: 2px;
                    background: #c8a960;
                    box-shadow: 0 0 8px rgba(200,169,96,.5);
                }

                .nb-icon { width:32px;height:32px;border-radius:8px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(237,233,227,.3);transition:color .15s,background .15s; }
                .nb-icon:hover { color:rgba(237,233,227,.75); background:rgba(237,233,227,.04); }

                .nb-mobile-bar {
                    display: none;
                    position: fixed; bottom: 0; left: 0; right: 0;
                    z-index: 100;
                    background: rgba(11,11,13,.97);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-top: 1px solid rgba(237,233,227,.06);
                    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
                    justify-content: space-around;
                }
                .nb-mobile-link {
                    display: flex; flex-direction: column; align-items: center; gap: 2px;
                    padding: 4px 8px; border-radius: 10px;
                    text-decoration: none; color: rgba(237,233,227,.3);
                    font-size: .6rem; font-weight: 600; transition: color .15s;
                    position: relative;
                }
                .nb-mobile-link.active { color: #c8a960; }
                .nb-mobile-link.active::after {
                    content: ''; position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
                    width: 16px; height: 2px; border-radius: 2px;
                    background: #c8a960;
                }
                .nb-mobile-badge {
                    position: absolute; top: 0; right: 0;
                    min-width: 14px; height: 14px; border-radius: 7px;
                    background: #c8a960; color: #0b0b0d;
                    font-size: .5rem; font-weight: 800;
                    display: flex; align-items: center; justify-content: center;
                    padding: 0 3px;
                }
                @media (max-width: 640px) {
                    .nb-mobile-bar { display: flex; }
                }

                .nb-panel {
                    animation: nb-in .2s cubic-bezier(.16,1,.3,1);
                    position: absolute; right: 0; top: calc(100% + 12px);
                    background: rgba(19,19,22,.97);
                    border: 1px solid rgba(237,233,227,.07);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 8px rgba(0,0,0,.15), 0 20px 56px rgba(0,0,0,.65), inset 0 1px 0 rgba(237,233,227,.04);
                    z-index: 300;
                }
                .nb-panel-row { display:flex;align-items:flex-start;gap:10px;padding:11px 14px;font-size:.8rem;color:rgba(237,233,227,.45);cursor:pointer;transition:background .12s,color .12s;text-decoration:none; }
                .nb-panel-row:hover { background:rgba(237,233,227,.03); color:rgba(237,233,227,.8); }
                .nb-sep { height:1px; background:rgba(237,233,227,.05); margin:0; }
            `}</style>

            {/* ── Navbar — clean full-width bar ── */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                <nav style={{
                    pointerEvents: 'auto',
                    width: '100%',
                    display: 'flex', alignItems: 'center',
                    height: '56px',
                    background: '#0b0b0d',
                    borderBottom: 'none',
                    padding: '0 24px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1280px', margin: '0 auto', gap: 0 }}>

                        {/* ══ LOGO ══ */}
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '0 12px 0 0', flexShrink: 0 }}>
                            <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <ConceptAIcon size={26} />
                                {isWorking && (
                                    <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: '#4ade80', border: '1.5px solid rgba(11,11,13,.88)', animation: 'nb-pulse 2s infinite' }} />
                                )}
                            </div>
                            <span style={{
                                fontFamily: 'var(--font-display)', fontSize: '.95rem', fontWeight: 800, letterSpacing: '-0.04em',
                                color: '#ede9e3',
                            }}>
                                BrilliPlan
                            </span>
                            {isWorking && (
                                <span style={{ fontSize: '.55rem', fontWeight: 700, color: '#4ade80', letterSpacing: '.06em', opacity: .9, textTransform: 'uppercase' }}>Focus</span>
                            )}
                        </Link>

                        {/* Separator */}
                        <div style={{ width: 1, height: 18, background: 'rgba(237,233,227,.06)', flexShrink: 0, marginRight: 12 }} />

                        {/* ══ NAV LINKS ══ */}
                        <div className="nb-nav-links" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                            {!loading && user && NAV_LINKS.map(({ href, label, badge }) => {
                                const active = isActive(href);
                                return (
                                    <Link key={href} href={href} className={`nb-navlink${active ? ' active' : ''}`}>
                                        {label}
                                        {badge > 0 && (
                                            <span style={{ minWidth: 15, height: 15, borderRadius: 8, background: '#c8a960', color: '#0b0b0d', fontSize: '.55rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1, flexShrink: 0 }}>
                                                {badge > 9 ? '9+' : badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Separator */}
                        <div style={{ width: 1, height: 18, background: 'rgba(237,233,227,.06)', flexShrink: 0, marginLeft: 12 }} />

                        {/* ══ RIGHT ACTIONS ══ */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '10px', flexShrink: 0 }}>

                            {/* Ambient player */}
                            {user && (
                                <div ref={ambientRef} style={{ position: 'relative' }}>
                                    <button
                                        className="nb-icon"
                                        onClick={() => setShowAmbient(v => !v)}
                                        title="Ambiance sonore"
                                        style={{ position: 'relative', color: ambientCount > 0 ? '#c8a960' : undefined }}
                                    >
                                        <Headphones size={15} />
                                        {ambientCount > 0 && (
                                            <span style={{
                                                position: 'absolute', top: 6, right: 6,
                                                width: 5, height: 5, borderRadius: '50%',
                                                background: '#c8a960',
                                                boxShadow: '0 0 5px rgba(200,169,96,0.7)',
                                                animation: 'nb-dot 2s ease-in-out infinite',
                                            }} />
                                        )}
                                    </button>
                                    <div style={{
                                        position: 'absolute', right: 0, top: 'calc(100% + 12px)',
                                        width: 300, zIndex: 300,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 8px rgba(0,0,0,.15), 0 20px 56px rgba(0,0,0,.65)',
                                        visibility: showAmbient ? 'visible' : 'hidden',
                                        opacity: showAmbient ? 1 : 0,
                                        pointerEvents: showAmbient ? 'auto' : 'none',
                                        transform: showAmbient ? 'translateY(0)' : 'translateY(-6px)',
                                        transition: 'opacity .2s, transform .2s, visibility .2s',
                                    }}>
                                        <AmbientPlayer compact={false} />
                                    </div>
                                </div>
                            )}

                            {/* Language */}
                            <button
                                onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                                className="nb-icon"
                                style={{ width: 'auto', padding: '0 8px', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.03em', gap: 4 }}
                                title="Changer de langue"
                            >
                                {locale === 'fr' ? '🇫🇷' : '🇬🇧'}
                            </button>

                            {!loading && (
                                <>
                                    {user ? (
                                        <>
                                            {/* Level ring */}
                                            <NavbarLevelRing />

                                            {/* Bell */}
                                            <div ref={notifRef} style={{ position: 'relative' }}>
                                                <button
                                                    className="nb-icon"
                                                    onClick={() => { setShowNotifs(v => !v); if (!showNotifs) handleMarkAllRead(); }}
                                                    style={{ position: 'relative' }}
                                                >
                                                    <Bell size={15} />
                                                    {unreadCount > 0 && (
                                                        <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: '#c8a960', border: '1.5px solid rgba(11,11,13,.88)', boxShadow: '0 0 5px rgba(200,169,96,.6)' }} />
                                                    )}
                                                </button>

                                                {showNotifs && (
                                                    <div className="nb-panel" style={{ width: 348, maxHeight: 440, overflowY: 'auto' }}>
                                                        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.88rem', color: '#ede9e3' }}>Notifications</span>
                                                            {unreadCount > 0 && (
                                                                <span style={{ fontSize: '.67rem', color: 'rgba(237,233,227,.25)', fontWeight: 500 }}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</span>
                                                            )}
                                                        </div>
                                                        <div className="nb-sep" />

                                                        {visibleNotifications.length === 0 ? (
                                                            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'rgba(237,233,227,.18)', fontSize: '.8rem' }}>
                                                                <Bell size={22} style={{ margin: '0 auto 10px', opacity: .3 }} />
                                                                {t('nav_no_notifs')}
                                                            </div>
                                                        ) : (
                                                            visibleNotifications.slice(0, 15).map((n: any) => (
                                                                <div key={n.id} className="nb-panel-row"
                                                                    style={{ background: !n.read ? 'rgba(200,169,96,.04)' : 'transparent', cursor: n.type === 'project_invite' ? 'default' : 'pointer', display: 'block' }}
                                                                    onClick={n.type !== 'project_invite' ? () => { router.push(notifLink(n)); setShowNotifs(false); } : undefined}
                                                                >
                                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                                        <span style={{ fontSize: '.95rem', flexShrink: 0, marginTop: 1 }}>{notifIcon(n.type)}</span>
                                                                        <div>
                                                                            <p style={{ margin: 0, fontSize: '.79rem', lineHeight: 1.45, color: n.read ? 'rgba(237,233,227,.38)' : 'rgba(237,233,227,.78)' }}>{n.message}</p>
                                                                            <p style={{ margin: '3px 0 0', fontSize: '.67rem', color: 'rgba(237,233,227,.18)' }}>
                                                                                {n.created_at?.toDate ? n.created_at.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    {n.type === 'project_invite' && !n.accepted && (
                                                                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                                                            <button onClick={e => { e.stopPropagation(); handleAcceptProjectInvite(n); }}
                                                                                style={{ flex: 1, padding: '6px 0', borderRadius: '8px', fontWeight: 700, fontSize: '.73rem', cursor: 'pointer', background: 'rgba(200,169,96,.8)', color: '#0b0b0d', border: '1px solid rgba(200,169,96,.4)', transition: 'background .15s' }}
                                                                                onMouseEnter={e => e.currentTarget.style.background = '#c8a960'}
                                                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(200,169,96,.8)'}
                                                                            >Rejoindre</button>
                                                                            <button onClick={e => { e.stopPropagation(); handleDeclineProjectInvite(n); }}
                                                                                style={{ flex: 1, padding: '6px 0', borderRadius: '8px', fontWeight: 700, fontSize: '.73rem', cursor: 'pointer', background: 'rgba(248,113,113,.06)', color: '#fca5a5', border: '1px solid rgba(248,113,113,.15)', transition: 'background .15s' }}
                                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,.12)'}
                                                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,.06)'}
                                                                            >Décliner</button>
                                                                        </div>
                                                                    )}
                                                                    {n.type === 'project_invite' && n.accepted && (
                                                                        <p style={{ margin: '8px 0 0', fontSize: '.7rem', color: '#4ade80', fontWeight: 600 }}>Invitation acceptée</p>
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* User menu */}
                                            <div ref={userMenuRef} style={{ position: 'relative', paddingRight: 4 }}>
                                                <button
                                                    onClick={() => setShowUserMenu(v => !v)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: showUserMenu ? 'rgba(237,233,227,.04)' : 'transparent', border: 'none', borderRadius: '10px', padding: '3px 4px 3px 3px', cursor: 'pointer', transition: 'background .15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,233,227,.04)'}
                                                    onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <div style={{ borderRadius: '50%', padding: '1.5px', background: showUserMenu ? '#c8a960' : 'rgba(237,233,227,.12)', transition: 'background .2s' }}>
                                                        <div style={{ borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(11,11,13,.88)' }}>
                                                            <Avatar uid={user?.uid} avatarUrl={userData?.avatar_url} avatarStyle={userData?.avatar_style} size={30} />
                                                        </div>
                                                    </div>
                                                    <ChevronDown size={11} style={{ color: 'rgba(237,233,227,.25)', transition: 'transform .2s', transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0)' }} />
                                                </button>

                                                {showUserMenu && (
                                                    <div className="nb-panel" style={{ width: 220 }}>
                                                        <div style={{ padding: '14px 16px', display: 'flex', gap: '11px', alignItems: 'center' }}>
                                                            <div style={{ borderRadius: '50%', padding: '1.5px', background: '#c8a960', flexShrink: 0 }}>
                                                                <div style={{ borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(19,19,22,.97)' }}>
                                                                    <Avatar uid={user?.uid} avatarUrl={userData?.avatar_url} avatarStyle={userData?.avatar_style} size={32} />
                                                                </div>
                                                            </div>
                                                            <div style={{ minWidth: 0 }}>
                                                                <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.82rem', color: '#ede9e3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userData?.full_name || 'Utilisateur'}</p>
                                                                <p style={{ margin: 0, fontSize: '.67rem', color: 'rgba(237,233,227,.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{user.email}</p>
                                                            </div>
                                                        </div>

                                                        <div className="nb-sep" />

                                                        <div style={{ padding: '6px' }}>
                                                            <Link href="/profile" onClick={() => setShowUserMenu(false)} className="nb-panel-row" style={{ borderRadius: '10px', gap: 9, display: 'flex', alignItems: 'center' }}>
                                                                <UserIcon size={13} style={{ color: 'rgba(237,233,227,.25)', flexShrink: 0 }} /> {t('nav_profile')}
                                                            </Link>
                                                        </div>

                                                        <div className="nb-sep" />

                                                        <div style={{ padding: '6px' }}>
                                                            <button
                                                                onClick={() => { setShowUserMenu(false); handleLogout(); }}
                                                                className="nb-panel-row"
                                                                style={{ borderRadius: '10px', width: '100%', background: 'transparent', border: 'none', color: '#f87171', gap: 9, display: 'flex', alignItems: 'center' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,.05)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <LogOut size={13} style={{ color: '#f87171', flexShrink: 0, opacity: .6 }} /> {t('nav_logout')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '6px', paddingRight: 4 }}>
                                            <Link href="/login"
                                                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(237,233,227,.08)', background: 'transparent', color: 'rgba(237,233,227,.5)', fontSize: '.78rem', fontWeight: 500, textDecoration: 'none', transition: 'all .15s' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(237,233,227,.04)'; e.currentTarget.style.color = '#ede9e3'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(237,233,227,.5)'; }}
                                            >{t('nav_login')}</Link>
                                            <Link href="/register"
                                                style={{ padding: '6px 14px', borderRadius: '8px', background: '#c8a960', color: '#0b0b0d', fontSize: '.78rem', fontWeight: 700, textDecoration: 'none', transition: 'all .15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#d4b872'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#c8a960'}
                                            >{t('nav_register')}</Link>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </nav>
            </div>

            {/* ── Mobile bottom nav ── */}
            {!loading && user && !isSession && (
                <nav className="nb-mobile-bar">
                    {MOBILE_LINKS.map(({ href, label, Icon, badge }) => {
                        const active = isActive(href);
                        return (
                            <Link key={href} href={href} className={`nb-mobile-link${active ? ' active' : ''}`}>
                                <Icon size={18} />
                                <span>{label}</span>
                                {(badge ?? 0) > 0 && <span className="nb-mobile-badge">{badge}</span>}
                            </Link>
                        );
                    })}
                </nav>
            )}
        </>
    );
}
