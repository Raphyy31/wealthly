// frontend/src/utils/duplicateDetector.js
//
// Détection de paires (Account, Asset) probablement doublons après l'unification.
// Heuristique stricte (booléenne) — voir spec §3.6.

const normalize = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')   // strip accents
  .replace(/\s+/g, ' ')
  .trim();

// Levenshtein distance, returns ratio in [0, 1] (0 = identical)
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return 1;
  if (!b.length) return 1;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
    }
  }
  return dp[a.length][b.length] / Math.max(a.length, b.length);
};

/**
 * @param {WealthItem[]} items
 * @returns {Array<{accountItem: WealthItem, assetItem: WealthItem}>}
 */
export function detectDuplicates(items) {
  const accounts = items.filter(i => i.sourceTable === 'account');
  const assets   = items.filter(i => i.sourceTable === 'asset');
  const pairs = [];

  for (const ac of accounts) {
    for (const as of assets) {
      if (ac.subtype !== as.subtype) continue;
      const acName = normalize(ac.name);
      const asName = normalize(as.name);
      if (!acName || !asName) continue;
      const sameName = acName === asName || levenshtein(acName, asName) <= 0.2;
      if (!sameName) continue;
      const sharedMember = ac.memberIds.some(m => as.memberIds.includes(m));
      if (!sharedMember) continue;
      pairs.push({ accountItem: ac, assetItem: as });
    }
  }

  return pairs;
}
