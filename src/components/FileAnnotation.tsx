'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, X, Check, CheckCheck, Send, Reply, Trash2, MoreHorizontal,
    ZoomIn, ZoomOut, RotateCcw, MousePointer2, Plus, ChevronDown, ChevronRight,
    Eye, EyeOff, FileImage, FileText, Edit3, ArrowLeft, ArrowRight, Loader2, RotateCw, Download
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface AnnotationReply {
    uid: string;
    user_name: string;
    avatar_url?: string;
    avatar_style?: string;
    text: string;
    created_at: any;
}

interface Annotation {
    id: string;
    file_id: string;
    x: number;
    y: number;
    page: number;
    text: string;
    resolved: boolean;
    created_by: string;
    created_by_name: string;
    avatar_url?: string;
    avatar_style?: string;
    created_at: any;
    replies: AnnotationReply[];
}

interface AnnotatableFile {
    id: string;
    title: string;
    url: string;
    file_name?: string;
    type: 'image' | 'pdf';
}

interface FileAnnotationOverlayProps {
    parentType: 'objectives' | 'projects';
    parentId: string;
    file: AnnotatableFile;
    memberships: { user_id: string; user?: { full_name?: string; avatar_url?: string; avatar_style?: string } }[];
    onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (ts: any): string => {
    if (!ts) return '';
    const d = ts?.toDate?.() ?? new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ── Pin ──────────────────────────────────────────────────────────────────────

function AnnotationPin({ annotation, index, isActive, isHovered, onClick, onHover, onLeave, annotating }: {
    annotation: Annotation; index: number; isActive: boolean; isHovered: boolean;
    onClick: () => void; onHover: () => void; onLeave: () => void; annotating: boolean;
}) {
    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={(e) => { e.stopPropagation(); if (!annotating) onClick(); }}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            style={{
                position: 'absolute',
                left: `${annotation.x}%`,
                top: `${annotation.y}%`,
                transform: 'translate(-50%, -100%)',
                zIndex: isActive ? 100 : isHovered ? 90 : 10,
                cursor: annotating ? 'crosshair' : 'pointer',
                filter: annotation.resolved ? 'saturate(0.3) opacity(0.5)' : 'none',
                pointerEvents: annotating ? 'none' : 'auto',
            }}
        >
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {isActive && !annotation.resolved && (
                    <motion.div
                        animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'rgba(200,169,96,0.3)',
                        }}
                    />
                )}
                <div style={{
                    width: isActive ? 32 : 28, height: isActive ? 32 : 28,
                    borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
                    background: annotation.resolved ? 'linear-gradient(135deg, #374151, #4b5563)'
                        : isActive ? 'linear-gradient(135deg, #c8a960, #8b5cf6)'
                        : 'linear-gradient(135deg, #b89a50, #b89a50)',
                    boxShadow: isActive ? '0 4px 20px rgba(200,169,96,0.5), 0 0 0 3px rgba(200,169,96,0.2)' : '0 2px 10px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', border: '2px solid rgba(255,255,255,0.2)',
                }}>
                    <span style={{ transform: 'rotate(45deg)', fontSize: '0.7rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                        {annotation.resolved ? <Check size={12} /> : index + 1}
                    </span>
                </div>
                <div style={{ width: 6, height: 3, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', marginTop: 2 }} />
            </div>
            <AnimatePresence>
                {isHovered && !isActive && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        style={{
                            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                            marginTop: 8, background: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                            padding: '8px 12px', maxWidth: 220, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.8)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', pointerEvents: 'none',
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{annotation.created_by_name}</div>
                        <div style={{ opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{annotation.text}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Comment Thread ───────────────────────────────────────────────────────────

function CommentThread({ annotation, onClose, onResolve, onDelete, onReply, currentUid }: {
    annotation: Annotation; onClose: () => void; onResolve: () => void;
    onDelete: () => void; onReply: (text: string) => void; currentUid: string;
}) {
    const [replyText, setReplyText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const threadRef = useRef<HTMLDivElement>(null);
    const isOwner = annotation.created_by === currentUid;

    const handleSubmit = () => {
        if (!replyText.trim()) return;
        onReply(replyText.trim());
        setReplyText('');
    };

    useEffect(() => {
        if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }, [annotation.replies?.length]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
                position: 'fixed', zIndex: 10010,
                top: '50%', right: 20, transform: 'translateY(-50%)',
                width: 340,
                background: 'rgba(12,12,22,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,169,96,0.1)',
                overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(200,169,96,0.05)', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar avatarUrl={annotation.avatar_url} avatarStyle={annotation.avatar_style} size={24} />
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ede9e3' }}>{annotation.created_by_name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>{fmtTime(annotation.created_at)}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={onResolve} title={annotation.resolved ? 'Rouvrir' : 'Résoudre'} style={{
                        background: annotation.resolved ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid', borderColor: annotation.resolved ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem',
                        color: annotation.resolved ? '#34d399' : 'rgba(255,255,255,0.5)', transition: 'all 0.15s',
                    }}>
                        {annotation.resolved ? <CheckCheck size={12} /> : <Check size={12} />}
                        {annotation.resolved ? 'Résolu' : 'Résoudre'}
                    </button>
                    {isOwner && (
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowMenu(!showMenu)} style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8, padding: 4, cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex',
                            }}><MoreHorizontal size={14} /></button>
                            {showMenu && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                    background: 'rgba(20,20,35,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 10, padding: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10,
                                }}>
                                    <button onClick={() => { setShowMenu(false); onDelete(); }} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                                        color: '#ef4444', fontSize: '0.78rem', padding: '8px 12px', borderRadius: 8,
                                        cursor: 'pointer', width: '100%', fontFamily: 'inherit',
                                    }}><Trash2 size={13} /> Supprimer</button>
                                </div>
                            )}
                        </div>
                    )}
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: 4, cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex',
                    }}><X size={14} /></button>
                </div>
            </div>

            {/* Main comment */}
            <div style={{
                padding: '12px 14px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.6, borderBottom: annotation.replies?.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                flexShrink: 0,
            }}>{annotation.text}</div>

            {/* Replies */}
            {annotation.replies?.length > 0 && (
                <div ref={threadRef} style={{
                    flex: 1, overflowY: 'auto', minHeight: 0,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                    {annotation.replies.map((reply, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 8, padding: '10px 14px',
                            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                        }}>
                            <Avatar avatarUrl={reply.avatar_url} avatarStyle={reply.avatar_style} size={20} style={{ marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ede9e3' }}>{reply.user_name}</span>
                                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>{fmtTime(reply.created_at)}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginTop: 2 }}>{reply.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reply input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    placeholder="Répondre..."
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, padding: '8px 12px', fontSize: '0.78rem', color: '#ede9e3',
                        outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(200,169,96,0.4)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
                <button onClick={handleSubmit} disabled={!replyText.trim()} style={{
                    background: replyText.trim() ? 'linear-gradient(135deg, #c8a960, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                    border: 'none', borderRadius: 10, padding: 8,
                    cursor: replyText.trim() ? 'pointer' : 'default',
                    color: replyText.trim() ? '#fff' : 'rgba(255,255,255,0.2)', display: 'flex', transition: 'all 0.15s',
                }}><Send size={14} /></button>
            </div>
        </motion.div>
    );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function AnnotationSidebar({ annotations, activeId, onSelect }: {
    annotations: Annotation[]; activeId: string | null;
    onSelect: (id: string) => void;
}) {
    const open = annotations.filter(a => !a.resolved);
    const resolved = annotations.filter(a => a.resolved);
    const [expandResolved, setExpandResolved] = useState(false);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageCircle size={15} style={{ color: '#d4b872' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ede9e3' }}>Annotations</span>
                    <span style={{
                        fontSize: '0.65rem', background: 'rgba(200,169,96,0.15)', color: '#d4b872',
                        padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                    }}>{open.length}</span>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {open.length === 0 && resolved.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>
                        <MessageCircle size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                        <div>Aucune annotation</div>
                        <div style={{ fontSize: '0.7rem', marginTop: 4, opacity: 0.6 }}>
                            Passez en mode Annoter puis cliquez sur le document
                        </div>
                    </div>
                )}
                {open.map((a, i) => (
                    <button key={a.id} onClick={() => onSelect(a.id)} style={{
                        display: 'flex', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10,
                        border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        transition: 'all 0.15s', marginBottom: 2,
                        background: activeId === a.id ? 'linear-gradient(135deg, rgba(200,169,96,0.15), rgba(200,169,96,0.08))' : 'transparent',
                        boxShadow: activeId === a.id ? '0 0 0 1px rgba(200,169,96,0.2)' : 'none',
                    }}>
                        <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #b89a50, #b89a50)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1,
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ede9e3' }}>{a.created_by_name}</span>
                                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>{fmtTime(a.created_at)}</span>
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</div>
                            {a.replies?.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.65rem', color: 'rgba(165,180,252,0.6)' }}>
                                    <Reply size={10} /> {a.replies.length} réponse{a.replies.length > 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                    </button>
                ))}
                {resolved.length > 0 && (
                    <>
                        <button onClick={() => setExpandResolved(!expandResolved)} style={{
                            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                            padding: '8px 12px', marginTop: 8, background: 'none', border: 'none',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600,
                            color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{expandResolved ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Résolus ({resolved.length})</button>
                        {expandResolved && resolved.map((a) => (
                            <button key={a.id} onClick={() => onSelect(a.id)} style={{
                                display: 'flex', gap: 10, width: '100%', padding: '8px 12px',
                                borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                                fontFamily: 'inherit', opacity: 0.5, transition: 'all 0.15s', marginBottom: 2,
                                background: activeId === a.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                            }}>
                                <div style={{
                                    width: 24, height: 24, borderRadius: '50%', background: 'rgba(16,185,129,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}><Check size={12} style={{ color: '#34d399' }} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ede9e3', marginBottom: 2 }}>{a.created_by_name}</div>
                                    <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>{a.text}</div>
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

// ── New Annotation Input ─────────────────────────────────────────────────────

function NewAnnotationInput({ x, y, containerRect, onSubmit, onCancel }: {
    x: number; y: number; containerRect: DOMRect | null;
    onSubmit: (text: string) => void; onCancel: () => void;
}) {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={e => e.stopPropagation()}
            style={{
                position: 'absolute',
                left: `${Math.min(x, 60)}%`,
                top: `${y}%`,
                marginTop: 12,
                width: 300, zIndex: 300,
                background: 'rgba(12,12,22,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(200,169,96,0.3)', borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(200,169,96,0.1)',
                overflow: 'hidden',
            }}
        >
            <div style={{
                padding: '8px 12px', background: 'rgba(200,169,96,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: '#d4b872',
            }}><Plus size={12} /><span style={{ fontWeight: 600 }}>Nouvelle annotation</span></div>
            <div style={{ padding: 12 }}>
                <textarea
                    ref={inputRef} value={text} onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (text.trim()) onSubmit(text.trim()); }
                        if (e.key === 'Escape') onCancel();
                    }}
                    placeholder="Votre commentaire..."
                    rows={3}
                    style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                        padding: '10px 12px', fontSize: '0.8rem', color: '#ede9e3',
                        outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>Cmd+Entrée pour envoyer</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={onCancel} style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8, padding: '6px 14px', fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Annuler</button>
                        <button onClick={() => { if (text.trim()) onSubmit(text.trim()); }} disabled={!text.trim()} style={{
                            background: text.trim() ? 'linear-gradient(135deg, #c8a960, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                            border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600,
                            color: text.trim() ? '#fff' : 'rgba(255,255,255,0.2)',
                            cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}>Commenter</button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Overlay ─────────────────────────────────────────────────────────────

export default function FileAnnotationOverlay({ parentType, parentId, file, memberships, onClose }: FileAnnotationOverlayProps) {
    const { user } = useAuth();
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
    const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
    const [mode, setMode] = useState<'view' | 'annotate'>('view');
    const [newPin, setNewPin] = useState<{ x: number; y: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [rotation, setRotation] = useState(0);
    const [pinsVisible, setPinsVisible] = useState(true);
    const [pdfPage, setPdfPage] = useState(1);
    const [pdfTotalPages, setPdfTotalPages] = useState(0);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfPageImages, setPdfPageImages] = useState<Record<number, string>>({});
    const imageContainerRef = useRef<HTMLDivElement>(null);

    const currentUserInfo = useMemo(() => {
        const m = memberships.find(m => m.user_id === user?.uid);
        return {
            name: m?.user?.full_name || user?.email || 'Anonyme',
            avatar_url: m?.user?.avatar_url,
            avatar_style: m?.user?.avatar_style,
        };
    }, [memberships, user]);

    // Firestore real-time
    useEffect(() => {
        if (!parentId || !file.id) return;
        const q = query(collection(db, parentType, parentId, 'annotations'), orderBy('created_at', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setAnnotations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Annotation)).filter(a => a.file_id === file.id));
        });
        return () => unsub();
    }, [parentType, parentId, file.id]);

    // Close on Escape
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (newPin) setNewPin(null);
                else if (activeAnnotation) setActiveAnnotation(null);
                else if (mode === 'annotate') setMode('view');
                else onClose();
            }
        };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [newPin, activeAnnotation, mode, onClose]);

    // PDF rendering with pdfjs-dist
    useEffect(() => {
        if (file.type !== 'pdf') return;
        let cancelled = false;
        const renderPdf = async () => {
            setPdfLoading(true);
            try {
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
                const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(file.url)}`;
                const loadingTask = pdfjsLib.getDocument(proxyUrl);
                const pdf = await loadingTask.promise;
                if (cancelled) return;
                setPdfTotalPages(pdf.numPages);
                // Render current page
                const page = await pdf.getPage(pdfPage);
                const scale = 2; // high-res
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d')!;
                await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
                if (cancelled) return;
                const dataUrl = canvas.toDataURL('image/png');
                setPdfPageImages(prev => ({ ...prev, [pdfPage]: dataUrl }));
            } catch (err) {
                console.error('PDF render error:', err);
            } finally {
                if (!cancelled) setPdfLoading(false);
            }
        };
        renderPdf();
        return () => { cancelled = true; };
    }, [file.url, file.type, pdfPage]);

    const handleViewerClick = useCallback((e: React.MouseEvent) => {
        if (mode !== 'annotate' || !imageContainerRef.current) return;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        if (x < 0 || x > 100 || y < 0 || y > 100) return;
        setNewPin({ x, y });
        setActiveAnnotation(null);
    }, [mode]);

    const handleCreate = useCallback(async (text: string) => {
        if (!newPin || !user) return;
        await addDoc(collection(db, parentType, parentId, 'annotations'), {
            file_id: file.id, x: newPin.x, y: newPin.y, page: 0,
            text, resolved: false,
            created_by: user.uid, created_by_name: currentUserInfo.name,
            avatar_url: currentUserInfo.avatar_url || '', avatar_style: currentUserInfo.avatar_style || '1',
            created_at: serverTimestamp(), replies: [],
        });
        setNewPin(null);
        setMode('view');
    }, [newPin, user, file.id, parentType, parentId, currentUserInfo]);

    const handleResolve = useCallback(async (id: string) => {
        const a = annotations.find(a => a.id === id);
        if (a) await updateDoc(doc(db, parentType, parentId, 'annotations', id), { resolved: !a.resolved });
    }, [annotations, parentType, parentId]);

    const handleDelete = useCallback(async (id: string) => {
        await deleteDoc(doc(db, parentType, parentId, 'annotations', id));
        setActiveAnnotation(null);
    }, [parentType, parentId]);

    const handleReply = useCallback(async (id: string, text: string) => {
        if (!user) return;
        const a = annotations.find(a => a.id === id);
        if (!a) return;
        await updateDoc(doc(db, parentType, parentId, 'annotations', id), {
            replies: [...(a.replies || []), {
                uid: user.uid, user_name: currentUserInfo.name,
                avatar_url: currentUserInfo.avatar_url, avatar_style: currentUserInfo.avatar_style,
                text, created_at: new Date(),
            }],
        });
    }, [user, annotations, parentType, parentId, currentUserInfo]);

    const visibleAnnotations = annotations;
    const openCount = useMemo(() => annotations.filter(a => !a.resolved).length, [annotations]);

    const isPdf = file.type === 'pdf';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', flexDirection: 'column',
            }}
        >
            {/* ── Top toolbar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(12,12,20,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit',
                    }}><X size={14} /> Fermer</button>
                    <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
                    {isPdf ? <FileText size={15} style={{ color: '#d4b872' }} /> : <FileImage size={15} style={{ color: '#d4b872' }} />}
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                        {file.title || file.file_name || 'Fichier'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Zoom */}
                    <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} style={tbtn}><ZoomOut size={14} /></button>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} style={tbtn}><ZoomIn size={14} /></button>
                    <button onClick={() => setRotation(r => (r + 90) % 360)} style={tbtn} title="Pivoter"><RotateCw size={13} /></button>
                    <button onClick={async () => {
                        try {
                            const res = await fetch(`/api/proxy-file?url=${encodeURIComponent(file.url)}`);
                            const blob = await res.blob();
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = file.file_name || file.title || 'fichier';
                            a.click();
                            URL.revokeObjectURL(a.href);
                        } catch { window.open(file.url, '_blank'); }
                    }} style={tbtn} title="Télécharger"><Download size={13} /></button>

                    {/* PDF page navigation */}
                    {isPdf && pdfTotalPages > 0 && (
                        <>
                            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
                            <button onClick={() => setPdfPage(p => Math.max(1, p - 1))} disabled={pdfPage <= 1} style={{ ...tbtn, opacity: pdfPage <= 1 ? 0.3 : 1 }}><ArrowLeft size={13} /></button>
                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', minWidth: 50, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                {pdfPage} / {pdfTotalPages}
                            </span>
                            <button onClick={() => setPdfPage(p => Math.min(pdfTotalPages, p + 1))} disabled={pdfPage >= pdfTotalPages} style={{ ...tbtn, opacity: pdfPage >= pdfTotalPages ? 0.3 : 1 }}><ArrowRight size={13} /></button>
                        </>
                    )}

                    <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

                    {/* Mode toggle */}
                    <div style={{
                        display: 'flex', background: 'rgba(255,255,255,0.04)',
                        borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: 2,
                    }}>
                        <button onClick={() => { setMode('view'); setNewPin(null); }} style={{
                            ...tbtn, background: mode === 'view' ? 'rgba(200,169,96,0.2)' : 'transparent',
                            color: mode === 'view' ? '#d4b872' : 'rgba(255,255,255,0.35)',
                            borderRadius: 6, padding: '4px 10px', gap: 5, fontWeight: mode === 'view' ? 600 : 400,
                        }}><MousePointer2 size={12} /> Voir</button>
                        <button onClick={() => setMode('annotate')} style={{
                            ...tbtn, background: mode === 'annotate' ? 'rgba(200,169,96,0.2)' : 'transparent',
                            color: mode === 'annotate' ? '#d4b872' : 'rgba(255,255,255,0.35)',
                            borderRadius: 6, padding: '4px 10px', gap: 5, fontWeight: mode === 'annotate' ? 600 : 400,
                        }}><Plus size={12} /> Annoter</button>
                    </div>

                    <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
                    <button onClick={() => setPinsVisible(!pinsVisible)} style={{
                        ...tbtn, color: pinsVisible ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', gap: 4,
                    }} title={pinsVisible ? 'Masquer les annotations' : 'Afficher les annotations'}>
                        {pinsVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                        ...tbtn, background: sidebarOpen ? 'rgba(200,169,96,0.12)' : 'transparent',
                        color: sidebarOpen ? '#d4b872' : 'rgba(255,255,255,0.35)', gap: 4,
                    }}>
                        <MessageCircle size={13} />
                        {openCount > 0 && (
                            <span style={{
                                fontSize: '0.55rem', background: '#c8a960', color: '#fff',
                                borderRadius: 10, padding: '0 4px', fontWeight: 700, lineHeight: '14px',
                            }}>{openCount}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                {/* Viewer */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        display: 'flex',
                        alignItems: zoom <= 1 ? 'center' : 'flex-start',
                        justifyContent: 'center',
                        padding: 24,
                        cursor: mode === 'annotate' ? 'crosshair' : 'default',
                    }}
                >
                    {/* Annotate mode banner */}
                    <AnimatePresence>
                        {mode === 'annotate' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                style={{
                                    position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
                                    zIndex: 100, display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'rgba(200,169,96,0.15)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(200,169,96,0.3)', borderRadius: 10,
                                    padding: '6px 14px', fontSize: '0.73rem', color: '#ede9e3', fontWeight: 500,
                                }}
                            >
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a960' }} />
                                Cliquez sur le document pour placer une annotation
                                <button onClick={() => { setMode('view'); setNewPin(null); }} style={{
                                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
                                    padding: '2px 8px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                }}>Esc</button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Document + annotations */}
                    <div
                        ref={imageContainerRef}
                        onClick={handleViewerClick}
                        style={{
                            position: 'relative',
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.25s ease-out',
                            flexShrink: 0,
                        }}
                    >
                        {/* File display */}
                        {isPdf ? (
                            pdfLoading && !pdfPageImages[pdfPage] ? (
                                <div style={{
                                    width: 700, height: 900,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: 12,
                                    background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <Loader2 size={28} style={{ color: '#d4b872', animation: 'spin 1s linear infinite' }} />
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Chargement de la page {pdfPage}...</span>
                                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                </div>
                            ) : pdfPageImages[pdfPage] ? (
                                <img
                                    src={pdfPageImages[pdfPage]}
                                    alt={`Page ${pdfPage}`}
                                    style={{
                                        maxWidth: '80vw',
                                        maxHeight: '80vh',
                                        objectFit: 'contain',
                                        borderRadius: 6,
                                        boxShadow: '0 4px 40px rgba(0,0,0,0.4)',
                                        display: 'block',
                                        userSelect: 'none',
                                        background: '#fff',
                                    }}
                                    draggable={false}
                                />
                            ) : (
                                <div style={{
                                    width: 700, height: 900,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: 12,
                                    background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                                }}>
                                    <FileText size={32} style={{ color: 'rgba(255,255,255,0.3)' }} />
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                                        Impossible de charger le PDF
                                    </span>
                                    <a href={file.url} target="_blank" rel="noopener noreferrer" style={{
                                        color: '#d4b872', fontSize: '0.82rem', textDecoration: 'underline',
                                    }}>Ouvrir dans un nouvel onglet</a>
                                </div>
                            )
                        ) : (
                            <img
                                src={file.url}
                                alt={file.title}
                                style={{
                                    maxWidth: '80vw',
                                    maxHeight: '80vh',
                                    objectFit: 'contain',
                                    borderRadius: 6,
                                    boxShadow: '0 4px 40px rgba(0,0,0,0.4)',
                                    display: 'block',
                                    userSelect: 'none',
                                }}
                                draggable={false}
                            />
                        )}

                        {/* Annotation pins */}
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: mode === 'annotate' ? 'none' : 'auto' }}>
                            <AnimatePresence>
                                {pinsVisible && visibleAnnotations.map((a, i) => (
                                    <AnnotationPin
                                        key={a.id} annotation={a} index={i}
                                        isActive={activeAnnotation === a.id}
                                        isHovered={hoveredAnnotation === a.id}
                                        onClick={() => setActiveAnnotation(activeAnnotation === a.id ? null : a.id)}
                                        onHover={() => setHoveredAnnotation(a.id)}
                                        onLeave={() => setHoveredAnnotation(null)}
                                        annotating={mode === 'annotate'}
                                    />
                                ))}
                            </AnimatePresence>

                            {/* New pin being placed */}
                            {newPin && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{
                                    position: 'absolute', left: `${newPin.x}%`, top: `${newPin.y}%`,
                                    transform: 'translate(-50%, -100%)', zIndex: 200,
                                }}>
                                    <div style={{
                                        width: 30, height: 30, borderRadius: '50% 50% 50% 0',
                                        transform: 'rotate(-45deg)',
                                        background: 'linear-gradient(135deg, #c8a960, #5eead4)',
                                        boxShadow: '0 0 20px rgba(200,169,96,0.5)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '2px solid rgba(255,255,255,0.4)',
                                    }}><Plus size={12} style={{ transform: 'rotate(45deg)', color: '#fff' }} /></div>
                                </motion.div>
                            )}
                        </div>

                        {/* New annotation form */}
                        <AnimatePresence>
                            {newPin && (
                                <NewAnnotationInput
                                    x={newPin.x} y={newPin.y}
                                    containerRect={imageContainerRef.current?.getBoundingClientRect() || null}
                                    onSubmit={handleCreate}
                                    onCancel={() => setNewPin(null)}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Sidebar */}
                <AnimatePresence>
                    {sidebarOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            style={{
                                borderLeft: '1px solid rgba(255,255,255,0.06)',
                                overflow: 'hidden', flexShrink: 0,
                                background: 'rgba(11,11,13,0.8)',
                            }}
                        >
                            <AnnotationSidebar
                                annotations={annotations} activeId={activeAnnotation}
                                onSelect={id => setActiveAnnotation(activeAnnotation === id ? null : id)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Active comment thread */}
            <AnimatePresence>
                {activeAnnotation && (() => {
                    const a = annotations.find(a => a.id === activeAnnotation);
                    if (!a) return null;
                    return (
                        <CommentThread
                            key={a.id} annotation={a}
                            onClose={() => setActiveAnnotation(null)}
                            onResolve={() => handleResolve(a.id)}
                            onDelete={() => handleDelete(a.id)}
                            onReply={(text) => handleReply(a.id, text)}
                            currentUid={user?.uid || ''}
                        />
                    );
                })()}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Shared button style ──────────────────────────────────────────────────────

const tbtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 3,
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
    padding: '5px 7px', borderRadius: 6,
    transition: 'all 0.15s', fontFamily: 'inherit', fontSize: '0.72rem',
};
