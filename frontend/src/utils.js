// ============================================================================
// Yotori Finance — pure utilities
//
// Formatting, CSV parsing, transaction categorization, recurring detection.
// No React, no DOM access, no network. These functions must remain testable
// in isolation.
// ============================================================================

import { DEFAULT_RULES, BANK_PROFILES } from './constants.js';

// ---- Account roles --------------------------------------------------------
// Five cashflow roles, mapped to a 3-axis ruleset:
//   includeInNetWorth   — does the balance count toward patrimoine net?
//   countsAsIncome      — do positive transactions = real income?
//   countsAsExpense     — do negative transactions = real spending?
//
// Defaults are designed so a fresh-imported account (role='principal') keeps
// the historical behavior — no surprise behavior change for existing data.
export const ACCOUNT_ROLES = {
  principal: {
    label: 'Principal',
    desc: 'Compte courant principal — salaire, dépenses du quotidien.',
    includeInNetWorth: true,
    countsAsIncome: true,
    countsAsExpense: true,
  },
  depenses: {
    label: 'Dépenses secondaires',
    desc: 'Revolut, N26, carte voyage… Les sorties sont des dépenses réelles, mais les entrées sont des virements depuis le compte principal.',
    includeInNetWorth: true,
    countsAsIncome: false,
    countsAsExpense: true,
  },
  epargne: {
    label: 'Épargne',
    desc: 'Livret A, LDDS, PEL… Le solde compte dans le patrimoine, mais les flux entrants/sortants sont des arbitrages, pas du cashflow.',
    includeInNetWorth: true,
    countsAsIncome: false,
    countsAsExpense: false,
  },
  investissement: {
    label: 'Investissement',
    desc: 'PEA, CTO, assurance vie… Le solde compte dans le patrimoine, mais les versements ne sont pas des dépenses.',
    includeInNetWorth: true,
    countsAsIncome: false,
    countsAsExpense: false,
  },
  professionnel: {
    label: 'Professionnel',
    desc: 'Compte pro / micro-entreprise — entièrement exclu du patrimoine personnel et du cashflow mensuel.',
    includeInNetWorth: false,
    countsAsIncome: false,
    countsAsExpense: false,
  },
};

export const ACCOUNT_ROLE_KEYS = Object.keys(ACCOUNT_ROLES);

// GoCardless utilise parfois l'identifiant technique de l'institution comme
// nom de connexion (ex. BNP_PARIBAS_BNPAFRPP). Cette fonction garantit que
// l'interface affiche un nom bancaire lisible sans modifier l'identifiant
// canonique envoyé à l'API.
const KNOWN_BANK_NAMES = [
  ['LA_BANQUE_POSTALE', 'La Banque Postale'],
  ['BANQUE_POPULAIRE', 'Banque Populaire'],
  ['CAISSE_EPARGNE', "Caisse d'Épargne"],
  ['CREDIT_AGRICOLE', 'Crédit Agricole'],
  ['CREDIT_MUTUEL', 'Crédit Mutuel'],
  ['SOCIETE_GENERALE', 'Société Générale'],
  ['AMERICAN_EXPRESS', 'American Express'],
  ['BNP_PARIBAS', 'BNP Paribas'],
  ['BOURSORAMA', 'Boursorama'],
  ['REVOLUT', 'Revolut'],
  ['FORTUNEO', 'Fortuneo'],
  ['HELLO_BANK', 'Hello bank!'],
  ['N26', 'N26'],
  ['QONTO', 'Qonto'],
  ['LCL', 'LCL'],
  ['CIC', 'CIC'],
];

export function formatBankName(rawName, preferredName = null) {
  if (preferredName && !String(preferredName).includes('_')) return String(preferredName).trim();
  const raw = String(rawName || preferredName || '').trim();
  if (!raw) return 'Banque';
  const upper = raw.toUpperCase();
  const known = KNOWN_BANK_NAMES.find(([prefix]) => upper === prefix || upper.startsWith(`${prefix}_`));
  if (known) return known[1];
  const parts = raw.split('_').filter(Boolean);
  if (parts.length > 1 && /^[A-Z0-9]{8,11}$/.test(parts[parts.length - 1])) parts.pop();
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, char => char.toUpperCase());
}

