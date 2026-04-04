'use client';

import { useAccCall } from '@/context/AccCallContext';
import { useUI } from '@/context/UIContext';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export const ACC_SIDEBAR_W = 272;

export default function AccCallOverlay() {
    const { callInfo, containerRef, callMinimized, isAccWorking } = useAccCall();
    const { setIsWorking } = useUI();
    const pathname = usePathname();

    // Keep global FOCUS indicator in sync with accountability session state
    useEffect(() => {
        setIsWorking(isAccWorking);
    }, [isAccWorking, setIsWorking]);

    // Full-screen only when on the pair page AND not minimized
    const isOnCallFull = !!callInfo && pathname?.startsWith(`/accountability/${callInfo.pairId}`) && !callMinimized;

    const containerStyle: React.CSSProperties = !callInfo
        ? { display: 'none' }
        : isOnCallFull
            ? {
                position: 'fixed', top: 0, left: 0,
                right: ACC_SIDEBAR_W, bottom: 0,
                zIndex: 2, background: '#0d0d10', overflow: 'hidden',
            }
            : {
                position: 'fixed', top: 0, left: '-200vw',
                width: `calc(100vw - ${ACC_SIDEBAR_W}px)`, height: '100vh',
                overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
            };

    return <div ref={containerRef} style={containerStyle} />;
}
