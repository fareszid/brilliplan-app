'use client';

import { useLiveSession } from '@/context/LiveSessionContext';
import SessionRecap from '@/components/SessionRecap';
import { XP_REWARDS } from '@/context/GamificationContext';

export default function SessionRecapWrapper() {
    const { recapData, dismissRecap } = useLiveSession();

    if (!recapData) return null;

    // Calculate XP earned for display only (actual XP is awarded in endSession/toggle handlers)
    let xpEarned = XP_REWARDS.DAILY_CHECKIN;
    if (recapData.pomodoros > 0) xpEarned += recapData.pomodoros * XP_REWARDS.POMODORO_COMPLETE;

    return (
        <SessionRecap
            duration={recapData.duration}
            pomodoros={recapData.pomodoros}
            title={recapData.title}
            type={recapData.type}
            xpEarned={xpEarned}
            onClose={dismissRecap}
        />
    );
}