// Deterministic color from a bank name string (used for sidebar dots,
// Settings account avatars, future drawer headers…). Uses the v3 dataviz
// palette so bank chips harmonise with charts. Same string → same color.
export const bankColor = (name) => {
  const colors = ['#0E7C56', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E', '#7a8aa8'];
  if (!name) return colors[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
};

// Sort accounts by role priority (principal first, then depenses, epargne,
// investissement, professionnel), then alphabetically by display name within
// the same role. Used in the sidebar mini-list and Réglages → Comptes so
// the user sees their main account on top and related satellites (Revolut,
// AMEX…) grouped right below it.
export const sortAccountsByRole = (accounts) => {
  const orderOf = (role) => {
    const i = ACCOUNT_ROLE_KEYS.indexOf(role || 'principal');
    return i === -1 ? ACCOUNT_ROLE_KEYS.length : i;
  };
  return [...(accounts || [])].sort((a, b) => {
    const ra = orderOf(a.role), rb = orderOf(b.role);
    if (ra !== rb) return ra - rb;
    return (a.name || a.bank || '').localeCompare(b.name || b.bank || '');
  });
};

export const accountIncludeInNetWorth = (role) => (ACCOUNT_ROLES[role] || ACCOUNT_ROLES.principal).includeInNetWorth;
export const accountCountsAsIncome = (role) => (ACCOUNT_ROLES[role] || ACCOUNT_ROLES.principal).countsAsIncome;
export const accountCountsAsExpense = (role) => (ACCOUNT_ROLES[role] || ACCOUNT_ROLES.principal).countsAsExpense;

// Montant réellement mis de côté par une transaction.
//
// Une épargne mensuelle est une SORTIE depuis un compte qui participe au
// budget (principal / dépenses) vers un support d'épargne. L'ancienne logique
// utilisait Math.abs : un retrait depuis un Livret, ou sa jambe créditrice sur
// le compte courant, devenait alors artificiellement de l'« épargne ».
// Les comptes épargne / investissement sont déjà dans le patrimoine : leurs
// mouvements internes ne créent pas une nouvelle épargne.
export const savingsContributionAmount = (transaction, sourceAccount, share = 1) => {
  const amount = Number(transaction?.sharedAmount ?? transaction?.amount ?? 0);
  if (!Number.isFinite(amount) || amount >= 0) return 0;
  if (!accountCountsAsExpense(sourceAccount?.role || 'principal')) return 0;
  return Math.max(0, -amount * share);
};

// ─── Virements internes typés ───────────────────────────────────────
// Une transaction marquee comme virement interne peut etre de 2 types :
//
//   "savings"   = vers un compte d'epargne (Livret A, LDDS, PEA...).
//                 Compte comme epargne (ajoute a realTotals.saving), pas
//                 comme depense. Utile quand le compte cible n'est pas
//                 synchro -> l'utilisateur veut que le 1000 EUR aille en
//                 epargne plutot que d'etre simplement neutralise.
//
//   "secondary" = vers un compte de depenses secondaires (Revolut, N26).
//                 Neutralise pour le cashflow (ni depense, ni epargne).
//                 Les vraies depenses seront tracees sur le compte cible.
//
// Stocke via un tag sur la tx au format "transfer-dest:<account_id>".
// Le type est derive du role du compte cible.
const TRANSFER_DEST_TAG_PREFIX = 'transfer-dest:';

export const getTransferDestAccountId = (tx) => {
  const tags = tx?.tags || [];
  const tag = tags.find(t => typeof t === 'string' && t.startsWith(TRANSFER_DEST_TAG_PREFIX));
  return tag ? tag.slice(TRANSFER_DEST_TAG_PREFIX.length) : null;
};

export const buildTransferDestTag = (accountId) => `${TRANSFER_DEST_TAG_PREFIX}${accountId}`;

// ─── Regles de marquage automatique de virement ────────────────────
// Persistance backend : table categorisation_rules avec rule_type='transfer'
// et colonne transfer_dest_account_id (cf 0008_transfer_rule_dest migration).
// Une regle = { id, pattern, transferDestAccountId } cote frontend (camelCase).
//
// Le pattern est applique en substring case-insensitive sur le label.

export const matchTransferRule = (tx, rules) => {
  if (!tx?.label || !Array.isArray(rules) || rules.length === 0) return null;
  const label = tx.label.toUpperCase();
  for (const r of rules) {
    if (!r.pattern) continue;
    if (label.includes(r.pattern.toUpperCase())) {
      return { destAccountId: r.transferDestAccountId || r.transfer_dest_account_id, rule: r };
    }
  }
  return null;
};

// Determine le type d'un virement interne :
//   - 'savings'   si destination est un compte de role 'epargne' (ou 'investissement')
//   - 'secondary' si destination est un compte de role 'depenses' (Revolut...)
//   - null        sinon (destination inconnue, role principal, etc.)
export const getTransferType = (tx, accounts) => {
  const destId = getTransferDestAccountId(tx);
  if (!destId) return null;
  const dest = (accounts || []).find(a => a.id === destId);
  if (!dest) return null;
  const role = dest.role || 'principal';
  if (role === 'epargne' || role === 'investissement') return 'savings';
  if (role === 'depenses') return 'secondary';
  return null;
};

// Heuristic role suggestion from transaction patterns. Returns
// { role, confidence } where confidence is 'high' | 'medium' | 'low'. Used
// in the Settings UI to nudge the user when the freshly-imported default
// 'principal' is clearly wrong (e.g. a Revolut top-up account, a Livret).
//
// Rules (evaluated in order, first match wins):
//   • Salary pattern (≥2 recurring large positives ≥ 1 200€ around month-end)
//     → principal
//   • ≥80% of inflow € comes from one other account in `otherAccounts`
//     → depenses (it's a spend bucket fed from somewhere else)
//   • Mostly transfers (≥70% of total tx count have round amounts > 100€
//     and category is empty/transfer)                            → epargne
//   • Negative-only or near-zero outflows but positive net        → epargne
//   • Mostly small recurrent expenses, some inflow                → principal
// Otherwise → unknown (no suggestion).
export const suggestAccountRole = (transactions, otherAccountIds = []) => {
  if (!Array.isArray(transactions) || transactions.length < 5) {
    return { role: null, confidence: 'low', reason: 'Pas assez de transactions pour estimer.' };
  }
  const inflows = transactions.filter(t => t.amount > 0);
  const outflows = transactions.filter(t => t.amount < 0);
  const totalIn = inflows.reduce((s, t) => s + t.amount, 0);
  const totalOut = outflows.reduce((s, t) => s + Math.abs(t.amount), 0);

  // Salary-like recurrence: ≥2 inflows ≥ 1 200€ in the last 90 days, on
  // similar days-of-month (within 5 days of each other).
  const big = inflows.filter(t => t.amount >= 1200);
  if (big.length >= 2) {
    const days = big.map(t => new Date(t.date).getDate());
    const dayRange = Math.max(...days) - Math.min(...days);
    if (dayRange <= 5) {
      return { role: 'principal', confidence: 'high', reason: `Salaire détecté (${big.length} entrées ≥ 1 200€ autour du même jour du mois).` };
    }
  }

  // Internal-transfer dominance: most inflows look like virements from
  // your own accounts. We can't introspect amounts here cheaply, so we
  // approximate via labels — if 60%+ of inflows have a virement-like
  // label, treat as a depenses bucket.
  const virementInflows = inflows.filter(t => /\b(virement|transfer|transfert|wise|revolut|to\s+\w+)\b/i.test(t.label || ''));
  if (inflows.length >= 3 && virementInflows.length / inflows.length >= 0.6 && outflows.length >= 5) {
    return { role: 'depenses', confidence: 'medium', reason: `${Math.round((virementInflows.length / inflows.length) * 100)}% des entrées ressemblent à des virements depuis un autre compte.` };
  }

  // Savings-like: lots of round inflows, few small outflows.
  const roundInflows = inflows.filter(t => Math.abs(t.amount % 50) < 0.01 && t.amount >= 100);
  if (roundInflows.length / Math.max(transactions.length, 1) >= 0.5 && outflows.length <= 3) {
    return { role: 'epargne', confidence: 'medium', reason: 'Surtout des versements ronds, peu de dépenses individuelles.' };
  }

  // Net positive without recurrence + few outflows → likely épargne
  if (totalIn > totalOut * 3 && outflows.length <= 5) {
    return { role: 'epargne', confidence: 'low', reason: 'Solde net très positif et peu de sorties — comportement de compte épargne.' };
  }

  // Default: principal — too noisy a pattern to label otherwise
  return { role: 'principal', confidence: 'low', reason: 'Mélange entrées / sorties habituel pour un compte courant.' };
};

// ---- Internal-transfer detection -----------------------------------------
// Pair-match transactions that look like "I moved money between two of my
// own accounts" so the cashflow aggregator can ignore them — otherwise a
// virement of €1 000 from principal to épargne would inflate both expenses
// and income by €1 000.
//
// Pairing rules:
//   1. Absolute amounts within tolerance (1€ or 1% of the larger, whichever
//      is bigger) — accommodates Wise / forex where commission shaves a few
//      euros off the receiving leg
//   2. Opposite signs (one positive, one negative)
//   3. Two distinct accounts that the user owns
//   4. Within ±windowDays days of each other (default 3 — covers slow IBAN
//      virements that take 2 banking days)
//   5. Each transaction can only be matched once (greedy, earliest-first,
//      best amount-match wins for a given outflow)
//
// Returns a Set<txId> of transactions identified as one side of a transfer.
// O(n²) worst case but in practice tiny — the windowDays filter prunes
// aggressively for any reasonable dataset.
const TRANSFER_LABEL_HINT = /\b(virement|transfer|transfert|vir\.?\s|to\s+\w+|from\s+\w+|wise|revolut)\b/i;
const TRANSFER_AMOUNT_TOLERANCE_ABS = 1.0;     // 1€ floor
const TRANSFER_AMOUNT_TOLERANCE_PCT = 0.01;    // 1% of the larger leg

const amountsMatch = (a, b) => {
  const aa = Math.abs(a);
  const ab = Math.abs(b);
  const tol = Math.max(TRANSFER_AMOUNT_TOLERANCE_ABS, Math.max(aa, ab) * TRANSFER_AMOUNT_TOLERANCE_PCT);
  return Math.abs(aa - ab) <= tol;
};

// A bank credit can be a household contribution even when the source account
// is not connected. Keep this deliberately stricter than TRANSFER_LABEL_HINT:
// card refunds and merchant reimbursements must remain real cashflow.
const BANK_TRANSFER_CREDIT_HINT = /\b(virement|transfer|transfert|vir\.?\s|sepa)\b/i;
const CARD_REFUND_HINT = /\b(avoir\s+carte|remboursement\s+carte|refund|chargeback|annulation\s+carte)\b/i;

export const isExplicitBankTransfer = (transaction) => {
  if (!transaction) return false;
  const label = String(transaction.label || transaction.description || '');
  return BANK_TRANSFER_CREDIT_HINT.test(label) && !CARD_REFUND_HINT.test(label);
};

// Compatibilité avec les comptes créés avant l'ajout du flag `is_joint` : un
// compte ayant plusieurs titulaires est, fonctionnellement, déjà commun.
export const isJointAccount = (account) =>
  !!account && (account.isJoint === true || (account.memberIds || []).length > 1);

export const isJointAccountFunding = (transaction, account, category, enabled = true) => {
  if (!enabled || !isJointAccount(account) || (transaction?.amount || 0) <= 0) return false;
  if (!isExplicitBankTransfer(transaction)) return false;
  // The only explicit escape hatch: the user marked the operation as NOT a
  // transfer while it belongs to an income category.
  return !(transaction?.isTransferOverride === false && category?.type === 'income');
};

// Ventilation 50/30/20 à partir de transactions DÉJÀ filtrées pour le mois
// et le scope affichés. Les montants non catégorisés restent visibles au lieu
// d'être rangés arbitrairement dans « envies ».
export const buildBudgetAllocation = (transactions = [], categories = []) => {
  const result = { needs: 0, wants: 0, savings: 0, unclassified: 0, total: 0 };
  for (const transaction of transactions) {
    const amount = Number(transaction.sharedAmount ?? transaction.amount ?? 0);
    if (amount >= 0 || transaction.budgetKind === 'funding' || transaction.budgetKind === 'income') continue;
    const value = Math.abs(amount);
    const categoryId = transaction.budgetCategoryId || transaction.categoryId;
    const category = categories.find(c => c.id === categoryId || c.slug === categoryId);
    let bucket = transaction.budgetKind === 'saving' ? 'savings' : category?.kind;
    if (categoryId === 'uncategorized' || !['needs', 'wants', 'savings'].includes(bucket)) bucket = 'unclassified';
    result[bucket] += value;
    result.total += value;
  }
  return result;
};

const normalizePersonText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .trim()
  .toUpperCase();

// Returns a friendly contributor name for a transfer credited to a joint
// account. Prefer household members, then fall back to the bank-provided name.
export const extractTransferContributor = (transaction, members = []) => {
  if (!isExplicitBankTransfer(transaction)) return null;
  const normalized = normalizePersonText(transaction.label || transaction.description || '');
  const labelWords = normalized.split(' ');
  for (const member of members) {
    const tokens = normalizePersonText(member?.name).split(' ').filter(token => token.length >= 2);
    const tokenMatches = (token) => normalized.includes(token)
      // Some banks truncate first names (e.g. CAR for Carla). Three letters
      // are accepted only inside an explicit bank-transfer label.
      || (token.length >= 4 && labelWords.some(word => word.length >= 3 && token.startsWith(word)));
    if (tokens.length && tokens.every(tokenMatches)) return member.name;
  }

  const source = normalized
    .replace(/^.*?\b(?:FAVEUR|PROVENANCE|EMETTEUR|ORDRE)\s+(?:DE|DU|D)\s+/, '')
    .replace(/^.*?\b(?:DE|FROM)\s+/, '')
    .replace(/\b(?:MONSIEUR|MADAME|MELLE|MLLE|MR|MME|M\s+OU\s+MME)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source || source === normalized || source.length < 2) return 'Autre contributeur';
  return source.toLocaleLowerCase('fr-FR').replace(/(^|[ '-])\p{L}/gu, c => c.toLocaleUpperCase('fr-FR'));
};

export const detectInternalTransfers = (transactions, options = {}) => {
  // C15 (2026-05-18) : fenêtre élargie 3j → 5j pour couvrir les virements
  // bancaires lents (SEPA 24-72h, weekend, jours fériés).
  // A label hint is now required by default. Amount/date-only matching caused
  // real card expenses to disappear when an unrelated credit had the same
  // amount on another account. Callers can still opt out explicitly.
  const { windowDays = 5, requireLabelHint = true } = options;
  const transferIds = new Set();
  const pairs = []; // [{ outTxId, inTxId, fromAccountId, toAccountId, amount, date }]
  if (!Array.isArray(transactions) || transactions.length < 2) {
    transferIds.pairs = pairs;
    return transferIds;
  }

  const sorted = [...transactions]
    .filter(t => t && typeof t.amount === 'number' && t.amount !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const windowMs = windowDays * 86400000;
  const matched = new Set();

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (matched.has(a.id)) continue;
    let bestJ = -1;
    let bestDelta = Infinity;
    const aDate = new Date(a.date).getTime();
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const bDate = new Date(b.date).getTime();
      if (bDate - aDate > windowMs) break;
      if (matched.has(b.id)) continue;
      if (a.accountId === b.accountId) continue;
      if (Math.sign(a.amount) === Math.sign(b.amount)) continue;
      if (!amountsMatch(a.amount, b.amount)) continue;
      if (requireLabelHint) {
        const blob = `${a.label || ''} ${b.label || ''}`;
        if (!TRANSFER_LABEL_HINT.test(blob)) continue;
      }
      const delta = Math.abs(Math.abs(a.amount) - Math.abs(b.amount));
      if (delta < bestDelta) {
        bestDelta = delta;
        bestJ = j;
      }
    }
    if (bestJ !== -1) {
      const b = sorted[bestJ];
      transferIds.add(a.id);
      transferIds.add(b.id);
      matched.add(a.id);
      matched.add(b.id);
      const out = a.amount < 0 ? a : b;
      const inLeg = a.amount < 0 ? b : a;
      pairs.push({
        outTxId: out.id,
        inTxId: inLeg.id,
        fromAccountId: out.accountId,
        toAccountId: inLeg.accountId,
        amount: Math.abs(out.amount),
        date: out.date < inLeg.date ? out.date : inLeg.date,
      });
    }
  }
  // Attach pairs as a property on the Set so existing callers that just
  // need ID membership keep working unchanged.
  transferIds.pairs = pairs;
  return transferIds;
};

// ---- Formatting ------------------------------------------------------------

// Supported display currencies for Yotori Finance. Adding more is a one-line addition
// here + Frankfurter handles ~30 ISO codes natively.
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

export const CURRENCY_LOCALE = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  CHF: 'de-CH',
};

/**
 * Convert an amount from one ISO currency to another using a rates table
 * shaped like { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.97 } (rates relative
 * to the base of the table — Frankfurter returns rates relative to the
 * `from` parameter so we always fetch with base=EUR and convert through it).
 *
 * Returns the amount unchanged if either currency is unknown or if rates
 * are missing — never throws so the UI keeps rendering even without rates.
 */
export const convertCurrency = (amount, fromCurrency, toCurrency, rates) => {
  if (!amount || amount === 0) return amount;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return amount;
  if (!rates) return amount;
  // rates are EUR-base (1 EUR = X foreign). To go from→to via EUR:
  //   amountEUR  = amount / rates[from]
  //   amountTo   = amountEUR * rates[to]
  const r = (c) => (c === 'EUR' ? 1 : rates[c]);
  const fromR = r(fromCurrency);
  const toR = r(toCurrency);
  if (!fromR || !toR) return amount;
  return (amount / fromR) * toR;
};

export const formatCurrency = (amount, options = {}) => {
  const { compact = false, sign = false, currency = 'EUR', abbr = false } = options;
  const locale = CURRENCY_LOCALE[currency] || 'fr-FR';
  if (amount == null || !Number.isFinite(amount)) return '—';
  // signDisplay: 'exceptZero' → "+1 234,56 €" pour positifs, "-1 234,56 €" pour
  // négatifs, sans préfixe pour 0. Garantit que le sign est rendu dans le
  // même Intl style (U+002D pour fr-FR, pas un mix hyphen/minus).
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: (compact || abbr) ? 'compact' : 'standard',
    maximumFractionDigits: (compact || abbr) ? 1 : 2,
    minimumFractionDigits: (compact || abbr) ? 0 : 2,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(amount);
};

// Élargit le séparateur de milliers pour les très grands nombres (titres hero).
// Intl fr-FR utilise une espace fine insécable (U+202F) qui devient illisible à
// 44px avec un letter-spacing serré ("29632,90"). On la remplace par une espace
// insécable normale (U+00A0), plus large et fiable quelle que soit la police.
export const wideThousands = (s) => String(s).replace(/\s/g, " ");

// Format FR strict pour les pourcentages : "12,5 %" avec espace insécable
// fine (U+202F) avant le %, cohérent avec ce que produit Intl.NumberFormat.
// Options : { digits: 1, sign: false } — sign=true préfixe "+" si positif.
export const formatPct = (value, options = {}) => {
  const { digits = 1, sign = false } = options;
  if (value == null || !Number.isFinite(value)) return '—';
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
  if (sign && value > 0) return '+' + formatted;
  return formatted;
};

// Compact pour grandes valeurs : "1,2 M€", "284 k€", "284 €". Utilise toujours
// fr-FR pour assurer la cohérence visuelle (espace insécable fine).
export const formatCompact = (amount, currency = 'EUR') => {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(amount);
};

// ─────────────────────────────────────────────────────────────────────────
//  Système numérique canonique (C3) — fmtAmount + formatDelta
//
//  Quatre modes documentés pour aligner le rendu monétaire sur toute l'app.
//  Les composants doivent passer par fmtAmount() plutôt que d'appeler
//  formatCurrency/formatCompact/toFixed/Intl directement (audit 2026-05-18 :
//  63 callsites bypass actuels à migrer en C4..C9).
//
//    hero    → relevé complet, deux décimales, séparateurs FR strict
//              ex. "124 532,00 €"  (Dashboard hero net worth, Wealth total)
//    card    → notation compacte 1 décimale (k / M)
//              ex. "124,5 k€"      (KPI cards mobile, Wealth list rows)
//    inline  → entier sans décimales, séparateurs FR
//              ex. "5 432 €"       (badges, deltas court format, tooltips)
//    delta   → entier avec signe explicite (+ ou -)
//              ex. "+5 432 €"       (variations 30j/3M/YTD, comparatifs)
//
//  Options : { currency = 'EUR' }. Le signe est imposé par le mode delta ;
//  les autres modes affichent le signe naturel (− pour négatif uniquement).
// ─────────────────────────────────────────────────────────────────────────
export const fmtAmount = (value, mode = 'hero', options = {}) => {
  const { currency = 'EUR' } = options;
  if (value == null || !Number.isFinite(value)) return '—';
  const locale = CURRENCY_LOCALE[currency] || 'fr-FR';

  if (mode === 'hero') {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  }
  if (mode === 'card') {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency,
      notation: 'compact',
      maximumFractionDigits: 1, minimumFractionDigits: 0,
    }).format(value);
  }
  if (mode === 'inline') {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency,
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  }
  if (mode === 'delta') {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency,
      minimumFractionDigits: 0, maximumFractionDigits: 0,
      signDisplay: 'exceptZero',
    }).format(value);
  }
  // fallback safety
  return formatCurrency(value, { currency });
};

