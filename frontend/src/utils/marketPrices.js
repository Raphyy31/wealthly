// ============================================================================
// marketPrices — hook unifié pour récupérer des cours live (Yahoo Finance)
//                via le backend /quotes, avec fallback "demo drift" pour
//                que le mode démo reste fonctionnel sans backend joignable.
//
// Conventions :
//   - Crypto    : ticker user (BTC, ETH, SOL) → Yahoo (BTC-EUR, ETH-EUR…)
//   - Stock/ETF : on s'attend à recevoir le ticker Yahoo directement
//                 (CW8.PA, EWLD.PA, MC.PA…). C'est ce qui est stocké dans
//                 le champ asset.tickerYahoo / position.tickerYahoo.
//
// ============================================================================
import { useMemo } from 'react';
import { useQuotes } from '../hooks/useQuotes.js';

const isDemo = () => typeof window !== 'undefined'
  && window.localStorage.getItem('yotori:demo') === '1';

// Convertit un ticker crypto utilisateur (BTC, ETH, SOL…) vers le symbole
// Yahoo. Yahoo accepte directement `BTC-EUR`, `ETH-EUR`, etc. pour les
// 200+ cryptos majeures — pas de mapping bibliothèque à maintenir.
export function cryptoToYahoo(ticker) {
  if (!ticker) return null;
  const t = String(ticker).toUpperCase().trim();
  if (!t) return null;
  // Si l'utilisateur a déjà saisi `BTC-EUR` ou `BTC-USD`, on respecte.
  if (t.includes('-')) return t;
  return `${t}-EUR`;
}

// Hash déterministe pour les "live prices" du mode démo : on génère
// une fluctuation lente entre −5 % et +5 % à partir du ticker + heure
// pour que la démo ait l'air vivante sans dépendre du backend.
function demoDrift(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hours = Date.now() / (3600 * 1000);
  // Onde lente : période ~16h, amplitude ±5 %
  return Math.sin((hours + (h % 32)) * 0.4) * 0.05;
}

// Hook : prend une liste de tickers Yahoo, renvoie `{ prices, loading, fresh, refresh }`
// où `prices` est un dict `{ [yahooSym]: { price, changePct, currency, fetchedAt } }`.
// En mode démo, on synthétise les prix à partir d'un "saisi" passé en
// argument (sinon on ne sait pas par quoi multiplier).
export function useLiveQuotes(yahooTickers, demoSeedPrices = {}) {
  const stable = useMemo(
    () => (yahooTickers || []).filter(Boolean).map(t => String(t).toUpperCase()),
    [yahooTickers]
  );

  // En démo : on ne lance même pas la requête. On synthétise à partir
  // des "saisi" passés en paramètre, avec un drift déterministe.
  if (isDemo()) {
    const out = {};
    for (const sym of stable) {
      const seed = demoSeedPrices[sym];
      if (seed == null) continue;
      const drift = demoDrift(sym);
      out[sym] = {
        symbol: sym,
        price: Number((seed * (1 + drift)).toFixed(4)),
        previousClose: Number(seed.toFixed(4)),
        change: Number((seed * drift).toFixed(4)),
        changePct: Number((drift * 100).toFixed(2)),
        currency: 'EUR',
        fetchedAt: Math.floor(Date.now() / 1000),
        _demo: true,
      };
    }
    return { prices: out, loading: false, refresh: () => {} };
  }

  // Mode réel : on délègue au hook useQuotes existant.
  const { quotes, loading, refresh } = useQuotes(stable);
  return { prices: quotes, loading, refresh };
}

// Helper : formate "il y a X" pour un timestamp Yahoo.
export function relTimeFromTs(ts) {
  if (!ts) return null;
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return `${diff} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}
