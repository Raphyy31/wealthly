// Amount — displays a monetary value, converting to the user's baseCurrency.
// Reads baseCurrency + rates from CurrencyContext, hideAmounts from HideAmountsContext.
// Hero variant: splits decimals into .cents span for large displays.
// Pass `from="GBP"` etc. if the value is not EUR-denominated.

import { useCurrency } from '../../contexts/Currency.jsx';
import { convertCurrency } from '../../utils.js';

const LOCALE = { EUR: 'fr-FR', USD: 'en-US', GBP: 'en-GB', CHF: 'de-CH' };

const _fmt = (n, currency = 'EUR', { abbr = false, decimals = 2 } = {}) => {
  const locale = LOCALE[currency] || 'fr-FR';
  if (abbr && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n) + ' ' + (currency === 'EUR' ? '€' : currency);
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

/** Hook — returns a formatter that converts to baseCurrency.
 *  Hiding is handled globally via CSS [data-hide-amounts] blur on .num. */
export function useFormatEUR() {
  const { baseCurrency, rates } = useCurrency();
  return (n, opts = {}) => {
    if (typeof n !== 'number' || Number.isNaN(n)) return '—';
    const from = opts.from || 'EUR';
    const converted = convertCurrency(n, from, baseCurrency, rates);
    return _fmt(converted, baseCurrency, opts);
  };
}

export function Amount({ value, from = 'EUR', hero = false, abbr = false, decimals = 2, className = '', style }) {
  const { baseCurrency, rates } = useCurrency();

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return <span className={className} style={style}>—</span>;
  }

  const converted = convertCurrency(value, from, baseCurrency, rates);
  const text = _fmt(converted, baseCurrency, { abbr, decimals });

  if (!hero || abbr) {
    return <span className={`num ${className}`} style={style}>{text}</span>;
  }

  // Hero: split on decimal separator (comma for EUR/fr-FR, dot for others)
  const m = baseCurrency === 'EUR'
    ? text.match(/^(.+),(\d+)\s*(€)$/)
    : text.match(/^(.+)\.(\d+)\s*(.*)$/);
  if (!m) return <span className={`ds-hero-num ${className}`} style={style}>{text}</span>;
  const [, integer, cents, sym] = m;
  const sep = baseCurrency === 'EUR' ? ',' : '.';
  return (
    <span className={`ds-hero-num ${className}`} style={style}>
      {integer}
      <span className="cents">{sep}{cents}{sym ? ' ' + sym : ''}</span>
    </span>
  );
}

// Static EUR formatter (no context — for use outside React or in utils).
export const formatEUR = (n, opts) => _fmt(n, 'EUR', opts);
