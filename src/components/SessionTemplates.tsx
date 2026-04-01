'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Zap, Clock, Play, Trash2, Plus, Bookmark, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SessionTemplate {
    id: string;
    name: string;
    objectiveId: string;
    objectiveTitle: string;
    duration: number; // in minutes
    color: string;
}

export default function SessionTemplates() {
    const { user } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<SessionTemplate[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const ref = doc(db, 'users', user.uid);
            const snap = await getDoc(ref);
            if (snap.exists() && snap.data().session_templates) {
                setTemplates(snap.data().session_templates);
            }
            setLoaded(true);
        };
        load();
    }, [user]);

    const saveTemplates = async (updated: SessionTemplate[]) => {
        if (!user) return;
        setTemplates(updated);
        await setDoc(doc(db, 'users', user.uid), { session_templates: updated }, { merge: true });
    };

    const removeTemplate = (id: string) => {
        saveTemplates(templates.filter(t => t.id !== id));
    };

    const launchTemplate = (template: SessionTemplate) => {
        router.push(`/session?id=${template.objectiveId}`);
    };

    if (!loaded || templates.length === 0) return null;

    return (
        <div style={{
            background: 'rgba(19,19,22,0.6)',
            border: '1px solid rgba(237,233,227,0.06)',
            borderRadius: 18, padding: '1.25rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.85rem' }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#a78bfa' }} />
                <h2 style={{
                    fontSize: '0.78rem', fontWeight: 700,
                    color: 'rgba(237,233,227,0.35)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, flex: 1,
                }}>
                    Mes routines
                </h2>
                <Bookmark size={12} style={{ color: 'rgba(255,255,255,0.12)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {templates.slice(0, 5).map(tmpl => (
                    <div
                        key={tmpl.id}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            transition: 'all 0.15s',
                            cursor: 'pointer',
                        }}
                        onClick={() => launchTemplate(tmpl)}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${tmpl.color || '#a78bfa'}30`; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: tmpl.color || '#a78bfa', flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: '0.8rem', fontWeight: 600,
                                color: 'rgba(237,233,227,0.65)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {tmpl.name}
                            </div>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(237,233,227,0.2)' }}>
                                {tmpl.duration}min · {tmpl.objectiveTitle}
                            </div>
                        </div>
                        <div style={{
                            width: 24, height: 24, borderRadius: 7,
                            background: `${tmpl.color || '#a78bfa'}12`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Play size={10} style={{ color: tmpl.color || '#a78bfa', fill: tmpl.color || '#a78bfa', marginLeft: 1 }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Utility to save a session as template (call from session page)
export async function saveSessionAsTemplate(
    uid: string,
    template: Omit<SessionTemplate, 'id'>
) {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const existing: SessionTemplate[] = snap.exists() ? (snap.data().session_templates || []) : [];
    if (existing.length >= 5) return false;
    const newTemplate: SessionTemplate = { ...template, id: Date.now().toString() };
    await setDoc(ref, { session_templates: [...existing, newTemplate] }, { merge: true });
    return true;
}
