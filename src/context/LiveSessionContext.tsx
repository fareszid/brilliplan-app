'use client';

import { createContext, useContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, deleteDoc, setDoc, onSnapshot, serverTimestamp, increment, addDoc, collection, updateDoc } from 'firebase/firestore';

export interface SessionInfo {
    objectiveId: string;
    title: string;
    type?: 'project' | 'objective';
}

interface SharedTimerData {
    running: boolean;
    start_epoch: number;       // Unix seconds when timer was last started
    remaining_at_pause: number; // seconds remaining (set when paused or initialized)
    active_mode_idx: number;
    durations: number[];       // [focus, short break, long break] in minutes
    pom_count: number;
}

interface LiveSessionCtx {
    sessionInfo: SessionInfo | null;
    zpRef: React.MutableRefObject<any>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    activateSession: (info: SessionInfo) => void;
    endSession: () => void;

    // Timer state (synced via Firestore)
    modeIdx: number; setModeIdx: (i: number) => void;
    durations: number[]; setDurations: (d: number[]) => void;
    activeModeIdx: number; setActiveModeIdx: (i: number) => void;
    timeLeft: number; setTimeLeft: (t: number) => void;
    running: boolean; setRunning: (r: boolean | ((r: boolean) => boolean)) => void;
    pomCount: number; setPomCount: (c: number | ((c: number) => number)) => void;
    showAnim: boolean; setShowAnim: (s: boolean) => void;
    syncTimerToFirestore: (updates: Partial<SharedTimerData>) => void;
    recapData: RecapData | null;
    dismissRecap: () => void;
}

export interface RecapData {
    duration: number;
    pomodoros: number;
    title: string;
    type: 'objective' | 'project';
}

const Ctx = createContext<LiveSessionCtx>({} as LiveSessionCtx);

