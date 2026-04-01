'use client';

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Bell, X, ArrowRight, Calendar, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

const REMINDER_KEY = 'cal-reminders';

type ReminderEvent = {
    id: string;
    title: string;
    date: Date;
    sourceName: string;
    href: string;
    type: string;
};

type ActiveToast = {
    id: string;
    event: ReminderEvent;
    minutes: number;
    remainingMins: number;
    dismissed: boolean;
};

function fmtTime(d: Date) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

export default function GlobalReminders() {
    const { user } = useAuth();
    const router = useRouter();
    const [events, setEvents] = useState<ReminderEvent[]>([]);
    const [reminders, setReminders] = useState<Record<string, number>>({});
    const [activeToasts, setActiveToasts] = useState<ActiveToast[]>([]);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

    const triggeredRef = useRef<Set<string>>(new Set()); // track triggered so they don't loop

    // 1. Initial LocalStorage & Permission Check
    useEffect(() => {
        try {
            const stored = localStorage.getItem(REMINDER_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (!Array.isArray(parsed)) {
                    setReminders(parsed);
                }
            }
        } catch {}
        if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
        
        // Listen to localStorage storage event for cross-tab sync
        const handleStorage = (e: StorageEvent) => {
            if (e.key === REMINDER_KEY && e.newValue) {
                try {
                    setReminders(JSON.parse(e.newValue));
                } catch {}
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // 2. Fetch all upcoming events (refreshed every 10 min)
    useEffect(() => {
        if (!user) return;

        const loadEvents = async () => {
            try {
                const allEvents: ReminderEvent[] = [];
                const now = Date.now();
                const limit = now + 14 * 24 * 3600 * 1000; // only fetch up to 14 days ahead

                // Objectives
                const memQ = query(collection(db, 'memberships'), where('user_id', '==', user.uid));
                const memSnap = await getDocs(memQ);
                for (const d of memSnap.docs) {
                    const oid = d.data().objective_id;
                    const oSnap = await getDoc(doc(db, 'objectives', oid));
                    if (!oSnap.exists()) continue;
                    const oTitle = oSnap.data().title;

                    const sessSnap = await getDocs(collection(db, 'objectives', oid, 'sessions'));
                    sessSnap.docs.forEach(sd => {
                        const sData = sd.data();
                        const date = sData.scheduled_at?.toDate ? sData.scheduled_at.toDate() : new Date(sData.scheduled_at);
                        if (date.getTime() > now && date.getTime() < limit) {
                            allEvents.push({
                                id: `obj-sess-${sd.id}`, title: sData.title || 'Session',
                                date, sourceName: oTitle, href: `/objective/${oid}`, type: 'Objectif'
                            });
                        }
                    });
                }

                // Projects
                const projMemQ = query(collection(db, 'project_memberships'), where('user_id', '==', user.uid));
                const projMemSnap = await getDocs(projMemQ);
                for (const d of projMemSnap.docs) {
                    const pid = d.data().project_id;
                    const pSnap = await getDoc(doc(db, 'projects', pid));
                    if (!pSnap.exists()) continue;
                    const pTitle = pSnap.data().title;

                    const sessSnap = await getDocs(collection(db, 'projects', pid, 'sessions'));
                    sessSnap.docs.forEach(sd => {
                        const sData = sd.data();
                        const date = sData.scheduled_at?.toDate ? sData.scheduled_at.toDate() : new Date(sData.scheduled_at);
                        if (date.getTime() > now && date.getTime() < limit) {
                            allEvents.push({
                                id: `proj-sess-${sd.id}`, title: sData.title || 'Session',
                                date, sourceName: pTitle, href: `/project/${pid}`, type: 'Projet'
                            });
                        }
                    });
                }

                // Accountability
                const accQ1 = query(collection(db, 'accountability_pairs'), where('user1_id', '==', user.uid));
                const accQ2 = query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid));
                const accSnap = await Promise.all([getDocs(accQ1), getDocs(accQ2)]);
                for (const pSnap of [...accSnap[0].docs, ...accSnap[1].docs]) {
                    const pairData = pSnap.data();
                    const partnerUid = pairData.user1_id === user.uid ? pairData.user2_id : pairData.user1_id;
                    let partnerName = 'Partenaire';
                    try {
                        const uSnap = await getDoc(doc(db, 'users', partnerUid));
                        if (uSnap.exists()) partnerName = uSnap.data().full_name || 'Partenaire';
                    } catch {}

                    const sessSnap = await getDocs(collection(db, 'accountability_pairs', pSnap.id, 'sessions'));
                    sessSnap.docs.forEach(sd => {
                        const sData = sd.data();
                        const date = sData.scheduled_at?.toDate ? sData.scheduled_at.toDate() : new Date(sData.scheduled_at);
                        if (date.getTime() > now && date.getTime() < limit) {
                            allEvents.push({
                                id: `acc-sess-${sd.id}`, title: sData.title || 'Session',
                                date, sourceName: `Avec ${partnerName}`, href: `/accountability/${pSnap.id}`, type: 'Accountability'
                            });
                        }
                    });
                }

                // Recruiting
                const trCreatorQ = query(collection(db, 'teammate_requests'), where('creator_id', '==', user.uid));
                const trOpenQ = query(collection(db, 'teammate_requests'), where('status', '==', 'open'));
                const [trC, trO] = await Promise.all([getDocs(trCreatorQ), getDocs(trOpenQ)]);
                const trIds = new Set<string>();
                const trTitles: Record<string, string> = {};
                trC.docs.forEach(d => { trIds.add(d.id); trTitles[d.id] = d.data().target_title; });
                trO.docs.forEach(d => {
                    const data = d.data();
                    if ((data.applicants || []).some((a: any) => a.user_id === user.uid)) {
                        trIds.add(d.id); trTitles[d.id] = data.target_title;
                    }
                });

                for (const trId of Array.from(trIds)) {
                    const sessSnap = await getDocs(collection(db, 'teammate_requests', trId, 'sessions'));
                    sessSnap.docs.forEach(sd => {
                        const sData = sd.data();
                        const date = sData.scheduled_at?.toDate ? sData.scheduled_at.toDate() : new Date(sData.scheduled_at);
                        if (date.getTime() > now && date.getTime() < limit) {
                            allEvents.push({
                                id: `recruit-${sd.id}`, title: sData.title || 'Appel recrutement',
                                date, sourceName: trTitles[trId] || 'Recrutement', href: `/find-teammates/${trId}`, type: 'Recrutement'
                            });
                        }
                    });
                }

                setEvents(allEvents);
            } catch (err) {
                console.error('GlobalReminders load error', err);
            }
        };

        loadEvents();
        const intervalId = setInterval(loadEvents, 60 * 1000); // refresh every 1 minute
        return () => clearInterval(intervalId);
    }, [user]);

    // 3. Check for upcoming reminders every 10s
    useEffect(() => {
        const checkInterval = setInterval(() => {
            if (events.length === 0) return;
            const now = Date.now();

            let currentReminders: Record<string, number> = {};
            let currentTriggered: Record<string, number> = {};
            try {
                const storedRem = localStorage.getItem(REMINDER_KEY);
                if (storedRem) {
                    const parsed = JSON.parse(storedRem);
                    if (!Array.isArray(parsed)) currentReminders = parsed;
                }
                const storedTrig = localStorage.getItem('cal-triggered');
                if (storedTrig) {
                    currentTriggered = JSON.parse(storedTrig);
                }
            } catch {}

            let triggerUpdated = false;

            events.forEach(ev => {
                const mins = currentReminders[ev.id];
                if (mins === undefined) return;
                
                const diff = ev.date.getTime() - now;
                const targetMs = mins * 60 * 1000;
                
                const triggerKey = `${ev.id}-${mins}`;

                // Check if the event is approaching or within the reminder threshold, and hasn't started yet
                if (diff > 0 && diff <= targetMs) {
                    // Check if we already triggered this exact reminder persistently
                    if (currentTriggered[triggerKey]) return; 

                    // Mark as triggered persistently
                    currentTriggered[triggerKey] = now;
                    triggerUpdated = true;

                    const diffMins = Math.max(1, Math.round(diff / 60000));
                    const label = diffMins >= 60 
                        ? `${Math.floor(diffMins / 60)}h ${diffMins % 60 > 0 ? (diffMins % 60) + 'm' : ''}`.trim() 
                        : `${diffMins} min`;
                    
                    // Show Browser Notification
                    if (notifPermission === 'granted') {
                        new Notification(`⏰ ${ev.title}`, {
                            body: `Dans ${label} — ${ev.sourceName}`,
                            icon: '/favicon.ico',
                        });
                    }

                    // Show In-App Toast
                    setActiveToasts(prev => {
                        // avoid double adding the same toast in rapid succession
                        if (prev.some(t => t.id === triggerKey)) return prev;
                        return [...prev, {
                            id: triggerKey,
                            event: ev,
                            minutes: mins,
                            remainingMins: diffMins,
                            dismissed: false
                        }];
                    });
                }
            });

            if (triggerUpdated) {
                localStorage.setItem('cal-triggered', JSON.stringify(currentTriggered));
            }

        }, 10000); // check every 10 seconds for high responsiveness

        return () => clearInterval(checkInterval);
    }, [events, notifPermission]);


    // Auto-dismiss toasts after 30 seconds
    useEffect(() => {
        if (activeToasts.length === 0) return;
        const timeouts = activeToasts.map(toast => {
            if (toast.dismissed) return null;
            return setTimeout(() => {
                removeToast(toast.id);
            }, 30000);
        });
        return () => timeouts.forEach(t => t && clearTimeout(t));
    }, [activeToasts]);

    const removeToast = (id: string) => {
        setActiveToasts(prev => prev.filter(t => t.id !== id));
    };

    if (activeToasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 9999,
            pointerEvents: 'none'
        }}>
            <style>{`
                @keyframes slide-right-in {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .cal-toast {
                    width: 340px;
                    background: rgba(17, 17, 20, 0.95);
                    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 16px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05);
                    animation: slide-right-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    pointer-events: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    position: relative;
                    overflow: hidden;
                }
                .cal-toast::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; width: 4px; height: 100%;
                    background: linear-gradient(180deg, #c8a960, #5eead4);
                }
            `}</style>
            
            {activeToasts.map((toast) => {
                const isUrgent = toast.minutes <= 15;
                const rMins = toast.remainingMins;
                const label = rMins >= 60 
                    ? `${Math.floor(rMins / 60)}h ${rMins % 60 > 0 ? (rMins % 60) + 'm' : ''}`.trim() 
                    : `${rMins} min`;

                return (
                    <div key={toast.id} className="cal-toast">
                        <button 
                            onClick={() => removeToast(toast.id)}
                            style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                        >
                            <X size={16} />
                        </button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ 
                                width: 36, height: 36, borderRadius: '10px', 
                                background: isUrgent ? 'rgba(94,234,212,0.15)' : 'rgba(200,169,96,0.15)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isUrgent ? '#5eead4' : '#c8a960'
                            }}>
                                <Bell size={18} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f4f4f5' }}>Rappel : {toast.event.title}</h4>
                                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> Dans {label} ({fmtTime(toast.event.date)})
                                </p>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.3)', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                                    {toast.event.type}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ddd8d0' }}>
                                    {toast.event.sourceName}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => { removeToast(toast.id); router.push(toast.event.href); }}
                                style={{
                                    background: '#c8a960', color: '#fff', border: 'none', borderRadius: '8px',
                                    padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(200,169,96,0.3)'
                                }}
                            >
                                Rejoindre <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

