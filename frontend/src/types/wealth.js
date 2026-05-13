// frontend/src/types/wealth.js
//
// Type canonique unifié pour la vue Patrimoine.
// Les composants UI consomment EXCLUSIVEMENT ce type — la dualité
// backend (Account vs Asset) est masquée par le hook useWealthItems.

/**
 * @typedef {'liquidites'|'investissements'|'immobilier'|'cryptos'|'autres'|'emprunts'} WealthCategory
 */

/**
 * @typedef {'compte_courant'|'livret'|'cash'|'pea'|'cto'|'av'|'per'|'rp'|'locatif'|'scpi'|'crypto'|'or'|'autre'|'mortgage'|'consumer_loan'|'auto_loan'|'other_loan'} WealthSubtype
 */

/**
 * @typedef {Object} Position
 * @property {string} id
 * @property {string} name
 * @property {string} [isin]
 * @property {string} [ticker]
 * @property {number} quantity
 * @property {number} [costBasis]
 * @property {number} [lastPrice]
 * @property {number} value
 */

/**
 * @typedef {Object} WealthItem
 * @property {string} id
 * @property {'account'|'asset'|'liability'} sourceTable
 * @property {string} sourceId
 * @property {WealthCategory} category
 * @property {WealthSubtype} subtype
 * @property {string} name
 * @property {string} currency
 * @property {number} value
 * @property {number} [costBasis]
 * @property {number} [plLatente]
 * @property {number} [plLatentePct]
 * @property {'synced'|'manual'} syncMode
 * @property {string} [lastSyncedAt]
 * @property {string} [connectionId]
 * @property {string[]} memberIds
 * @property {Position[]} [positions]
 * @property {Object} [meta]
 */

// Subtype → category mapping (single source of truth)
export const SUBTYPE_TO_CATEGORY = {
  compte_courant: 'liquidites',
  livret: 'liquidites',
  cash: 'liquidites',
  pea: 'investissements',
  cto: 'investissements',
  av: 'investissements',
  per: 'investissements',
  rp: 'immobilier',
  locatif: 'immobilier',
  scpi: 'immobilier',
  crypto: 'cryptos',
  or: 'autres',
  autre: 'autres',
  mortgage: 'emprunts',
  consumer_loan: 'emprunts',
  auto_loan: 'emprunts',
  other_loan: 'emprunts',
};

// Backend type → canonical subtype mapping
export const BACKEND_TO_SUBTYPE = {
  // Account.type
  checking: 'compte_courant',
  savings: 'livret',
  pea: 'pea',
  life_insurance: 'av',
  credit_card: 'compte_courant',
  // Legacy generic types from AddAccountModal manual form (line 1730 WealthlyApp.jsx)
  investment: 'cto',         // "PEA / CTO / AV" picker option
  joint: 'compte_courant',
  professional: 'compte_courant',
  // Asset.type
  savings_account: 'livret',
  per: 'per',
  stocks: 'cto',
  real_estate: 'rp',
  crypto: 'crypto',
  other_asset: 'autre',
  // Liability.type
  mortgage: 'mortgage',
  consumer_loan: 'consumer_loan',
  auto_loan: 'auto_loan',
  other_loan: 'other_loan',
};

// Display labels (FR, vocabulaire Finary)
export const CATEGORY_LABELS = {
  liquidites: 'Liquidités',
  investissements: "Comptes d'investissement",
  immobilier: 'Immobilier',
  cryptos: 'Cryptos',
  autres: 'Autres',
  emprunts: 'Emprunts',
};

export const SUBTYPE_LABELS = {
  compte_courant: 'Compte courant',
  livret: 'Livret',
  cash: 'Espèces',
  pea: 'PEA',
  cto: 'Compte-titres',
  av: 'Assurance-vie',
  per: 'PER',
  rp: 'Résidence principale',
  locatif: 'Locatif',
  scpi: 'SCPI',
  crypto: 'Crypto',
  or: 'Or / Métaux précieux',
  autre: 'Autre',
  mortgage: 'Prêt immobilier',
  consumer_loan: 'Crédit conso',
  auto_loan: 'Prêt auto',
  other_loan: 'Autre emprunt',
};

// Fiscal caps (FR 2026)
export const FISCAL_CAPS = {
  pea: { cap: 150000, label: 'Plafond PEA' },
  livret: { cap: 22950, label: 'Plafond Livret A' },
};
