/**
 * Yotori Finance — demo dataset.
 *
 * Seed a believable household so a first-time visitor can navigate every
 * view with realistic numbers, *without* registering or polluting their
 * real DB. The data is generated relative to "today", so the timeline
 * always reflects the last 6 calendar months no matter when the user lands.
 *
 * Used by AuthScreen → "Voir une démo" → localStorage flag picked up by
 * App.jsx which renders YotoriApp in demo mode (no API calls,
 * mutations are no-ops with a friendly toast).
 */

const M = {
  alice: 'demo-member-alice',
  bob: 'demo-member-bob',
  lea: 'demo-member-lea',
};

const A = {
  bnpAlice: 'demo-acc-bnp-alice',
  liva: 'demo-acc-livret-alice',
  caBob: 'demo-acc-ca-bob',
  jointLcl: 'demo-acc-joint-lcl',
};

const members = [
  { id: M.alice, name: 'Alice', role: 'adult', color: '#3b6fe0' },
  { id: M.bob, name: 'Bob', role: 'adult', color: '#a78bfa' },
  { id: M.lea, name: 'Léa', role: 'child', color: '#34d399' },
];

const accounts = [
  { id: A.bnpAlice, name: 'Compte courant', bank: 'BNP Paribas',     type: 'checking', role: 'principal', currency: 'EUR', initialBalance: 1500,  memberIds: [M.alice], currentBalance: 3450, source: 'gocardless', externalId: 'demo-gc-bnp-alice', lastSyncedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), connectionId: 'demo-conn-bnp' },
  { id: A.liva,     name: 'Livret A',       bank: 'Boursorama',      type: 'savings',  role: 'epargne',   currency: 'EUR', initialBalance: 11200, memberIds: [M.alice], currentBalance: 12300 },
  { id: A.caBob,    name: 'Compte courant', bank: 'Crédit Agricole', type: 'checking', role: 'principal', currency: 'EUR', initialBalance: 1800,  memberIds: [M.bob],   currentBalance: 2860, source: 'gocardless', externalId: 'demo-gc-ca-bob', lastSyncedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), connectionId: 'demo-conn-ca' },
  { id: A.jointLcl, name: 'Compte joint',   bank: 'LCL',             type: 'checking', role: 'principal', currency: 'EUR', initialBalance: 4200,  memberIds: [M.alice, M.bob], currentBalance: 5180, source: 'gocardless', externalId: 'demo-gc-joint-lcl', lastSyncedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), connectionId: 'demo-conn-lcl' },
];

// ── Helpers de dates calendaires ─────────────────────────────────────────
// Cible un jour précis d'un mois calendaire (m=0 = ce mois-ci, m=1 = mois
// précédent, etc.). Renvoie null si la date tombe dans le futur — comme ça
// les "salaires du mois prochain" et "échéances du 28 quand on est le 25"
// ne polluent pas l'affichage du mois en cours.
function dateForCalendarMonth(monthsAgo, dayOfMonth) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() - monthsAgo, dayOfMonth);
  if (target > today) return null;
  return target.toISOString().slice(0, 10);
}

