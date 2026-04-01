'use client';

import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function useId(prefix: string) {
  const id = React.useId().replace(/:/g, '');
  return `${prefix}${id}`;
}

/* ═══════════════════════════════════════════════════════════
   CONCEPT A — "SYNC FLOW"
   Two flowing S-curve strands crossing at a luminous node.
   Represents: two paths synchronizing, collaboration, flow.
   ═══════════════════════════════════════════════════════════ */

export function ConceptAIcon({ size = 40, className, style }: LogoProps) {
  const id = useId('ca');
  // viewBox trimmed to visual bounds (strands go ~1-39, plus strokeWidth ~1.6 bleed)
  return (
    <svg width={size} height={size} viewBox="-1 0 42 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="40" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338ca" />
          <stop offset="1" stopColor="#c8a960" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="40" y1="40" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b89a50" />
          <stop offset="1" stopColor="#ede9e3" />
        </linearGradient>
        <radialGradient id={`${id}g`} cx="20" cy="20" r="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ede9e3" />
          <stop offset="0.5" stopColor="#d4b872" />
          <stop offset="1" stopColor="#c8a960" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Strand 1 — sweeps bottom-right → center → top-left */}
      <path
        d="M 26,37 C 4,35 3,25 20,20 C 37,15 36,5 14,3"
        stroke={`url(#${id}a)`} strokeWidth="3.2" strokeLinecap="round"
      />
      {/* Strand 2 — sweeps bottom-left → center → top-right (crosses Strand 1) */}
      <path
        d="M 14,37 C 36,35 37,25 20,20 C 3,15 4,5 26,3"
        stroke={`url(#${id}b)`} strokeWidth="3.2" strokeLinecap="round"
      />

      {/* Sync node — luminous center */}
      <circle cx="20" cy="20" r="4.5" fill={`url(#${id}g)`} />
      <circle cx="20" cy="20" r="2" fill="#ede9e3" />
    </svg>
  );
}

export function ConceptALogo({ size = 36, className, style }: LogoProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, ...style }} className={className}>
      <ConceptAIcon size={size} />
      <span style={{
        fontSize: size * 0.5,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        color: '#f0f0ff',
        lineHeight: 1,
      }}>
        BrilliPlan
      </span>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   CONCEPT B — "CONVERGENCE"
   Two rising blades meeting at a shared apex.
   Represents: ambition, growth, two forces converging.
   ═══════════════════════════════════════════════════════════ */

export function ConceptBIcon({ size = 40, className, style }: LogoProps) {
  const id = useId('cb');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id={`${id}l`} x1="6" y1="36" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338ca" />
          <stop offset="1" stopColor="#c8a960" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="34" y1="36" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d28d9" />
          <stop offset="1" stopColor="#d4b872" />
        </linearGradient>
      </defs>

      {/* Left blade — rises from bottom-left to apex */}
      <path
        d="M 5,36 C 5,24 12,14 19.5,4.5 C 19.5,4.5 21.5,13 21,18 C 20,26 12,32 7,36 Z"
        fill={`url(#${id}l)`}
      />
      {/* Right blade — rises from bottom-right to apex */}
      <path
        d="M 35,36 C 35,24 28,14 20.5,4.5 C 20.5,4.5 18.5,13 19,18 C 20,26 28,32 33,36 Z"
        fill={`url(#${id}r)`}
      />
      {/* Apex highlight */}
      <circle cx="20" cy="5.5" r="1.8" fill="#c7d2fe" opacity="0.85" />
    </svg>
  );
}

export function ConceptBLogo({ size = 36, className, style }: LogoProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28, ...style }} className={className}>
      <ConceptBIcon size={size} />
      <span style={{
        fontSize: size * 0.52,
        fontWeight: 900,
        letterSpacing: '-0.05em',
        color: '#f0f0ff',
        lineHeight: 1,
      }}>
        BrilliPlan
      </span>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   CONCEPT C — "ORBIT SYNC"
   Two orbital arcs revolving around a center diamond.
   Represents: synchronized orbits, precision, technology.
   ═══════════════════════════════════════════════════════════ */

export function ConceptCIcon({ size = 40, className, style }: LogoProps) {
  const id = useId('cc');
  // Circle: center (20,20), radius 15
  // Arc 1: ~160° sweep through the top-right
  // Arc 2: ~160° sweep through the bottom-left
  // Endpoints calculated for r=15:
  //   330° → (33, 27.5)    120° → (12.5, 7)
  //   150° → (7, 12.5)     300° → (27.5, 33)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id={`${id}a`} x1="33" y1="27" x2="7" y2="7" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338ca" />
          <stop offset="1" stopColor="#c8a960" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="7" y1="13" x2="33" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d28d9" />
          <stop offset="1" stopColor="#ede9e3" />
        </linearGradient>
      </defs>

      {/* Arc 1 — top-right sweep (~150°) */}
      <path
        d="M 31.5,29.5 A 15,15 0 0,1 15,6"
        stroke={`url(#${id}a)`} strokeWidth="3" strokeLinecap="round"
      />
      {/* Arc 2 — bottom-left sweep (~150°) */}
      <path
        d="M 8.5,10.5 A 15,15 0 0,1 25,34"
        stroke={`url(#${id}b)`} strokeWidth="3" strokeLinecap="round"
      />

      {/* Center diamond */}
      <rect
        x="17" y="17" width="6" height="6" rx="1.2"
        transform="rotate(45 20 20)"
        fill="#d4b872"
      />
      <rect
        x="18.2" y="18.2" width="3.6" height="3.6" rx="0.8"
        transform="rotate(45 20 20)"
        fill="#ede9e3"
      />
    </svg>
  );
}

export function ConceptCLogo({ size = 36, className, style }: LogoProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28, ...style }} className={className}>
      <ConceptCIcon size={size} />
      <span style={{
        fontSize: size * 0.5,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: '#f0f0ff',
        lineHeight: 1,
      }}>
        BrilliPlan
      </span>
    </div>
  );
}
