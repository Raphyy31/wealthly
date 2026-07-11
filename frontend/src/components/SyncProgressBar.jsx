// ============================================================================
// SyncProgressBar — feedback sync digne de Stripe/Wise/Vercel
//
// Composant fixed-top qui combine :
//   1. Une barre progress 2px tout en haut du viewport (visible quoi que tu
//      fasses, comme YouTube/Stripe). Indeterminate quand pas de progres
//      connu, determinate sinon.
//   2. Une pill centree avec stage actuel + compteur "X/Y banques".
//   3. Animation slide-down GSAP a l'apparition, fade out en sortie.
//
// Props :
//   - status : { stage: string, label: string, progress: 0..1 | null,
//                current: int, total: int } | null
//     stage = 'connecting' | 'balance' | 'transactions' | 'waiting' | 'success' | 'error'
//
// L'orchestration (mise a jour de status) est cote YotoriApp via setSync.
// ============================================================================
import { useEffect, useRef } from 'react';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';

const STAGE_ICONS = {
  connecting:   <RefreshCw size={13} className="spbar-spin"/>,
  balance:      <RefreshCw size={13} className="spbar-spin"/>,
  transactions: <RefreshCw size={13} className="spbar-spin"/>,
  waiting:      <AlertTriangle size={13}/>,
  success:      <Check size={13}/>,
  error:        <AlertTriangle size={13}/>,
};

export function SyncProgressBar({ status }) {
  const barRef = useRef(null);
  const pillRef = useRef(null);

  // GSAP entrance/exit animations — chargees a la volee pour eviter de bloater
  // le bundle initial. Cohabite avec le reste du systeme d'anim GSAP existant.
  useEffect(() => {
    let cancelled = false;
    if (!status) return;
    (async () => {
      const { gsap } = await import('gsap');
      if (cancelled) return;
      // Pill : slide down + fade in. ease cubique standard sur l'app.
      if (pillRef.current) {
        gsap.fromTo(pillRef.current,
          { y: -8, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.24, ease: 'power2.out' }
        );
      }
      // Top bar : appear via scaleX from left edge.
      if (barRef.current) {
        gsap.fromTo(barRef.current,
          { scaleX: 0, transformOrigin: 'left center' },
          { scaleX: 1, duration: 0.32, ease: 'power2.out' }
        );
      }
    })();
    return () => { cancelled = true; };
  }, [status?.stage]);

  if (!status) return null;

  const isFinal = status.stage === 'success' || status.stage === 'error';
  const hasProgress = typeof status.progress === 'number';
  const pct = hasProgress ? Math.max(0, Math.min(1, status.progress)) * 100 : null;

  return (
    <>
      {/* Top thin progress bar — pattern Stripe/Vercel/YouTube. */}
      <div className="spbar-top" aria-hidden="true">
        <div
          ref={barRef}
          className={`spbar-top-fill ${isFinal ? 'spbar-final' : ''} ${status.stage === 'error' ? 'spbar-error' : ''}`}
          style={hasProgress ? { width: `${pct}%` } : undefined}
        >
          {!hasProgress && !isFinal && <span className="spbar-shimmer"/>}
        </div>
      </div>

      {/* Pill avec stage + compteur */}
      <div
        ref={pillRef}
        className={`spbar-pill spbar-pill-${status.stage}`}
        role="status"
        aria-live="polite"
      >
        <span className="spbar-pill-icon">{STAGE_ICONS[status.stage] || STAGE_ICONS.connecting}</span>
        <span className="spbar-pill-label">{status.label}</span>
        {status.total > 1 && !isFinal && (
          <span className="spbar-pill-count">{status.current}/{status.total}</span>
        )}
      </div>

      <SpbarStyles/>
    </>
  );
}

function SpbarStyles() {
  const css = `
/* ── Top progress bar (full-width 2px) ──────────────────────────────── */
.spbar-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 1600;
  pointer-events: none;
  background: transparent;
}
.spbar-top-fill {
  position: absolute;
  inset: 0;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 12px -2px var(--accent);
  overflow: hidden;
  width: 100%;
}
.spbar-top-fill.spbar-final {
  background: var(--positive);
  box-shadow: 0 0 12px -2px var(--positive);
  animation: spbar-final-fade 1.6s ease-out forwards;
}
.spbar-top-fill.spbar-error {
  background: var(--negative);
  box-shadow: 0 0 12px -2px var(--negative);
}
@keyframes spbar-final-fade {
  0% { opacity: 1; }
  60% { opacity: 1; }
  100% { opacity: 0; }
}

/* Shimmer indeterminate — petit bloc lumineux qui balaie de gauche a droite */
.spbar-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 35%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.55) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: spbar-shimmer-slide 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes spbar-shimmer-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(385%); }
}

/* ── Pill centree avec stage + compteur ──────────────────────────────
   Taille montee a "hero" suite retour user 2026-05-19 (la pill 13px
   etait trop discrete, "voir tres grand"). Maintenant 18-19px, padding
   genereux, ombre plus marquee pour vraiment attirer l'oeil. */
.spbar-pill {
  position: fixed;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1500;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 16px 26px;
  background: var(--bg-elev);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: 0 18px 48px -16px rgba(0, 0, 0, 0.28),
              0 6px 18px -6px rgba(0, 0, 0, 0.14),
              0 0 0 4px rgba(14, 124, 86, 0.04);
  font: 500 17px/1 var(--font-sans);
  letter-spacing: -0.01em;
  max-width: calc(100vw - 32px);
}
.spbar-pill-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
  width: 22px;
  height: 22px;
}
.spbar-pill-icon svg { width: 19px; height: 19px; }
.spbar-pill-success { border-color: color-mix(in srgb, var(--positive) 40%, var(--border)); }
.spbar-pill-success .spbar-pill-icon { color: var(--positive); }
.spbar-pill-waiting { border-color: color-mix(in srgb, var(--warning) 40%, var(--border)); }
.spbar-pill-waiting .spbar-pill-icon { color: var(--warning); }
.spbar-pill-error { border-color: color-mix(in srgb, var(--negative) 40%, var(--border)); }
.spbar-pill-error .spbar-pill-icon { color: var(--negative); }
.spbar-pill-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60vw;
  font-weight: 500;
}
.spbar-pill-count {
  font: 500 13px/1 var(--font-mono);
  padding: 5px 11px;
  background: var(--bg-sunk);
  color: var(--ink-2);
  border-radius: 999px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.spbar-spin {
  animation: spbar-rotate 1.2s linear infinite;
}
@keyframes spbar-rotate {
  to { transform: rotate(360deg); }
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .spbar-shimmer { animation: none; opacity: 0.4; }
  .spbar-spin { animation: none; }
  .spbar-top-fill.spbar-final { animation: none; opacity: 0; }
}

@media (max-width: 640px) {
  .spbar-pill {
    top: 14px;
    padding: 13px 20px;
    font-size: 15px;
    gap: 11px;
  }
  .spbar-pill-icon { width: 18px; height: 18px; }
  .spbar-pill-icon svg { width: 16px; height: 16px; }
  .spbar-pill-count { font-size: 12px; padding: 4px 9px; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