// Definition centrale des lignes recurrentes — utilisee A LA FOIS pour
// generer les transactions historiques (6 derniers mois calendaires) ET
// pour seeder le Mois type (refMonth) qui alimente le Sankey de la vue
// Monthly. Garder cette table comme source de verite evite les divergences
// entre "ce que la famille a vraiment depense" et "ce qu'elle prevoit".
//
// Convention amounts :
//   - kind 'expense' / 'saving' → amount POSITIF (le sens est implicite),
//     on signe en negatif au moment de creer la transaction.
//   - kind 'income' → amount POSITIF, on garde positif a l'insertion.
const RECURRING = [
  // Revenus
  { account: A.bnpAlice, dayOfMonth: 2,  label: 'Salaire ACME SAS',         amount: 3850,  category: 'salary',       kind: 'income',  memberIds: [M.alice] },
  { account: A.caBob,    dayOfMonth: 3,  label: 'Salaire CONSULT FR',       amount: 3220,  category: 'salary',       kind: 'income',  memberIds: [M.bob] },

  // Contributions compte joint (paire virement Alice/Bob → joint)
  { account: A.bnpAlice, dayOfMonth: 1,  label: 'Virement compte joint',    amount: 1800,  category: 'savings',      kind: 'transfer', memberIds: [M.alice], counterpartAccount: A.jointLcl, counterpartLabel: 'Virement Alice → commun' },
  { account: A.caBob,    dayOfMonth: 1,  label: 'Virement compte joint',    amount: 1600,  category: 'savings',      kind: 'transfer', memberIds: [M.bob],   counterpartAccount: A.jointLcl, counterpartLabel: 'Virement Bob → commun' },

  // Logement / charges
  { account: A.jointLcl, dayOfMonth: 28, label: 'Échéance prêt immobilier', amount: 1150,  category: 'housing',      kind: 'expense', memberIds: [M.alice, M.bob] },
  { account: A.jointLcl, dayOfMonth: 5,  label: 'Charges copropriété SYNDIC', amount: 260, category: 'housing',      kind: 'expense', memberIds: [M.alice, M.bob] },
  { account: A.bnpAlice, dayOfMonth: 14, label: 'CESU Mme Sanchez',         amount: 160,   category: 'housing',      kind: 'expense', memberIds: [M.alice] },

  // Enfants
  { account: A.jointLcl, dayOfMonth: 5,  label: 'Crèche Les Petits Pas',    amount: 680,   category: 'children',     kind: 'expense', memberIds: [M.alice, M.bob] },

  // Utilities + assurances
  { account: A.jointLcl, dayOfMonth: 6,  label: 'EDF Énergie',              amount: 88,    category: 'utilities',    kind: 'expense', memberIds: [M.alice, M.bob] },
  { account: A.jointLcl, dayOfMonth: 7,  label: 'Free Box',                 amount: 39,    category: 'utilities',    kind: 'expense', memberIds: [M.alice, M.bob] },
  { account: A.bnpAlice, dayOfMonth: 10, label: 'AXA Assurance habitation', amount: 54,    category: 'insurance',    kind: 'expense', memberIds: [M.alice, M.bob] },
  { account: A.caBob,    dayOfMonth: 12, label: 'Direct Assurance Auto',    amount: 42,    category: 'insurance',    kind: 'expense', memberIds: [M.bob] },

  // Abonnements
  { account: A.bnpAlice, dayOfMonth: 8,  label: 'Netflix',                  amount: 15.99, category: 'subscriptions', kind: 'expense', memberIds: [M.alice] },
  { account: A.caBob,    dayOfMonth: 9,  label: 'Spotify Family',           amount: 17.99, category: 'subscriptions', kind: 'expense', memberIds: [M.alice, M.bob] },
  { account: A.bnpAlice, dayOfMonth: 11, label: 'Salle de sport',           amount: 34,    category: 'subscriptions', kind: 'expense', memberIds: [M.alice] },

  // Épargne / DCA
  { account: A.bnpAlice, dayOfMonth: 4,  label: 'Virement vers Livret A',   amount: 600,   category: 'savings',      kind: 'transfer', memberIds: [M.alice], counterpartAccount: A.liva, counterpartLabel: 'Virement épargne mensuelle' },
  { account: A.bnpAlice, dayOfMonth: 15, label: 'Versement PEA programmé',  amount: 800,   category: 'savings',      kind: 'saving',  memberIds: [M.alice] },
  { account: A.jointLcl, dayOfMonth: 15, label: 'Versement Assurance-vie',  amount: 400,   category: 'savings',      kind: 'saving',  memberIds: [M.alice, M.bob] },
];

