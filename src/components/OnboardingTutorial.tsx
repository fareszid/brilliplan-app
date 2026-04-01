'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Target, Users, Brain, ArrowRight, X, Sparkles, Video, Rocket, LayoutDashboard } from 'lucide-react';
import { ConceptAIcon } from '@/components/BrilliPlanLogo';
import { usePathname } from 'next/navigation';

/* ─── Step data ─── */

const STEPS = [
    {
        title: 'Bienvenue sur BrilliPlan',
        subtitle: 'Ta plateforme de productivité collaborative',
        desc: 'On te fait un tour rapide pour que tu sois opérationnel en 30 secondes.',
        visual: 'welcome',
        color: '#c8a960',
        accent: '#c8a960',
        emoji: null,
    },
    {
        title: 'Objectifs & Projets',
        subtitle: 'Organise ta progression',
        desc: 'Crée des objectifs solo ou en équipe, décompose-les en tâches Kanban avec sprints, jalons, et suivi en temps réel.',
        visual: 'objectives',
        color: '#c8a960',
        accent: '#d4b872',
        emoji: null,
    },
    {
        title: 'Sessions Live',
        subtitle: 'Travaille en coworking',
        desc: 'Lance un Pomodoro synchronisé avec ton équipe. Vidéo, partage de fichiers, whiteboard collaboratif — tout intégré.',
        visual: 'sessions',
        color: '#5eead4',
        accent: '#f9a8d4',
        emoji: null,
    },
    {
        title: 'Accountability',
        subtitle: 'Un partenaire qui te tient',
        desc: 'Trouve un partenaire proche de toi. Fixez des objectifs communs, suivez vos progrès mutuels, et motivez-vous.',
        visual: 'accountability',
        color: '#f59e0b',
        accent: '#fcd34d',
        emoji: null,
    },
    {
        title: 'Coach IA',
        subtitle: 'Gemini intégré partout',
        desc: 'Génère ta roadmap, tes jalons, obtiens des ressources recommandées, et un coaching personnalisé dans chaque objectif.',
        visual: 'ai',
        color: '#8b5cf6',
        accent: '#ede9e3',
        emoji: null,
    },
    {
        title: 'C\'est parti !',
        subtitle: 'Tu es prêt à commencer',
        desc: 'Crée ton premier objectif depuis le Dashboard. Invite tes amis, lance une session, et commence à progresser.',
        visual: 'ready',
        color: '#10b981',
        accent: '#6ee7b7',
        emoji: null,
    },
];

/* ─── Visual illustrations per step ─── */

