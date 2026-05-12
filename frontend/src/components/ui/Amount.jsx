// Amount — affiche un nombre EUR en format FR strict avec décimales en --ink-3.
// Hero : split décimales (cents class).
// Variantes: hero (Newsreader 64px) | default (Geist tabular).
//
// Respecte HideAmountsContext : quand hideAmounts=true, affiche '•••' partout.

import { useHideAmounts } from '../../contexts/HideAmounts.jsx';

const MASK = '•••';

const _fmt = (n, { abbr = false, decimals = 2 } = {}) => {
  if (abbr && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('fr-FR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n) + ' €';
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

/** Hook — retourne un formatter qui respecte hideAmounts. */
export function useFormatEUR() {
  const hidden = useHideAmounts();
  return hidden ? () => MASK : _fmt;
}

export function Amount({ value, hero = false, abbr = false, decimals = 2, className = '', style }) {
  const hidden = useHideAmounts();
  if (hidden) {
    return <span className={`num ds-masked ${className}`} style={style}>{MASK}</span>;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return <span className={className} style={style}>—</span>;
  }
  const text = _fmt(value, { abbr, decimals });
  if (!hero || abbr) {
    return <span className={`num ${className}`} style={style}>{text}</span>;
  }
  // Hero: split on the virgule to color decimals + symbol in --ink-3
  const m = text.match(/^(.+),(\d+)\s*(€)$/);
  if (!m) return <span className={`num ds-hero-num ${className}`} style={style}>{text}</span>;
  const [, integer, cents, sym] = m;
  return (
    <span className={`ds-hero-num ${className}`} style={style}>
      {integer}
      <span className="cents">,{cents}&nbsp;{sym}</span>
    </span>
  );
}

export const formatEUR = _fmt;