// ─────────────────────────────────────────────────────────────────────────
//  formatDelta(value, mode, options) → { symbol, formatted, kind }
//
//  Helper qui renvoie un objet structuré pour rendre un delta avec chevron
//  ▲/▼ (Geist Mono, jamais translate) et la sémantique pos/neg/neutral.
//
//    mode = 'amount' → utilise fmtAmount(value, 'delta', ...)
//    mode = 'pct'    → utilise formatPct(value, { digits: 1, sign: true })
//
//  Le composant consommateur doit :
//    <span class="ds-delta ds-delta--{kind}">
//      <span class="ds-delta-chevron">{symbol}</span> {formatted}
//    </span>
//
//  kind ∈ {'pos','neg','neutral'} — couleur sémantique appliquée via CSS.
// ─────────────────────────────────────────────────────────────────────────
export const formatDelta = (value, mode = 'amount', options = {}) => {
  if (value == null || !Number.isFinite(value)) {
    return { symbol: '·', formatted: '—', kind: 'neutral', raw: null };
  }
  const kind = value > 0 ? 'pos' : value < 0 ? 'neg' : 'neutral';
  const symbol = value > 0 ? '▲' : value < 0 ? '▼' : '·';
  const formatted = mode === 'pct'
    ? formatPct(value, { digits: 1, sign: true })
    : fmtAmount(value, 'delta', options);
  return { symbol, formatted, kind, raw: value };
};

