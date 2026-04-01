'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

interface BlockCtx {
    blockedIds: Set<string>;
    blockedByIds: Set<string>;
    isBlocked: (uid: string) => boolean;
    blockUser: (uid: string) => Promise<void>;
    unblockUser: (uid: string) => Promise<void>;
    reportUser: (uid: string, reason: string, details: string) => Promise<void>;
}

const Ctx = createContext<BlockCtx>({
    blockedIds: new Set(),
    blockedByIds: new Set(),
    isBlocked: () => false,
    blockUser: async () => {},
    unblockUser: async () => {},
    reportUser: async () => {},
});

export function BlockProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
    const [blockedByIds, setBlockedByIds] = useState<Set<string>>(new Set());

    // Load users I blocked
    useEffect(() => {
        if (!user) { setBlockedIds(new Set()); return; }
        const q = query(collection(db, 'blocks'), where('user_id', '==', user.uid));
        const unsub = onSnapshot(q, snap => {
            setBlockedIds(new Set(snap.docs.map(d => d.data().blocked_user_id)));
        });
        return () => unsub();
    }, [user]);

    // Load users who blocked me (so I can't see them either)
    useEffect(() => {
        if (!user) { setBlockedByIds(new Set()); return; }
        const q = query(collection(db, 'blocks'), where('blocked_user_id', '==', user.uid));
        const unsub = onSnapshot(q, snap => {
            setBlockedByIds(new Set(snap.docs.map(d => d.data().user_id)));
        });
        return () => unsub();
    }, [user]);

    // Check if a user is blocked (either direction)
    const isBlocked = useCallback((uid: string) => {
        return blockedIds.has(uid) || blockedByIds.has(uid);
    }, [blockedIds, blockedByIds]);

    // Block a user
    const blockUser = useCallback(async (uid: string) => {
        if (!user || uid === user.uid) return;
        // Check if already blocked
        if (blockedIds.has(uid)) return;
        await addDoc(collection(db, 'blocks'), {
            user_id: user.uid,
            blocked_user_id: uid,
            created_at: serverTimestamp(),
        });
    }, [user, blockedIds]);

    // Unblock a user
    const unblockUser = useCallback(async (uid: string) => {
        if (!user) return;
        const q = query(
            collection(db, 'blocks'),
            where('user_id', '==', user.uid),
            where('blocked_user_id', '==', uid)
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            await deleteDoc(doc(db, 'blocks', d.id));
        }
    }, [user]);

    // Report a user
    const reportUser = useCallback(async (uid: string, reason: string, details: string) => {
        if (!user || uid === user.uid) return;
        await addDoc(collection(db, 'reports'), {
            reporter_id: user.uid,
            reported_user_id: uid,
            reason,
            details: details.trim(),
            status: 'pending',
            created_at: serverTimestamp(),
        });
    }, [user]);

    return (
        <Ctx.Provider value={{ blockedIds, blockedByIds, isBlocked, blockUser, unblockUser, reportUser }}>
            {children}
        </Ctx.Provider>
    );
}

export const useBlock = () => useContext(Ctx);
