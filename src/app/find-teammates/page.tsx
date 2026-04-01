'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, getDoc, doc, addDoc, setDoc,
    onSnapshot, orderBy, Timestamp, deleteDoc, updateDoc
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import {
    Search, Users, Briefcase, Palette, Code, PenTool, BarChart3,
    Megaphone, Music, Dumbbell, BookOpen, FlaskConical, X, Plus,
    ChevronDown, ChevronRight, Sparkles, Send, Check, Clock,
    MapPin, Star, Filter, Layers, UserPlus, Heart, ArrowRight,
    Lightbulb, Rocket, Globe, Eye, MessageCircle, Zap, CheckCircle2, XCircle
} from 'lucide-react';
import { ROLE_PRESETS, getRolePreset } from '@/lib/rolePresets';
import { useBlock } from '@/context/BlockContext';

/* ─── Types ─── */
interface TeammateRequest {
    id: string;
    type: 'objective' | 'project';
    target_id: string;
    target_title: string;
    creator_id: string;
    creator_name: string;
    description: string;
    roles: { key: string; custom_label?: string; spots: number }[];
    skills: string[];
    categories: string[];
    status: 'open' | 'closed';
    created_at: any;
    applicants?: { user_id: string; role: string; custom_label?: string | null; message: string; status: string; applied_at: any }[];
}

