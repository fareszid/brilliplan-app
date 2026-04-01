'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfileView } from '@/app/user/[uid]/page';

export default function UsernameProfile() {
    const { username } = useParams<{ username: string }>();
    const router = useRouter();
    const [uid, setUid] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!username) return;
        getDoc(doc(db, 'username_index', username)).then(snap => {
            if (snap.exists()) {
                setUid(snap.data().uid);
            } else {
                setNotFound(true);
            }
        });
    }, [username]);

    if (notFound) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '3rem' }}>🔍</div>
                <h2 style={{ color: 'white', margin: 0 }}>Utilisateur introuvable</h2>
                <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => router.back()}>
                    ← Retour
                </button>
            </div>
        );
    }

    if (!uid) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(200,169,96,0.2)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return <UserProfileView uid={uid} />;
}
