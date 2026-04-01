'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
    doc, getDoc, updateDoc, onSnapshot, collection, query, orderBy,
    addDoc, Timestamp, setDoc, where, getDocs, deleteDoc, increment
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { ROLE_PRESETS, getRolePreset } from '@/lib/rolePresets';
import CalendarPicker from '@/components/CalendarPicker';
import { authFetch } from '@/lib/authFetch';
import {
    ArrowLeft, Clock, Users, Send, Check, X, MessageCircle,
    ChevronRight, Star, Sparkles, UserPlus, Shield, ExternalLink,
    AlertCircle, CheckCircle2, XCircle, Loader2, Trash2, Archive,
    Edit3, Save, Plus, Video, Calendar, Target, BookOpen, Phone,
    Mic, MicOff, Camera, CameraOff, PhoneOff
} from 'lucide-react';

/* ─── Types ─── */
interface Applicant {
    user_id: string;
    role: string;
    message: string;
    status: 'pending' | 'accepted' | 'declined';
    custom_label?: string | null;
    applied_at: any;
    last_message_at?: any;
}

interface ChatMessage {
    id: string;
    sender_id: string;
    content: string;
    created_at: any;
    type?: 'message' | 'system' | 'call_invite';
    call_date?: string;
    call_time?: string;
    call_status?: 'pending' | 'accepted' | 'declined' | 'rescheduled';
    call_duration?: number; // minutes
}

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
    applicants: Applicant[];
}

