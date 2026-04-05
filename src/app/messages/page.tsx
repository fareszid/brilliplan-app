'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc,
    onSnapshot, orderBy, Timestamp, setDoc, limit, updateDoc, writeBatch, increment
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import Avatar from '@/components/Avatar';
import { useCall } from '@/context/CallContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, Send, Users, Phone, Video, Search, Paperclip, X, FileText, Image as ImageIcon, Download, Target, Briefcase } from 'lucide-react';
import { validateFileUpload } from '@/lib/uploadValidation';
import { useBlock } from '@/context/BlockContext';

function getConvId(uid1: string, uid2: string) {
    return [uid1, uid2].sort().join('_');
}

function relativeTime(date: Date): string {
    const now     = new Date();
    const diffMs  = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH   = Math.floor(diffMin / 60);
    const diffD   = Math.floor(diffH / 24);
    if (diffMin < 1)  return 'maintenant';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffH < 24)   return `${diffH}h`;
    if (diffD === 1)  return 'hier';
    if (diffD < 7)    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatDateLabel(date: Date): string {
    const now       = new Date();
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDay    = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (msgDay.getTime() === today.getTime())     return "Aujourd'hui";
    if (msgDay.getTime() === yesterday.getTime()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
}

// ── Inline file/image preview inside messages ──
const IMAGE_URL_RE = /https?:\/\/[^\s]+?\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?[^\s]*)?/gi;
const FILE_URL_RE = /https?:\/\/[^\s]+?\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|mp3|mp4|mov)(\?[^\s]*)?/gi;
const URL_RE = /https?:\/\/[^\s]+/g;

function fmtFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function ChatFileCard({ fileUrl, fileName, fileType, fileSize, isMe }: {
    fileUrl: string; fileName?: string; fileType?: string; fileSize?: number; isMe: boolean;
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
        } catch { /* no fallback — avoids exposing Firebase URL */ }
    };

    if (isImage) {
        return (
            <div style={{ marginTop: 6, maxWidth: 280, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                onClick={handleDownload}>
                <img src={fileUrl} alt={name} style={{ width: '100%', display: 'block', borderRadius: 12 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '20px 10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                }}>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <Download size={13} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                </div>
            </div>
        );
    }

    return (
        <div onClick={handleDownload} style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 6,
            padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            background: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(200,169,96,0.06)',
            border: `1px solid ${isMe ? 'rgba(255,255,255,0.15)' : 'rgba(200,169,96,0.12)'}`,
            maxWidth: 280, transition: 'background 0.15s',
        }}
            onMouseEnter={e => e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.15)' : 'rgba(200,169,96,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.1)' : 'rgba(200,169,96,0.06)'}
        >
            <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(200,169,96,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.58rem', fontWeight: 800,
                color: isMe ? '#fff' : '#c8a960', flexShrink: 0,
            }}>
                {ext}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.8rem', fontWeight: 600,
                    color: isMe ? 'rgba(255,255,255,0.9)' : 'rgba(237,233,227,0.75)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {name}
                </div>
                {fileSize != null && (
                    <div style={{ fontSize: '0.65rem', color: isMe ? 'rgba(255,255,255,0.45)' : 'rgba(237,233,227,0.3)', marginTop: 1 }}>
                        {fmtFileSize(fileSize)}
                    </div>
                )}
            </div>
            <Download size={15} style={{ color: isMe ? 'rgba(255,255,255,0.5)' : 'rgba(200,169,96,0.5)', flexShrink: 0 }} />
        </div>
    );
}

const FIREBASE_URL_RE = /https?:\/\/firebasestorage\.googleapis\.com[^\s]*/;

async function blobDownload(url: string, name: string) {
    try {
        const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    } catch { /* silent — no window.open to avoid exposing Firebase URL */ }
}

