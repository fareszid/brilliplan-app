'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, FolderKanban, Users, Flame, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STEPS = [
    {
        id: 'objective',
        icon: <Target size={28} />,
        emoji: '🎯',
        title: 'Crée ton premier salon',
        desc: 'Un salon = un objectif. Apprendre le piano, lancer un SaaS, préparer un examen… tout commence ici.',
        action: 'Créer un objectif',
        color: '#c8a960',
        bg: 'rgba(200,169,96,0.06)',
        border: 'rgba(200,169,96,0.15)',
    },
    {
        id: 'project',
        icon: <FolderKanban size={28} />,
        emoji: '📋',
        title: 'Lance un projet d\'équipe',
        desc: 'Kanban, sprints, roadmap IA… invite ton équipe et organisez votre travail ensemble.',
        action: 'Créer un projet',
        color: '#5eead4',
        bg: 'rgba(94,234,212,0.06)',
        border: 'rgba(94,234,212,0.15)',
    },
    {
        id: 'friends',
        icon: <Users size={28} />,
        emoji: '👥',
        title: 'Trouve des coéquipiers',
        desc: 'Ajoute des amis, découvre des profils proches de toi, et travaillez ensemble en coworking live.',
        action: 'Trouver des amis',
        color: '#c8a960',
        bg: 'rgba(200,169,96,0.06)',
        border: 'rgba(200,169,96,0.15)',
    },
    {
        id: 'accountability',
        icon: <Flame size={28} />,
        emoji: '🔥',
        title: 'Crée un pacte de discipline',
        desc: 'Engage-toi avec un partenaire. Check-ins quotidiens, streaks, sessions à deux… la vraie accountability.',
        action: 'Créer un pacte',
        color: '#fbbf24',
        bg: 'rgba(251,191,36,0.06)',
        border: 'rgba(251,191,36,0.15)',
    },
];

const ROUTES: Record<string, string> = {
    objective: '/dashboard?tab=objectives&create=true',
    project: '/dashboard?tab=projects&create=true',
    friends: '/friends',
    accountability: '/accountability',
};

export default function EmptyDashboardOnboarding({ onCreateObjective, onCreateProject }: {
    onCreateObjective: () => void;
    onCreateProject: () => void;
}) {
    const router = useRouter();
    const [completed, setCompleted] = useState<Set<string>>(new Set());
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const handleAction = (id: string) => {
        if (id === 'objective') onCreateObjective();
        else if (id === 'project') onCreateProject();
        else router.push(ROUTES[id]);
    };

    return (
        <div style={{ marginTop: '1rem' }}>
            {/* Welcome header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ textAlign: 'center', marginBottom: '2.5rem' }}
            >
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px', borderRadius: 20,
                    background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.15)',
                    marginBottom: '1.25rem',
                }}>
                    <Sparkles size={14} style={{ color: '#c8a960' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c8a960', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Bienvenue sur BrilliPlan
                    </span>
                </div>
                <h2 style={{
                    fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                    fontWeight: 800, color: '#ede9e3', margin: '0 0 0.5rem',
                    letterSpacing: '-0.02em',
                }}>
                    Commence ton parcours
                </h2>
                <p style={{ color: 'rgba(237,233,227,0.4)', fontSize: '0.9rem', margin: 0, maxWidth: 480, marginInline: 'auto' }}>
                    4 étapes pour débloquer tout le potentiel de la plateforme
                </p>
            </motion.div>

            {/* Steps grid */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '14px', maxWidth: 900, margin: '0 auto',
            }}>
                {STEPS.map((step, i) => {
                    const done = completed.has(step.id);
                    const hovered = hoveredIdx === i;
                    return (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            onClick={() => handleAction(step.id)}
                            style={{
                                position: 'relative', cursor: 'pointer',
                                padding: '1.5rem', borderRadius: 16,
                                background: hovered ? step.bg : 'rgba(255,255,255,0.015)',
                                border: `1px solid ${hovered ? step.border : 'rgba(255,255,255,0.05)'}`,
                                transition: 'all 0.25s ease',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Step number */}
                            <div style={{
                                position: 'absolute', top: 14, right: 14,
                                width: 24, height: 24, borderRadius: '50%',
                                background: done ? step.color : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${done ? step.color : 'rgba(255,255,255,0.08)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: 800,
                                color: done ? '#0b0b0d' : 'rgba(255,255,255,0.2)',
                                transition: 'all 0.2s',
                            }}>
                                {done ? <CheckCircle2 size={14} /> : i + 1}
                            </div>

                            {/* Icon */}
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: step.bg, border: `1px solid ${step.border}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: step.color, marginBottom: '1rem',
                                transition: 'transform 0.2s',
                                transform: hovered ? 'scale(1.08)' : 'scale(1)',
                            }}>
                                {step.icon}
                            </div>

                            <h3 style={{
                                fontSize: '1rem', fontWeight: 700, color: '#ede9e3',
                                margin: '0 0 6px', letterSpacing: '-0.01em',
                            }}>
                                {step.title}
                            </h3>
                            <p style={{
                                fontSize: '0.8rem', color: 'rgba(237,233,227,0.4)',
                                margin: '0 0 1rem', lineHeight: 1.5,
                            }}>
                                {step.desc}
                            </p>

                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontSize: '0.78rem', fontWeight: 600, color: step.color,
                                opacity: hovered ? 1 : 0.7,
                                transition: 'opacity 0.2s',
                            }}>
                                {step.action}
                                <ArrowRight size={14} style={{
                                    transition: 'transform 0.2s',
                                    transform: hovered ? 'translateX(3px)' : 'translateX(0)',
                                }} />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