const fmtHours = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${parseFloat(h.toFixed(2))}h`;

export default function TeammateRequestDetail() {
    const params = useParams();
    const requestId = params?.id as string;
    const router = useRouter();
    const { user } = useAuth();
    const { locale } = useLocale();
    const isFr = locale === 'fr';

    const [request, setRequest] = useState<TeammateRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [creatorData, setCreatorData] = useState<any>(null);
    const [applicantData, setApplicantData] = useState<Record<string, any>>({});
    // Extended applicant profile data (stats, objectives)
    const [applicantProfiles, setApplicantProfiles] = useState<Record<string, { totalHours: number; totalRooms: number; objectives: any[]; projects: any[] }>>({});

    // Chat
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sendingChat, setSendingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Actions
    const [processing, setProcessing] = useState<string | null>(null);

    // Apply (for non-owner, non-applied users)
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [applyRole, setApplyRole] = useState('');
    const [applyCustomRole, setApplyCustomRole] = useState('');
    const [applyMessage, setApplyMessage] = useState('');
    const [sendingApplication, setSendingApplication] = useState(false);

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editDescription, setEditDescription] = useState('');
    const [editRoles, setEditRoles] = useState<{ key: string; custom_label?: string; spots: number }[]>([]);
    const [editSkills, setEditSkills] = useState('');
    const [saving, setSaving] = useState(false);

    // Profile preview
    const [previewUid, setPreviewUid] = useState<string | null>(null);

    // Schedule call — uses CalendarPicker (ISO datetime string like "2026-03-20T14:30")
    const [showCallForm, setShowCallForm] = useState(false);
    const [callDatetime, setCallDatetime] = useState('');
    const [callDuration, setCallDuration] = useState(30);
    const [sendingCall, setSendingCall] = useState(false);
    // Counter-propose (reschedule from chat)
    const [counterMsgId, setCounterMsgId] = useState<string | null>(null);
    const [counterDatetime, setCounterDatetime] = useState('');

    // Recruiting agenda (sessions stored under this announce)
    const [recruitingSessions, setRecruitingSessions] = useState<{ id: string; title: string; description: string; scheduled_at: any; creator_id: string; creator_name: string; attendees: string[]; call_duration?: number }[]>([]);

    const [rightTab, setRightTab] = useState<'chat' | 'agenda'>('chat');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Agenda Reschedule/Cancel State
    const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);
    const [rescheduleSession, setRescheduleSession] = useState<{ id: string; otherUid: string; title: string; callDuration: number } | null>(null);
    const [agendaRescheduleDate, setAgendaRescheduleDate] = useState('');
    const [showCancelAgendaConfirm, setShowCancelAgendaConfirm] = useState<{ id: string, otherUid: string } | null>(null);

    // ZegoCloud Recruiting Room State
    const [activeCallRoomId, setActiveCallRoomId] = useState<string | null>(null);
    const zegoContainerRef = useRef<HTMLDivElement>(null);
    const zpRef = useRef<any>(null);

    const [currentTime, setCurrentTime] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(t);
    }, []);

    const isOwner = user?.uid === request?.creator_id;
    const myApplication = request?.applicants?.find(a => a.user_id === user?.uid);
    const hasApplied = !!myApplication;

    const activeInterviewSession = useMemo(() => {
        if (!activeChat || !request?.creator_id || !user) return null;
        
        return recruitingSessions.find(s => {
            const hasOwner = s.attendees?.includes(request.creator_id);
            const hasApplicant = s.attendees?.includes(activeChat); 
            if (!hasOwner || !hasApplicant) return false;
            
            const scheduledMs = s.scheduled_at?.toDate ? s.scheduled_at.toDate().getTime() : new Date(s.scheduled_at).getTime();
            const durationMs = (s.call_duration || 30) * 60 * 1000;
            
            return (currentTime >= scheduledMs - 15 * 60 * 1000) && (currentTime <= scheduledMs + durationMs);
        });
    }, [recruitingSessions, activeChat, request?.creator_id, user, currentTime]);

    // Custom Pre-Join State
    const [showCustomPreJoin, setShowCustomPreJoin] = useState<string | null>(null);
    const [preJoinStream, setPreJoinStream] = useState<MediaStream | null>(null);
    const [preJoinMic, setPreJoinMic] = useState(true);
    const [preJoinVideo, setPreJoinVideo] = useState(true);
    const preJoinVideoRef = useRef<HTMLVideoElement>(null);

    // Custom Leave Confirm State
    const [leaveConfirmResolve, setLeaveConfirmResolve] = useState<((leave: boolean) => void) | null>(null);

    // Camera Preview Effect
    useEffect(() => {
        let stream: MediaStream | null = null;
        if (showCustomPreJoin) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(s => {
                    stream = s;
                    setPreJoinStream(s);
                    if (preJoinVideoRef.current) {
                        preJoinVideoRef.current.srcObject = s;
                    }
                })
                .catch(err => {
                    console.error("Camera access denied", err);
                });
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (preJoinStream && !showCustomPreJoin) {
                preJoinStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [showCustomPreJoin]);

    useEffect(() => {
        if (preJoinStream) {
            preJoinStream.getAudioTracks().forEach(t => t.enabled = preJoinMic);
            preJoinStream.getVideoTracks().forEach(t => t.enabled = preJoinVideo);
        }
    }, [preJoinMic, preJoinVideo, preJoinStream]);

    const confirmJoinCall = () => {
        if (!showCustomPreJoin) return;
        const roomId = showCustomPreJoin;
        
        if (preJoinStream) {
            preJoinStream.getTracks().forEach(t => t.stop());
            setPreJoinStream(null);
        }
        setShowCustomPreJoin(null);
        
        joinRecruitingCall(roomId, preJoinMic, preJoinVideo);
    };

    const joinRecruitingCall = async (roomId: string, initMic: boolean = true, initCam: boolean = true) => {
        if (!user) return;
        setActiveCallRoomId(roomId);
        try {
            const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');
            const userName = user.displayName || user.email?.split('@')[0] || 'User';

            const tokenRes = await authFetch('/api/zego-token', { method: 'POST', body: JSON.stringify({ roomID: roomId, userName }) });
            if (!tokenRes.ok) return;
            const { token: kitToken } = await tokenRes.json();
            const zp = ZegoUIKitPrebuilt.create(kitToken);
            zpRef.current = zp;

            zp.joinRoom({
                container: zegoContainerRef.current,
                sharedLinks: [],
                scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
                showPreJoinView: false,
                turnOnMicrophoneWhenJoining: initMic,
                turnOnCameraWhenJoining: initCam,
                showMyCameraToggleButton: true,
                showMyMicrophoneToggleButton: true,
                showAudioVideoSettingsButton: true,
                showScreenSharingButton: true,
                showTextChat: false,
                showRoomDetailsButton: false,
                maxUsers: 2,
                layout: 'Grid',
                onLeaveRoom: () => {
                    endRecruitingCall();
                },
            });
        } catch (e) {
            console.error("Failed to init ZegoCloud", e);
            endRecruitingCall();
        }
    };

    const endRecruitingCall = () => {
        if (zegoContainerRef.current) {
            zegoContainerRef.current.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none;z-index:-1;';
        }
        setTimeout(() => {
            try { zpRef.current?.destroy(); } catch { /* ignore */ }
            zpRef.current = null;
            setActiveCallRoomId(null);
        }, 50);
    };

    // ── Fetch request + real-time ──
    useEffect(() => {
        if (!requestId) return;
        const unsub = onSnapshot(doc(db, 'teammate_requests', requestId), async (snap) => {
            if (!snap.exists()) { setLoading(false); return; }
            const data = { id: snap.id, ...snap.data() } as TeammateRequest;
            if (!data.applicants) data.applicants = [];
            setRequest(data);

            // Fetch creator data
            if (!creatorData || creatorData.uid !== data.creator_id) {
                const cSnap = await getDoc(doc(db, 'users', data.creator_id));
                if (cSnap.exists()) setCreatorData({ uid: data.creator_id, ...cSnap.data() });
            }

            // Fetch applicant user data
            const newApplicantData: Record<string, any> = {};
            await Promise.all(data.applicants.map(async (a) => {
                if (!applicantData[a.user_id]) {
                    const uSnap = await getDoc(doc(db, 'users', a.user_id));
                    if (uSnap.exists()) newApplicantData[a.user_id] = uSnap.data();
                }
            }));
            if (Object.keys(newApplicantData).length > 0) {
                setApplicantData(prev => ({ ...prev, ...newApplicantData }));
            }

            setLoading(false);
        });
        return () => unsub();
    }, [requestId]);

    // ── Fetch extended profile for applicants (owner view) ──
    useEffect(() => {
        if (!request || !isOwner) return;
        request.applicants.forEach(async (a) => {
            if (applicantProfiles[a.user_id]) return;
            try {
                // Get memberships for hours & rooms
                const memberSnap = await getDocs(query(collection(db, 'memberships'), where('user_id', '==', a.user_id)));
                let hours = 0;
                const objIds: string[] = [];
                memberSnap.docs.forEach(d => {
                    hours += d.data().completed_hours || 0;
                    objIds.push(d.data().objective_id);
                });

                // Public objectives
                const objDocs = objIds.length > 0
                    ? await Promise.all(objIds.slice(0, 5).map(id => getDoc(doc(db, 'objectives', id))))
                    : [];
                const objectives = objDocs.filter(d => d.exists() && d.data()?.is_public).map(d => ({ id: d.id, ...d.data() }));

                // Projects
                const projMemSnap = await getDocs(query(collection(db, 'project_memberships'), where('user_id', '==', a.user_id)));
                const projIds = projMemSnap.docs.map(d => d.data().project_id);
                const projDocs = projIds.length > 0
                    ? await Promise.all(projIds.slice(0, 5).map(id => getDoc(doc(db, 'projects', id))))
                    : [];
                const projects = projDocs.filter(d => d.exists() && d.data()?.is_public).map(d => ({ id: d.id, ...d.data() }));

                setApplicantProfiles(prev => ({
                    ...prev,
                    [a.user_id]: { totalHours: hours, totalRooms: memberSnap.size + projMemSnap.size, objectives, projects }
                }));
            } catch (err) {
                console.error('Profile fetch error:', err);
            }
        });
    }, [request, isOwner]);

    // ── Chat listener ──
    useEffect(() => {
        if (!activeChat || !requestId) { setChatMessages([]); return; }
        const q = query(
            collection(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages'),
            orderBy('created_at', 'asc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[]);
        });
        return () => unsub();
    }, [activeChat, requestId]);


    // Auto-open chat
    useEffect(() => {
        if (!request || !user) return;
        if (isOwner && request.applicants.length > 0 && !activeChat) {
            setActiveChat(request.applicants[0].user_id);
        } else if (hasApplied && !activeChat) {
            setActiveChat(user.uid);
        }
    }, [request, user, isOwner, hasApplied]);

    // Auto scroll chat
    useEffect(() => {
        const timer = setTimeout(() => {
            if (rightTab === 'chat' && chatEndRef.current) {
                chatEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [chatMessages, rightTab, activeChat]);

    // ── Recruiting sessions listener ──
    useEffect(() => {
        if (!requestId) return;
        const q = query(
            collection(db, 'teammate_requests', requestId, 'sessions'),
            orderBy('scheduled_at', 'asc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setRecruitingSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as any);
        });
        return () => unsub();
    }, [requestId]);

    // ── Send chat message ──
    const handleSendChat = async () => {
        if (!chatInput.trim() || !user || !activeChat || !requestId || chatInput.length > 5000) return;
        setSendingChat(true);
        try {
            const content = chatInput.trim().slice(0, 5000);
            setChatInput('');
            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages'),
                { sender_id: user.uid, content, created_at: Timestamp.now(), type: 'message' }
            );
            updateDoc(doc(db, 'users', user.uid), { messages_sent: increment(1) }).catch(console.error);
            const recipientId = isOwner ? activeChat : request!.creator_id;
            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';
            await addDoc(collection(db, 'users', recipientId, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} vous a envoyé un message à propos de "${request!.target_title}"`
                    : `${senderName} sent you a message about "${request!.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

            // Update last_message_at in applicants array for sorting
            if (requestId && request) {
                const updatedApps = request.applicants.map(a => 
                    a.user_id === activeChat ? { ...a, last_message_at: Timestamp.now() } : a
                );
                await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updatedApps });
            }
        } catch (err) {
            console.error('Error sending chat:', err);
        } finally {
            setSendingChat(false);
        }
    };

    // Helper: parse ISO datetime "2026-03-20T14:30" → { dateStr, timeStr, dateObj }
    const parseDatetime = (iso: string) => {
        const [datePart, timePart] = iso.split('T');
        return { dateStr: datePart, timeStr: timePart || '12:00', dateObj: new Date(iso) };
    };

    // ── Schedule call ──
    const handleScheduleCall = async () => {
        if (!callDatetime || !user || !activeChat || !requestId) return;
        setSendingCall(true);
        try {
            const { dateStr, timeStr, dateObj } = parseDatetime(callDatetime);
            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages'),
                {
                    sender_id: user.uid,
                    content: isFr
                        ? `📞 Appel proposé le ${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${timeStr}`
                        : `📞 Call proposed on ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${timeStr}`,
                    created_at: Timestamp.now(),
                    type: 'call_invite',
                    call_date: dateStr,
                    call_time: timeStr,
                    call_status: 'pending',
                    call_duration: callDuration,
                }
            );

            const recipientId = isOwner ? activeChat : request!.creator_id;
            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';
            await addDoc(collection(db, 'users', recipientId, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} vous propose un appel pour "${request!.target_title}"`
                    : `${senderName} proposed a call for "${request!.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

            setCallDuration(30);

            // Update last_message_at for sorting
            if (requestId && request) {
                const updatedApps = request.applicants.map(a => 
                    a.user_id === activeChat ? { ...a, last_message_at: Timestamp.now() } : a
                );
                await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updatedApps });
            }
        } catch (err) {
            console.error('Error scheduling call:', err);
        } finally {
            setSendingCall(false);
        }
    };

    // ── Accept call invite ──
    const handleAcceptCall = async (msgId: string, msg: ChatMessage) => {
        if (!user || !activeChat || !requestId || !request) return;
        try {
            // Update the message status
            const msgRef = doc(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages', msgId);
            await updateDoc(msgRef, { call_status: 'accepted' });

            // Create a session under this recruiting announce (not the salon)
            const [hours, minutes] = (msg.call_time || '12:00').split(':').map(Number);
            const scheduled = new Date(msg.call_date || new Date().toISOString().slice(0, 10));
            scheduled.setHours(hours, minutes, 0, 0);

            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';
            const otherUid = isOwner ? activeChat : request.creator_id;

            await addDoc(collection(db, 'teammate_requests', requestId, 'sessions'), {
                title: isFr ? `Appel — ${request.target_title}` : `Call — ${request.target_title}`,
                scheduled_at: Timestamp.fromDate(scheduled),
                description: isFr
                    ? `Appel de recrutement pour ${request.target_title} (${msg.call_duration || 30} min)`
                    : `Recruitment call for ${request.target_title} (${msg.call_duration || 30} min)`,
                creator_id: msg.sender_id,
                creator_name: msg.sender_id === user.uid ? senderName : (applicantData[msg.sender_id]?.full_name || request.creator_name),
                attendees: [user.uid, otherUid],
                call_duration: msg.call_duration || 30,
                created_at: Timestamp.now(),
            });

            // Send a system message confirming
            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages'),
                {
                    sender_id: user.uid,
                    content: isFr ? `✅ Appel confirmé ! Ajouté à l'agenda.` : `✅ Call confirmed! Added to calendar.`,
                    created_at: Timestamp.now(),
                    type: 'system',
                }
            );

            // Notify the proposer
            const recipientId = msg.sender_id;
            await addDoc(collection(db, 'users', recipientId, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} a accepté l'appel pour "${request.target_title}"`
                    : `${senderName} accepted the call for "${request.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

            // Update last_message_at for sorting
            if (requestId && request) {
                const updatedApps = request.applicants.map(a => 
                    a.user_id === activeChat ? { ...a, last_message_at: Timestamp.now() } : a
                );
                await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updatedApps });
            }

        } catch (err) {
            console.error('Error accepting call:', err);
        }
    };

    // ── Decline call invite ──
    const handleDeclineCall = async (msgId: string, msg: ChatMessage) => {
        if (!user || !activeChat || !requestId || !request) return;
        try {
            const msgRef = doc(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages', msgId);
            await updateDoc(msgRef, { call_status: 'declined' });

            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';

            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages'),
                {
                    sender_id: user.uid,
                    content: isFr ? `L'appel a été décliné.` : `The call was declined.`,
                    created_at: Timestamp.now(),
                    type: 'system',
                }
            );

            await addDoc(collection(db, 'users', msg.sender_id, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} a décliné l'appel pour "${request!.target_title}"`
                    : `${senderName} declined the call for "${request!.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

            // Update last_message_at for sorting
            if (requestId && request) {
                const updatedApps = request.applicants.map(a => 
                    a.user_id === activeChat ? { ...a, last_message_at: Timestamp.now() } : a
                );
                await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updatedApps });
            }

        } catch (err) {
            console.error('Error declining call:', err);
        }
    };

    // ── Counter-propose call ──
    const handleCounterPropose = async (originalMsgId: string) => {
        if (!counterDatetime || !user || !activeChat || !requestId || !request) return;
        setSendingCall(true);
        try {
            const { dateStr, timeStr, dateObj } = parseDatetime(counterDatetime);

            // Mark original as rescheduled
            const origRef = doc(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages', originalMsgId);
            await updateDoc(origRef, { call_status: 'rescheduled' });

            // Create new invite
            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', activeChat, 'messages'),
                {
                    sender_id: user.uid,
                    content: isFr
                        ? `📞 Nouvel horaire proposé : ${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${timeStr}`
                        : `📞 New time proposed: ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${timeStr}`,
                    created_at: Timestamp.now(),
                    type: 'call_invite',
                    call_date: dateStr,
                    call_time: timeStr,
                    call_status: 'pending',
                    call_duration: callDuration,
                }
            );

            const recipientId = isOwner ? activeChat : request!.creator_id;
            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';
            await addDoc(collection(db, 'users', recipientId, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} propose un nouvel horaire pour l'appel "${request!.target_title}"`
                    : `${senderName} proposed a new time for the call "${request!.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

            setCounterMsgId(null);
            setCounterDatetime('');

            // Update last_message_at for sorting
            if (requestId && request) {
                const updatedApps = request.applicants.map(a => 
                    a.user_id === activeChat ? { ...a, last_message_at: Timestamp.now() } : a
                );
                await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updatedApps });
            }
        } catch (err) {
            console.error('Error counter-proposing:', err);
        } finally {
            setSendingCall(false);
        }
    };

    // ── Cancel agenda session ──
    const confirmCancelAgendaSession = async () => {
        if (!showCancelAgendaConfirm || !user || !request || !requestId) return;
        const { id: sessionId, otherUid } = showCancelAgendaConfirm;
        setCancelingSessionId(sessionId);
        try {
            await deleteDoc(doc(db, 'teammate_requests', requestId, 'sessions', sessionId));
            
            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';
            const applicantUid = isOwner ? otherUid : user.uid;

            // Send standard cancel message in chat
            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', applicantUid, 'messages'),
                {
                    sender_id: user.uid,
                    content: isFr ? `❌ Appel annulé.` : `❌ Call cancelled.`,
                    created_at: Timestamp.now(),
                    type: 'system',
                }
            );

            // Notify other
            await addDoc(collection(db, 'users', otherUid, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} a annulé l'appel pour "${request.target_title}"`
                    : `${senderName} cancelled the call for "${request.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

        } catch (err) {
            console.error('Error cancelling session:', err);
        } finally {
            setCancelingSessionId(null);
            setShowCancelAgendaConfirm(null);
        }
    };

    // ── Reschedule agenda session ──
    const handleConfirmAgendaReschedule = async () => {
        if (!rescheduleSession || !agendaRescheduleDate || !user || !request || !requestId) return;
        setSendingCall(true);
        try {
            const { dateStr, timeStr, dateObj } = parseDatetime(agendaRescheduleDate);
            const { id: sessionId, otherUid, title, callDuration } = rescheduleSession;
            const applicantUid = isOwner ? otherUid : user.uid;

            // Delete old session
            await deleteDoc(doc(db, 'teammate_requests', requestId, 'sessions', sessionId));

            // Send invite in chat
            await addDoc(
                collection(db, 'teammate_requests', requestId, 'conversations', applicantUid, 'messages'),
                {
                    sender_id: user.uid,
                    content: isFr
                        ? `📞 Reprogrammation proposée : ${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${timeStr}`
                        : `📞 Reschedule proposed: ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${timeStr}`,
                    created_at: Timestamp.now(),
                    type: 'call_invite',
                    call_date: dateStr,
                    call_time: timeStr,
                    call_status: 'pending',
                    call_duration: callDuration || 30, // Default to 30 if undefined
                }
            );

            const senderSnap = await getDoc(doc(db, 'users', user.uid));
            const senderName = senderSnap.exists() ? senderSnap.data().full_name : 'Utilisateur';
            
            await addDoc(collection(db, 'users', otherUid, 'notifications'), {
                type: 'teammate_message',
                message: isFr
                    ? `${senderName} propose un nouvel horaire pour l'appel "${request.target_title}"`
                    : `${senderName} proposed a new time for the call "${request.target_title}"`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });

            // Update chat last message
            const updatedApps = request.applicants.map(a => 
                a.user_id === otherUid ? { ...a, last_message_at: Timestamp.now() } : a
            );
            await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updatedApps });

            setRescheduleSession(null);
            setAgendaRescheduleDate('');
            setRightTab('chat');
            setActiveChat(otherUid);
        } catch (err) {
            console.error('Error rescheduling session:', err);
        } finally {
            setSendingCall(false);
        }
    };

    // ── Accept applicant ──
    const handleAccept = async (applicantUid: string) => {
        if (!request || !user) return;
        setProcessing(applicantUid);
        try {
            const updated = request.applicants.map(a =>
                a.user_id === applicantUid ? { ...a, status: 'accepted' as const } : a
            );
            await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updated });

            if (request.type === 'project') {
                const membershipId = `${applicantUid}_${request.target_id}`;
                const existing = await getDoc(doc(db, 'project_memberships', membershipId));
                if (!existing.exists()) {
                    await setDoc(doc(db, 'project_memberships', membershipId), {
                        user_id: applicantUid, project_id: request.target_id,
                        role: 'member', joined_at: new Date().toISOString()
                    });
                }
            } else {
                const membershipId = `${applicantUid}_${request.target_id}`;
                const existing = await getDoc(doc(db, 'memberships', membershipId));
                if (!existing.exists()) {
                    await setDoc(doc(db, 'memberships', membershipId), {
                        user_id: applicantUid, objective_id: request.target_id, completed_hours: 0
                    });
                }
            }

            const applicantRole = updated.find(a => a.user_id === applicantUid)?.role || '';
            const roleLabel = isFr ? getRolePreset(applicantRole).label : getRolePreset(applicantRole).labelEn;
            await addDoc(collection(db, 'users', applicantUid, 'notifications'), {
                type: 'teammate_accepted',
                message: isFr
                    ? `Votre candidature pour "${request.target_title}" (${roleLabel}) a été acceptée ! Vous avez été ajouté automatiquement.`
                    : `Your application for "${request.target_title}" (${roleLabel}) was accepted! You've been added automatically.`,
                link: `/${request.type === 'objective' ? 'objective' : 'project'}/${request.target_id}`,
                read: false,
                created_at: Timestamp.now()
            });

            const acceptedCount = updated.filter(a => a.status === 'accepted').length;
            const totalSpots = request.roles.reduce((a, r) => a + r.spots, 0);
            if (acceptedCount >= totalSpots) {
                await updateDoc(doc(db, 'teammate_requests', requestId), { status: 'closed' });
            }
        } catch (err) {
            console.error('Error accepting:', err);
        } finally {
            setProcessing(null);
        }
    };

    // ── Decline applicant ──
    const handleDecline = async (applicantUid: string) => {
        if (!request || !user) return;
        setProcessing(applicantUid);
        try {
            const updated = request.applicants.map(a =>
                a.user_id === applicantUid ? { ...a, status: 'declined' as const } : a
            );
            await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: updated });
            await addDoc(collection(db, 'users', applicantUid, 'notifications'), {
                type: 'teammate_declined',
                message: isFr
                    ? `Votre candidature pour "${request.target_title}" n'a pas été retenue.`
                    : `Your application for "${request.target_title}" was not accepted.`,
                link: `/find-teammates`,
                read: false,
                created_at: Timestamp.now()
            });
        } catch (err) {
            console.error('Error declining:', err);
        } finally {
            setProcessing(null);
        }
    };

    // ── Close/reopen ──
    const handleToggleStatus = async () => {
        if (!request) return;
        await updateDoc(doc(db, 'teammate_requests', requestId), { status: request.status === 'open' ? 'closed' : 'open' });
    };

    // ── Delete ──
    const handleDelete = async () => {
        if (!request) return;
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!request) return;
        await deleteDoc(doc(db, 'teammate_requests', requestId));
        router.push('/find-teammates');
    };

    // ── Save edit ──
    const handleSaveEdit = async () => {
        if (!request) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'teammate_requests', requestId), {
                description: editDescription,
                roles: editRoles.filter(r => r.spots > 0),
                skills: editSkills.split(',').map(s => s.trim()).filter(Boolean)
            });
            setShowEditModal(false);
        } catch (err) {
            console.error('Error saving:', err);
        } finally {
            setSaving(false);
        }
    };

    // ── Apply ──
    const handleApply = async () => {
        if (!user || !request || !applyRole) return;
        setSendingApplication(true);
        try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userName = userSnap.exists() ? userSnap.data().full_name : 'Utilisateur';
            const existing = request.applicants || [];
            existing.push({
                user_id: user.uid,
                role: applyRole,
                custom_label: applyRole === 'other' ? applyCustomRole.trim() : null,
                message: applyMessage,
                status: 'pending',
                applied_at: Timestamp.now()
            });
            await updateDoc(doc(db, 'teammate_requests', requestId), { applicants: existing });

            const roleLabel = (applyRole === 'other' && applyCustomRole.trim())
                ? applyCustomRole.trim()
                : (isFr ? getRolePreset(applyRole).label : getRolePreset(applyRole).labelEn);

            await addDoc(collection(db, 'users', request.creator_id, 'notifications'), {
                type: 'teammate_application',
                message: isFr
                    ? `${userName} souhaite rejoindre "${request.target_title}" en tant que ${roleLabel}`
                    : `${userName} wants to join "${request.target_title}" as ${roleLabel}`,
                link: `/find-teammates/${requestId}`,
                read: false,
                created_at: Timestamp.now()
            });
            setShowApplyForm(false);
            setApplyRole('');
            setApplyCustomRole('');
            setApplyMessage('');
            setActiveChat(user.uid);
        } catch (err) {
            console.error('Error applying:', err);
        } finally {
            setSendingApplication(false);
        }
    };

    // Open edit modal
    const openEditModal = () => {
        if (!request) return;
        setEditDescription(request.description);
        setEditRoles([...request.roles]);
        setEditSkills(request.skills?.join(', ') || '');
        setShowEditModal(true);
    };

    // ── Loading / Not found ──
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={24} style={{ color: '#fb923c', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }
    if (!request) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <AlertCircle size={40} style={{ color: 'rgba(255,255,255,.2)' }} />
                <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '0.9rem' }}>{isFr ? 'Annonce introuvable' : 'Request not found'}</p>
                <Link href="/find-teammates" style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                    <ArrowLeft size={12} style={{ marginRight: 4 }} /> {isFr ? 'Retour' : 'Back'}
                </Link>
            </div>
        );
    }

    const isVisible = request.status === 'open' || (user && (isOwner || hasApplied));
    if (!isVisible) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <Shield size={40} style={{ color: 'rgba(255,255,255,.2)' }} />
                <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '0.9rem', textAlign: 'center', maxWidth: '300px' }}>
                    {isFr ? "Cette annonce est fermée et n'est plus accessible." : "This request is closed and no longer accessible."}
                </p>
                <Link href="/find-teammates" style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                    <ArrowLeft size={12} style={{ marginRight: 4 }} /> {isFr ? 'Retour' : 'Back'}
                </Link>
            </div>
        );
    }

    const totalSpots = request.roles.reduce((a, r) => a + r.spots, 0);
    const acceptedCount = request.applicants.filter(a => a.status === 'accepted').length;
    const pendingCount = request.applicants.filter(a => a.status === 'pending').length;
    const accentColor = request.type === 'project' ? '#10b981' : '#c8a960';
    const previewProfile = previewUid ? applicantProfiles[previewUid] : null;
    const previewUser = previewUid ? applicantData[previewUid] : null;

    const zegoStyle: React.CSSProperties = activeCallRoomId
        ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, background: '#0d0d10' }
        : { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, visibility: 'hidden', pointerEvents: 'none', zIndex: -1 };

    return (
        <>
        <div style={{ minHeight: '100vh', fontFamily: "var(--font-display), 'Figtree', sans-serif" }}>
            {/* ZegoCloud Container */}
            <div ref={zegoContainerRef} style={zegoStyle} />
            <style>{`
                /* fonts loaded via next/font */
                @keyframes ftd-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes ftd-slide { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes ftd-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
                @keyframes ftd-slide-up { from { opacity: 0; transform: translateY(20px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .ftd-fade { animation: ftd-in 0.35s cubic-bezier(0.22,1,0.36,1) both; }
                .ftd-slide { animation: ftd-slide 0.3s cubic-bezier(0.22,1,0.36,1) both; }
                .ftd-input {
                    width: 100%; padding: 10px 14px;
                    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08);
                    border-radius: 12px; color: #f4f4f5;
                    font-family: var(--font-display),'Figtree',sans-serif; font-size: 0.82rem; outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .ftd-input:focus { border-color: rgba(251,146,60,.35); box-shadow: 0 0 0 3px rgba(251,146,60,.06); }
                .ftd-input::placeholder { color: rgba(255,255,255,.18); }
                .ftd-select {
                    width: 100%; padding: 10px 14px;
                    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08);
                    border-radius: 12px; color: #f4f4f5; font-family: var(--font-display),'Figtree',sans-serif;
                    font-size: 0.82rem; outline: none; appearance: none; cursor: pointer;
                }
                .ftd-applicant-row { transition: background 0.15s, border-color 0.15s; cursor: pointer; }
                .ftd-applicant-row:hover { background: rgba(255,255,255,.04) !important; border-color: rgba(255,255,255,.1) !important; }
                .ftd-action-btn { transition: all 0.18s cubic-bezier(0.22,1,0.36,1); }
                .ftd-action-btn:hover { transform: translateY(-1px); }
                .ftd-msg-bubble { animation: ftd-slide 0.25s cubic-bezier(0.22,1,0.36,1) both; }
                .ftd-modal-overlay {
                    position: fixed; inset: 0; z-index: 200;
                    background: rgba(0,0,0,.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center;
                    animation: ftd-in 0.2s ease;
                }
                .ftd-modal {
                    animation: ftd-slide-up 0.35s cubic-bezier(0.22,1,0.36,1);
                    width: 560px; max-width: 92vw; max-height: 85vh; overflow-y: auto;
                    background: #111114; border: 1px solid rgba(255,255,255,.08);
                    border-radius: 24px;
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05);
                }
                .ftd-call-card {
                    background: linear-gradient(135deg, rgba(200,169,96,.06), rgba(200,169,96,.04));
                    border: 1px solid rgba(200,169,96,.18);
                    border-radius: 14px; padding: 12px 16px;
                }
                .ftd-call-accepted { border-color: rgba(16,185,129,.25) !important; background: linear-gradient(135deg, rgba(16,185,129,.06), rgba(6,182,212,.03)) !important; }
                .ftd-call-declined { border-color: rgba(239,68,68,.15) !important; background: rgba(239,68,68,.04) !important; opacity: .6; }
                .ftd-call-rescheduled { border-color: rgba(251,146,60,.15) !important; background: rgba(251,146,60,.04) !important; opacity: .5; }
                .ftd-call-rescheduled::after { content: ''; position: absolute; left: 12%; right: 12%; top: 50%; height: 1.5px; background: rgba(251,146,60,.3); }

                .ftd-duration-chip {
                    padding: 4px 10px; border-radius: 20px; font-size: 0.68rem; font-weight: 600;
                    background: rgba(255,255,255,.03); border: 1.5px solid rgba(255,255,255,.06);
                    color: rgba(255,255,255,.35); cursor: pointer; transition: all 0.15s;
                }
                .ftd-duration-chip:hover { border-color: rgba(200,169,96,.25); color: rgba(255,255,255,.6); }
                .ftd-duration-chip.ftd-dur-selected { background: rgba(200,169,96,.1); border-color: rgba(200,169,96,.35); color: #d4b872; font-weight: 700; }
            `}</style>

            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

                {/* Back */}
                <div className="ftd-fade" style={{ marginBottom: '1.5rem' }}>
                    <Link href="/find-teammates" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 12px', borderRadius: 8,
                        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                        color: 'rgba(255,255,255,.35)', fontSize: '0.73rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = 'rgba(255,255,255,.6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.color = 'rgba(255,255,255,.35)'; }}
                    >
                        <ArrowLeft size={12} /> {isFr ? 'Toutes les annonces' : 'All requests'}
                    </Link>
                </div>

                {/* ── Main 2-column layout ── */}
                <div className="responsive-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                    {/* ═══ LEFT ═══ */}
                    <div className="ftd-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        {/* Request card */}
                        <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,.06)', background: 'rgba(13,13,18,.95)' }}>
                            <div style={{ height: '3px', background: `linear-gradient(90deg, #fb923c, ${accentColor}, #fb923c40)` }} />
                            <div style={{ padding: '1.3rem 1.4rem' }}>
                                {/* Creator + Status + Edit */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ borderRadius: '50%', padding: '1.5px', background: 'linear-gradient(135deg, #fb923c40, #7df4de40)' }}>
                                            <Avatar uid={request.creator_id} avatarUrl={creatorData?.avatar_url} avatarStyle={creatorData?.avatar_style} size={36} style={{ border: '1.5px solid #0d0d12' }} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#ddd8d0' }}>{request.creator_name}</p>
                                            <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,.22)' }}>
                                                <Clock size={9} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                                {request.created_at?.toDate?.().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {isOwner && (
                                            <button onClick={openEditModal} className="ftd-action-btn" style={{
                                                width: 28, height: 28, borderRadius: 8,
                                                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                                                cursor: 'pointer', color: 'rgba(255,255,255,.35)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }} title={isFr ? 'Modifier' : 'Edit'}>
                                                <Edit3 size={12} />
                                            </button>
                                        )}
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                            background: request.status === 'open' ? 'rgba(16,185,129,.1)' : 'rgba(255,255,255,.05)',
                                            border: `1px solid ${request.status === 'open' ? 'rgba(16,185,129,.25)' : 'rgba(255,255,255,.1)'}`,
                                            color: request.status === 'open' ? '#34d399' : 'rgba(255,255,255,.3)',
                                            textTransform: 'uppercase', letterSpacing: '0.05em'
                                        }}>
                                            {request.status === 'open' ? (isFr ? 'Ouvert' : 'Open') : (isFr ? 'Fermé' : 'Closed')}
                                        </span>
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                            background: `${accentColor}10`, border: `1px solid ${accentColor}25`, color: accentColor,
                                            textTransform: 'uppercase', letterSpacing: '0.03em'
                                        }}>
                                            {request.type === 'project' ? (isFr ? 'Projet' : 'Project') : (isFr ? 'Objectif' : 'Objective')}
                                        </span>
                                    </div>
                                </div>

                                {/* Title */}
                                <h1 style={{
                                    margin: '0 0 0.5rem', fontSize: '1.35rem', fontWeight: 900,
                                    color: '#ede9e3', letterSpacing: '-0.03em', lineHeight: 1.15,
                                    fontFamily: "var(--font-display), sans-serif"
                                }}>
                                    {request.target_title}
                                </h1>

                                {/* Description */}
                                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,.38)', lineHeight: 1.6 }}>
                                    {request.description}
                                </p>

                                {/* Roles */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                                    {request.roles.map((role, j) => {
                                        const preset = getRolePreset(role.key);
                                        const Icon = preset.icon;
                                        return (
                                            <div key={j} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '5px 12px', borderRadius: 10,
                                                background: `${preset.color}0c`, border: `1px solid ${preset.color}20`,
                                                fontSize: '0.74rem', fontWeight: 600, color: preset.color
                                            }}>
                                                <Icon size={12} />
                                                {role.custom_label || (isFr ? preset.label : preset.labelEn)}
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0 4px', borderRadius: 6, background: `${preset.color}18` }}>x{role.spots}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Skills */}
                                {request.skills?.length > 0 && (
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                        {request.skills.map((skill, j) => (
                                            <span key={j} style={{ fontSize: '0.64rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: 'rgba(255,255,255,.4)' }}>{skill}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Progress */}
                                <div style={{ padding: '0.8rem', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,.35)' }}>{isFr ? 'Places remplies' : 'Spots filled'}</span>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fb923c' }}>{acceptedCount} / {totalSpots}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '5px', borderRadius: 10, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 10,
                                            width: `${totalSpots > 0 ? Math.min((acceptedCount / totalSpots) * 100, 100) : 0}%`,
                                            background: 'linear-gradient(90deg, #fb923c, #f97316)',
                                            transition: 'width 0.5s ease',
                                            boxShadow: acceptedCount > 0 ? '0 0 8px rgba(251,146,60,.4)' : 'none'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '8px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,.25)' }}><span style={{ color: '#34d399', fontWeight: 700 }}>{acceptedCount}</span> {isFr ? 'accepté(s)' : 'accepted'}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,.25)' }}><span style={{ color: '#fb923c', fontWeight: 700 }}>{pendingCount}</span> {isFr ? 'en attente' : 'pending'}</span>
                                    </div>
                                </div>

                                {/* Owner actions */}
                                {isOwner && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '1rem' }}>
                                        <button onClick={handleToggleStatus} className="ftd-action-btn" style={{
                                            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: 10,
                                            background: request.status === 'open' ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.08)',
                                            border: `1px solid ${request.status === 'open' ? 'rgba(245,158,11,.2)' : 'rgba(16,185,129,.2)'}`,
                                            color: request.status === 'open' ? '#f59e0b' : '#34d399',
                                            fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer'
                                        }}>
                                            <Archive size={12} /> {request.status === 'open' ? (isFr ? 'Fermer' : 'Close') : (isFr ? 'Réouvrir' : 'Reopen')}
                                        </button>
                                        <button onClick={handleDelete} className="ftd-action-btn" style={{
                                            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: 10,
                                            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                                            color: '#f87171', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer'
                                        }}>
                                            <Trash2 size={12} /> {isFr ? 'Supprimer' : 'Delete'}
                                        </button>
                                    </div>
                                )}

                                {/* Applicant: Apply */}
                                {!isOwner && !hasApplied && request.status === 'open' && (
                                    <div style={{ marginTop: '1rem' }}>
                                        {!showApplyForm ? (
                                            <button onClick={() => { if (!user) { router.push('/login'); return; } setShowApplyForm(true); setApplyRole(request.roles[0]?.key || ''); }} className="ftd-action-btn" style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: 12, width: '100%', justifyContent: 'center',
                                                background: 'linear-gradient(135deg, #fb923c, #f97316)', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
                                            }}>
                                                <UserPlus size={14} /> {isFr ? 'Postuler à cette annonce' : 'Apply to this request'}
                                            </button>
                                        ) : (
                                            <div style={{ padding: '1rem', borderRadius: 14, background: 'rgba(251,146,60,.04)', border: '1px solid rgba(251,146,60,.12)' }}>
                                                <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', fontWeight: 700, color: '#fb923c' }}>{isFr ? 'Choisissez votre rôle' : 'Choose your role'}</p>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                                                    {request.roles.map(role => {
                                                        const preset = getRolePreset(role.key);
                                                        const Icon = preset.icon;
                                                        const sel = applyRole === role.key;
                                                        return (
                                                            <button key={role.key} onClick={() => setApplyRole(role.key)} style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 10,
                                                                background: sel ? `${preset.color}15` : 'rgba(255,255,255,.03)',
                                                                border: `1px solid ${sel ? preset.color + '40' : 'rgba(255,255,255,.08)'}`,
                                                                color: sel ? preset.color : 'rgba(255,255,255,.4)', fontSize: '0.75rem', fontWeight: sel ? 700 : 500, cursor: 'pointer'
                                                            }}>
                                                                <Icon size={12} /> {role.custom_label || (isFr ? preset.label : preset.labelEn)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {applyRole === 'other' && (
                                                    <div style={{ marginBottom: '0.8rem', animation: 'ftd-slide-up 0.3s ease' }}>
                                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '5px' }}>
                                                            {isFr ? 'Précisez votre rôle' : 'Specify your role'}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="ftd-input"
                                                            value={applyCustomRole}
                                                            onChange={e => setApplyCustomRole(e.target.value)}
                                                            placeholder={isFr ? 'Ex: Co-fondateur, CTO...' : 'e.g. Co-founder, CTO...'}
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}

                                                <textarea className="ftd-input" value={applyMessage} onChange={e => setApplyMessage(e.target.value)}
                                                    placeholder={isFr ? 'Présentez-vous brièvement... (optionnel)' : 'Introduce yourself briefly... (optional)'}
                                                    rows={2} style={{ resize: 'vertical', minHeight: '50px', marginBottom: '0.7rem' }} />
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => setShowApplyForm(false)} style={{ padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{isFr ? 'Annuler' : 'Cancel'}</button>
                                                    <button onClick={handleApply} disabled={!applyRole || sendingApplication} className="ftd-action-btn" style={{
                                                        padding: '7px 18px', borderRadius: 10, background: applyRole ? 'linear-gradient(135deg, #fb923c, #f97316)' : 'rgba(251,146,60,.2)',
                                                        border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: applyRole ? 'pointer' : 'not-allowed', opacity: sendingApplication ? 0.6 : 1
                                                    }}>
                                                        <Send size={11} style={{ marginRight: 4 }} /> {sendingApplication ? '...' : (isFr ? 'Envoyer' : 'Send')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Applicant: status */}
                                {!isOwner && hasApplied && (
                                    <div style={{
                                        marginTop: '1rem', padding: '0.8rem 1rem', borderRadius: 12,
                                        background: myApplication!.status === 'accepted' ? 'rgba(16,185,129,.06)' : myApplication!.status === 'declined' ? 'rgba(239,68,68,.06)' : 'rgba(251,146,60,.05)',
                                        border: `1px solid ${myApplication!.status === 'accepted' ? 'rgba(16,185,129,.18)' : myApplication!.status === 'declined' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.15)'}`,
                                        display: 'flex', alignItems: 'center', gap: '10px'
                                    }}>
                                        {myApplication!.status === 'accepted' ? <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0 }} /> : myApplication!.status === 'declined' ? <XCircle size={18} style={{ color: '#f87171', flexShrink: 0 }} /> : <Clock size={18} style={{ color: '#fb923c', flexShrink: 0, animation: 'ftd-pulse 2s infinite' }} />}
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: myApplication!.status === 'accepted' ? '#34d399' : myApplication!.status === 'declined' ? '#f87171' : '#fb923c' }}>
                                                {myApplication!.status === 'accepted' ? (isFr ? 'Candidature acceptée !' : 'Application accepted!') : myApplication!.status === 'declined' ? (isFr ? 'Candidature refusée' : 'Application declined') : (isFr ? 'Candidature en attente' : 'Application pending')}
                                            </p>
                                            {myApplication!.status === 'accepted' && (
                                                <Link href={`/${request.type === 'objective' ? 'objective' : 'project'}/${request.target_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#34d399', textDecoration: 'none' }}>
                                                    {isFr ? 'Accéder au' : 'Go to'} {request.type === 'project' ? (isFr ? 'projet' : 'project') : (isFr ? "l'objectif" : 'objective')} <ChevronRight size={12} />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Applicants list (owner only) ── */}
                        {isOwner && (
                            <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,.06)', background: 'rgba(13,13,18,.95)' }}>
                                <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#ede9e3', fontFamily: "var(--font-display), sans-serif" }}>
                                        <Users size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#fb923c' }} />
                                        {isFr ? 'Candidatures' : 'Applications'}
                                        <span style={{ marginLeft: 8, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: 'rgba(251,146,60,.1)', color: '#fb923c' }}>{request.applicants.length}</span>
                                    </h2>
                                </div>

                                {request.applicants.length === 0 ? (
                                    <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                                        <UserPlus size={28} style={{ color: 'rgba(255,255,255,.1)', marginBottom: '0.6rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,.22)' }}>{isFr ? 'Aucune candidature pour le moment' : 'No applications yet'}</p>
                                    </div>
                                ) : (
                                    <div style={{ padding: '0.5rem' }}>
                                        {[...request.applicants]
                                            .sort((a, b) => {
                                                const ta = (a.last_message_at || a.applied_at)?.toDate?.() || new Date(a.last_message_at || a.applied_at);
                                                const tb = (b.last_message_at || b.applied_at)?.toDate?.() || new Date(b.last_message_at || b.applied_at);
                                                return tb.getTime() - ta.getTime();
                                            })
                                            .map((app) => {
                                            const aData = applicantData[app.user_id];
                                            const preset = getRolePreset(app.role);
                                            const Icon = preset.icon;
                                            const isActive = activeChat === app.user_id;
                                            const isProcessing = processing === app.user_id;

                                            return (
                                                <div key={app.user_id} className="ftd-applicant-row"
                                                    onClick={() => setActiveChat(app.user_id)}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', gap: '6px',
                                                        padding: '0.8rem 1rem', borderRadius: 14, marginBottom: '4px',
                                                        background: isActive ? 'rgba(251,146,60,.05)' : 'transparent',
                                                        border: `1px solid ${isActive ? 'rgba(251,146,60,.15)' : 'transparent'}`,
                                                    }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ borderRadius: '50%', padding: '1.5px', background: isActive ? 'linear-gradient(135deg, #fb923c40, #7df4de40)' : 'rgba(255,255,255,.08)' }}>
                                                            <Avatar uid={app.user_id} avatarUrl={aData?.avatar_url} avatarStyle={aData?.avatar_style} size={34} style={{ border: '1.5px solid #0d0d12' }} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ddd8d0' }}>{aData?.full_name || app.user_id.slice(0, 10) + '...'}</span>
                                                                <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${preset.color}12`, color: preset.color, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                    <Icon size={9} /> {app.custom_label || (isFr ? preset.label : preset.labelEn)}
                                                                </span>
                                                            </div>
                                                            {app.message && (
                                                                <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,.3)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{app.message}&rdquo;</p>
                                                            )}
                                                        </div>

                                                        {/* Profile + Accept/Decline */}
                                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                            <button onClick={e => { e.stopPropagation(); setPreviewUid(previewUid === app.user_id ? null : app.user_id); }}
                                                                className="ftd-action-btn" style={{
                                                                    width: 30, height: 30, borderRadius: 8,
                                                                    background: previewUid === app.user_id ? 'rgba(251,146,60,.12)' : 'rgba(255,255,255,.04)',
                                                                    border: `1px solid ${previewUid === app.user_id ? 'rgba(251,146,60,.25)' : 'rgba(255,255,255,.08)'}`,
                                                                    cursor: 'pointer', color: previewUid === app.user_id ? '#fb923c' : 'rgba(255,255,255,.3)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }} title={isFr ? 'Voir le profil' : 'View profile'}>
                                                                <Users size={12} />
                                                            </button>
                                                            {app.status === 'pending' && (
                                                                <>
                                                                    <button onClick={e => { e.stopPropagation(); handleAccept(app.user_id); }} disabled={isProcessing} className="ftd-action-btn" style={{
                                                                        width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)',
                                                                        cursor: 'pointer', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isProcessing ? 0.5 : 1
                                                                    }} title={isFr ? 'Accepter' : 'Accept'}><Check size={14} /></button>
                                                                    <button onClick={e => { e.stopPropagation(); handleDecline(app.user_id); }} disabled={isProcessing} className="ftd-action-btn" style={{
                                                                        width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                                                                        cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isProcessing ? 0.5 : 1
                                                                    }} title={isFr ? 'Refuser' : 'Decline'}><X size={14} /></button>
                                                                </>
                                                            )}
                                                            {app.status !== 'pending' && (
                                                                <span style={{
                                                                    fontSize: '0.6rem', fontWeight: 700, padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center',
                                                                    background: app.status === 'accepted' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.08)',
                                                                    color: app.status === 'accepted' ? '#34d399' : '#f87171'
                                                                }}>
                                                                    {app.status === 'accepted' ? (isFr ? 'Accepté' : 'Accepted') : (isFr ? 'Refusé' : 'Declined')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isActive && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: '#fb923c', fontWeight: 600, paddingLeft: '44px' }}>
                                                            <MessageCircle size={9} /> {isFr ? 'Discussion ouverte' : 'Chat open'}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Profile Preview Panel ── */}
                        {previewUid && previewUser && (
                            <div className="ftd-fade" style={{
                                borderRadius: '20px', overflow: 'hidden',
                                border: '1px solid rgba(251,146,60,.12)', background: 'rgba(13,13,18,.95)',
                            }}>
                                <div style={{ padding: '1.2rem 1.4rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#fb923c', fontFamily: "var(--font-display), sans-serif" }}>
                                            {isFr ? 'Profil du candidat' : 'Applicant Profile'}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <Link href={`/user/${previewUid}`} style={{
                                                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 8,
                                                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                                                color: 'rgba(255,255,255,.4)', fontSize: '0.65rem', fontWeight: 600, textDecoration: 'none'
                                            }}>
                                                <ExternalLink size={9} /> {isFr ? 'Profil complet' : 'Full profile'}
                                            </Link>
                                            <button onClick={() => setPreviewUid(null)} style={{
                                                width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,.04)',
                                                border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', color: 'rgba(255,255,255,.3)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}><X size={10} /></button>
                                        </div>
                                    </div>

                                    {/* User info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                        <div style={{ borderRadius: '50%', padding: '2px', background: 'linear-gradient(135deg, #fb923c40, #7df4de40)' }}>
                                            <Avatar uid={previewUid} avatarUrl={previewUser?.avatar_url} avatarStyle={previewUser?.avatar_style} size={48} style={{ border: '2px solid #0d0d12' }} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ede9e3' }}>{previewUser?.full_name || 'Utilisateur'}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,.25)' }}>
                                                {previewUser?.created_at?.toDate ? (isFr ? 'Membre depuis ' : 'Member since ') + previewUser.created_at.toDate().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' }) : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    {previewProfile && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.8rem' }}>
                                                <div style={{ padding: '10px', borderRadius: 10, background: 'rgba(200,169,96,.06)', border: '1px solid rgba(200,169,96,.12)', textAlign: 'center' }}>
                                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#d4b872' }}>{fmtHours(previewProfile.totalHours)}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isFr ? 'Temps complété' : 'Time completed'}</p>
                                                </div>
                                                <div style={{ padding: '10px', borderRadius: 10, background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.12)', textAlign: 'center' }}>
                                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#34d399' }}>{previewProfile.totalRooms}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isFr ? 'Salons rejoints' : 'Rooms joined'}</p>
                                                </div>
                                            </div>

                                            {/* Active objectives/projects */}
                                            {(previewProfile.objectives.length > 0 || previewProfile.projects.length > 0) && (
                                                <div>
                                                    <p style={{ margin: '0 0 6px', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {isFr ? 'Activité publique' : 'Public activity'}
                                                    </p>
                                                    {[...previewProfile.objectives, ...previewProfile.projects].slice(0, 4).map((item: any, i: number) => (
                                                        <div key={i} style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
                                                            borderRadius: 8, background: 'rgba(255,255,255,.02)', marginBottom: '3px'
                                                        }}>
                                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,.15)' }}>{item.project_id ? '📁' : '🎯'}</span>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!previewProfile && (
                                        <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,.2)' }}>
                                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 4 }} /> {isFr ? 'Chargement...' : 'Loading...'}
                                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══ RIGHT: Chat panel ═══ */}
                    <div className="ftd-fade" style={{ animationDelay: '0.1s', position: 'sticky', top: '6rem' }}>
                        <div style={{
                            borderRadius: '20px', overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,.06)', background: 'rgba(13,13,18,.95)',
                            height: 'calc(100vh - 10rem)', display: 'flex', flexDirection: 'column'
                        }}>
                            {/* ── Tab bar ── */}
                            <div style={{
                                display: 'flex', alignItems: 'stretch',
                                borderBottom: '1px solid rgba(255,255,255,.05)',
                                flexShrink: 0,
                            }}>
                                {[
                                    { key: 'chat' as const, icon: MessageCircle, label: isFr ? 'Discussion' : 'Chat', color: '#fb923c' },
                                    { key: 'agenda' as const, icon: Calendar, label: 'Agenda', color: '#8b5cf6', count: recruitingSessions.length },
                                ].map(tab => {
                                    const isActive = rightTab === tab.key;
                                    const TabIcon = tab.icon;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => setRightTab(tab.key)}
                                            style={{
                                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                                padding: '0.85rem 0.5rem', cursor: 'pointer',
                                                background: isActive ? `${tab.color}08` : 'transparent',
                                                border: 'none', borderBottom: `2.5px solid ${isActive ? tab.color : 'transparent'}`,
                                                color: isActive ? tab.color : 'rgba(255,255,255,.3)',
                                                fontSize: '0.78rem', fontWeight: isActive ? 800 : 600,
                                                fontFamily: "var(--font-display), sans-serif",
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            <TabIcon size={14} />
                                            {tab.label}
                                            {tab.count !== undefined && tab.count > 0 && (
                                                <span style={{
                                                    fontSize: '0.58rem', fontWeight: 800, padding: '1px 6px', borderRadius: 10,
                                                    background: isActive ? `${tab.color}18` : 'rgba(255,255,255,.05)',
                                                    color: isActive ? tab.color : 'rgba(255,255,255,.25)',
                                                    minWidth: '18px', textAlign: 'center',
                                                }}>
                                                    {tab.count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ── CHAT TAB ── */}
                            {rightTab === 'chat' && (<>
                            
                            {/* Active Call Banner */}
                            {activeInterviewSession && activeChat && (hasApplied || isOwner) && (
                                <div style={{
                                    padding: '12px 16px', background: 'linear-gradient(135deg, rgba(200,169,96,0.1), rgba(200,169,96,0.12))',
                                    borderBottom: '1px solid rgba(200,169,96,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(200,169,96,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Video size={16} style={{ color: '#c8a960' }} />
                                            <style>{`
                                                @keyframes callPulse {
                                                    0% { transform: scale(0.95); opacity: 0.8; }
                                                    50% { transform: scale(1.05); opacity: 1; }
                                                    100% { transform: scale(0.95); opacity: 0.8; }
                                                }
                                            `}</style>
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#d4b872', textTransform: 'uppercase', letterSpacing: '.05em', animation: 'callPulse 2.5s infinite' }}>
                                                {isFr ? 'Entretien en cours' : 'Interview active'}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
                                                {activeInterviewSession.title}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => {
                                        setPreJoinMic(true);
                                        setPreJoinVideo(true);
                                        setShowCustomPreJoin(activeInterviewSession.id);
                                    }} className="ftd-action-btn" style={{
                                        padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #c8a960, #8b5cf6)', border: 'none',
                                        color: '#fff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                        boxShadow: '0 4px 14px -4px rgba(200,169,96,0.5)'
                                    }}>
                                        <Video size={13} /> {isFr ? 'Rejoindre l\'appel' : 'Join Call'}
                                    </button>
                                </div>
                            )}

                            {/* Chat sub-header */}
                            {activeChat && (hasApplied || isOwner) && (
                                <div style={{ padding: '0.6rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    <button onClick={() => setShowCallForm(!showCallForm)} className="ftd-action-btn" style={{
                                        display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 8,
                                        background: showCallForm ? 'rgba(200,169,96,.12)' : 'rgba(255,255,255,.04)',
                                        border: `1px solid ${showCallForm ? 'rgba(200,169,96,.25)' : 'rgba(255,255,255,.08)'}`,
                                        cursor: 'pointer', color: showCallForm ? '#c8a960' : 'rgba(255,255,255,.35)',
                                        fontSize: '0.65rem', fontWeight: 600
                                    }} title={isFr ? 'Planifier un appel' : 'Schedule a call'}>
                                        <Phone size={10} /> {isFr ? 'Appel' : 'Call'}
                                    </button>
                                    <div style={{ flex: 1 }} />
                                    <Avatar
                                        uid={isOwner ? activeChat : request.creator_id}
                                        avatarUrl={isOwner ? applicantData[activeChat]?.avatar_url : creatorData?.avatar_url}
                                        avatarStyle={isOwner ? applicantData[activeChat]?.avatar_style : creatorData?.avatar_style}
                                        size={22} style={{ border: '1.5px solid #0d0d12' }}
                                    />
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>
                                        {isOwner ? (applicantData[activeChat]?.full_name || activeChat.slice(0, 8) + '...') : (creatorData?.full_name || request.creator_name)}
                                    </span>
                                </div>
                            )}

                            {/* Schedule call form — compact CalendarPicker */}
                            {showCallForm && activeChat && (
                                <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#c8a960', fontFamily: "var(--font-display), sans-serif" }}>
                                            <Calendar size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                            {isFr ? 'Proposer un appel' : 'Propose a call'}
                                        </p>
                                        <button onClick={() => setShowCallForm(false)} style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', color: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} /></button>
                                    </div>

                                    <CalendarPicker value={callDatetime} onChange={setCallDatetime} placeholder={isFr ? 'Choisir date et heure...' : 'Pick date and time...'} compact />

                                    {/* Duration chips */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, marginBottom: 10 }}>
                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.04em', alignSelf: 'center', marginRight: 2 }}>{isFr ? 'Durée' : 'Duration'}</span>
                                        {[15, 30, 45, 60, 90].map(d => (
                                            <button key={d} className={`ftd-duration-chip ${callDuration === d ? 'ftd-dur-selected' : ''}`} onClick={() => setCallDuration(d)}>
                                                {d} min
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => { setShowCallForm(false); setCallDatetime(''); }} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>{isFr ? 'Annuler' : 'Cancel'}</button>
                                        <button onClick={handleScheduleCall} disabled={!callDatetime || sendingCall} className="ftd-action-btn" style={{
                                            padding: '6px 16px', borderRadius: 8,
                                            background: callDatetime ? 'linear-gradient(135deg, #c8a960, #8b5cf6)' : 'rgba(200,169,96,.15)',
                                            border: 'none', color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                                            cursor: callDatetime ? 'pointer' : 'not-allowed', opacity: sendingCall ? 0.5 : 1,
                                            boxShadow: callDatetime ? '0 4px 14px -4px rgba(200,169,96,.4)' : 'none',
                                        }}>
                                            <Send size={10} style={{ marginRight: 4 }} /> {sendingCall ? '...' : (isFr ? 'Proposer' : 'Propose')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Chat body */}
                            {!activeChat || (!isOwner && !hasApplied) ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
                                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, rgba(251,146,60,.08), rgba(244,114,182,.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                                        <MessageCircle size={24} style={{ color: '#fb923c', opacity: 0.5 }} />
                                    </div>
                                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>
                                        {!hasApplied && !isOwner ? (isFr ? 'Postulez pour discuter' : 'Apply to start chatting') : (isFr ? 'Sélectionnez un candidat' : 'Select an applicant')}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(255,255,255,.2)', maxWidth: 280 }}>
                                        {!hasApplied && !isOwner ? (isFr ? 'Envoyez votre candidature pour échanger avec le créateur.' : 'Submit your application to chat with the creator.') : (isFr ? 'Cliquez sur un candidat à gauche.' : 'Click an applicant on the left.')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {chatMessages.length === 0 && (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.4 }}>
                                                <Sparkles size={20} style={{ color: '#fb923c', marginBottom: '0.6rem' }} />
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,.4)' }}>{isFr ? 'Commencez la conversation !' : 'Start the conversation!'}</p>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,.2)', maxWidth: 240 }}>
                                                    {isFr ? 'Discutez du projet, des attentes, et planifiez un appel.' : 'Discuss the project, expectations, and schedule a call.'}
                                                </p>
                                            </div>
                                        )}
                                        {chatMessages.map((msg, i) => {
                                            const isMe = msg.sender_id === user?.uid;
                                            const senderIsCreator = msg.sender_id === request.creator_id;

                                            // Call invite special card with accept/decline/counter-propose
                                            if (msg.type === 'call_invite') {
                                                const cStatus = msg.call_status || 'pending';
                                                const isRecipient = msg.sender_id !== user?.uid;
                                                const statusClass = cStatus === 'accepted' ? 'ftd-call-accepted' : cStatus === 'declined' ? 'ftd-call-declined' : cStatus === 'rescheduled' ? 'ftd-call-rescheduled' : '';
                                                const isCountering = counterMsgId === msg.id;

                                                return (
                                                    <div key={msg.id} className="ftd-msg-bubble" style={{ animationDelay: `${i * 0.03}s`, display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                                                        <div style={{ maxWidth: '90%', width: '100%' }}>
                                                            <div className={`ftd-call-card ${statusClass}`} style={{ textAlign: 'center', position: 'relative' }}>
                                                                {/* Status badge */}
                                                                {cStatus !== 'pending' && (
                                                                    <div style={{
                                                                        position: 'absolute', top: -8, right: 12, padding: '2px 8px', borderRadius: 6,
                                                                        fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em',
                                                                        background: cStatus === 'accepted' ? '#10b981' : cStatus === 'declined' ? '#ef4444' : '#fb923c',
                                                                        color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.3)'
                                                                    }}>
                                                                        {cStatus === 'accepted' ? (isFr ? 'Confirmé' : 'Confirmed') : cStatus === 'declined' ? (isFr ? 'Décliné' : 'Declined') : (isFr ? 'Replanifié' : 'Rescheduled')}
                                                                    </div>
                                                                )}

                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                                                                    <div style={{ width: 28, height: 28, borderRadius: 10, background: cStatus === 'accepted' ? 'rgba(16,185,129,.12)' : 'rgba(200,169,96,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {cStatus === 'accepted' ? <CheckCircle2 size={14} style={{ color: '#34d399' }} /> : <Video size={14} style={{ color: '#c8a960' }} />}
                                                                    </div>
                                                                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: cStatus === 'accepted' ? '#34d399' : '#d4b872', fontFamily: "var(--font-display), sans-serif" }}>
                                                                        {cStatus === 'accepted' ? (isFr ? 'Appel confirmé' : 'Call confirmed') : cStatus === 'rescheduled' ? (isFr ? 'Horaire modifié' : 'Time changed') : (isFr ? 'Appel proposé' : 'Call proposed')}
                                                                    </p>
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '8px 0', flexWrap: 'wrap' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                        <Calendar size={12} style={{ color: 'rgba(255,255,255,.3)' }} />
                                                                        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>
                                                                            {msg.call_date && new Date(msg.call_date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'long' })}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                        <Clock size={12} style={{ color: 'rgba(255,255,255,.3)' }} />
                                                                        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>{msg.call_time}</span>
                                                                    </div>
                                                                    {msg.call_duration && (
                                                                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 6, background: 'rgba(200,169,96,.08)', color: '#d4b872', fontWeight: 600 }}>
                                                                            {msg.call_duration} min
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <p style={{ margin: '4px 0 0', fontSize: '0.62rem', color: 'rgba(255,255,255,.2)' }}>
                                                                    {isFr ? 'proposé par' : 'proposed by'} {senderIsCreator ? request.creator_name : (applicantData[msg.sender_id]?.full_name || '...')}
                                                                </p>

                                                                {/* Accept / Decline / Counter-propose — only for recipient, only if pending */}
                                                                {isRecipient && cStatus === 'pending' && (
                                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                                                                        <button onClick={() => handleAcceptCall(msg.id, msg)} className="ftd-action-btn" style={{
                                                                            padding: '6px 14px', borderRadius: 8,
                                                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                                                            border: 'none', color: '#fff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                                                            display: 'flex', alignItems: 'center', gap: 4,
                                                                            boxShadow: '0 3px 10px -3px rgba(16,185,129,.4)'
                                                                        }}>
                                                                            <Check size={11} /> {isFr ? 'Accepter' : 'Accept'}
                                                                        </button>
                                                                        <button onClick={() => { setCounterMsgId(msg.id); setCounterDatetime(''); }} className="ftd-action-btn" style={{
                                                                            padding: '6px 14px', borderRadius: 8,
                                                                            background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)',
                                                                            color: '#fb923c', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                                                            display: 'flex', alignItems: 'center', gap: 4,
                                                                        }}>
                                                                            <Calendar size={11} /> {isFr ? 'Autre horaire' : 'Suggest time'}
                                                                        </button>
                                                                        <button onClick={() => handleDeclineCall(msg.id, msg)} className="ftd-action-btn" style={{
                                                                            padding: '6px 12px', borderRadius: 8,
                                                                            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.12)',
                                                                            color: '#f87171', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                                                            display: 'flex', alignItems: 'center', gap: 4,
                                                                        }}>
                                                                            <X size={11} /> {isFr ? 'Décliner' : 'Decline'}
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {cStatus === 'accepted' && (
                                                                    <p style={{ margin: '8px 0 0', fontSize: '0.65rem', color: '#34d399', fontWeight: 600 }}>
                                                                        <CheckCircle2 size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                                                                        {isFr ? 'Ajouté à l\'agenda des deux participants' : 'Added to both participants\' calendar'}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Inline counter-propose calendar */}
                                                            {isCountering && (
                                                                <div className="ftd-fade" style={{ marginTop: 8, padding: '12px 14px', borderRadius: 14, background: 'rgba(251,146,60,.03)', border: '1px solid rgba(251,146,60,.12)' }}>
                                                                    <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#fb923c' }}>
                                                                        <Calendar size={10} style={{ marginRight: 4 }} />
                                                                        {isFr ? 'Proposer un autre horaire' : 'Suggest a different time'}
                                                                    </p>

                                                                    <CalendarPicker value={counterDatetime} onChange={setCounterDatetime} placeholder={isFr ? 'Choisir date et heure...' : 'Pick date and time...'} compact />

                                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                                                                        <button onClick={() => setCounterMsgId(null)} style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>{isFr ? 'Annuler' : 'Cancel'}</button>
                                                                        <button onClick={() => handleCounterPropose(msg.id)} disabled={!counterDatetime || sendingCall} className="ftd-action-btn" style={{
                                                                            padding: '5px 14px', borderRadius: 8,
                                                                            background: counterDatetime ? 'linear-gradient(135deg, #fb923c, #f97316)' : 'rgba(251,146,60,.15)',
                                                                            border: 'none', color: '#fff', fontSize: '0.68rem', fontWeight: 700,
                                                                            cursor: counterDatetime ? 'pointer' : 'not-allowed', opacity: sendingCall ? 0.5 : 1,
                                                                        }}>
                                                                            <Send size={9} style={{ marginRight: 3 }} /> {sendingCall ? '...' : (isFr ? 'Proposer' : 'Propose')}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={msg.id} className="ftd-msg-bubble" style={{ animationDelay: `${i * 0.03}s`, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                                                    {(i === 0 || chatMessages[i - 1].sender_id !== msg.sender_id) && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', padding: isMe ? '0 4px 0 0' : '0 0 0 4px' }}>
                                                            <Avatar uid={msg.sender_id} avatarUrl={senderIsCreator ? creatorData?.avatar_url : applicantData[msg.sender_id]?.avatar_url} avatarStyle={senderIsCreator ? creatorData?.avatar_style : applicantData[msg.sender_id]?.avatar_style} size={16} style={{ border: '1px solid #0d0d12' }} />
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,.25)' }}>
                                                                {senderIsCreator ? request.creator_name : (applicantData[msg.sender_id]?.full_name || msg.sender_id.slice(0, 8))}
                                                                {senderIsCreator && <span style={{ marginLeft: 4, fontSize: '0.52rem', padding: '1px 4px', borderRadius: 4, background: 'rgba(251,146,60,.1)', color: '#fb923c', fontWeight: 700 }}>{isFr ? 'Auteur' : 'Author'}</span>}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        maxWidth: '80%', padding: '8px 13px',
                                                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                                        background: isMe ? 'rgba(251,146,60,.12)' : 'rgba(255,255,255,.04)',
                                                        border: `1px solid ${isMe ? 'rgba(251,146,60,.2)' : 'rgba(255,255,255,.06)'}`,
                                                        fontSize: '0.8rem', lineHeight: 1.5,
                                                        color: isMe ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.65)',
                                                        wordBreak: 'break-word', whiteSpace: 'pre-wrap'
                                                    }}>
                                                        {msg.content}
                                                    </div>
                                                    {(i === chatMessages.length - 1 || chatMessages[i + 1].sender_id !== msg.sender_id) && (
                                                        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,.15)', padding: '2px 4px', marginTop: '1px' }}>
                                                            {msg.created_at?.toDate?.().toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Chat input */}
                                    <div style={{ padding: '0.8rem 1.2rem', borderTop: '1px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                            <textarea className="ftd-input" value={chatInput} onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                                                placeholder={isFr ? 'Écrivez un message...' : 'Write a message...'}
                                                rows={1} style={{ resize: 'none', minHeight: '40px', maxHeight: '120px', flex: 1 }} />
                                            <button onClick={handleSendChat} disabled={!chatInput.trim() || sendingChat} style={{
                                                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                                background: chatInput.trim() ? 'linear-gradient(135deg, #fb923c, #f97316)' : 'rgba(255,255,255,.05)',
                                                border: chatInput.trim() ? 'none' : '1px solid rgba(255,255,255,.08)',
                                                color: chatInput.trim() ? '#fff' : 'rgba(255,255,255,.2)',
                                                cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                            }}><Send size={14} /></button>
                                        </div>
                                        <p style={{ margin: '5px 0 0', fontSize: '0.58rem', color: 'rgba(255,255,255,.15)' }}>
                                            Enter ↵ {isFr ? 'pour envoyer' : 'to send'}
                                        </p>
                                    </div>
                                </>
                            )}
                            </>)}

                            {/* ── AGENDA TAB ── */}
                            {rightTab === 'agenda' && (
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                                    {recruitingSessions.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                                            <div style={{
                                                width: 56, height: 56, borderRadius: 16,
                                                background: 'linear-gradient(135deg, rgba(200,169,96,.1), rgba(200,169,96,.05))',
                                                border: '1px solid rgba(200,169,96,.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Phone size={24} style={{ color: 'rgba(200,169,96,.35)' }} />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,.25)' }}>
                                                {isFr ? 'Aucun appel planifié' : 'No scheduled calls'}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,.15)', textAlign: 'center', maxWidth: 200 }}>
                                                {isFr ? 'Les appels acceptés apparaîtront ici' : 'Accepted calls will appear here'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {/* Stats bar */}
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                <div style={{
                                                    flex: 1, padding: '10px 12px', borderRadius: 14,
                                                    background: 'rgba(200,169,96,.05)', border: '1px solid rgba(200,169,96,.12)',
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#d4b872', fontFamily: "var(--font-display), sans-serif" }}>
                                                        {recruitingSessions.filter(s => {
                                                            const d = s.scheduled_at?.toDate ? s.scheduled_at.toDate() : new Date(s.scheduled_at);
                                                            return d >= new Date();
                                                        }).length}
                                                    </div>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {isFr ? 'À venir' : 'Upcoming'}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    flex: 1, padding: '10px 12px', borderRadius: 14,
                                                    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'rgba(255,255,255,.35)', fontFamily: "var(--font-display), sans-serif" }}>
                                                        {recruitingSessions.filter(s => {
                                                            const d = s.scheduled_at?.toDate ? s.scheduled_at.toDate() : new Date(s.scheduled_at);
                                                            return d < new Date();
                                                        }).length}
                                                    </div>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,.15)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {isFr ? 'Terminés' : 'Completed'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Session cards */}
                                            {recruitingSessions.map((rs, idx) => {
                                                const dateObj = rs.scheduled_at?.toDate ? rs.scheduled_at.toDate() : new Date(rs.scheduled_at);
                                                const now = new Date();
                                                const isPast = dateObj < now;
                                                const isToday = dateObj.toDateString() === now.toDateString();
                                                const isTomorrow = dateObj.toDateString() === new Date(now.getTime() + 86400000).toDateString();
                                                const dayNum = dateObj.getDate();
                                                const monthName = dateObj.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short' });
                                                const timeStr = dateObj.toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
                                                const dayName = dateObj.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'long' });
                                                const relativeLabel = isPast
                                                    ? (isFr ? 'Terminé' : 'Done')
                                                    : isToday ? (isFr ? "Aujourd'hui" : 'Today')
                                                    : isTomorrow ? (isFr ? 'Demain' : 'Tomorrow')
                                                    : dayName;

                                                const otherUid = rs.attendees?.find((uid: string) => uid !== user?.uid) || '';
                                                const otherData = applicantData[otherUid] || creatorData;

                                                return (
                                                    <div key={rs.id} className="ftd-slide" style={{
                                                        display: 'flex', alignItems: 'center', gap: '12px',
                                                        padding: '0.8rem 0.9rem', borderRadius: 14,
                                                        background: isPast ? 'rgba(255,255,255,.015)' : isToday ? 'rgba(200,169,96,.06)' : 'rgba(255,255,255,.025)',
                                                        border: `1px solid ${isPast ? 'rgba(255,255,255,.04)' : isToday ? 'rgba(200,169,96,.18)' : 'rgba(255,255,255,.06)'}`,
                                                        opacity: isPast ? 0.45 : 1,
                                                        animationDelay: `${idx * 0.05}s`,
                                                        transition: 'all 0.2s ease',
                                                    }}>
                                                        {/* Date block */}
                                                        <div style={{
                                                            textAlign: 'center', minWidth: '44px',
                                                            padding: '5px', borderRadius: 10,
                                                            background: isPast ? 'rgba(255,255,255,.03)' : 'rgba(200,169,96,.08)',
                                                        }}>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 900, lineHeight: 1, color: isPast ? 'rgba(255,255,255,.25)' : '#d4b872', fontFamily: "var(--font-display), sans-serif" }}>{dayNum}</div>
                                                            <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '0.03em', marginTop: '1px' }}>{monthName}</div>
                                                        </div>

                                                        {/* Avatar + info */}
                                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Avatar
                                                                uid={otherUid}
                                                                avatarUrl={otherData?.avatar_url}
                                                                avatarStyle={otherData?.avatar_style}
                                                                size={30}
                                                                style={{ border: '1.5px solid rgba(200,169,96,.2)', flexShrink: 0 }}
                                                            />
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ddd8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {rs.title}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: '0.62rem', color: isToday ? '#d4b872' : 'rgba(255,255,255,.3)', fontWeight: 600 }}>
                                                                        {relativeLabel} {isFr ? 'à' : 'at'} {timeStr}
                                                                    </span>
                                                                    {rs.call_duration && (
                                                                        <span style={{
                                                                            fontSize: '0.56rem', fontWeight: 700, padding: '1px 5px', borderRadius: 5,
                                                                            background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.22)'
                                                                        }}>
                                                                            {rs.call_duration}min
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Actions & Status */}
                                                        {!isPast && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <button
                                                                    onClick={() => setRescheduleSession({ id: rs.id, otherUid, title: rs.title, callDuration: rs.call_duration || 30 })}
                                                                    className="ftd-action-btn"
                                                                    style={{
                                                                        padding: '6px 10px', borderRadius: 8,
                                                                        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                                                                        color: 'rgba(255,255,255,.6)', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '4px'
                                                                    }}
                                                                >
                                                                    <Calendar size={10} /> {isFr ? 'Reprogrammer' : 'Reschedule'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowCancelAgendaConfirm({ id: rs.id, otherUid })}
                                                                    disabled={cancelingSessionId === rs.id}
                                                                    className="ftd-action-btn"
                                                                    style={{
                                                                        padding: '6px 10px', borderRadius: 8,
                                                                        background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                                                                        color: '#f87171', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                                        opacity: cancelingSessionId === rs.id ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    {cancelingSessionId === rs.id ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <X size={10} />}
                                                                    {isFr ? 'Annuler' : 'Cancel'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            {/* ── Edit Modal ── */}
            {showEditModal && (
                <div className="ftd-modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="ftd-modal" onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem 1.5rem 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.3rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontFamily: "var(--font-display), sans-serif", background: 'linear-gradient(135deg, #fb923c, #7df4de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    {isFr ? "Modifier l'annonce" : 'Edit Request'}
                                </h2>
                                <button onClick={() => setShowEditModal(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.05)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>{isFr ? 'Description' : 'Description'}</label>
                                <textarea className="ftd-input" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} style={{ resize: 'vertical', minHeight: '100px' }} />
                            </div>

                            {/* Roles */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>{isFr ? 'Rôles recherchés' : 'Roles needed'}</label>
                                {editRoles.map((role, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                                        <select className="ftd-select" style={{ flex: 1 }} value={role.key}
                                            onChange={e => { const u = [...editRoles]; u[i] = { ...u[i], key: e.target.value }; setEditRoles(u); }}>
                                            {ROLE_PRESETS.map(r => <option key={r.key} value={r.key}>{isFr ? r.label : r.labelEn}</option>)}
                                        </select>
                                        {role.key === 'other' && (
                                            <input type="text" className="ftd-input" style={{ flex: 1.5 }}
                                                placeholder={isFr ? 'Nom du rôle...' : 'Role name...'}
                                                value={role.custom_label || ''}
                                                onChange={e => { const u = [...editRoles]; u[i] = { ...u[i], custom_label: e.target.value }; setEditRoles(u); }} />
                                        )}
                                        <input type="number" min={1} max={10} value={role.spots} className="ftd-input" style={{ width: '60px', textAlign: 'center' }}
                                            onChange={e => { const u = [...editRoles]; u[i] = { ...u[i], spots: parseInt(e.target.value) || 1 }; setEditRoles(u); }} />
                                        {editRoles.length > 1 && (
                                            <button onClick={() => setEditRoles(editRoles.filter((_, j) => j !== i))} style={{
                                                width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                                                cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}><X size={11} /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setEditRoles([...editRoles, { key: 'designer', spots: 1 }])} style={{
                                    display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: 8,
                                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
                                    color: 'rgba(255,255,255,.35)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                                }}><Plus size={11} /> {isFr ? 'Ajouter un rôle' : 'Add role'}</button>
                            </div>

                            {/* Skills */}
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>{isFr ? 'Compétences (virgules)' : 'Skills (comma-separated)'}</label>
                                <input type="text" className="ftd-input" value={editSkills} onChange={e => setEditSkills(e.target.value)} placeholder="React, Figma, Python..." />
                            </div>
                        </div>

                        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowEditModal(false)} style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>{isFr ? 'Annuler' : 'Cancel'}</button>
                            <button onClick={handleSaveEdit} disabled={saving} className="ftd-action-btn" style={{
                                padding: '9px 20px', borderRadius: 10,
                                background: 'linear-gradient(135deg, #fb923c, #f97316)',
                                border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                                cursor: 'pointer', opacity: saving ? 0.6 : 1
                            }}>
                                <Save size={12} style={{ marginRight: 4 }} /> {saving ? '...' : (isFr ? 'Sauvegarder' : 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <>
                    <div
                        onClick={() => setShowDeleteConfirm(false)}
                        className="ftd-modal-overlay"
                        style={{ zIndex: 4000 }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        zIndex: 4001, width: 400,
                        background: '#1a1a24',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 24,
                        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(239,68,68,0.15)',
                        padding: '36px 32px 32px',
                        animation: 'ftd-slide-up 0.3s cubic-bezier(0.16,1,0.3,1)',
                        textAlign: 'center'
                    }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Trash2 size={28} color="#ef4444" style={{ filter: 'drop-shadow(0 2px 8px rgba(239,68,68,0.4))' }} />
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f4f4f5', marginBottom: 10, letterSpacing: '-0.02em', fontFamily: "var(--font-display), sans-serif" }}>
                            {isFr ? 'Supprimer cette annonce ?' : 'Delete this request?'}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#a1a1aa', lineHeight: 1.6, marginBottom: 32 }}>
                            {isFr 
                                ? 'Cette action est irréversible. Les candidats et les messages seront définitivement effacés.' 
                                : 'This action is irreversible. Applicants and messages will be permanently deleted.'}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#a1a1aa', fontSize: '0.9rem', fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#a1a1aa'; }}
                            >
                                {isFr ? 'Annuler' : 'Cancel'}
                            </button>
                            <button
                                onClick={confirmDelete}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: '#fff', fontSize: '0.9rem', fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                {isFr ? 'Supprimer' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Cancel Agenda Session Confirmation Modal */}
            {showCancelAgendaConfirm && (
                <>
                    <div
                        onClick={() => setShowCancelAgendaConfirm(null)}
                        className="ftd-modal-overlay"
                        style={{ zIndex: 4000 }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        zIndex: 4001, width: 400,
                        background: '#1a1a24',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 24,
                        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(239,68,68,0.15)',
                        padding: '36px 32px 32px',
                        animation: 'ftd-slide-up 0.3s cubic-bezier(0.16,1,0.3,1)',
                        textAlign: 'center'
                    }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <XCircle size={28} color="#ef4444" style={{ filter: 'drop-shadow(0 2px 8px rgba(239,68,68,0.4))' }} />
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f4f4f5', marginBottom: 10, letterSpacing: '-0.02em', fontFamily: "var(--font-display), sans-serif" }}>
                            {isFr ? 'Annuler cet appel ?' : 'Cancel this call?'}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#a1a1aa', lineHeight: 1.6, marginBottom: 32 }}>
                            {isFr 
                                ? 'L\'appel sera retiré de l\'agenda et le candidat sera notifié de l\'annulation.' 
                                : 'The call will be removed from the agenda and the candidate will be notified.'}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowCancelAgendaConfirm(null)}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#a1a1aa', fontSize: '0.9rem', fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#a1a1aa'; }}
                            >
                                {isFr ? 'Retour' : 'Back'}
                            </button>
                            <button
                                onClick={confirmCancelAgendaSession}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none',
                                    color: '#fff', fontSize: '0.9rem', fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                {isFr ? 'Oui, Annuler' : 'Yes, Cancel'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Reschedule Session Modal */}
            {rescheduleSession && (
                <>
                    <div
                        onClick={() => { setRescheduleSession(null); setAgendaRescheduleDate(''); }}
                        className="ftd-modal-overlay"
                        style={{ zIndex: 4000 }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        zIndex: 4001, width: 440,
                        background: '#1a1a24',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 24,
                        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(200,169,96,0.15)',
                        padding: '36px 32px 32px',
                        animation: 'ftd-slide-up 0.3s cubic-bezier(0.16,1,0.3,1)',
                        textAlign: 'center'
                    }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(200,169,96,0.12)', border: '1px solid rgba(200,169,96,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Calendar size={28} color="#d4b872" style={{ filter: 'drop-shadow(0 2px 8px rgba(200,169,96,0.4))' }} />
                        </div>
                        <h2 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 800, color: '#f4f4f5', fontFamily: "var(--font-display), sans-serif" }}>
                            {isFr ? 'Reprogrammer l\'appel' : 'Reschedule call'}
                        </h2>
                        <div style={{ fontSize: '0.9rem', color: '#a1a1aa', lineHeight: 1.6, marginBottom: 24 }}>
                            {isFr 
                                ? 'Choisissez un nouvel horaire pour cet entretien. L\'ancienne session sera annulée.' 
                                : 'Choose a new time for this interview. The old session will be cancelled.'}
                        </div>
                        <div style={{ marginBottom: '32px', textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,.6)', marginBottom: '8px', paddingLeft: 4 }}>
                                {isFr ? 'Date et heure proposées' : 'Proposed Date and Time'}
                            </label>
                            <CalendarPicker 
                                value={agendaRescheduleDate} 
                                onChange={setAgendaRescheduleDate} 
                                placeholder={isFr ? 'Choisir date et heure...' : 'Pick date and time...'} 
                                compact 
                            />
                            
                            {/* Duration chips */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 16 }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', alignSelf: 'center', marginRight: 4 }}>
                                    {isFr ? 'Durée' : 'Duration'}
                                </span>
                                {[15, 30, 45, 60, 90].map(d => (
                                    <button 
                                        key={d} 
                                        className={`ftd-duration-chip ${rescheduleSession.callDuration === d ? 'ftd-dur-selected' : ''}`} 
                                        onClick={() => setRescheduleSession(prev => prev ? { ...prev, callDuration: d } : null)}
                                    >
                                        {d} min
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button 
                                onClick={() => { setRescheduleSession(null); setAgendaRescheduleDate(''); }} 
                                style={{ 
                                    flex: 1, padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', 
                                    color: '#a1a1aa', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' 
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#a1a1aa'; }}
                            >
                                {isFr ? 'Annuler' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirmAgendaReschedule}
                                disabled={!agendaRescheduleDate || sendingCall}
                                className="ftd-action-btn"
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12,
                                    background: agendaRescheduleDate ? 'linear-gradient(135deg, #d4b872, #8b5cf6)' : 'rgba(200,169,96,.2)',
                                    border: 'none', color: '#fff', fontSize: '0.9rem', fontWeight: 700,
                                    cursor: agendaRescheduleDate ? 'pointer' : 'not-allowed', opacity: sendingCall ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: agendaRescheduleDate ? '0 8px 20px rgba(200,169,96,0.3)' : 'none'
                                }}
                                onMouseEnter={e => { if (agendaRescheduleDate) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; } }}
                                onMouseLeave={e => { if (agendaRescheduleDate) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; } }}
                            >
                                {sendingCall ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                                {isFr ? 'Proposer l\'horaire' : 'Propose time'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    </div>

            {/* Custom Pre-Join Modal */}
            {showCustomPreJoin && (
                <div className="ftd-modal-overlay" style={{ zIndex: 999998 }}>
                    <div className="ftd-modal" style={{ padding: '0', maxWidth: 460, background: '#0b0b0d', overflow: 'hidden' }}>
                        
                        {/* Video Preview Area */}
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <video 
                                ref={preJoinVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: preJoinVideo ? 1 : 0 }} 
                            />
                            {!preJoinVideo && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(200,169,96,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CameraOff size={32} color="#c8a960" />
                                    </div>
                                </div>
                            )}

                            {/* Floating Controls */}
                            <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, right: 0, display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                                <button onClick={() => setPreJoinMic(m => !m)} style={{
                                    width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
                                    background: preJoinMic ? 'rgba(0,0,0,0.4)' : '#ef4444', 
                                    border: preJoinMic ? '1px solid rgba(255,255,255,0.2)' : 'none',
                                    color: 'white', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}>
                                    {preJoinMic ? <Mic size={22} /> : <MicOff size={22} />}
                                </button>
                                <button onClick={() => setPreJoinVideo(v => !v)} style={{
                                    width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
                                    background: preJoinVideo ? 'rgba(0,0,0,0.4)' : '#ef4444', 
                                    border: preJoinVideo ? '1px solid rgba(255,255,255,0.2)' : 'none',
                                    color: 'white', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}>
                                    {preJoinVideo ? <Camera size={22} /> : <CameraOff size={22} />}
                                </button>
                            </div>
                        </div>

                        {/* Text & Actions */}
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', color: '#fff', fontWeight: 800 }}>
                                {isFr ? 'Prêt à rejoindre l\'entretien ?' : 'Ready to join?'}
                            </h2>
                            <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                {isFr ? 'Vous rejoignez le salon de recrutement. Réglez votre caméra et votre micro avant d\'y entrer.' : 'You are joining the recruiting room. Adjust your camera and microphone before entering.'}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button onClick={() => setShowCustomPreJoin(null)} style={{ padding: '14px 24px', flex: 1, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {isFr ? 'Annuler' : 'Cancel'}
                                </button>
                                <button onClick={confirmJoinCall} style={{ padding: '14px 24px', flex: 1.5, borderRadius: 12, background: 'linear-gradient(135deg, #c8a960, #8b5cf6)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 4px 14px -4px rgba(200,169,96,0.5)' }}>
                                    {isFr ? 'Entrer dans le salon' : 'Join Room'}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Custom Leave Confirm Modal */}
            {leaveConfirmResolve && (
                <div className="ftd-modal-overlay" style={{ zIndex: 999999 }}>
                    <div className="ftd-modal" style={{ padding: '2rem', maxWidth: 400, background: '#111114', textAlign: 'center' }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                            <PhoneOff size={32} color="#f87171" style={{ filter: 'drop-shadow(0 2px 8px rgba(239, 68, 68, 0.4))' }} />
                        </div>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', color: '#fff', fontWeight: 800 }}>
                            {isFr ? 'Quitter l\'entretien ?' : 'Leave the interview?'}
                        </h2>
                        <p style={{ margin: '0 0 2rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {isFr ? 'Êtes-vous sûr de vouloir quitter ce salon vidéo ?' : 'Are you sure you want to leave this video room?'}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button onClick={() => { leaveConfirmResolve(false); setLeaveConfirmResolve(null); }} style={{ padding: '12px 24px', flex: 1, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                {isFr ? 'Annuler' : 'Cancel'}
                            </button>
                            <button onClick={() => { leaveConfirmResolve(true); setLeaveConfirmResolve(null); }} style={{ padding: '12px 24px', flex: 1, borderRadius: 12, background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 4px 14px -4px rgba(239, 68, 68, 0.5)' }}>
                                {isFr ? 'Quitter' : 'Leave'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