// Lignes variables — affichees sur une distribution mensuelle pour avoir
// du contenu courant + restos + transport sans tout etre rigide.
const VARIABLE_MONTHLY = [
  { account: A.jointLcl, dayOfMonth: 8,  label: 'Carrefour Market',   amount: 142,  category: 'groceries',   memberIds: [M.alice, M.bob] },
  { account: A.jointLcl, dayOfMonth: 22, label: 'Monoprix',           amount: 158,  category: 'groceries',   memberIds: [M.alice, M.bob] },
  { account: A.bnpAlice, dayOfMonth: 16, label: 'Naturalia',          amount: 48,   category: 'groceries',   memberIds: [M.alice] },
  { account: A.bnpAlice, dayOfMonth: 17, label: 'Boulangerie Poilâne', amount: 18,  category: 'groceries',   memberIds: [M.alice] },
  { account: A.caBob,    dayOfMonth: 19, label: 'Picard',             amount: 42,   category: 'groceries',   memberIds: [M.bob] },
  { account: A.jointLcl, dayOfMonth: 14, label: 'Franprix',           amount: 64,   category: 'groceries',   memberIds: [M.alice, M.bob] },
  { account: A.bnpAlice, dayOfMonth: 15, label: 'Brasserie Le Zinc',  amount: 56,   category: 'restaurants', memberIds: [M.alice] },
  { account: A.caBob,    dayOfMonth: 20, label: 'Uber Eats',          amount: 32,   category: 'restaurants', memberIds: [M.bob] },
  { account: A.caBob,    dayOfMonth: 22, label: 'Le Petit Vendôme',   amount: 48,   category: 'restaurants', memberIds: [M.bob] },
  { account: A.bnpAlice, dayOfMonth: 24, label: 'Sushi Shop',         amount: 35,   category: 'restaurants', memberIds: [M.alice] },
  { account: A.caBob,    dayOfMonth: 13, label: 'Total Energies',     amount: 68,   category: 'fuel',        memberIds: [M.bob] },
  { account: A.caBob,    dayOfMonth: 25, label: 'BP Station',         amount: 72,   category: 'fuel',        memberIds: [M.bob] },
  { account: A.bnpAlice, dayOfMonth: 18, label: 'UGC Cinémas',        amount: 28,   category: 'leisure',     memberIds: [M.alice] },
  { account: A.bnpAlice, dayOfMonth: 26, label: 'Pharmacie Vaugirard', amount: 22,  category: 'health',      memberIds: [M.alice] },
  { account: A.caBob,    dayOfMonth: 16, label: 'RATP Navigo',        amount: 88,   category: 'transport',   memberIds: [M.bob] },
  { account: A.bnpAlice, dayOfMonth: 16, label: 'RATP Navigo',        amount: 88,   category: 'transport',   memberIds: [M.alice] },
  { account: A.jointLcl, dayOfMonth: 20, label: 'Coiffeur Studio 14', amount: 65,   category: 'personal',    memberIds: [M.alice, M.bob] },
  { account: A.bnpAlice, dayOfMonth: 27, label: 'Zara',               amount: 79,   category: 'shopping',    memberIds: [M.alice] },
];

