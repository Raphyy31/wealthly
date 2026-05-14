/**
 * Wealthly — demo dataset.
 *
 * Seed a believable household so a first-time visitor can navigate every
 * view with realistic numbers, *without* registering or polluting their
 * real DB. The data is generated relative to "today", so the timeline
 * always reflects the last 6 months no matter when the user lands.
 *
 * Used by AuthScreen → "Voir une démo" → localStorage flag picked up by
 * App.jsx which renders WealthlyApp in demo mode (no API calls,
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
  { id: A.bnpAlice, name: 'Compte courant', bank: 'BNP Paribas',     type: 'checking', currency: 'EUR', initialBalance: 1500,  memberIds: [M.alice], currentBalance: 3450 },
  { id: A.liva,     name: 'Livret A',       bank: 'Boursorama',      type: 'savings',  currency: 'EUR', initialBalance: 11200, memberIds: [M.alice], currentBalance: 12300 },
  { id: A.caBob,    name: 'Compte courant', bank: 'Crédit Agricole', type: 'checking', currency: 'EUR', initialBalance: 1800,  memberIds: [M.bob],   currentBalance: 2860 },
  { id: A.jointLcl, name: 'Compte joint',   bank: 'LCL',             type: 'checking', currency: 'EUR', initialBalance: 4200,  memberIds: [M.alice, M.bob], currentBalance: 5180 },
];

// Helper: ISO date for a day relative to today.
function dayOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Generate a believable transaction timeline for the past 6 months.
function buildTransactions() {
  const txs = [];
  let id = 1000;
  const push = (accountId, daysAgo, label, amount, categoryId) => {
    txs.push({
      id: `demo-tx-${id++}`,
      accountId,
      date: dayOffset(daysAgo),
      label,
      amount,
      categoryId,
      isManualCategory: false,
      isRecurringOverride: null,
      notes: '',
    });
  };

  // For each of the last 6 months, seed the recurring + variable mix.
  for (let m = 0; m < 6; m++) {
    const monthStart = m * 30; // approximate

    // Salaries
    push(A.bnpAlice,  monthStart + 2,  'Salaire ACME SAS',         3850, 'salary');
    push(A.caBob,     monthStart + 3,  'Salaire CONSULT FR',       3220, 'salary');

    // Charges copropriété (ils sont propriétaires — pas de loyer)
    push(A.jointLcl,  monthStart + 5,  'Charges copropriété SYNDIC', -260, 'housing');

    // Contributions mensuelles au compte joint (chaque adulte alimente les dépenses communes)
    push(A.bnpAlice,  monthStart + 1,  'Virement compte joint',  -1800, 'savings');
    push(A.jointLcl,  monthStart + 1,  'Virement Alice → commun', 1800, 'savings');
    push(A.caBob,     monthStart + 1,  'Virement compte joint',  -1600, 'savings');
    push(A.jointLcl,  monthStart + 1,  'Virement Bob → commun',  1600, 'savings');

    // Charges
    push(A.jointLcl,  monthStart + 6,  'EDF Énergie',              -88,  'utilities');
    push(A.jointLcl,  monthStart + 7,  'Free Box',                 -39,  'utilities');
    push(A.bnpAlice,  monthStart + 10, 'AXA Assurance habitation', -54,  'insurance');
    push(A.caBob,     monthStart + 12, 'Direct Assurance Auto',    -42,  'insurance');

    // Crèche pour Léa
    push(A.jointLcl,  monthStart + 5,  'Crèche Les Petits Pas',   -680, 'children');

    // Femme de ménage CESU
    push(A.bnpAlice,  monthStart + 14, 'CESU Mme Sanchez',         -160, 'housing');

    // Abonnements
    push(A.bnpAlice,  monthStart + 8,  'Netflix',                  -15.99, 'subscriptions');
    push(A.caBob,     monthStart + 9,  'Spotify Family',           -17.99, 'subscriptions');
    push(A.bnpAlice,  monthStart + 11, 'Salle de sport',           -34,  'subscriptions');

    // Carburant
    push(A.caBob,     monthStart + 13, 'Total Energies',           -68,  'fuel');
    push(A.caBob,     monthStart + 25, 'BP Station',               -72,  'fuel');

    // Courses (toutes les 2 semaines)
    push(A.jointLcl,  monthStart + 8,  'Carrefour Market',         -142, 'groceries');
    push(A.jointLcl,  monthStart + 22, 'Monoprix',                 -158, 'groceries');
    push(A.bnpAlice,  monthStart + 16, 'Naturalia',                -48,  'groceries');

    // Restaurants
    push(A.bnpAlice,  monthStart + 15, 'Brasserie Le Zinc',        -56,  'restaurants');
    push(A.caBob,     monthStart + 20, 'Uber Eats',                -32,  'restaurants');

    // Loisirs
    push(A.bnpAlice,  monthStart + 18, 'UGC Cinémas',              -28,  'leisure');

    // Épargne
    push(A.liva,      monthStart + 4,  'Virement épargne mensuelle', 600, 'savings');
    push(A.bnpAlice,  monthStart + 4,  'Virement vers Livret A',  -600, 'savings');

    // Versements programmés vers PEA / Assurance-vie (DCA) — sortent du flux
    // bancaire mensuel, contribuent à expliquer l'écart initialBalance vs
    // currentBalance (sinon les comptes accumulent +3 925 €/mois irréaliste).
    push(A.bnpAlice,  monthStart + 15, 'Versement PEA programmé',  -800, 'savings');
    push(A.jointLcl,  monthStart + 15, 'Versement Assurance-vie',  -400, 'savings');

    // Dépenses quotidiennes additionnelles pour rendre le mois complet
    // (sinon la démo affiche un taux d'épargne de 79 %, irréaliste pour
    // un couple parisien proprio avec un enfant).
    push(A.bnpAlice,  monthStart + 17, 'Boulangerie Poilâne',      -18,  'groceries');
    push(A.caBob,     monthStart + 19, 'Picard',                   -42,  'groceries');
    push(A.jointLcl,  monthStart + 14, 'Franprix',                 -64,  'groceries');
    push(A.caBob,     monthStart + 22, 'Le Petit Vendôme',         -48,  'restaurants');
    push(A.bnpAlice,  monthStart + 24, 'Sushi Shop',               -35,  'restaurants');
    push(A.bnpAlice,  monthStart + 26, 'Pharmacie Vaugirard',      -22,  'health');
    push(A.caBob,     monthStart + 16, 'RATP Navigo',              -88,  'transport');
    push(A.bnpAlice,  monthStart + 16, 'RATP Navigo',              -88,  'transport');
    push(A.jointLcl,  monthStart + 20, 'Coiffeur Studio 14',       -65,  'personal');
    push(A.bnpAlice,  monthStart + 27, 'Zara',                     -79,  'shopping');

    // Quelques variations selon le mois
    if (m === 0) {
      push(A.bnpAlice, 6,  'Pharmacie de la place',  -34, 'health');
      push(A.bnpAlice, 18, 'SNCF Voyageurs',         -89, 'travel');
    }
    if (m === 1) {
      push(A.caBob,    monthStart + 17, 'IKEA',     -312, 'shopping');
      push(A.bnpAlice, monthStart + 21, 'Amazon',   -67,  'shopping');
    }
    if (m === 2) {
      push(A.bnpAlice, monthStart + 19, 'Prime exceptionnelle', 1500, 'salary');
      push(A.bnpAlice, monthStart + 24, 'Décathlon',       -89,  'shopping');
    }
    if (m === 3) {
      push(A.caBob,    monthStart + 17, 'Hôtel Mercure',   -218, 'travel');
    }
    if (m === 4) {
      push(A.bnpAlice, monthStart + 23, 'Fnac',     -129, 'shopping');
    }
  }

  // Mensualité de prêt immobilier (joint)
  for (let m = 0; m < 6; m++) {
    push(A.jointLcl,  m * 30 + 28, 'Échéance prêt immobilier', -1150, 'housing');
  }

  return txs;
}

const transactions = buildTransactions();

const assets = [
  {
    id: 'demo-asset-immo',
    type: 'real_estate',
    name: 'Résidence principale — 14 rue de Vaugirard, Paris',
    currentValue: 420000,
    notes: 'Estimation actualisée 2025',
    memberIds: [M.alice, M.bob],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-asset-pea',
    type: 'pea',
    name: 'PEA Boursorama',
    currentValue: 32500,
    notes: '80 % MSCI World, 20 % émergents',
    memberIds: [M.alice],
    updatedAt: new Date().toISOString(),
  },
  // Positions PEA (Finary-style) — montrent la table de détail dans InvestmentDetail.
  { id: 'demo-pos-amundi', parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'Amundi MSCI World UCITS ETF', isin: 'LU1681043599', quantity: 32,  purchasePrice: 318.50, currentValue: 13660,  memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-lyxor-w', parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'Lyxor PEA MSCI World UCITS ETF', isin: 'FR0011869353', quantity: 240, purchasePrice: 22.10,  currentValue: 6195,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-lyxor-n', parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'Lyxor NASDAQ-100 PEA UCITS ETF', isin: 'FR0011871128', quantity: 80,  purchasePrice: 41.20,  currentValue: 4370,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-lvmh',    parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'LVMH Moët Hennessy', isin: 'FR0000121014', quantity: 6,   purchasePrice: 612.00, currentValue: 4295,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-total',   parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'TotalEnergies SE', isin: 'FR0000120271', quantity: 40,  purchasePrice: 48.30,  currentValue: 2284,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
  { id: 'demo-pos-axa',     parentAssetId: 'demo-asset-pea', type: 'stock_position', name: 'AXA', isin: 'FR0000120628', quantity: 50,  purchasePrice: 28.40,  currentValue: 1620,   memberIds: [M.alice], updatedAt: new Date().toISOString() },
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
  // Crypto-actifs — montrent CryptoDetail v3
  {
    id: 'demo-asset-btc',
    type: 'crypto',
    name: 'Bitcoin',
    ticker: 'BTC',
    quantity: 0.18,
    purchasePrice: 28400,
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
    purchasePrice: 1850,
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
    type: 'Prêt immobilier',
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
  { id: 'demo-goal-1', name: 'Vacances été 2026', emoji: '🏖️', target: 3500, current: 1800, deadline: '2026-07-01' },
  { id: 'demo-goal-2', name: 'Apport futur achat', emoji: '🏡', target: 50000, current: 32400, deadline: null },
];

const achievements = ['first_import', 'budget_set', 'first_member'];

// Charges fixes mensuelles — peuplent la vue Suivi mensuel.
// Les `day_of_month` correspondent aux jours réels où ces charges tombent
// (cohérence avec `buildTransactions` qui les pousse aux mêmes dates).
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

// Snapshots mensuels du patrimoine net — utilisés par le Dashboard pour
// dessiner la courbe d'évolution. Sans ça, le chart utilise une approximation
// basée sur les soldes bancaires uniquement, ce qui donne des chiffres
// absurdes (+149 %) en mode démo.
function buildWealthHistory() {
  const today = new Date();
  const currentNetWorth = 284390;
  // Progression réaliste : ~+8 % sur 6 mois (immobilier stable, marchés en
  // hausse modérée, capital de prêt remboursé doucement, épargne mensuelle).
  // On part de ~262 k il y a 6 mois et on monte progressivement.
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // Courbe quasi-linéaire avec un léger creux au mois 3 (drawdown marchés)
    const progress = (6 - i) / 6; // 0 → 1
    const dip = i === 3 ? -1800 : 0;
    const netWorth = Math.round(262000 + progress * (currentNetWorth - 262000) + dip);
    const realEstateValue = 418000 + Math.round(progress * 2000); // 418k → 420k
    const liabilitiesValue = Math.round(222000 - progress * 3500); // 222k → 218.5k
    const liquidWealth = Math.round(18500 + progress * 5300 + (dip ? dip / 4 : 0)); // 18.5k → 23.8k
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

export const DEMO_FLAG_KEY = 'wealthly:demo';

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
