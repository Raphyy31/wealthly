// ============================================================================
// useRates — fetch FX rates from open.er-api.com (free, CORS-friendly, no key)
//
// We always fetch with base=EUR so the table shape is
// { USD: 1.08, GBP: 0.85, CHF: 0.97, … }. EUR is the implicit base (1 EUR = 1).
//
// Cache strategy: 1-hour localStorage cache so we don't hit the API on every
// render. On stale cache or first run, fetch in background — UI keeps rendering
// with the previous rates (or empty rates → conversion no-ops).
//
// Fallback to Frankfurter if the primary source fails (different infra so the
// two are unlikely to be down at the same time).
// ============================================================================
import { useEffect, useState, useRef } from 'react';

const CACHE_KEY = 'yotori:fx-rates';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const PRIMARY = 'https://open.er-api.com/v6/latest/EUR';
const FALLBACK = 'https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF';

const pickWanted = (rates) => ({
  USD: rates.USD,
  GBP: rates.GBP,
  CHF: rates.CHF,
});

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.fetchedAt || !parsed.rates) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      return { rates: parsed.rates, date: parsed.date, stale: true };
    }
    return { rates: parsed.rates, date: parsed.date, stale: false };
  } catch {
    return null;
  }
};

const writeCache = (rates, date) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      rates, date, fetchedAt: Date.now(),
    }));
  } catch {
    /* localStorage may be full or disabled — silently ignore */
  }
};

export function useRates() {
  const cached = readCache();
  const [rates, setRates] = useState(cached?.rates || null);
  const [date, setDate] = useState(cached?.date || null);
  const [loading, setLoading] = useState(!cached);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // If cache is fresh and present, nothing to do.
    if (cached && !cached.stale) return;
    // Avoid double-fetch in React strict mode dev / re-renders
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const ctrl = new AbortController();
    setLoading(true);

    const tryFetch = (url, parse) =>
      fetch(url, { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
        .then(parse);

    // open.er-api.com → { result: "success", time_last_update_utc, rates: { USD, GBP, CHF, … } }
    tryFetch(PRIMARY, (d) => {
      if (!d || d.result !== 'success' || !d.rates) throw new Error('bad payload');
      const rates = pickWanted(d.rates);
      // time_last_update_unix is seconds; convert to ISO yyyy-mm-dd to match the previous shape
      const date = d.time_last_update_unix
        ? new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10)
        : null;
      return { rates, date };
    })
      // Frankfurter → { date: "2026-05-08", rates: { USD, GBP, CHF } }
      .catch(() => tryFetch(FALLBACK, (d) => {
        if (!d || !d.rates) throw new Error('bad payload');
        return { rates: pickWanted(d.rates), date: d.date || null };
      }))
      .then(({ rates, date }) => {
        setRates(rates);
        setDate(date);
        writeCache(rates, date);
      })
      .catch(() => {
        /* swallow — UI keeps rendering with cached or no rates */
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rates, date, loading };
}
