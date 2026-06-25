// ============================================================================
// EmptyState — placeholder editorial papier-chaud pour les zones vides
// (sprint visuel 2026-05-20)
//
// UX rule (ui-ux-pro-max §8 Forms & Feedback) : un ecran vide sans guide
// laisse l'user perdu. Empty state = message clair + CTA prioritaire +
// visuel sobre (Lucide icon dans un halo cobalt-soft).
//
// Usage :
//   <EmptyState
//     icon={Inbox}
//     title={<>Aucune <em>transaction.</em></>}
//     description="Importe un releve bancaire ou connecte une banque pour commencer."
//     cta={{ label: 'Importer un CSV', onClick: () => setView('import') }}
//     secondary={{ label: 'Connecter une banque', onClick: () => setView('settings') }}
//   />
//
// Variants visuels :
//   tone="default" (papier-chaud, halo cobalt) — par defaut
//   tone="positive" (halo sage) — pour les "rien a signaler" positifs
//   tone="warning" (halo ocre) — pour les anomalies / actions necessaires
//
// La typo h2 + em italique Newsreader suit le pattern global (subview-header).
// ============================================================================
import React from 'react';

const TONE_STYLES = {
  default: {
    halo: 'var(--accent-soft)',
    icon: 'var(--accent)',
    em: 'var(--accent)',
  },
  positive: {
    halo: 'color-mix(in oklab, var(--positive) 12%, transparent)',
    icon: 'var(--positive)',
    em: 'var(--positive)',
  },
  warning: {
    halo: 'color-mix(in oklab, var(--warning) 14%, transparent)',
    icon: 'var(--warning)',
    em: 'var(--warning)',
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta = null,        // { label, onClick, icon? }
  secondary = null,  // { label, onClick }
  tone = 'default',
  compact = false,   // version reduite (padding plus petit, icon plus petit)
  children = null,   // contenu custom additionnel sous les CTAs
}) {
  const palette = TONE_STYLES[tone] || TONE_STYLES.default;
  const iconSize = compact ? 22 : 28;
  const haloSize = compact ? 52 : 68;
  return (
    <div className={`empty-state ${compact ? 'empty-state-compact' : ''}`}>
      {Icon && (
        <span
          className="empty-state-halo"
          style={{
            width: haloSize,
            height: haloSize,
            background: palette.halo,
          }}
          aria-hidden="true"
        >
          <Icon size={iconSize} style={{ color: palette.icon }} />
        </span>
      )}
      {title && (
        <h3 className="empty-state-title" style={{ '--es-em': palette.em }}>
          {title}
        </h3>
      )}
      {description && (
        <p className="empty-state-desc">{description}</p>
      )}
      {(cta || secondary) && (
        <div className="empty-state-actions">
          {cta && (
            <button
              type="button"
              className="empty-state-cta"
              onClick={cta.onClick}
            >
              {cta.icon ? <cta.icon size={14} /> : null}
              {cta.label}
            </button>
          )}
          {secondary && (
            <button
              type="button"
              className="empty-state-secondary"
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// CSS injecte une seule fois (idempotent, comme Skeleton.jsx)
let _esCssInjected = false;
function ensureEmptyStateCss() {
  if (_esCssInjected || typeof document === 'undefined') return;
  _esCssInjected = true;
  const style = document.createElement('style');
  style.dataset.es = '1';
  style.textContent = `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      padding: 44px 24px 40px;
      color: var(--ink-3);
    }
    .empty-state-compact {
      padding: 24px 20px;
      gap: 10px;
    }
    .empty-state-halo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      margin-bottom: 4px;
      animation: esHaloIn 0.42s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes esHaloIn {
      from { opacity: 0; transform: scale(0.82); }
      to   { opacity: 1; transform: scale(1); }
    }
    .empty-state-title {
      margin: 0;
      font: 500 22px/1.18 var(--font-sans);
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .empty-state-title em {
      font-family: 'Geist', system-ui, sans-serif;
      font-style: italic;
      font-weight: 400;
      color: var(--es-em, var(--accent));
      letter-spacing: -0.025em;
    }
    .empty-state-compact .empty-state-title { font-size: 17px; }
    .empty-state-desc {
      margin: 0;
      font: 400 13.5px/1.5 var(--font-sans);
      color: var(--ink-3);
      max-width: 420px;
    }
    .empty-state-compact .empty-state-desc { font-size: 12.5px; }
    .empty-state-actions {
      display: flex;
      gap: 10px;
      margin-top: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .empty-state-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      border: none;
      font: 600 13px/1 var(--font-sans);
      cursor: pointer;
      transition: background 0.18s, box-shadow 0.18s;
      box-shadow: 0 4px 14px -4px color-mix(in oklab, var(--accent) 32%, transparent);
    }
    .empty-state-cta:hover {
      background: var(--accent-2);
    }
    .empty-state-secondary {
      padding: 10px 16px;
      border-radius: 999px;
      background: transparent;
      color: var(--ink-2);
      border: 1px solid var(--border);
      font: 500 13px/1 var(--font-sans);
      cursor: pointer;
      transition: border-color 0.18s, color 0.18s;
    }
    .empty-state-secondary:hover {
      border-color: var(--ink-2);
      color: var(--ink);
    }
    @media (max-width: 767px) {
      .empty-state { padding: 32px 16px 28px; }
      .empty-state-title { font-size: 19px; }
      .empty-state-actions { width: 100%; flex-direction: column; }
      .empty-state-cta, .empty-state-secondary {
        width: 100%;
        justify-content: center;
        min-height: 44px;
      }
    }
  `;
  document.head.appendChild(style);
}

if (typeof window !== 'undefined') {
  ensureEmptyStateCss();
}
