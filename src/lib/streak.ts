import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

/**
 * Record today's login and update the streak on the user doc.
 *
 * Logic:
 *  - If last_login_date === today → already counted, return current streak
 *  - If last_login_date === yesterday → streak continues, increment
 *  - Otherwise → streak resets to 1
 *
 * Writes `streak_days` and `last_login_date` to the user doc so
 * GamificationContext, Home, Profile, and Accountability all read the same value.
 *
 * @returns The updated streak in days
 */
export async function recordLoginAndUpdateStreak(uid: string): Promise<number> {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return 0;

    const data = snap.data();
    const todayKey = toDateKey(new Date());
    const lastLogin: string | undefined = data.last_login_date;
    const currentStreak: number = data.streak_days ?? 0;

    // Already recorded today — just return current streak
    if (lastLogin === todayKey) {
        return currentStreak;
    }

    // Check if last login was yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);

    let newStreak: number;
    if (lastLogin === yesterdayKey) {
        // Consecutive day — extend streak
        newStreak = currentStreak + 1;
    } else {
        // Gap in logins (or first ever login) — reset to 1
        newStreak = 1;
    }

    // Persist to Firestore
    try {
        await setDoc(userRef, {
            streak_days: newStreak,
            last_login_date: todayKey,
        }, { merge: true });
    } catch (err) {
        console.error('Failed to update streak:', err);
    }

    return newStreak;
}

/** Format a Date to YYYY-MM-DD in local time */
function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