export default function FindTeammates() {
    const { user } = useAuth();
    const { t, locale } = useLocale();
    const router = useRouter();
    const { isBlocked } = useBlock();

    const [requests, setRequests] = useState<TeammateRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeRole, setActiveRole] = useState('all');
    const [activeType, setActiveType] = useState<'all' | 'objective' | 'project' | 'my_ads' | 'my_applications'>('all');
    const [creatorData, setCreatorData] = useState<Record<string, any>>({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [applyingTo, setApplyingTo] = useState<string | null>(null);
    const [applyRole, setApplyRole] = useState('');
    const [applyCustomRole, setApplyCustomRole] = useState('');
    const [applyMessage, setApplyMessage] = useState('');
    const [sendingApplication, setSendingApplication] = useState(false);
    const [appliedSet, setAppliedSet] = useState<Set<string>>(new Set());
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    // Create modal state
    const [userObjectives, setUserObjectives] = useState<any[]>([]);
    const [userProjects, setUserProjects] = useState<any[]>([]);
    const [createType, setCreateType] = useState<'objective' | 'project'>('project');
    const [createTargetId, setCreateTargetId] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createRoles, setCreateRoles] = useState<{ key: string; custom_label?: string; spots: number }[]>([{ key: 'developer', spots: 1 }]);
    const [createSkills, setCreateSkills] = useState('');
    const [creating, setCreating] = useState(false);

    // Fetch all open requests
    useEffect(() => {
        const q = query(collection(db, 'teammate_requests'), orderBy('created_at', 'desc'));
        const unsub = onSnapshot(q, async (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as TeammateRequest[];
            setRequests(items);

            // Fetch creator data
            const uids = Array.from(new Set(items.map(i => i.creator_id)));
            const newData: Record<string, any> = {};
            await Promise.all(uids.map(async uid => {
                if (!creatorData[uid]) {
                    const snap = await getDoc(doc(db, 'users', uid));
                    if (snap.exists()) newData[uid] = snap.data();
                }
            }));
            if (Object.keys(newData).length > 0) {
                setCreatorData(prev => ({ ...prev, ...newData }));
            }

            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Track what user already applied to
    useEffect(() => {
        if (!user) return;
        const applied = new Set<string>();
        requests.forEach(r => {
            if (r.applicants?.some(a => a.user_id === user.uid)) {
                applied.add(r.id);
            }
        });
        setAppliedSet(applied);
    }, [requests, user]);

    // Fetch user's objectives & projects for the create modal
    useEffect(() => {
        if (!user) return;
        const fetchOwned = async () => {
            // Objectives where user is creator
            const objQ = query(collection(db, 'objectives'), where('creator_id', '==', user.uid));
            const objSnap = await getDocs(objQ);
            setUserObjectives(objSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // Projects where user is admin
            const pmQ = query(collection(db, 'project_memberships'), where('user_id', '==', user.uid), where('role', '==', 'admin'));
            const pmSnap = await getDocs(pmQ);
            const projectIds = pmSnap.docs.map(d => d.data().project_id);
            if (projectIds.length > 0) {
                const projDocs = await Promise.all(projectIds.map(id => getDoc(doc(db, 'projects', id))));
                setUserProjects(projDocs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
            }
        };
        fetchOwned();
    }, [user]);

    // Filter logic
    const filtered = useMemo(() => {
        return requests.filter(r => {
            if (isBlocked(r.creator_id)) return false;
            const isVisible = r.status === 'open' || (user && (r.creator_id === user.uid || r.applicants?.some(a => a.user_id === user.uid)));
            if (!isVisible) return false;

            const matchType = activeType === 'all' ? true :
                              activeType === 'my_ads' ? r.creator_id === user?.uid :
                              activeType === 'my_applications' ? r.applicants?.some(a => a.user_id === user?.uid) :
                              r.type === activeType;
            const matchRole = activeRole === 'all' || r.roles.some(role => role.key === activeRole);
            const searchLower = search.trim().toLowerCase();
            const matchSearch = !searchLower ||
                r.target_title?.toLowerCase().includes(searchLower) ||
                r.description?.toLowerCase().includes(searchLower) ||
                r.roles.some(role => {
                    const preset = getRolePreset(role.key);
                    return preset.label.toLowerCase().includes(searchLower) ||
                           preset.labelEn.toLowerCase().includes(searchLower) ||
                           role.custom_label?.toLowerCase().includes(searchLower);
                });
            return matchType && matchRole && matchSearch;
        });
    }, [requests, activeType, activeRole, search, user]);

    // Handle application
    const handleApply = async (requestId: string) => {
        if (!user || !applyRole) return;
        setSendingApplication(true);
        try {
            const requestRef = doc(db, 'teammate_requests', requestId);
            const snap = await getDoc(requestRef);
            if (!snap.exists()) return;
            const data = snap.data();
            const existing = data.applicants || [];

            // Get user name
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userName = userSnap.exists() ? userSnap.data().full_name : 'Utilisateur';

            existing.push({
                user_id: user.uid,
                role: applyRole,
                custom_label: applyRole === 'other' ? applyCustomRole.trim() : null,
                message: applyMessage,
                status: 'pending',
                applied_at: Timestamp.now()
            });
            await updateDoc(requestRef, { applicants: existing });

            const roleLabel = (applyRole === 'other' && applyCustomRole.trim())
                ? applyCustomRole.trim()
                : (locale === 'fr' ? getRolePreset(applyRole).label : getRolePreset(applyRole).labelEn);

            // Send notification to creator
            await addDoc(collection(db, 'users', data.creator_id, 'notifications'), {
                type: 'teammate_application',
                message: locale === 'fr'
                    ? `${userName} souhaite rejoindre "${data.target_title}" en tant que ${roleLabel}`
                    : `${userName} wants to join "${data.target_title}" as ${roleLabel}`,
                link: `/${data.type === 'objective' ? 'objective' : 'project'}/${data.target_id}`,
                read: false,
                created_at: Timestamp.now()
            });

            setAppliedSet(prev => new Set(prev).add(requestId));
            setApplyingTo(null);
            setApplyRole('');
            setApplyCustomRole('');
            setApplyMessage('');
        } catch (err) {
            console.error('Error applying:', err);
        } finally {
            setSendingApplication(false);
        }
    };

    // Handle create new request
    const handleCreate = async () => {
        if (!user || !createTargetId || !createDescription) return;
        setCreating(true);
        try {
            const targets = createType === 'objective' ? userObjectives : userProjects;
            const target = targets.find(t => t.id === createTargetId);
            if (!target) return;

            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userName = userSnap.exists() ? userSnap.data().full_name : 'Utilisateur';

            await addDoc(collection(db, 'teammate_requests'), {
                type: createType,
                target_id: createTargetId,
                target_title: target.title,
                creator_id: user.uid,
                creator_name: userName,
                description: createDescription,
                roles: createRoles.filter(r => r.spots > 0),
                skills: createSkills.split(',').map(s => s.trim()).filter(Boolean),
                categories: Array.isArray(target.category) ? target.category : [target.category].filter(Boolean),
                status: 'open',
                applicants: [],
                created_at: Timestamp.now()
            });

            setShowCreateModal(false);
            setCreateDescription('');
            setCreateRoles([{ key: 'developer', spots: 1 }]);
            setCreateSkills('');
            setCreateTargetId('');
        } catch (err) {
            console.error('Error creating request:', err);
        } finally {
            setCreating(false);
        }
    };

    const isFr = locale === 'fr';

    return (
        <div style={{ minHeight: '100vh' }}>
            <style>{`
                /* fonts loaded via next/font */

                @keyframes ft-shimmer { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
                @keyframes ft-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes ft-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
                @keyframes ft-glow { 0%, 100% { box-shadow: 0 0 20px rgba(251,146,60,.15); } 50% { box-shadow: 0 0 40px rgba(251,146,60,.25); } }
                @keyframes ft-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                @keyframes ft-slide-up { from { opacity: 0; transform: translateY(24px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes ft-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

                .ft-page { font-family: var(--font-display), 'Figtree', sans-serif; }
                .ft-card {
                    animation: ft-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
                    transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease;
                }
                .ft-card:hover {
                    transform: translateY(-6px);
                    box-shadow: 0 20px 60px -12px rgba(251,146,60,.12), 0 0 0 1px rgba(251,146,60,.1);
                }
                .ft-skel { position: relative; overflow: hidden; background: rgba(255,255,255,0.02); border-radius: 20px; }
                .ft-skel::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%); animation: ft-shimmer 1.5s ease infinite; }
                .ft-chip { transition: all 0.18s cubic-bezier(0.22,1,0.36,1) !important; cursor: pointer; }
                .ft-chip:hover { transform: translateY(-1px); }
                .ft-role-pill { transition: all 0.15s ease; }
                .ft-role-pill:hover { transform: scale(1.04); }
                .ft-apply-btn {
                    transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
                    position: relative;
                    overflow: hidden;
                }
                .ft-apply-btn::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .ft-apply-btn:hover::before { opacity: 1; }
                .ft-apply-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px -4px rgba(251,146,60,.35); }
                .ft-modal-overlay {
                    position: fixed; inset: 0; z-index: 200;
                    background: rgba(0,0,0,.7);
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center;
                    animation: ft-in 0.2s ease;
                }
                .ft-modal {
                    animation: ft-slide-up 0.35s cubic-bezier(0.22,1,0.36,1);
                    width: 560px; max-width: 92vw; max-height: 85vh; overflow-y: auto;
                    background: #111114;
                    border: 1px solid rgba(255,255,255,.08);
                    border-radius: 24px;
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05);
                }
                .ft-input {
                    width: 100%; padding: 10px 14px;
                    background: rgba(255,255,255,.03);
                    border: 1px solid rgba(255,255,255,.08);
                    border-radius: 12px; color: #f4f4f5;
                    font-family: var(--font-display), 'Figtree', sans-serif;
                    font-size: 0.85rem;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .ft-input:focus {
                    border-color: rgba(251,146,60,.4);
                    box-shadow: 0 0 0 3px rgba(251,146,60,.08);
                }
                .ft-input::placeholder { color: rgba(255,255,255,.2); }
                .ft-select {
                    width: 100%; padding: 10px 14px;
                    background: rgba(255,255,255,.03);
                    border: 1px solid rgba(255,255,255,.08);
                    border-radius: 12px; color: #f4f4f5;
                    font-family: var(--font-display), 'Figtree', sans-serif;
                    font-size: 0.85rem;
                    outline: none;
                    appearance: none;
                    cursor: pointer;
                    transition: border-color 0.2s;
                }
                .ft-select:focus { border-color: rgba(251,146,60,.4); }
            `}</style>

            <div className="ft-page">
                {/* ── Hero Section ── */}
                <div className="fade-enter" style={{ padding: '4.5rem 1.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    {/* Background effects */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'radial-gradient(ellipse 70% 50% at 30% 0%, rgba(251,146,60,.06) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 70% 10%, rgba(244,114,182,.05) 0%, transparent 60%)'
                    }} />
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,146,60,.08) 1px, transparent 0)',
                        backgroundSize: '40px 40px',
                        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 30%, transparent 80%)'
                    }} />

                    <div style={{ position: 'relative' }}>
                        {/* Badge */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '4px 14px',
                            background: 'linear-gradient(135deg, rgba(251,146,60,.08), rgba(244,114,182,.06))',
                            border: '1px solid rgba(251,146,60,.18)',
                            borderRadius: '100px',
                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                            color: '#fb923c', marginBottom: '1.3rem'
                        }}>
                            <Users size={10} /> {isFr ? 'Trouver des coéquipiers' : 'Find Teammates'}
                        </div>

                        {/* Title */}
                        <h1 style={{
                            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                            fontWeight: 900,
                            letterSpacing: '-0.045em',
                            lineHeight: 1.05,
                            marginBottom: '0.9rem',
                            fontFamily: "var(--font-display), sans-serif"
                        }}>
                            <span style={{
                                background: 'linear-gradient(135deg, #fb923c 0%, #7df4de 50%, #c084fc 100%)',
                                backgroundSize: '200% 200%',
                                animation: 'ft-gradient 6s ease infinite',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                {isFr ? 'Recrutez votre équipe' : 'Build Your Dream Team'}
                            </span>
                            <br />
                            <span style={{ color: 'rgba(255,255,255,.85)', WebkitTextFillColor: 'initial' }}>
                                {isFr ? 'de rêve' : ''}
                            </span>
                        </h1>

                        <p style={{ fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 2rem', color: 'rgba(255,255,255,.35)', lineHeight: 1.6, fontWeight: 400 }}>
                            {isFr
                                ? 'Publiez les rôles dont vous avez besoin ou trouvez un projet qui cherche vos compétences. Designers, développeurs, marketeurs — connectez-vous.'
                                : 'Post the roles you need or find a project looking for your skills. Designers, developers, marketers — connect now.'}
                        </p>

                        {/* Search & Filters bar */}
                        <div style={{ display: 'flex', gap: '10px', maxWidth: '640px', margin: '0 auto 1.2rem', alignItems: 'center' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.2)', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    className="ft-input"
                                    style={{
                                        paddingLeft: '2.8rem', paddingRight: search ? '2.5rem' : '1rem',
                                        borderRadius: '16px', height: '52px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,.03)',
                                        border: '1px solid rgba(255,255,255,.07)',
                                    }}
                                    placeholder={isFr ? 'Rechercher un rôle, une compétence, un projet...' : 'Search a role, skill, project...'}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} style={{
                                        position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)',
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer',
                                        color: 'rgba(255,255,255,.5)', fontSize: '0.6rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => setShowFilters(!showFilters)}
                                className="ft-chip"
                                style={{
                                    height: '52px', padding: '0 20px', borderRadius: '16px',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: showFilters ? 'rgba(251,146,60,.1)' : 'rgba(255,255,255,.03)',
                                    border: `1px solid ${showFilters ? 'rgba(251,146,60,.3)' : 'rgba(255,255,255,.07)'}`,
                                    color: showFilters ? '#fb923c' : 'rgba(255,255,255,.5)',
                                    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                    flexShrink: 0
                                }}
                            >
                                <Filter size={16} />
                                {isFr ? 'Filtres' : 'Filters'}
                                {activeRole !== 'all' && (
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c', marginLeft: 2 }} />
                                )}
                            </button>
                        </div>

                        {/* CTA for creating */}
                        {user && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="ft-apply-btn"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                    padding: '10px 22px', borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #fb923c, #f97316)',
                                    border: 'none', color: '#fff',
                                    fontSize: '0.82rem', fontWeight: 700,
                                    cursor: 'pointer', letterSpacing: '-0.01em',
                                    marginBottom: '1rem'
                                }}
                            >
                                <Plus size={14} strokeWidth={3} />
                                {isFr ? 'Publier une annonce' : 'Post a Request'}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Main Content ── */}
                <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 1.5rem 4rem' }}>

                    {/* Type tabs + count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)', paddingBottom: 0 }}>
                            {([
                                { key: 'all',       label: isFr ? 'Tous' : 'All',          count: requests.filter(r => r.status === 'open' || (user && (r.creator_id === user.uid || r.applicants?.some(a => a.user_id === user.uid)))).length, color: '#fb923c' },
                                ...(user ? [
                                    { key: 'my_ads', label: isFr ? 'Mes annonces' : 'My Ads', count: requests.filter(r => r.creator_id === user.uid).length, color: '#7df4de' },
                                    { key: 'my_applications', label: isFr ? 'Mes candidatures' : 'My Applications', count: requests.filter(r => r.applicants?.some(a => a.user_id === user.uid)).length, color: '#0ea5e9' }
                                ] : []),
                                { key: 'project',   label: isFr ? 'Projets' : 'Projects',  count: requests.filter(r => r.type === 'project' && (r.status === 'open' || (user && (r.creator_id === user.uid || r.applicants?.some(a => a.user_id === user.uid))))).length, color: '#10b981' },
                                { key: 'objective', label: isFr ? 'Objectifs' : 'Objectives', count: requests.filter(r => r.type === 'objective' && (r.status === 'open' || (user && (r.creator_id === user.uid || r.applicants?.some(a => a.user_id === user.uid))))).length, color: '#c8a960' },
                            ] as any[]).map(tab => {
                                const isAct = activeType === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveType(tab.key as any)}
                                        style={{
                                            position: 'relative',
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '9px 16px 13px',
                                            fontSize: '0.85rem', fontWeight: isAct ? 700 : 500,
                                            cursor: 'pointer', whiteSpace: 'nowrap',
                                            background: 'transparent',
                                            color: isAct ? '#f4f4f5' : 'rgba(255,255,255,.3)',
                                            border: 'none', transition: 'all 0.2s'
                                        }}
                                    >
                                        {tab.label}
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                                            background: isAct ? tab.color + '1e' : 'rgba(255,255,255,.05)',
                                            color: isAct ? tab.color : 'rgba(255,255,255,.22)'
                                        }}>{tab.count}</span>
                                        {isAct && <span style={{
                                            position: 'absolute', bottom: -1, left: 14, right: 14, height: '2px',
                                            background: `linear-gradient(90deg, ${tab.color}, ${tab.color}60)`,
                                            borderRadius: '2px 2px 0 0',
                                            boxShadow: `0 0 8px ${tab.color}50`
                                        }} />}
                                    </button>
                                );
                            })}
                        </div>

                        {!loading && filtered.length > 0 && (
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,.25)', fontWeight: 500 }}>
                                <Layers size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                {filtered.length} {isFr ? 'annonce' : 'request'}{filtered.length > 1 ? 's' : ''}
                            </p>
                        )}
                    </div>

                    {/* Role filter chips & Reset */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.8rem', alignItems: 'center' }}>
                        {showFilters && (
                            <>
                                <button
                                    onClick={() => setActiveRole('all')}
                                    className="ft-chip"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        padding: '5px 13px', borderRadius: 30,
                                        fontSize: '0.72rem', fontWeight: activeRole === 'all' ? 700 : 500,
                                        border: activeRole === 'all' ? '1px solid rgba(251,146,60,.4)' : '1px solid rgba(255,255,255,.08)',
                                        background: activeRole === 'all' ? 'rgba(251,146,60,.1)' : 'transparent',
                                        color: activeRole === 'all' ? '#fb923c' : 'rgba(255,255,255,.35)',
                                        boxShadow: activeRole === 'all' ? '0 0 12px rgba(251,146,60,.1)' : 'none'
                                    }}
                                >
                                    <Globe size={11} /> {isFr ? 'Tous les rôles' : 'All Roles'}
                                </button>

                                {ROLE_PRESETS.map(role => {
                                    const isActive = activeRole === role.key;
                                    const Icon = role.icon;
                                    const count = requests.filter(r => r.roles.some(rr => rr.key === role.key)).length;
                                    if (count === 0 && !isActive) return null;
                                    return (
                                        <button
                                            key={role.key}
                                            onClick={() => setActiveRole(isActive ? 'all' : role.key)}
                                            className="ft-chip"
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '5px 13px', borderRadius: 30,
                                                fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                                                border: isActive ? `1px solid ${role.color}55` : '1px solid rgba(255,255,255,.08)',
                                                background: isActive ? `${role.color}12` : 'transparent',
                                                color: isActive ? role.color : 'rgba(255,255,255,.35)',
                                                boxShadow: isActive ? `0 0 12px ${role.color}15` : 'none'
                                            }}
                                        >
                                            <Icon size={11} /> {isFr ? role.label : role.labelEn}
                                            <span style={{
                                                fontSize: '0.56rem', fontWeight: 700, padding: '0 5px', borderRadius: 10,
                                                background: isActive ? `${role.color}22` : 'rgba(255,255,255,.06)',
                                                color: isActive ? role.color : 'rgba(255,255,255,.25)'
                                            }}>{count}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {(search || activeRole !== 'all' || activeType !== 'all') && (
                            <button
                                onClick={() => { setSearch(''); setActiveRole('all'); setActiveType('all'); }}
                                className="ft-chip"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '5px 10px', borderRadius: 30,
                                    fontSize: '0.68rem', fontWeight: 600,
                                    border: '1px solid rgba(248,113,113,.2)',
                                    background: 'rgba(248,113,113,.04)',
                                    color: 'rgba(248,113,113,.55)'
                                }}
                            >
                                <X size={9} /> {isFr ? 'Réinitialiser' : 'Reset'}
                            </button>
                        )}
                    </div>

                    {/* ── Cards Grid ── */}
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.2rem' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="ft-skel" style={{ height: '280px', animationDelay: `${i * 0.06}s` }} />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="fade-enter" style={{
                            textAlign: 'center', padding: '5rem 2rem',
                            background: 'rgba(255,255,255,.01)', borderRadius: '20px',
                            border: '1px dashed rgba(255,255,255,.06)'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.25 }}>
                                <UserPlus size={48} strokeWidth={1} />
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,.5)' }}>
                                {isFr ? 'Aucune annonce trouvée' : 'No requests found'}
                            </h3>
                            <p style={{ margin: '0 0 1.5rem', fontSize: '0.87rem', color: 'rgba(255,255,255,.25)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                                {search
                                    ? (isFr ? `Aucun résultat pour "${search}"` : `No results for "${search}"`)
                                    : (isFr ? 'Soyez le premier à publier une annonce de recrutement !' : 'Be the first to post a teammate request!')}
                            </p>
                            {user && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '9px 18px', borderRadius: 12,
                                        background: 'rgba(251,146,60,.12)', border: '1px solid rgba(251,146,60,.2)',
                                        color: '#fb923c', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={13} /> {isFr ? 'Publier une annonce' : 'Post a Request'}
                                </button>
                            )}
                        </div>
                ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.2rem' }}>
                            {filtered.map((req, i) => {
                                const creator = creatorData[req.creator_id];
                                const isExpanded = expandedCard === req.id;
                                const hasApplied = appliedSet.has(req.id);
                                const isOwn = user?.uid === req.creator_id;
                                const totalSpots = req.roles.reduce((a, r) => a + r.spots, 0);
                                const filledSpots = req.applicants?.filter(a => a.status === 'accepted').length || 0;
                                const accentColor = req.type === 'project' ? '#10b981' : '#c8a960';

                                return (
                                    <div
                                        key={req.id}
                                        className="ft-card"
                                        style={{
                                            animationDelay: `${i * 0.05}s`,
                                            borderRadius: '20px',
                                            border: '1px solid rgba(255,255,255,.06)',
                                            background: 'rgba(13,13,18,.95)',
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Top gradient strip */}
                                        <div style={{
                                            height: '3px',
                                            background: `linear-gradient(90deg, #fb923c, ${accentColor}, #fb923c40)`,
                                        }} />

                                        <div style={{ padding: '1.15rem 1.25rem 1rem' }}>
                                            {/* Header: Creator info + type badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                    <div style={{ borderRadius: '50%', padding: '1.5px', background: 'linear-gradient(135deg, #fb923c40, #7df4de40)' }}>
                                                        <Avatar uid={req.creator_id} avatarUrl={creator?.avatar_url} avatarStyle={creator?.avatar_style} size={32} style={{ border: '1.5px solid #0d0d12' }} />
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: '#ddd8d0' }}>
                                                            {req.creator_name}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,.22)', fontWeight: 500 }}>
                                                            <Clock size={9} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                                            {req.created_at?.toDate ? req.created_at.toDate().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px',
                                                    borderRadius: 20,
                                                    background: `${accentColor}10`,
                                                    border: `1px solid ${accentColor}25`,
                                                    color: accentColor,
                                                    letterSpacing: '0.03em', textTransform: 'uppercase' as const
                                                }}>
                                                    {req.type === 'project' ? (isFr ? 'Projet' : 'Project') : (isFr ? 'Objectif' : 'Objective')}
                                                </span>
                                                {req.status === 'closed' && (
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px',
                                                        borderRadius: 20,
                                                        background: 'rgba(255,255,255,.05)',
                                                        border: '1px solid rgba(255,255,255,.1)',
                                                        color: 'rgba(255,255,255,.4)',
                                                        marginLeft: '6px',
                                                        letterSpacing: '0.03em', textTransform: 'uppercase' as const
                                                    }}>
                                                        {isFr ? 'Fermé' : 'Closed'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Project/Objective title */}
                                            <Link
                                                href={`/${req.type === 'objective' ? 'objective' : 'project'}/${req.target_id}`}
                                                style={{ textDecoration: 'none' }}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <h3 style={{
                                                    margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 800,
                                                    color: '#ede9e3', letterSpacing: '-0.025em', lineHeight: 1.2,
                                                    overflow: 'hidden', display: '-webkit-box',
                                                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                                                    transition: 'color 0.15s',
                                                    fontFamily: "var(--font-display), sans-serif"
                                                }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#fb923c')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#ede9e3')}
                                                >
                                                    {req.target_title}
                                                </h3>
                                            </Link>

                                            {/* Description */}
                                            <p style={{
                                                margin: '0 0 0.85rem', fontSize: '0.78rem', color: 'rgba(255,255,255,.32)',
                                                lineHeight: 1.5,
                                                overflow: 'hidden', display: '-webkit-box',
                                                WebkitLineClamp: isExpanded ? 10 : 2,
                                                WebkitBoxOrient: 'vertical' as const,
                                            }}>
                                                {req.description}
                                            </p>

                                            {/* Roles needed */}
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                                                {req.roles.map((role, j) => {
                                                    const preset = getRolePreset(role.key);
                                                    const Icon = preset.icon;
                                                    return (
                                                        <div
                                                            key={j}
                                                            className="ft-role-pill"
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                padding: '4px 10px', borderRadius: 10,
                                                                background: `${preset.color}0c`,
                                                                border: `1px solid ${preset.color}20`,
                                                                fontSize: '0.7rem', fontWeight: 600,
                                                                color: preset.color
                                                            }}
                                                        >
                                                            <Icon size={11} />
                                                            {role.custom_label || (isFr ? preset.label : preset.labelEn)}
                                                            <span style={{
                                                                fontSize: '0.58rem', fontWeight: 700,
                                                                padding: '0 4px', borderRadius: 6,
                                                                background: `${preset.color}18`,
                                                                color: preset.color
                                                            }}>
                                                                ×{role.spots}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Skills tags */}
                                            {req.skills && req.skills.length > 0 && (
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                                                    {req.skills.slice(0, 5).map((skill, j) => (
                                                        <span key={j} style={{
                                                            fontSize: '0.6rem', fontWeight: 600, padding: '2px 7px',
                                                            borderRadius: 6, letterSpacing: '0.02em',
                                                            background: 'rgba(255,255,255,.04)',
                                                            border: '1px solid rgba(255,255,255,.07)',
                                                            color: 'rgba(255,255,255,.4)'
                                                        }}>
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {req.skills.length > 5 && (
                                                        <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,.2)', alignSelf: 'center' }}>
                                                            +{req.skills.length - 5}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Spots bar */}
                                            <div style={{ marginBottom: '0.85rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,.3)' }}>
                                                        {isFr ? 'Places' : 'Spots'}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fb923c' }}>
                                                        {filledSpots}/{totalSpots}
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', height: '4px', borderRadius: 10, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 10,
                                                        width: `${totalSpots > 0 ? Math.min((filledSpots / totalSpots) * 100, 100) : 0}%`,
                                                        background: 'linear-gradient(90deg, #fb923c, #f97316)',
                                                        transition: 'width 0.5s ease',
                                                        boxShadow: filledSpots > 0 ? '0 0 8px rgba(251,146,60,.4)' : 'none'
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Footer: View Detail + Apply */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                                                {(() => {
                                                    const myApp = user ? req.applicants?.find(a => a.user_id === user.uid) : null;
                                                    if (!myApp) return null;
                                                    
                                                    const status = myApp.status;
                                                    let color = '#fbbf24'; // pending
                                                    let bgColor = 'rgba(245,158,11,.1)';
                                                    let borderColor = 'rgba(245,158,11,.2)';
                                                    let Icon = Clock;
                                                    let label = isFr ? 'En attente' : 'Pending';

                                                    if (status === 'accepted') {
                                                        color = '#34d399';
                                                        bgColor = 'rgba(16,185,129,.1)';
                                                        borderColor = 'rgba(16,185,129,.2)';
                                                        Icon = CheckCircle2;
                                                        label = isFr ? 'Accepté' : 'Accepted';
                                                    } else if (status === 'declined') {
                                                        color = '#f87171';
                                                        bgColor = 'rgba(239,68,68,.08)';
                                                        borderColor = 'rgba(239,68,68,.15)';
                                                        Icon = XCircle;
                                                        label = isFr ? 'Refusé' : 'Declined';
                                                    }

                                                    return (
                                                        <span style={{
                                                            fontSize: '0.55rem', fontWeight: 700, padding: '4px 8px',
                                                            borderRadius: 8,
                                                            background: bgColor,
                                                            border: `1px solid ${borderColor}`,
                                                            color: color,
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            letterSpacing: '0.03em', textTransform: 'uppercase' as const
                                                        }}>
                                                            <Icon size={9} /> {label}
                                                        </span>
                                                    );
                                                })()}

                                                {!isOwn && !hasApplied && (
                                                    <Link
                                                        href={`/find-teammates/${req.id}`}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                            padding: '6px 10px', borderRadius: 8,
                                                            background: 'rgba(255,255,255,.03)',
                                                            border: '1px solid rgba(255,255,255,.06)',
                                                            color: 'rgba(255,255,255,.35)', fontSize: '0.7rem', fontWeight: 600,
                                                            textDecoration: 'none', transition: 'all 0.15s',
                                                            flex: 'none'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = 'rgba(255,255,255,.6)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.color = 'rgba(255,255,255,.35)'; }}
                                                    >
                                                        <Eye size={11} /> {isFr ? 'Voir' : 'View'}
                                                    </Link>
                                                )}

                                                <div style={{ flex: 1 }} />

                                                {isOwn ? (
                                                    <Link
                                                        href={`/find-teammates/${req.id}`}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            padding: '7px 14px', borderRadius: 10,
                                                            background: 'rgba(251,146,60,.08)',
                                                            border: '1px solid rgba(251,146,60,.18)',
                                                            color: '#fb923c', fontSize: '0.73rem', fontWeight: 700,
                                                            textDecoration: 'none', transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,146,60,.14)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,146,60,.08)'}
                                                    >
                                                        <Users size={11} /> {isFr ? 'Gérer' : 'Manage'}
                                                        {(req.applicants?.length || 0) > 0 && (
                                                            <span style={{
                                                                padding: '1px 6px', borderRadius: 8,
                                                                background: 'rgba(251,146,60,.15)', color: '#fb923c',
                                                                fontSize: '0.6rem', fontWeight: 700
                                                            }}>
                                                                {req.applicants?.length}
                                                            </span>
                                                        )}
                                                    </Link>
                                                ) : hasApplied ? (
                                                    <Link
                                                        href={`/find-teammates/${req.id}`}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            padding: '7px 14px', borderRadius: 10,
                                                            background: 'rgba(16,185,129,.08)',
                                                            border: '1px solid rgba(16,185,129,.2)',
                                                            color: '#34d399', fontSize: '0.73rem', fontWeight: 700,
                                                            textDecoration: 'none'
                                                        }}
                                                    >
                                                        <Check size={12} /> {isFr ? 'Voir ma candidature' : 'View Application'}
                                                    </Link>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            if (!user) { router.push('/login'); return; }
                                                            setApplyingTo(req.id);
                                                            setApplyRole(req.roles[0]?.key || '');
                                                        }}
                                                        className="ft-apply-btn"
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            padding: '7px 16px', borderRadius: 10,
                                                            background: 'linear-gradient(135deg, #fb923c, #f97316)',
                                                            border: 'none', color: '#fff',
                                                            fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer',
                                                            letterSpacing: '-0.01em'
                                                        }}
                                                    >
                                                        <Send size={11} /> {isFr ? 'Postuler' : 'Apply'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Bottom CTA */}
                    {!loading && requests.length > 0 && (
                        <div className="fade-enter" style={{
                            marginTop: '3.5rem', display: 'flex', flexDirection: 'row', gap: '1.5rem',
                            alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                            background: 'linear-gradient(135deg, rgba(251,146,60,.04), rgba(244,114,182,.03))',
                            border: '1px solid rgba(251,146,60,.12)',
                            borderRadius: '18px', padding: '1.5rem 1.8rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, rgba(251,146,60,.12), rgba(244,114,182,.08))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <Rocket size={20} style={{ color: '#fb923c' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 3px', fontSize: '1rem', fontWeight: 800, color: '#fb923c', fontFamily: "var(--font-display), sans-serif" }}>
                                        {isFr ? 'Vous avez un projet ambitieux ?' : 'Got an ambitious project?'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,.35)' }}>
                                        {isFr ? 'Publiez une annonce et trouvez les talents qui manquent à votre équipe.' : 'Post a request and find the talent your team needs.'}
                                    </p>
                                </div>
                            </div>
                            {user ? (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="ft-apply-btn"
                                    style={{
                                        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '10px 20px', borderRadius: 12,
                                        background: 'linear-gradient(135deg, #fb923c, #f97316)',
                                        border: 'none', color: '#fff',
                                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                                    }}
                                >
                                    <Sparkles size={13} /> {isFr ? 'Publier maintenant' : 'Post Now'}
                                </button>
                            ) : (
                                <Link href="/login" style={{
                                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 20px', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #fb923c, #f97316)',
                                    color: '#fff', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none'
                                }}>
                                    {isFr ? 'Se connecter' : 'Sign in'}
                                </Link>
                            )}
                        </div>
                    )}
                </div>

            {/* ── Apply Modal ── */}
            {applyingTo && (
                <div className="ft-modal-overlay" onClick={() => setApplyingTo(null)}>
                    <div className="ft-modal" onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem 1.5rem 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                <h2 style={{
                                    margin: 0, fontSize: '1.15rem', fontWeight: 800,
                                    fontFamily: "var(--font-display), sans-serif",
                                    background: 'linear-gradient(135deg, #fb923c, #7df4de)',
                                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                                }}>
                                    {isFr ? 'Postuler' : 'Apply'}
                                </h2>
                                <button onClick={() => setApplyingTo(null)} style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: 'rgba(255,255,255,.05)', border: 'none',
                                    cursor: 'pointer', color: 'rgba(255,255,255,.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Role selection */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                    {isFr ? 'Rôle souhaité' : 'Desired role'}
                                </label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {requests.find(r => r.id === applyingTo)?.roles.map(role => {
                                        const preset = getRolePreset(role.key);
                                        const Icon = preset.icon;
                                        const selected = applyRole === role.key;
                                        return (
                                            <button
                                                key={role.key}
                                                onClick={() => setApplyRole(role.key)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '6px 12px', borderRadius: 10,
                                                    background: selected ? `${preset.color}15` : 'rgba(255,255,255,.03)',
                                                    border: `1px solid ${selected ? preset.color + '40' : 'rgba(255,255,255,.08)'}`,
                                                    color: selected ? preset.color : 'rgba(255,255,255,.4)',
                                                    fontSize: '0.75rem', fontWeight: selected ? 700 : 500,
                                                    cursor: 'pointer', transition: 'all 0.15s'
                                                }}
                                            >
                                                <Icon size={12} />
                                                {role.custom_label || (isFr ? preset.label : preset.labelEn)}
                                            </button>
                                        );
                                    })}
                                </div>

                                {applyRole === 'other' && (
                                    <div style={{ marginTop: '0.8rem', animation: 'ft-in 0.3s ease' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                            {isFr ? 'Précisez votre rôle' : 'Specify your role'}
                                        </label>
                                        <input
                                            type="text"
                                            className="ft-input"
                                            value={applyCustomRole}
                                            onChange={e => setApplyCustomRole(e.target.value)}
                                            placeholder={isFr ? 'Ex: Co-fondateur, CTO...' : 'e.g. Co-founder, CTO...'}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Message */}
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                    {isFr ? 'Message d\'accompagnement (optionnel)' : 'Cover message (optional)'}
                                </label>
                                <textarea
                                    className="ft-input"
                                    value={applyMessage}
                                    onChange={e => setApplyMessage(e.target.value)}
                                    placeholder={isFr ? 'Présentez-vous brièvement, vos compétences...' : 'Briefly introduce yourself, your skills...'}
                                    rows={3}
                                    style={{ resize: 'vertical', minHeight: '80px' }}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setApplyingTo(null)}
                                style={{
                                    padding: '9px 16px', borderRadius: 10,
                                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                                    color: 'rgba(255,255,255,.5)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                {isFr ? 'Annuler' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => handleApply(applyingTo as string)}
                                disabled={!applyRole || sendingApplication}
                                className="ft-apply-btn"
                                style={{
                                    padding: '9px 20px', borderRadius: 10,
                                    background: !applyRole ? 'rgba(251,146,60,.2)' : 'linear-gradient(135deg, #fb923c, #f97316)',
                                    border: 'none', color: '#fff',
                                    fontSize: '0.8rem', fontWeight: 700,
                                    cursor: !applyRole ? 'not-allowed' : 'pointer',
                                    opacity: sendingApplication ? 0.6 : 1
                                }}
                            >
                                {sendingApplication
                                    ? (isFr ? 'Envoi...' : 'Sending...')
                                    : (<><Send size={12} style={{ marginRight: 4 }} /> {isFr ? 'Envoyer' : 'Send'}</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Modal ── */}
            {showCreateModal && (
                <div className="ft-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="ft-modal" onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem 1.5rem 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.3rem' }}>
                                <h2 style={{
                                    margin: 0, fontSize: '1.15rem', fontWeight: 800,
                                    fontFamily: "var(--font-display), sans-serif",
                                    background: 'linear-gradient(135deg, #fb923c, #7df4de)',
                                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                                }}>
                                    {isFr ? 'Recruter des coéquipiers' : 'Recruit Teammates'}
                                </h2>
                                <button onClick={() => setShowCreateModal(false)} style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: 'rgba(255,255,255,.05)', border: 'none',
                                    cursor: 'pointer', color: 'rgba(255,255,255,.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Type toggle */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
                                {(['project', 'objective'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => { setCreateType(type); setCreateTargetId(''); }}
                                        style={{
                                            flex: 1, padding: '9px', borderRadius: 10,
                                            background: createType === type ? 'rgba(251,146,60,.1)' : 'rgba(255,255,255,.03)',
                                            border: `1px solid ${createType === type ? 'rgba(251,146,60,.3)' : 'rgba(255,255,255,.08)'}`,
                                            color: createType === type ? '#fb923c' : 'rgba(255,255,255,.35)',
                                            fontSize: '0.8rem', fontWeight: createType === type ? 700 : 500,
                                            cursor: 'pointer', transition: 'all 0.15s'
                                        }}
                                    >
                                        {type === 'project' ? (isFr ? 'Projet' : 'Project') : (isFr ? 'Objectif' : 'Objective')}
                                    </button>
                                ))}
                            </div>

                            {/* Target select */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                    {createType === 'project' ? (isFr ? 'Projet' : 'Project') : (isFr ? 'Objectif' : 'Objective')}
                                </label>
                                <select
                                    className="ft-select"
                                    value={createTargetId}
                                    onChange={e => setCreateTargetId(e.target.value)}
                                >
                                    <option value="">{isFr ? 'Sélectionner...' : 'Select...'}</option>
                                    {(createType === 'project' ? userProjects : userObjectives).map(item => (
                                        <option key={item.id} value={item.id}>{item.title}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                    {isFr ? 'Description du besoin' : 'What are you looking for?'}
                                </label>
                                <textarea
                                    className="ft-input"
                                    value={createDescription}
                                    onChange={e => setCreateDescription(e.target.value)}
                                    placeholder={isFr ? 'Décrivez ce que vous recherchez, le contexte du projet...' : 'Describe what you\'re looking for, project context...'}
                                    rows={3}
                                    style={{ resize: 'vertical', minHeight: '80px' }}
                                />
                            </div>

                            {/* Roles */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                    {isFr ? 'Rôles recherchés' : 'Roles needed'}
                                </label>
                                {createRoles.map((role, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                                        <select
                                            className="ft-select"
                                            style={{ flex: 1 }}
                                            value={role.key}
                                            onChange={e => {
                                                const updated = [...createRoles];
                                                updated[i] = { ...updated[i], key: e.target.value };
                                                setCreateRoles(updated);
                                            }}
                                        >
                                            {ROLE_PRESETS.map(r => (
                                                <option key={r.key} value={r.key}>{isFr ? r.label : r.labelEn}</option>
                                            ))}
                                        </select>
                                        {role.key === 'other' && (
                                            <input
                                                type="text"
                                                className="ft-input"
                                                style={{ flex: 1.5 }}
                                                placeholder={isFr ? 'Nom du rôle...' : 'Role name...'}
                                                value={role.custom_label || ''}
                                                onChange={e => {
                                                    const updated = [...createRoles];
                                                    updated[i] = { ...updated[i], custom_label: e.target.value };
                                                    setCreateRoles(updated);
                                                }}
                                            />
                                        )}
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={role.spots}
                                            onChange={e => {
                                                const updated = [...createRoles];
                                                updated[i] = { ...updated[i], spots: parseInt(e.target.value) || 1 };
                                                setCreateRoles(updated);
                                            }}
                                            className="ft-input"
                                            style={{ width: '60px', textAlign: 'center' }}
                                        />
                                        {createRoles.length > 1 && (
                                            <button
                                                onClick={() => setCreateRoles(createRoles.filter((_, j) => j !== i))}
                                                style={{
                                                    width: 28, height: 28, borderRadius: 8,
                                                    background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                                                    cursor: 'pointer', color: '#f87171',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                }}
                                            >
                                                <X size={11} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={() => setCreateRoles([...createRoles, { key: 'designer', spots: 1 }])}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '5px 10px', borderRadius: 8,
                                        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
                                        color: 'rgba(255,255,255,.35)', fontSize: '0.72rem', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.15s'
                                    }}
                                >
                                    <Plus size={11} /> {isFr ? 'Ajouter un rôle' : 'Add role'}
                                </button>
                            </div>

                            {/* Skills */}
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>
                                    {isFr ? 'Compétences recherchées (séparées par des virgules)' : 'Required skills (comma-separated)'}
                                </label>
                                <input
                                    type="text"
                                    className="ft-input"
                                    value={createSkills}
                                    onChange={e => setCreateSkills(e.target.value)}
                                    placeholder={isFr ? 'React, Figma, Node.js, Python...' : 'React, Figma, Node.js, Python...'}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{
                                    padding: '9px 16px', borderRadius: 10,
                                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                                    color: 'rgba(255,255,255,.5)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                {isFr ? 'Annuler' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!createTargetId || !createDescription || creating}
                                className="ft-apply-btn"
                                style={{
                                    padding: '9px 20px', borderRadius: 10,
                                    background: (!createTargetId || !createDescription) ? 'rgba(251,146,60,.2)' : 'linear-gradient(135deg, #fb923c, #f97316)',
                                    border: 'none', color: '#fff',
                                    fontSize: '0.8rem', fontWeight: 700,
                                    cursor: (!createTargetId || !createDescription) ? 'not-allowed' : 'pointer',
                                    opacity: creating ? 0.6 : 1
                                }}
                            >
                                {creating
                                    ? (isFr ? 'Publication...' : 'Publishing...')
                                    : (<><Sparkles size={12} style={{ marginRight: 4 }} /> {isFr ? 'Publier' : 'Publish'}</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
}
