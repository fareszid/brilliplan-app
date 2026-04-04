'use client';

import { useLiveSession } from '@/context/LiveSessionContext';
import { useAccCall } from '@/context/AccCallContext';
import { useUI } from '@/context/UIContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { PhoneOff, Maximize2, Timer, Users, Zap, Square } from 'lucide-react';
import Avatar from '@/components/Avatar';

export default function ActiveSessionDock() {
    const { sessionInfo, endSession, timeLeft, running, activeModeIdx, durations } = useLiveSession();
    const { callInfo, endCall, isAccWorking, maximizeCall } = useAccCall();
    const { workInfo, stopWork } = useUI();
    const pathname = usePathname();
    const router = useRouter();

    const isOnSession = pathname?.startsWith('/session');
    const isOnAccCall = !!callInfo && pathname?.startsWith(`/accountability/${callInfo.pairId}`);
    const isOnAccPage = !!workInfo && workInfo.type === 'accountability' && pathname?.startsWith(`/accountability/${workInfo.id}`);
    const isOnObjPage = !!workInfo && workInfo.type === 'objective' && pathname?.startsWith(`/objective/${workInfo.id}`);
    const isOnProjPage = !!workInfo && workInfo.type === 'project' && pathname?.startsWith(`/project/${workInfo.id}`);

    const showLive = !!sessionInfo && !isOnSession;
    const showAcc = !!callInfo && !isOnAccCall;
    // Show solo work if: workInfo is set AND no sessionInfo covering same page AND not on that page already
    const showSoloWork = !!workInfo && !isOnObjPage && !isOnProjPage && !isOnAccPage
        && !(workInfo.type === 'accountability' && !!callInfo) // don't double-show if acc call is active
        && !(workInfo.type !== 'accountability' && !!sessionInfo); // don't double-show if coworking call is active

    const hasAny = showLive || showAcc || showSoloWork;

    // Live session member count
    const [memberCount, setMemberCount] = useState(0);
    useEffect(() => {
        if (!showLive || !sessionInfo?.objectiveId) { setMemberCount(0); return; }
        const unsub = onSnapshot(
            collection(db, sessionInfo.type === 'project' ? 'projects' : 'objectives', sessionInfo.objectiveId, 'live_session'),
            snap => setMemberCount(snap.size)
        );
        return () => unsub();
    }, [showLive, sessionInfo?.objectiveId, sessionInfo?.type]);

    // Acc call timer
    const accLiveDocRef = useRef<any>(null);
    useEffect(() => {
        if (!showAcc || !callInfo?.pairId) return;
        const liveRef = doc(db, 'accountability_pairs', callInfo.pairId, 'coworking', 'live');
        const unsub = onSnapshot(liveRef, snap => {
            accLiveDocRef.current = snap.exists() ? snap.data() : null;
        });
        return () => unsub();
    }, [showAcc, callInfo?.pairId]);

    const [, setAccTick] = useState(0);
    useEffect(() => {
        if (!showAcc) return;
        const interval = setInterval(() => setAccTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [showAcc]);

    const computeAccRemaining = () => {
        const d = accLiveDocRef.current;
        if (!d) return 0;
        const base = d.timer_base_seconds ?? 0;
        const duration = d.timer_duration ?? 25 * 60;
        if (!d.timer_running) return Math.max(0, duration - base);
        const startedAt = d.timer_started_at?.toDate?.() ?? new Date();
        const elapsed = base + (Date.now() - startedAt.getTime()) / 1000;
        return Math.max(0, duration - elapsed);
    };

    const accRemaining = computeAccRemaining();
    const accHasTimer = accLiveDocRef.current?.timer_running || accRemaining < (accLiveDocRef.current?.timer_duration ?? 25 * 60);

    // Live session timer
    const liveHasTimer = running || timeLeft < (durations?.[activeModeIdx] ?? 25) * 60;
    const liveMM = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const liveSS = Math.floor(timeLeft % 60).toString().padStart(2, '0');
    const accMM = Math.floor(accRemaining / 60).toString().padStart(2, '0');
    const accSS = Math.floor(accRemaining % 60).toString().padStart(2, '0');

    // Navigate to solo work page
    const handleSoloWorkClick = () => {
        if (!workInfo) return;
        if (workInfo.type === 'objective') router.push(`/objective/${workInfo.id}`);
        else if (workInfo.type === 'project') router.push(`/project/${workInfo.id}`);
        else if (workInfo.type === 'accountability') router.push(`/accountability/${workInfo.id}`);
    };

    if (!hasAny) return null;

    return (
        <>
            <style>{`
                @keyframes dock-slide-up {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.96); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1); }
                }
                @keyframes dock-pulse-live {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,.45); }
                    50%      { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
                }
                @keyframes dock-pulse-call {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45); }
                    50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
                }
                @keyframes dock-pulse-solo {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(200,169,96,.45); }
                    50%      { box-shadow: 0 0 0 5px rgba(200,169,96,0); }
                }
                @keyframes dock-dot-blink {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: .35; }
                }
                .dock-card {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9990;
                    animation: dock-slide-up .35s cubic-bezier(.16,1,.3,1) both;
                    font-family: var(--font-body), Figtree, system-ui, sans-serif;
                }
                .dock-inner {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    background: rgba(14,14,18,.92);
                    backdrop-filter: blur(28px);
                    -webkit-backdrop-filter: blur(28px);
                    border: 1px solid rgba(237,233,227,.07);
                    border-radius: 18px;
                    box-shadow: 0 24px 64px rgba(0,0,0,.75), 0 1px 0 rgba(237,233,227,.06) inset;
                    overflow: hidden;
                    position: relative;
                }
                .dock-inner::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent 0%, rgba(237,233,227,.12) 30%, rgba(237,233,227,.18) 50%, rgba(237,233,227,.12) 70%, transparent 100%);
                }
                .dock-segment {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    cursor: pointer;
                    transition: background .18s;
                    position: relative;
                    min-width: 0;
                }
                .dock-segment:hover { background: rgba(237,233,227,.04); }
                .dock-divider {
                    width: 1px;
                    height: 32px;
                    background: rgba(237,233,227,.07);
                    flex-shrink: 0;
                }
                .dock-action {
                    width: 30px;
                    height: 30px;
                    border-radius: 9px;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: all .15s;
                }
                .dock-timer {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 7px;
                    flex-shrink: 0;
                    font-variant-numeric: tabular-nums;
                    font-size: .68rem;
                    font-weight: 700;
                    letter-spacing: .02em;
                }
                .dock-live-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .dock-label-type {
                    font-size: .56rem;
                    font-weight: 800;
                    letter-spacing: .1em;
                    text-transform: uppercase;
                }
                .dock-label-title {
                    font-size: .78rem;
                    font-weight: 600;
                    color: #ede9e3;
                    max-width: 160px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            `}</style>

            <div className="dock-card">
                <div className="dock-inner">

                    {/* ── SOLO WORK SEGMENT ── */}
                    {showSoloWork && workInfo && (
                        <>
                            <div className="dock-segment" onClick={handleSoloWorkClick}>
                                <span
                                    className="dock-live-dot"
                                    style={{
                                        background: '#c8a960',
                                        animation: 'dock-dot-blink 2s ease-in-out infinite, dock-pulse-solo 2s ease-in-out infinite',
                                    }}
                                />
                                <div style={{ minWidth: 0 }}>
                                    <div className="dock-label-type" style={{ color: '#c8a960', marginBottom: 2 }}>
                                        {workInfo.type === 'accountability' ? 'Accountability' : workInfo.type === 'project' ? 'Projet' : 'Objectif'}
                                    </div>
                                    <div className="dock-label-title">{workInfo.title || 'Session focus'}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, background: 'rgba(200,169,96,.08)', border: '1px solid rgba(200,169,96,.2)', flexShrink: 0 }}>
                                    <Zap size={9} color="#c8a960" />
                                    <span style={{ fontSize: '.6rem', color: '#c8a960', fontWeight: 700 }}>Focus</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 10 }}>
                                <button
                                    className="dock-action"
                                    title="Retourner"
                                    onClick={handleSoloWorkClick}
                                    style={{ background: 'rgba(200,169,96,.09)', color: '#c8a960' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,96,.22)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200,169,96,.09)')}
                                >
                                    <Maximize2 size={12} />
                                </button>
                                <button
                                    className="dock-action"
                                    title="Arrêter la session"
                                    onClick={e => { e.stopPropagation(); stopWork(); }}
                                    style={{ background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.25)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
                                >
                                    <Square size={11} strokeWidth={0} style={{ fill: '#fca5a5' }} />
                                </button>
                            </div>
                            {(showLive || showAcc) && <div className="dock-divider" />}
                        </>
                    )}

                    {/* ── LIVE SESSION SEGMENT ── */}
                    {showLive && (
                        <>
                            <div
                                className="dock-segment"
                                onClick={() => router.push(`/session?id=${sessionInfo!.objectiveId}`)}
                            >
                                <span
                                    className="dock-live-dot"
                                    style={{
                                        background: '#4ade80',
                                        animation: 'dock-dot-blink 1.8s ease-in-out infinite, dock-pulse-live 1.8s ease-in-out infinite',
                                    }}
                                />
                                <div style={{ minWidth: 0 }}>
                                    <div className="dock-label-type" style={{ color: '#4ade80', marginBottom: 2 }}>Coworking</div>
                                    <div className="dock-label-title">{sessionInfo!.title || 'Session focus'}</div>
                                </div>
                                {memberCount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.18)', flexShrink: 0 }}>
                                        <Users size={9} color="#4ade80" />
                                        <span style={{ fontSize: '.6rem', color: '#4ade80', fontWeight: 700 }}>{memberCount}</span>
                                    </div>
                                )}
                                {liveHasTimer && (
                                    <div className="dock-timer" style={{ background: 'rgba(200,169,96,.1)', border: '1px solid rgba(200,169,96,.22)', color: '#c8a960' }}>
                                        <Timer size={9} />
                                        {liveMM}:{liveSS}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 10 }}>
                                <button
                                    className="dock-action"
                                    title="Retourner à la salle"
                                    onClick={() => router.push(`/session?id=${sessionInfo!.objectiveId}`)}
                                    style={{ background: 'rgba(74,222,128,.09)', color: '#4ade80' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,222,128,.2)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,222,128,.09)')}
                                >
                                    <Maximize2 size={12} />
                                </button>
                                <button
                                    className="dock-action"
                                    title="Quitter la session"
                                    onClick={e => { e.stopPropagation(); endSession(); }}
                                    style={{ background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.25)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
                                >
                                    <Square size={11} strokeWidth={0} style={{ fill: '#fca5a5' }} />
                                </button>
                            </div>
                            {showAcc && <div className="dock-divider" />}
                        </>
                    )}

                    {/* ── ACCOUNTABILITY CALL SEGMENT ── */}
                    {showAcc && (
                        <>
                            <div
                                className="dock-segment"
                                onClick={() => { maximizeCall(); router.push(`/accountability/${callInfo!.pairId}`); }}
                            >
                                <span
                                    className="dock-live-dot"
                                    style={{
                                        background: '#ef4444',
                                        animation: 'dock-dot-blink 1.4s ease-in-out infinite, dock-pulse-call 1.4s ease-in-out infinite',
                                    }}
                                />
                                <div style={{ borderRadius: '50%', border: '1.5px solid rgba(16,185,129,.3)', overflow: 'hidden', width: 26, height: 26, flexShrink: 0 }}>
                                    <Avatar uid={callInfo!.partnerId} avatarUrl={callInfo!.partnerAvatarUrl ?? undefined} avatarStyle={callInfo!.partnerAvatarStyle} size={26} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div className="dock-label-type" style={{ color: '#10b981', marginBottom: 2 }}>Accountability</div>
                                    <div className="dock-label-title">{callInfo!.partnerName}</div>
                                </div>
                                {accHasTimer && (
                                    <div className="dock-timer" style={{ background: 'rgba(200,169,96,.1)', border: '1px solid rgba(200,169,96,.22)', color: '#c8a960' }}>
                                        <Timer size={9} />
                                        {accMM}:{accSS}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 10 }}>
                                <button
                                    className="dock-action"
                                    title="Retourner à l'appel"
                                    onClick={() => { maximizeCall(); router.push(`/accountability/${callInfo!.pairId}`); }}
                                    style={{ background: 'rgba(16,185,129,.09)', color: '#10b981' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,.22)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,.09)')}
                                >
                                    <Maximize2 size={12} />
                                </button>
                                <button
                                    className="dock-action"
                                    title="Raccrocher"
                                    onClick={e => { e.stopPropagation(); endCall(); }}
                                    style={{ background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.25)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
                                >
                                    <PhoneOff size={12} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
