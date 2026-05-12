import { SUPPORTED_CURRENCIES } from '../utils.js';

const SYMBOLS = { EUR: '€', USD: '$', GBP: '£', CHF: '₣' };

export function CurrencyButton({ baseCurrency = 'EUR', setBaseCurrency }) {
  const idx = SUPPORTED_CURRENCIES.indexOf(baseCurrency);
  const next = SUPPORTED_CURRENCIES[(idx + 1) % SUPPORTED_CURRENCIES.length];

  return (
    <button
      className="lang-btn"
      onClick={() => setBaseCurrency && setBaseCurrency(next)}
      title={`Devise : ${baseCurrency} → cliquer pour changer`}
      aria-label="Changer de devise"
    >
      {SUPPORTED_CURRENCIES.map((c, i) => (
        <span key={c}>
          {i > 0 && <span className="lang-btn-sep">·</span>}
          <span className={`lang-btn-side ${c === baseCurrency ? 'on' : ''}`}>
            {SYMBOLS[c] || c}
          </span>
        </span>
      ))}
    </button>
  );
}