// Generate a believable transaction timeline for the past 6 calendar months.
function buildTransactions() {
  const txs = [];
  let id = 1000;

  const pushTx = (accountId, isoDate, label, amount, categoryId) => {
    if (!isoDate) return;
    txs.push({
      id: `demo-tx-${id++}`,
      accountId,
      date: isoDate,
      label,
      amount,
      categoryId,
      isManualCategory: false,
      isRecurringOverride: null,
      notes: '',
    });
  };

  // m=0 → mois en cours, m=5 → il y a 5 mois calendaires.
  for (let m = 0; m < 6; m++) {
    for (const r of RECURRING) {
      const iso = dateForCalendarMonth(m, r.dayOfMonth);
      if (!iso) continue;
      const sign = (r.kind === 'income') ? 1 : -1;
      pushTx(r.account, iso, r.label, sign * r.amount, r.category);
      // Pour les virements internes on pousse aussi la contrepartie.
      if (r.kind === 'transfer' && r.counterpartAccount) {
        pushTx(r.counterpartAccount, iso, r.counterpartLabel || r.label, r.amount, r.category);
      }
    }

    for (const v of VARIABLE_MONTHLY) {
      const iso = dateForCalendarMonth(m, v.dayOfMonth);
      if (!iso) continue;
      pushTx(v.account, iso, v.label, -v.amount, v.category);
    }

    // Quelques variations one-shot pour étoffer certains mois
    if (m === 0) {
      pushTx(A.bnpAlice, dateForCalendarMonth(0, 6),  'Pharmacie de la place', -34, 'health');
      pushTx(A.bnpAlice, dateForCalendarMonth(0, 18), 'SNCF Voyageurs',        -89, 'travel');
    }
    if (m === 1) {
      pushTx(A.caBob,    dateForCalendarMonth(1, 17), 'IKEA',                -312, 'shopping');
      pushTx(A.bnpAlice, dateForCalendarMonth(1, 21), 'Amazon',              -67,  'shopping');
    }
    if (m === 2) {
      pushTx(A.bnpAlice, dateForCalendarMonth(2, 19), 'Prime exceptionnelle', 1500, 'salary');
      pushTx(A.bnpAlice, dateForCalendarMonth(2, 24), 'Décathlon',            -89,  'shopping');
    }
    if (m === 3) {
      pushTx(A.caBob,    dateForCalendarMonth(3, 17), 'Hôtel Mercure',        -218, 'travel');
    }
    if (m === 4) {
      pushTx(A.bnpAlice, dateForCalendarMonth(4, 23), 'Fnac',                 -129, 'shopping');
    }
  }

  return txs;
}

const transactions = buildTransactions();

const assets = [
  {
    id: 'demo-asset-immo',
    type: 'real_estate',
    subtype: 'RP',
    name: 'Résidence principale — 14 rue de Vaugirard, Paris',
    currentValue: 420000,
    purchasePrice: 395000,
    surfaceM2: 72,
    address: '14 rue de Vaugirard, 75006 Paris',
    notes: 'Estimation actualisée 2025',
    memberIds: [M.alice, M.bob],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-asset-pea',
    type: 'pea',
    name: 'PEA Boursorama',
    currentValue: 32424,  // = somme exacte des 6 positions (13660+6195+4370+4295+2284+1620) → le header de la fiche colle aux lignes
    notes: '80 % MSCI World, 20 % émergents',
    memberIds: [M.alice],
    updatedAt: new Date().toISOString(),
  },
  // Positions PEA (Finary-style) — tickerYahoo permet la récupération de cours live (Yahoo Finance via /quotes).
  { id: 'demo-pos-amundi',  parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'Amundi MSCI World UCITS ETF',    isin: 'LU1681043599', tickerYahoo: 'CW8.PA',  quantity: 32,  purchasePrice: 318.50, currentValue: 13660,  memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-lyxor-w', parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'Lyxor PEA MSCI World UCITS ETF', isin: 'FR0011869353', tickerYahoo: 'EWLD.PA', quantity: 240, purchasePrice: 22.10,  currentValue: 6195,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-lyxor-n', parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'Lyxor NASDAQ-100 PEA UCITS ETF', isin: 'FR0011871128', tickerYahoo: 'PUST.PA', quantity: 80,  purchasePrice: 41.20,  currentValue: 4370,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-lvmh',    parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'LVMH Moët Hennessy',             isin: 'FR0000121014', tickerYahoo: 'MC.PA',   quantity: 6,   purchasePrice: 612.00, currentValue: 4295,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-total',   parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'TotalEnergies SE',               isin: 'FR0000120271', tickerYahoo: 'TTE.PA',  quantity: 40,  purchasePrice: 48.30,  currentValue: 2284,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-axa',     parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'AXA',                            isin: 'FR0000120628', tickerYahoo: 'CS.PA',   quantity: 50,  purchasePrice: 28.40,  currentValue: 1620,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  {
    id: 'demo-asset-av',
    type: 'life_insurance',
    name: 'Assurance-vie Linxea Avenir',
    currentValue: 18200,
    notes: 'Profil prudent, 60% fonds €',
    memberIds: [M.alice, M.bob],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-asset-cto',
    type: 'stocks',
    name: 'CTO IBKR',
    currentValue: 8400,
    notes: '',
    memberIds: [M.bob],
    updatedAt: new Date().toISOString(),
  },
  // Crypto-actifs — purchasePrice est le PRIX UNITAIRE (matche la sémantique
  // de useWealthItems: costBasis = purchasePrice * quantity).
  {
    id: 'demo-asset-btc',
    type: 'crypto',
    name: 'Bitcoin',
    ticker: 'BTC',
    quantity: 0.18,
    purchasePrice: 42000, // prix unitaire moyen d'acquisition → cost basis 7 560 €
    currentValue: 11250,
    purchaseDate: '2023-03-15',
    notes: 'DCA mensuel sur Kraken — accumulation long terme.',
    memberIds: [M.alice, M.bob],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-asset-eth',
    type: 'crypto',
    name: 'Ethereum',
    ticker: 'ETH',
    quantity: 2.4,
    purchasePrice: 1850, // unitaire → cost basis 4 440 €
    currentValue: 6720,
    purchaseDate: '2022-11-08',
    notes: '',
    memberIds: [M.bob],
    updatedAt: new Date().toISOString(),
  },
  // Autre actif — montre OtherAssetDetail v3
  {
    id: 'demo-asset-or',
    type: 'other',
    subtype: 'Or physique',
    name: 'Lingots d\'or 50g',
    purchasePrice: 2800,
    currentValue: 3450,
    purchaseDate: '2021-09-10',
    notes: 'Deux lingots de 50 g achetés chez CPoR à Paris. Conservés en coffre.',
    memberIds: [M.alice, M.bob],
    updatedAt: new Date().toISOString(),
  },
];

