'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import {
    doc, getDoc, collection, onSnapshot, addDoc, serverTimestamp,
    query, orderBy, updateDoc, where, getDocs, deleteDoc, setDoc, arrayUnion, arrayRemove, increment
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { validateFileUpload } from '@/lib/uploadValidation';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { authFetch } from '@/lib/authFetch';
import { useAccCall } from '@/context/AccCallContext';
import { ACC_SIDEBAR_W } from '@/components/AccCallOverlay';
import {
    ArrowLeft, Target, Zap, CheckCircle, Clock, AlertCircle,
    ExternalLink, Edit3, Save, X, Link as LinkIcon, Link2,
    Calendar, Bot, Trash2, Plus, Play, Pause, RotateCcw, Video,
    CheckSquare, Square, Flag, Settings2, PhoneOff, Timer, LayoutDashboard,
    Menu, Compass, Users, MessageCircle, PenLine, Flame, Shield, ChevronDown, ChevronRight, Send,
    Paperclip, Download, FileText, Upload, MessageSquareDashed
} from 'lucide-react';
import Avatar from '@/components/Avatar';
import Link from 'next/link';
import CollabWhiteboard from '@/components/CollabWhiteboard';
import FileAnnotationOverlay from '@/components/FileAnnotation';
import { ConceptAIcon } from '@/components/BrilliPlanLogo';
import { useTabParam } from '@/hooks/useTabParam';

/* ─── Helpers ─── */

