'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Timer, Flame, Trophy, X, Zap } from 'lucide-react';

interface SessionRecapProps {
    duration: number;
    pomodoros: number;
    title: string;
    type: 'objective' | 'project';
    xpEarned?: number;
    onClose: () => void;
}

function formatDuration(hours: number): { h: number; m: number } {
    const totalMinutes = Math.round(hours * 60);
    return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

function getMotivation(hours: number): string {
    if (hours < 0.5) return 'Bon début !';
    if (hours < 1) return 'Belle session !';
    if (hours < 2) return 'Impressionnant !';
    return 'Session légendaire !';
}

const PARTICLE_COUNT = 18;

export default function SessionRecap({ duration, pomodoros, title, type, xpEarned, onClose }: SessionRecapProps) {
    const [showStats, setShowStats] = useState(false);
    const [showXp, setShowXp] = useState(false);
    const { h, m } = formatDuration(duration);
    const motivation = getMotivation(duration);

    useEffect(() => {
        const t1 = setTimeout(() => setShowStats(true), 500);
        const t2 = setTimeout(() => setShowXp(true), 1000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    // Generate stable particle configs
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: `${(i * 37 + 13) % 100}%`,
        size: 4 + (i % 4) * 2,
        delay: (i * 0.3) % 4,
        dur: 3 + (i % 3) * 1.5,
        color: i % 3 === 0 ? '#c8a960' : i % 3 === 1 ? '#5eead4' : 'rgba(237,233,227,0.3)',
    }));

    return (
        <>
            <style>{`
                @keyframes sr-float {
                    0%   { transform: translateY(0) scale(1); opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
                }
                @keyframes sr-glow-pulse {
                    0%, 100% { box-shadow: 0 0 30px rgba(200,169,96,0.15), 0 0 60px rgba(200,169,96,0.05); }
                    50%      { box-shadow: 0 0 50px rgba(200,169,96,0.3), 0 0 100px rgba(200,169,96,0.1); }
                }
                @keyframes sr-xp-glow {
                    0%, 100% { text-shadow: 0 0 8px rgba(94,234,212,0.4); }
                    50%      { text-shadow: 0 0 20px rgba(94,234,212,0.8), 0 0 40px rgba(94,234,212,0.3); }
                }
                @keyframes sr-shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .sr-overlay {
                    position: fixed; inset: 0; z-index: 9999;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(11,11,13,0.92);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
                .sr-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
                .sr-particle {
                    position: absolute; bottom: -20px; border-radius: 50%;
                    animation: sr-float linear infinite;
                }
                .sr-card {
                    position: relative; z-index: 1;
                    width: 90%; max-width: 480px;
                    background: linear-gradient(170deg, rgba(30,28,24,0.95), rgba(16,15,14,0.98));
                    border: 1px solid rgba(200,169,96,0.25);
                    border-radius: 24px;
                    padding: 48px 36px 36px;
                    text-align: center;
                    animation: sr-glow-pulse 3s ease-in-out infinite;
                }
                .sr-close {
                    position: absolute; top: 16px; right: 16px;
                    background: none; border: none; cursor: pointer;
                    color: rgba(237,233,227,0.4);
                    transition: color 0.2s;
                    padding: 4px;
                }
                .sr-close:hover { color: #ede9e3; }
                .sr-trophy { color: #c8a960; margin-bottom: 8px; }
                .sr-motivation {
                    font-family: var(--font-display), 'Bricolage Grotesque', sans-serif;
                    font-size: 1.1rem; font-weight: 600;
                    color: #c8a960; letter-spacing: 0.02em;
                    margin-bottom: 24px;
                    background: linear-gradient(90deg, #c8a960 0%, #e8d5a0 50%, #c8a960 100%);
                    background-size: 200% auto;
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: sr-shimmer 3s linear infinite;
                }
                .sr-duration {
                    font-family: var(--font-display), 'Bricolage Grotesque', sans-serif;
                    font-size: 3.5rem; font-weight: 800;
                    color: #ede9e3; line-height: 1.1;
                    margin-bottom: 6px; letter-spacing: -0.02em;
                }
                .sr-duration-unit {
                    font-size: 2rem; font-weight: 500;
                    color: rgba(237,233,227,0.6);
                }
                .sr-label {
                    font-family: 'Figtree', sans-serif;
                    font-size: 0.85rem; color: rgba(237,233,227,0.45);
                    text-transform: uppercase; letter-spacing: 0.08em;
                    margin-bottom: 28px;
                }
                .sr-stats {
                    display: flex; justify-content: center; gap: 16px;
                    margin-bottom: 24px; flex-wrap: wrap;
                }
                .sr-stat {
                    display: flex; align-items: center; gap: 8px;
                    background: rgba(200,169,96,0.08);
                    border: 1px solid rgba(200,169,96,0.12);
                    border-radius: 12px; padding: 10px 18px;
                    font-family: 'Figtree', sans-serif;
                    font-size: 0.9rem; color: #ede9e3;
                }
                .sr-stat-icon { color: #c8a960; flex-shrink: 0; }
                .sr-badge {
                    display: inline-flex; align-items: center; gap: 6px;
                    background: rgba(94,234,212,0.08);
                    border: 1px solid rgba(94,234,212,0.15);
                    border-radius: 12px; padding: 10px 18px;
                    font-size: 0.9rem; color: #5eead4;
                }
                .sr-title {
                    font-family: var(--font-display), 'Bricolage Grotesque', sans-serif;
                    font-size: 1.15rem; font-weight: 600;
                    color: rgba(237,233,227,0.85);
                    margin-bottom: 20px;
                    max-width: 100%;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .sr-xp {
                    font-family: var(--font-display), 'Bricolage Grotesque', sans-serif;
                    font-size: 1.5rem; font-weight: 700;
                    color: #5eead4;
                    margin-bottom: 24px;
                    animation: sr-xp-glow 2s ease-in-out infinite;
                }
                .sr-xp-icon { display: inline-block; vertical-align: middle; margin-right: 6px; }
                .sr-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    background: linear-gradient(135deg, #c8a960, #a68940);
                    color: #0b0b0d; border: none; border-radius: 14px;
                    padding: 14px 48px; font-family: 'Figtree', sans-serif;
                    font-size: 0.95rem; font-weight: 700; cursor: pointer;
                    transition: transform 0.15s, box-shadow 0.2s;
                    letter-spacing: 0.02em;
                }
                .sr-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 24px rgba(200,169,96,0.35);
                }
                .sr-btn:active { transform: translateY(0); }
                .sr-divider {
                    width: 48px; height: 2px; margin: 0 auto 20px;
                    background: linear-gradient(90deg, transparent, rgba(200,169,96,0.4), transparent);
                    border-radius: 1px;
                }
            `}</style>

            <div className="sr-overlay" onClick={onClose}>
                {/* Particles */}
                <div className="sr-particles">
                    {particles.map((p, i) => (
                        <div
                            key={i}
                            className="sr-particle"
                            style={{
                                left: p.left,
                                width: p.size,
                                height: p.size,
                                background: p.color,
                                animationDelay: `${p.delay}s`,
                                animationDuration: `${p.dur}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Card */}
                <motion.div
                    className="sr-card"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="sr-close" onClick={onClose} aria-label="Fermer">
                        <X size={20} />
                    </button>

                    {/* Trophy */}
                    <motion.div
                        className="sr-trophy"
                        initial={{ opacity: 0, scale: 0, rotate: -20 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
                    >
                        <Trophy size={40} />
                    </motion.div>

                    {/* Motivation */}
                    <motion.div
                        className="sr-motivation"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.4 }}
                    >
                        {motivation}
                    </motion.div>

                    {/* Duration */}
                    <motion.div
                        className="sr-duration"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 150 }}
                    >
                        {h > 0 && <>{h}<span className="sr-duration-unit">h</span> </>}
                        {m}<span className="sr-duration-unit">min</span>
                    </motion.div>

                    <div className="sr-label">Temps de concentration</div>

                    {/* Stats row */}
                    {showStats && (
                        <div className="sr-stats">
                            <motion.div
                                className="sr-stat"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35 }}
                            >
                                <Flame size={18} className="sr-stat-icon" />
                                <span>{pomodoros} pomodoro{pomodoros !== 1 ? 's' : ''}</span>
                            </motion.div>

                            <motion.div
                                className="sr-badge"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: 0.1 }}
                            >
                                <Timer size={16} />
                                <span>{type === 'objective' ? 'Objectif' : 'Projet'}</span>
                            </motion.div>
                        </div>
                    )}

                    {/* Title */}
                    {showStats && (
                        <motion.div
                            className="sr-title"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.15 }}
                            title={title}
                        >
                            {title}
                        </motion.div>
                    )}

                    <div className="sr-divider" />

                    {/* XP */}
                    {showXp && xpEarned != null && xpEarned > 0 && (
                        <motion.div
                            className="sr-xp"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.45, type: 'spring', stiffness: 180 }}
                        >
                            <Zap size={22} className="sr-xp-icon" />
                            +{xpEarned} XP
                        </motion.div>
                    )}

                    {/* Close button */}
                    <motion.button
                        className="sr-btn"
                        onClick={onClose}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: showXp ? 1 : 0, y: showXp ? 0 : 10 }}
                        transition={{ duration: 0.35, delay: 0.1 }}
                    >
                        Fermer
                    </motion.button>
                </motion.div>
            </div>
        </>
    );
}