const liabilities = [
  {
    id: 'demo-lia-immo',
    type: 'mortgage',
    name: 'Prêt immo BNP — résidence principale',
    initialCapital: 280000,
    remainingCapital: 218500,
    monthlyPayment: 1150,
    interestRate: 1.65,
    durationMonths: 240,
    startDate: '2022-09-01',
    endDate: '2042-09-01',
    notes: '20 ans, taux fixe',
    memberIds: [M.alice, M.bob],
    linkedAssetId: 'demo-asset-immo',
  },
];

// Budgets are stored on the frontend as { category_slug: amount }
const budgets = {
  groceries: 600,
  restaurants: 200,
  leisure: 250,
  shopping: 300,
  fuel: 200,
  subscriptions: 90,
};

const goals = [
  { id: 'demo-goal-1', name: 'Vacances été', emoji: '🏖️', target: 3500, current: 1800, deadline: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10) },
  { id: 'demo-goal-2', name: 'Apport futur achat', emoji: '🏡', target: 50000, current: 32400, deadline: null },
];

const achievements = ['first_import', 'budget_set', 'first_member'];

// Charges fixes mensuelles — peuplent la vue Suivi mensuel.
// Synchro stricte avec la table RECURRING ci-dessus (mêmes jours / montants).
const fixedCharges = [
  { id: 'demo-fc-pret',      name: 'Échéance prêt immobilier', amount: 1150,  day_of_month: 28, category_slug: 'housing',       kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-creche',    name: 'Crèche Les Petits Pas',    amount: 680,   day_of_month: 5,  category_slug: 'children',      kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-copro',     name: 'Charges copropriété',      amount: 260,   day_of_month: 5,  category_slug: 'housing',       kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-cesu',      name: 'CESU Mme Sanchez',         amount: 160,   day_of_month: 14, category_slug: 'housing',       kind: 'expense', member_ids: [M.alice],        notes: 'Femme de ménage' },
  { id: 'demo-fc-edf',       name: 'EDF Énergie',              amount: 88,    day_of_month: 6,  category_slug: 'utilities',     kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-free',      name: 'Free Box',                 amount: 39,    day_of_month: 7,  category_slug: 'utilities',     kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-axa',       name: 'AXA Assurance habitation', amount: 54,    day_of_month: 10, category_slug: 'insurance',     kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-auto',      name: 'Direct Assurance Auto',    amount: 42,    day_of_month: 12, category_slug: 'insurance',     kind: 'expense', member_ids: [M.bob],          notes: '' },
  { id: 'demo-fc-netflix',   name: 'Netflix',                  amount: 15.99, day_of_month: 8,  category_slug: 'subscriptions', kind: 'expense', member_ids: [M.alice],        notes: '' },
  { id: 'demo-fc-spotify',   name: 'Spotify Family',           amount: 17.99, day_of_month: 9,  category_slug: 'subscriptions', kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-sport',     name: 'Salle de sport',           amount: 34,    day_of_month: 11, category_slug: 'subscriptions', kind: 'expense', member_ids: [M.alice],        notes: '' },
  { id: 'demo-fc-pea',       name: 'Versement PEA programmé',  amount: 800,   day_of_month: 15, category_slug: 'savings',       kind: 'expense', member_ids: [M.alice],        notes: 'DCA mensuel ETF World' },
  { id: 'demo-fc-av',        name: 'Versement Assurance-vie',  amount: 400,   day_of_month: 15, category_slug: 'savings',       kind: 'expense', member_ids: [M.alice, M.bob], notes: '' },
  { id: 'demo-fc-livret',    name: 'Virement Livret A',        amount: 600,   day_of_month: 4,  category_slug: 'savings',       kind: 'expense', member_ids: [M.alice],        notes: '' },
  // Revenus fixes
  { id: 'demo-fc-sal-alice', name: 'Salaire ACME SAS',         amount: 3850,  day_of_month: 2,  category_slug: 'salary',        kind: 'income',  member_ids: [M.alice],        notes: '' },
  { id: 'demo-fc-sal-bob',   name: 'Salaire CONSULT FR',       amount: 3220,  day_of_month: 3,  category_slug: 'salary',        kind: 'income',  member_ids: [M.bob],          notes: '' },
];

// ── Mois type (refMonth) — derive des fixedCharges ──────────────────────
// Sans ça, la vue Monthly affichait un Sankey vide et "écart vs Mois type
// = 100 %". On reprend la même source de vérité que les charges fixes.
function buildRefMonth() {
  const lines = fixedCharges.map((fc, idx) => ({
    id: `demo-rmline-${idx + 1}`,
    label: fc.name,
    category_id: fc.category_slug,
    amount: fc.amount,
    kind: fc.kind === 'income' ? 'income'
        : fc.category_slug === 'savings' ? 'saving'
        : 'expense',
    locked: false,
  }));
  return {
    version: 1,
    updated_at: new Date().toISOString().slice(0, 10),
    lines,
  };
}

const refMonth = buildRefMonth();

// ── Bank connections (fake GoCardless en démo) ──────────────────────────
// Permet a la SyncButton + Settings -> Banques d'afficher quelque chose
// de credible plutot que "Aucune banque connectee".
// Consentement DSP2 = 90 j. On dérive created_at / expires_at / jours restants
// à partir de l'âge en jours pour rester cohérent avec le backend et faire
// vivre la reconnexion proactive en démo (LCL bientôt expirée).
const _demoConn = (ageDays) => {
  const created = new Date(Date.now() - ageDays * 86400 * 1000);
  const expires = new Date(created.getTime() + 90 * 86400 * 1000);
  return {
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
    days_until_expiry: Math.round(((expires.getTime() - Date.now()) / 86400000) * 10) / 10,
  };
};
const bankConnections = [
  {
    id: 'demo-conn-bnp',
    bank_name: 'BNP_PARIBAS_BNPAFRPP',
    institution_name: 'BNP Paribas',
    bank_country: 'FR',
    status: 'authorized',
    accounts: [{ id: 'demo-gc-bnp-alice', name: 'Compte courant', iban: 'FR76****1234', currency: 'EUR' }],
    last_synced_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    error_message: null,
    ..._demoConn(45),
  },
  {
    id: 'demo-conn-ca',
    bank_name: 'CREDIT_AGRICOLE_AGRIFRPP',
    institution_name: 'Crédit Agricole',
    bank_country: 'FR',
    status: 'authorized',
    accounts: [{ id: 'demo-gc-ca-bob', name: 'Compte courant', iban: 'FR76****5678', currency: 'EUR' }],
    last_synced_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    error_message: null,
    ..._demoConn(45),
  },
  {
    id: 'demo-conn-lcl',
    bank_name: 'LCL_CRLYFRPP',
    institution_name: 'LCL',
    bank_country: 'FR',
    status: 'authorized',
    accounts: [{ id: 'demo-gc-joint-lcl', name: 'Compte joint', iban: 'FR76****9012', currency: 'EUR' }],
    last_synced_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    error_message: null,
    ..._demoConn(86),
  },
];

// ── Wealth snapshots ────────────────────────────────────────────────────
// Calibres pour matcher le netWorth calcule live (apres correction du
// double-comptage PEA cote YotoriApp.jsx) :
//   liquid (currentBalance sum)      = 23 790
//   assets parents (immo+pea+av+cto+btc+eth+or) = 500 520
//   liabilities                                  = 218 500
//   --> netWorth ≈ 305 800
// Progression ~+8% sur 6 mois (immo stable, marches en hausse).
function buildWealthHistory() {
  const today = new Date();
  const currentNetWorth = 305800;
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const progress = (6 - i) / 6; // 0 → 1
    const dip = i === 3 ? -2200 : 0;
    const netWorth = Math.round(283000 + progress * (currentNetWorth - 283000) + dip);
    const realEstateValue = 418000 + Math.round(progress * 2000); // 418k → 420k
    const liabilitiesValue = Math.round(222000 - progress * 3500); // 222k → 218.5k
    const liquidWealth = Math.round(20000 + progress * 3790 + (dip ? dip / 4 : 0)); // 20k → ~23.8k
    const assetsValue = netWorth - liquidWealth + liabilitiesValue;
    const financialAssetsValue = liquidWealth + (assetsValue - realEstateValue);
    points.push({
      month,
      net_worth: netWorth,
      liquid_wealth: liquidWealth,
      assets_value: assetsValue,
      liabilities_value: liabilitiesValue,
      real_estate_value: realEstateValue,
      financial_assets_value: financialAssetsValue,
      mortgage_debt: liabilitiesValue,
      other_debt: 0,
    });
  }
  return points;
}

const wealthHistory = buildWealthHistory();

// Categories — let the frontend use its DEFAULT_CATEGORIES, no override needed.
const customRules = [];

// Faux User connecte pour debloquer le menu Settings + le bandeau profil
// en mode demo. Plan 'family' pour montrer le badge premium, totp_enabled
// pour ne pas declencher l'overlay 2FA obligatoire.
const currentUser = {
  id: 'demo-user',
  email: 'demo@yotori.fr',
  full_name: 'Démo Yotori Finance',
  plan: 'family',
  totp_enabled: true,
  is_admin: false,
  created_at: '2024-01-15T10:00:00Z',
};

export const DEMO_FLAG_KEY = 'yotori:demo';

/**
 * Returns a fresh, "as of now" demo dataset.
 * Re-call to get updated timeline (transactions are dated relative to today).
 */
export function getDemoData() {
  return {
    members,
    accounts,
    transactions,
    assets,
    liabilities,
    budgets,
    goals,
    achievements,
    customRules,
    fixedCharges,
    wealthHistory,
    refMonth,
    bankConnections,
    currentUser,
  };
}

export function isDemoMode() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableDemoMode() {
  try {
    window.localStorage.setItem(DEMO_FLAG_KEY, '1');
  } catch {}
}

export function disableDemoMode() {
  try {
    window.localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {}
}