const fmtHours = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${parseFloat(h.toFixed(2))}h`;
const fmtTime = (s: number) => {
    const sec = Math.max(0, Math.round(s));
    return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
};

const today = () => new Date().toISOString().slice(0, 10);

function getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getLast30Days(): string[] {
    const days: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

/* ─── Pomodoro constants ─── */

const POMODORO_DURATIONS: Record<string, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const POMODORO_LABELS: Record<string, string> = { focus: 'Focus', short: 'Pause', long: 'Pause longue' };
const POMODORO_COLORS: Record<string, string> = { focus: '#c8a960', short: '#10b981', long: '#06b6d4' };

type Tab = 'timeline' | 'engagements' | 'coworking';

/* ─── CircleTimer ─── */

function CircleTimer({ remaining, total, color, running }: { remaining: number; total: number; color: string; running: boolean }) {
    const r = 60, circ = 2 * Math.PI * r;
    const offset = circ * (1 - Math.max(0, remaining) / total);
    return (
        <div style={{ position: 'relative', width: 156, height: 156 }}>
            <svg width={156} height={156} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={78} cy={78} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
                <circle cx={78} cy={78} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums', color: '#ede9e3', lineHeight: 1 }}>
                    {fmtTime(remaining)}
                </span>
                <span style={{ fontSize: '0.6rem', color: running ? color : '#52525b', fontWeight: 700, marginTop: 5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {running ? '● En cours' : 'En pause'}
                </span>
            </div>
        </div>
    );
}

/* ─── CelebrationBurst ─── */

const BURST_PARTICLES = [
    { angle: 0,   color: '#c8a960', size: 7, anim: 'cburst-a', delay: '0s' },
    { angle: 30,  color: '#10b981', size: 5, anim: 'cburst-b', delay: '0.03s' },
    { angle: 60,  color: '#f59e0b', size: 6, anim: 'cburst-c', delay: '0.06s' },
    { angle: 90,  color: '#5eead4', size: 7, anim: 'cburst-a', delay: '0.02s' },
    { angle: 120, color: '#06b6d4', size: 5, anim: 'cburst-b', delay: '0.05s' },
    { angle: 150, color: '#d4b872', size: 6, anim: 'cburst-c', delay: '0.01s' },
    { angle: 180, color: '#f97316', size: 7, anim: 'cburst-a', delay: '0.04s' },
    { angle: 210, color: '#34d399', size: 5, anim: 'cburst-b', delay: '0.07s' },
    { angle: 240, color: '#c8a960', size: 6, anim: 'cburst-c', delay: '0.02s' },
    { angle: 270, color: '#fbbf24', size: 7, anim: 'cburst-a', delay: '0.05s' },
    { angle: 300, color: '#7df4de', size: 5, anim: 'cburst-b', delay: '0.08s' },
    { angle: 330, color: '#22d3ee', size: 6, anim: 'cburst-c', delay: '0.03s' },
];

function CelebrationBurst({ show }: { show: boolean }) {
    if (!show) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 20 }}>
            <style>{`
                @keyframes cburst-a {
                    0%   { transform: translateY(0px)   scale(1.4); opacity: 1; }
                    80%  { opacity: 0.8; }
                    100% { transform: translateY(-95px) scale(0);   opacity: 0; }
                }
                @keyframes cburst-b {
                    0%   { transform: translateY(0px)   scale(1.4); opacity: 1; }
                    80%  { opacity: 0.8; }
                    100% { transform: translateY(-72px) scale(0);   opacity: 0; }
                }
                @keyframes cburst-c {
                    0%   { transform: translateY(0px)   scale(1.4); opacity: 1; }
                    80%  { opacity: 0.8; }
                    100% { transform: translateY(-54px) scale(0);   opacity: 0; }
                }
                @keyframes cburst-star {
                    0%   { transform: translateX(-50%) translateY(0px)   scale(1);   opacity: 1; }
                    100% { transform: translateX(-50%) translateY(-48px) scale(0.4); opacity: 0; }
                }
            `}</style>

            {BURST_PARTICLES.map((p, i) => (
                <div key={i} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 0, height: 0,
                    transform: `rotate(${p.angle}deg)`,
                }}>
                    <div style={{
                        position: 'absolute',
                        width: p.size, height: p.size,
                        borderRadius: '50%',
                        background: p.color,
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        top: -p.size / 2, left: -p.size / 2,
                        animation: `${p.anim} 1.1s cubic-bezier(0.15,0.8,0.3,1) ${p.delay} both`,
                    }} />
                </div>
            ))}

            {/* Floating star */}
            <div style={{
                position: 'absolute', top: '22%', left: '50%',
                fontSize: '1.3rem', lineHeight: 1,
                animation: 'cburst-star 1.4s ease-out 0.1s both',
            }}>
                ✦
            </div>
        </div>
    );
}

/* ─── AccFileCard ─── */

function AccFileCard({ fileUrl, fileName, fileType, fileSize }: {
    fileUrl: string; fileName?: string; fileType?: string; fileSize?: number;
}) {
    const name = fileName || 'Fichier';
    const ext = name.split('.').pop()?.toUpperCase() || '';
    const isImage = fileType?.startsWith('image/');
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
            const res = await fetch(proxyUrl);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch { /* silent */ }
    };
    if (isImage) {
        return (
            <div style={{ marginTop: 4, maxWidth: 220, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={handleDownload}>
                <img src={fileUrl} alt={name} style={{ width: '100%', display: 'block', borderRadius: 10 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <Download size={11} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                </div>
            </div>
        );
    }
    return (
        <div onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.12)', maxWidth: 220, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,169,96,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(200,169,96,0.06)'}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(200,169,96,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.52rem', fontWeight: 800, color: '#c8a960', flexShrink: 0 }}>{ext}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'rgba(237,233,227,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {fileSize != null && <div style={{ fontSize: '0.6rem', color: 'rgba(237,233,227,0.3)', marginTop: 1 }}>{fileSize < 1024 ? `${fileSize} o` : fileSize < 1024 * 1024 ? `${(fileSize / 1024).toFixed(0)} Ko` : `${(fileSize / (1024 * 1024)).toFixed(1)} Mo`}</div>}
            </div>
            <Download size={13} style={{ color: 'rgba(200,169,96,0.5)', flexShrink: 0 }} />
        </div>
    );
}

/* ─── Main Content ─── */

function AccountabilityDetailContent() {
    const { id } = useParams();
    const { user } = useAuth();
    const { setNavbarVisible, isWorking: isWorkingGlobal, setWorkInfo, registerStopWork } = useUI();
    const router = useRouter();
    const { callInfo, zpRef: callZpRef, containerRef: callContainerRef, activateCall, endCall, callMinimized, minimizeCall, setIsAccWorking } = useAccCall();
    const isOnCall = !!callInfo && callInfo.pairId === (id as string);

    // Core state
    const [pair, setPair] = useState<any>(null);
    const [partner, setPartner] = useState<any>(null);
    const [objective, setObjective] = useState<any>(null);
    const [myObjectives, setMyObjectives] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [partnerMembership, setPartnerMembership] = useState<any>(null);
    const [myMembership, setMyMembership] = useState<any>(null);
    const [partnerPresence, setPartnerPresence] = useState<any>(null);
    const [nudging, setNudging] = useState(false);
    const [nudgeSent, setNudgeSent] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [leaving, setLeaving] = useState(false);

    // Goal editing
    const [editingGoal, setEditingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState('');
    const [goalFreq, setGoalFreq] = useState('weekly');
    const [editingSalon, setEditingSalon] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [savingTitle, setSavingTitle] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [hoursEnabled, setHoursEnabled] = useState(true);
    const settingsPanelRef = useRef<HTMLDivElement>(null);

    // Tabs
    const [activeTab, setActiveTab] = useTabParam<Tab>('tab', 'timeline');

    // Coworking direct
    const [liveDoc, setLiveDoc] = useState<any>(null);
    const [timerRemaining, setTimerRemaining] = useState(POMODORO_DURATIONS.focus);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const liveDocRef = useRef<any>(null);
    const [cwLog, setCwLog] = useState<any[]>([]);
    const [showTimerSettings, setShowTimerSettings] = useState(false);
    const [draftDurations, setDraftDurations] = useState({ focus: 25, short: 5, long: 15 });
    const [showAnim, setShowAnim] = useState(false);

    const [viewMode, setViewMode] = useState('focus');
    useEffect(() => {
        if (liveDoc?.timer_mode) {
            if (liveDoc.timer_mode !== viewMode) pauseCountRef.current = 0;
            setViewMode(liveDoc.timer_mode);
        }
    }, [liveDoc?.timer_mode]);
    const [pomCount, setPomCount] = useState(0);
    const [navOpen, setNavOpen] = useState(false);
    const sessionHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const callPresenceHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [preloadTrigger, setPreloadTrigger] = useState(0);

    // Coworking state -- consider participant stale if last heartbeat > 2min ago
    const isPresenceFresh = (uid: string) => {
        const lastSeen = liveDoc?.last_seen_map?.[uid];
        if (!lastSeen) return true;
        const lastSeenDate = lastSeen instanceof Date ? lastSeen : lastSeen?.toDate?.() ?? new Date(lastSeen);
        return Date.now() - lastSeenDate.getTime() < 2 * 60 * 1000;
    };
    const amInSession = !!user && (liveDoc?.participants?.includes(user.uid) ?? false) && isPresenceFresh(user.uid);
    const partnerInSession = !!partner && (liveDoc?.participants?.includes(partner.id) ?? false) && isPresenceFresh(partner.id);

    // Focus Guard
    const pauseCountRef = useRef(0);
    const [focusGuardMsg, setFocusGuardMsg] = useState<string | null>(null);
    const [focusGuardSubtasks, setFocusGuardSubtasks] = useState<string[]>([]);
    const [focusGuardLoading, setFocusGuardLoading] = useState(false);

    // ─── Check-in state ───
    const [checkins, setCheckins] = useState<any[]>([]);
    const [todayStatus, setTodayStatus] = useState<'kept' | 'missed' | null>(null);
    const [checkinNote, setCheckinNote] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);

    // ─── Engagements state ───
    const [myEngagements, setMyEngagements] = useState<any>(null);
    const [partnerEngagements, setPartnerEngagements] = useState<any>(null);
    const [engagementInputs, setEngagementInputs] = useState<string[]>(['', '', '']);
    const [savingEngagements, setSavingEngagements] = useState(false);
    const [pastEngagements, setPastEngagements] = useState<any[]>([]);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

    // ─── Chat state ───
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sendingChat, setSendingChat] = useState(false);
    const [chatFile, setChatFile] = useState<File | null>(null);
    const [chatUploadProgress, setChatUploadProgress] = useState<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatFileInputRef = useRef<HTMLInputElement>(null);

    // ─── Resources state (for call sidebar, same as salon) ───
    const [callResources, setCallResources] = useState<{ id: string; title: string; url: string; type?: string; file_name?: string; file_size?: number; added_by: string; added_by_name: string; storage_path?: string }[]>([]);
    const [showAddResource, setShowAddResource] = useState(false);
    const [resType, setResType] = useState<'link' | 'file'>('link');
    const [resTitle, setResTitle] = useState('');
    const [resUrl, setResUrl] = useState('');
    const [resFile, setResFile] = useState<File | null>(null);
    const [resUploading, setResUploading] = useState(false);
    const [resUploadProgress, setResUploadProgress] = useState(0);
    const [showCallLeaveConfirm, setShowCallLeaveConfirm] = useState(false);
    const [annotatingFile, setAnnotatingFile] = useState<{ id: string; title: string; url: string; file_name?: string; type: 'image' | 'pdf' } | null>(null);

    // ─── Effects ───

    useEffect(() => { if (!user || !id) return; loadPair(); }, [user, id]);

    // Hide navbar during full-screen call (not when minimized)
    useEffect(() => {
        if (isOnCall && !callMinimized) { setNavbarVisible(false); return () => setNavbarVisible(true); }
    }, [isOnCall, callMinimized, setNavbarVisible]);

    // Keep global FOCUS indicator in sync — persists across navigation via AccCallContext
    useEffect(() => {
        setIsAccWorking(amInSession);
    }, [amInSession]); // eslint-disable-line react-hooks/exhaustive-deps

    // Timer completion: when it reaches 0, reset and show animation -- never auto-restart
    useEffect(() => {
        if (!liveDoc?.timer_running || timerRemaining > 0) return;
        const timerMode = liveDoc.timer_mode ?? 'focus';

        if (timerMode === 'focus') {
            setPomCount(c => c + 1);
            setShowAnim(true);
            setTimeout(() => setShowAnim(false), 3000);
        }

        updateDoc(liveRef, {
            timer_running: false,
            timer_base_seconds: 0,
            timer_started_at: null,
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerRemaining, liveDoc?.timer_running]);

    const loadPair = async () => {
        setLoading(true);
        try {
            const pairDoc = await getDoc(doc(db, 'accountability_pairs', id as string));
            if (!pairDoc.exists()) { router.push('/accountability'); return; }
            const pairData = { id: pairDoc.id, ...pairDoc.data() } as any;
            setPair(pairData);
            setGoalInput(String(pairData.weekly_hours_goal ?? 5));
            setGoalFreq(pairData.goal_frequency || 'weekly');
            setTitleInput(pairData.title || '');
            setHoursEnabled((pairData.weekly_hours_goal ?? 5) > 0);

            const partnerUid = pairData.user1_id === user!.uid ? pairData.user2_id : pairData.user1_id;
            const partnerDoc = await getDoc(doc(db, 'users', partnerUid));
            const partnerData = partnerDoc.exists() ? { id: partnerDoc.id, ...partnerDoc.data() } : { id: partnerUid, full_name: 'Partenaire' };
            setPartner(partnerData);

            if (pairData.objective_id) {
                const objDoc = await getDoc(doc(db, 'objectives', pairData.objective_id));
                if (objDoc.exists()) setObjective({ id: objDoc.id, ...objDoc.data() });

                const memQ = query(collection(db, 'memberships'), where('objective_id', '==', pairData.objective_id));
                const memSnap = await getDocs(memQ);
                memSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.user_id === user!.uid) setMyMembership(data);
                    if (data.user_id === partnerUid) setPartnerMembership(data);
                });

                const presRef = doc(db, 'objectives', pairData.objective_id, 'presence', partnerUid);
                onSnapshot(presRef, snap => { if (snap.exists()) setPartnerPresence(snap.data()); });
            }

            const myMemQ = query(collection(db, 'memberships'), where('user_id', '==', user!.uid));
            const myMemSnap = await getDocs(myMemQ);
            const objIds = myMemSnap.docs.map(d => d.data().objective_id);
            const objDocs = await Promise.all(objIds.map(oid => getDoc(doc(db, 'objectives', oid))));
            setMyObjectives(objDocs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    // Real-time listeners
    useEffect(() => {
        if (!id) return;
        const unsubs = [
            onSnapshot(doc(db, 'accountability_pairs', id as string, 'coworking', 'live'),
                snap => setLiveDoc(snap.exists() ? snap.data() : null)),
            onSnapshot(query(collection(db, 'accountability_pairs', id as string, 'coworking_log'), orderBy('started_at', 'desc')),
                snap => setCwLog(snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 5))),
            // Checkins listener
            onSnapshot(query(collection(db, 'accountability_pairs', id as string, 'checkins'), orderBy('date', 'desc')),
                snap => {
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setCheckins(data);
                }),
            // Engagements listener
            onSnapshot(query(collection(db, 'accountability_pairs', id as string, 'engagements'), orderBy('created_at', 'desc')),
                snap => {
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPastEngagements(data);
                }),
        ];
        return () => unsubs.forEach(u => u());
    }, [id]);

    // Derive today's check-in status and my/partner engagements from real-time data
    useEffect(() => {
        if (!user || !checkins.length) {
            setTodayStatus(null);
            return;
        }
        const todayStr = today();
        const myToday = checkins.find(c => c.date === todayStr && c.uid === user.uid);
        setTodayStatus(myToday?.status ?? null);
    }, [checkins, user]);

    useEffect(() => {
        if (!user || !pastEngagements.length) return;
        const currentWeek = getWeekKey(new Date());
        const mine = pastEngagements.find(e => e.week === currentWeek && e.uid === user.uid);
        const theirs = pastEngagements.find(e => e.week === currentWeek && e.uid !== user.uid);
        setMyEngagements(mine ?? null);
        setPartnerEngagements(theirs ?? null);
        if (mine?.items) {
            setEngagementInputs(mine.items.map((it: any) => it.text));
        }
    }, [pastEngagements, user]);

    // Keep liveDocRef always fresh for use in stale closures
    useEffect(() => { liveDocRef.current = liveDoc; }, [liveDoc]);

    // Pomodoro client tick
    useEffect(() => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (!liveDoc) { setTimerRemaining(POMODORO_DURATIONS.focus); return; }
        const computeRemaining = () => {
            const base = liveDoc.timer_base_seconds ?? 0;
            const duration = liveDoc.timer_duration ?? POMODORO_DURATIONS.focus;
            if (!liveDoc.timer_running) return Math.max(0, duration - base);
            const startedAt = liveDoc.timer_started_at?.toDate?.() ?? new Date();
            const elapsed = base + (Date.now() - startedAt.getTime()) / 1000;
            return Math.max(0, duration - elapsed);
        };
        setTimerRemaining(computeRemaining());
        if (liveDoc.timer_running) {
            timerIntervalRef.current = setInterval(() => setTimerRemaining(computeRemaining()), 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [liveDoc]);

    // ─── Chat listener ───
    useEffect(() => {
        if (!user || !id) return;
        const chatRef = collection(db, 'accountability_pairs', id as string, 'messages');
        const q = query(chatRef, orderBy('created_at', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        });
        return () => unsub();
    }, [user, id]);

    const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const err = validateFileUpload(file);
        if (err) { alert(err); return; }
        setChatFile(file);
        if (e.target) e.target.value = '';
    };

    const handleSendChat = async () => {
        const hasText = chatInput.trim().length > 0;
        const hasFile = !!chatFile;
        if (!user || !id || (!hasText && !hasFile) || sendingChat) return;
        setSendingChat(true);
        try {
            let fileData: Record<string, any> = {};
            if (hasFile) {
                const file = chatFile!;
                const path = `accountability/${id}/chat_files/${user.uid}_${Date.now()}_${file.name}`;
                const sRef = storageRef(storage, path);
                const task = uploadBytesResumable(sRef, file);
                const url: string = await new Promise((resolve, reject) => {
                    task.on('state_changed',
                        snap => setChatUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                        reject,
                        async () => { setChatUploadProgress(null); resolve(await getDownloadURL(task.snapshot.ref)); }
                    );
                });
                fileData = { file_url: url, file_name: file.name, file_type: file.type, file_size: file.size };
                setChatFile(null);
            }
            await addDoc(collection(db, 'accountability_pairs', id as string, 'messages'), {
                uid: user.uid,
                user_name: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
                content: chatInput.trim().slice(0, 2000),
                created_at: serverTimestamp(),
                ...fileData,
            });
            updateDoc(doc(db, 'users', user.uid), { messages_sent: increment(1) }).catch(console.error);
            setChatInput('');
        } catch (err) { console.error('Chat send error', err); }
        setSendingChat(false);
    };

    // ─── Resources listener (for call sidebar) ───
    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(collection(db, 'accountability_pairs', id as string, 'session_resources'), snap => {
            setCallResources(snap.docs.map(d => ({
                id: d.id,
                title: d.data().title || '',
                url: d.data().url || '',
                type: d.data().type,
                file_name: d.data().file_name,
                file_size: d.data().file_size,
                added_by: d.data().added_by || '',
                added_by_name: d.data().added_by_name || 'Membre',
                storage_path: d.data().storage_path,
            })));
        });
        return () => unsub();
    }, [id]);

    const addCallResource = async () => {
        if (!id || !user) return;
        const addedByName = (user as any).displayName || user.email?.split('@')[0] || 'Membre';
        if (resType === 'file') {
            if (!resFile) return;
            const uploadErr = validateFileUpload(resFile);
            if (uploadErr) { alert(uploadErr); return; }
            setResUploading(true); setResUploadProgress(0);
            try {
                const sRef = storageRef(storage, `accountability/${id}/session_resources/${user.uid}_${Date.now()}_${resFile.name}`);
                const task = uploadBytesResumable(sRef, resFile);
                await new Promise<void>((resolve, reject) => {
                    task.on('state_changed',
                        snap => setResUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
                        reject,
                        async () => {
                            const url = await getDownloadURL(task.snapshot.ref);
                            await addDoc(collection(db, 'accountability_pairs', id as string, 'session_resources'), {
                                title: resTitle.trim() || resFile.name,
                                url, type: 'file',
                                file_name: resFile.name, file_size: resFile.size,
                                storage_path: task.snapshot.ref.fullPath,
                                added_by: user.uid, added_by_name: addedByName,
                                added_at: serverTimestamp(),
                            });
                            resolve();
                        }
                    );
                });
            } finally { setResUploading(false); setResUploadProgress(0); }
        } else {
            if (!resTitle.trim()) return;
            const url = resUrl.trim();
            const normalized = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;
            await addDoc(collection(db, 'accountability_pairs', id as string, 'session_resources'), {
                title: resTitle.trim(), url: normalized, type: 'link',
                added_by: user.uid, added_by_name: addedByName,
                added_at: serverTimestamp(),
            });
        }
        setResTitle(''); setResUrl(''); setResFile(null); setShowAddResource(false);
    };

    const deleteCallResource = async (resId: string, storagePath?: string) => {
        if (!id) return;
        if (storagePath) { try { await deleteObject(storageRef(storage, storagePath)); } catch { /* already deleted */ } }
        deleteDoc(doc(db, 'accountability_pairs', id as string, 'session_resources', resId));
    };

    // ─── Nudge ───
    const handleNudge = async () => {
        if (!partner || nudging || nudgeSent) return;
        setNudging(true);
        try {
            await addDoc(collection(db, 'users', partner.id, 'notifications'), {
                type: 'accountability_nudge',
                message: `${user!.displayName || user!.email?.split('@')[0] || 'Votre partenaire'} vous envoie un coup de pouce -- allez, au travail !`,
                link: `/accountability/${id}`,
                read: false,
                created_at: serverTimestamp(),
            });
            setNudgeSent(true);
            setTimeout(() => setNudgeSent(false), 4000);
        } finally { setNudging(false); }
    };

    // ─── Leave partnership ───
    const handleLeave = async () => {
        if (!pair || leaving) return;
        setLeaving(true);
        try {
            await deleteDoc(doc(db, 'accountability_pairs', id as string));
            router.push('/accountability');
        } catch (err) { console.error(err); setLeaving(false); }
    };

    // ─── Goal ───
    const handleSaveGoal = async () => {
        const g = hoursEnabled ? (parseFloat(goalInput) || 0) : 0;
        if (hoursEnabled && (!g || g <= 0)) return;
        await updateDoc(doc(db, 'accountability_pairs', id as string), {
            weekly_hours_goal: g,
            goal_frequency: goalFreq
        });
        setPair((p: any) => ({ ...p, weekly_hours_goal: g, goal_frequency: goalFreq }));
        setEditingGoal(false);
    };

    const handleSaveTitle = async () => {
        setSavingTitle(true);
        try {
            await updateDoc(doc(db, 'accountability_pairs', id as string), { title: titleInput.trim() || null });
            setPair((p: any) => ({ ...p, title: titleInput.trim() || null }));
            setEditingTitle(false);
        } finally { setSavingTitle(false); }
    };

    // ─── Salon link ───
    const handleLinkSalon = async (objectiveId: string) => {
        await updateDoc(doc(db, 'accountability_pairs', id as string), { objective_id: objectiveId || null });
        setEditingSalon(false);
        loadPair();
    };

    // ─── Check-in ───
    const [editingCheckin, setEditingCheckin] = useState(false);

    const handleCheckIn = async (status: 'kept' | 'missed') => {
        if (!user || checkingIn) return;
        setCheckingIn(true);
        try {
            const todayStr = today();
            const docId = `${todayStr}_${user.uid}`;
            await setDoc(doc(db, 'accountability_pairs', id as string, 'checkins', docId), {
                uid: user.uid,
                date: todayStr,
                status,
                note: checkinNote.trim() || null,
                created_at: serverTimestamp(),
            });
            setTodayStatus(status);
            setCheckinNote('');
            setEditingCheckin(false);

            // Track checkins_completed for badge
            updateDoc(doc(db, 'users', user.uid), { checkins_completed: increment(1) }).catch(console.error);

            // Recalculate streak and reliability
            const pairRef = doc(db, 'accountability_pairs', id as string);
            const checkinsSnap = await getDocs(query(collection(db, 'accountability_pairs', id as string, 'checkins'), orderBy('date', 'desc')));
            const allCheckins = checkinsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // Reliability: % of days user checked in 'kept' over last 30 days
            const last30 = getLast30Days();
            const myCheckins30 = allCheckins.filter((c: any) => c.uid === user.uid && last30.includes(c.date));
            const keptDays = myCheckins30.filter((c: any) => c.status === 'kept').length;
            const reliability = last30.length > 0 ? Math.round((keptDays / last30.length) * 100) : 0;

            // Streak: consecutive days where BOTH partners checked in 'kept'
            const partnerUid = pair.user1_id === user.uid ? pair.user2_id : pair.user1_id;
            let streak = 0;
            const sortedDays = [...last30].reverse();
            for (const day of sortedDays) {
                const myC = allCheckins.find((c: any) => c.uid === user.uid && c.date === day && c.status === 'kept');
                const partnerC = allCheckins.find((c: any) => c.uid === partnerUid && c.date === day && c.status === 'kept');
                if (myC && partnerC) {
                    streak++;
                } else {
                    break;
                }
            }

            await updateDoc(pairRef, {
                streak,
                [`reliability_${user.uid}`]: reliability,
            });
            setPair((p: any) => ({ ...p, streak, [`reliability_${user.uid}`]: reliability }));
        } catch (err) { console.error(err); }
        finally { setCheckingIn(false); }
    };

    // ─── Engagements ───
    const [editingEngagements, setEditingEngagements] = useState(false);
    const [editEngagementInputs, setEditEngagementInputs] = useState<string[]>([]);

    const handleStartEditEngagements = () => {
        if (!myEngagements) return;
        setEditEngagementInputs(myEngagements.items.map((i: any) => i.text));
        setEditingEngagements(true);
    };

    const handleSaveEditEngagements = async () => {
        if (!user || !myEngagements) return;
        const items = editEngagementInputs.filter(t => t.trim()).map((t, i) => ({
            text: t.trim(),
            done: myEngagements.items[i]?.done ?? false,
        }));
        if (items.length === 0) return;
        setSavingEngagements(true);
        try {
            await updateDoc(doc(db, 'accountability_pairs', id as string, 'engagements', myEngagements.id), { items });
            setEditingEngagements(false);
        } catch (err) { console.error(err); }
        finally { setSavingEngagements(false); }
    };

    const handleSaveEngagements = async () => {
        if (!user || savingEngagements) return;
        const items = engagementInputs.filter(t => t.trim()).map(t => ({ text: t.trim(), done: false }));
        if (items.length === 0) return;
        setSavingEngagements(true);
        try {
            const currentWeek = getWeekKey(new Date());
            const docId = `${currentWeek}_${user.uid}`;
            await setDoc(doc(db, 'accountability_pairs', id as string, 'engagements', docId), {
                uid: user.uid,
                week: currentWeek,
                items,
                created_at: serverTimestamp(),
            });
        } catch (err) { console.error(err); }
        finally { setSavingEngagements(false); }
    };

    const handleToggleEngagement = async (engagementDoc: any, itemIndex: number) => {
        if (!user || engagementDoc.uid !== user.uid) return;
        const newItems = [...engagementDoc.items];
        newItems[itemIndex] = { ...newItems[itemIndex], done: !newItems[itemIndex].done };
        await updateDoc(doc(db, 'accountability_pairs', id as string, 'engagements', engagementDoc.id), {
            items: newItems,
        });
        // If all items are now done, track engagements_completed_weeks for badge
        if (newItems.every((item: any) => item.done)) {
            updateDoc(doc(db, 'users', user.uid), { engagements_completed_weeks: increment(1) }).catch(console.error);
        }
    };

    // ─── Coworking -- timer controls ───
    const liveRef = doc(db, 'accountability_pairs', id as string, 'coworking', 'live');

    const handleJoinCoworking = async () => {
        if (!user) return;
        setWorkInfo({ id: id as string, title: partner?.full_name || 'Accountability', type: 'accountability' });
        registerStopWork(handleLeaveCoworking);
        await setDoc(liveRef, {
            participants: arrayUnion(user.uid),
            last_seen_map: { [user.uid]: serverTimestamp() },
            timer_running: liveDoc?.timer_running ?? false,
            timer_mode: liveDoc?.timer_mode ?? 'focus',
            timer_duration: liveDoc?.timer_duration ?? (POMODORO_DURATIONS[liveDoc?.timer_mode || 'focus']),
        }, { merge: true });
    };

    const handleLeaveCoworking = async () => {
        if (!user) return;
        setIsAccWorking(false);
        setWorkInfo(null);
        registerStopWork(null);
        await updateDoc(liveRef, {
            participants: arrayRemove(user.uid),
            timer_running: false,
            timer_base_seconds: 0,
            timer_started_at: null,
        });
    };

    const handleEndCall = () => {
        // Clear heartbeat
        if (callPresenceHeartbeatRef.current) {
            clearInterval(callPresenceHeartbeatRef.current);
            callPresenceHeartbeatRef.current = null;
        }
        // Remove from participants + stop timer
        if (user && id) {
            const lRef = doc(db, 'accountability_pairs', id as string, 'coworking', 'live');
            updateDoc(lRef, {
                participants: arrayRemove(user.uid),
                timer_running: false,
                timer_base_seconds: 0,
                timer_started_at: null,
            }).catch(() => {});
        }
        endCall();
        setWorkInfo(null);
        registerStopWork(null);
        // Trigger re-preload for the next call (Phase 1 won't re-run on callInfo change)
        setPreloadTrigger(t => t + 1);
    };

    const handleTimerStart = async () => {
        if (!liveDoc) return;
        await updateDoc(liveRef, { timer_running: true, timer_started_at: serverTimestamp() });
    };

    const triggerFocusGuard = async (resetEarly = false) => {
        if (focusGuardLoading || focusGuardMsg) return;
        setFocusGuardLoading(true);
        try {
            const res = await authFetch('/api/focus-guard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName: user?.displayName || user?.email?.split('@')[0] || 'toi',
                    partnerName: partner?.full_name || 'ton partenaire',
                    pauseCount: pauseCountRef.current,
                    resetEarly,
                    weeklyGoal: pair?.weekly_hours_goal ?? 5,
                }),
            });
            const data = await res.json();
            setFocusGuardMsg(data.message ?? null);
            setFocusGuardSubtasks(data.subtasks ?? []);
        } catch { /* silent */ }
        finally { setFocusGuardLoading(false); }
    };

    const handleTimerPause = async () => {
        if (!liveDoc) return;
        const base = liveDoc.timer_base_seconds ?? 0;
        const startedAt = liveDoc.timer_started_at?.toDate?.() ?? new Date();
        const elapsed = base + (Date.now() - startedAt.getTime()) / 1000;
        await updateDoc(liveRef, { timer_running: false, timer_base_seconds: elapsed });
        if ((liveDoc.timer_mode ?? 'focus') === 'focus') {
            pauseCountRef.current += 1;
            if (pauseCountRef.current >= 2) triggerFocusGuard(false);
        }
    };

    const handleTimerReset = async () => {
        if (!liveDoc) return;
        const isViewingActive = (liveDoc.timer_mode ?? 'focus') === viewMode;
        if (!isViewingActive) return;
        const duration = liveDoc.timer_duration ?? (25 * 60);
        const base = liveDoc.timer_base_seconds ?? 0;
        const startedAt = liveDoc.timer_started_at?.toDate?.() ?? new Date();
        const elapsed = liveDoc.timer_running ? base + (Date.now() - startedAt.getTime()) / 1000 : base;
        const isFocus = (liveDoc.timer_mode ?? 'focus') === 'focus';
        await updateDoc(liveRef, { timer_running: false, timer_base_seconds: 0, timer_started_at: null });
        if (isFocus && elapsed > duration * 0.15) {
            pauseCountRef.current = 0;
            triggerFocusGuard(true);
        }
    };

    const handleSwitchMode = (mode: string) => {
        if (mode !== viewMode) pauseCountRef.current = 0;
        setViewMode(mode);
    };

    const handleToggleTimer = async () => {
        if (!liveDoc) return;
        const isViewingActive = (liveDoc.timer_mode ?? 'focus') === viewMode;
        if (isViewingActive) {
            if (liveDoc.timer_running) {
                await handleTimerPause();
            } else {
                await handleTimerStart();
            }
        } else {
            pauseCountRef.current = 0;
            const newDuration = liveDoc?.custom_durations?.[viewMode]
                ? liveDoc.custom_durations[viewMode] * 60
                : POMODORO_DURATIONS[viewMode];
            await updateDoc(liveRef, {
                timer_mode: viewMode,
                timer_running: true,
                timer_base_seconds: 0,
                timer_started_at: serverTimestamp(),
                timer_duration: newDuration,
            });
        }
    };

    // Timer settings -- sync draftDurations when liveDoc changes
    useEffect(() => {
        if (liveDoc?.custom_durations) {
            setDraftDurations({
                focus: liveDoc.custom_durations.focus ?? 25,
                short: liveDoc.custom_durations.short ?? 5,
                long: liveDoc.custom_durations.long ?? 15,
            });
        }
    }, [liveDoc?.custom_durations?.focus, liveDoc?.custom_durations?.short, liveDoc?.custom_durations?.long]);

    const handleApplyDurations = async () => {
        const f = Math.max(1, Math.min(180, draftDurations.focus));
        const s = Math.max(1, Math.min(60, draftDurations.short));
        const l = Math.max(1, Math.min(60, draftDurations.long));
        const newModeDuration = (viewMode === 'focus' ? f : viewMode === 'short' ? s : l) * 60;

        if (liveDoc?.timer_running) {
            await updateDoc(liveRef, {
                custom_durations: { focus: f, short: s, long: l },
            });
        } else {
            await updateDoc(liveRef, {
                custom_durations: { focus: f, short: s, long: l },
                timer_running: false,
                timer_base_seconds: 0,
                timer_started_at: null,
                timer_duration: newModeDuration,
            });
        }
        setShowTimerSettings(false);
    };

    // ─── ZegoCloud Phase 1: pre-load SDK + token (no media yet, same pattern as salon) ─
    const [zegoReady, setZegoReady] = useState<{ zp: any; scenarioMode: any } | null>(null);

    useEffect(() => {
        if (!user || !id) return;
        if (callZpRef.current || zegoReady) return; // already loaded or joined

        let cancelled = false;

        (async () => {
            try {
                const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');
                if (cancelled) return;

                const roomId = `acc-${id}`;
                const userName = (user as any).full_name || user.displayName || user.email?.split('@')[0] || 'Membre';
                const tokenRes = await authFetch('/api/zego-token', { method: 'POST', body: JSON.stringify({ roomID: roomId, userName }) });
                if (!tokenRes.ok || cancelled) return;
                const { token: kitToken } = await tokenRes.json();
                const zp = ZegoUIKitPrebuilt.create(kitToken);
                if (cancelled) { try { zp.destroy(); } catch { /* ignore */ } return; }

                setZegoReady({ zp, scenarioMode: ZegoUIKitPrebuilt.VideoConference });
            } catch (e) { console.error('[ZegoCall] pre-load error', e); }
        })();

        return () => {
            cancelled = true;
            setZegoReady(prev => {
                if (prev?.zp) { try { prev.zp.destroy(); } catch { /* ignore */ } }
                return null;
            });
        };
        // NOTE: callInfo intentionally NOT in deps — activating a call must not destroy the
        // pre-loaded instance. preloadTrigger increments only when a call ends, triggering re-preload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, id, preloadTrigger]);

    // ─── ZegoCloud Phase 2a: show call UI (overlay) — triggered by button ─
    const handleInitiateCall = () => {
        if (!user || !partner) return;
        // Activate call context → shows the full-screen call view with "Rejoindre" overlay
        activateCall({
            pairId: id as string,
            partnerName: partner.full_name,
            partnerId: partner.id,
            partnerAvatarUrl: partner.avatar_url ?? null,
            partnerAvatarStyle: partner.avatar_style ?? null,
        });
    };

    // ─── ZegoCloud Phase 2b: join room on user click (preserves gesture context for autoplay) ─
    const handleJoinCall = () => {
        if (!zegoReady || !callContainerRef.current || !user || !id) return;
        const { zp, scenarioMode } = zegoReady;

        callZpRef.current = zp;
        setZegoReady(null);

        // Register in Firestore participants + start heartbeat (same as session page)
        const lRef = doc(db, 'accountability_pairs', id as string, 'coworking', 'live');
        setDoc(lRef, {
            participants: arrayUnion(user.uid),
            last_seen_map: { [user.uid]: serverTimestamp() },
        }, { merge: true });

        callPresenceHeartbeatRef.current = setInterval(() => {
            setDoc(lRef, { last_seen_map: { [user.uid]: serverTimestamp() } }, { merge: true });
        }, 30_000);

        zp.joinRoom({
            container: callContainerRef.current,
            scenario: { mode: scenarioMode },
            showPreJoinView: false,
            turnOnCameraWhenJoining: true,
            turnOnMicrophoneWhenJoining: true,
            showLeavingView: false,
            showLeaveRoomConfirmDialog: false,
            showRoomDetailsButton: false,
            showInviteToCohostButton: false,
            showRemoveCohostButton: false,
            showRequestToCohostButton: false,
            layout: 'Auto',
            showUserList: false,
            onLeaveRoom: () => {
                // Clear heartbeat
                if (callPresenceHeartbeatRef.current) {
                    clearInterval(callPresenceHeartbeatRef.current);
                    callPresenceHeartbeatRef.current = null;
                }
                // Remove from participants + stop timer
                const lRefCleanup = doc(db, 'accountability_pairs', id as string, 'coworking', 'live');
                updateDoc(lRefCleanup, {
                    participants: arrayRemove(user.uid),
                    timer_running: false,
                    timer_base_seconds: 0,
                    timer_started_at: null,
                }).catch(() => {});
                endCall();
                setWorkInfo(null);
                registerStopWork(null);
                setPreloadTrigger(t => t + 1);
            },
        });
    };

    // ─── UNIFIED PRESENCE: Heartbeat + Tab Close Cleanup ───
    useEffect(() => {
        if (!user || !id || !amInSession) {
            if (sessionHeartbeatRef.current) {
                clearInterval(sessionHeartbeatRef.current);
                sessionHeartbeatRef.current = null;
            }
            return;
        }

        const liveRef = doc(db, 'accountability_pairs', id as string, 'coworking', 'live');

        setDoc(liveRef, { last_seen_map: { [user.uid]: serverTimestamp() } }, { merge: true });

        sessionHeartbeatRef.current = setInterval(() => {
            setDoc(liveRef, { last_seen_map: { [user.uid]: serverTimestamp() } }, { merge: true });
        }, 30_000);

        return () => {
            if (sessionHeartbeatRef.current) {
                clearInterval(sessionHeartbeatRef.current);
                sessionHeartbeatRef.current = null;
            }
        };
    }, [amInSession, user, id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Call -> Session Transition: only join Firestore session when call activates ───
    // Cleanup is handled in onLeaveRoom / handleEndCall to avoid stale closure bugs.
    useEffect(() => {
        if (!user || !id || !isOnCall) return;
        const lRef = doc(db, 'accountability_pairs', id as string, 'coworking', 'live');
        setDoc(lRef, {
            participants: arrayUnion(user.uid),
            last_seen_map: { [user.uid]: serverTimestamp() },
            timer_running: false,
            timer_mode: 'focus',
            timer_duration: POMODORO_DURATIONS.focus,
        }, { merge: true });
    }, [isOnCall, user, id]); // eslint-disable-line react-hooks/exhaustive-deps

    const getDaysSince = (ts: any): number | null => {
        if (!ts?.toDate) return null;
        return Math.floor((Date.now() - ts.toDate().getTime()) / (1000 * 60 * 60 * 24));
    };

    const isPartnerActive = partnerPresence?.is_working &&
        partnerPresence?.last_seen?.toDate &&
        Date.now() - partnerPresence.last_seen.toDate().getTime() < 2 * 60 * 1000;

    // Calendar data for last 30 days (must be before early returns — Rules of Hooks)
    const checkinMap = useMemo(() => {
        const m: Record<string, { [uid: string]: string }> = {};
        for (const c of checkins) {
            if (!m[c.date]) m[c.date] = {};
            m[c.date][c.uid] = c.status;
        }
        return m;
    }, [checkins]);

    const currentWeek = getWeekKey(new Date());
    const pastWeekEngagements = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        for (const e of pastEngagements) {
            if (e.week === currentWeek) continue;
            if (!grouped[e.week]) grouped[e.week] = [];
            grouped[e.week].push(e);
        }
        return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
    }, [pastEngagements, currentWeek]);

    if (loading) return (
        <div className="container py-16 text-center fade-enter" style={{ maxWidth: '980px' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
    );
    if (!pair || !partner) return null;

    const weeklyGoal = pair.weekly_hours_goal ?? 5;
    const streak = pair.streak ?? 0;
    const myReliability = pair[`reliability_${user!.uid}`] ?? 0;
    const partnerUid = pair.user1_id === user!.uid ? pair.user2_id : pair.user1_id;

    // Determine what to display based on selected view vs active running timer
    const isActiveMode = liveDoc ? (liveDoc.timer_mode === viewMode) : false;
    const getModeDuration = (m: string) => {
        if (liveDoc?.custom_durations && liveDoc.custom_durations[m]) {
            return liveDoc.custom_durations[m] * 60;
        }
        return POMODORO_DURATIONS[m];
    };

    const timerColor = POMODORO_COLORS[viewMode] || '#c8a960';
    const viewDuration = getModeDuration(viewMode);
    const displayRemaining = isActiveMode ? timerRemaining : viewDuration;
    const displayDuration = isActiveMode ? (liveDoc.timer_duration ?? viewDuration) : viewDuration;
    const displayRunning = isActiveMode ? (liveDoc.timer_running ?? false) : false;

    const TABS: { key: Tab; label: string; icon: string }[] = [
        { key: 'timeline', label: 'Timeline', icon: '📅' },
        { key: 'engagements', label: 'Engagements', icon: '🎯' },
        { key: 'coworking', label: 'Coworking', icon: '🖥️' },
    ];

    const last30 = getLast30Days();

    // ── Full-screen call mode (same structure as session page) ─────────────────
    if (isOnCall && !callMinimized && partner) {
        const NAV_LINKS = [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { label: 'Explorer', href: '/explore', icon: Compass },
            { label: 'Amis', href: '/friends', icon: Users },
            { label: 'Messages', href: '/messages', icon: MessageCircle },
            { label: 'Accountability', href: '/accountability', icon: Target },
        ];
        const openLink = (href: string) => { router.push(href); setNavOpen(false); };

        return (
            <>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes slideInLeft {
                        from { transform: translateX(-100%); }
                        to   { transform: translateX(0); }
                    }
                    @keyframes fadeOverlay {
                        from { opacity: 0; }
                        to   { opacity: 1; }
                    }
                    @keyframes scaleIn {
                        from { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
                        to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
                    }
                    /* ── Hide ZegoCloud's native Leave dialog completely — we use our own ── */
                    .zp-confirm-dialog-bg, .zp-confirm-dialog,
                    [class*="confirmDialog"], [class*="leaveDialog"],
                    [class*="ConfirmDialog"], [class*="LeaveDialog"] {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                    }
                `}</style>

                {/* ── "Rejoindre" overlay — user click preserves gesture context for autoplay ── */}
                {zegoReady && !callZpRef.current && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 50, background: 'rgba(11,11,13,0.97)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 16,
                    }}>
                        <div style={{ fontSize: '1.1rem', color: '#a1a1aa', fontWeight: 500 }}>
                            Prêt à rejoindre l'appel avec {partner.full_name}
                        </div>
                        <button
                            onClick={handleJoinCall}
                            style={{
                                padding: '14px 40px', borderRadius: 14,
                                background: 'linear-gradient(135deg, #5eead4, #10b981)',
                                color: '#0b0b0d', fontSize: '1rem', fontWeight: 700,
                                border: 'none', cursor: 'pointer',
                                boxShadow: '0 4px 24px rgba(94,234,212,0.4)',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(94,234,212,0.55)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(94,234,212,0.4)'; }}
                        >
                            Rejoindre l'appel
                        </button>
                    </div>
                )}

                <div style={{
                    height: '100vh', marginTop: '-56px',
                    display: 'flex', overflow: 'hidden',
                    fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, sans-serif',
                }}>
                    {/* Collaborative whiteboard overlay */}
                    {showWhiteboard && (
                        <CollabWhiteboard
                            boardPath={`accountability_pairs/${id}/whiteboard/board`}
                            onClose={() => setShowWhiteboard(false)}
                        />
                    )}

                    {/* Left: transparent placeholder -- video lives here via AccCallOverlay (position:fixed) */}
                    <div style={{ flex: 1, position: 'relative', zIndex: 5, pointerEvents: 'none' }}>
                        {/* Floating top bar */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
                            pointerEvents: 'none',
                        }}>
                            {/* Hamburger menu */}
                            <button
                                onClick={() => setNavOpen(true)}
                                style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'rgba(18,18,22,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#ddd8d0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', pointerEvents: 'auto', flexShrink: 0,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,40,50,0.9)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(18,18,22,0.75)')}
                            >
                                <Menu size={16} />
                            </button>

                            {/* Title pill */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'rgba(18,18,22,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 10, padding: '6px 12px', pointerEvents: 'auto',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.7)', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ddd8d0' }}>
                                    {partner.full_name} · En appel
                                </span>
                            </div>

                            {/* Right buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
                                {/* Whiteboard toggle */}
                                <button
                                    onClick={() => setShowWhiteboard(v => !v)}
                                    title={showWhiteboard ? 'Masquer le tableau' : 'Tableau blanc collaboratif'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: showWhiteboard ? 'rgba(200,169,96,0.25)' : 'rgba(18,18,22,0.75)',
                                        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                        border: showWhiteboard ? '1px solid rgba(200,169,96,0.6)' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 10, padding: '7px 14px',
                                        color: showWhiteboard ? '#d4b872' : '#a1a1aa',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.18s',
                                    }}
                                >
                                    <PenLine size={13} /> Tableau
                                </button>

                                {/* Retour (minimizes call, shows pair page + mini player) */}
                                <button
                                    onClick={minimizeCall}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: 'rgba(18,18,22,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 10, padding: '7px 14px',
                                        color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 600,
                                        cursor: 'pointer', transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,40,50,0.9)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(18,18,22,0.75)')}
                                >
                                    <LayoutDashboard size={13} /> Retour à l&apos;accountability
                                </button>
                            </div>
                        </div>

                        {/* Loading spinner — shown briefly while ZegoCloud renders */}
                        {isOnCall && !callZpRef.current && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', pointerEvents: 'none' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(16,185,129,0.3)', borderTopColor: '#10b981', animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Connexion en cours...</span>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar */}
                    <div style={{
                        width: ACC_SIDEBAR_W, flexShrink: 0,
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        background: '#131316',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', zIndex: 5,
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                            {/* Partner info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <Avatar uid={partner.id} avatarUrl={partner.avatar_url} avatarStyle={partner.avatar_style} size={36} />
                                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#10b981', border: '2px solid #131316', boxShadow: '0 0 5px rgba(16,185,129,0.7)' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ddd8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.full_name}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 500, marginTop: 2 }}>● En appel</div>
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                            {/* Session Focus label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Timer size={12} style={{ color: '#c8a960' }} />
                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Session Focus</span>
                            </div>

                            {/* Mode tabs + settings */}
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {Object.entries(POMODORO_LABELS).map(([key, label]) => (
                                        <button key={key} onClick={() => handleSwitchMode(key)} style={{ flex: 1, padding: '5px 2px', borderRadius: 7, border: 'none', background: viewMode === key ? POMODORO_COLORS[key] : 'transparent', color: viewMode === key ? '#fff' : '#71717a', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewMode === key ? `0 0 10px ${POMODORO_COLORS[key]}44` : 'none' }}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setShowTimerSettings(s => !s)} title="Personnaliser les durees"
                                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: showTimerSettings ? 'rgba(200,169,96,0.2)' : 'rgba(255,255,255,0.03)', color: showTimerSettings ? '#c8a960' : '#52525b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                    <Settings2 size={13} />
                                </button>
                            </div>

                            {/* Timer settings panel */}
                            {showTimerSettings && (
                                <div style={{ background: 'rgba(200,169,96,0.05)', border: '1px solid rgba(200,169,96,0.15)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Durees (minutes)</span>
                                    {(['focus', 'short', 'long'] as const).map(key => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                            <span style={{ fontSize: '0.65rem', color: POMODORO_COLORS[key], fontWeight: 700, width: 60, flexShrink: 0 }}>{POMODORO_LABELS[key]}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <button onClick={() => setDraftDurations(d => ({ ...d, [key]: Math.max(1, d[key] - 1) }))} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                                <input type="text" inputMode="numeric" value={draftDurations[key]}
                                                    onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, '') || '1'); setDraftDurations(d => ({ ...d, [key]: Math.min(180, Math.max(1, n)) })); }}
                                                    style={{ width: 44, textAlign: 'center', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 6, color: '#ede9e3', fontSize: '0.88rem', fontWeight: 700, padding: '4px 2px', outline: 'none' }} />
                                                <button onClick={() => setDraftDurations(d => ({ ...d, [key]: Math.min(180, d[key] + 1) }))} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={handleApplyDurations} style={{ marginTop: 2, padding: '5px', borderRadius: 7, border: 'none', background: 'rgba(200,169,96,0.3)', color: '#d4b872', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>✓ Appliquer</button>
                                </div>
                            )}

                            {/* Circle timer */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                                <style>{`
                                    @keyframes pulse-ring-acc {
                                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(200, 169, 96, 0.7); }
                                        50% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(200, 169, 96, 0); }
                                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(200, 169, 96, 0); }
                                    }
                                `}</style>
                                <div style={{ animation: showAnim ? 'pulse-ring-acc 1s ease-out 3' : 'none', borderRadius: '50%', position: 'relative' }}>
                                    <CircleTimer remaining={displayRemaining} total={displayDuration} color={timerColor} running={displayRunning} />
                                    <CelebrationBurst show={showAnim} />
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <button onClick={handleTimerReset}
                                        style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                                        <RotateCcw size={13} />
                                    </button>
                                    <button onClick={handleToggleTimer}
                                        style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg,${timerColor},${timerColor}cc)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 20px ${timerColor}55` }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                                        {displayRunning ? <Pause size={17} style={{ fill: '#fff' }} /> : <Play size={17} style={{ fill: '#fff', marginLeft: 2 }} />}
                                    </button>
                                </div>
                                {/* Pomodoro dots */}
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: i < (pomCount % 4) ? '#c8a960' : 'rgba(255,255,255,0.06)',
                                            transition: 'background 0.3s',
                                            boxShadow: i < (pomCount % 4) ? '0 0 6px rgba(200,169,96,0.5)' : 'none',
                                        }} />
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.65rem', color: '#3f3f46', margin: 0 }}>
                                    {pomCount} session{pomCount !== 1 ? 's' : ''} focus terminee{pomCount !== 1 ? 's' : ''}
                                </p>
                            </div>

                            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                            {/* Participants (actual presence from liveDoc) */}
                            {(() => {
                                const callParticipants = [
                                    { uid: user!.uid, full_name: (user as any).full_name || user!.displayName || user!.email?.split('@')[0] || 'Moi', avatar_style: (user as any)?.avatar_style, avatar_url: (user as any)?.avatar_url, isMe: true, online: amInSession },
                                    { uid: partner.id, full_name: partner.full_name, avatar_style: partner.avatar_style, avatar_url: partner.avatar_url, isMe: false, online: partnerInSession },
                                ].filter(m => m.online);
                                const connectedCount = callParticipants.length;
                                return (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Dans la salle</span>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px rgba(16,185,129,0.8)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                                            </div>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#c8a960', background: 'rgba(200,169,96,0.1)', border: '1px solid rgba(200,169,96,0.2)', borderRadius: 6, padding: '1px 7px' }}>
                                                {connectedCount}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {callParticipants.map((m, idx) => (
                                                <div key={m.uid} style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    padding: '9px 11px', borderRadius: 12,
                                                    background: m.isMe
                                                        ? 'linear-gradient(135deg, rgba(200,169,96,0.1), rgba(200,169,96,0.04))'
                                                        : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                    border: m.isMe ? '1px solid rgba(200,169,96,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                                    position: 'relative', overflow: 'hidden',
                                                }}>
                                                    {m.isMe && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: 2, background: 'linear-gradient(180deg, #c8a960, #d4b872)' }} />}
                                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                                        <div style={{
                                                            position: 'absolute', inset: -2, borderRadius: '50%',
                                                            background: m.isMe
                                                                ? 'conic-gradient(from 0deg, #c8a96066, #d4b87299, #c8a96066)'
                                                                : 'conic-gradient(from 0deg, #10b98133, #10b98166, #10b98133)',
                                                            animation: 'spin-ring 4s linear infinite',
                                                        }} />
                                                        <div style={{ position: 'relative', borderRadius: '50%', overflow: 'hidden' }}>
                                                            <Avatar uid={m.uid} avatarStyle={m.avatar_style} avatarUrl={m.avatar_url} size={30} />
                                                        </div>
                                                        <span style={{ position: 'absolute', bottom: 0, right: -1, width: 8, height: 8, borderRadius: '50%', background: '#10b981', border: '1.5px solid #0f0f12', boxShadow: '0 0 6px rgba(16,185,129,0.8)' }} />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: m.isMe ? 700 : 600, color: m.isMe ? '#e8d9a8' : '#ccc4b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {m.full_name || 'Membre'}
                                                            {m.isMe && <span style={{ fontSize: '0.54rem', fontWeight: 700, color: '#0f0f12', background: '#c8a960', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em', flexShrink: 0 }}>vous</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                                                            <span style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 500 }}>En session</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                                                        {[3, 5, 7, 5, 3].map((h, i) => (
                                                            <div key={i} style={{ width: 2, height: h, borderRadius: 2, background: m.isMe ? '#c8a960' : '#10b981', opacity: 0.35 + (i === 2 ? 0.45 : i === 1 || i === 3 ? 0.25 : 0.1) }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {connectedCount === 0 && (
                                                <div style={{ padding: '10px', textAlign: 'center', color: '#3f3f46', fontSize: '0.68rem' }}>En attente de connexion…</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                            <style>{`
                                @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
                                @keyframes spin-ring { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                            `}</style>

                            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                            {/* Resources (same as salon) */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Link2 size={12} style={{ color: '#c8a960' }} />
                                        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Ressources</span>
                                    </div>
                                    <button
                                        onClick={() => setShowAddResource(v => !v)}
                                        title="Ajouter une ressource"
                                        style={{
                                            width: 22, height: 22, borderRadius: 7, border: '1px solid rgba(200,169,96,0.25)',
                                            background: showAddResource ? 'rgba(200,169,96,0.2)' : 'rgba(200,169,96,0.08)',
                                            color: '#c8a960', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,96,0.25)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = showAddResource ? 'rgba(200,169,96,0.2)' : 'rgba(200,169,96,0.08)')}
                                    >
                                        <Plus size={11} />
                                    </button>
                                </div>

                                {/* Add resource form */}
                                {showAddResource && (
                                    <div style={{ marginBottom: 10, padding: '10px', background: 'rgba(200,169,96,0.05)', borderRadius: 10, border: '1px solid rgba(200,169,96,0.12)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3 }}>
                                            {(['link', 'file'] as const).map(t => (
                                                <button key={t} onClick={() => { setResType(t); setResTitle(''); setResUrl(''); setResFile(null); }} style={{
                                                    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                                    background: resType === t ? 'rgba(200,169,96,0.35)' : 'transparent',
                                                    color: resType === t ? '#c7d2fe' : '#52525b',
                                                }}>{t === 'link' ? 'Lien' : 'Fichier'}</button>
                                            ))}
                                        </div>
                                        {resType === 'link' ? (
                                            <>
                                                <input placeholder="Titre *" value={resTitle} onChange={e => setResTitle(e.target.value)}
                                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 9px', color: '#ddd8d0', fontSize: '0.73rem', outline: 'none', fontFamily: 'inherit' }}
                                                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(200,169,96,0.4)')}
                                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')} />
                                                <input placeholder="URL (optionnel)" value={resUrl} onChange={e => setResUrl(e.target.value)}
                                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 9px', color: '#ddd8d0', fontSize: '0.73rem', outline: 'none', fontFamily: 'inherit' }}
                                                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(200,169,96,0.4)')}
                                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                                                    onKeyDown={e => { if (e.key === 'Enter') addCallResource(); }} />
                                            </>
                                        ) : (
                                            <>
                                                <label style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                                                    padding: '12px 8px', borderRadius: 8, border: `1px dashed ${resFile ? 'rgba(200,169,96,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                                    background: resFile ? 'rgba(200,169,96,0.07)' : 'rgba(255,255,255,0.02)',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                }}>
                                                    <Upload size={14} style={{ color: resFile ? '#c8a960' : '#52525b' }} />
                                                    <span style={{ fontSize: '0.68rem', color: resFile ? '#c7d2fe' : '#52525b', textAlign: 'center', wordBreak: 'break-all' }}>
                                                        {resFile ? resFile.name : 'Cliquer pour choisir un fichier'}
                                                    </span>
                                                    <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setResFile(f); if (!resTitle) setResTitle(f.name); } }} />
                                                </label>
                                                <input placeholder="Titre (optionnel)" value={resTitle} onChange={e => setResTitle(e.target.value)}
                                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 9px', color: '#ddd8d0', fontSize: '0.73rem', outline: 'none', fontFamily: 'inherit' }}
                                                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(200,169,96,0.4)')}
                                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')} />
                                            </>
                                        )}
                                        {resUploading && (
                                            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #c8a960, #c8a960)', width: `${resUploadProgress}%`, transition: 'width 0.2s' }} />
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => { setShowAddResource(false); setResTitle(''); setResUrl(''); setResFile(null); setResType('link'); }} style={{
                                                flex: 1, padding: '6px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
                                                background: 'transparent', color: '#71717a', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                                            }}>Annuler</button>
                                            <button onClick={addCallResource} disabled={resUploading || (resType === 'link' ? !resTitle.trim() : !resFile)} style={{
                                                flex: 1, padding: '6px 0', borderRadius: 7, border: 'none',
                                                background: (!resUploading && (resType === 'link' ? resTitle.trim() : resFile)) ? 'linear-gradient(135deg, #c8a960, #b89a50)' : 'rgba(200,169,96,0.2)',
                                                color: (!resUploading && (resType === 'link' ? resTitle.trim() : resFile)) ? '#fff' : '#52525b',
                                                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s',
                                            }}>{resUploading ? `${resUploadProgress}%` : 'Ajouter'}</button>
                                        </div>
                                    </div>
                                )}

                                {/* Resource list */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {callResources.length === 0 && (
                                        <div style={{ padding: '10px', textAlign: 'center', color: '#3f3f46', fontSize: '0.68rem' }}>
                                            Aucune ressource partagée
                                        </div>
                                    )}
                                    {callResources.map(r => {
                                        const isFile = r.type === 'file';
                                        return (
                                            <div key={r.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 9,
                                                padding: '9px 11px', borderRadius: 12,
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                                transition: 'all 0.2s ease',
                                            }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 10,
                                                    background: isFile ? 'rgba(16,185,129,0.1)' : 'rgba(200,169,96,0.1)',
                                                    border: `1px solid ${isFile ? 'rgba(16,185,129,0.15)' : 'rgba(200,169,96,0.15)'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                    boxShadow: isFile ? '0 0 15px rgba(16,185,129,0.05)' : '0 0 15px rgba(200,169,96,0.05)',
                                                }}>
                                                    {isFile ? <FileText size={16} style={{ color: '#34d399' }} /> : <ExternalLink size={16} style={{ color: '#c8a960' }} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#71717a', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff0080' }}></span>
                                                        par {r.added_by_name}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {/* Annotate button for images and PDFs */}
                                                    {isFile && r.url && (() => {
                                                        const fn = (r.file_name || r.title || '').toLowerCase();
                                                        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fn);
                                                        const isPdf = /\.pdf$/i.test(fn);
                                                        if (!isImage && !isPdf) return null;
                                                        return (
                                                            <button
                                                                onClick={() => setAnnotatingFile({ id: r.id, title: r.title, url: r.url, file_name: r.file_name, type: isImage ? 'image' : 'pdf' })}
                                                                title="Annoter"
                                                                style={{
                                                                    width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                                                                    background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.18)',
                                                                    color: '#5eead4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(94,234,212,0.2)'; e.currentTarget.style.borderColor = 'rgba(94,234,212,0.35)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(94,234,212,0.08)'; e.currentTarget.style.borderColor = 'rgba(94,234,212,0.18)'; }}
                                                            >
                                                                <MessageSquareDashed size={13} />
                                                            </button>
                                                        );
                                                    })()}
                                                    {r.url && (
                                                        <a href={r.url} target="_blank" rel="noopener noreferrer" title={isFile ? 'Télécharger' : 'Ouvrir'} style={{
                                                            width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                                            color: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            textDecoration: 'none', transition: 'all 0.15s',
                                                        }}
                                                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(200,169,96,0.2)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(200,169,96,0.3)'; }}
                                                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                                                            {isFile ? <Download size={13} /> : <ExternalLink size={13} />}
                                                        </a>
                                                    )}
                                                    {r.added_by === user!.uid && (
                                                        <button onClick={() => deleteCallResource(r.id, r.storage_path)} title="Supprimer" style={{
                                                            width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                                                            background: 'transparent', border: '1px solid transparent',
                                                            color: '#52525b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', transition: 'all 0.15s',
                                                        }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#fca5a5'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#52525b'; }}>
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Bottom tip */}
                        <div style={{ flexShrink: 0, margin: '0 14px 14px', padding: '9px 12px', background: 'rgba(200,169,96,0.05)', borderRadius: 10, border: '1px solid rgba(200,169,96,0.1)' }}>
                            <p style={{ fontSize: '0.65rem', color: '#c8a960', margin: 0, lineHeight: 1.5, opacity: 0.8 }}>
                                {draftDurations.focus} min focus · {draftDurations.short} min pause · ×4 → longue pause
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Sliding left nav panel (same as session page) ── */}
                {navOpen && (
                    <>
                        <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'fadeOverlay 0.2s ease' }} />
                        <div style={{
                            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60,
                            width: 260, background: '#131316',
                            borderRight: '1px solid rgba(255,255,255,0.07)',
                            boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
                            display: 'flex', flexDirection: 'column',
                            animation: 'slideInLeft 0.22s cubic-bezier(0.16,1,0.3,1)',
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ConceptAIcon size={24} />
                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ede9e3', letterSpacing: '-0.03em' }}>BrilliPlan</span>
                                </div>
                                <button onClick={() => setNavOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#ddd8d0'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}>
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Call badge */}
                            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Appel actif</div>
                                        <div style={{ fontSize: '0.77rem', color: '#d1fae5', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>avec {partner.full_name}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Nav links */}
                            <div style={{ padding: '10px 10px', flex: 1 }}>
                                <p style={{ fontSize: '0.58rem', fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 8px 8px' }}>Navigation</p>
                                {NAV_LINKS.map(({ label, href, icon: Icon }) => (
                                    <button key={href} onClick={() => openLink(href)} style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 12px', borderRadius: 10, border: 'none',
                                        background: 'transparent', color: '#a1a1aa',
                                        fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#ede9e3'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}>
                                        <Icon size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Custom leave confirmation modal (same as salon) ── */}
                {showCallLeaveConfirm && (
                    <>
                        <div
                            onClick={() => setShowCallLeaveConfirm(false)}
                            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'fadeOverlay 0.18s ease' }}
                        />
                        <div style={{
                            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                            zIndex: 101, width: 340,
                            background: '#1c1c21',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 18,
                            boxShadow: '0 32px 72px rgba(0,0,0,0.8), 0 0 0 1px rgba(200,169,96,0.12)',
                            padding: '28px 28px 24px',
                            animation: 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
                            fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, sans-serif',
                        }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <PhoneOff size={20} style={{ color: '#ef4444' }} />
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>
                                Quitter l&apos;appel ?
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#71717a', lineHeight: 1.55, marginBottom: 24 }}>
                                Tu vas quitter l&apos;appel avec {partner.full_name}. Tu pourras relancer un appel depuis la page accountability.
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => setShowCallLeaveConfirm(false)}
                                    style={{
                                        flex: 1, padding: '10px 0', borderRadius: 10,
                                        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 600,
                                        cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#ddd8d0'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}
                                >Annuler</button>
                                <button
                                    onClick={handleEndCall}
                                    style={{
                                        flex: 1, padding: '10px 0', borderRadius: 10,
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        border: 'none',
                                        color: '#fff', fontSize: '0.85rem', fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 16px rgba(239,68,68,0.4)',
                                        transition: 'opacity 0.15s, transform 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >Quitter</button>
                            </div>
                        </div>
                    </>
                )}

                {/* Annotation overlay */}
                {annotatingFile && id && (
                    <FileAnnotationOverlay
                        parentType="objectives"
                        parentId={`acc_${id as string}`}
                        file={annotatingFile}
                        memberships={[
                            { user_id: user!.uid, user: { full_name: (user as any).full_name || user!.displayName || user!.email?.split('@')[0] || 'Moi', avatar_url: (user as any)?.avatar_url, avatar_style: (user as any)?.avatar_style } },
                            { user_id: partner.id, user: { full_name: partner.full_name, avatar_url: partner.avatar_url, avatar_style: partner.avatar_style } },
                        ]}
                        onClose={() => setAnnotatingFile(null)}
                    />
                )}
            </>
        );
    }

    // ── Normal page render ──────────────────────────────────────────────────────
    return (
        <>
        <div className="salon-page">
            <style>{`
                @keyframes ad-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes ad-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(94,234,212,0.5); } 50% { box-shadow: 0 0 0 6px rgba(94,234,212,0); } }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-ring-acc {
                    0%   { box-shadow: 0 0 0 0   rgba(200,169,96, 0.7); }
                    70%  { box-shadow: 0 0 0 24px rgba(200,169,96, 0); }
                    100% { box-shadow: 0 0 0 0   rgba(200,169,96, 0); }
                }
                @keyframes fgSlideIn {
                    from { opacity: 0; transform: translateY(16px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes ad-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes ad-glow-pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }

                .ad-wrap { font-family: var(--font-body), system-ui; color: #ede9e3; }
                .ad-heading { font-family: var(--font-display), system-ui; font-weight: 800; letter-spacing: -0.03em; }
                .ad-mono { font-family: var(--font-body), system-ui; font-variant-numeric: tabular-nums; }

                /* ── Header hero ── */
                .ad-hero {
                    position: relative;
                    padding: 28px 26px 22px;
                    border-radius: 22px;
                    background: linear-gradient(165deg, rgba(200,169,96,0.08) 0%, rgba(11,11,13,0.95) 50%, rgba(94,234,212,0.04) 100%);
                    border: 1px solid rgba(200,169,96,0.15);
                    margin-bottom: 24px;
                }
                .ad-hero::before {
                    content: '';
                    position: absolute; top: 0; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(200,169,96,0.5), rgba(94,234,212,0.3), transparent);
                }
                .ad-hero::after {
                    content: '';
                    position: absolute; top: -60px; right: -60px; width: 180px; height: 180px;
                    background: radial-gradient(circle, rgba(200,169,96,0.06) 0%, transparent 70%);
                    pointer-events: none;
                }

                /* ── Tab nav ── */
                .ad-tabbar {
                    display: flex; gap: 3px;
                    background: rgba(200,169,96,0.03);
                    border: 1px solid rgba(200,169,96,0.08);
                    border-radius: 16px; padding: 4px;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                }
                .ad-tab {
                    flex: 1 1 auto;
                    padding: 10px 12px;
                    border-radius: 12px; border: none;
                    font-family: var(--font-body), system-ui;
                    font-size: 0.8rem; font-weight: 600;
                    cursor: pointer; transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    white-space: nowrap;
                }
                .ad-tab-active {
                    background: rgba(200,169,96,0.14);
                    color: #c8a960;
                    box-shadow: 0 0 0 1px rgba(200,169,96,0.3), 0 2px 8px rgba(200,169,96,0.1);
                }
                .ad-tab-inactive {
                    background: transparent;
                    color: rgba(237,233,227,0.35);
                }
                .ad-tab-inactive:hover { background: rgba(237,233,227,0.04); color: rgba(237,233,227,0.6); }

                /* ── Cards ── */
                .ad-card {
                    background: rgba(14,14,20,0.92);
                    border: 1px solid rgba(200,169,96,0.08);
                    border-radius: 20px;
                    padding: 22px 24px;
                    animation: ad-in 0.35s cubic-bezier(0.22,1,0.36,1) both;
                    position: relative;
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                }

                /* ── Inputs ── */
                .ad-input {
                    width: 100%; box-sizing: border-box;
                    background: rgba(237,233,227,0.04);
                    border: 1px solid rgba(200,169,96,0.12);
                    border-radius: 12px;
                    color: #ede9e3;
                    font-family: var(--font-body), system-ui; font-size: 0.88rem;
                    padding: 10px 14px; outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .ad-input:focus { border-color: rgba(200,169,96,0.45); box-shadow: 0 0 0 3px rgba(200,169,96,0.08); }
                .ad-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(200,169,96,0.45); display: block; margin-bottom: 7px; }

                /* ── Buttons ── */
                .ad-btn-amber {
                    padding: 10px 20px; border-radius: 12px; border: none;
                    background: linear-gradient(135deg, #c8a960, #d4b872);
                    color: #0b0b0d; font-family: var(--font-display), system-ui; font-size: 0.82rem; font-weight: 700;
                    cursor: pointer; transition: all 0.25s;
                    box-shadow: 0 3px 14px rgba(200,169,96,0.25);
                    display: flex; align-items: center; gap: 6px;
                }
                .ad-btn-amber:hover { box-shadow: 0 6px 22px rgba(200,169,96,0.4); transform: translateY(-1px); }
                .ad-btn-amber:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

                .ad-btn-ghost {
                    padding: 8px 14px; border-radius: 11px;
                    border: 1px solid rgba(200,169,96,0.1);
                    background: rgba(200,169,96,0.04);
                    color: rgba(237,233,227,0.5);
                    font-family: var(--font-body), system-ui; font-size: 0.82rem; font-weight: 600;
                    cursor: pointer; transition: all 0.2s;
                    display: flex; align-items: center; gap: 6px;
                }
                .ad-btn-ghost:hover { border-color: rgba(200,169,96,0.25); color: rgba(237,233,227,0.8); background: rgba(200,169,96,0.06); }

                /* ── Progress bar ── */
                .ad-pbar { height: 4px; border-radius: 4px; background: rgba(200,169,96,0.08); overflow: hidden; }
                .ad-pbar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }

                /* ── Presence pill ── */
                .ad-presence-pill {
                    display: flex; align-items: center; gap: 10px;
                    padding: 12px 18px; border-radius: 14px;
                    border: 1px solid rgba(200,169,96,0.08);
                    background: rgba(237,233,227,0.02);
                    transition: all 0.25s; flex: 1;
                }

                /* ── Toggle ── */
                .ad-toggle { width: 38px; height: 21px; border-radius: 11px; border: none; padding: 2px; position: relative; cursor: pointer; transition: background 0.25s; flex-shrink: 0; }
                .ad-toggle-thumb { display: block; width: 17px; height: 17px; border-radius: 50%; background: #ede9e3; position: absolute; top: 2px; transition: left 0.25s; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }

                /* ── Mode button ── */
                .ad-mode-btn { flex: 1; padding: 9px 6px; border-radius: 11px; border: none; font-family: var(--font-body), system-ui; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }

                /* ── Contribution cell ── */
                .ad-contrib-cell {
                    width: 30px; height: 30px; border-radius: 7px;
                    display: flex; align-items: center; justify-content: center; gap: 3px;
                    background: rgba(200,169,96,0.03); border: 1px solid rgba(200,169,96,0.06);
                    position: relative; transition: all 0.18s;
                }
                .ad-contrib-cell:hover { border-color: rgba(200,169,96,0.2); background: rgba(200,169,96,0.06); }
                .ad-contrib-dot {
                    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
                }

                /* ── Engagement item ── */
                .ad-eng-item {
                    display: flex; align-items: flex-start; gap: 10px;
                    padding: 12px 16px; border-radius: 13px;
                    background: rgba(200,169,96,0.03); border: 1px solid rgba(200,169,96,0.06);
                    transition: all 0.18s;
                }
                .ad-eng-item:hover { border-color: rgba(200,169,96,0.15); background: rgba(200,169,96,0.05); }

                /* ── Stat card accent ── */
                .ad-stat-card {
                    position: relative;
                    text-align: center;
                    overflow: hidden;
                }
                .ad-stat-card::before {
                    content: '';
                    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
                    width: 40px; height: 2px; border-radius: 2px;
                }

                /* ── Section divider ── */
                .ad-section-label {
                    display: flex; align-items: center; gap: 10px;
                    margin-bottom: 16px;
                }
                .ad-section-label::after {
                    content: '';
                    flex: 1; height: 1px;
                    background: linear-gradient(90deg, rgba(200,169,96,0.15), transparent);
                }

                /* ── Two-column layout ── */
                .ad-layout {
                    display: flex; gap: 20px; align-items: flex-start;
                }
                .ad-chat-col {
                    width: 320px; flex-shrink: 0;
                    position: sticky; top: 80px;
                    display: flex; flex-direction: column;
                    height: calc(100vh - 100px);
                    background: rgba(14,14,20,0.92);
                    border: 1px solid rgba(200,169,96,0.08);
                    border-radius: 20px;
                    overflow: hidden;
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                }
                .ad-main-col { flex: 1; min-width: 0; }

                /* ── Chat ── */
                .ad-chat-header {
                    padding: 16px 18px; display: flex; align-items: center; gap: 9;
                    border-bottom: 1px solid rgba(200,169,96,0.08);
                    flex-shrink: 0;
                }
                .ad-chat-body {
                    flex: 1; overflow-y: auto; padding: 14px 14px 8px;
                    display: flex; flex-direction: column; gap: 6px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(200,169,96,0.12) transparent;
                }
                .ad-chat-body::-webkit-scrollbar { width: 4px; }
                .ad-chat-body::-webkit-scrollbar-thumb { background: rgba(200,169,96,0.15); border-radius: 4px; }
                .ad-chat-msg {
                    max-width: 85%; padding: 9px 13px; border-radius: 14px;
                    font-size: 0.82rem; line-height: 1.45; word-break: break-word;
                    animation: ad-in 0.2s ease;
                }
                .ad-chat-msg-mine {
                    align-self: flex-end;
                    background: rgba(200,169,96,0.12); border: 1px solid rgba(200,169,96,0.18);
                    color: #ede9e3; border-bottom-right-radius: 4px;
                }
                .ad-chat-msg-partner {
                    align-self: flex-start;
                    background: rgba(237,233,227,0.04); border: 1px solid rgba(237,233,227,0.07);
                    color: rgba(237,233,227,0.85); border-bottom-left-radius: 4px;
                }
                .ad-chat-input-wrap {
                    padding: 10px 12px; border-top: 1px solid rgba(200,169,96,0.08);
                    display: flex; gap: 8px; align-items: center; flex-shrink: 0;
                }
                .ad-chat-input {
                    flex: 1; background: rgba(237,233,227,0.04);
                    border: 1px solid rgba(200,169,96,0.1); border-radius: 12px;
                    color: #ede9e3; font-family: var(--font-body), system-ui;
                    font-size: 0.82rem; padding: 9px 13px; outline: none;
                    transition: border-color 0.2s;
                }
                .ad-chat-input:focus { border-color: rgba(200,169,96,0.35); }
                .ad-chat-input::placeholder { color: rgba(237,233,227,0.22); }
                .ad-chat-send {
                    width: 34px; height: 34px; border-radius: 10px; border: none;
                    background: rgba(200,169,96,0.15); color: #c8a960;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s; flex-shrink: 0;
                }
                .ad-chat-send:hover { background: rgba(200,169,96,0.25); }
                .ad-chat-send:disabled { opacity: 0.3; cursor: not-allowed; }
                .ad-chat-empty {
                    flex: 1; display: flex; flex-direction: column; align-items: center;
                    justify-content: center; gap: 8px; color: rgba(237,233,227,0.2);
                }

                @media (max-width: 900px) {
                    .ad-layout { flex-direction: column; }
                    .ad-chat-col { width: 100%; position: static; height: 380px; order: 2; }
                    .ad-main-col { order: 1; width: 100%; }
                }
            `}</style>

            <div className="ad-wrap">

                {/* ── Back ── */}
                <button onClick={() => router.push('/accountability')} className="ad-btn-ghost" style={{ marginBottom: 20, fontSize: '0.8rem' }}>
                    <ArrowLeft size={14} /> Retour
                </button>

                {/* ── Hero Header ── */}
                <div className="ad-hero">
                    {/* Top row: avatar + info + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar uid={partner.id} avatarUrl={partner.avatar_url} avatarStyle={partner.avatar_style} size={62}
                                style={{ border: `2.5px solid ${isPartnerActive ? '#5eead4' : 'rgba(200,169,96,0.35)'}`, cursor: 'pointer', transition: 'border-color 0.3s' }}
                                onClick={() => router.push(`/user/${partner.id}`)} />
                            {isPartnerActive && (
                                <span style={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: '#5eead4', border: '2.5px solid #0b0b0d', animation: 'ad-pulse 2s ease infinite' }} />
                            )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 className="ad-heading" style={{ margin: '0 0 3px', fontSize: '1.55rem', color: '#ede9e3', lineHeight: 1.15 }}>
                                {pair.title || partner.full_name}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {isPartnerActive ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: '#5eead4', fontWeight: 600 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5eead4' }} /> En train de travailler
                                    </span>
                                ) : (() => {
                                    const days = getDaysSince(partnerPresence?.last_seen);
                                    if (days === null) return <span style={{ fontSize: '0.76rem', color: 'rgba(237,233,227,0.3)' }}>Activite inconnue</span>;
                                    if (days === 0) return <span style={{ fontSize: '0.76rem', color: 'rgba(237,233,227,0.5)' }}>Vu aujourd&apos;hui</span>;
                                    if (days === 1) return <span style={{ fontSize: '0.76rem', color: 'rgba(237,233,227,0.45)' }}>Vu hier</span>;
                                    return <span style={{ fontSize: '0.76rem', color: '#c8a960' }}><AlertCircle size={11} style={{ display: 'inline', marginRight: 4 }} />Inactif depuis {days}j</span>;
                                })()}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                            <button onClick={handleNudge} disabled={nudging || nudgeSent}
                                style={{ padding: '8px 14px', borderRadius: 11, border: `1px solid ${nudgeSent ? 'rgba(94,234,212,0.3)' : 'rgba(200,169,96,0.25)'}`, background: nudgeSent ? 'rgba(94,234,212,0.08)' : 'rgba(200,169,96,0.06)', color: nudgeSent ? '#5eead4' : '#c8a960', fontFamily: 'var(--font-body), system-ui', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s' }}>
                                {nudgeSent ? <><CheckCircle size={13} /> Envoye</> : <><Zap size={13} /> Nudge</>}
                            </button>

                            <button
                                onClick={() => {
                                    if (isOnCall || (isWorkingGlobal && !amInSession)) return;
                                    if (!amInSession) handleJoinCoworking();
                                    handleInitiateCall();
                                }}
                                disabled={isOnCall || (isWorkingGlobal && !amInSession)}
                                title={isWorkingGlobal && !amInSession ? 'Tu as déjà une session active ailleurs' : undefined}
                                style={{ padding: '8px 14px', borderRadius: 11, background: isOnCall ? 'rgba(94,234,212,0.12)' : 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4', fontFamily: 'var(--font-body), system-ui', fontSize: '0.8rem', fontWeight: 700, cursor: (isOnCall || (isWorkingGlobal && !amInSession)) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s', opacity: (isWorkingGlobal && !amInSession) ? 0.4 : 1 }}>
                                <Video size={13} /> {isOnCall ? 'En appel' : (isWorkingGlobal && !amInSession) ? 'Session active' : 'Appel'}
                            </button>

                            <div style={{ position: 'relative' }} ref={settingsPanelRef}>
                                <button onClick={() => setShowSettingsPanel(v => !v)}
                                    style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${showSettingsPanel ? 'rgba(200,169,96,0.35)' : 'rgba(200,169,96,0.1)'}`, background: showSettingsPanel ? 'rgba(200,169,96,0.1)' : 'rgba(200,169,96,0.04)', color: showSettingsPanel ? '#c8a960' : 'rgba(237,233,227,0.35)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <Settings2 size={15} />
                                </button>
                                {showSettingsPanel && (
                                    <div style={{ position: 'absolute', top: 42, right: 0, zIndex: 200, width: 310, borderRadius: 20, background: 'rgba(14,14,20,0.99)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(200,169,96,0.15)', boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,169,96,0.08)', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'ad-in 0.15s ease' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ fontFamily: 'var(--font-display), system-ui', fontWeight: 700, fontSize: '0.88rem', color: '#ede9e3', display: 'flex', alignItems: 'center', gap: 7 }}>
                                                <Settings2 size={14} style={{ color: '#c8a960' }} /> Parametres
                                            </div>
                                            <button onClick={() => setShowSettingsPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,233,227,0.35)', padding: 2, display: 'flex' }}><X size={14} /></button>
                                        </div>

                                        <div>
                                            <span className="ad-label">Titre</span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <input className="ad-input" placeholder={partner.full_name} value={titleInput} onChange={e => setTitleInput(e.target.value)} style={{ height: 36, padding: '0 10px' }} />
                                                <button onClick={handleSaveTitle} disabled={savingTitle || titleInput.trim() === (pair.title || '')}
                                                    style={{ height: 36, padding: '0 12px', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, background: 'rgba(200,169,96,0.15)', color: '#c8a960', border: '1px solid rgba(200,169,96,0.3)', cursor: 'pointer', flexShrink: 0, opacity: titleInput.trim() === (pair.title || '') ? 0.4 : 1, fontFamily: 'var(--font-body), system-ui' }}>
                                                    {savingTitle ? '...' : 'OK'}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span className="ad-label" style={{ margin: 0 }}>Objectif hebdomadaire</span>
                                                <button className="ad-toggle" style={{ background: hoursEnabled ? 'rgba(200,169,96,0.6)' : 'rgba(237,233,227,0.1)' }}
                                                    onClick={() => { const next = !hoursEnabled; setHoursEnabled(next); if (!next) { updateDoc(doc(db, 'accountability_pairs', id as string), { weekly_hours_goal: 0 }); setPair((p: any) => ({ ...p, weekly_hours_goal: 0 })); } }}>
                                                    <span className="ad-toggle-thumb" style={{ left: hoursEnabled ? '19px' : '2px' }} />
                                                </button>
                                            </div>
                                            {hoursEnabled && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <input type="number" min="1" max="500" className="ad-input" value={goalInput} onChange={e => setGoalInput(e.target.value)} style={{ width: 64, textAlign: 'center', height: 36, padding: '0 8px' }} />
                                                    <span style={{ fontSize: '0.8rem', color: 'rgba(237,233,227,0.35)' }}>h /</span>
                                                    <select value={goalFreq} onChange={e => setGoalFreq(e.target.value)} style={{ height: 36, fontSize: '0.85rem', background: 'rgba(237,233,227,0.04)', border: '1px solid rgba(200,169,96,0.12)', borderRadius: 9, padding: '0 8px', color: '#ede9e3', fontFamily: 'var(--font-body), system-ui' }}>
                                                        <option value="daily">jour</option>
                                                        <option value="weekly">semaine</option>
                                                        <option value="monthly">mois</option>
                                                    </select>
                                                    <button onClick={() => { handleSaveGoal(); }} disabled={goalInput === String(pair.weekly_hours_goal ?? 0) && goalFreq === (pair.goal_frequency || 'weekly')}
                                                        style={{ marginLeft: 'auto', height: 36, padding: '0 12px', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, background: 'rgba(200,169,96,0.15)', color: '#c8a960', border: '1px solid rgba(200,169,96,0.3)', cursor: 'pointer', opacity: (goalInput === String(pair.weekly_hours_goal ?? 0) && goalFreq === (pair.goal_frequency || 'weekly')) ? 0.4 : 1, fontFamily: 'var(--font-body), system-ui' }}>OK</button>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <span className="ad-label">Salon lie</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <button onClick={() => handleLinkSalon('')} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 9, fontSize: '0.82rem', background: !pair.objective_id ? 'rgba(237,233,227,0.06)' : 'transparent', border: !pair.objective_id ? '1px solid rgba(237,233,227,0.12)' : '1px solid transparent', color: !pair.objective_id ? '#ede9e3' : 'rgba(237,233,227,0.4)', cursor: 'pointer', fontFamily: 'var(--font-body), system-ui' }}>
                                                    Aucun salon
                                                </button>
                                                {myObjectives.map(o => (
                                                    <button key={o.id} onClick={() => handleLinkSalon(o.id)} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 9, fontSize: '0.82rem', background: pair.objective_id === o.id ? 'rgba(200,169,96,0.1)' : 'transparent', border: pair.objective_id === o.id ? '1px solid rgba(200,169,96,0.3)' : '1px solid transparent', color: pair.objective_id === o.id ? '#c8a960' : 'rgba(237,233,227,0.55)', cursor: 'pointer', fontFamily: 'var(--font-body), system-ui' }}>
                                                        {o.title}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Leave partnership */}
                                        <div style={{ borderTop: '1px solid rgba(200,169,96,0.08)', paddingTop: '0.8rem' }}>
                                            {!confirmLeave ? (
                                                <button onClick={() => setConfirmLeave(true)} style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: 'rgba(239,68,68,0.65)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body), system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                                    <X size={12} /> Quitter le pacte
                                                </button>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: '0.76rem', color: '#f87171', whiteSpace: 'nowrap' }}>Confirmer ?</span>
                                                    <button onClick={handleLeave} disabled={leaving} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body), system-ui' }}>
                                                        {leaving ? '...' : 'Oui'}
                                                    </button>
                                                    <button onClick={() => setConfirmLeave(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,233,227,0.35)', padding: 2, display: 'flex' }}>
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stat badges row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 11, background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.18)' }}>
                            <Flame size={14} style={{ color: '#c8a960' }} />
                            <span className="ad-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#c8a960' }}>{streak}</span>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(237,233,227,0.35)' }}>jours</span>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 11, background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.15)' }}>
                            <Shield size={14} style={{ color: '#5eead4' }} />
                            <span className="ad-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#5eead4' }}>{myReliability}%</span>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(237,233,227,0.35)' }}>fiabilite</span>
                        </div>
                        {weeklyGoal > 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 11, background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.12)' }}>
                                <Target size={12} style={{ color: '#c8a960' }} />
                                <span className="ad-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c8a960' }}>{weeklyGoal}h</span>
                                <span style={{ fontSize: '0.7rem', color: 'rgba(237,233,227,0.35)' }}>/ {pair.goal_frequency === 'daily' ? 'jour' : pair.goal_frequency === 'monthly' ? 'mois' : 'semaine'}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Two-column layout ── */}
                <div className="ad-layout">

                {/* ── Main content column (left) ── */}
                <div className="ad-main-col">

                {/* ── Tab bar ── */}
                <div className="ad-tabbar">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`ad-tab ${activeTab === t.key ? 'ad-tab-active' : 'ad-tab-inactive'}`}>
                            {t.icon} {t.label}
                            {t.key === 'coworking' && (amInSession || partnerInSession) && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5eead4', marginLeft: 2 }} />
                            )}
                        </button>
                    ))}
                </div>

                {/* ── TAB: TIMELINE ── */}
                {activeTab === 'timeline' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'ad-in 0.35s ease' }}>

                        {/* Today's check-in */}
                        <div className="ad-card" style={{ borderColor: 'rgba(200,169,96,0.15)', background: 'linear-gradient(135deg, rgba(200,169,96,0.04) 0%, rgba(14,14,20,0.95) 100%)' }}>
                            <div className="ad-section-label">
                                <Calendar size={15} style={{ color: '#c8a960' }} />
                                <span className="ad-heading" style={{ fontSize: '0.9rem', color: '#ede9e3' }}>Check-in du jour</span>
                                <span style={{ fontSize: '0.7rem', color: 'rgba(237,233,227,0.3)', marginLeft: 'auto', whiteSpace: 'nowrap', paddingLeft: 12 }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>

                            {todayStatus && !editingCheckin ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 16, background: todayStatus === 'kept' ? 'rgba(94,234,212,0.06)' : 'rgba(200,169,96,0.06)', border: `1px solid ${todayStatus === 'kept' ? 'rgba(94,234,212,0.2)' : 'rgba(200,169,96,0.2)'}` }}>
                                        {todayStatus === 'kept' ? (
                                            <CheckCircle size={22} style={{ color: '#5eead4', flexShrink: 0 }} />
                                        ) : (
                                            <AlertCircle size={22} style={{ color: '#c8a960', flexShrink: 0 }} />
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: todayStatus === 'kept' ? '#5eead4' : '#c8a960' }}>
                                                {todayStatus === 'kept' ? 'Engagement tenu !' : 'Pas pu aujourd\'hui'}
                                            </div>
                                            <div style={{ fontSize: '0.73rem', color: 'rgba(237,233,227,0.35)', marginTop: 2 }}>
                                                Vous avez deja fait votre check-in pour aujourd&apos;hui
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingCheckin(true)}
                                            style={{ background: 'none', border: '1px solid rgba(200,169,96,0.15)', borderRadius: 9, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,233,227,0.35)', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'var(--font-body), system-ui', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s', flexShrink: 0 }}>
                                            <Edit3 size={11} /> Modifier
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {editingCheckin && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <span style={{ fontSize: '0.76rem', color: 'rgba(237,233,227,0.4)', fontWeight: 600 }}>Modifier votre check-in</span>
                                            <button onClick={() => setEditingCheckin(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,233,227,0.3)', padding: 2, display: 'flex' }}><X size={13} /></button>
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                        <button onClick={() => handleCheckIn('kept')} disabled={checkingIn}
                                            style={{ padding: '18px 14px', borderRadius: 16, border: '1px solid rgba(94,234,212,0.2)', background: 'rgba(94,234,212,0.05)', color: '#5eead4', fontFamily: 'var(--font-display), system-ui', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.25s' }}>
                                            <CheckCircle size={24} />
                                            <span>J&apos;ai tenu mon engagement</span>
                                        </button>
                                        <button onClick={() => handleCheckIn('missed')} disabled={checkingIn}
                                            style={{ padding: '18px 14px', borderRadius: 16, border: '1px solid rgba(200,169,96,0.15)', background: 'rgba(200,169,96,0.04)', color: 'rgba(200,169,96,0.8)', fontFamily: 'var(--font-display), system-ui', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.25s' }}>
                                            <AlertCircle size={24} />
                                            <span>J&apos;ai pas pu aujourd&apos;hui</span>
                                        </button>
                                    </div>
                                    <textarea className="ad-input" rows={2} placeholder="Note optionnelle (ex: blocage, context...)" value={checkinNote} onChange={e => setCheckinNote(e.target.value)} style={{ resize: 'none', fontSize: '0.82rem' }} />
                                </>
                            )}
                        </div>

                        {/* Streak + Reliability stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div className="ad-card ad-stat-card" style={{ overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 40, height: 2, borderRadius: 2, background: '#c8a960' }} />
                                <Flame size={22} style={{ color: '#c8a960', margin: '4px auto 10px', display: 'block' }} />
                                <div className="ad-mono" style={{ fontSize: '2.4rem', fontWeight: 800, color: '#c8a960', lineHeight: 1 }}>{streak}</div>
                                <div style={{ fontSize: '0.73rem', color: 'rgba(237,233,227,0.4)', marginTop: 6, fontWeight: 600 }}>jours de streak</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(237,233,227,0.2)', marginTop: 3 }}>Les 2 partenaires ont tenu</div>
                            </div>
                            <div className="ad-card ad-stat-card" style={{ overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 40, height: 2, borderRadius: 2, background: '#5eead4' }} />
                                <Shield size={22} style={{ color: '#5eead4', margin: '4px auto 10px', display: 'block' }} />
                                <div className="ad-mono" style={{ fontSize: '2.4rem', fontWeight: 800, color: '#5eead4', lineHeight: 1 }}>{myReliability}%</div>
                                <div style={{ fontSize: '0.73rem', color: 'rgba(237,233,227,0.4)', marginTop: 6, fontWeight: 600 }}>fiabilite (30j)</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(237,233,227,0.2)', marginTop: 3 }}>Vos check-ins positifs</div>
                            </div>
                        </div>

                        {/* 30-day contribution calendar */}
                        <div className="ad-card">
                            <div className="ad-section-label">
                                <Calendar size={15} style={{ color: '#c8a960' }} />
                                <span className="ad-heading" style={{ fontSize: '0.88rem', color: '#ede9e3' }}>30 derniers jours</span>
                            </div>

                            {/* Legend */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c8a960' }} />
                                    <span style={{ fontSize: '0.67rem', color: 'rgba(237,233,227,0.4)' }}>Vous</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#5eead4' }} />
                                    <span style={{ fontSize: '0.67rem', color: 'rgba(237,233,227,0.4)' }}>{partner.full_name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                                    <span style={{ fontSize: '0.67rem', color: 'rgba(237,233,227,0.4)' }}>Manque</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(237,233,227,0.1)' }} />
                                    <span style={{ fontSize: '0.67rem', color: 'rgba(237,233,227,0.4)' }}>Pas de donnees</span>
                                </div>
                            </div>

                            {/* Grid */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {last30.map(day => {
                                    const myStatus = checkinMap[day]?.[user!.uid];
                                    const pStatus = checkinMap[day]?.[partnerUid];
                                    const dotColor = (s: string | undefined) => {
                                        if (s === 'kept') return '#5eead4';
                                        if (s === 'missed') return '#ef4444';
                                        return 'rgba(237,233,227,0.1)';
                                    };
                                    const isToday = day === today();
                                    const dayNum = new Date(day + 'T12:00:00').getDate();
                                    return (
                                        <div key={day} className="ad-contrib-cell" title={`${day}: Vous=${myStatus || '?'}, Partenaire=${pStatus || '?'}`}
                                            style={{ borderColor: isToday ? 'rgba(200,169,96,0.4)' : undefined, background: isToday ? 'rgba(200,169,96,0.08)' : undefined }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                <span style={{ fontSize: '0.55rem', color: isToday ? 'rgba(200,169,96,0.6)' : 'rgba(237,233,227,0.22)', lineHeight: 1, fontWeight: isToday ? 700 : 400 }}>{dayNum}</span>
                                                <div style={{ display: 'flex', gap: 2 }}>
                                                    <div className="ad-contrib-dot" style={{ background: myStatus ? dotColor(myStatus) : 'rgba(237,233,227,0.1)', boxShadow: myStatus === 'kept' ? '0 0 5px rgba(94,234,212,0.4)' : 'none' }} />
                                                    <div className="ad-contrib-dot" style={{ background: pStatus ? dotColor(pStatus) : 'rgba(237,233,227,0.1)', boxShadow: pStatus === 'kept' ? '0 0 5px rgba(94,234,212,0.4)' : 'none' }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: ENGAGEMENTS ── */}
                {activeTab === 'engagements' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'ad-in 0.35s ease' }}>

                        {/* Current week header */}
                        <div className="ad-section-label" style={{ marginBottom: 0 }}>
                            <Target size={15} style={{ color: '#c8a960' }} />
                            <span className="ad-heading" style={{ fontSize: '1rem', color: '#ede9e3' }}>Semaine {currentWeek}</span>
                        </div>

                        {/* My engagements */}
                        <div className="ad-card" style={{ borderColor: 'rgba(200,169,96,0.15)', background: 'linear-gradient(135deg, rgba(200,169,96,0.04) 0%, rgba(14,14,20,0.95) 100%)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <span className="ad-heading" style={{ fontSize: '0.88rem', color: '#c8a960' }}>Mes engagements</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {myEngagements && !editingEngagements && (
                                        <button onClick={handleStartEditEngagements}
                                            style={{ background: 'none', border: '1px solid rgba(200,169,96,0.15)', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', color: 'rgba(237,233,227,0.35)', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'var(--font-body), system-ui', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
                                            <Edit3 size={10} /> Modifier
                                        </button>
                                    )}
                                    {myEngagements && (
                                        <span style={{ fontSize: '0.72rem', color: 'rgba(237,233,227,0.35)', fontWeight: 600 }}>
                                            {myEngagements.items.filter((i: any) => i.done).length}/{myEngagements.items.length} faits
                                        </span>
                                    )}
                                </div>
                            </div>

                            {editingEngagements && myEngagements ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: '0.76rem', color: 'rgba(237,233,227,0.4)', fontWeight: 600 }}>Modifier vos engagements</span>
                                        <button onClick={() => setEditingEngagements(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,233,227,0.3)', padding: 2, display: 'flex' }}><X size={13} /></button>
                                    </div>
                                    {editEngagementInputs.map((val, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(200,169,96,0.35)', fontWeight: 700, width: 18, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                                            <input className="ad-input" placeholder={`Engagement ${idx + 1}`}
                                                value={val}
                                                onChange={e => {
                                                    const next = [...editEngagementInputs];
                                                    next[idx] = e.target.value;
                                                    setEditEngagementInputs(next);
                                                }}
                                                style={{ fontSize: '0.85rem' }} />
                                            {editEngagementInputs.length > 1 && (
                                                <button onClick={() => setEditEngagementInputs(prev => prev.filter((_, i) => i !== idx))}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.4)', padding: 2, display: 'flex', flexShrink: 0 }}>
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {editEngagementInputs.length < 5 && (
                                        <button onClick={() => setEditEngagementInputs(prev => [...prev, ''])}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8a960', fontSize: '0.8rem', fontWeight: 600, padding: '4px 0', textAlign: 'left', fontFamily: 'var(--font-body), system-ui', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Plus size={13} /> Ajouter
                                        </button>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                                        <button onClick={() => setEditingEngagements(false)} className="ad-btn-ghost" style={{ fontSize: '0.78rem', padding: '7px 14px' }}>
                                            Annuler
                                        </button>
                                        <button onClick={handleSaveEditEngagements} disabled={savingEngagements || editEngagementInputs.filter(t => t.trim()).length === 0}
                                            className="ad-btn-amber" style={{ fontSize: '0.78rem', padding: '7px 14px' }}>
                                            {savingEngagements ? '...' : 'Enregistrer'}
                                        </button>
                                    </div>
                                </div>
                            ) : myEngagements ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {myEngagements.items.map((item: any, idx: number) => (
                                        <div key={idx} className="ad-eng-item" style={{ borderColor: item.done ? 'rgba(94,234,212,0.15)' : undefined, opacity: item.done ? 0.7 : 1 }}>
                                            <button onClick={() => handleToggleEngagement(myEngagements, idx)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: item.done ? '#5eead4' : 'rgba(237,233,227,0.25)', flexShrink: 0, display: 'flex', marginTop: 1 }}>
                                                {item.done ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                            <span style={{ fontSize: '0.88rem', color: item.done ? 'rgba(237,233,227,0.4)' : '#ede9e3', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                                                {item.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <p style={{ fontSize: '0.82rem', color: 'rgba(237,233,227,0.35)', margin: '0 0 8px' }}>
                                        Declarez 3 a 5 engagements pour la semaine
                                    </p>
                                    {engagementInputs.map((val, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(200,169,96,0.35)', fontWeight: 700, width: 18, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                                            <input className="ad-input" placeholder={`Engagement ${idx + 1}${idx >= 3 ? ' (optionnel)' : ''}`}
                                                value={val}
                                                onChange={e => {
                                                    const next = [...engagementInputs];
                                                    next[idx] = e.target.value;
                                                    setEngagementInputs(next);
                                                }}
                                                style={{ fontSize: '0.85rem' }} />
                                        </div>
                                    ))}
                                    {engagementInputs.length < 5 && (
                                        <button onClick={() => setEngagementInputs(prev => [...prev, ''])}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8a960', fontSize: '0.8rem', fontWeight: 600, padding: '4px 0', textAlign: 'left', fontFamily: 'var(--font-body), system-ui', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Plus size={13} /> Ajouter un engagement
                                        </button>
                                    )}
                                    <button onClick={handleSaveEngagements} disabled={savingEngagements || engagementInputs.filter(t => t.trim()).length === 0}
                                        className="ad-btn-amber" style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                                        {savingEngagements ? 'Enregistrement...' : 'Valider mes engagements'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Partner engagements */}
                        <div className="ad-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <Avatar uid={partner.id} avatarUrl={partner.avatar_url} avatarStyle={partner.avatar_style} size={26} />
                                <span className="ad-heading" style={{ fontSize: '0.88rem', color: '#ede9e3' }}>{partner.full_name}</span>
                                {partnerEngagements && (
                                    <span style={{ fontSize: '0.72rem', color: 'rgba(237,233,227,0.35)', marginLeft: 'auto', fontWeight: 600 }}>
                                        {partnerEngagements.items.filter((i: any) => i.done).length}/{partnerEngagements.items.length} faits
                                    </span>
                                )}
                            </div>

                            {partnerEngagements ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {partnerEngagements.items.map((item: any, idx: number) => (
                                        <div key={idx} className="ad-eng-item" style={{ borderColor: item.done ? 'rgba(94,234,212,0.15)' : undefined, opacity: item.done ? 0.7 : 1 }}>
                                            {item.done ? <CheckCircle size={16} style={{ color: '#5eead4', flexShrink: 0, marginTop: 2 }} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(237,233,227,0.12)', flexShrink: 0, marginTop: 2 }} />}
                                            <span style={{ fontSize: '0.88rem', color: item.done ? 'rgba(237,233,227,0.4)' : '#ede9e3', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                                                {item.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '1.5rem', textAlign: 'center', borderRadius: 14, border: '1px dashed rgba(200,169,96,0.1)' }}>
                                    <p style={{ fontSize: '0.82rem', color: 'rgba(237,233,227,0.3)', margin: 0 }}>
                                        {partner.full_name} n&apos;a pas encore declare ses engagements cette semaine
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Past weeks */}
                        {pastWeekEngagements.length > 0 && (
                            <div className="ad-card">
                                <span className="ad-heading" style={{ fontSize: '0.85rem', color: 'rgba(237,233,227,0.45)', display: 'block', marginBottom: 14 }}>Semaines precedentes</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {pastWeekEngagements.map(([week, engs]) => {
                                        const isExpanded = expandedWeeks.has(week);
                                        const allItems = engs.flatMap((e: any) => e.items || []);
                                        const doneCount = allItems.filter((i: any) => i.done).length;
                                        return (
                                            <div key={week}>
                                                <button onClick={() => {
                                                    const next = new Set(expandedWeeks);
                                                    if (isExpanded) next.delete(week); else next.add(week);
                                                    setExpandedWeeks(next);
                                                }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 12, background: 'rgba(200,169,96,0.03)', border: '1px solid rgba(200,169,96,0.08)', cursor: 'pointer', color: 'rgba(237,233,227,0.5)', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-body), system-ui' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <span>{week}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: doneCount === allItems.length && allItems.length > 0 ? '#5eead4' : 'rgba(237,233,227,0.3)' }}>
                                                        {doneCount}/{allItems.length}
                                                    </span>
                                                </button>
                                                {isExpanded && (
                                                    <div style={{ paddingLeft: 16, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {engs.map((eng: any) => (
                                                            <div key={eng.id}>
                                                                <div style={{ fontSize: '0.7rem', color: 'rgba(200,169,96,0.4)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.04em' }}>
                                                                    {eng.uid === user!.uid ? 'Vous' : partner.full_name}
                                                                </div>
                                                                {eng.items.map((item: any, idx: number) => (
                                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                                                        {item.done ? <CheckCircle size={13} style={{ color: '#5eead4', flexShrink: 0 }} /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid rgba(237,233,227,0.12)', flexShrink: 0 }} />}
                                                                        <span style={{ fontSize: '0.8rem', color: item.done ? 'rgba(237,233,227,0.38)' : 'rgba(237,233,227,0.6)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: COWORKING ── */}
                {activeTab === 'coworking' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'ad-in 0.35s ease' }}>
                        {/* Presence + Join/Leave */}
                        <div className="ad-card" style={{ borderColor: 'rgba(94,234,212,0.15)', background: 'linear-gradient(135deg, rgba(94,234,212,0.03) 0%, rgba(14,14,20,0.95) 100%)' }}>
                            <div className="ad-section-label" style={{ marginBottom: 14 }}>
                                <Video size={15} style={{ color: '#5eead4' }} />
                                <span className="ad-heading" style={{ fontSize: '0.88rem', color: '#5eead4' }}>Session live</span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                                {[{ label: 'Vous', active: amInSession }, { label: partner.full_name, active: partnerInSession }].map(({ label, active }) => (
                                    <div key={label} className="ad-presence-pill" style={{ borderColor: active ? 'rgba(94,234,212,0.25)' : 'rgba(200,169,96,0.08)', background: active ? 'rgba(94,234,212,0.06)' : 'rgba(237,233,227,0.02)' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#5eead4' : 'rgba(237,233,227,0.15)', boxShadow: active ? '0 0 8px rgba(94,234,212,0.5)' : 'none', flexShrink: 0, display: 'inline-block', ...(active ? { animation: 'ad-pulse 2s ease infinite' } : {}) }} />
                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: active ? '#5eead4' : 'rgba(237,233,227,0.35)' }}>{label}</span>
                                    </div>
                                ))}
                            </div>
                            {!amInSession ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {isWorkingGlobal ? (
                                        <div style={{ padding: '12px', borderRadius: 13, border: '1px solid rgba(237,233,227,0.07)', background: 'rgba(237,233,227,0.02)', color: 'rgba(237,233,227,0.3)', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center' }}>
                                            Session active ailleurs sur la plateforme
                                        </div>
                                    ) : (
                                        <>
                                            {/* Primary: work alone, timer only */}
                                            <button onClick={handleJoinCoworking} style={{ width: '100%', padding: '12px', borderRadius: 13, border: '1px solid rgba(200,169,96,0.3)', background: 'rgba(200,169,96,0.08)', color: '#c8a960', fontFamily: 'var(--font-display), system-ui', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.25s' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,169,96,0.15)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,169,96,0.08)'; }}>
                                                <Play size={14} /> Je commence à travailler
                                            </button>
                                            {/* Secondary: work + start a call */}
                                            <button
                                                onClick={() => { handleJoinCoworking(); handleInitiateCall(); }}
                                                disabled={isOnCall}
                                                style={{ width: '100%', padding: '10px', borderRadius: 13, border: '1px solid rgba(94,234,212,0.2)', background: 'rgba(94,234,212,0.05)', color: '#5eead4', fontFamily: 'var(--font-display), system-ui', fontSize: '0.8rem', fontWeight: 600, cursor: isOnCall ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.25s', opacity: isOnCall ? 0.5 : 1 }}
                                                onMouseEnter={e => { if (!isOnCall) e.currentTarget.style.background = 'rgba(94,234,212,0.1)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(94,234,212,0.05)'; }}>
                                                <Video size={13} /> Commencer avec un appel vidéo
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {/* Start a call if not already on one */}
                                    {!isOnCall && (
                                        <button onClick={handleInitiateCall} style={{ flex: 1, padding: '10px', borderRadius: 13, border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#5eead4', fontFamily: 'var(--font-display), system-ui', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(94,234,212,0.13)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(94,234,212,0.07)'; }}>
                                            <Video size={13} /> Rejoindre l&apos;appel
                                        </button>
                                    )}
                                    <button onClick={handleLeaveCoworking} className="ad-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                                        <X size={14} /> Quitter la session
                                    </button>
                                </div>
                            )}
                            {amInSession && partnerInSession && (
                                <div style={{ marginTop: 10, padding: '9px 14px', borderRadius: 11, background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.15)', fontSize: '0.8rem', color: '#5eead4', textAlign: 'center', fontWeight: 600 }}>
                                    Vous êtes en session ensemble !
                                </div>
                            )}
                        </div>

                        {/* Pomodoro timer */}
                        {amInSession && (
                            <div className="ad-card" style={{ borderColor: `${timerColor}25`, background: `${timerColor}05`, padding: '26px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Timer size={15} style={{ color: timerColor }} />
                                        <span className="ad-heading" style={{ fontSize: '0.88rem', color: timerColor }}>Focus partage</span>
                                    </div>
                                    <button onClick={() => setShowTimerSettings(v => !v)}
                                        style={{ background: showTimerSettings ? 'rgba(200,169,96,0.15)' : 'rgba(237,233,227,0.04)', border: `1px solid ${showTimerSettings ? 'rgba(200,169,96,0.3)' : 'rgba(200,169,96,0.08)'}`, borderRadius: 9, color: showTimerSettings ? '#c8a960' : 'rgba(237,233,227,0.3)', padding: '6px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}>
                                        <Settings2 size={13} />
                                    </button>
                                </div>

                                {showTimerSettings && (
                                    <div style={{ background: 'rgba(200,169,96,0.04)', border: '1px solid rgba(200,169,96,0.12)', borderRadius: 14, padding: '16px', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <span className="ad-label" style={{ margin: 0 }}>Durees (minutes)</span>
                                        {(['focus', 'short', 'long'] as const).map(key => (
                                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <span style={{ fontSize: '0.75rem', color: POMODORO_COLORS[key], fontWeight: 700, width: 80 }}>{POMODORO_LABELS[key]}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <button onClick={() => setDraftDurations(d => ({ ...d, [key]: Math.max(1, d[key] - 1) }))} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(200,169,96,0.1)', background: 'rgba(200,169,96,0.04)', color: 'rgba(237,233,227,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>−</button>
                                                    <input type="text" inputMode="numeric" value={draftDurations[key]} onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, '') || '1'); setDraftDurations(d => ({ ...d, [key]: Math.min(180, Math.max(1, n)) })); }} style={{ width: 44, textAlign: 'center', background: 'rgba(237,233,227,0.05)', border: '1px solid rgba(200,169,96,0.12)', borderRadius: 7, color: '#ede9e3', fontSize: '0.88rem', fontWeight: 700, padding: '4px 2px', outline: 'none', fontFamily: 'var(--font-body), system-ui' }} />
                                                    <button onClick={() => setDraftDurations(d => ({ ...d, [key]: Math.min(180, d[key] + 1) }))} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(200,169,96,0.1)', background: 'rgba(200,169,96,0.04)', color: 'rgba(237,233,227,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>+</button>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={handleApplyDurations} style={{ marginTop: 4, padding: '8px', borderRadius: 9, border: 'none', background: 'rgba(200,169,96,0.2)', color: '#c8a960', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body), system-ui' }}>
                                            Appliquer (synchronise)
                                        </button>
                                    </div>
                                )}

                                {/* Mode tabs */}
                                <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
                                    {Object.entries(POMODORO_LABELS).map(([key, label]) => (
                                        <button key={key} onClick={() => handleSwitchMode(key)} className="ad-mode-btn"
                                            style={{ background: viewMode === key ? `${POMODORO_COLORS[key]}18` : 'rgba(200,169,96,0.03)', color: viewMode === key ? POMODORO_COLORS[key] : 'rgba(237,233,227,0.35)', boxShadow: viewMode === key ? `0 0 0 1px ${POMODORO_COLORS[key]}40` : 'none' }}>
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Circle timer */}
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                                    <div style={{ animation: showAnim ? 'pulse-ring-acc 1s ease-out 3' : 'none', borderRadius: '50%', position: 'relative' }}>
                                        <CircleTimer remaining={displayRemaining} total={displayDuration} color={timerColor} running={displayRunning} />
                                        <CelebrationBurst show={showAnim} />
                                    </div>
                                </div>

                                {/* Controls */}
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <button onClick={handleTimerReset} title="Reinitialiser"
                                        style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(200,169,96,0.08)', background: 'rgba(200,169,96,0.03)', color: 'rgba(237,233,227,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: isActiveMode ? 1 : 0.3, transition: 'all 0.2s' }}
                                        onMouseEnter={e => { if (isActiveMode) e.currentTarget.style.background = 'rgba(200,169,96,0.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,169,96,0.03)'; }}>
                                        <RotateCcw size={13} />
                                    </button>
                                    <button onClick={handleToggleTimer}
                                        style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${timerColor}, ${timerColor}bb)`, color: '#0b0b0d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 28px ${timerColor}44`, transition: 'transform 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                                        {displayRunning ? <Pause size={18} style={{ fill: '#0b0b0d' }} /> : <Play size={18} style={{ fill: '#0b0b0d', marginLeft: 2 }} />}
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.68rem', color: 'rgba(237,233,227,0.2)', textAlign: 'center', margin: 0 }}>Synchronise avec {partner.full_name}</p>
                            </div>
                        )}

                        {!amInSession && (
                            <div style={{ padding: '2.5rem 2rem', textAlign: 'center', borderRadius: 20, border: '1px dashed rgba(200,169,96,0.1)' }}>
                                <Video size={30} style={{ margin: '0 auto 12px', color: 'rgba(200,169,96,0.12)', display: 'block' }} />
                                <p style={{ color: 'rgba(237,233,227,0.25)', fontSize: '0.85rem', margin: 0 }}>Rejoignez la session pour acceder au minuteur partage</p>
                            </div>
                        )}

                        {/* Session log */}
                        {cwLog.length > 0 && (
                            <div className="ad-card">
                                <span className="ad-heading" style={{ fontSize: '0.82rem', color: 'rgba(237,233,227,0.4)', marginBottom: 14, display: 'block' }}>Historique recent</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                    {cwLog.map((entry, i) => {
                                        const mins = Math.round(entry.duration_seconds / 60);
                                        const date = entry.started_at?.toDate ? entry.started_at.toDate() : new Date();
                                        return (
                                            <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < cwLog.length - 1 ? '1px solid rgba(200,169,96,0.06)' : 'none' }}>
                                                <div>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(237,233,227,0.65)' }}>{entry.user_name}</span>
                                                    <span style={{ fontSize: '0.72rem', color: 'rgba(237,233,227,0.28)', marginLeft: 8 }}>{POMODORO_LABELS[entry.mode] ?? 'Focus'}</span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span className="ad-mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: POMODORO_COLORS[entry.mode] ?? '#c8a960' }}>{mins}min</span>
                                                    <div style={{ fontSize: '0.63rem', color: 'rgba(237,233,227,0.22)' }}>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                </div>{/* close ad-main-col */}

                {/* ── Chat column (right) ── */}
                <div className="ad-chat-col">
                    <div className="ad-chat-header">
                        <MessageCircle size={15} style={{ color: '#c8a960' }} />
                        <span className="ad-heading" style={{ fontSize: '0.82rem', color: '#ede9e3' }}>Chat</span>
                    </div>
                    <div className="ad-chat-body">
                        {chatMessages.length === 0 ? (
                            <div className="ad-chat-empty">
                                <MessageCircle size={24} />
                                <span style={{ fontSize: '0.78rem' }}>Demarrez la conversation</span>
                            </div>
                        ) : (
                            chatMessages.map(msg => {
                                const isMine = msg.uid === user!.uid;
                                return (
                                    <div key={msg.id} className={`ad-chat-msg ${isMine ? 'ad-chat-msg-mine' : 'ad-chat-msg-partner'}`}>
                                        {!isMine && <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5eead4', marginBottom: 2 }}>{msg.user_name}</div>}
                                        {msg.content && <div>{msg.content}</div>}
                                        {msg.file_url && <AccFileCard fileUrl={msg.file_url} fileName={msg.file_name} fileType={msg.file_type} fileSize={msg.file_size} />}
                                        {msg.created_at?.toDate && (
                                            <div style={{ fontSize: '0.6rem', color: 'rgba(237,233,227,0.2)', marginTop: 3, textAlign: isMine ? 'right' : 'left' }}>
                                                {msg.created_at.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    {/* File preview */}
                    <div style={{ padding: chatFile || chatUploadProgress !== null ? '8px 12px 0' : 0 }}>
                        {chatFile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', marginBottom: 4, borderRadius: 10, background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.12)' }}>
                                {chatFile.type.startsWith('image/') ? <Upload size={13} style={{ color: '#c8a960', flexShrink: 0 }} /> : <FileText size={13} style={{ color: '#c8a960', flexShrink: 0 }} />}
                                <span style={{ flex: 1, fontSize: '0.72rem', color: 'rgba(237,233,227,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatFile.name}</span>
                                <span style={{ fontSize: '0.6rem', color: 'rgba(237,233,227,0.2)', flexShrink: 0 }}>{(chatFile.size / 1024).toFixed(0)} Ko</span>
                                <button type="button" onClick={() => setChatFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,233,227,0.3)', padding: 2, display: 'flex' }}><X size={12} /></button>
                            </div>
                        )}
                        {chatUploadProgress !== null && (
                            <div style={{ marginBottom: 4, borderRadius: 3, height: 3, background: 'rgba(200,169,96,0.1)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${chatUploadProgress}%`, background: '#c8a960', borderRadius: 3, transition: 'width 0.2s' }} />
                            </div>
                        )}
                    </div>
                    <div className="ad-chat-input-wrap">
                        <input type="file" ref={chatFileInputRef} onChange={handleChatFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.json,.txt,.csv" />
                        <button type="button" onClick={() => chatFileInputRef.current?.click()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: chatFile ? '#c8a960' : 'rgba(237,233,227,0.25)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s', flexShrink: 0 }}
                            title="Joindre un fichier">
                            <Paperclip size={15} />
                        </button>
                        <input
                            className="ad-chat-input"
                            placeholder="Message..."
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                        />
                        <button className="ad-chat-send" onClick={handleSendChat} disabled={(!chatInput.trim() && !chatFile) || sendingChat}>
                            <Send size={14} />
                        </button>
                    </div>
                </div>

                </div>{/* close ad-layout */}

            </div>
        </div>

        {/* ── Focus Guard overlay ── */}
        {(focusGuardMsg || focusGuardLoading) && (
            <>
                <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', width: 'min(420px, calc(100vw - 40px))', zIndex: 9998, background: 'rgba(14,14,20,0.99)', border: '1px solid rgba(200,169,96,0.25)', borderRadius: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(200,169,96,0.1)', animation: 'fgSlideIn 0.32s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,169,96,0.5), rgba(94,234,212,0.3), transparent)' }} />
                    <div style={{ padding: '18px 20px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(200,169,96,0.12)', border: '1px solid rgba(200,169,96,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={14} color="#c8a960" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c8a960', fontFamily: 'var(--font-display), system-ui' }}>Focus Guard</div>
                                    <div style={{ fontSize: '0.58rem', color: 'rgba(237,233,227,0.25)' }}>Coach anti-procrastination</div>
                                </div>
                            </div>
                            <button onClick={() => { setFocusGuardMsg(null); setFocusGuardSubtasks([]); pauseCountRef.current = 0; }} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(200,169,96,0.1)', background: 'rgba(200,169,96,0.04)', color: 'rgba(237,233,227,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <X size={11} />
                            </button>
                        </div>
                        {focusGuardLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(200,169,96,0.05)' }}>
                                <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #c8a960', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                                <span style={{ fontSize: '0.82rem', color: 'rgba(237,233,227,0.4)' }}>Analyse ta session...</span>
                            </div>
                        ) : (
                            <>
                                <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'rgba(237,233,227,0.75)', lineHeight: 1.55, padding: '12px 14px', borderRadius: 12, background: 'rgba(200,169,96,0.05)', border: '1px solid rgba(200,169,96,0.1)' }}>{focusGuardMsg}</p>
                                {focusGuardSubtasks.length > 0 && (
                                    <div style={{ marginBottom: 14 }}>
                                        <div className="ad-label" style={{ marginBottom: 8 }}>3 sous-taches pour demarrer</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            {focusGuardSubtasks.map((task, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(200,169,96,0.03)', border: '1px solid rgba(200,169,96,0.06)' }}>
                                                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 6, background: 'rgba(200,169,96,0.15)', color: '#c8a960', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                                    <span style={{ fontSize: '0.8rem', color: 'rgba(237,233,227,0.6)', lineHeight: 1.4 }}>{task}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => { setFocusGuardMsg(null); setFocusGuardSubtasks([]); pauseCountRef.current = 0; handleTimerStart(); }} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #c8a960, #d4b872)', color: '#0b0b0d', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display), system-ui' }}>Je continue !</button>
                                    <button onClick={() => { setFocusGuardMsg(null); setFocusGuardSubtasks([]); pauseCountRef.current = 0; }} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(200,169,96,0.1)', background: 'rgba(200,169,96,0.04)', color: 'rgba(237,233,227,0.38)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--font-body), system-ui' }}>Fermer</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </>
        )}
        </>
    );
}

export default function AccountabilityDetailPage() {
    return (
        <Suspense fallback={<div className="container py-16 text-center fade-enter" style={{ maxWidth: '980px' }}><div style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>}>
            <AccountabilityDetailContent />
        </Suspense>
    );
}
