'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

type AuthContextType = {
    user: User | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            // Ensure the user's email is always stored in Firestore (makes them searchable by email)
            if (u?.email) {
                setDoc(doc(db, 'users', u.uid), { email: u.email.toLowerCase() }, { merge: true }).catch(() => {});
            }

            // ── Global presence heartbeat ──
            if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
            if (u) {
                const presRef = doc(db, 'presence_global', u.uid);
                const writePresence = () => setDoc(presRef, { uid: u.uid, last_seen: serverTimestamp(), online: true }, { merge: true }).catch(() => {});
                writePresence();
                heartbeatRef.current = setInterval(writePresence, 30_000);
                // Mark offline on tab close
                const onUnload = () => {
                    // navigator.sendBeacon can't write Firestore, so best-effort via fetch isn't reliable.
                    // The staleness check (2 min without heartbeat = offline) handles this.
                };
                window.addEventListener('beforeunload', onUnload);
                return () => window.removeEventListener('beforeunload', onUnload);
            }
        });

        return () => {
            unsubscribe();
            if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
