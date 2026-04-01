'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGamification, BADGES } from '@/context/GamificationContext';
import type { Badge } from '@/context/GamificationContext';

// ── Particle system ──

type Particle = {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    delay: number;
    duration: number;
    angle: number;
    distance: number;
    type: 'spark' | 'ring' | 'dot';
};

function generateParticles(count: number): Particle[] {
    const colors = ['#c8a960', '#5eead4', '#ede9e3', '#e8d5a3', '#7af5e0', '#fff'];
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 10,
        y: 50 + (Math.random() - 0.5) * 10,
        size: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.6,
        duration: 0.8 + Math.random() * 1.2,
        angle: (360 / count) * i + (Math.random() - 0.5) * 30,
        distance: 80 + Math.random() * 160,
        type: Math.random() > 0.7 ? 'ring' : Math.random() > 0.4 ? 'spark' : 'dot',
    }));
}

function ParticleField() {
    const [particles] = useState(() => generateParticles(40));

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            {particles.map((p) => {
                const rad = (p.angle * Math.PI) / 180;
                const tx = Math.cos(rad) * p.distance;
                const ty = Math.sin(rad) * p.distance;

                return (
                    <motion.div
                        key={p.id}
                        initial={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            opacity: 0,
                            scale: 0,
                            x: 0,
                            y: 0,
                        }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            scale: [0, 1.2, 0.8, 0],
                            x: tx,
                            y: ty,
                        }}
                        transition={{
                            duration: p.duration,
                            delay: 0.3 + p.delay,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                        style={{
                            position: 'absolute',
                            width: p.size,
                            height: p.size,
                            borderRadius: p.type === 'ring' ? '50%' : p.type === 'spark' ? 1 : '50%',
                            background: p.type === 'ring' ? 'transparent' : p.color,
                            border: p.type === 'ring' ? `1.5px solid ${p.color}` : 'none',
                            boxShadow: `0 0 ${p.size * 2}px ${p.color}60`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                );
            })}
        </div>
    );
}

// ── Radial burst lines ──

function BurstLines() {
    const lines = Array.from({ length: 16 }, (_, i) => i);
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            {lines.map((i) => {
                const angle = (360 / 16) * i;
                return (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: [0, 0.4, 0], scaleY: [0, 1, 0.3] }}
                        transition={{ duration: 1, delay: 0.15 + i * 0.02, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 1.5,
                            height: 60,
                            background: `linear-gradient(to top, transparent, rgba(200,169,96,0.5), transparent)`,
                            transformOrigin: 'bottom center',
                            transform: `translateX(-50%) rotate(${angle}deg) translateY(-50px)`,
                        }}
                    />
                );
            })}
        </div>
    );
}

// ── Main celebration component ──

