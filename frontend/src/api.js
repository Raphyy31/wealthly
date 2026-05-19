/**
 * API service: all HTTP calls to the Wealthly backend.
 *
 * Auth: HttpOnly Secure SameSite=None cookie `trove_session` set by the
 * backend on login/register/reset. The browser auto-attaches it on every
 * request thanks to `credentials: 'include'`. JS cannot read it (XSS-safe).
 *
 * Base URL: from VITE_API_URL env var, falls back to /api (proxied by Vite in dev).
 */

import { SUBTYPE_TO_CATEGORY } from './types/wealth.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ============================================================================
// CORE FETCH WRAPPER
// ============================================================================
async function request(method, path, body = null) {
  // In demo mode the UI is fed from demoData.js; never hit the backend.
  if (typeof window !== 'undefined' && window.localStorage.getItem('wealthly:demo') === '1') {
    if (method === 'GET') return null;
    throw new Error('Mode démo : modifications non enregistrées');
  }

  const headers = { 'Content-Type': 'application/json' };

  const opts = {
    method,
    headers,
    credentials: 'include',  // critical: lets the browser send the auth cookie
  };
  if (body !== null) opts.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    throw new Error('Impossible de joindre le serveur. Vérifie que le backend tourne.');
  }

  if (response.status === 401) {
    // Récupère le message d'erreur du backend — sinon une mauvaise
    // tentative login n'afficherait jamais "mot de passe incorrect".
    let errMsg = 'Session expirée';
    try { const d = await response.clone().json(); errMsg = d?.detail || errMsg; } catch {}
    throw new Error(errMsg);
  }

  if (response.status === 204) return null; // No Content

  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return null;
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || `Erreur ${response.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return data;
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const del = (path) => request('DELETE', path);

// ============================================================================
// AUTH
// ============================================================================
export const auth = {
  register: (email, password, fullName, householdName) =>
    post('/auth/register', {
      email,
      password,
      full_name: fullName,
      household_name: householdName,
    }),
  login: (email, password, totpCode) => post('/auth/login', { email, password, ...(totpCode ? { totp_code: totpCode } : {}) }),
  logout: () => post('/auth/logout', {}),
  me: () => get('/auth/me'),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => post('/auth/reset-password', { token, new_password: newPassword }),
};

// 2FA TOTP (C19 2026-05-18)
export const totp = {
  status:  ()                       => get('/auth/totp/status'),
  setup:   ()                       => post('/auth/totp/setup', {}),
  verify:  (code)                   => post('/auth/totp/verify', { code }),
  disable: (password, code = null)  => post('/auth/totp/disable', { password, ...(code ? { code } : {}) }),
};

// ============================================================================
// ADMIN
// ============================================================================
export const admin = {
  stats:        ()              => get('/admin/stats'),
  metrics:      ()              => get('/admin/metrics'),
  growth:       ()              => get('/admin/growth'),
  authEvents:   (limit = 100, kind = null) => get(`/admin/auth-events?limit=${limit}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`),
  users:        ()              => get('/admin/users'),
  households:   ()              => get('/admin/households'),
  toggleUser:   (id)            => request('PUT',    `/admin/users/${id}/toggle`),
  deleteUser:   (id)            => request('DELETE', `/admin/users/${id}`),
  updatePlan:   (householdId, plan) => request('PUT', `/admin/households/${householdId}/plan`, { plan }),
  resetPassword:(id)            => request('POST',   `/admin/users/${id}/reset-password`),
};

// ============================================================================
// MEMBERS
// ============================================================================
export const members = {
  list: () => get('/members'),
  create: (m) => post('/members', m),
  update: (id, m) => put(`/members/${id}`, m),
  delete: (id) => del(`/members/${id}`),
};

// ============================================================================
// ACCOUNTS
// ============================================================================
export const accounts = {
  list: () => get('/accounts'),
  create: (a) => post('/accounts', a),
  update: (id, a) => put(`/accounts/${id}`, a),
  delete: (id) => del(`/accounts/${id}`),
  merge: (targetId, sourceId) => post(`/accounts/${targetId}/merge/${sourceId}`, {}),
};

// ============================================================================
// TRANSACTIONS
// ============================================================================
export const transactions = {
  list: (accountId = null) => get(accountId ? `/transactions?account_id=${accountId}` : '/transactions'),
  create: (t) => post('/transactions', t),
  bulkImport: (accountId, txs) => post('/transactions/import', { account_id: accountId, transactions: txs }),
  update: (id, t) => put(`/transactions/${id}`, t),
  delete: (id) => del(`/transactions/${id}`),
  applyRuleRetroactively: (ruleId) => post(`/transactions/rules/${ruleId}/apply-retroactively`, {}),
  recategorizeTransfers: () => post('/transactions/recategorize-transfers', {}),
};

// ============================================================================
// WEALTH
// ============================================================================
export const assets = {
  list: () => get('/assets'),
  create: (a) => post('/assets', a),
  update: (id, a) => put(`/assets/${id}`, a),
  delete: (id) => del(`/assets/${id}`),
};

export const liabilities = {
  list: () => get('/liabilities'),
  create: (l) => post('/liabilities', l),
  update: (id, l) => put(`/liabilities/${id}`, l),
  delete: (id) => del(`/liabilities/${id}`),
};

// Monthly net-worth snapshots (patrimoine history)
export const wealthSnapshots = {
  list: () => get('/wealth/snapshots'),
  upsert: (payload) => post('/wealth/snapshots', payload),
  delete: (id) => del(`/wealth/snapshots/${id}`),
};

// ============================================================================
// CATEGORIES, BUDGETS, GOALS, ACHIEVEMENTS, RULES
// ============================================================================
export const categories = {
  list: () => get('/categories'),
  create: (c) => post('/categories', c),
  update: (slug, c) => put(`/categories/${slug}`, c),
  delete: (slug) => del(`/categories/${slug}`),
};

export const budgets = {
  list: () => get('/budgets'),
  set: (categorySlug, amount) => post('/budgets', { category_slug: categorySlug, amount }),
  delete: (slug) => del(`/budgets/${slug}`),
};

export const goals = {
  list: () => get('/goals'),
  create: (g) => post('/goals', g),
  update: (id, g) => put(`/goals/${id}`, g),
  delete: (id) => del(`/goals/${id}`),
};

export const achievements = {
  list: () => get('/achievements'),
  unlock: (slug) => post(`/achievements/${slug}`, {}),
};

export const rules = {
  list: () => get('/rules'),
  create: (r) => post('/rules', r),
  delete: (id) => del(`/rules/${id}`),
};

export const payees = {
  list: () => get('/payees'),
  create: (p) => post('/payees', p),
  update: (id, p) => put(`/payees/${id}`, p),
  delete: (id) => del(`/payees/${id}`),
  merge: (id, otherId) => post(`/payees/${id}/merge/${otherId}`, {}),
};

export const categorizeEngine = {
  preview: (label, amount = 0) => post('/categorize/preview', { label, amount }),
  getLearningSettings: () => get('/learning/settings'),
  updateLearningSettings: (enabled) => put('/learning/settings', { auto_learning_enabled: enabled }),
};

// ============================================================================
// AI CATEGORIZATION
// ============================================================================
export const categorizeAI = {
  // transactions: [{label, amount}] -> {results: {label: slug}, ai_used, ai_available}
  categorize: (transactions) => post('/categorize', { transactions }),
};

// ============================================================================
// LIVE QUOTES (Yahoo Finance — stocks, ETFs, crypto)
// ============================================================================
export const quotes = {
  // tickers: ["AAPL", "CW8.PA", "BTC-EUR"] -> { AAPL: {price, changePct, ...}, ... }
  get: (tickers) => get(`/quotes?tickers=${encodeURIComponent(tickers.join(','))}`),
};

// ============================================================================
// FIXED CHARGES (charges fixes stables — loyer, abonnements…)
// ============================================================================
export const fixedCharges = {
  list: () => get('/fixed-charges'),
  create: (fc) => post('/fixed-charges', fc),
  update: (id, fc) => put(`/fixed-charges/${id}`, fc),
  delete: (id) => del(`/fixed-charges/${id}`),
};

// ============================================================================
// DCA — systematic investment plans
// ============================================================================
// Demo seed for the DCA view so the projection hero + plan cards have data
// to render in demo mode. Real backend serves /dca normally.
const DEMO_DCA_PLANS = [
  {
    id: 'demo-dca-1', name: 'ETF Monde (CW8)', ticker: 'CW8',
    amount: 400, frequency: 'monthly', expected_return: 7, target_years: 20,
    start_date: '2024-09-01', day_of_month: 5, status: 'active',
    currency: 'EUR', account_id: null, notes: '',
  },
  {
    id: 'demo-dca-2', name: 'S&P 500 (SPY)', ticker: 'SPY',
    amount: 200, frequency: 'monthly', expected_return: 8, target_years: 15,
    start_date: '2025-01-15', day_of_month: 15, status: 'active',
    currency: 'EUR', account_id: null, notes: '',
  },
  {
    id: 'demo-dca-3', name: 'Bitcoin DCA', ticker: 'BTC',
    amount: 100, frequency: 'monthly', expected_return: 12, target_years: 10,
    start_date: '2025-06-01', day_of_month: 1, status: 'paused',
    currency: 'EUR', account_id: null, notes: '',
  },
];

const isDemo = () => typeof window !== 'undefined' && window.localStorage.getItem('wealthly:demo') === '1';

export const dcaApi = {
  list:   ()         => isDemo() ? Promise.resolve(DEMO_DCA_PLANS) : get('/dca'),
  create: (body)     => post('/dca', body),
  update: (id, body) => put(`/dca/${id}`, body),
  remove: (id)       => del(`/dca/${id}`),
  setExecutions: (id, executions) => put(`/dca/${id}/executions`, { executions }),
};

// ============================================================================
// REF MONTH (Mois type) — JSON budget template scoped per (household, member).
// memberId = null/'all'/'household' → Famille (compte joint).
// memberId = '<uuid>'              → Mois type personnel de cet adulte.
// Demo mode persists a map { [scopeKey]: refMonth } in localStorage.
// ============================================================================
const REF_MONTH_DEMO_KEY = 'wealthly:demo_ref_months';
const REF_MONTH_DEMO_KEY_LEGACY = 'wealthly:demo_ref_month';
function _emptyRefMonth() {
  return { version: 1, updated_at: null, lines: [] };
}
function _scopeKey(memberId) {
  return (!memberId || memberId === 'all' || memberId === 'household') ? '__household__' : String(memberId);
}
function _isHouseholdScope(memberId) {
  return !memberId || memberId === 'all' || memberId === 'household';
}
function _readDemoRefMonths() {
  try {
    const raw = localStorage.getItem(REF_MONTH_DEMO_KEY);
    if (raw) return JSON.parse(raw);
    // Lazy-migrate the legacy single-blob storage to the new map under household scope.
    const legacy = localStorage.getItem(REF_MONTH_DEMO_KEY_LEGACY);
    if (legacy) {
      const map = { __household__: JSON.parse(legacy) };
      localStorage.setItem(REF_MONTH_DEMO_KEY, JSON.stringify(map));
      return map;
    }
    return {};
  } catch { return {}; }
}
function _readDemoRefMonth(memberId) {
  const map = _readDemoRefMonths();
  return map[_scopeKey(memberId)] || _emptyRefMonth();
}
function _writeDemoRefMonth(memberId, payload) {
  try {
    const map = _readDemoRefMonths();
    const stamped = { ...payload, updated_at: new Date().toISOString().slice(0, 10) };
    map[_scopeKey(memberId)] = stamped;
    localStorage.setItem(REF_MONTH_DEMO_KEY, JSON.stringify(map));
    return stamped;
  } catch { return payload; }
}
function _qs(memberId) {
  return _isHouseholdScope(memberId) ? '' : `?member_id=${encodeURIComponent(memberId)}`;
}
export const refMonth = {
  get: (memberId) => isDemo()
    ? Promise.resolve(_readDemoRefMonth(memberId))
    : get(`/me/ref-month${_qs(memberId)}`),
  put: (memberId, payload) => isDemo()
    ? Promise.resolve(_writeDemoRefMonth(memberId, payload))
    : put(`/me/ref-month${_qs(memberId)}`, payload),
};

// ============================================================================
// MIGRATION FROM v2 JSON BACKUP
// ============================================================================
export const migrate = {
  importJson: (jsonData) => post('/migrate/import-json', jsonData),
};

// Wipe : supprime toutes les données du foyer en une transaction côté
// backend (transactions, comptes, assets, dettes, snapshots, budgets,
// goals, rules, fixed_charges, dca, bank_connections, members,
// categories). Préserve User + Household pour que le compte reste
// utilisable. Endpoint dans other.py : DELETE /me/wipe.
export const wipeHousehold = () => del('/me/wipe');

// Change le mot de passe de l'utilisateur connecté (preuve d'identité
// = current_password). Différent du reset par lien email.
auth.changePassword = (currentPassword, newPassword) =>
  post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });

// ============================================================================
// GoCardless Bank Account Data — open banking sync
// ============================================================================
export const banking = {
  /** List available banks in a country (default FR). Returns institutions
   *  with their GoCardless id (used as bank_name in /connect). */
  listBanks: (country = 'FR') => get(`/banking/banks?country=${country}`),

  /** Initiate connection → returns {redirect_url, connection_id, state}.
   *  The user is then sent to redirect_url to consent at their bank. */
  connect: (bankName, bankCountry = 'FR') =>
    post('/banking/connect', { bank_name: bankName, bank_country: bankCountry }),

  /** Complete after the bank redirects back with ?ref={state}. */
  complete: (state) => post('/banking/complete', { state }),

  /** Sync transactions for a connection */
  sync: (connectionId, daysBack = 90) =>
    post(`/banking/sync/${connectionId}?days_back=${daysBack}`),

  /** Re-poll requisition status to update accounts list */
  refreshConnection: (id) => post(`/banking/refresh/${id}`),

  /** List all connections */
  listConnections: () => get('/banking/connections'),

  /** Delete a connection (also revokes the GoCardless requisition) */
  deleteConnection: (id) => del(`/banking/connections/${id}`),

  /** Diagnostic santé d'une connexion (ping GoCardless en temps réel) */
  diagnose: (id) => get(`/banking/connections/${id}/diagnose`),
};

// ============================================================================
// WEALTH — unified facade routing to accounts / assets / liabilities
// ----------------------------------------------------------------------------
// Frontend components consume api.wealth.* exclusively. This module knows
// how to map a unified payload to the right backend table based on the
// (category, subtype, syncMode) triple.
// ============================================================================

// Internal: decide which backend table a (category, subtype, syncMode) goes to.
const _resolveTarget = ({ category, subtype, syncMode }) => {
  if (category === 'emprunts') return 'liability';
  // Synced banking items (live transactions) → account
  if (syncMode === 'synced' && ['compte_courant', 'pea', 'av', 'livret'].includes(subtype)) {
    return 'account';
  }
  // Everything else (manual investments, immo, crypto, or, autre) → asset
  return 'asset';
};

// Map canonical subtype → backend type string (and optional asset.subtype for refinement).
// Returns { type, subtype? }.
const _resolveBackendType = (canonicalSubtype, target) => {
  if (target === 'liability') {
    // mortgage / consumer_loan / auto_loan / other_loan match the backend enum directly
    return { type: canonicalSubtype };
  }
  if (target === 'account') {
    if (canonicalSubtype === 'compte_courant') return { type: 'checking' };
    if (canonicalSubtype === 'livret')         return { type: 'savings' };
    if (canonicalSubtype === 'av')             return { type: 'life_insurance' };
    // pea matches as-is
    return { type: canonicalSubtype };
  }
  // ── asset target ───────────────────────────────────────────────────────────
  // Asset.type column accepts ONLY: real_estate, life_insurance, pea, per,
  // savings_account, crypto, stocks, other_asset. Map canonical → these.
  switch (canonicalSubtype) {
    case 'rp':       return { type: 'real_estate', subtype: 'RP' };
    case 'locatif':  return { type: 'real_estate', subtype: 'locative' };
    case 'scpi':     return { type: 'real_estate', subtype: 'scpi' };
    case 'cto':      return { type: 'stocks' };
    case 'livret':   return { type: 'savings_account' };
    case 'av':       return { type: 'life_insurance' };
    case 'pea':      return { type: 'pea' };
    case 'per':      return { type: 'per' };
    case 'crypto':   return { type: 'crypto' };
    case 'or':       return { type: 'other_asset' };  // pas de type 'or' backend — stocké en other_asset
    case 'autre':    return { type: 'other_asset' };
    case 'cash':     return { type: 'other_asset' };  // espèces non-bancaires
    default:         return { type: 'other_asset' };  // fallback safe
  }
};

export const wealth = {
  // Renvoie { target, data } pour que l'appelant puisse pousser l'objet
  // directement dans son state sans attendre un reloadAll() complet.
  create: async (payload) => {
    const target = _resolveTarget(payload);
    const { type: backendType, subtype: backendSubtype } = _resolveBackendType(payload.subtype, target);

    if (target === 'liability') {
      // Le wizard envoie soit la version riche (initialCapital/monthlyPayment/…),
      // soit l'ancienne version réduite (juste value). On gère les deux pour ne
      // pas casser les callers historiques.
      const initialCapital = payload.initialCapital != null
        ? payload.initialCapital
        : (payload.value || 0);
      const remainingCapital = payload.remainingCapital != null
        ? payload.remainingCapital
        : (payload.value || initialCapital);
      const liaPayload = {
        type: backendType,
        name: payload.name,
        initial_capital: initialCapital,
        remaining_capital: remainingCapital,
        monthly_payment: payload.monthlyPayment || 0,
        interest_rate: payload.interestRate || 0,
        currency: payload.currency || 'EUR',
        member_ids: payload.memberIds || [],
      };
      // Champs optionnels : ne les envoyer que si renseignés, pour éviter de
      // pousser des 0/null/'' qui parasitent le calcul d'amortissement.
      if (payload.durationMonths) liaPayload.duration_months = payload.durationMonths;
      if (payload.startDate)      liaPayload.start_date = payload.startDate;
      if (payload.downPayment != null && payload.downPayment !== '')
        liaPayload.down_payment = payload.downPayment;
      if (payload.insuranceRate != null && payload.insuranceRate !== '')
        liaPayload.insurance_rate = payload.insuranceRate;
      if (payload.applicationFees != null && payload.applicationFees !== '')
        liaPayload.application_fees = payload.applicationFees;
      if (payload.ownershipPct != null && payload.ownershipPct !== '' && payload.ownershipPct !== 100)
        liaPayload.ownership_pct = payload.ownershipPct;
      if (payload.linkedAssetId) liaPayload.linked_asset_id = payload.linkedAssetId;
      const data = await liabilities.create(liaPayload);
      return { target, data };
    }
    if (target === 'account') {
      const data = await accounts.create({
        name: payload.name,
        bank: payload.bank || payload.name,
        type: backendType,
        initial_balance: payload.value || 0,
        currency: payload.currency || 'EUR',
        member_ids: payload.memberIds || [],
        role: payload.role || 'principal',
      });
      return { target, data };
    }
    // asset
    const data = await assets.create({
      name: payload.name,
      type: backendType,
      ...(backendSubtype ? { subtype: backendSubtype } : {}),
      current_value: payload.value || 0,
      currency: payload.currency || 'EUR',
      member_ids: payload.memberIds || [],
      ...(payload.meta || {}),
    });
    return { target, data };
  },

  update: async (item, patch) => {
    if (item.sourceTable === 'account') return accounts.update(item.sourceId, patch);
    if (item.sourceTable === 'asset')   return assets.update(item.sourceId, patch);
    if (item.sourceTable === 'liability') return liabilities.update(item.sourceId, patch);
  },

  delete: async (item) => {
    // existing namespaces expose `.delete` (see accounts/assets/liabilities above)
    const fn = (ns) => ns.remove || ns.delete;
    if (item.sourceTable === 'account')   return fn(accounts)(item.sourceId);
    if (item.sourceTable === 'asset')     return fn(assets)(item.sourceId);
    if (item.sourceTable === 'liability') return fn(liabilities)(item.sourceId);
  },
};

// Re-export to keep SUBTYPE_TO_CATEGORY reachable from api.js consumers if needed.
export { SUBTYPE_TO_CATEGORY };
