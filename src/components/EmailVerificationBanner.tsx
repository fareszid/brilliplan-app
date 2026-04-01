'use client';

import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { Mail, X, RefreshCw } from 'lucide-react';

export default function EmailVerificationBanner() {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    if (!user || user.emailVerified || dismissed) return null;

    const handleResend = async () => {
        setSending(true);
        try {
            await sendEmailVerification(user);
            setSent(true);
        } catch {
            // rate limited or other error
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{
            margin: '0 auto 16px', maxWidth: 900, padding: '12px 16px',
            background: 'rgba(200,169,96,0.08)', border: '1px solid rgba(200,169,96,0.2)',
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
            fontSize: '0.85rem', color: '#ede9e3',
        }}>
            <Mail size={18} style={{ color: '#c8a960', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>Vérifie ton email</span>
                <span style={{ color: 'rgba(237,233,227,0.6)', marginLeft: 6 }}>
                    Un lien de vérification a été envoyé à {user.email}.
                </span>
            </div>
            {sent ? (
                <span style={{ color: '#5eead4', fontSize: '0.8rem', fontWeight: 500 }}>Envoyé !</span>
            ) : (
                <button
                    onClick={handleResend}
                    disabled={sending}
                    style={{
                        background: 'rgba(200,169,96,0.15)', border: '1px solid rgba(200,169,96,0.3)',
                        borderRadius: 8, padding: '6px 12px', color: '#c8a960',
                        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                    }}
                >
                    <RefreshCw size={13} style={sending ? { animation: 'spin 1s linear infinite' } : {}} />
                    Renvoyer
                </button>
            )}
            <button onClick={() => setDismissed(true)} style={{
                background: 'transparent', border: 'none', color: 'rgba(237,233,227,0.3)',
                cursor: 'pointer', padding: 4, flexShrink: 0,
            }}>
                <X size={16} />
            </button>
        </div>
    );
}