export default function BadgeCelebration() {
    const { newlyEarnedBadge, dismissBadgeCelebration } = useGamification();
    const [badge, setBadge] = useState<Badge | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (newlyEarnedBadge) {
            const found = BADGES.find(b => b.id === newlyEarnedBadge);
            if (found) setBadge(found);
        }
    }, [newlyEarnedBadge]);

    useEffect(() => {
        if (!badge) return;
        timerRef.current = setTimeout(() => {
            handleDismiss();
        }, 6000);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [badge]);

    const handleDismiss = useCallback(() => {
        setBadge(null);
        setTimeout(() => dismissBadgeCelebration(), 500);
    }, [dismissBadgeCelebration]);

    return (
        <AnimatePresence>
            {badge && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    onClick={handleDismiss}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(4,4,6,0.85)',
                        backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                        cursor: 'pointer',
                    }}
                >
                    {/* CSS animations */}
                    <style>{`
                        @keyframes bc-shimmer {
                            0% { transform: translateX(-100%) rotate(-12deg); }
                            100% { transform: translateX(300%) rotate(-12deg); }
                        }
                        @keyframes bc-glow-pulse {
                            0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
                            50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.15); }
                        }
                        @keyframes bc-ring-expand {
                            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.8; }
                            100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
                        }
                        @keyframes bc-orbit {
                            0% { transform: rotate(0deg) translateX(90px) rotate(0deg); }
                            100% { transform: rotate(360deg) translateX(90px) rotate(-360deg); }
                        }
                    `}</style>

                    {/* Expanding ring pulse */}
                    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 120, height: 120, borderRadius: '50%', border: '2px solid rgba(200,169,96,0.3)', animation: 'bc-ring-expand 1.5s ease-out 0.2s both', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(94,234,212,0.2)', animation: 'bc-ring-expand 1.8s ease-out 0.5s both', pointerEvents: 'none' }} />

                    {/* Particle burst */}
                    <ParticleField />
                    <BurstLines />

                    {/* Main card */}
                    <motion.div
                        initial={{ scale: 0.3, y: 30, opacity: 0, rotateX: 40 }}
                        animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
                        exit={{ scale: 0.8, y: -40, opacity: 0, rotateX: -15 }}
                        transition={{
                            type: 'spring',
                            stiffness: 200,
                            damping: 18,
                            mass: 0.8,
                            delay: 0.1,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'relative',
                            zIndex: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '44px 52px 38px',
                            borderRadius: 28,
                            background: 'linear-gradient(165deg, rgba(24,22,30,0.95) 0%, rgba(14,13,18,0.98) 100%)',
                            border: '1px solid rgba(200,169,96,0.2)',
                            boxShadow: `
                                0 0 80px rgba(200,169,96,0.12),
                                0 0 160px rgba(200,169,96,0.06),
                                0 30px 80px rgba(0,0,0,0.6),
                                inset 0 1px 0 rgba(255,255,255,0.06)
                            `,
                            overflow: 'hidden',
                            maxWidth: 360,
                            width: '90vw',
                            perspective: 800,
                        }}
                    >
                        {/* Shimmer sweep across card */}
                        <div style={{
                            position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 28, pointerEvents: 'none',
                        }}>
                            <div style={{
                                position: 'absolute', top: -20, left: -60, width: 60, height: '140%',
                                background: 'linear-gradient(90deg, transparent, rgba(200,169,96,0.08), rgba(255,255,255,0.04), transparent)',
                                animation: 'bc-shimmer 2.5s ease 0.6s both',
                            }} />
                        </div>

                        {/* Ambient glow behind icon */}
                        <div style={{
                            position: 'absolute',
                            top: 40,
                            left: '50%',
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(200,169,96,0.25) 0%, rgba(200,169,96,0.05) 50%, transparent 70%)',
                            animation: 'bc-glow-pulse 2.5s ease-in-out infinite',
                            pointerEvents: 'none',
                        }} />

                        {/* Orbiting dots */}
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                position: 'absolute', top: 75, left: '50%', width: 4, height: 4,
                                marginLeft: -2, marginTop: -2, pointerEvents: 'none',
                            }}>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 0.6, 0.6, 0] }}
                                    transition={{ duration: 4, delay: 0.8 + i * 0.3, repeat: Infinity }}
                                    style={{
                                        width: 4, height: 4, borderRadius: '50%',
                                        background: i === 1 ? '#5eead4' : '#c8a960',
                                        boxShadow: `0 0 8px ${i === 1 ? '#5eead4' : '#c8a960'}60`,
                                        animation: `bc-orbit ${3 + i * 0.5}s linear ${0.8 + i * 0.4}s infinite`,
                                    }}
                                />
                            </div>
                        ))}

                        {/* "BADGE DEBLOQUE" label */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                letterSpacing: '0.22em',
                                textTransform: 'uppercase',
                                color: '#c8a960',
                                marginBottom: 20,
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            Badge d&eacute;bloqu&eacute;
                        </motion.div>

                        {/* Badge icon */}
                        <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 250,
                                damping: 14,
                                delay: 0.25,
                            }}
                            style={{
                                position: 'relative',
                                zIndex: 1,
                                width: 96,
                                height: 96,
                                borderRadius: 24,
                                background: 'linear-gradient(145deg, rgba(200,169,96,0.12), rgba(200,169,96,0.04))',
                                border: '1.5px solid rgba(200,169,96,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 48,
                                boxShadow: `
                                    0 0 40px rgba(200,169,96,0.1),
                                    inset 0 1px 0 rgba(255,255,255,0.08),
                                    inset 0 -1px 0 rgba(0,0,0,0.2)
                                `,
                                marginBottom: 24,
                            }}
                        >
                            {/* Inner glow ring */}
                            <div style={{
                                position: 'absolute', inset: 6, borderRadius: 18,
                                border: '1px solid rgba(200,169,96,0.1)',
                                pointerEvents: 'none',
                            }} />
                            <motion.span
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 12 }}
                            >
                                {badge.icon}
                            </motion.span>
                        </motion.div>

                        {/* Badge name */}
                        <motion.h2
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                color: '#ede9e3',
                                margin: 0,
                                marginBottom: 8,
                                letterSpacing: '-0.02em',
                                position: 'relative',
                                zIndex: 1,
                                textAlign: 'center',
                            }}
                        >
                            {badge.name}
                        </motion.h2>

                        {/* Badge description */}
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.65, duration: 0.5 }}
                            style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                color: 'rgba(237,233,227,0.45)',
                                margin: 0,
                                marginBottom: 28,
                                position: 'relative',
                                zIndex: 1,
                                textAlign: 'center',
                                lineHeight: 1.5,
                            }}
                        >
                            {badge.description}
                        </motion.p>

                        {/* Dismiss hint */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2, duration: 0.8 }}
                            style={{
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                color: 'rgba(237,233,227,0.18)',
                                letterSpacing: '0.06em',
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            Cliquer pour fermer
                        </motion.div>

                        {/* Bottom accent line */}
                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: '15%',
                                right: '15%',
                                height: 2,
                                background: 'linear-gradient(90deg, transparent, #c8a960, #5eead4, transparent)',
                                borderRadius: 1,
                                transformOrigin: 'center',
                            }}
                        />
                    </motion.div>

                    {/* Click anywhere to dismiss */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        style={{
                            position: 'absolute',
                            bottom: 40,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.7rem',
                            color: 'rgba(237,233,227,0.15)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Cliquer n&apos;importe o&ugrave; pour continuer
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
