'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, getDoc, doc,
    orderBy, limit as fbLimit, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { recordLoginAndUpdateStreak } from '@/lib/streak';
import {
    Target, Users, ArrowRight, Brain,
    Clock, BarChart2, Calendar, Code2, Music,
    Dumbbell, BookMarked, Briefcase, PenTool, FlaskConical,
    Palette, ChevronRight, Play, Plus, Flame,
    Sparkles, CheckCircle, MessageSquare,
    UserPlus, Timer,
} from 'lucide-react';
import { ConceptAIcon } from '@/components/BrilliPlanLogo';
import Avatar from '@/components/Avatar';
import DailyGoals from '@/components/DailyGoals';
import WeeklyReport from '@/components/WeeklyReport';
import WeeklyCheckIn from '@/components/WeeklyCheckIn';
import SessionTemplates from '@/components/SessionTemplates';
import SmartSuggestions from '@/components/SmartSuggestions';

/* ═══════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════ */

function useVisible(threshold = 0.12) {
    const ref = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } },
            { threshold },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, on };
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const FEATURES = [
    { title: 'Sessions Pomodoro', desc: 'Travaillez en live avec un timer partagé, des pauses synchronisées et un suivi automatique.', Icon: Timer, color: '#c8a960' },
    { title: 'Coach IA', desc: 'Un assistant propulsé par Gemini analyse vos habitudes et optimise votre planning.', Icon: Brain, color: '#5eead4' },
    { title: 'Projets Kanban', desc: 'Tableau de bord collaboratif avec sprints, assignation de rôles et vélocité.', Icon: BarChart2, color: '#10b981' },
    { title: 'Accountability', desc: 'Formez un pacte avec un partenaire — check-ins réguliers, engagements mutuels.', Icon: Users, color: '#f59e0b' },
    { title: 'Roadmap IA', desc: 'L\'IA génère vos jalons, découpe vos objectifs et planifie chaque semaine.', Icon: Sparkles, color: '#8b5cf6' },
    { title: 'Calendrier Intelligent', desc: 'Agenda auto-généré qui respecte vos pics de productivité et vos contraintes.', Icon: Calendar, color: '#3b82f6' },
];

const CATEGORIES = [
    { name: 'Code & Dev', Icon: Code2, color: '#c8a960' },
    { name: 'Design', Icon: Palette, color: '#5eead4' },
    { name: 'Musique', Icon: Music, color: '#10b981' },
    { name: 'Fitness', Icon: Dumbbell, color: '#ef4444' },
    { name: 'Lecture', Icon: BookMarked, color: '#f59e0b' },
    { name: 'Business', Icon: Briefcase, color: '#8b5cf6' },
    { name: 'Écriture', Icon: PenTool, color: '#f97316' },
    { name: 'Science', Icon: FlaskConical, color: '#3b82f6' },
];

const STEPS = [
    { n: '01', title: 'Définis ton objectif', desc: 'Choisis ta cible, fixe tes heures, laisse l\'IA construire ta roadmap personnalisée.', color: '#c8a960' },
    { n: '02', title: 'Trouve ton équipe', desc: 'Invite des partenaires, rejoins un salon collectif, ou avance en solo avec le coach IA.', color: '#5eead4' },
    { n: '03', title: 'Travaille en live', desc: 'Lance tes sessions Pomodoro, log tes heures, et regarde ta progression décoller.', color: '#10b981' },
];

const fmtH = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Home() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(200,169,96,0.2)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    return user ? <AuthenticatedHome uid={user.uid} displayName={user.displayName} email={user.email} /> : <LandingPage />;
}

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE (LOGGED OUT)
   ═══════════════════════════════════════════════════════════ */

