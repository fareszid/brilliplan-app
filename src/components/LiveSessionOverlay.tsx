'use client';

import { useLiveSession } from '@/context/LiveSessionContext';
import { useUI } from '@/context/UIContext';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const SIDEBAR_W = 272;

export default function LiveSessionOverlay() {
    const { sessionInfo, containerRef } = useLiveSession();
    const { setIsWorking } = useUI();
    const pathname = usePathname();

    // Keep global FOCUS indicator in sync with live session state
    useEffect(() => {
        if (sessionInfo) setIsWorking(true);
        else setIsWorking(false);
    }, [sessionInfo, setIsWorking]);

    const isOnSession = pathname?.startsWith('/session');

    // ── ZegoCloud container: full-screen on session page, off-screen (audio alive) elsewhere ──
    const containerStyle: React.CSSProperties = !sessionInfo
        ? { display: 'none' }
        : isOnSession
            ? {
                position: 'fixed', top: 0, left: 0,
                right: SIDEBAR_W, bottom: 0,
                zIndex: 2, background: '#0d0d10', overflow: 'hidden',
            }
            : {
                // Off-screen but same size — ZegoCloud stays alive, audio continues
                position: 'fixed', top: 0, left: '-200vw',
                width: `calc(100vw - ${SIDEBAR_W}px)`, height: '100vh',
                overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
            };

    return <div ref={containerRef} style={containerStyle} />;
}
