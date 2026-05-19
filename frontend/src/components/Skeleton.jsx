// ============================================================================
// Skeleton — placeholders pendant le chargement (sprint visuel 2026-05-19)
//
// UX rule (skill ui-ux-pro-max §3 Performance) : pour toute opération > 300 ms,
// montrer un skeleton plutôt qu'un spinner. Réduit la perception d'attente +
// évite le CLS (reserve space pour le contenu à venir).
//
// Variants :
//   <Skeleton>                  ligne basique (1 ligne, 100 % width)
//   <Skeleton w="40%" h={20}/>  custom width/height
//   <Skeleton.Line lines={3}/>  plusieurs lignes empilées
//   <Skeleton.Card/>            card placeholder (header + body + footer)
//   <Skeleton.Row/>             ligne tableau (avatar + 2 colonnes + montant)
//
// Respect prefers-reduced-motion : si activé, pas de shimmer animation —
// juste un fond statique. Pas de translateY ni layout shift.
// ============================================================================
import React from 'react';

function Skeleton({ w, h = 16, radius = 6, className = '', style = {} }) {
  return (
    <span
      className={`skl ${className}`}
      style={{
        display: 'inline-block',
        width: w ?? '100%',
        height: h,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

Skeleton.Line = function SkeletonLine({ lines = 3, w = '100%', gap = 8 }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          w={i === lines - 1 ? '60%' : w}
          h={14}
        />
      ))}
    </span>
  );
};

Skeleton.Card = function SkeletonCard({ height = 180 }) {
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 18,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      aria-hidden="true"
    >
      <Skeleton w="40%" h={11} />
      <Skeleton w="65%" h={28} />
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <Skeleton w="30%" h={11} />
        <Skeleton w="30%" h={11} />
      </div>
    </div>
  );
};

Skeleton.Row = function SkeletonRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderBottom: '1px dotted var(--border)',
      }}
      aria-hidden="true"
    >
      <Skeleton w={28} h={28} radius={6} />
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton w="70%" h={13} />
        <Skeleton w="40%" h={11} />
      </span>
      <Skeleton w={64} h={13} />
    </div>
  );
};

// CSS injecté une seule fois (idempotent — re-mount safe).
let _skeletonCssInjected = false;
function ensureSkeletonCss() {
  if (_skeletonCssInjected || typeof document === 'undefined') return;
  _skeletonCssInjected = true;
  const style = document.createElement('style');
  style.dataset.skl = '1';
  style.textContent = `
    .skl {
      background: linear-gradient(
        90deg,
        var(--bg-sunk) 0%,
        var(--bg-hover) 50%,
        var(--bg-sunk) 100%
      );
      background-size: 200% 100%;
      animation: sklShimmer 1.4s ease-in-out infinite;
    }
    @keyframes sklShimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skl {
        animation: none;
        background: var(--bg-sunk);
      }
    }
  `;
  document.head.appendChild(style);
}

if (typeof window !== 'undefined') {
  ensureSkeletonCss();
}

export { Skeleton };