function LandingPage() {
    const [onlineCount, setOnlineCount] = useState(0);
    const { ref: featRef, on: featOn } = useVisible();
    const { ref: stepsRef, on: stepsOn } = useVisible();

    // Real-time online users count from presence_global
    useEffect(() => {
        const twoMinAgo = Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 1000));
        const q = query(collection(db, 'presence_global'), where('online', '==', true), where('last_seen', '>', twoMinAgo));
        const unsub = onSnapshot(q, snap => setOnlineCount(snap.size));
        return unsub;
    }, []);

    // Pomodoro ring demo
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => (t + 1) % 1500), 60);
        return () => clearInterval(id);
    }, []);
    const pct = tick / 1500;
    const R = 54, circ = 2 * Math.PI * R, offset = circ * (1 - pct);
    const mins = Math.floor((1500 - tick) / 60);
    const secs = (1500 - tick) % 60;

    return (
        <div style={{ overflowX: 'hidden', color: '#ede9e3', position: 'relative', marginTop: '-56px' }}>

            {/* ── Ambient orbs ── */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <div style={{
                    position: 'absolute', top: '-8%', left: '50%', transform: 'translateX(-50%)',
                    width: '1000px', height: '600px',
                    background: 'radial-gradient(ellipse, rgba(200,169,96,0.06) 0%, transparent 65%)',
                }} />
                <div style={{
                    position: 'absolute', top: '20%', right: '-15%',
                    width: '500px', height: '500px',
                    background: 'radial-gradient(circle, rgba(94,234,212,0.03) 0%, transparent 60%)',
                }} />
                <div style={{
                    position: 'absolute', bottom: '10%', left: '-10%',
                    width: '400px', height: '400px',
                    background: 'radial-gradient(circle, rgba(200,169,96,0.025) 0%, transparent 60%)',
                }} />
            </div>

            {/* ════════════════════════════════════════
                HERO
            ════════════════════════════════════════ */}
            <section style={{
                minHeight: '100vh', maxWidth: '1280px', margin: '0 auto',
                padding: '0 2.5rem', paddingTop: '80px',
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                alignItems: 'center', gap: '3rem',
                position: 'relative', zIndex: 1,
            }}>
                {/* Left — Copy */}
                <div>
                    {/* Live badge */}
                    {onlineCount > 0 && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '5px 14px 5px 10px',
                            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
                            borderRadius: '100px', fontSize: '0.78rem', fontWeight: 600,
                            color: '#34d399', marginBottom: '2rem',
                            animation: 'fadeSlideIn 0.6s ease-out both',
                        }}>
                            <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', animation: 'pulse-dot 1.5s infinite' }} />
                            {onlineCount} {onlineCount === 1 ? 'personne en ligne' : 'personnes en ligne'}
                        </div>
                    )}

                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(2.6rem, 4.2vw, 4.5rem)',
                        fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.045em',
                        marginBottom: '1.5rem',
                        animation: 'fadeSlideIn 0.7s ease-out 0.1s both',
                    }}>
                        Chaque heure{' '}
                        <span style={{
                            background: 'linear-gradient(125deg, #c8a960 0%, #5eead4 60%, #d4b872 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>
                            compte.
                        </span>
                        <br />
                        <span style={{ color: 'rgba(237,233,227,0.85)' }}>Prouve-le.</span>
                    </h1>

                    <p style={{
                        fontSize: '1.12rem', lineHeight: 1.7, color: 'rgba(237,233,227,0.4)',
                        maxWidth: '460px', marginBottom: '2.25rem',
                        animation: 'fadeSlideIn 0.7s ease-out 0.2s both',
                    }}>
                        La plateforme d'accountability qui transforme tes ambitions en résultats
                        — partenaires, IA coach, coworking live et suivi en temps réel.
                    </p>

                    <div style={{
                        display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
                        animation: 'fadeSlideIn 0.7s ease-out 0.3s both',
                    }}>
                        <Link href="/register" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '10px',
                            background: '#c8a960', color: '#0b0b0d',
                            padding: '14px 28px', borderRadius: '14px',
                            fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none',
                            boxShadow: '0 8px 32px rgba(200,169,96,0.3), 0 0 0 1px rgba(200,169,96,0.5) inset',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}>
                            Commencer gratuitement <ArrowRight size={17} />
                        </Link>
                        <Link href="/explore" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '10px',
                            background: 'rgba(237,233,227,0.04)', border: '1px solid rgba(237,233,227,0.1)',
                            color: '#9a958e', padding: '14px 24px', borderRadius: '14px',
                            fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none',
                            transition: 'background 0.2s, border-color 0.2s',
                        }}>
                            Explorer
                        </Link>
                    </div>
                </div>

                {/* Right — Interactive dashboard preview */}
                <div style={{
                    position: 'relative',
                    animation: 'fadeSlideIn 0.9s ease-out 0.3s both',
                }}>
                    {/* Floating AI chip */}
                    <div style={{
                        position: 'absolute', top: '-14px', right: '16px', zIndex: 10,
                        background: 'rgba(200,169,96,0.08)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(200,169,96,0.2)', borderRadius: '14px',
                        padding: '9px 13px', display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        animation: 'float 4s ease-in-out infinite',
                    }}>
                        <Brain size={14} style={{ color: '#d4b872' }} />
                        <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ede9e3' }}>Coach IA</div>
                            <div style={{ fontSize: '0.58rem', color: 'rgba(237,233,227,0.4)' }}>Analyse en cours…</div>
                        </div>
                    </div>

                    {/* Main card */}
                    <div style={{
                        background: 'rgba(19,19,22,0.9)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                        border: '1px solid rgba(237,233,227,0.07)', borderRadius: '24px',
                        padding: '1.75rem',
                        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(237,233,227,0.03) inset',
                    }}>
                        {/* Objective header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(200,169,96,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Code2 size={18} style={{ color: '#c8a960' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Maîtriser React</div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(237,233,227,0.35)' }}>Code · Semaine 8 / 12</div>
                            </div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(16,185,129,0.08)', color: '#34d399', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.2)' }}>En cours</div>
                        </div>

                        {/* Timer + week bars */}
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
                                <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(237,233,227,0.04)" strokeWidth="8" />
                                    <circle cx="55" cy="55" r={R} fill="none"
                                        stroke="url(#hero-grad)" strokeWidth="8" strokeLinecap="round"
                                        strokeDasharray={circ} strokeDashoffset={offset}
                                        style={{ transition: 'stroke-dashoffset 0.06s linear' }}
                                    />
                                    <defs>
                                        <linearGradient id="hero-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#c8a960" />
                                            <stop offset="100%" stopColor="#5eead4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', fontFamily: 'var(--font-display)' }}>
                                        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                                    </div>
                                    <div style={{ fontSize: '0.55rem', color: 'rgba(237,233,227,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3, fontWeight: 700 }}>Focus</div>
                                </div>
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(237,233,227,0.25)', marginBottom: 8 }}>Cette semaine</div>
                                {[['Lun', 82, '#c8a960'], ['Mar', 58, '#c8a960'], ['Mer', 100, '#5eead4'], ['Jeu', 44, '#c8a960'], ['Ven', 71, '#c8a960']].map(([l, v, c]) => (
                                    <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: '0.58rem', color: 'rgba(237,233,227,0.25)', width: 22, fontWeight: 600 }}>{l}</span>
                                        <div style={{ flex: 1, height: 4, borderRadius: 3, background: 'rgba(237,233,227,0.04)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${v}%`, background: c as string, borderRadius: 3 }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Live members */}
                        <div style={{ background: 'rgba(237,233,227,0.025)', borderRadius: '11px', padding: '0.65rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ display: 'flex' }}>
                                {['#c8a960', '#5eead4', '#10b981'].map((c, i) => (
                                    <div key={i} style={{
                                        width: 24, height: 24, borderRadius: '50%', background: c,
                                        border: '2px solid #131316', marginLeft: i > 0 ? -6 : 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.55rem', fontWeight: 900, color: '#fff',
                                    }}>
                                        {['M', 'L', 'T'][i]}
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(237,233,227,0.45)', flex: 1 }}>
                                <span style={{ color: '#34d399', fontWeight: 700 }}>3 membres</span> actifs
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: '#34d399', fontWeight: 700 }}>
                                <span style={{ width: 5, height: 5, background: '#10b981', borderRadius: '50%', animation: 'pulse-dot 1.5s infinite' }} />
                                LIVE
                            </div>
                        </div>
                    </div>

                    {/* Floating milestone */}
                    <div style={{
                        position: 'absolute', bottom: '-14px', left: '14px',
                        background: 'rgba(16,185,129,0.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(16,185,129,0.18)', borderRadius: '12px',
                        padding: '8px 13px', display: 'flex', alignItems: 'center', gap: 7,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        animation: 'float 4s ease-in-out 1s infinite',
                    }}>
                        <CheckCircle size={13} style={{ color: '#34d399' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(237,233,227,0.75)' }}>Étape débloquée ✓</span>
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════
                FEATURES — 6-card grid
            ════════════════════════════════════════ */}
            <section ref={featRef} style={{
                maxWidth: '1100px', margin: '0 auto', padding: '8rem 2.5rem 5rem',
                position: 'relative', zIndex: 1,
            }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <div style={{
                        display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
                        letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8a960',
                        background: 'rgba(200,169,96,0.06)', border: '1px solid rgba(200,169,96,0.15)',
                        borderRadius: '100px', padding: '5px 16px', marginBottom: '1.5rem',
                    }}>Fonctionnalités</div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 900,
                        letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: '0.75rem',
                    }}>
                        Un écosystème complet.{' '}
                        <span style={{
                            background: 'linear-gradient(135deg,#c8a960,#5eead4)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>Zéro distraction.</span>
                    </h2>
                    <p style={{ color: 'rgba(237,233,227,0.35)', fontSize: '1rem', maxWidth: '440px', margin: '0 auto' }}>
                        Des outils taillés pour les gens qui passent à l'action.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {FEATURES.map((f, i) => (
                        <div key={i} style={{
                            background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(237,233,227,0.06)',
                            borderRadius: '22px', padding: '2rem 1.75rem',
                            transition: 'border-color 0.25s, transform 0.25s',
                            opacity: featOn ? 1 : 0, transform: featOn ? 'translateY(0)' : 'translateY(20px)',
                            transitionDelay: `${i * 80}ms`,
                            transitionProperty: 'opacity, transform, border-color',
                            transitionDuration: '0.5s, 0.5s, 0.25s',
                            cursor: 'default',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}40`; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(237,233,227,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{
                                width: 42, height: 42, borderRadius: '12px',
                                background: `${f.color}12`, border: `1px solid ${f.color}25`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem',
                            }}>
                                <f.Icon size={20} style={{ color: f.color }} />
                            </div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>{f.title}</h3>
                            <p style={{ fontSize: '0.84rem', color: 'rgba(237,233,227,0.38)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ════════════════════════════════════════
                HOW IT WORKS
            ════════════════════════════════════════ */}
            <section ref={stepsRef} style={{
                maxWidth: '1100px', margin: '0 auto', padding: '3rem 2.5rem 7rem',
                position: 'relative', zIndex: 1,
            }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 900,
                        letterSpacing: '-0.04em', marginBottom: '0.75rem',
                    }}>
                        En trois étapes,{' '}
                        <span style={{
                            background: 'linear-gradient(135deg,#c8a960,#34d399)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>tout change.</span>
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', position: 'relative' }}>
                    {/* Connecting line */}
                    <div style={{
                        position: 'absolute', top: '2.5rem', left: '18%', right: '18%',
                        height: '1px', background: 'linear-gradient(90deg, rgba(200,169,96,0.35), rgba(16,185,129,0.35))',
                        zIndex: 0, pointerEvents: 'none',
                    }} />

                    {STEPS.map((step, i) => (
                        <div key={i} style={{
                            background: 'rgba(19,19,22,0.7)', border: '1px solid rgba(237,233,227,0.06)',
                            borderRadius: '22px', padding: '2.25rem 1.75rem', position: 'relative', zIndex: 1,
                            opacity: stepsOn ? 1 : 0, transform: stepsOn ? 'translateY(0)' : 'translateY(16px)',
                            transition: `opacity 0.5s ${i * 120}ms, transform 0.5s ${i * 120}ms`,
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: '50%',
                                background: `${step.color}10`, border: `1px solid ${step.color}28`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.78rem', fontWeight: 900, color: step.color,
                                fontFamily: 'monospace', marginBottom: '1.25rem',
                            }}>{step.n}</div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.6rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>{step.title}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(237,233,227,0.4)', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ════════════════════════════════════════
                CATEGORIES
            ════════════════════════════════════════ */}
            <section style={{
                maxWidth: '1100px', margin: '0 auto', padding: '0 2.5rem 7rem',
                position: 'relative', zIndex: 1,
            }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 900,
                        letterSpacing: '-0.04em', marginBottom: '0.75rem',
                    }}>
                        Pour chaque ambition,{' '}
                        <span style={{
                            background: 'linear-gradient(135deg,#c8a960,#5eead4)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>un espace dédié.</span>
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    {CATEGORIES.map((cat, i) => (
                        <Link key={i} href="/explore" style={{
                            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem',
                            background: `${cat.color}08`, border: `1px solid ${cat.color}15`,
                            borderRadius: '16px', padding: '1.25rem',
                            transition: 'border-color 0.2s, background 0.2s, transform 0.2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${cat.color}35`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = `${cat.color}15`; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: '11px',
                                background: `${cat.color}14`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <cat.Icon size={20} style={{ color: cat.color }} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ede9e3' }}>{cat.name}</div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* ════════════════════════════════════════
                FINAL CTA
            ════════════════════════════════════════ */}
            <section style={{
                position: 'relative', zIndex: 1, textAlign: 'center',
                padding: '6rem 2.5rem', borderTop: '1px solid rgba(237,233,227,0.04)',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: '600px', height: '300px', pointerEvents: 'none',
                    background: 'radial-gradient(ellipse, rgba(200,169,96,0.1) 0%, transparent 70%)',
                }} />
                <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)', fontWeight: 900,
                        letterSpacing: '-0.04em', lineHeight: 1.07, marginBottom: '1.25rem',
                    }}>
                        Tes objectifs{' '}
                        <span style={{
                            background: 'linear-gradient(135deg,#d4b872,#5eead4)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>t'attendent.</span>
                    </h2>
                    <p style={{ color: 'rgba(237,233,227,0.35)', fontSize: '1.05rem', marginBottom: '2.25rem', lineHeight: 1.65 }}>
                        Commence gratuitement. Pas de carte bancaire.<br />Résultats visibles dès la première semaine.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/register" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '10px',
                            background: '#c8a960', color: '#0b0b0d',
                            padding: '15px 32px', borderRadius: '14px',
                            fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
                            boxShadow: '0 10px 40px rgba(200,169,96,0.35)',
                        }}>
                            Créer mon compte <ArrowRight size={18} />
                        </Link>
                        <Link href="/explore" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '10px',
                            background: 'rgba(237,233,227,0.04)', border: '1px solid rgba(237,233,227,0.1)',
                            color: '#9a958e', padding: '15px 26px', borderRadius: '14px',
                            fontSize: '1rem', fontWeight: 600, textDecoration: 'none',
                        }}>
                            Explorer
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer style={{ borderTop: '1px solid rgba(237,233,227,0.04)', background: 'rgba(4,4,10,0.9)' }}>
                <div style={{
                    maxWidth: '1100px', margin: '0 auto', padding: '2rem 2.5rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ConceptAIcon size={26} />
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>BrilliPlan</span>
                        <span style={{ color: 'rgba(237,233,227,0.2)', fontSize: '0.8rem' }}>© {new Date().getFullYear()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'rgba(237,233,227,0.28)' }}>
                        {[['Explorer', '/explore'], ['Connexion', '/login'], ["S'inscrire", '/register'], ['Confidentialité', '/privacy'], ['Conditions', '/terms']].map(([label, href]) => (
                            <Link key={href} href={href} style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#ede9e3')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(237,233,227,0.28)')}
                            >{label}</Link>
                        ))}
                    </div>
                </div>
            </footer>

            {/* ── Keyframes ── */}
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-dot {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.4; transform: scale(0.7); }
                }
                @keyframes float {
                    0%,100% { transform: translateY(0); }
                    50%     { transform: translateY(-8px); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 900px) {
                    section[style*="gridTemplateColumns: '1fr 1fr'"],
                    section { }
                }
            `}</style>

            {/* ── Mobile responsive overrides ── */}
            <style>{`
                @media (max-width: 768px) {
                    section:first-of-type {
                        grid-template-columns: 1fr !important;
                        padding-top: 40px !important;
                        min-height: auto !important;
                        padding-bottom: 3rem !important;
                    }
                    section:first-of-type > div:last-child {
                        display: none !important;
                    }
                    div[style*="gridTemplateColumns: 'repeat(3, 1fr)'"],
                    div[style*="grid-template-columns: repeat(3"] {
                        grid-template-columns: 1fr !important;
                    }
                    div[style*="grid-template-columns: repeat(4"] {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
            `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   AUTHENTICATED HOME (LOGGED IN)
   ═══════════════════════════════════════════════════════════ */

function AuthenticatedHome({ uid, displayName, email }: { uid: string; displayName: string | null; email: string | null }) {
    const router = useRouter();
    const [objectives, setObjectives] = useState<any[]>([]);
    const [recentSessions, setRecentSessions] = useState<any[]>([]);
    const [onlineFriends, setOnlineFriends] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [totalHours, setTotalHours] = useState(0);
    const [streak, setStreak] = useState(0);

    // Greeting based on time of day
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 6) return 'Bonne nuit';
        if (h < 12) return 'Bonjour';
        if (h < 18) return 'Bon après-midi';
        return 'Bonsoir';
    })();

    const firstName = displayName?.split(' ')[0] || email?.split('@')[0] || 'toi';

    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    useEffect(() => {
        const loadAll = async () => {
            try {
                // Profile
                // Objectives via memberships
                const memSnap = await getDocs(query(collection(db, 'memberships'), where('user_id', '==', uid)));
                let hrs = 0;
                const objPromises: Promise<any>[] = [];
                memSnap.docs.forEach(d => {
                    hrs += d.data().completed_hours || 0;
                    objPromises.push(
                        getDoc(doc(db, 'objectives', d.data().objective_id)).then(od => {
                            if (od.exists()) return { id: od.id, ...od.data(), my_hours: d.data().completed_hours || 0 };
                            return null;
                        })
                    );
                });
                setTotalHours(hrs);
                const objs = (await Promise.all(objPromises)).filter(Boolean);
                setObjectives(objs);

                // Recent session logs
                const sessSnap = await getDocs(
                    query(collection(db, 'session_logs'), where('user_id', '==', uid), orderBy('started_at', 'desc'), fbLimit(5))
                );
                setRecentSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                // Streak — single source of truth (login-based, syncs to user doc)
                const computedStreak = await recordLoginAndUpdateStreak(uid);
                setStreak(computedStreak);

                // Online friends
                const friendSnap = await getDocs(query(collection(db, 'friendships'), where('status', '==', 'accepted')));
                const friendUids: string[] = [];
                friendSnap.docs.forEach(fd => {
                    const data = fd.data();
                    if (data.user1_id === uid) friendUids.push(data.user2_id);
                    else if (data.user2_id === uid) friendUids.push(data.user1_id);
                });

                if (friendUids.length > 0) {
                    const twoMinAgo = Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 1000));
                    // Firestore 'in' limited to 30
                    const batch = friendUids.slice(0, 30);
                    const presSnap = await getDocs(
                        query(collection(db, 'presence_global'), where('uid', 'in', batch), where('online', '==', true), where('last_seen', '>', twoMinAgo))
                    );
                    const onlineUids = presSnap.docs.map(d => d.data().uid);
                    // Get profiles for online friends
                    const friendProfiles = await Promise.all(
                        onlineUids.slice(0, 8).map(async fuid => {
                            const fd = await getDoc(doc(db, 'users', fuid));
                            return fd.exists() ? { uid: fuid, ...fd.data() } : null;
                        })
                    );
                    setOnlineFriends(friendProfiles.filter(Boolean));
                }
            } catch (err) {
                console.error('Home load error:', err);
            } finally {
                setLoadingData(false);
            }
        };
        loadAll();
    }, [uid]);

    if (loadingData) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(200,169,96,0.2)', borderTopColor: '#c8a960', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Weekly activity data (last 7 days)
    const weeklyData = (() => {
        const days: { label: string; hours: number }[] = [];
        const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const hrs = recentSessions.reduce((sum: number, s: any) => {
                const sDate = s.started_at?.toDate?.();
                if (sDate && sDate.toISOString().slice(0, 10) === key) return sum + (s.duration_hours || 0);
                return sum;
            }, 0);
            days.push({ label: dayLabels[d.getDay()], hours: hrs });
        }
        return days;
    })();
    const maxWeekHrs = Math.max(...weeklyData.map(d => d.hours), 0.5);

    // Last worked objective
    const lastSession = recentSessions[0] || null;
    const lastObj = lastSession ? objectives.find((o: any) => o.id === lastSession.objective_id) : null;

    // Daily motivational quotes
    const QUOTES = [
        { text: "La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.", author: "Abraham Lincoln" },
        { text: "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte.", author: "Winston Churchill" },
        { text: "Chaque expert a d'abord été un débutant.", author: "Helen Hayes" },
        { text: "Le meilleur moment pour planter un arbre était il y a 20 ans. Le deuxième meilleur moment, c'est maintenant.", author: "Proverbe chinois" },
        { text: "Tu n'as pas besoin d'être génial pour commencer, mais tu dois commencer pour devenir génial.", author: "Zig Ziglar" },
        { text: "La seule façon de faire du bon travail est d'aimer ce que tu fais.", author: "Steve Jobs" },
        { text: "Ne compte pas les jours, fais que chaque jour compte.", author: "Muhammad Ali" },
    ];
    const todayQuote = QUOTES[new Date().getDay()];

    return (
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem 2rem 5rem' }}>

            {/* ── Welcome header ── */}
            <div style={{
                marginBottom: '2rem',
                animation: 'fadeIn 0.5s ease-out both',
            }}>
                <div style={{ fontSize: '0.78rem', color: 'rgba(237,233,227,0.3)', fontWeight: 500, marginBottom: '4px', textTransform: 'capitalize' }}>
                    {dateStr}
                </div>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900,
                    letterSpacing: '-0.04em', lineHeight: 1.1, margin: 0,
                }}>
                    {greeting},{' '}
                    <span style={{
                        background: 'linear-gradient(125deg, #c8a960, #5eead4)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}>{firstName}</span>
                </h1>
            </div>

            {/* ── Quick stats ── */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
                marginBottom: '2rem',
                animation: 'fadeIn 0.5s ease-out 0.1s both',
            }}>
                {[
                    { label: 'Total heures', value: fmtH(totalHours), Icon: Clock, color: '#c8a960' },
                    { label: 'Objectifs', value: String(objectives.length), Icon: Target, color: '#5eead4' },
                    { label: 'Sessions', value: String(recentSessions.length), Icon: Timer, color: '#10b981' },
                    { label: 'Streak', value: streak > 0 ? `${streak}j` : '—', Icon: Flame, color: '#f59e0b' },
                ].map((s, i) => (
                    <div key={i} style={{
                        background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(237,233,227,0.06)',
                        borderRadius: '16px', padding: '1.25rem',
                        position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
                        <s.Icon size={15} style={{ color: s.color, marginBottom: '0.75rem', opacity: 0.8 }} />
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1, color: '#ede9e3', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)' }}>{s.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'rgba(237,233,227,0.3)', marginTop: '0.4rem', fontWeight: 500 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Quick actions ── */}
            <div style={{
                display: 'flex', gap: '0.6rem', marginBottom: '2rem', flexWrap: 'wrap',
                animation: 'fadeIn 0.5s ease-out 0.15s both',
            }}>
                {[
                    { label: 'Mon dashboard', Icon: Target, href: '/dashboard', color: '#c8a960', primary: true },
                    { label: 'Explorer', Icon: Sparkles, href: '/explore', color: '#5eead4' },
                    { label: 'Calendrier', Icon: Calendar, href: '/calendar', color: '#10b981' },
                    { label: 'Messages', Icon: MessageSquare, href: '/messages', color: '#f59e0b' },
                    { label: 'Accountability', Icon: Users, href: '/accountability', color: '#f472b6' },
                ].map((a, i) => (
                    <Link key={i} href={a.href} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: a.primary ? '10px 20px' : '10px 16px',
                        borderRadius: '12px',
                        background: a.primary ? '#c8a960' : 'rgba(237,233,227,0.04)',
                        border: a.primary ? 'none' : '1px solid rgba(237,233,227,0.08)',
                        color: a.primary ? '#0b0b0d' : 'rgba(237,233,227,0.55)',
                        fontSize: '0.82rem', fontWeight: a.primary ? 700 : 600,
                        textDecoration: 'none',
                        transition: 'transform 0.15s, background 0.15s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <a.Icon size={15} /> {a.label}
                    </Link>
                ))}
            </div>

            {/* Weekly report modal */}
            <WeeklyReport sessionLogs={recentSessions} />

            {/* ── Main content ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out 0.2s both' }}>

                {/* ── Left column ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Daily goals */}
                    <DailyGoals />

                    {/* Weekly check-in */}
                    <WeeklyCheckIn />

                    {/* Weekly activity chart */}
                    <div style={{
                        background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(237,233,227,0.06)',
                        borderRadius: '18px', padding: '1.5rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#c8a960' }} />
                                <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(237,233,227,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                                    Cette semaine
                                </h2>
                            </div>
                            <Link href="/profile?tab=activity" style={{ fontSize: '0.7rem', color: '#c8a960', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                Détails <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px' }}>
                            {weeklyData.map((d, i) => {
                                const pct = maxWeekHrs > 0 ? (d.hours / maxWeekHrs) * 100 : 0;
                                const isToday = i === 6;
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        <div style={{
                                            width: '100%', maxWidth: '32px',
                                            height: `${Math.max(pct, 4)}%`,
                                            borderRadius: '6px 6px 4px 4px',
                                            background: d.hours > 0
                                                ? isToday ? 'linear-gradient(180deg, #c8a960, #a8893e)' : 'rgba(200,169,96,0.35)'
                                                : 'rgba(237,233,227,0.04)',
                                            transition: 'height 0.5s ease',
                                            minHeight: '4px',
                                        }} />
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: isToday ? 700 : 500,
                                            color: isToday ? '#c8a960' : 'rgba(237,233,227,0.25)',
                                        }}>{d.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {weeklyData.every(d => d.hours === 0) && (
                            <div style={{ textAlign: 'center', padding: '0.5rem 0 0', fontSize: '0.78rem', color: 'rgba(237,233,227,0.2)' }}>
                                Aucune activité cette semaine — lance une session !
                            </div>
                        )}
                    </div>

                    {/* Continue where you left off */}
                    {lastObj && (
                        <div
                            onClick={() => router.push(`/objective/${lastObj.id}`)}
                            style={{
                                background: 'rgba(200,169,96,0.05)', border: '1px solid rgba(200,169,96,0.15)',
                                borderRadius: '18px', padding: '1.5rem', cursor: 'pointer',
                                transition: 'border-color 0.2s, transform 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,169,96,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(200,169,96,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                                <Play size={13} style={{ color: '#c8a960' }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(237,233,227,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Reprendre
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#ede9e3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {lastObj.title}
                                    </h3>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(237,233,227,0.3)' }}>
                                        {fmtH(lastObj.my_hours || 0)} / {fmtH(lastObj.target_hours || 0)} — {Math.min(100, Math.round(((lastObj.my_hours ?? 0) / (lastObj.target_hours || 1)) * 100))}%
                                    </div>
                                </div>
                                <div style={{
                                    width: 44, height: 44, borderRadius: '12px',
                                    background: 'rgba(200,169,96,0.12)', border: '1px solid rgba(200,169,96,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <ArrowRight size={18} style={{ color: '#c8a960' }} />
                                </div>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(237,233,227,0.06)', overflow: 'hidden', marginTop: '0.75rem' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Math.round(((lastObj.my_hours ?? 0) / (lastObj.target_hours || 1)) * 100))}%`, background: 'linear-gradient(90deg, #c8a960, #5eead4)', borderRadius: 2 }} />
                            </div>
                        </div>
                    )}

                    {/* Quick links grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                        {[
                            { label: 'Amis', desc: 'Gérer tes connexions', Icon: UserPlus, href: '/friends', color: '#10b981' },
                            { label: 'Profil', desc: 'Statistiques & paramètres', Icon: BarChart2, href: '/profile', color: '#5eead4' },
                            { label: 'Trouver un partenaire', desc: 'Accountability', Icon: Users, href: '/find-teammates', color: '#f59e0b' },
                        ].map((item, i) => (
                            <Link key={i} href={item.href} style={{
                                textDecoration: 'none',
                                background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(237,233,227,0.06)',
                                borderRadius: '14px', padding: '1.1rem',
                                transition: 'border-color 0.2s, transform 0.15s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${item.color}40`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(237,233,227,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                <item.Icon size={16} style={{ color: item.color, marginBottom: '0.6rem' }} />
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ede9e3', marginBottom: '2px' }}>{item.label}</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(237,233,227,0.25)' }}>{item.desc}</div>
                            </Link>
                        ))}
                    </div>

                </div>

                {/* ── Right sidebar ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Session templates */}
                    <SessionTemplates />

                    {/* Smart suggestions */}
                    <SmartSuggestions sessionLogs={recentSessions} />

                    {/* Daily motivation */}
                    <div style={{
                        background: 'linear-gradient(145deg, rgba(200,169,96,0.07), rgba(94,234,212,0.04))',
                        border: '1px solid rgba(200,169,96,0.12)',
                        borderRadius: '18px', padding: '1.4rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.85rem' }}>
                            <Sparkles size={13} style={{ color: '#c8a960' }} />
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(237,233,227,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Motivation du jour
                            </span>
                        </div>
                        <p style={{
                            margin: '0 0 0.6rem', fontSize: '0.88rem', fontWeight: 500,
                            color: 'rgba(237,233,227,0.7)', lineHeight: 1.55, fontStyle: 'italic',
                        }}>
                            "{todayQuote.text}"
                        </p>
                        <div style={{ fontSize: '0.72rem', color: '#c8a960', fontWeight: 600 }}>
                            — {todayQuote.author}
                        </div>
                    </div>

                    {/* Online friends */}
                    {onlineFriends.length > 0 && (
                        <div style={{
                            background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(237,233,227,0.06)',
                            borderRadius: '18px', padding: '1.25rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#10b981' }} />
                                <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(237,233,227,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, flex: 1 }}>
                                    En ligne
                                </h3>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 1.5s infinite' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {onlineFriends.map((f: any) => (
                                    <div key={f.uid}
                                        onClick={() => router.push(`/user/${f.uid}`)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(237,233,227,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{ position: 'relative' }}>
                                            <Avatar uid={f.uid} avatarUrl={f.avatar_url} avatarStyle={f.avatar_style} size={32}
                                                style={{ borderRadius: '50%' }}
                                            />
                                            <div style={{
                                                position: 'absolute', bottom: -1, right: -1,
                                                width: 9, height: 9, borderRadius: '50%',
                                                background: '#10b981', border: '2px solid #0b0b0d',
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(237,233,227,0.7)' }}>
                                            {f.full_name || f.email?.split('@')[0] || 'Utilisateur'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Streak flame card */}
                    <div style={{
                        background: streak > 0
                            ? 'linear-gradient(145deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))'
                            : 'rgba(19,19,22,0.6)',
                        border: `1px solid ${streak > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(237,233,227,0.06)'}`,
                        borderRadius: '18px', padding: '1.4rem',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>
                            {streak >= 7 ? '🔥' : streak > 0 ? '🕯️' : '💤'}
                        </div>
                        <div style={{
                            fontSize: '1.4rem', fontWeight: 900, color: streak > 0 ? '#fbbf24' : 'rgba(237,233,227,0.15)',
                            fontFamily: 'var(--font-display)', letterSpacing: '-0.03em',
                        }}>
                            {streak > 0 ? `${streak} jour${streak > 1 ? 's' : ''}` : 'Pas de streak'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(237,233,227,0.3)', marginTop: '0.25rem' }}>
                            {streak >= 30 ? 'Inarrêtable ! 🌋' : streak >= 7 ? 'En feu ! Continue comme ça' : streak > 0 ? 'Reviens chaque jour pour maintenir ta série' : 'Connecte-toi chaque jour pour démarrer'}
                        </div>
                    </div>

                    {/* Recent activity mini */}
                    <div style={{
                        background: 'rgba(19,19,22,0.6)', border: '1px solid rgba(237,233,227,0.06)',
                        borderRadius: '18px', padding: '1.25rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#5eead4' }} />
                                <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(237,233,227,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                                    Activité récente
                                </h3>
                            </div>
                            <Link href="/profile?tab=activity" style={{ fontSize: '0.7rem', color: '#5eead4', fontWeight: 600, textDecoration: 'none' }}>
                                Tout voir
                            </Link>
                        </div>

                        {recentSessions.length === 0 ? (
                            <div style={{
                                padding: '1.25rem', textAlign: 'center', borderRadius: '12px',
                                background: 'rgba(237,233,227,0.02)',
                            }}>
                                <Timer size={18} style={{ color: 'rgba(237,233,227,0.1)', marginBottom: '0.4rem' }} />
                                <p style={{ color: 'rgba(237,233,227,0.2)', margin: 0, fontSize: '0.75rem' }}>Aucune session récente</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {recentSessions.slice(0, 4).map((s: any) => {
                                    const dt = s.started_at?.toDate?.();
                                    const typeColors: Record<string, string> = { objective: '#c8a960', project: '#5eead4', accountability: '#f59e0b' };
                                    const col = typeColors[s.type] || '#c8a960';
                                    return (
                                        <div key={s.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '7px 10px', borderRadius: '10px',
                                            background: 'rgba(237,233,227,0.02)',
                                        }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: col, flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(237,233,227,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {s.title || 'Session'}
                                                </div>
                                                <div style={{ fontSize: '0.62rem', color: 'rgba(237,233,227,0.2)' }}>
                                                    {dt ? dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} · {fmtH(s.duration_hours || 0)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* ── Keyframes ── */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-dot {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.4; transform: scale(0.7); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 768px) {
                    div[style*="grid-template-columns: 1fr 320px"] {
                        grid-template-columns: 1fr !important;
                    }
                    div[style*="grid-template-columns: repeat(4, 1fr)"] {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    div[style*="grid-template-columns: repeat(3, 1fr)"] {
                        grid-template-columns: 1fr 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
