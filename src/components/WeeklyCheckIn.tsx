'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Check, X, MessageCircle, Target, ThumbsUp, AlertCircle } from 'lucide-react';
import { useGamification } from '@/context/GamificationContext';

interface CheckInData {
    goals_met: boolean;
    note: string;
    timestamp: string;
}

export default function WeeklyCheckIn() {
    const { user } = useAuth();
    const { addXP } = useGamification();
    const [show, setShow] = useState(false);
    const [goalsMet, setGoalsMet] = useState<boolean | null>(null);
    const [note, setNote] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [partnerName, setPartnerName] = useState<string | null>(null);

    const getWeekId = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil((((now.getTime() - firstDay.getTime()) / 86400000) + firstDay.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${week}`;
    };

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const weekId = getWeekId();
            const ref = doc(db, 'users', user.uid, 'checkins', weekId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setSubmitted(true);
                return;
            }

            // Check if user has accountability partner
            const q1 = query(collection(db, 'accountability_pairs'), where('user1_id', '==', user.uid), where('status', '==', 'accepted'));
            const q2 = query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid), where('status', '==', 'accepted'));
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const pairs = [...s1.docs, ...s2.docs];
            if (pairs.length > 0) {
                const pair = pairs[0].data();
                const partnerId = pair.user1_id === user.uid ? pair.user2_id : pair.user1_id;
                const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                if (partnerDoc.exists()) {
                    setPartnerName(partnerDoc.data().full_name || partnerDoc.data().username || 'ton partenaire');
                }
            }

            // Show on Sundays or if they haven't checked in by Wednesday
            const day = new Date().getDay();
            if (day === 0 || day >= 3) {
                setShow(true);
            }
        };
        load();
    }, [user]);

    const handleSubmit = useCallback(async () => {
        if (!user || goalsMet === null) return;
        const weekId = getWeekId();
        const data: CheckInData = {
            goals_met: goalsMet,
            note: note.trim(),
            timestamp: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', user.uid, 'checkins', weekId), data);
        addXP(15, 'Check-in hebdomadaire');

        // Notify partner
        if (partnerName) {
            const q1 = query(collection(db, 'accountability_pairs'), where('user1_id', '==', user.uid), where('status', '==', 'accepted'));
            const q2 = query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid), where('status', '==', 'accepted'));
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const pairs = [...s1.docs, ...s2.docs];
            if (pairs.length > 0) {
                const pair = pairs[0].data();
                const partnerId = pair.user1_id === user.uid ? pair.user2_id : pair.user1_id;
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userName = userDoc.exists() ? (userDoc.data().full_name || 'Quelqu\'un') : 'Quelqu\'un';
                await addDoc(collection(db, 'users', partnerId, 'notifications'), {
                    type: 'accountability_nudge',
                    message: `${userName} a complété son check-in ! ${goalsMet ? '✅' : '💪'}`,
                    read: false,
                    created_at: new Date(),
                });
            }
        }

        setSubmitted(true);
    }, [user, goalsMet, note, partnerName, addXP]);

    if (!show || submitted || !user) return null;

    return (
        <div style={{
            background: 'linear-gradient(145deg, rgba(244,114,182,0.06), rgba(244,114,182,0.02))',
            border: '1px solid rgba(244,114,182,0.12)',
            borderRadius: 18, padding: '1.25rem', overflow: 'hidden',
            position: 'relative',
        }}>
            <button
                onClick={() => setShow(false)}
                style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 22, height: 22, borderRadius: 6,
                    border: 'none', background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                <X size={10} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#f472b6' }} />
                <h3 style={{
                    fontSize: '0.78rem', fontWeight: 700,
                    color: 'rgba(237,233,227,0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                }}>
                    Check-in hebdo
                </h3>
            </div>

            <p style={{ color: 'rgba(237,233,227,0.6)', fontSize: '0.85rem', margin: '0 0 12px', lineHeight: 1.5 }}>
                As-tu atteint tes objectifs cette semaine ?
                {partnerName && (
                    <span style={{ color: '#f472b6', fontWeight: 600 }}> {partnerName} sera notifié</span>
                )}
            </p>

            {/* Yes/No buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: goalsMet !== null ? 10 : 0 }}>
                <button
                    onClick={() => setGoalsMet(true)}
                    style={{
                        flex: 1, padding: '10px', borderRadius: 12,
                        border: `2px solid ${goalsMet === true ? '#10b981' : 'rgba(255,255,255,0.06)'}`,
                        background: goalsMet === true ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                        color: goalsMet === true ? '#34d399' : 'rgba(255,255,255,0.4)',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.15s',
                    }}
                >
                    <ThumbsUp size={14} /> Oui !
                </button>
                <button
                    onClick={() => setGoalsMet(false)}
                    style={{
                        flex: 1, padding: '10px', borderRadius: 12,
                        border: `2px solid ${goalsMet === false ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                        background: goalsMet === false ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                        color: goalsMet === false ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.15s',
                    }}
                >
                    <AlertCircle size={14} /> Pas tout
                </button>
            </div>

            {/* Note + submit */}
            {goalsMet !== null && (
                <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <textarea
                        placeholder={goalsMet ? 'Qu\'est-ce qui a bien marché ?' : 'Quels obstacles as-tu rencontrés ?'}
                        value={note}
                        onChange={e => setNote(e.target.value.slice(0, 200))}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: '#ede9e3', fontSize: '0.82rem',
                            resize: 'none', height: 60,
                            outline: 'none', fontFamily: 'inherit',
                            marginBottom: 8,
                        }}
                    />
                    <button
                        onClick={handleSubmit}
                        style={{
                            width: '100%', padding: '10px', borderRadius: 12,
                            background: '#f472b6', border: 'none',
                            color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                            cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f9a8d4')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#f472b6')}
                    >
                        <Check size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                        Valider le check-in
                    </button>
                </div>
            )}

            <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>
        </div>
    );
}
