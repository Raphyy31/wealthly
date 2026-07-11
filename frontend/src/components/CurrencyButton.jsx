import { useState, useRef, useEffect } from 'react';
import { SUPPORTED_CURRENCIES } from '../utils.js';

const LABELS = { EUR: 'Euro', USD: 'Dollar US', GBP: 'Livre sterling', CHF: 'Franc suisse' };
const FLAGS  = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭' };

export function CurrencyButton({ baseCurrency = 'EUR', setBaseCurrency }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="lang-btn"
        onClick={() => setOpen(o => !o)}
        title="Changer de devise d'affichage"
        aria-label="Devise"
      >
        <span className="lang-btn-side on">{baseCurrency}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 6, minWidth: 160,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          zIndex: 200,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {SUPPORTED_CURRENCIES.map(c => (
            <button
              key={c}
              onClick={() => { setBaseCurrency && setBaseCurrency(c); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 7, border: 'none',
                background: c === baseCurrency ? 'var(--primary-soft, rgba(197,165,114,.12))' : 'transparent',
                color: c === baseCurrency ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: c === baseCurrency ? 700 : 400,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ fontSize: 16 }}>{FLAGS[c]}</span>
              <span style={{ flex: 1 }}>{LABELS[c]}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, opacity: .7 }}>{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
