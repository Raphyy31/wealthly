// frontend/src/utils/duplicateDetector.js
//
// Détection de paires probablement doublons.
//
// 2 catégories detectees :
//   A) Account ↔ Asset (legacy unification — un meme actif saisi
//      manuellement comme asset ET importe comme account)
//   B) Account ↔ Account (frequent quand l'user a saisi manuellement
//      "Compte Boursorama" puis a connecte Boursorama via GoCardless
//      -> 2 accounts pour le meme compte, l'un manuel l'autre sync)
//      Ajoute 2026-05-21 suite feedback "mon frere a eu compte en double".
//
// Heuristique stricte (booleenne) — meme nom normalise (Levenshtein <= 0.2)
// + meme membre partage + meme type/role + sources differentes.

const ACCENT_RE = new RegExp('[\\u0300-\\u036F]', 'g');

const normalize = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(ACCENT_RE, '')
  .replace(/\s+/g, ' ')
  .trim();

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

// Helper: 2 items match by name (exact ou Levenshtein <= 0.2 = ~80% similar)
function nameMatch(a, b) {
  const aN = normalize(a);
  const bN = normalize(b);
  if (!aN || !bN) return false;
  return aN === bN || levenshtein(aN, bN) <= 0.2;
}

// Helper: 2 items match by bank (compare bank field si dispo, sinon nom)
function bankMatch(a, b) {
  const aBank = normalize(a.meta?.bank || a.bank || '');
  const bBank = normalize(b.meta?.bank || b.bank || '');
  if (aBank && bBank) return aBank === bBank || levenshtein(aBank, bBank) <= 0.15;
  return false;
}

// Helper: 2 items share at least one member
function shareMember(a, b) {
  const aMems = a.memberIds || [];
  const bMems = b.memberIds || [];
  return aMems.some(m => bMems.includes(m));
}

/**
 * @param {WealthItem[]} items
 * @returns {Array<{accountItem: WealthItem, assetItem: WealthItem, kind: 'account-asset' | 'account-account'}>}
 */
export function detectDuplicates(items) {
  const accounts = items.filter(i => i.sourceTable === 'account');
  const assets   = items.filter(i => i.sourceTable === 'asset');
  const pairs = [];

  // ── Type A : Account ↔ Asset ─────────────────────────────────────────
  for (const ac of accounts) {
    for (const as of assets) {
      if (ac.subtype !== as.subtype) continue;
      if (!nameMatch(ac.name, as.name)) continue;
      if (!shareMember(ac, as)) continue;
      pairs.push({ accountItem: ac, assetItem: as, kind: 'account-asset' });
    }
  }

  // ── Type B : Account ↔ Account (manuel + sync GoCardless) ─────────────
  // On groupe les accounts par bank + nom (Levenshtein <= 0.2), et on
  // detecte les paires (manuel = source 'manual' ou 'csv', sync = source
  // 'gocardless'). Permet a l'user de merger l'ancien account manuel
  // dans le nouveau sync pour ne pas avoir 2 lignes du meme compte.
  for (let i = 0; i < accounts.length; i++) {
    for (let j = i + 1; j < accounts.length; j++) {
      const a = accounts[i];
      const b = accounts[j];
      // Skip si meme id (jamais le cas en theorie mais belt-and-braces)
      if (a.id === b.id) continue;
      // Doit etre meme bank OU meme nom (au moins une condition forte)
      const bankSame = bankMatch(a, b);
      const nameSame = nameMatch(a.name, b.name);
      if (!bankSame && !nameSame) continue;
      // Pour eviter les false positives sur deux comptes differents du
      // meme bank (ex: "Livret A" et "PEA" chez BNP), on exige AUSSI :
      //   - meme subtype/type (checking vs savings)
      //   - meme membre partage
      if (a.subtype !== b.subtype) continue;
      if (!shareMember(a, b)) continue;
      // Si exactement le meme nom OU (meme bank + nom proche) -> doublon
      if (!nameSame) continue;
      // Ordre : on met le "manuel" comme accountItem, le "sync" comme assetItem
      // pour reutiliser le merge modal existant (qui s'attend a ce schema).
      const aIsManual = (a.meta?.source || '') !== 'gocardless';
      const bIsManual = (b.meta?.source || '') !== 'gocardless';
      // Cas typique : 1 manuel + 1 sync -> pair
      if (aIsManual !== bIsManual) {
        const accountItem = aIsManual ? a : b;
        const assetItem   = aIsManual ? b : a;
        pairs.push({ accountItem, assetItem, kind: 'account-account' });
      }
      // Cas 2 sync identiques (rare mais possible si erreur backend) -> pair
      else if (!aIsManual && !bIsManual) {
        pairs.push({ accountItem: a, assetItem: b, kind: 'account-account' });
      }
      // 2 manuels identiques -> probablement erreur user, on signale aussi
      else {
        pairs.push({ accountItem: a, assetItem: b, kind: 'account-account' });
      }
    }
  }

  return pairs;
}