export const formatDate = (dateStr, options = {}) => {
  const { format = 'short' } = options;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (format === 'short') return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  if (format === 'long') return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  if (format === 'monthYear') return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  if (format === 'monthLong') return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  if (format === 'day') return d.toLocaleDateString('fr-FR', { day: 'numeric' });
  return d.toLocaleDateString('fr-FR');
};

export const monthKey = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Construit le snapshot envoyé à /ai/insights. TOUS les chiffres sont calculés
// ici (déterministe) — l'IA ne fait que la synthèse/formulation. Détecte aussi
// les signaux d'alerte factuels (pics de dépense par catégorie, creux de tréso).
export const buildInsightsSnapshot = ({
  transactions = [], categories = [], currentMonth,
  netWorth = null, liquidWealth = null,
  monthIncome = 0, monthExpenses = 0, monthSavings = 0,
  troughAmount = null, troughDate = null, currency = 'EUR',
}) => {
  const round = (v) => (v == null ? null : Math.round(v));
  const fmtInt = (v) => `${Math.round(Math.abs(v))}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  const catName = (id) => {
    const c = categories.find(x => x.slug === id || x.id === id);
    return c?.name || 'Autre';
  };
  const shiftMonth = (mk, delta) => {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const prev3 = [1, 2, 3].map(k => shiftMonth(currentMonth, -k));

  // Somme des dépenses par (catégorie, mois)
  const byCat = {};
  transactions.forEach(t => {
    if (!t || t.amount >= 0) return; // dépenses uniquement
    const mk = monthKey(t.date);
    const cid = t.categoryId || 'uncategorized';
    (byCat[cid] = byCat[cid] || {});
    byCat[cid][mk] = (byCat[cid][mk] || 0) + Math.abs(t.amount);
  });

  const top = Object.entries(byCat).map(([cid, months]) => {
    const cur = months[currentMonth] || 0;
    const avg3 = prev3.reduce((s, m) => s + (months[m] || 0), 0) / 3;
    return { name: catName(cid), amount: round(cur), avg3m: round(avg3) };
  }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5);

  const alert_signals = [];
  top.forEach(c => {
    if (c.avg3m > 0 && c.amount > c.avg3m * 1.4 && (c.amount - c.avg3m) > 50) {
      const pct = Math.round((c.amount / c.avg3m - 1) * 100);
      alert_signals.push({
        kind: 'category_spike', severity: 'warn',
        label: `${c.name} : ${fmtInt(c.amount)} ce mois (+${pct} % vs votre moyenne)`,
        amount: c.amount,
      });
    }
  });
  if (troughAmount != null && troughAmount < 0) {
    alert_signals.push({
      kind: 'low_runway', severity: 'warn',
      label: `Trésorerie projetée sous zéro (${fmtInt(troughAmount)})${troughDate ? ` le ${troughDate}` : ''}`,
      amount: round(troughAmount),
    });
  }

  const savings_rate_pct = monthIncome > 0 ? Math.round((monthSavings / monthIncome) * 100) : null;

  return {
    currency,
    net_worth: round(netWorth),
    liquid_wealth: round(liquidWealth),
    savings_rate_pct,
    month_income: round(monthIncome),
    month_expenses: round(monthExpenses),
    month_savings: round(monthSavings),
    top_categories: top,
    alert_signals,
    projection_trough_amount: round(troughAmount),
    projection_trough_date: troughDate || null,
  };
};

export const dayOfMonth = (dateStr) => {
  const d = new Date(dateStr);
  return d.getDate();
};

// effectiveMonth — mois "comptable" d'une transaction, qui peut différer
// du mois civil de sa date. Cas d'usage français : le salaire est viré
// fin avril (28-30) mais finance les dépenses de mai. Sans shift, Monthly
// affiche "Mai 2026 = 0€ d'entrées" alors qu'il y a un salaire en avril.
//
// Règles :
//   1. Si tx.effective_month_override est defini → utilise-le (per-tx manual).
//   2. Sinon si la tx est de type revenu (cat.type === 'income') ET datee
//      le jour `pivotDay` ou apres ET shift active → mois suivant.
//   3. Sinon → mois civil normal.
//
// `categories` est nécessaire pour résoudre cat.type. Si pas dispo, on
// fallback sur monthKey classique (pas de risque de mal-attribuer).
//
// `settings` = { enabled: boolean, pivotDay: 1..31 } — typiquement lu
// depuis localStorage 'yotori:income_shift' (default { enabled: true,
// pivotDay: 25 }).
// shiftJointContrib : décale AUSSI au mois suivant les virements de fin de mois
// vers le compte commun (traités comme une dépense du perso qui finance le mois
// suivant — même logique que le salaire). Activé par défaut : l’utilisateur
// peut toujours décocher l’option ou retirer le statut « joint » du compte.
export const INCOME_SHIFT_DEFAULTS = { enabled: true, pivotDay: 25, shiftJointContrib: true };

// Mois d'attribution d'une date selon le jour pivot : si le jour >= pivot, on
// bascule au mois suivant (le flux de fin de mois finance le mois d'après).
export const shiftMonthForDate = (dateStr, pivotDay) => {
  const d = new Date(dateStr);
  if (d.getDate() < pivotDay) return monthKey(dateStr);
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};

export const effectiveMonth = (tx, settings, categories) => {
  if (!tx?.date) return null;
  // Override manuel per-tx — prioritaire absolu
  if (tx.effective_month_override) return tx.effective_month_override;

  const cfg = { ...INCOME_SHIFT_DEFAULTS, ...(settings || {}) };
  if (!cfg.enabled) return monthKey(tx.date);

  // Critère élargi : on shift toute transaction de MONTANT POSITIF reçue
  // le jour pivot ou après, quelle que soit sa catégorie. C'est plus
  // robuste que filtrer par cat.type === 'income' qui ratait les salaires
  // mal categorises (auto-detectes comme "Virements internes" par exemple).
  // Les dépenses (montant négatif) ne shiftent JAMAIS (sauf virement au compte
  // commun, géré à part dans monthlyEvolution via shiftMonthForDate).
  const amount = tx.sharedAmount ?? tx.amount ?? 0;
  if (amount <= 0) return monthKey(tx.date);

  return shiftMonthForDate(tx.date, cfg.pivotDay);
};

// Helper pour savoir si une tx est SHIFTÉE par rapport à sa date civile.
// Utile pour afficher un badge "→ mois X" dans la liste Transactions.
export const isIncomeShifted = (tx, settings, categories) => {
  if (!tx?.date) return false;
  if (tx.effective_month_override) return tx.effective_month_override !== monthKey(tx.date);
  const eff = effectiveMonth(tx, settings, categories);
  return eff !== monthKey(tx.date);
};

// Lit le réglage shift depuis localStorage (default = enabled + pivot 25).
// Volontairement synchrone — pas besoin de hook React, c'est lu rarement.
export const readIncomeShiftSetting = () => {
  try {
    const raw = localStorage.getItem('yotori:income_shift');
    if (!raw) return INCOME_SHIFT_DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false, // default true si absent
      pivotDay: Math.min(31, Math.max(1, parseInt(parsed.pivotDay) || INCOME_SHIFT_DEFAULTS.pivotDay)),
      shiftJointContrib: parsed.shiftJointContrib !== false, // default true si absent
    };
  } catch {
    return INCOME_SHIFT_DEFAULTS;
  }
};

export const writeIncomeShiftSetting = (settings) => {
  try {
    localStorage.setItem('yotori:income_shift', JSON.stringify(settings));
  } catch {}
};

export const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const hashTransaction = (tx) => `${tx.accountId}|${tx.date}|${tx.amount.toFixed(2)}|${(tx.label || '').slice(0, 50).toLowerCase().trim()}`;

// ---- CSV parsing -----------------------------------------------------------

export const detectDelimiter = (text) => {
  const sample = text.split('\n').slice(0, 5).join('\n');
  const counts = { ';': (sample.match(/;/g) || []).length, ',': (sample.match(/,/g) || []).length, '\t': (sample.match(/\t/g) || []).length };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

export const parseCSVLine = (line, delimiter) => {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) { result.push(current); current = ''; }
    else current += c;
  }
  result.push(current);
  return result.map(s => s.trim());
};

export const parseCSV = (text) => {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], delimiter };
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const cells = parseCSVLine(lines[i], delimiter);
    const numeric = cells.filter(c => /^[-+]?\d+([.,]\d+)?$/.test(c.replace(/\s/g, ''))).length;
    if (numeric / cells.length < 0.3 && cells.length >= 2) { headerIdx = i; break; }
  }
  const headers = parseCSVLine(lines[headerIdx], delimiter);
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows, delimiter };
};

export const detectBankProfile = (headers) => {
  for (const [id, profile] of Object.entries(BANK_PROFILES)) {
    if (profile.detect(headers)) return { id, profile };
  }
  return null;
};

export const autoDetectMapping = (headers) => {
  const mapping = { date: null, label: null, amount: null, debit: null, credit: null, balance: null };
  const lowerHeaders = headers.map(h => h.toLowerCase());
  for (let i = 0; i < headers.length; i++) {
    const h = lowerHeaders[i];
    if (!mapping.date && /date.*op|date.*val|^date$|date.*compt|date de d.but/i.test(h)) mapping.date = headers[i];
    else if (!mapping.label && /libell|description|d.tail|nature|op.ration|memo/i.test(h)) mapping.label = headers[i];
    else if (!mapping.debit && /^d.bit|montant.*d.bit/i.test(h)) mapping.debit = headers[i];
    else if (!mapping.credit && /^cr.dit|montant.*cr.dit/i.test(h)) mapping.credit = headers[i];
    else if (!mapping.amount && /montant|amount/i.test(h)) mapping.amount = headers[i];
    else if (!mapping.balance && /solde|balance/i.test(h)) mapping.balance = headers[i];
  }
  if (!mapping.date) for (const h of headers) if (/date/i.test(h)) { mapping.date = h; break; }
  return mapping;
};

export const parseAmount = (str) => {
  if (str === null || str === undefined || str === '') return 0;
  if (typeof str === 'number') return str;
  let s = String(str).replace(/[€$£\s ]/g, '').trim();
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const parseDate = (str) => {
  if (!str) return null;
  str = String(str).trim();
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const [_, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
};

export const applyMapping = (rows, mapping, accountId, options = {}) => {
  return rows.map(row => {
    const date = parseDate(row[mapping.date]);
    if (!date) return null;
    const label = String(row[mapping.label] || '').trim();
    let amount = 0;
    if (mapping.amount) amount = parseAmount(row[mapping.amount]);
    else if (mapping.debit || mapping.credit) {
      const debit = parseAmount(row[mapping.debit]);
      const credit = parseAmount(row[mapping.credit]);
      amount = credit - debit;
      if (debit === 0 && credit === 0) return null;
    }
    if (options.skipPending && mapping.state && row[mapping.state] && /en cours|pending/i.test(row[mapping.state])) return null;
    if (options.includeFeesInAmount && mapping.fees) {
      const fees = parseAmount(row[mapping.fees]);
      if (fees > 0 && amount < 0) amount -= fees;
    }
    if (amount === 0 && !label) return null;
    return {
      id: generateId(),
      accountId,
      date,
      label,
      amount,
      categoryId: null,
      isManualCategory: false,
      isFixed: null,
      notes: '',
    };
  }).filter(Boolean);
};

// ---- Categorization & recurring detection ----------------------------------

// Extract the real merchant from a French bank transaction label, stripping:
//   - FR bank prefixes ("Paiement par carte", "Prélèvement"…)
//   - Card masks ("PAIEMENT PAR CARTE X8987")
//   - Payment processors that prefix the actual merchant with " * "
//     (PAYPAL *NESPRESSO → NESPRESSO, STRIPE *DOCTOLIB → DOCTOLIB)
//   - Dates, trailing places, country codes, generic stop tokens
// Returns the merchant token (uppercase preferred) or null if nothing matched.
const _MERCHANT_PROCESSORS = ['paypal', 'sumup', 'adyen', 'stripe', 'square', 'payplug', 'lyfpay', 'alma', 'klarna', 'paylib', 'lydia', 'qonto', 'shopify', 'wise', 'revolut', 'apple pay', 'apple\\.com', 'google pay', 'g pay'];
const _MERCHANT_STOPWORDS = new Set([
  'SARL', 'SAS', 'SASU', 'EURL', 'COM', 'WWW', 'HTTPS', 'HTTP', 'CARTE', 'CB',
  'SEPA', 'INST', 'INSTANT', 'INTERNE', 'TELECOM', 'TELECOMS',
  'VIREMENT', 'VIRMNT', 'EMIS', 'RECU', 'RECUS', 'REGLT', 'REGLEMENT', 'PRELEVEMENT', 'PRLV', 'PAIEMENT', 'ACHAT',
  'PARIS', 'LYON', 'MARSEILLE', 'TOULOUSE', 'BORDEAUX', 'NANTES', 'LILLE', 'NICE', 'STRASBOURG',
  'FRANCE', 'EUROPE', 'STORE', 'SHOP', 'ONLINE', 'WEB', 'INTERNET', 'DRIVE',
]);

export const extractMerchantFromLabel = (label) => {
  if (!label) return null;
  const procRe = new RegExp(`\\b(${_MERCHANT_PROCESSORS.join('|')})\\b\\s*\\*+\\s*`, 'gi');
  const stripped = label
    .replace(/^(paiement par carte|prélèvement|prelevement|virement émis|virement emis|virement en votre faveur|virement recu de|virement reçu de|paiement|retrait dab|retrait|versement|avoir)\s+/i, '')
    .replace(/PAIEMENT PAR CARTE\s+[Xx]?\d{4,}\**\s*/gi, '')
    .replace(procRe, '')
    .replace(/^[*\s]+/, '')
    .replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?(\s|$).*$/g, '')
    .replace(/\s+(LU|FR|EN|US|GB|DE|ES|IT|BE|CH|NL|IE)\b.*$/i, '')
    .replace(/\s+\d{4,}.*$/, '')
    .trim();
  const words = stripped
    .split(/\s+/)
    .map(w => w.replace(/^\*+|[*.,;:!?]+$/g, ''))
    .filter(w => w.length >= 3 && !_MERCHANT_STOPWORDS.has(w.toUpperCase()) && !/^\d+$/.test(w) && !/^[Xx]\d+$/.test(w));
  if (!words.length) return null;
  const allCaps = words.filter(w => w === w.toUpperCase() && /^[A-ZÀ-Ÿ&'-]{3,}$/.test(w));
  return allCaps[0] || words[0];
};

export const categorize = (tx, customRules = []) => {
  const allRules = [...customRules, ...DEFAULT_RULES];
  for (const rule of allRules) {
    let pattern = rule.pattern;
    if (typeof pattern === 'string') {
      try { pattern = new RegExp(pattern, 'i'); } catch { continue; }
    }
    if (pattern.test(tx.label || '')) return rule.categoryId;
  }
  if (tx.amount > 1500) return 'salary';
  return 'uncategorized';
};

// Loan amortization schedule. Returns an array of monthly rows with
// { idx, date, capital, interest, insurance, payment, remaining }.
// paymentOverride lets the UI lock the row total to whatever the user actually
// pays each month; without it we compute the standard annuity.
export const buildAmortization = ({ principal, annualRate, durationM, insuranceRate, startDate, paymentOverride }) => {
  const P = parseFloat(principal) || 0;
  const n = parseInt(durationM, 10) || 0;
  const r = (parseFloat(annualRate) || 0) / 100 / 12;
  const ins = ((parseFloat(insuranceRate) || 0) / 100 / 12) * P;
  if (P <= 0 || n <= 0) return [];

  const monthlyKap = paymentOverride
    ? Math.max(0, parseFloat(paymentOverride) - ins)
    : (r > 0 ? P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : P / n);

  let remaining = P;
  const start = startDate ? new Date(startDate) : new Date();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const interest = remaining * r;
    let capital = monthlyKap - interest;
    if (capital > remaining) capital = remaining;
    remaining = Math.max(0, remaining - capital);
    const d = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    rows.push({
      idx: i + 1,
      date: d.toISOString().slice(0, 10),
      capital,
      interest,
      insurance: ins,
      payment: capital + interest + ins,
      remaining,
    });
  }
  return rows;
};

export const detectRecurring = (transactions, overrides = {}) => {
  const groups = {};
  transactions.forEach(tx => {
    if (tx.amount >= 0) return;
    const labelKey = (tx.label || '').toLowerCase().replace(/\d+/g, '').slice(0, 25).trim();
    const amountKey = Math.round(Math.abs(tx.amount) / 10) * 10;
    const key = `${labelKey}|${amountKey}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  const recurringIds = new Set();
  const recurringGroups = [];
  Object.entries(groups).forEach(([key, group]) => {
    if (group.length < 2) return;
    const months = new Set(group.map(t => monthKey(t.date)));
    if (months.size >= 2) {
      group.forEach(t => recurringIds.add(t.id));
      const avgAmount = group.reduce((s, t) => s + t.amount, 0) / group.length;
      const avgDay = Math.round(group.reduce((s, t) => s + dayOfMonth(t.date), 0) / group.length);
      const sortedByDate = [...group].sort((a, b) => b.date.localeCompare(a.date));
      recurringGroups.push({
        key,
        label: sortedByDate[0].label,
        avgAmount,
        avgDay,
        count: group.length,
        months: months.size,
        categoryId: sortedByDate[0].categoryId,
        accountId: sortedByDate[0].accountId,
        lastDate: sortedByDate[0].date,
        transactions: group,
      });
    }
  });
  // Apply overrides (manual fixed/not-fixed marks)
  transactions.forEach(tx => {
    if (overrides[tx.id] === true) recurringIds.add(tx.id);
    if (overrides[tx.id] === false) recurringIds.delete(tx.id);
  });
  return { recurringIds, recurringGroups };
};