function StepVisual({ id, color, accent }: { id: string; color: string; accent: string }) {
    const base: React.CSSProperties = {
        width: '100%', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
    };

    if (id === 'welcome') {
        return (
            <div style={base}>
                <div style={{ position: 'relative', animation: 'ob-float 3s ease-in-out infinite' }}>
                    <ConceptAIcon size={88} />
                </div>
                {/* Orbiting dots */}
                {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{
                        position: 'absolute', width: '8px', height: '8px', borderRadius: '50%',
                        background: accent, opacity: 0.5,
                        animation: `ob-orbit 4s linear infinite`,
                        animationDelay: `${i * -1}s`,
                        top: '50%', left: '50%',
                        transformOrigin: `${40 + i * 12}px 0`,
                    }} />
                ))}
            </div>
        );
    }

    if (id === 'objectives') {
        return (
            <div style={base}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    {[
                        { h: 60, label: 'Sprint 1', done: true },
                        { h: 90, label: 'Sprint 2', done: true },
                        { h: 45, label: 'Sprint 3', done: false },
                        { h: 110, label: 'Sprint 4', done: false },
                    ].map((bar, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '40px', height: `${bar.h}px`, borderRadius: '8px 8px 4px 4px',
                                background: bar.done
                                    ? `linear-gradient(180deg, ${accent}, ${color})`
                                    : 'rgba(255,255,255,0.06)',
                                border: bar.done ? 'none' : '1px dashed rgba(255,255,255,0.12)',
                                animation: 'ob-rise 0.6s ease-out both',
                                animationDelay: `${i * 0.12}s`,
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                {bar.done && <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.15), transparent)',
                                }} />}
                            </div>
                            <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{bar.label}</span>
                        </div>
                    ))}
                    <div style={{
                        position: 'absolute', top: '20px', right: '30px',
                        padding: '5px 10px', borderRadius: '8px',
                        background: `${color}20`, border: `1px solid ${color}40`,
                        fontSize: '0.65rem', fontWeight: 700, color: accent,
                        display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                        <Target size={10} /> 4 jalons
                    </div>
                </div>
            </div>
        );
    }

    if (id === 'sessions') {
        return (
            <div style={base}>
                {/* Pomodoro ring */}
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <circle cx="60" cy="60" r="52" fill="none" stroke={`url(#ob-pomo)`}
                            strokeWidth="6" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 52}`}
                            strokeDashoffset={`${2 * Math.PI * 52 * 0.3}`}
                            style={{ animation: 'ob-dash 3s ease-in-out infinite alternate' }}
                        />
                        <defs>
                            <linearGradient id="ob-pomo" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                                <stop stopColor={color} />
                                <stop offset="1" stopColor={accent} />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.04em' }}>17:32</span>
                        <span style={{ fontSize: '0.62rem', color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Focus</span>
                    </div>
                </div>
                {/* Participant avatars */}
                <div style={{
                    position: 'absolute', bottom: '20px', display: 'flex', gap: '-8px',
                }}>
                    {['#c8a960', '#5eead4', '#10b981'].map((c, i) => (
                        <div key={i} style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: `${c}30`, border: `2px solid ${c}`,
                            marginLeft: i > 0 ? '-8px' : 0, position: 'relative', zIndex: 3 - i,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 700, color: c,
                        }}>
                            {['F', 'A', 'M'][i]}
                        </div>
                    ))}
                    <span style={{
                        marginLeft: '8px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)',
                        fontWeight: 600, alignSelf: 'center',
                    }}>3 en ligne</span>
                </div>
            </div>
        );
    }

    if (id === 'accountability') {
        return (
            <div style={base}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {/* Two user cards connected */}
                    {['Toi', 'Partenaire'].map((label, i) => (
                        <div key={i} style={{
                            width: '100px', padding: '16px 12px', borderRadius: '16px',
                            background: i === 0 ? `${color}15` : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${i === 0 ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
                            textAlign: 'center',
                            animation: 'ob-rise 0.5s ease-out both',
                            animationDelay: `${i * 0.2}s`,
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 8px',
                                background: i === 0 ? `${color}30` : 'rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Users size={16} style={{ color: i === 0 ? accent : 'rgba(255,255,255,0.3)' }} />
                            </div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: i === 0 ? accent : 'rgba(255,255,255,0.4)' }}>
                                {label}
                            </div>
                            <div style={{
                                marginTop: '8px', height: '4px', borderRadius: '2px',
                                background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: i === 0 ? '72%' : '45%', height: '100%', borderRadius: '2px',
                                    background: i === 0 ? `linear-gradient(90deg, ${color}, ${accent})` : 'rgba(255,255,255,0.15)',
                                }} />
                            </div>
                        </div>
                    ))}
                    {/* Connection line */}
                    <div style={{
                        position: 'absolute', width: '24px', height: '2px',
                        background: `linear-gradient(90deg, ${color}60, ${accent}60)`,
                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    }} />
                    <div style={{
                        position: 'absolute', width: '8px', height: '8px', borderRadius: '50%',
                        background: accent, top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        boxShadow: `0 0 12px ${color}60`,
                        animation: 'ob-pulse 1.5s ease-in-out infinite',
                    }} />
                </div>
            </div>
        );
    }

    if (id === 'ai') {
        return (
            <div style={base}>
                <div style={{
                    width: '220px', display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                    {/* Chat bubbles */}
                    {[
                        { from: 'user', text: 'Génère ma roadmap' },
                        { from: 'ai', text: 'Voici 4 phases avec jalons...' },
                        { from: 'ai', text: '✦ Phase 1 → Fondations (2 sem)' },
                    ].map((msg, i) => (
                        <div key={i} style={{
                            alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start',
                            padding: '8px 12px', borderRadius: '12px',
                            background: msg.from === 'user' ? `${color}20` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${msg.from === 'user' ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
                            fontSize: '0.72rem', fontWeight: 600, maxWidth: '80%',
                            color: msg.from === 'user' ? accent : 'rgba(255,255,255,0.5)',
                            animation: 'ob-rise 0.4s ease-out both',
                            animationDelay: `${i * 0.15}s`,
                        }}>
                            {msg.from === 'ai' && <Brain size={10} style={{ display: 'inline', marginRight: '4px', color: accent, verticalAlign: 'middle' }} />}
                            {msg.text}
                        </div>
                    ))}
                    {/* Typing indicator */}
                    <div style={{
                        alignSelf: 'flex-start', padding: '8px 14px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.04)', display: 'flex', gap: '4px',
                        animation: 'ob-rise 0.4s ease-out both', animationDelay: '0.5s',
                    }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: '5px', height: '5px', borderRadius: '50%', background: accent,
                                animation: 'ob-typing 1s ease-in-out infinite',
                                animationDelay: `${i * 0.2}s`,
                            }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ready
    return (
        <div style={base}>
            <div style={{ animation: 'ob-float 2.5s ease-in-out infinite', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <Rocket size={56} style={{ color: accent, filter: `drop-shadow(0 0 20px ${color}60)` }} />
                <div style={{
                    padding: '6px 16px', borderRadius: '20px',
                    background: `${color}18`, border: `1px solid ${color}35`,
                    fontSize: '0.72rem', fontWeight: 700, color: accent,
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <LayoutDashboard size={12} /> Aller au Dashboard
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */

export default function OnboardingTutorial() {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState<'next' | 'prev'>('next');
    const [animKey, setAnimKey] = useState(0);

    useEffect(() => {
        if (loading || !user) return;
        // Only show on dashboard
        if (pathname !== '/dashboard') return;
        const key = `brilliplan_onboarding_${user.uid}`;
        if (!localStorage.getItem(key)) {
            // Small delay so dashboard loads first
            const t = setTimeout(() => setShow(true), 800);
            return () => clearTimeout(t);
        }
    }, [user, loading, pathname]);

    const dismiss = useCallback(() => {
        if (!user) return;
        localStorage.setItem(`brilliplan_onboarding_${user.uid}`, 'done');
        setShow(false);
    }, [user]);

    const goTo = useCallback((target: number) => {
        setDirection(target > step ? 'next' : 'prev');
        setStep(target);
        setAnimKey(k => k + 1);
    }, [step]);

    const next = () => {
        if (step < STEPS.length - 1) goTo(step + 1);
        else dismiss();
    };

    const prev = () => {
        if (step > 0) goTo(step - 1);
    };

    // Keyboard nav
    useEffect(() => {
        if (!show) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') next();
            else if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'Escape') dismiss();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    });

    if (!show) return null;

    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <>
            <style>{`
                @keyframes ob-enter { from { opacity: 0; transform: scale(0.92) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes ob-backdrop { from { opacity: 0; } to { opacity: 1; } }
                @keyframes ob-slide-next { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes ob-slide-prev { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes ob-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes ob-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes ob-pulse { 0%,100% { opacity: 1; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 0.5; transform: translate(-50%,-50%) scale(1.5); } }
                @keyframes ob-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes ob-dash { 0% { stroke-dashoffset: ${2 * Math.PI * 52 * 0.3}; } 100% { stroke-dashoffset: ${2 * Math.PI * 52 * 0.15}; } }
                @keyframes ob-typing { 0%,100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
                @keyframes ob-progress { from { width: 0; } }
            `}</style>

            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(4,4,12,0.82)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                padding: '1.5rem',
                animation: 'ob-backdrop 0.4s ease-out',
            }}>
                <div style={{
                    width: '100%', maxWidth: '460px',
                    background: 'linear-gradient(180deg, rgba(16,16,32,0.98), rgba(11,11,13,0.99))',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 32px 100px rgba(0,0,0,0.7), 0 0 80px ${s.color}12`,
                    animation: 'ob-enter 0.5s cubic-bezier(0.16,1,0.3,1)',
                    position: 'relative',
                }}>
                    {/* ── Top progress bar ── */}
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', position: 'relative' }}>
                        <div style={{
                            height: '100%', borderRadius: '0 2px 2px 0',
                            background: `linear-gradient(90deg, ${s.color}, ${s.accent})`,
                            width: `${progress}%`,
                            transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1), background 0.3s',
                            boxShadow: `0 0 12px ${s.color}50`,
                        }} />
                    </div>

                    {/* ── Skip / Step counter ── */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 22px 0',
                    }}>
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)',
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                        }}>
                            {step + 1} / {STEPS.length}
                        </span>
                        <button onClick={dismiss} style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px', padding: '5px 12px', cursor: 'pointer',
                            color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '5px',
                            transition: 'all 0.15s',
                        }}>
                            Passer <X size={11} />
                        </button>
                    </div>

                    {/* ── Visual illustration ── */}
                    <div key={`v-${animKey}`} style={{
                        animation: `${direction === 'next' ? 'ob-slide-next' : 'ob-slide-prev'} 0.4s ease-out`,
                    }}>
                        <StepVisual id={s.visual} color={s.color} accent={s.accent} />
                    </div>

                    {/* ── Text content ── */}
                    <div key={`t-${animKey}`} style={{
                        padding: '0 2.25rem 1rem', textAlign: 'center',
                        animation: `${direction === 'next' ? 'ob-slide-next' : 'ob-slide-prev'} 0.4s ease-out`,
                    }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '3px 12px', borderRadius: '20px',
                            background: `${s.color}12`, border: `1px solid ${s.color}25`,
                            fontSize: '0.68rem', fontWeight: 700, color: s.accent,
                            marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>
                            {s.subtitle}
                        </div>

                        <h2 style={{
                            fontSize: '1.5rem', fontWeight: 900, color: '#f4f4f5',
                            margin: '0 0 8px', letterSpacing: '-0.035em', lineHeight: 1.15,
                        }}>
                            {s.title}
                        </h2>

                        <p style={{
                            fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)',
                            lineHeight: 1.7, margin: 0, maxWidth: '360px', marginInline: 'auto',
                        }}>
                            {s.desc}
                        </p>
                    </div>

                    {/* ── Footer ── */}
                    <div style={{
                        padding: '1rem 2.25rem 1.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        {/* Step dots */}
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            {STEPS.map((_, i) => (
                                <button key={i} onClick={() => goTo(i)} style={{
                                    width: i === step ? '22px' : '8px',
                                    height: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', padding: 0,
                                    background: i === step
                                        ? `linear-gradient(90deg, ${s.color}, ${s.accent})`
                                        : i < step
                                            ? `${s.color}50`
                                            : 'rgba(255,255,255,0.08)',
                                    transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                                    boxShadow: i === step ? `0 0 8px ${s.color}40` : 'none',
                                }} />
                            ))}
                        </div>

                        {/* Nav buttons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {step > 0 && (
                                <button onClick={prev} style={{
                                    padding: '11px 18px', borderRadius: '12px', cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontWeight: 600,
                                    transition: 'all 0.15s',
                                }}>
                                    Retour
                                </button>
                            )}
                            <button onClick={next} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '11px 24px', borderRadius: '12px', cursor: 'pointer',
                                background: `linear-gradient(135deg, ${s.color}, ${s.accent}90)`,
                                border: 'none', color: '#fff', fontSize: '0.88rem', fontWeight: 700,
                                boxShadow: `0 6px 24px ${s.color}35`,
                                transition: 'all 0.15s, background 0.3s',
                            }}>
                                {isLast ? 'C\'est parti !' : 'Suivant'}
                                {isLast ? <Sparkles size={15} /> : <ArrowRight size={15} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