function MessageContent({ content, isMe }: { content: string; isMe: boolean }) {
    const imageUrls: string[] = content.match(IMAGE_URL_RE) || [];
    const fileUrls = (content.match(FILE_URL_RE) || [] as string[]).filter(u => !imageUrls.includes(u));
    // Strip Firebase Storage URLs entirely from text (they're rendered as file cards or handled by file_url field)
    const textWithoutMedia = content
        .replace(IMAGE_URL_RE, '')
        .replace(FILE_URL_RE, '')
        .replace(/https?:\/\/firebasestorage\.googleapis\.com[^\s]*/g, '')
        .trim();

    // Make remaining URLs clickable (non-Firebase only)
    const renderText = (text: string) => {
        if (!text) return null;
        const parts = text.split(URL_RE);
        const urls = text.match(URL_RE) || [];
        const result: React.ReactNode[] = [];
        parts.forEach((part, i) => {
            if (part) result.push(part);
            if (urls[i] && !FIREBASE_URL_RE.test(urls[i])) {
                result.push(
                    <a key={i} href={urls[i]} target="_blank" rel="noopener noreferrer"
                        style={{ color: isMe ? 'rgba(255,255,255,0.85)' : '#c8a960', textDecoration: 'underline', textUnderlineOffset: 2 }}
                        onClick={e => e.stopPropagation()}>
                        {urls[i].length > 50 ? urls[i].slice(0, 50) + '…' : urls[i]}
                    </a>
                );
            }
        });
        return <>{result}</>;
    };

    return (
        <>
            {textWithoutMedia && <div>{renderText(textWithoutMedia)}</div>}
            {imageUrls.map((url, i) => (
                <div key={`img-${i}`} style={{ marginTop: 6, borderRadius: 10, overflow: 'hidden', maxWidth: 280 }}>
                    <img
                        src={url}
                        alt="Image partagée"
                        style={{ width: '100%', display: 'block', borderRadius: 10, cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'image');
                            blobDownload(url, name);
                        }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                </div>
            ))}
            {fileUrls.map((url, i) => {
                const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Fichier');
                const ext = fileName.split('.').pop()?.toUpperCase() || '';
                return (
                    <div key={`file-${i}`}
                        onClick={e => { e.stopPropagation(); blobDownload(url, fileName); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
                            padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                            background: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(200,169,96,0.08)',
                            border: `1px solid ${isMe ? 'rgba(255,255,255,0.15)' : 'rgba(200,169,96,0.15)'}`,
                            maxWidth: 280, transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.15)' : 'rgba(200,169,96,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.1)' : 'rgba(200,169,96,0.08)'}
                    >
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(200,169,96,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 800, color: isMe ? '#fff' : '#c8a960',
                            flexShrink: 0,
                        }}>
                            {ext}
                        </div>
                        <span style={{
                            fontSize: '0.78rem', fontWeight: 500,
                            color: isMe ? 'rgba(255,255,255,0.9)' : 'rgba(237,233,227,0.7)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {fileName.length > 30 ? fileName.slice(0, 30) + '…' : fileName}
                        </span>
                        <Download size={14} style={{ color: isMe ? 'rgba(255,255,255,0.4)' : 'rgba(200,169,96,0.4)', flexShrink: 0 }} />
                    </div>
                );
            })}
        </>
    );
}

interface ConvPreview {
    convId:          string;
    friendUid:       string;
    friendProfile:   any;
    lastMessage?:    string;
    lastTime?:       Date;
    unread:          number;
    lastSenderId?:   string;
    lastRead?:       boolean;
}

interface SalonPreview {
    id:           string;
    type:         'objective' | 'project';
    title:        string;
    lastMessage?: string;
    lastTime?:    Date;
    lastSenderName?: string;
    unread:       number;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
// Transparent bases let the global gradient orbs from layout.tsx show through,
// matching the background colour visible around the top navbar.
const C = {
    base:              'transparent',
    sidebar:           'rgba(9,9,11,0.30)',
    sidebarHead:       'rgba(9,9,11,0.35)',
    chat:              'transparent',
    header:            'rgba(9,9,11,0.55)',
    inputBar:          'rgba(9,9,11,0.55)',

    border:            'rgba(255,255,255,0.055)',
    borderCard:        'rgba(255,255,255,0.07)',
    borderCardHover:   'rgba(255,255,255,0.12)',

    // My messages — deep indigo glass
    meBubble1:         '#b89a50',
    meBubble2:         '#6d28d9',

    // Their messages — dark glass
    themBubble:        'rgba(255,255,255,0.042)',
    themBubbleBorder:  'rgba(255,255,255,0.085)',

    textPrimary:       '#eeeeef',
    textSecondary:     'rgba(238,238,239,0.5)',
    textMuted:         'rgba(238,238,239,0.26)',

    accent:            '#c8a960',
    accentSoft:        'rgba(200,169,96,0.10)',
    accentBorder:      'rgba(200,169,96,0.28)',
    accentGlow:        'rgba(200,169,96,0.13)',
    accentGlowStrong:  'rgba(200,169,96,0.22)',

    online:            '#22c55e',
};

const SIDEBAR_W = 320;

// ─────────────────────────────────────────────────────────────────────────────

function MessagesContent() {
    const { user }     = useAuth();
    const { t }        = useLocale();
    const router       = useRouter();
    const searchParams = useSearchParams();
    const { isBlocked } = useBlock();

    const [conversations, setConversations] = useState<ConvPreview[]>([]);
    const [activeConv,    setActiveConv]    = useState<string | null>(searchParams.get('conv'));
    const [activeProfile, setActiveProfile] = useState<any>(null);
    const [messages,      setMessages]      = useState<any[]>([]);
    const [newMsg,        setNewMsg]        = useState('');
    const [loading,       setLoading]       = useState(true);
    const [sending,       setSending]       = useState(false);
    const [pendingFile,   setPendingFile]   = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hoverMsgId,    setHoverMsgId]    = useState<string | null>(null);
    const [search,        setSearch]        = useState('');
    const [friendLastSeen, setFriendLastSeen] = useState(0);
    const [presenceMap, setPresenceMap] = useState<Record<string, number>>({}); // uid -> last_seen ms
    const [now, setNow] = useState(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [salonPreviews, setSalonPreviews] = useState<SalonPreview[]>([]);
    const salonUnsubsRef = useRef<(() => void)[]>([]);

    const { startCall }   = useCall();
    const QUICK_REACTIONS = ['👍', '🔥', '🚀', '❤️', '🙌', '👀'];

    // ── Real-time conversations list ────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const q1 = query(collection(db, 'friendships'), where('user1_id', '==', user.uid));
        const q2 = query(collection(db, 'friendships'), where('user2_id', '==', user.uid));

        let snap1Docs: any[] = [];
        let snap2Docs: any[] = [];
        let gotFirst = false;
        let initialLoad = true;

        const processConversations = async () => {
            try {
                const seen = new Set<string>();
                const allDocs = [...snap1Docs, ...snap2Docs].filter(d => {
                    if (seen.has(d.id)) return false;
                    seen.add(d.id);
                    return true;
                });

                const convs: ConvPreview[] = [];
                for (const fdoc of allDocs) {
                    const data = fdoc.data();
                    if (data.status !== 'accepted') continue;
                    const friendUid = data.user1_id === user.uid ? data.user2_id : data.user1_id;
                    const convId = getConvId(user.uid, friendUid);

                    try {
                        const userDoc = await getDoc(doc(db, 'users', friendUid));
                        const profile = userDoc.exists()
                            ? { id: userDoc.id, ...userDoc.data() }
                            : { id: friendUid, full_name: 'Utilisateur', email: '' };
                        // message preview will be filled by the real-time preview effect
                        convs.push({ convId, friendUid, friendProfile: profile, unread: 0 });
                    } catch (friendErr) {
                        console.error('Error loading friend for conv', friendUid, friendErr);
                    }
                }

                convs.sort((a, b) => (b.lastTime?.getTime() ?? 0) - (a.lastTime?.getTime() ?? 0));
                setConversations(convs);

                if (initialLoad) {
                    initialLoad = false;
                    const toParam = searchParams.get('to');
                    const convParam = searchParams.get('conv');
                    if (convParam && toParam) {
                        setActiveConv(convParam);
                        const existing = convs.find(c => c.convId === convParam);
                        if (existing) {
                            setActiveProfile(existing.friendProfile);
                        } else {
                            const uDoc = await getDoc(doc(db, 'users', toParam));
                            if (uDoc.exists()) setActiveProfile({ id: uDoc.id, ...uDoc.data() });
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading conversations', err);
            } finally {
                setLoading(false);
            }
        };

        const unsub1 = onSnapshot(q1, (snap) => { snap1Docs = snap.docs; if (gotFirst) processConversations(); gotFirst = true; });
        const unsub2 = onSnapshot(q2, (snap) => { snap2Docs = snap.docs; if (gotFirst) processConversations(); gotFirst = true; });

        return () => { unsub1(); unsub2(); };
    }, [user]);

    // ── Real-time messages ──────────────────────────────────────────────────
    useEffect(() => {
        if (!activeConv) { setMessages([]); return; }
        const q     = query(collection(db, 'direct_messages', activeConv, 'messages'), orderBy('created_at', 'asc'));
        const unsub = onSnapshot(q, snap => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [activeConv]);

    // ── Salon chats (objectives + projects) ──────────────────────────────
    useEffect(() => {
        if (!user) return;

        const load = async () => {
            // Fetch all memberships
            const [memSnap, projMemSnap] = await Promise.all([
                getDocs(query(collection(db, 'memberships'), where('user_id', '==', user.uid))),
                getDocs(query(collection(db, 'project_memberships'), where('user_id', '==', user.uid))),
            ]);

            const objIds  = memSnap.docs.map(d => d.data().objective_id as string).filter(Boolean);
            const projIds = projMemSnap.docs.map(d => d.data().project_id as string).filter(Boolean);

            // Unsub old listeners
            salonUnsubsRef.current.forEach(u => u());
            salonUnsubsRef.current = [];

            const salonsMap = new Map<string, SalonPreview>();

            // Helper: attach listener for a room's messages subcollection
            const attachListener = (roomId: string, type: 'objective' | 'project', title: string) => {
                const colPath = type === 'objective' ? 'objectives' : 'projects';
                const q = query(
                    collection(db, colPath, roomId, 'messages'),
                    orderBy('created_at', 'desc'),
                    limit(1),
                );
                const unsub = onSnapshot(q, snap => {
                    const last = snap.docs[0]?.data();
                    // Count unread: messages not sent by me, created after last_read_at (use local session — just track by sender != me)
                    const preview: SalonPreview = {
                        id:              roomId,
                        type,
                        title,
                        lastMessage:     last?.file_url ? (last?.content || '📎 Fichier') : (last?.content ?? undefined),
                        lastTime:        last?.created_at?.toDate?.() ?? undefined,
                        lastSenderName:  last?.sender_name ?? undefined,
                        unread:          salonsMap.get(roomId)?.unread ?? 0,
                    };
                    salonsMap.set(roomId, preview);
                    setSalonPreviews(Array.from(salonsMap.values()).sort(
                        (a, b) => (b.lastTime?.getTime() ?? 0) - (a.lastTime?.getTime() ?? 0),
                    ));
                });
                salonUnsubsRef.current.push(unsub);
            };

            // Load titles for objectives
            await Promise.all(objIds.slice(0, 20).map(async (oid) => {
                try {
                    const d = await getDoc(doc(db, 'objectives', oid));
                    if (d.exists()) attachListener(oid, 'objective', d.data().title || 'Objectif');
                } catch { /* skip */ }
            }));

            // Load titles for projects
            await Promise.all(projIds.slice(0, 20).map(async (pid) => {
                try {
                    const d = await getDoc(doc(db, 'projects', pid));
                    if (d.exists()) attachListener(pid, 'project', d.data().name || d.data().title || 'Projet');
                } catch { /* skip */ }
            }));
        };

        load();
        return () => { salonUnsubsRef.current.forEach(u => u()); };
    }, [user?.uid]);

    // ── Real-time message previews for each conversation ─────────────────
    useEffect(() => {
        if (!user || conversations.length === 0) return;
        const unsubs = conversations.map(conv => {
            const q = query(
                collection(db, 'direct_messages', conv.convId, 'messages'),
                orderBy('created_at', 'desc'),
                limit(1),
            );
            return onSnapshot(q, snap => {
                const last = snap.docs[0]?.data();
                // Count unread from friend
                const unreadQ = query(
                    collection(db, 'direct_messages', conv.convId, 'messages'),
                    where('sender_id', '==', conv.friendUid),
                    where('read', '==', false),
                );
                getDocs(unreadQ).then(us => {
                    setConversations(prev => {
                        const updated = prev.map(c => c.convId !== conv.convId ? c : {
                            ...c,
                            lastMessage:  last?.file_url ? (last?.content || '📎 Fichier') : (last?.content ?? undefined),
                            lastTime:     last?.created_at?.toDate?.() ?? undefined,
                            lastSenderId: last?.sender_id ?? undefined,
                            lastRead:     last?.read ?? false,
                            unread:       us.size,
                        });
                        return updated.sort((a, b) => (b.lastTime?.getTime() ?? 0) - (a.lastTime?.getTime() ?? 0));
                    });
                }).catch(() => {
                    setConversations(prev => prev.map(c => c.convId !== conv.convId ? c : {
                        ...c,
                        lastMessage:  last?.file_url ? (last?.content || '📎 Fichier') : (last?.content ?? undefined),
                        lastTime:     last?.created_at?.toDate?.() ?? undefined,
                        lastSenderId: last?.sender_id ?? undefined,
                        lastRead:     last?.read ?? false,
                    }));
                });
            });
        });
        return () => unsubs.forEach(u => u());
    }, [conversations.map(c => c.convId).join(','), user?.uid]);

    // ── All friends' presence (for sidebar dots) ──────────────────────────
    useEffect(() => {
        if (conversations.length === 0) return;
        const unsubs = conversations.map(conv => {
            return onSnapshot(doc(db, 'presence_global', conv.friendUid), snap => {
                const ls = snap.exists() ? (snap.data().last_seen?.toMillis?.() ?? 0) : 0;
                setPresenceMap(prev => ({ ...prev, [conv.friendUid]: ls }));
            });
        });
        return () => unsubs.forEach(u => u());
    }, [conversations]);

    // ── Active friend presence (for chat header) ────────────────────────
    useEffect(() => {
        const friendUid = activeProfile?.id;
        if (!friendUid) { setFriendLastSeen(0); return; }
        // Already tracked in presenceMap, but also keep dedicated state for header
        const unsub = onSnapshot(doc(db, 'presence_global', friendUid), snap => {
            if (!snap.exists()) { setFriendLastSeen(0); return; }
            setFriendLastSeen(snap.data().last_seen?.toMillis?.() ?? 0);
        });
        return () => unsub();
    }, [activeProfile?.id]);

    // Refresh "now" every 30s so online/offline transitions even without new snapshots
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    const friendOnline = friendLastSeen > 0 && (now - friendLastSeen) < 2 * 60 * 1000;

    const markAsRead = async (convId: string) => {
        if (!user) return;
        try {
            const conv      = conversations.find(c => c.convId === convId);
            const friendUid = conv?.friendUid;
            if (!friendUid) return;
            const unreadQ    = query(collection(db, 'direct_messages', convId, 'messages'), where('sender_id', '==', friendUid), where('read', '==', false));
            const snap       = await getDocs(unreadQ);
            const batch      = writeBatch(db);
            snap.docs.forEach(d => batch.update(d.ref, { read: true }));
            await batch.commit();
            setConversations(prev => prev.map(c => c.convId === convId ? { ...c, unread: 0 } : c));
        } catch (err) { console.error('Error marking as read', err); }
    };

    const selectConversation = (conv: ConvPreview) => {
        setActiveConv(conv.convId);
        setActiveProfile(conv.friendProfile);
        markAsRead(conv.convId);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const err = validateFileUpload(file);
        if (err) { alert(err); return; }
        setPendingFile(file);
        if (e.target) e.target.value = '';
    };

    const handleSend = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const hasText = newMsg.trim().length > 0;
        const hasFile = !!pendingFile;
        if ((!hasText && !hasFile) || !activeConv || !user || newMsg.length > 5000) return;
        setSending(true);
        try {
            let fileData: Record<string, any> = {};
            if (hasFile) {
                const file = pendingFile!;
                const path = `direct_messages/${activeConv}/${user.uid}_${Date.now()}_${file.name}`;
                const sRef = storageRef(storage, path);
                const task = uploadBytesResumable(sRef, file);
                const url: string = await new Promise((resolve, reject) => {
                    task.on('state_changed',
                        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                        reject,
                        async () => { setUploadProgress(null); resolve(await getDownloadURL(task.snapshot.ref)); }
                    );
                });
                fileData = { file_url: url, file_name: file.name, file_type: file.type, file_size: file.size };
                setPendingFile(null);
            }
            const content = newMsg.trim();
            await setDoc(doc(db, 'direct_messages', activeConv), { participants: activeConv.split('_'), updated_at: Timestamp.now() }, { merge: true });
            await addDoc(collection(db, 'direct_messages', activeConv, 'messages'), {
                sender_id: user.uid, content, created_at: Timestamp.now(), read: false, reactions: {},
                ...fileData,
            });
            updateDoc(doc(db, 'users', user.uid), { messages_sent: increment(1) }).catch(console.error);
            setNewMsg('');
            setConversations(prev => prev.map(c => c.convId === activeConv ? { ...c, lastMessage: hasFile ? `📎 ${fileData.file_name}` : content, lastTime: new Date() } : c));
        } catch (err) { console.error('Error sending message', err); } finally { setSending(false); }
    };

    const handleToggleReaction = async (msgId: string, emoji: string) => {
        if (!user || !activeConv) return;
        try {
            const msgRef  = doc(db, 'direct_messages', activeConv, 'messages', msgId);
            const msgSnap = await getDoc(msgRef);
            if (!msgSnap.exists()) return;
            const existing = msgSnap.data().reactions || {};
            const updated: Record<string, string[]> = {};
            for (const [e, uids] of Object.entries(existing)) updated[e] = (uids as string[]).filter(id => id !== user.uid);
            const hasReacted = (existing[emoji] || []).includes(user.uid);
            if (!hasReacted) updated[emoji] = [...(updated[emoji] || []), user.uid];
            await updateDoc(msgRef, { reactions: updated });
        } catch (err) { console.error('Error toggling reaction', err); }
    };

    if (!user) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 6.5rem)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.accentSoft, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                        <MessageCircle size={24} style={{ color: C.accent }} />
                    </div>
                    <h2 style={{ fontWeight: 700, marginBottom: '0.5rem', color: C.textPrimary, fontSize: '1rem' }}>Connectez-vous pour accéder à la messagerie</h2>
                    <button onClick={() => router.push('/login')} style={{ background: `linear-gradient(135deg,${C.meBubble1},${C.meBubble2})`, color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                        Connexion
                    </button>
                </div>
            </div>
        );
    }

    const filteredConvs = (search.trim()
        ? conversations.filter(c => c.friendProfile.full_name?.toLowerCase().includes(search.toLowerCase()))
        : conversations
    ).filter(c => !isBlocked(c.friendUid));
    const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

    return (
        <>
            <style>{`
                @keyframes dm-spin      { to { transform: rotate(360deg); } }
                @keyframes dm-fade-up   { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
                @keyframes dm-blink     { 0%,100%{opacity:1;} 50%{opacity:.35;} }
                @keyframes dm-glow-pulse {
                    0%,100% { box-shadow: 0 0 0 0 rgba(200,169,96,.0), 0 4px 18px rgba(79,70,229,.28), inset 0 1px 0 rgba(255,255,255,.18); }
                    50%     { box-shadow: 0 0 0 3px rgba(200,169,96,.08), 0 4px 18px rgba(79,70,229,.28), inset 0 1px 0 rgba(255,255,255,.18); }
                }

                /* ── Scrollbar ─────────────────────────────────────────── */
                .dm-scroll::-webkit-scrollbar       { width: 3px; }
                .dm-scroll::-webkit-scrollbar-track { background: transparent; }
                .dm-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 99px; }
                .dm-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.14); }

                /* ── Sidebar conversation card ─────────────────────────── */
                .dm-conv-card {
                    transition: background .14s, border-color .14s, box-shadow .14s;
                    cursor: pointer;
                }
                .dm-conv-card:hover {
                    background: rgba(255,255,255,.035) !important;
                    border-color: rgba(255,255,255,.11) !important;
                }

                /* ── Search ────────────────────────────────────────────── */
                .dm-search { transition: border-color .15s, box-shadow .15s; }
                .dm-search:focus {
                    border-color: rgba(200,169,96,.4) !important;
                    box-shadow: 0 0 0 3px rgba(200,169,96,.07) !important;
                    outline: none;
                }
                .dm-search::placeholder { color: rgba(238,238,239,.22); }

                /* ── Input ─────────────────────────────────────────────── */
                .dm-input-ring { transition: border-color .15s, box-shadow .15s; }
                .dm-input-ring:focus-within {
                    border-color: rgba(200,169,96,.38) !important;
                    box-shadow: 0 0 0 3px rgba(200,169,96,.07) !important;
                }

                /* ── Send button ───────────────────────────────────────── */
                .dm-send { transition: transform .18s, box-shadow .18s, background .18s; }
                .dm-send:hover:not(:disabled) {
                    transform: scale(1.07);
                    box-shadow: 0 6px 22px rgba(79,70,229,.48) !important;
                }

                /* ── Call buttons ──────────────────────────────────────── */
                .dm-call-btn { transition: background .15s, border-color .15s, color .15s; }
                .dm-call-btn:hover {
                    background: rgba(200,169,96,.1) !important;
                    border-color: rgba(200,169,96,.3) !important;
                    color: #d4b872 !important;
                }

                /* ── Reaction emoji ────────────────────────────────────── */
                .dm-rxn-btn { transition: transform .1s, background .1s; }
                .dm-rxn-btn:hover { transform: scale(1.38) !important; }

                /* ── Reaction pill ─────────────────────────────────────── */
                .dm-pill { transition: transform .12s, opacity .12s; }
                .dm-pill:hover { transform: scale(1.06); opacity: .85; }

                /* ── Chat canvas ───────────────────────────────────────── */
                .dm-canvas {
                    background-image: radial-gradient(circle, rgba(255,255,255,.018) 1px, transparent 1px);
                    background-size: 26px 26px;
                }

                /* ── Message bubble entrance ───────────────────────────── */
                .dm-bubble { animation: dm-fade-up .18s ease-out both; }

                /* ── Timestamp: fade in on row hover ───────────────────── */
                .dm-msg-row .dm-ts { opacity: .55; transition: opacity .15s; }
                .dm-msg-row:hover .dm-ts { opacity: 1; }
            `}</style>

            <div style={{ height: 'calc(100vh - 6.5rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `${SIDEBAR_W}px 1fr`, minHeight: 0, overflow: 'hidden' }}>

                    {/* ═══════════════════ SIDEBAR ═══════════════════ */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: C.sidebar, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>

                        {/* Header */}
                        <div style={{ padding: '20px 14px 12px', background: C.sidebarHead, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                            {/* Title row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 9, background: C.accentSoft, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <MessageCircle size={13} style={{ color: C.accent }} />
                                </div>
                                <h2 style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.025em', margin: 0, color: C.textPrimary, lineHeight: 1 }}>
                                    Messages
                                </h2>
                                {totalUnread > 0 && (
                                    <span style={{ background: `linear-gradient(135deg,${C.meBubble1},${C.meBubble2})`, color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.02em', boxShadow: '0 2px 8px rgba(79,70,229,.35)' }}>
                                        {totalUnread}
                                    </span>
                                )}
                            </div>

                            {/* Search */}
                            <div style={{ position: 'relative' }}>
                                <Search size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, pointerEvents: 'none' }} />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher…"
                                    className="dm-search"
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 11px 7px 28px', fontSize: '0.78rem', color: C.textPrimary, boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>
                        </div>

                        {/* Conversation list */}
                        <div className="dm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: 9, color: C.textMuted, fontSize: '0.78rem' }}>
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'dm-spin .8s linear infinite' }} />
                                    Chargement…
                                </div>
                            ) : filteredConvs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: C.textMuted }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                        <MessageCircle size={20} style={{ color: '#c8a960' }} />
                                    </div>
                                    <p style={{ fontSize: '0.82rem', margin: '0 0 6px', fontWeight: 700, color: C.textSecondary }}>
                                        {search ? 'Aucun résultat' : 'Aucune conversation'}
                                    </p>
                                    {!search && (
                                        <p style={{ fontSize: '0.72rem', margin: 0, color: 'rgba(255,255,255,0.25)', lineHeight: 1.4 }}>Ajoutez des amis pour commencer à discuter</p>
                                    )}
                                </div>
                            ) : (
                                filteredConvs.map(conv => {
                                    const isActive  = activeConv === conv.convId;
                                    const hasUnread = conv.unread > 0;
                                    return (
                                        <div
                                            key={conv.convId}
                                            onClick={() => selectConversation(conv)}
                                            className="dm-conv-card"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 11,
                                                padding: '9px 11px',
                                                borderRadius: 13,
                                                border: `1px solid ${isActive ? C.accentBorder : C.borderCard}`,
                                                background: isActive ? C.accentGlow : 'rgba(255,255,255,0.02)',
                                                boxShadow: isActive ? `inset 0 1px 0 rgba(200,169,96,.07)` : 'none',
                                            }}
                                        >
                                            {/* Avatar with gradient ring when active */}
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <div style={{
                                                    padding: isActive ? 2 : 0,
                                                    borderRadius: '50%',
                                                    background: isActive ? 'linear-gradient(135deg, rgba(200,169,96,.65), rgba(109,40,217,.65))' : 'transparent',
                                                }}>
                                                    <div style={{ borderRadius: '50%', overflow: 'hidden', border: isActive ? `2px solid ${C.base}` : 'none' }}>
                                                        <Avatar uid={conv.friendUid} avatarUrl={conv.friendProfile.avatar_url} avatarStyle={conv.friendProfile.avatar_style} size={isActive ? 36 : 38} />
                                                    </div>
                                                </div>
                                                {(() => {
                                                    const isOnline = (presenceMap[conv.friendUid] ?? 0) > 0 && (now - presenceMap[conv.friendUid]) < 2 * 60 * 1000;
                                                    if (hasUnread) return <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: C.accent, border: '2px solid #0b0b0d', boxShadow: '0 0 5px rgba(200,169,96,.5)' }} />;
                                                    if (isOnline) return <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: C.online, border: '2px solid #0b0b0d' }} />;
                                                    return null;
                                                })()}
                                            </div>

                                            {/* Text */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <span style={{ fontWeight: hasUnread || isActive ? 700 : 500, fontSize: '0.835rem', color: hasUnread || isActive ? C.textPrimary : C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 128 }}>
                                                        {conv.friendProfile.full_name}
                                                    </span>
                                                    {conv.lastTime && (
                                                        <span style={{ fontSize: '0.62rem', flexShrink: 0, marginLeft: 6, color: isActive ? '#c8a960' : C.textMuted, fontWeight: isActive ? 600 : 400 }}>
                                                            {relativeTime(conv.lastTime)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    {conv.lastSenderId === user.uid && (
                                                        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                                                            {conv.lastRead ? (
                                                                // Double check — seen
                                                                <svg width="15" height="10" viewBox="0 0 15 10" fill="none" style={{ display: 'block' }}>
                                                                    <path d="M1 5l3 3 5-7" stroke="#c8a960" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                    <path d="M5 5l3 3 5-7" stroke="#c8a960" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            ) : (
                                                                // Single check — sent/delivered
                                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: 'block' }}>
                                                                    <path d="M1 5l3 3 5-7" stroke="rgba(238,238,239,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            )}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '0.73rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: hasUnread ? C.textSecondary : C.textMuted, fontWeight: hasUnread ? 500 : 400, fontStyle: conv.lastMessage ? 'normal' : 'italic' }}>
                                                        {conv.lastMessage ?? 'Démarrer la conversation'}
                                                    </span>
                                                    {hasUnread && (
                                                        <span style={{ background: `linear-gradient(135deg,${C.meBubble1},${C.meBubble2})`, color: '#fff', borderRadius: 20, minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0, boxShadow: '0 2px 6px rgba(79,70,229,.3)' }}>
                                                            {conv.unread}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* ── Salon chats section ── */}
                            {(() => {
                                const filteredSalons = salonPreviews.filter(s =>
                                    !search.trim() || s.title.toLowerCase().includes(search.toLowerCase())
                                );
                                if (filteredSalons.length === 0) return null;
                                return (
                                    <>
                                        <div style={{ padding: '10px 4px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ flex: 1, height: 1, background: C.border }} />
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: C.textMuted, textTransform: 'uppercase', flexShrink: 0 }}>Salons</span>
                                            <div style={{ flex: 1, height: 1, background: C.border }} />
                                        </div>
                                        {filteredSalons.map(salon => {
                                            const Icon = salon.type === 'objective' ? Target : Briefcase;
                                            const accentCol = salon.type === 'objective' ? '#c8a960' : '#818cf8';
                                            const href = salon.type === 'objective'
                                                ? `/objective/${salon.id}?tab=chat`
                                                : `/project/${salon.id}?tab=chat`;
                                            return (
                                                <div
                                                    key={salon.id}
                                                    className="dm-conv-card"
                                                    onClick={() => router.push(href)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 11,
                                                        padding: '9px 11px', borderRadius: 13,
                                                        border: `1px solid ${C.borderCard}`,
                                                        background: 'rgba(255,255,255,0.02)',
                                                    }}
                                                >
                                                    {/* Icon badge */}
                                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                                        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${accentCol}14`, border: `1px solid ${accentCol}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Icon size={16} style={{ color: accentCol }} />
                                                        </div>
                                                        {salon.unread > 0 && (
                                                            <span style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%', background: accentCol, border: '2px solid #0b0b0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 800, color: '#0b0b0d' }}>
                                                                {salon.unread > 9 ? '9+' : salon.unread}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Text */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                                                            <span style={{ fontWeight: salon.unread > 0 ? 700 : 500, fontSize: '0.835rem', color: salon.unread > 0 ? C.textPrimary : C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 148 }}>
                                                                {salon.title}
                                                            </span>
                                                            {salon.lastTime && (
                                                                <span style={{ fontSize: '0.62rem', flexShrink: 0, marginLeft: 6, color: C.textMuted }}>
                                                                    {relativeTime(salon.lastTime)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span style={{ fontSize: '0.73rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: salon.unread > 0 ? C.textSecondary : C.textMuted, fontWeight: salon.unread > 0 ? 500 : 400, fontStyle: salon.lastMessage ? 'normal' : 'italic' }}>
                                                            {salon.lastSenderName && salon.lastMessage
                                                                ? `${salon.lastSenderName}: ${salon.lastMessage}`
                                                                : salon.lastMessage ?? 'Aucun message'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* ═══════════════════ CHAT AREA ═══════════════════ */}
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                        {!activeConv ? (
                            /* ── Empty state ── */
                            <div className="dm-canvas" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0 }}>
                                {/* Layered rings */}
                                <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                                    {[120, 88, 62].map((s, i) => (
                                        <div key={i} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: `1px solid rgba(200,169,96,${0.1 - i * 0.025})`, background: i === 2 ? 'rgba(200,169,96,0.05)' : 'transparent' }} />
                                    ))}
                                    <div style={{ position: 'relative', zIndex: 1, width: 44, height: 44, borderRadius: '50%', background: C.accentSoft, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${C.accentSoft}` }}>
                                        <MessageCircle size={19} style={{ color: C.accent }} />
                                    </div>
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '0.93rem', margin: '0 0 6px', color: C.textSecondary, letterSpacing: '-0.01em' }}>
                                    Sélectionne une conversation
                                </p>
                                <p style={{ fontSize: '0.77rem', margin: 0, color: C.textMuted }}>
                                    Tes messages directs apparaîtront ici
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* ── Chat header ── */}
                                {activeProfile && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: `1px solid ${C.border}`, background: C.header, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                                            {/* Gradient ring avatar */}
                                            <div
                                                style={{ padding: 2.5, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(200,169,96,.65), rgba(109,40,217,.65))', cursor: 'pointer', flexShrink: 0, boxShadow: '0 0 16px rgba(200,169,96,.18)' }}
                                                onClick={() => router.push(`/user/${activeProfile.id}`)}
                                            >
                                                <div style={{ borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.base}` }}>
                                                    <Avatar uid={activeProfile.id} avatarUrl={activeProfile.avatar_url} avatarStyle={activeProfile.avatar_style} size={38} />
                                                </div>
                                            </div>
                                            <div>
                                                <div
                                                    style={{ fontWeight: 700, fontSize: '0.9rem', color: C.textPrimary, cursor: 'pointer', letterSpacing: '-0.015em', lineHeight: 1.2 }}
                                                    onClick={() => router.push(`/user/${activeProfile.id}`)}
                                                >
                                                    {activeProfile.full_name}
                                                </div>
                                                <div style={{ fontSize: '0.67rem', color: friendOnline ? C.online : C.textMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: friendOnline ? C.online : '#52525b', display: 'inline-block', flexShrink: 0, ...(friendOnline ? { animation: 'dm-blink 2.4s ease-in-out infinite', boxShadow: '0 0 5px rgba(34,197,94,.45)' } : {}) }} />
                                                    {friendOnline ? 'En ligne' : 'Hors ligne'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Call buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {[
                                                { icon: <Phone size={14} />,  action: () => startCall(activeProfile.id, true),  title: 'Appel vocal' },
                                                { icon: <Video size={14} />,  action: () => startCall(activeProfile.id, false), title: 'Appel vidéo' },
                                            ].map((btn, i) => (
                                                <button key={i} onClick={btn.action} title={btn.title} className="dm-call-btn"
                                                    style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}>
                                                    {btn.icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Messages canvas ── */}
                                <div className="dm-canvas dm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>

                                    {messages.length === 0 ? (
                                        /* Conversation start state */
                                        <div style={{ margin: 'auto', textAlign: 'center' }}>
                                            {activeProfile && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13 }}>
                                                    <div style={{ padding: 3, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(200,169,96,.45), rgba(109,40,217,.45))', boxShadow: '0 0 24px rgba(200,169,96,.2)' }}>
                                                        <Avatar uid={activeProfile.id} avatarUrl={activeProfile.avatar_url} avatarStyle={activeProfile.avatar_style} size={54} />
                                                    </div>
                                                    <div>
                                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '0 0 5px', color: C.textSecondary }}>
                                                            {activeProfile.full_name}
                                                        </p>
                                                        <p style={{ fontSize: '0.78rem', margin: 0, color: C.textMuted }}>
                                                            Commencez la conversation 💬
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => {
                                            const isMe      = msg.sender_id === user?.uid;
                                            const time      = msg.created_at?.toDate?.()?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? '';
                                            const msgDate: Date | null = msg.created_at?.toDate?.() ?? null;
                                            const prevMsg   = messages[idx - 1];
                                            const nextMsg   = messages[idx + 1];
                                            const sameAsPrev = prevMsg?.sender_id === msg.sender_id;
                                            const sameAsNext = nextMsg?.sender_id === msg.sender_id;
                                            const reactions  = msg.reactions || {};
                                            const hasReactions = Object.entries(reactions).some(([, uids]) => (uids as string[]).length > 0);

                                            const prevDate: Date | null = prevMsg?.created_at?.toDate?.() ?? null;
                                            const showDateSep = msgDate && (!prevDate || !isSameDay(prevDate, msgDate));

                                            // Bubble border radius — smooth grouping
                                            const br = isMe
                                                ? `${sameAsPrev ? 6 : 18}px ${sameAsPrev ? 6 : 18}px ${sameAsNext ? 6 : 5}px 18px`
                                                : `${sameAsPrev ? 6 : 18}px ${sameAsPrev ? 6 : 18}px 18px ${sameAsNext ? 6 : 5}px`;

                                            return (
                                                <div key={msg.id}>
                                                    {/* Date separator */}
                                                    {showDateSep && msgDate && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: `${idx === 0 ? 0 : 26}px 0 18px` }}>
                                                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,.05) 40%)' }} />
                                                            <span style={{ fontSize: '0.62rem', color: C.textMuted, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', padding: '3px 11px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 99 }}>
                                                                {formatDateLabel(msgDate)}
                                                            </span>
                                                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(255,255,255,.05) 40%)' }} />
                                                        </div>
                                                    )}

                                                    <div style={{ marginTop: sameAsPrev ? 2 : 14 }}>
                                                        <div
                                                            className="dm-msg-row"
                                                            style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row', position: 'relative' }}
                                                            onMouseEnter={() => setHoverMsgId(msg.id)}
                                                            onMouseLeave={() => setHoverMsgId(null)}
                                                        >
                                                            {/* Their avatar — last in group only */}
                                                            <div style={{ width: 28, flexShrink: 0 }}>
                                                                {!isMe && !sameAsNext && (
                                                                    <Avatar uid={activeProfile?.id} avatarUrl={activeProfile?.avatar_url} avatarStyle={activeProfile?.avatar_style} size={28} />
                                                                )}
                                                            </div>

                                                            <div style={{ maxWidth: '62%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                                                <div style={{ position: 'relative' }}>
                                                                    {/* Quick reaction picker */}
                                                                    {hoverMsgId === msg.id && (
                                                                        <div style={{ position: 'absolute', bottom: 'calc(100% + 7px)', [isMe ? 'right' : 'left']: 0, background: 'rgba(12,12,16,0.98)', border: `1px solid rgba(255,255,255,0.09)`, borderRadius: 24, padding: '5px 6px', display: 'flex', gap: 1, zIndex: 20, boxShadow: '0 14px 44px rgba(0,0,0,.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', animation: 'dm-fade-up .1s ease-out' }}>
                                                                            {QUICK_REACTIONS.map(emoji => (
                                                                                <button key={emoji} onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                                    className="dm-rxn-btn"
                                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 5px', borderRadius: 9, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Message bubble — only if there's text content */}
                                                                    {msg.content && (
                                                                        <div className="dm-bubble" style={{
                                                                            padding: '9px 14px',
                                                                            borderRadius: br,
                                                                            fontSize: '0.875rem',
                                                                            lineHeight: 1.62,
                                                                            wordBreak: 'break-word',
                                                                            ...(isMe ? {
                                                                                background: `linear-gradient(145deg, ${C.meBubble1}, ${C.meBubble2})`,
                                                                                color: '#fff',
                                                                                boxShadow: '0 4px 18px rgba(79,70,229,.28), inset 0 1px 0 rgba(255,255,255,.18)',
                                                                            } : {
                                                                                background: C.themBubble,
                                                                                color: C.textPrimary,
                                                                                border: `1px solid ${C.themBubbleBorder}`,
                                                                            }),
                                                                        }}>
                                                                            <MessageContent content={msg.content} isMe={isMe} />
                                                                        </div>
                                                                    )}
                                                                    {/* File attachment */}
                                                                    {msg.file_url && (
                                                                        <ChatFileCard
                                                                            fileUrl={msg.file_url}
                                                                            fileName={msg.file_name}
                                                                            fileType={msg.file_type}
                                                                            fileSize={msg.file_size}
                                                                            isMe={isMe}
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* Reaction pills */}
                                                                {hasReactions && (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                                        {Object.entries(reactions)
                                                                            .filter(([, uids]) => (uids as string[]).length > 0)
                                                                            .map(([emoji, uids]) => {
                                                                                const mine = (uids as string[]).includes(user?.uid || '');
                                                                                return (
                                                                                    <button key={emoji} onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                                        className="dm-pill"
                                                                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 13, border: mine ? '1px solid rgba(200,169,96,.48)' : '1px solid rgba(255,255,255,.08)', background: mine ? 'rgba(200,169,96,.13)' : 'rgba(255,255,255,.04)', cursor: 'pointer' }}>
                                                                                        {emoji}
                                                                                        <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>{(uids as string[]).length}</span>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                    </div>
                                                                )}

                                                                {/* Timestamp — last in group */}
                                                                {!sameAsNext && (
                                                                    <div className="dm-ts" style={{ fontSize: '0.61rem', color: C.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                        {time}
                                                                        {isMe && (
                                                                            <span style={{ color: msg.read ? '#c8a960' : C.textMuted, fontWeight: msg.read ? 700 : 400 }}>
                                                                                {msg.read ? '✓✓' : '✓'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* ── Input bar ── */}
                                <form onSubmit={handleSend} style={{ padding: '12px 20px 18px', background: C.inputBar, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                                    {/* Pending file preview */}
                                    {pendingFile && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8, borderRadius: 12, background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.12)' }}>
                                            {pendingFile.type.startsWith('image/')
                                                ? <ImageIcon size={14} style={{ color: '#c8a960', flexShrink: 0 }} />
                                                : <FileText size={14} style={{ color: '#c8a960', flexShrink: 0 }} />
                                            }
                                            <span style={{ flex: 1, fontSize: '0.78rem', color: 'rgba(237,233,227,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {pendingFile.name}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(237,233,227,0.25)', flexShrink: 0 }}>
                                                {(pendingFile.size / 1024).toFixed(0)} Ko
                                            </span>
                                            <button type="button" onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,233,227,0.3)', padding: 2, display: 'flex' }}>
                                                <X size={13} />
                                            </button>
                                        </div>
                                    )}
                                    {/* Upload progress */}
                                    {uploadProgress !== null && (
                                        <div style={{ marginBottom: 8, borderRadius: 4, height: 3, background: 'rgba(200,169,96,0.1)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#c8a960', borderRadius: 4, transition: 'width 0.2s' }} />
                                        </div>
                                    )}
                                    <div
                                        className="dm-input-ring"
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 18, padding: '6px 6px 6px 14px' }}
                                    >
                                        {/* File attach button */}
                                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.json,.txt,.csv" />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: pendingFile ? '#c8a960' : 'rgba(237,233,227,0.25)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s', flexShrink: 0 }}
                                            onMouseEnter={e => { if (!pendingFile) e.currentTarget.style.color = 'rgba(237,233,227,0.5)'; }}
                                            onMouseLeave={e => { if (!pendingFile) e.currentTarget.style.color = 'rgba(237,233,227,0.25)'; }}
                                            title="Joindre un fichier"
                                        >
                                            <Paperclip size={16} />
                                        </button>
                                        <input
                                            type="text"
                                            placeholder={t('messages_placeholder')}
                                            value={newMsg}
                                            onChange={e => setNewMsg(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                                            autoFocus
                                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.875rem', color: C.textPrimary, fontFamily: 'inherit', padding: '4px 0' }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={sending || (!newMsg.trim() && !pendingFile)}
                                            className="dm-send"
                                            style={{
                                                width: 38, height: 38, borderRadius: 13, border: 'none', flexShrink: 0,
                                                background: (newMsg.trim() || pendingFile) ? `linear-gradient(135deg,${C.meBubble1},${C.meBubble2})` : 'rgba(255,255,255,0.04)',
                                                cursor: (newMsg.trim() || pendingFile) ? 'pointer' : 'default',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                opacity: sending ? 0.6 : 1,
                                                boxShadow: (newMsg.trim() || pendingFile) ? '0 4px 16px rgba(79,70,229,.32)' : 'none',
                                            }}
                                        >
                                            <Send size={15} style={{ color: (newMsg.trim() || pendingFile) ? '#fff' : C.textMuted, marginLeft: 1 }} />
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function Messages() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 6.5rem)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #c8a960', borderTopColor: 'transparent', animation: 'dm-spin .8s linear infinite' }} />
            </div>
        }>
            <MessagesContent />
        </Suspense>
    );
}