export function LiveSessionProvider({ children }: { children: ReactNode }) {
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
    const zpRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const joinedAtMsRef = useRef<number | null>(null);
    const [recapData, setRecapData] = useState<RecapData | null>(null);
    const dismissRecap = useCallback(() => setRecapData(null), []);

    // Timer State (local, kept in sync by Firestore listener)
    const [modeIdx, setModeIdx] = useState(0);
    const [durations, setDurations] = useState([25, 5, 15]);
    const [activeModeIdx, setActiveModeIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [running, setRunning] = useState(false);
    const [pomCount, setPomCount] = useState(0);
    const [showAnim, setShowAnim] = useState(false);

    // Ref to track if a remote snapshot update is being applied (to avoid echo writes)
    const isRemoteUpdate = useRef(false);
    // Ref to store start_epoch for computing elapsed time while running
    const startEpochRef = useRef(0);
    const remainingAtStartRef = useRef(25 * 60);

    // ─── Firestore timer doc path ────────────────────────────────────────────────
    const getTimerDocRef = useCallback(() => {
        if (!sessionInfo?.objectiveId) return null;
        const col = sessionInfo.type === 'project' ? 'projects' : 'objectives';
        return doc(db, col, sessionInfo.objectiveId, 'shared_timer', 'state');
    }, [sessionInfo?.objectiveId, sessionInfo?.type]);

    // ─── Write timer state to Firestore ──────────────────────────────────────────
    const syncTimerToFirestore = useCallback((updates: Partial<SharedTimerData>) => {
        const ref = getTimerDocRef();
        if (!ref) return;
        setDoc(ref, updates, { merge: true }).catch(() => { /* ignore */ });
    }, [getTimerDocRef]);

    // ─── Listen for shared timer changes from Firestore ──────────────────────────
    useEffect(() => {
        const ref = getTimerDocRef();
        if (!ref) return;

        const unsub = onSnapshot(ref, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as SharedTimerData;

            isRemoteUpdate.current = true;

            if (data.durations) setDurations(data.durations);
            setActiveModeIdx(data.active_mode_idx ?? 0);
            setPomCount(data.pom_count ?? 0);
            setRunning(data.running ?? false);

            if (data.running && data.start_epoch) {
                // Timer is running — compute timeLeft from elapsed
                startEpochRef.current = data.start_epoch;
                remainingAtStartRef.current = data.remaining_at_pause ?? 0;
                const elapsed = Math.floor(Date.now() / 1000) - data.start_epoch;
                const left = Math.max(0, (data.remaining_at_pause ?? 0) - elapsed);
                setTimeLeft(left);
            } else {
                // Timer is paused — use remaining directly
                startEpochRef.current = 0;
                remainingAtStartRef.current = data.remaining_at_pause ?? 0;
                setTimeLeft(data.remaining_at_pause ?? 0);
            }

            // Allow local writes again after a tick
            setTimeout(() => { isRemoteUpdate.current = false; }, 50);
        });

        return () => unsub();
    }, [getTimerDocRef]);

    // ─── Timer tick loop ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!running || timeLeft <= 0) {
            if (timeLeft === 0 && running) {
                setRunning(false);
                const newPom = activeModeIdx === 0;
                if (newPom) {
                    setPomCount(c => c + 1);
                    setShowAnim(true);
                    setTimeout(() => setShowAnim(false), 3000);
                }
                const resetTime = durations[activeModeIdx] * 60;
                setTimeLeft(resetTime);
                // Sync completed cycle to Firestore
                syncTimerToFirestore({
                    running: false,
                    remaining_at_pause: resetTime,
                    ...(newPom ? { pom_count: pomCount + 1 } : {}),
                });
            }
            return;
        }
        const t = setTimeout(() => {
            if (startEpochRef.current) {
                // Compute from epoch for accuracy (no drift)
                const elapsed = Math.floor(Date.now() / 1000) - startEpochRef.current;
                setTimeLeft(Math.max(0, remainingAtStartRef.current - elapsed));
            } else {
                setTimeLeft(v => v - 1);
            }
        }, 1000);
        return () => clearTimeout(t);
    }, [running, timeLeft, activeModeIdx, durations, pomCount, syncTimerToFirestore]);

    const activateSession = (info: SessionInfo) => {
        setSessionInfo(info);
        joinedAtMsRef.current = Date.now();
        try { localStorage.setItem('activeSession', JSON.stringify(info)); } catch { /* ignore */ }
    };

    const endSession = () => {
        const uid = auth.currentUser?.uid;
        const objId = sessionInfo?.objectiveId;

        if (uid && objId) {
            const collectionName = sessionInfo?.type === 'project' ? 'projects' : 'objectives';

            // Add elapsed coworking time to completed_hours (ignore very short sessions < 36s)
            if (joinedAtMsRef.current) {
                const elapsedHours = (Date.now() - joinedAtMsRef.current) / (1000 * 3600);
                if (elapsedHours > 0.01) {
                    try {
                        setDoc(doc(db, sessionInfo?.type === 'project' ? 'project_memberships' : 'memberships', `${uid}_${objId}`),
                            { completed_hours: increment(elapsedHours) }, { merge: true });
                    } catch { /* ignore */ }

                    // Log session for history/analytics
                    try {
                        addDoc(collection(db, 'session_logs'), {
                            user_id: uid,
                            objective_id: objId,
                            type: sessionInfo?.type || 'objective',
                            title: sessionInfo?.title || '',
                            started_at: new Date(joinedAtMsRef.current),
                            ended_at: new Date(),
                            duration_hours: parseFloat(elapsedHours.toFixed(4)),
                            pomodoros: pomCount,
                            created_at: serverTimestamp(),
                        });
                    } catch { /* ignore */ }

                    // Update gamification stats + XP on user doc
                    try {
                        let xpAmount = 15; // DAILY_CHECKIN
                        if (pomCount > 0) xpAmount += pomCount * 25; // POMODORO_COMPLETE
                        const statsUpdate: Record<string, any> = {
                            total_sessions: increment(1),
                            total_hours: increment(parseFloat(elapsedHours.toFixed(4))),
                            xp: increment(xpAmount),
                        };
                        if (pomCount > 0) statsUpdate.total_pomodoros = increment(pomCount);
                        statsUpdate.coworking_sessions = increment(1);
                        const startDate = new Date(joinedAtMsRef.current!);
                        const startHour = startDate.getHours();
                        const startDay = startDate.getDay();
                        if (startHour >= 0 && startHour < 5) statsUpdate.has_session_after_midnight = true;
                        if (startHour >= 4 && startHour < 7) statsUpdate.has_session_before_7am = true;
                        if (startDay === 6) statsUpdate.has_saturday_session = true;
                        if (startDay === 0) statsUpdate.has_sunday_session = true;
                        updateDoc(doc(db, 'users', uid), statsUpdate);
                    } catch { /* ignore */ }
                }
            }
            // Reset working state
            try {
                setDoc(doc(db, collectionName, objId, 'presence', uid),
                    { is_working: false, started_at: null, last_seen: serverTimestamp() }, { merge: true });
            } catch { /* ignore */ }
            // Remove from live_session
            try { deleteDoc(doc(db, collectionName, objId, 'live_session', uid)); } catch { /* ignore */ }
        }

        // Show session recap if meaningful session occurred (must check BEFORE nulling the ref)
        if (joinedAtMsRef.current) {
            const elapsed = (Date.now() - joinedAtMsRef.current) / (1000 * 3600);
            if (elapsed > 0.01) {
                setRecapData({
                    duration: parseFloat(elapsed.toFixed(4)),
                    pomodoros: pomCount,
                    title: sessionInfo?.title || '',
                    type: (sessionInfo?.type || 'objective') as 'objective' | 'project',
                });
            }
        }
        joinedAtMsRef.current = null;

        // Restore container to a valid DOM position before ZegoCloud unmounts.
        if (containerRef.current) {
            const el = containerRef.current;
            el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none;z-index:-1;';
        }
        try { zpRef.current?.destroy(); } catch { /* ignore */ }
        zpRef.current = null;
        setSessionInfo(null);
        try { localStorage.removeItem('activeSession'); } catch { /* ignore */ }
    };

    return (
        <Ctx.Provider value={{
            sessionInfo, zpRef, containerRef, activateSession, endSession,
            modeIdx, setModeIdx, durations, setDurations,
            activeModeIdx, setActiveModeIdx, timeLeft, setTimeLeft,
            running, setRunning, pomCount, setPomCount,
            showAnim, setShowAnim, syncTimerToFirestore,
            recapData, dismissRecap
        }}>
            {children}
        </Ctx.Provider>
    );
}

export const useLiveSession = () => useContext(Ctx);
