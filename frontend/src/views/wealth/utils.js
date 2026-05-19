// ============================================================================
// wealth/utils.js — pure helpers extracted from Wealth.jsx
// ============================================================================

/**
 * Build a display string of member names from IDs.
 * @param {string[]} memberIds
 * @param {Array<{id: string, name: string}>} members
 * @returns {string}
 */
export function ownersList(memberIds = [], members = []) {
  return (memberIds || [])
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(' & ') || '—';
}

/**
 * Deterministic color per position name (cobalt / sage / terracotta / mauve / pink / grey / ocre).
 * @param {string} name
 * @returns {string}
 */
export function positionColor(name) {
  const colors = ['#2540D9', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E', '#7a8aa8'];
  if (!name) return colors[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/**
 * Format a securities quantity — full precision for fractional, rounded for large.
 * @param {number} q
 * @returns {string}
 */
export function formatQty(q) {
  if (q === 0) return '0';
  if (Math.abs(q) >= 100) return q.toFixed(0);
  if (Math.abs(q) >= 1) return q.toFixed(2);
  return q.toFixed(4).replace(/\.?0+$/, '');
}

/**
 * Split a multi-word name into { head, tail } for italic title styling.
 * @param {string} name
 * @returns {{ head: string, tail: string }}
 */
export function splitTitle(name) {
  if (!name) return { head: '—', tail: '' };
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return { head: parts[0], tail: '' };
  return { head: parts[0], tail: parts.slice(1).join(' ') };
}

/**
 * Format a crypto quantity — high precision for sub-unit amounts.
 * @param {number} q
 * @returns {string}
 */
export function formatCryptoQty(q) {
  if (q === 0) return '0';
  if (Math.abs(q) >= 1) return q.toFixed(4).replace(/\.?0+$/, '');
  return q.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Deterministic brand color for a crypto ticker.
 * Known tickers get their official brand color; others fall back to a hash.
 * @param {string} key ticker symbol
 * @returns {string}
 */
export function cryptoColor(key) {
  const fixed = { BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', USDC: '#2775CA', ADA: '#0033AD', DOT: '#E6007A', BNB: '#F0B90B' };
  if (fixed[key]) return fixed[key];
  const colors = ['#2540D9', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E'];
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/** Shared tooltip style object used across dv3 detail modals. */
export const DV3_TOOLTIP = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--ink)',
  boxShadow: 'var(--shadow-md)',
};
