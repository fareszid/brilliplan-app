'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useGamification } from '@/context/GamificationContext';

export default function XPToast() {
    const { showXPToast, dismissToast } = useGamification();

    useEffect(() => {
        if (!showXPToast) return;
        const timer = setTimeout(dismissToast, 3000);
        return () => clearTimeout(timer);
    }, [showXPToast, dismissToast]);

    return (
        <AnimatePresence>
            {showXPToast && (
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.35, type: 'spring', stiffness: 300, damping: 25 }}
                    style={{
                        position: 'fixed',
                        bottom: 28,
                        right: 28,
                        zIndex: 9998,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 20px',
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(94,234,212,0.12), rgba(94,234,212,0.04))',
                        border: '1px solid rgba(94,234,212,0.25)',
                        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(94,234,212,0.1)',
                        cursor: 'pointer',
                    }}
                    onClick={dismissToast}
                >
                    <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'rgba(94,234,212,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#5eead4',
                    }}>
                        <Zap size={16} />
                    </div>
                    <div>
                        <div style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1rem', fontWeight: 800,
                            color: '#5eead4', letterSpacing: '-0.01em',
                        }}>
                            +{showXPToast.amount} XP
                        </div>
                        <div style={{
                            fontSize: '0.72rem', color: 'rgba(237,233,227,0.45)',
                            fontWeight: 500,
                        }}>
                            {showXPToast.reason}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
