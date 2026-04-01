'use client';

import { useState } from 'react';
import {
  ConceptAIcon, ConceptALogo,
  ConceptBIcon, ConceptBLogo,
  ConceptCIcon, ConceptCLogo,
} from '@/components/BrilliPlanLogo';

// ---------------------------------------------------------------------------
// BrilliPlan tab — unchanged
// ---------------------------------------------------------------------------

const SIZES = [16, 24, 32, 48, 64, 96];

interface ConceptSectionProps {
  label: string;
  tag: string;
  tagColor: string;
  description: string;
  keywords: string[];
  Icon: React.ComponentType<{ size?: number }>;
  Logo: React.ComponentType<{ size?: number }>;
}

function ConceptSection({ label, tag, tagColor, description, keywords, Icon, Logo }: ConceptSectionProps) {
  return (
    <section style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '20px',
      padding: '2.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#f4f4f5' }}>
              {label}
            </h2>
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: `${tagColor}14`, border: `1px solid ${tagColor}30`, color: tagColor,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}>
              {tag}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, maxWidth: '480px' }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {keywords.map(k => (
            <span key={k} style={{
              fontSize: '0.64rem', fontWeight: 600, padding: '3px 8px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.35)',
            }}>
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Large showcase */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
      }}>
        {/* Icon on dark */}
        <div style={{
          background: '#07070f',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          minHeight: '200px',
        }}>
          <Icon size={80} />
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            Icone seule
          </span>
        </div>

        {/* Logo on dark */}
        <div style={{
          background: '#07070f',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          minHeight: '200px',
        }}>
          <Logo size={56} />
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            Logo complet
          </span>
        </div>
      </div>

      {/* Size scale */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
          Test de tailles
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1.5rem',
          flexWrap: 'wrap',
          background: '#07070f',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '1.5rem 2rem',
        }}>
          {SIZES.map(s => (
            <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Icon size={s} />
              <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{s}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navbar mockup */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
          Apercu navbar
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(12,12,20,0.95)',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 18px',
          width: 'fit-content',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>
          <Icon size={28} />
          <span style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.035em', color: '#f2f2ff' }}>
            BrilliPlan
          </span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.07)', marginLeft: 6, marginRight: 6 }} />
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Dashboard</span>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Explorer</span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Brilliplan tab — inline SVG icons
// ---------------------------------------------------------------------------

function IconSparkClarity({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 5C16.27 5 10 11.27 10 19c0 5.2 2.8 9.74 7 12.12V34h14v-2.88c4.2-2.38 7-6.92 7-12.12C38 11.27 31.73 5 24 5z" fill="#F5C518" />
      <rect x="17" y="35" width="14" height="2.5" rx="1.25" fill="#F5C518" opacity="0.7" />
      <rect x="19" y="38.5" width="10" height="2" rx="1" fill="#F5C518" opacity="0.4" />
      <path d="M18 19 l4 4 l8-8" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconWarmPremium({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="40" height="40" rx="10" fill="#1A1A2E" stroke="#E8A838" strokeWidth="1.5" />
      <rect x="14" y="12" width="5" height="24" rx="2" fill="#E8A838" />
      <path d="M19 12 Q30 12 30 18 Q30 24 19 24 Z" fill="#E8A838" />
      <path d="M19 24 Q32 24 32 31 Q32 38 19 38 Z" fill="#E8A838" />
      <circle cx="37" cy="9" r="3" fill="#E8A838" />
    </svg>
  );
}

function IconGradientModern({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <path d="M24 3 L45 24 L24 45 L3 24 Z" fill="url(#g3)" />
      <path d="M24 12 L36 24 L24 36 L12 24 Z" fill="#07070f" />
      <circle cx="24" cy="24" r="3" fill="url(#g3)" />
      <circle cx="31" cy="17" r="2" fill="#A855F7" opacity="0.8" />
      <circle cx="35" cy="12" r="1.5" fill="#A855F7" opacity="0.5" />
      <circle cx="38" cy="8" r="1" fill="#A855F7" opacity="0.3" />
    </svg>
  );
}

function IconMinimalMono({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" stroke="#3B82F6" strokeWidth="1.5" fill="none" />
      <circle cx="24" cy="24" r="14" stroke="#3B82F6" strokeWidth="0.5" opacity="0.3" fill="none" />
      <text x="24" y="30" textAnchor="middle" fontSize="22" fontWeight="300" fill="white" fontFamily="system-ui, sans-serif">b</text>
    </svg>
  );
}

function IconNatureIntellect({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 42 C10 42 6 28 8 17 C10 6 18 3 24 3 C30 3 38 6 40 17 C42 28 38 42 24 42 Z" fill="#6BAF7A" opacity="0.9" />
      <path d="M24 40 C21 32 19 24 21 14" stroke="#F0C040" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="21" cy="13" r="3" fill="#F0C040" />
      <circle cx="21.5" cy="20" r="1.5" fill="#F0C040" opacity="0.6" />
      <circle cx="21" cy="27" r="1.5" fill="#F0C040" opacity="0.6" />
      <circle cx="22" cy="33" r="1.5" fill="#F0C040" opacity="0.6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BrilliCard
// ---------------------------------------------------------------------------

interface BrilliCardProps {
  number: string;
  name: string;
  tag: string;
  tagColor: string;
  colors: { hex: string; label: string }[];
  Icon: React.ComponentType<{ size?: number }>;
  wordmarkRender: React.ReactNode;
  keywords: string[];
  feel: string;
  glowColor: string;
}

function BrilliCard({
  number,
  name,
  tag,
  tagColor,
  colors,
  Icon,
  wordmarkRender,
  keywords,
  feel,
  glowColor,
}: BrilliCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <section
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? `${glowColor}30` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '20px',
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        transition: 'border-color 0.25s ease',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
              {number}
            </span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#f4f4f5' }}>
              {name}
            </h2>
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: `${tagColor}14`, border: `1px solid ${tagColor}30`, color: tagColor,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}>
              {tag}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, maxWidth: '480px' }}>
            {feel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {keywords.map(k => (
            <span key={k} style={{
              fontSize: '0.64rem', fontWeight: 600, padding: '3px 8px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.35)',
            }}>
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Color swatches */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
          Palette
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {colors.map(c => (
            <div key={c.hex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '12px',
                background: c.hex,
                border: c.hex === '#FFFFFF' || c.hex === '#FAF3E0' || c.hex === '#F8F8F0'
                  ? '1px solid rgba(255,255,255,0.12)'
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: `0 4px 16px ${c.hex}35`,
              }} />
              <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textAlign: 'center', maxWidth: '64px' }}>{c.label}</span>
              <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>{c.hex}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main showcase — icon + wordmark */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Icon alone */}
        <div style={{
          background: '#07070f',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          minHeight: '200px',
        }}>
          <Icon size={80} />
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            Icone seule
          </span>
        </div>

        {/* Wordmark */}
        <div style={{
          background: '#07070f',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          minHeight: '200px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon size={40} />
            {wordmarkRender}
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            Logo complet
          </span>
        </div>
      </div>

      {/* Navbar preview */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
          Apercu navbar
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(12,12,20,0.95)',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 18px',
          width: 'fit-content',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>
          <Icon size={28} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {wordmarkRender}
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.07)', marginLeft: 6, marginRight: 6 }} />
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Dashboard</span>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Explorer</span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Wordmark renders (one per direction)
// ---------------------------------------------------------------------------

const wordmarkSparkClarity = (
  <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#F5C518' }}>
    Brilliplan
  </span>
);

const wordmarkWarmPremium = (
  <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#E8A838' }}>
    Brilliplan
  </span>
);

const wordmarkGradientModern = (
  <span style={{
    fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }}>
    Brilliplan
  </span>
);

const wordmarkMinimalMono = (
  <span style={{ fontSize: '1.05rem', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'baseline', gap: '0' }}>
    <span style={{ fontWeight: 300, color: 'white' }}>brilli</span>
    <span style={{ fontWeight: 300, color: '#3B82F6' }}>.</span>
    <span style={{ fontWeight: 300, color: 'white' }}>plan</span>
  </span>
);

const wordmarkNatureIntellect = (
  <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#6BAF7A' }}>
    Brilliplan
  </span>
);

// Direction 6 — Neon Dark
function IconNeonDark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Dark bg */}
      <rect x="2" y="2" width="44" height="44" rx="8" fill="#0A0A0F" />
      {/* Cyan border glow */}
      <rect x="2" y="2" width="44" height="44" rx="8" stroke="#00F5FF" strokeWidth="1" fill="none" opacity="0.6" filter="url(#neon-glow)" />
      {/* B shape in neon */}
      <rect x="13" y="10" width="4" height="28" rx="2" fill="#00F5FF" filter="url(#neon-glow)" />
      <path d="M17 10 Q30 10 30 17 Q30 24 17 24" stroke="#00F5FF" strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#neon-glow)" />
      <path d="M17 24 Q32 24 32 31.5 Q32 38 17 38" stroke="#FF0080" strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#neon-glow)" />
      {/* Scanlines accent */}
      <line x1="35" y1="10" x2="38" y2="10" stroke="#FF0080" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <line x1="34" y1="13" x2="38" y2="13" stroke="#FF0080" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="35" y1="16" x2="38" y2="16" stroke="#FF0080" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}
const wordmarkNeonDark = (
  <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.04em' }}>
    <span style={{ color: '#00F5FF', textShadow: '0 0 8px #00F5FF88' }}>BRILLI</span>
    <span style={{ color: '#FF0080', textShadow: '0 0 8px #FF008088' }}>PLAN</span>
  </span>
);

// Direction 7 — Ink & Paper (Brutalist)
function IconInkPaper({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Paper bg */}
      <rect x="0" y="0" width="48" height="48" fill="#F5F0E8" />
      {/* Red stamp bar top */}
      <rect x="0" y="0" width="48" height="7" fill="#D4380D" />
      {/* Bold B letterpress */}
      <rect x="10" y="10" width="6" height="28" fill="#1A1208" />
      <path d="M16 10 Q29 10 29 17.5 Q29 25 16 25 Q29 25 29 32.5 Q29 38 16 38" fill="#1A1208" />
      {/* Ink bleed dots */}
      <circle cx="34" cy="14" r="2" fill="#D4380D" />
      <circle cx="38" cy="14" r="1.2" fill="#D4380D" opacity="0.6" />
      <circle cx="34" cy="34" r="1.5" fill="#1A1208" opacity="0.4" />
    </svg>
  );
}
const wordmarkInkPaper = (
  <span style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.01em', color: '#1A1208', textTransform: 'uppercase' as const }}>
    Brilli<span style={{ color: '#D4380D' }}>plan</span>
  </span>
);

// Direction 8 — Aurora (Iridescent)
function IconAurora({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <radialGradient id="aurora-orb" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#A8FFDB" />
          <stop offset="30%" stopColor="#08AEEA" />
          <stop offset="60%" stopColor="#7B2FF7" />
          <stop offset="100%" stopColor="#F72585" />
        </radialGradient>
        <radialGradient id="aurora-inner" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Orb */}
      <circle cx="24" cy="24" r="21" fill="url(#aurora-orb)" />
      {/* Sheen */}
      <circle cx="24" cy="24" r="21" fill="url(#aurora-inner)" />
      {/* White B */}
      <rect x="15" y="12" width="4.5" height="24" rx="2" fill="white" opacity="0.92" />
      <path d="M19.5 12 Q30 12 30 18.5 Q30 25 19.5 25" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.92" />
      <path d="M19.5 25 Q32 25 32 32 Q32 37 19.5 37" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.92" />
    </svg>
  );
}
const wordmarkAurora = (
  <span style={{
    fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em',
    background: 'linear-gradient(90deg, #A8FFDB, #08AEEA, #7B2FF7, #F72585)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  }}>
    Brilliplan
  </span>
);

// Direction 9 — Swiss / Helvetica
function IconSwiss({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Solid red square */}
      <rect x="0" y="0" width="48" height="48" fill="#FF3B30" />
      {/* White B — clean helvetica-style */}
      <rect x="13" y="10" width="5" height="28" rx="1" fill="white" />
      <path d="M18 10 Q30 10 30 17 Q30 24 18 24 Q30 24 30 31 Q30 38 18 38" fill="white" />
    </svg>
  );
}
const wordmarkSwiss = (
  <span style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.01em', textTransform: 'uppercase' as const }}>
    <span style={{ color: '#FF3B30' }}>Brilli</span>
    <span style={{ color: '#f4f4f5' }}>plan</span>
  </span>
);

// Direction 10 — Rose Gold / Luxury
function IconRoseGold({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="rg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9848E" />
          <stop offset="50%" stopColor="#E8A0AA" />
          <stop offset="100%" stopColor="#B76E79" />
        </linearGradient>
      </defs>
      {/* Deep plum bg */}
      <rect x="0" y="0" width="48" height="48" rx="12" fill="#2D1B2E" />
      {/* Thin rose gold B */}
      <rect x="14" y="10" width="3" height="28" rx="1.5" fill="url(#rg-grad)" />
      <path d="M17 10 Q28 10 28 17 Q28 24 17 24" stroke="url(#rg-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M17 24 Q30 24 30 31 Q30 38 17 38" stroke="url(#rg-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Small diamond accent */}
      <path d="M37 8 L40 12 L37 16 L34 12 Z" fill="url(#rg-grad)" opacity="0.8" />
    </svg>
  );
}
const wordmarkRoseGold = (
  <span style={{
    fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.04em',
    background: 'linear-gradient(135deg, #C9848E, #E8A0AA, #B76E79)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  }}>
    Brilliplan
  </span>
);

// ---------------------------------------------------------------------------
// Brilliplan tab content
// ---------------------------------------------------------------------------

function BrilliplanTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      {/* Section header */}
      <div style={{ textAlign: 'center', paddingBottom: '1rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 14px', background: 'rgba(245,197,24,0.07)',
          border: '1px solid rgba(245,197,24,0.18)', borderRadius: '100px',
          fontSize: '0.66rem', fontWeight: 800, color: '#F5C518',
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          marginBottom: '1.5rem',
        }}>
          10 Brand Directions
        </div>
        <p style={{ fontSize: '0.93rem', color: 'rgba(255,255,255,0.35)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
          Cinq orientations visuelles pour Brilliplan. Chaque direction exprime une identite differente — de la startup energique a la plateforme premium en passant par le SaaS moderne.
        </p>
      </div>

      {/* Direction 1 — Spark & Clarity */}
      <BrilliCard
        number="01"
        name="Spark & Clarity"
        tag="Startup Energy"
        tagColor="#F5C518"
        colors={[
          { hex: '#F5C518', label: 'Electric Yellow' },
          { hex: '#0D1B2A', label: 'Deep Navy' },
          { hex: '#FFFFFF', label: 'White' },
        ]}
        Icon={IconSparkClarity}
        wordmarkRender={wordmarkSparkClarity}
        keywords={['Clarté', 'Intelligence', 'Startup', 'Énergie']}
        feel="Une identite lumineuse et directe — l'energie d'une idee qui s'allume. Le checkmark dans l'ampoule incarne la validation instantanee, la clarte d'esprit."
        glowColor="#F5C518"
      />

      {/* Direction 2 — Warm Premium */}
      <BrilliCard
        number="02"
        name="Warm Premium"
        tag="Recommandé"
        tagColor="#E8A838"
        colors={[
          { hex: '#E8A838', label: 'Warm Amber' },
          { hex: '#1A1A2E', label: 'Dark Charcoal' },
          { hex: '#FAF3E0', label: 'Cream' },
        ]}
        Icon={IconWarmPremium}
        wordmarkRender={wordmarkWarmPremium}
        keywords={['Premium', 'Confiance', 'Élégance', 'Professionnel']}
        feel="Un monogramme B raffine sur fond sombre — chaleur de l'ambre, sobriete du charbon. Pour une plateforme qui inspire confiance et professionnalisme."
        glowColor="#E8A838"
      />

      {/* Direction 3 — Gradient Modern */}
      <BrilliCard
        number="03"
        name="Gradient Modern"
        tag="SaaS"
        tagColor="#A855F7"
        colors={[
          { hex: '#7C3AED', label: 'Purple' },
          { hex: '#A855F7', label: 'Violet' },
          { hex: '#6366F1', label: 'Indigo' },
        ]}
        Icon={IconGradientModern}
        wordmarkRender={wordmarkGradientModern}
        keywords={['Moderne', 'SaaS', 'Gradient', 'Scalable']}
        feel="Un diamant gradient aux aretes nettes, avec des noeuds ascendants qui suggerent la montee en puissance. L'esthetique des grandes plateformes SaaS modernes."
        glowColor="#A855F7"
      />

      {/* Direction 4 — Minimal Monochrome */}
      <BrilliCard
        number="04"
        name="Minimal Monochrome"
        tag="Editorial"
        tagColor="#3B82F6"
        colors={[
          { hex: '#0A0A0A', label: 'Black' },
          { hex: '#FFFFFF', label: 'White' },
          { hex: '#3B82F6', label: 'Electric Blue' },
        ]}
        Icon={IconMinimalMono}
        wordmarkRender={wordmarkMinimalMono}
        keywords={['Minimaliste', 'Éditorial', 'Confiant', 'Épuré']}
        feel="La lettre b encerclee — une marque d'editeur reimaginee. Le point bleu electrique est la seule concession a la couleur dans un univers strictement epure."
        glowColor="#3B82F6"
      />

      {/* Direction 5 — Nature + Intellect */}
      <BrilliCard
        number="05"
        name="Nature + Intellect"
        tag="Croissance"
        tagColor="#6BAF7A"
        colors={[
          { hex: '#6BAF7A', label: 'Sage Green' },
          { hex: '#F0C040', label: 'Golden Yellow' },
          { hex: '#F8F8F0', label: 'Off-white' },
        ]}
        Icon={IconNatureIntellect}
        wordmarkRender={wordmarkNatureIntellect}
        keywords={['Croissance', 'Organique', 'Progression', 'Nature']}
        feel="Une feuille parcourue d'une veine-graphique doree — la nature comme metaphore de la progression intelligente. Pour une marque qui grandit avec ses utilisateurs."
        glowColor="#6BAF7A"
      />

      {/* Direction 6 — Neon Dark */}
      <BrilliCard
        number="06"
        name="Neon Dark"
        tag="Cyberpunk"
        tagColor="#00F5FF"
        colors={[
          { hex: '#00F5FF', label: 'Cyan Neon' },
          { hex: '#FF0080', label: 'Hot Pink' },
          { hex: '#0A0A0F', label: 'Near Black' },
        ]}
        Icon={IconNeonDark}
        wordmarkRender={wordmarkNeonDark}
        keywords={['Cyberpunk', 'Tech', 'Disruptif', 'Bold']}
        feel="Un B au trace neon cyan et rose — deux couleurs de signal qui s'affrontent sur fond quasi-noir. Pour une plateforme qui revendique d'etre differente."
        glowColor="#00F5FF"
      />

      {/* Direction 7 — Ink & Paper */}
      <BrilliCard
        number="07"
        name="Ink & Paper"
        tag="Brutaliste"
        tagColor="#D4380D"
        colors={[
          { hex: '#F5F0E8', label: 'Paper' },
          { hex: '#1A1208', label: 'Ink' },
          { hex: '#D4380D', label: 'Vermillion' },
        ]}
        Icon={IconInkPaper}
        wordmarkRender={wordmarkInkPaper}
        keywords={['Brutaliste', 'Imprimerie', 'Honnete', 'Fort']}
        feel="Un tampon letterpress — encre noire dense sur papier creme, barre vermillon en tete. L'esthetique de l'edition independante. Brut, direct, memorable."
        glowColor="#D4380D"
      />

      {/* Direction 8 — Aurora */}
      <BrilliCard
        number="08"
        name="Aurora"
        tag="Iridescent"
        tagColor="#08AEEA"
        colors={[
          { hex: '#A8FFDB', label: 'Aqua' },
          { hex: '#08AEEA', label: 'Cyan' },
          { hex: '#7B2FF7', label: 'Violet' },
          { hex: '#F72585', label: 'Magenta' },
        ]}
        Icon={IconAurora}
        wordmarkRender={wordmarkAurora}
        keywords={['Iridescent', 'Premium', 'Futuriste', 'Unique']}
        feel="Un orbe aux reflets aurora borealis — lumiere changeante selon l'angle, spectre complet. Pour une marque premium qui veut marquer les esprits par sa beaute visuelle."
        glowColor="#08AEEA"
      />

      {/* Direction 9 — Swiss */}
      <BrilliCard
        number="09"
        name="Swiss"
        tag="International"
        tagColor="#FF3B30"
        colors={[
          { hex: '#FF3B30', label: 'Swiss Red' },
          { hex: '#000000', label: 'Black' },
          { hex: '#FFFFFF', label: 'White' },
        ]}
        Icon={IconSwiss}
        wordmarkRender={wordmarkSwiss}
        keywords={['Helvetica', 'Autorité', 'Clair', 'International']}
        feel="Un carre rouge plein, B blanc helvetica — le vocabulaire du design suisse. Autorite maximale, zero ornement. Reconnaissable a un metre de distance."
        glowColor="#FF3B30"
      />

      {/* Direction 10 — Rose Gold */}
      <BrilliCard
        number="10"
        name="Rose Gold"
        tag="Luxe"
        tagColor="#E8A0AA"
        colors={[
          { hex: '#B76E79', label: 'Rose Gold' },
          { hex: '#2D1B2E', label: 'Deep Plum' },
          { hex: '#F9E8E8', label: 'Blush' },
        ]}
        Icon={IconRoseGold}
        wordmarkRender={wordmarkRoseGold}
        keywords={['Luxe', 'Aspiration', 'Elegance', 'Féminin']}
        feel="Un B en trait fin rose or sur prune profond, orne d'un diamant. L'identite d'une marque premium qui s'adresse a une audience aspirationnelle et raffinee."
        glowColor="#B76E79"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BrandPage() {
  const [activeTab, setActiveTab] = useState<'brilliplan' | 'brilliplan'>('brilliplan');

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', color: '#f4f4f5' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>

        {/* Page header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 14px', background: 'rgba(200,169,96,0.08)',
            border: '1px solid rgba(200,169,96,0.18)', borderRadius: '100px',
            fontSize: '0.66rem', fontWeight: 800, color: '#c8a960',
            letterSpacing: '0.12em', textTransform: 'uppercase' as const,
            marginBottom: '1.5rem',
          }}>
            Brand Identity
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900,
            letterSpacing: '-0.05em', lineHeight: 1.1, marginBottom: '1rem',
            background: 'linear-gradient(135deg, #ede9e3 0%, #c8a960 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Brand Explorer
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.35)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
            Propositions visuelles pour BrilliPlan et Brilliplan. Explorez chaque concept de marque, ses couleurs, son identite et ses applications.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '3rem' }}>
          <button
            onClick={() => setActiveTab('brilliplan')}
            style={{
              padding: '8px 24px',
              borderRadius: '100px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${activeTab === 'brilliplan' ? 'rgba(200,169,96,0.3)' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab === 'brilliplan' ? 'rgba(200,169,96,0.12)' : 'transparent',
              color: activeTab === 'brilliplan' ? '#c8a960' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
              outline: 'none',
            }}
          >
            BrilliPlan
          </button>
          <button
            onClick={() => setActiveTab('brilliplan')}
            style={{
              padding: '8px 24px',
              borderRadius: '100px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${activeTab === 'brilliplan' ? 'rgba(245,197,24,0.25)' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab === 'brilliplan' ? 'rgba(245,197,24,0.08)' : 'transparent',
              color: activeTab === 'brilliplan' ? '#F5C518' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
              outline: 'none',
            }}
          >
            Brilliplan
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'brilliplan' && (
          <>
            {/* Concepts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              <ConceptSection
                label="Concept A — Sync Flow"
                tag="Recommande"
                tagColor="#10b981"
                description="Deux trajectoires fluides qui se croisent autour d'un noeud lumineux central. Le croisement represente le moment de synchronisation entre deux collaborateurs. Organique, dynamique, memorable."
                keywords={['Synchronisation', 'Fluidite', 'Collaboration', 'Croisement']}
                Icon={ConceptAIcon}
                Logo={ConceptALogo}
              />

              <ConceptSection
                label="Concept B — Convergence"
                tag="Bold"
                tagColor="#f59e0b"
                description="Deux lames ascendantes qui convergent vers un sommet commun. La forme evoque deux forces qui s'unissent pour atteindre un objectif. Ambitieux, puissant, resolument oriente vers le haut."
                keywords={['Ambition', 'Croissance', 'Union', 'Sommet']}
                Icon={ConceptBIcon}
                Logo={ConceptBLogo}
              />

              <ConceptSection
                label="Concept C — Orbit Sync"
                tag="Technique"
                tagColor="#c8a960"
                description="Deux arcs orbitaux encerclant un diamant central. Evoque la precision technologique et la synchronisation de deux trajectoires autour d'un point focal commun. Geometrique, epure, technique."
                keywords={['Orbite', 'Precision', 'Technologie', 'Equilibre']}
                Icon={ConceptCIcon}
                Logo={ConceptCLogo}
              />
            </div>

            {/* Color palette */}
            <div style={{ marginTop: '4rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '1.25rem', color: 'rgba(255,255,255,0.6)' }}>
                Palette de couleurs
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { color: '#4338ca', name: 'Indigo 700' },
                  { color: '#b89a50', name: 'Indigo 600' },
                  { color: '#c8a960', name: 'Indigo 500' },
                  { color: '#c8a960', name: 'Indigo 400' },
                  { color: '#d4b872', name: 'Indigo 300' },
                  { color: '#c7d2fe', name: 'Indigo 200' },
                  { color: '#b89a50', name: 'Violet 600' },
                  { color: '#d4b872', name: 'Violet 400' },
                  { color: '#ede9e3', name: 'Violet 300' },
                ].map(c => (
                  <div key={c.color + c.name} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '12px',
                      background: c.color, border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: `0 4px 16px ${c.color}35`,
                    }} />
                    <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>{c.color}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'brilliplan' && <BrilliplanTab />}

      </div>
    </div>
  );
}
