// ============================================================================
// Logo — Wealthly brand mark (design figé 2026-05-12)
//
// Square cream/ink + monogram W. Auto-adapts to [data-theme] on <html>:
//   - light theme  → ink square + cream W
//   - dark  theme  → cream square + ink W
//
// Use `tone` to force one variant (e.g. on a colored hero card).
// Use `wordmark` to display the "Wealthly" text next to the square.
// ============================================================================
import { useEffect, useState } from 'react';

export default function Logo({
  size = 22,
  wordmark = false,
  tone,       // 'cream' | 'ink' — override auto
  wordmarkSize, // px — defaults proportional to size
  className,
  style,
}) {
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') || 'light'
      : 'light'
  );

  // Observe live theme changes so the logo flips when user toggles dark/light
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const resolved = tone || (theme === 'dark' ? 'cream' : 'ink');
  // Neutres charte « Forêt » (étaient encore en papier-chaud #F1EEE4/#16150F).
  const bg = resolved === 'cream' ? '#ECF1E9' : '#0C0F0B';
  const fg = resolved === 'cream' ? '#10150F' : '#F7F9F6';

  const radius = Math.round(size * 0.23);
  const fontSize = Math.round(size * 0.5);
  const wmSize = wordmarkSize ?? Math.round(size * 0.68);

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
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          background: bg,
          color: fg,
          borderRadius: radius,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize,
          lineHeight: 1,
          letterSpacing: 0,
          flexShrink: 0,
        }}
      >
        W
      </span>
      {wordmark && (
        <span
          style={{
            fontWeight: 500,
            fontSize: wmSize,
            letterSpacing: '-0.005em',
            color: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Wealthly
        </span>
      )}
    </span>
  );
}
