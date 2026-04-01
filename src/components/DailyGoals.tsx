'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, X, Sparkles, Target } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useGamification } from '@/context/GamificationContext';

interface DailyGoal {
    id: string;
    text: string;
    done: boolean;
}

export default function DailyGoals() {
    const { user } = useAuth();
    const { addXP } = useGamification();
    const [goals, setGoals] = useState<DailyGoal[]>([]);
    const [newGoal, setNewGoal] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const todayKey = new Date().toISOString().slice(0, 10);

    // Load goals
    useEffect(() => {
        if (!user) return;
        const loadGoals = async () => {
            const ref = doc(db, 'users', user.uid, 'daily_goals', todayKey);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setGoals(snap.data().goals || []);
            }
            setLoaded(true);
        };
        loadGoals();
    }, [user, todayKey]);

    // Save goals
    const saveGoals = useCallback(async (updated: DailyGoal[]) => {
        if (!user) return;
        setGoals(updated);
        await setDoc(doc(db, 'users', user.uid, 'daily_goals', todayKey), { goals: updated });
    }, [user, todayKey]);

    const addGoal = () => {
        if (!newGoal.trim() || goals.length >= 3) return;
        const updated = [...goals, { id: Date.now().toString(), text: newGoal.trim(), done: false }];
        saveGoals(updated);
        setNewGoal('');
        setShowAdd(false);
    };

    const toggleGoal = (id: string) => {
        const updated = goals.map(g => {
            if (g.id === id) {
                const nowDone = !g.done;
                if (nowDone) addXP(15, 'Objectif quotidien atteint');
                return { ...g, done: nowDone };
            }
            return g;
        });
        saveGoals(updated);
    };

    const removeGoal = (id: string) => {
        saveGoals(goals.filter(g => g.id !== id));
    };

    const completedCount = goals.filter(g => g.done).length;
    const allDone = goals.length > 0 && completedCount === goals.length;

    if (!loaded) return null;

    return (
        <div style={{
            background: allDone
                ? 'linear-gradient(145deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))'
                : 'rgba(19,19,22,0.6)',
            border: `1px solid ${allDone ? 'rgba(16,185,129,0.18)' : 'rgba(237,233,227,0.06)'}`,
            borderRadius: '18px', padding: '1.5rem',
            transition: 'all 0.3s ease',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: goals.length > 0 ? '1rem' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: 3, height: 14, borderRadius: 2,
                        background: allDone ? '#10b981' : '#f59e0b',
                    }} />
                    <h2 style={{
                        fontSize: '0.82rem', fontWeight: 700,
                        color: 'rgba(237,233,227,0.4)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                    }}>
                        Objectifs du jour
                    </h2>
                    {goals.length > 0 && (
                        <span style={{
                            fontSize: '0.62rem', fontWeight: 700,
                            padding: '2px 7px', borderRadius: 6,
                            background: allDone ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.1)',
                            color: allDone ? '#34d399' : '#fbbf24',
                            border: `1px solid ${allDone ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.2)'}`,
                        }}>
                            {completedCount}/{goals.length}
                        </span>
                    )}
                </div>
                {goals.length < 3 && (
                    <button
                        onClick={() => setShowAdd(true)}
                        style={{
                            width: 24, height: 24, borderRadius: 7,
                            border: '1px solid rgba(245,158,11,0.2)',
                            background: 'rgba(245,158,11,0.06)',
                            color: '#fbbf24', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                    >
                        <Plus size={12} />
                    </button>
                )}
            </div>

            {/* Goals list */}
            {goals.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {goals.map(g => (
                        <div key={g.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 10,
                            background: g.done ? 'rgba(16,185,129,0.06)' : 'rgba(237,233,227,0.02)',
                            border: `1px solid ${g.done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)'}`,
                            transition: 'all 0.2s',
                        }}>
                            <button
                                onClick={() => toggleGoal(g.id)}
                                style={{
                                    width: 20, height: 20, borderRadius: 6,
                                    border: `2px solid ${g.done ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
                                    background: g.done ? '#10b981' : 'transparent',
                                    color: '#fff', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, transition: 'all 0.15s',
                                }}
                            >
                                {g.done && <Check size={12} strokeWidth={3} />}
                            </button>
                            <span style={{
                                flex: 1, fontSize: '0.82rem', fontWeight: 500,
                                color: g.done ? 'rgba(237,233,227,0.3)' : 'rgba(237,233,227,0.7)',
                                textDecoration: g.done ? 'line-through' : 'none',
                                transition: 'all 0.2s',
                            }}>
                                {g.text}
                            </span>
                            <button
                                onClick={() => removeGoal(g.id)}
                                style={{
                                    width: 18, height: 18, borderRadius: 5,
                                    border: 'none', background: 'transparent',
                                    color: 'rgba(255,255,255,0.12)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, transition: 'color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(248,113,113,0.6)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.12)')}
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {goals.length === 0 && !showAdd && (
                <div style={{
                    textAlign: 'center', padding: '1rem 0 0.5rem',
                }}>
                    <Target size={22} style={{ color: 'rgba(237,233,227,0.08)', marginBottom: 8 }} />
                    <p style={{ color: 'rgba(237,233,227,0.2)', fontSize: '0.78rem', margin: '0 0 0.75rem' }}>
                        Définis tes priorités pour aujourd&apos;hui
                    </p>
                    <button
                        onClick={() => setShowAdd(true)}
                        style={{
                            padding: '7px 16px', borderRadius: 10,
                            background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.18)',
                            color: '#fbbf24', fontSize: '0.78rem', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        <Plus size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
                        Ajouter un objectif
                    </button>
                </div>
            )}

            {/* Add form */}
            {showAdd && (
                <div style={{
                    marginTop: goals.length > 0 ? 8 : 0,
                    display: 'flex', gap: 6, alignItems: 'center',
                }}>
                    <input
                        type="text"
                        placeholder="Ex: Finir le chapitre 5..."
                        value={newGoal}
                        onChange={e => setNewGoal(e.target.value.slice(0, 80))}
                        onKeyDown={e => { if (e.key === 'Enter') addGoal(); if (e.key === 'Escape') setShowAdd(false); }}
                        autoFocus
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(245,158,11,0.2)',
                            color: '#ede9e3', fontSize: '0.82rem',
                            outline: 'none', fontFamily: 'inherit',
                        }}
                    />
                    <button
                        onClick={addGoal}
                        disabled={!newGoal.trim()}
                        style={{
                            width: 30, height: 30, borderRadius: 8,
                            border: 'none', cursor: newGoal.trim() ? 'pointer' : 'not-allowed',
                            background: newGoal.trim() ? '#f59e0b' : 'rgba(255,255,255,0.04)',
                            color: newGoal.trim() ? '#0b0b0d' : 'rgba(255,255,255,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.15s',
                        }}
                    >
                        <Check size={14} strokeWidth={3} />
                    </button>
                </div>
            )}

            {/* All done celebration */}
            {allDone && (
                <div style={{
                    marginTop: 10, textAlign: 'center',
                    padding: '8px', borderRadius: 10,
                    background: 'rgba(16,185,129,0.06)',
                }}>
                    <Sparkles size={14} style={{ color: '#34d399', marginRight: 6, verticalAlign: -2 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
                        Tous les objectifs atteints ! 🎉
                    </span>
                </div>
            )}
        </div>
    );
}
