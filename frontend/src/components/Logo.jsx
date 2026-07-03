// ============================================================================
// Logo — Yotori Finance brand mark (charte « Forêt » 2026-06-28)
//
// Design figé depuis le film générique : carré émeraude `#41D49B` avec un
// petit carré sombre `#0c1009` centré. Wordmark "Yotori Finance" en regard.
//
// Auto-adapte la couleur du wordmark à [data-theme] sur <html> :
//   - light theme → wordmark encre Forêt
//   - dark  theme → wordmark crème
// Le glyphe (carré + intérieur) reste émeraude/sombre dans les 2 modes —
// c'est l'identité de marque, identique sur fond clair ou sombre.
// ============================================================================
import { useEffect, useState } from 'react';

const GREEN = '#41D49B';   // accent émeraude Forêt
const DARK  = '#0c1009';   // vert-noir profond (intérieur)

export default function Logo({
  size = 22,
  wordmark = false,
  wordmarkSize,
  className,
  style,
  // 'auto' (par défaut) suit data-theme. 'light' force wordmark crème,
  // 'dark' force wordmark encre — utile sur fond imposé (hero coloré).
  tone = 'auto',
}) {
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') || 'light'
      : 'light'
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const isDark = tone === 'light' ? true : tone === 'dark' ? false : (theme === 'dark');
  const wordColor = isDark ? '#F1EEE4' : '#10150F';

  // Géométrie dérivée de size — proportions calées sur le SVG du film
  // (carré 32 dans une vignette 120 → ratio 0.267, intérieur 12/32 → 0.375).
  const r  = Math.round(size * 0.225);     // rayon carré ext
  const ir = Math.round(size * 0.085);     // rayon carré int
  const inSize = Math.round(size * 0.375);
  const inOff = Math.round((size - inSize) / 2);
  const wmSize = wordmarkSize ?? Math.round(size * 0.74);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.45),
        fontFamily: "'Geist', system-ui, sans-serif",
        ...style,
      }}
    >
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ flexShrink: 0, display: 'block' }}
      >
        <rect width={size} height={size} rx={r} fill={GREEN} />
        <rect x={inOff} y={inOff} width={inSize} height={inSize} rx={ir} fill={DARK} />
      </svg>
      {wordmark && (
        <span
          style={{
            fontWeight: 600,
            fontSize: wmSize,
            letterSpacing: '-0.02em',
            color: wordColor,
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          Yotori Finance
        </span>
      )}
    </span>
  );
}
