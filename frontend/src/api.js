/**
 * API service: all HTTP calls to the Yotori Finance backend.
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
// MUTATION ACTIVITY TRACKER
// ============================================================================
// Counter incremente a chaque mutation (POST/PUT/DELETE) en cours, decremente
// a la fin. Sert a piloter un indicateur global de "ca tourne" (top bar GSAP
// dans YotoriApp). Les GET ne comptent pas (trop frequents, bruit).
let __mutationCount = 0;
const __mutationListeners = new Set();
const notifyMutations = () => {
  __mutationListeners.forEach(fn => { try { fn(__mutationCount); } catch {} });
};
export const subscribeMutations = (fn) => {
  __mutationListeners.add(fn);
  fn(__mutationCount);
  return () => __mutationListeners.delete(fn);
};
const startMutation = () => { __mutationCount++; notifyMutations(); };
const endMutation = () => { __mutationCount = Math.max(0, __mutationCount - 1); notifyMutations(); };

// ============================================================================
// BACKEND HEALTH TRACKER
// ============================================================================
// État global de connectivité au backend, alimenté par les fetchs et un
// polling automatique en cas de panne. Sert à afficher un banner papier-chaud
// "Le serveur ne répond pas — on retente automatiquement…" quand Railway
// est down ou en cold start.
//
// États possibles :
//  - 'online'    : tout fonctionne (état initial optimiste)
//  - 'offline'   : un fetch a échoué côté réseau (TypeError / 5xx persistant)
//  - 'restored'  : on vient de repasser online (flash 3s puis retour à online)
//
// Le hook `useBackendStatus` (dans hooks/useBackendStatus.js) consomme ça.
let __backendStatus = 'online';
let __backendOfflineSince = null; // timestamp ms quand on est passé offline
let __backendRetryTimer = null;
let __backendRetryAttempt = 0;
const __backendListeners = new Set();
const notifyBackend = () => {
  const snapshot = {
    status: __backendStatus,
    offlineSince: __backendOfflineSince,
    retryAttempt: __backendRetryAttempt,
  };
  __backendListeners.forEach(fn => { try { fn(snapshot); } catch {} });
};
export const subscribeBackendStatus = (fn) => {
  __backendListeners.add(fn);
  fn({ status: __backendStatus, offlineSince: __backendOfflineSince, retryAttempt: __backendRetryAttempt });
  return () => __backendListeners.delete(fn);
};

// Retry exponentiel : 2s → 5s → 10s → 20s → 30s (capped)
const RETRY_DELAYS = [2000, 5000, 10000, 20000, 30000];
const scheduleBackendPing = () => {
  if (__backendRetryTimer) clearTimeout(__backendRetryTimer);
  const delay = RETRY_DELAYS[Math.min(__backendRetryAttempt, RETRY_DELAYS.length - 1)];
  __backendRetryTimer = setTimeout(async () => {
    __backendRetryTimer = null;
    try {
      const res = await fetchWithTimeout(`${API_BASE}/auth/me`, { credentials: 'include' }, 8000);
      // 401 = serveur up mais session expirée → on est online quand même
      if (res.ok || res.status === 401) {
        markBackendOnline();
      } else {
        __backendRetryAttempt++;
        scheduleBackendPing();
      }
    } catch {
      __backendRetryAttempt++;
      scheduleBackendPing();
    }
  }, delay);
};

const markBackendOffline = () => {
  if (__backendStatus === 'offline') return;
  __backendStatus = 'offline';
  __backendOfflineSince = Date.now();
  __backendRetryAttempt = 0;
  notifyBackend();
  scheduleBackendPing();
};

const markBackendOnline = () => {
  if (__backendStatus === 'online') return;
  const wasOffline = __backendStatus === 'offline';
  if (__backendRetryTimer) { clearTimeout(__backendRetryTimer); __backendRetryTimer = null; }
  __backendRetryAttempt = 0;
  if (wasOffline) {
    // Flash "rétabli" puis on revient à online silencieux
    __backendStatus = 'restored';
    notifyBackend();
    setTimeout(() => {
      __backendStatus = 'online';
      __backendOfflineSince = null;
      notifyBackend();
    }, 2800);
  } else {
    __backendStatus = 'online';
    __backendOfflineSince = null;
    notifyBackend();
  }
};

// ── Session expirée : signal global ────────────────────────────────────────
// Quand une requête authentifiée renvoie 401 (cookie expiré), on prévient l'app
// pour qu'elle bascule proprement sur l'écran de connexion au lieu de laisser
// l'utilisateur sur des données mortes. Les endpoints /auth/* sont exclus (un
// 401 y est normal : mauvais identifiants, /auth/me non connecté, etc.).
const __sessionListeners = new Set();
export const subscribeSessionExpired = (fn) => {
  __sessionListeners.add(fn);
  return () => __sessionListeners.delete(fn);
};
const notifySessionExpired = () => {
  __sessionListeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
};

// Sonde de session SANS throw : distingue une vraie invalidation d'un simple
// hoquet réseau. Renvoie 'valid' | 'invalid' | 'unknown'. Sert à confirmer un
// 401 isolé avant de purger la session (cf. App.jsx) — un timeout/cold-start
// ne doit PAS déconnecter l'utilisateur.
export const probeSession = async () => {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/auth/me`, { credentials: 'include' }, 8000);
    if (res.status === 401) return 'invalid';
    if (res.ok) return 'valid';
    return 'unknown';
  } catch {
    return 'unknown';
  }
};

// Retry manuel déclenché par le banner ("Réessayer maintenant")
export const retryBackendNow = () => {
  if (__backendRetryTimer) { clearTimeout(__backendRetryTimer); __backendRetryTimer = null; }
  __backendRetryAttempt = 0;
  scheduleBackendPing();
};

// Timeout dur sur toute requête API. SANS ça, si le backend accepte la
// connexion mais ne répond jamais (ex. DB Supabase injoignable → l'API se fige),
// le fetch pend indéfiniment → l'UI reste coincée sur "Patientez…" sans jamais
// rendre la main. 15 s couvre un cold-start raisonnable ; au-delà on échoue
// proprement avec un message + bascule offline (banner + retry auto).
const REQUEST_TIMEOUT_MS = 15000;

// fetch + timeout via AbortController (réutilisable).
async function fetchWithTimeout(url, opts = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// CORE FETCH WRAPPER
// ============================================================================
async function request(method, path, body = null, { timeoutMs, affectsBackendHealth = true } = {}) {
  // In demo mode the UI is fed from demoData.js; never hit the backend.
  if (typeof window !== 'undefined' && window.localStorage.getItem('yotori:demo') === '1') {
    if (method === 'GET') return null;
    throw new Error('Mode démo : modifications non enregistrées');
  }

  const isMutation = method !== 'GET';
  if (isMutation) startMutation();

  const headers = { 'Content-Type': 'application/json' };

  const opts = {
    method,
    headers,
    credentials: 'include',  // critical: lets the browser send the auth cookie
  };
  if (body !== null) opts.body = JSON.stringify(body);

  let response;
  try {
    // timeoutMs : certains flux légitimement lents (GoCardless : 2-3 appels
    // upstream séquentiels + cold start Railway) dépassent les 15 s par
    // défaut — le client abandonnait ALORS QUE le backend aboutissait
    // (connexion « pending » créée mais jamais de redirection → l'user
    // recliquait → duplicats). Ces appels passent un timeout dédié.
    response = await fetchWithTimeout(`${API_BASE}${path}`, opts, timeoutMs || REQUEST_TIMEOUT_MS);
  } catch (err) {
    if (isMutation) endMutation();
    // Long GoCardless calls can time out while Wealthly itself is perfectly
    // healthy. Those callers opt out of the global availability banner and
    // surface their own banking error instead.
    if (affectsBackendHealth) markBackendOffline();
    const timedOut = err?.name === 'AbortError';
    throw new Error(timedOut
      ? 'Le serveur ne répond pas pour le moment. Réessayez dans un instant.'
      : 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.');
  }

  // Any HTTP response proves the Wealthly server answered. A 502/503 may be
  // an upstream bank failure and must not trigger the misleading global
  // "Le serveur ne répond pas" banner.
  markBackendOnline();

  if (response.status === 401) {
    if (isMutation) endMutation();
    let errMsg = 'Session expirée';
    try { const d = await response.clone().json(); errMsg = d?.detail || errMsg; } catch {}
    // Signal global de session expirée — sauf pour les endpoints d'auth
    // eux-mêmes (login/register/me/reset : un 401 y est attendu, pas une
    // expiration de session en cours d'usage).
    if (!path.startsWith('/auth/')) notifySessionExpired();
    throw new Error(errMsg);
  }

  if (response.status === 204) {
    if (isMutation) endMutation();
    return null; // No Content
  }

  let data;
  try {
    data = await response.json();
  } catch {
    if (isMutation) endMutation();
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return null;
  }

  if (!response.ok) {
    if (isMutation) endMutation();
    const detail = data?.detail || data?.message || `Erreur ${response.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  if (isMutation) endMutation();
  return data;
}

const get = (path, opts) => request('GET', path, null, opts);
const post = (path, body, opts) => request('POST', path, body, opts);
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
  /** Marque un lot de tx comme revues (review_status='reviewed'). */
  markReviewed: (ids) => post('/transactions/mark-reviewed', { ids }),
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
  // transactions: [{label, amount}] -> {results: {label: slug}, sources: {label: source}, ai_used, ai_available}
  // Un provider peut refuser le modèle principal puis déclencher plusieurs
  // fallbacks. Le timeout global de 15 s coupait alors la requête côté
  // navigateur pendant que Railway continuait le travail, d'où « Échec de la
  // catégorisation IA » sans POST visible immédiatement dans les logs.
  categorize: (transactions, { deep = false } = {}) => post(
    '/categorize',
    { transactions, deep },
    { timeoutMs: 60000, affectsBackendHealth: false },
  ),
  // Persistance groupée des résultats : un seul commit au lieu d'un PUT par
  // transaction (130 opérations ne doivent pas produire 130 requêtes HTTP).
  apply: (updates) => post('/categorize/apply', { updates }),
  // Passe GRATUITE (moteur serveur, zéro LLM) : re-résout côté backend toutes
  // les tx non catégorisées du foyer -> {updated, results: [{id, category_slug,
  // cat_source, is_transfer_override}]}. Appelée automatiquement au chargement.
  enginePass: () => post('/categorize/engine', {}),
};

// ============================================================================
// BILAN MENSUEL PAR EMAIL
// ============================================================================
export const reports = {
  getSettings: () => isDemo() ? Promise.resolve({ monthly_report_enabled: false }) : get('/reports/settings'),
  setSettings: (enabled) => put('/reports/settings', { monthly_report_enabled: enabled }),
  sendTest: () => post('/reports/test', {}),
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

const isDemo = () => typeof window !== 'undefined' && window.localStorage.getItem('yotori:demo') === '1';

export const dcaApi = {
  list:   ()         => isDemo() ? Promise.resolve(DEMO_DCA_PLANS) : get('/dca'),
  create: (body)     => post('/dca', body),
  update: (id, body) => put(`/dca/${id}`, body),
  remove: (id)       => del(`/dca/${id}`),
  setExecutions: (id, executions) => put(`/dca/${id}/executions`, { executions }),
};

// ============================================================================
// PLANNED EVENTS — one-off future-dated cash movements (Vue Projection)
// ============================================================================
export const plannedEvents = {
  list:   ()         => isDemo() ? Promise.resolve(DEMO_PLANNED_EVENTS) : get('/planned-events'),
  create: (body)     => post('/planned-events', body),
  update: (id, body) => put(`/planned-events/${id}`, body),
  delete: (id)       => del(`/planned-events/${id}`),
};

// Demo seed so the Projection view shows a meaningful trough in demo mode.
const DEMO_PLANNED_EVENTS = [
  { id: 'demo-pe-1', label: 'Impôts sur le revenu', amount: 4200, direction: 'out', date: '2026-09-15', account_id: null, category_slug: 'taxes', notes: '' },
  { id: 'demo-pe-2', label: 'Prime annuelle', amount: 1800, direction: 'in', date: '2026-12-01', account_id: null, category_slug: null, notes: '' },
];

// ============================================================================
// AI INSIGHTS — coach patrimoine + alertes (Claude Haiku côté backend)
// ============================================================================
const DEMO_INSIGHTS = {
  coach: [
    { title: 'Épargne solide', body: 'Vous épargnez 24 % de vos revenus ce mois-ci — au-dessus du repère des 20 %.' },
    { title: 'Patrimoine net', body: 'Votre patrimoine net progresse régulièrement sur les 12 derniers mois.' },
  ],
  alerts: [
    { severity: 'warn', text: 'Restaurants : 320 € ce mois (+45 % vs votre moyenne).' },
  ],
  ai_used: false, ai_available: false,
};

export const insights = {
  // force=true (bouton rafraîchir) → ignore le cache serveur 24h (compte au plafond).
  // scope = 'all' (foyer) ou id du membre → cache Coach ventilé par scope côté serveur.
  get: (snapshot, force = false, scope = 'all') =>
    isDemo() ? Promise.resolve(DEMO_INSIGHTS) : post('/ai/insights', { ...snapshot, force, scope }),
};

// ============================================================================
// NOTIFICATIONS — alertes intelligentes (cloche)
// ============================================================================
const DEMO_NOTIFICATIONS = [
  { id: 'demo-n1', kind: 'budget_overrun', severity: 'warn', title: 'Budget Restaurants dépassé', body: '320 € dépensés ce mois-ci sur un budget de 250 €.', data: {}, link: 'monthly', status: 'unread', created_at: '2026-06-05T09:00:00' },
  { id: 'demo-n2', kind: 'subscription_hike', severity: 'info', title: 'Abonnement en hausse', body: '« NETFLIX » est passé de ~13 € à 18 € (+38 %).', data: {}, link: 'transactions', status: 'unread', created_at: '2026-06-03T09:00:00' },
];

export const notifications = {
  list:    ()   => isDemo() ? Promise.resolve(DEMO_NOTIFICATIONS) : get('/notifications'),
  refresh: ()   => isDemo() ? Promise.resolve(DEMO_NOTIFICATIONS) : post('/notifications/refresh'),
  read:    (id) => isDemo() ? Promise.resolve() : put(`/notifications/${id}/read`),
  readAll: ()   => isDemo() ? Promise.resolve() : post('/notifications/read-all'),
  dismiss: (id) => isDemo() ? Promise.resolve() : del(`/notifications/${id}`),
};

// ============================================================================
// REF MONTH (Mois type) — JSON budget template scoped per (household, member).
// memberId = null/'all'/'household' → Famille (compte joint).
// memberId = '<uuid>'              → Mois type personnel de cet adulte.
// Demo mode persists a map { [scopeKey]: refMonth } in localStorage.
// ============================================================================
const REF_MONTH_DEMO_KEY = 'yotori:demo_ref_months';
const REF_MONTH_DEMO_KEY_LEGACY = 'yotori:demo_ref_month';
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
// Demo seed pour banking.* — alimenté depuis demoData via getDemoData() ;
// dupliqué ici car api.js ne doit pas importer demoData.js (cycle).
const DEMO_BANK_CONNECTIONS = () => {
  try {
    const raw = window?.localStorage?.getItem('yotori:demo_bank_connections_cache');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

// Un 429 GoCardless concerne le budget de l'intégration, pas la connexion
// bancaire de l'utilisateur. Mémoriser un court cooldown dans le navigateur
// évite que les différents boutons/auto-sync relancent aussitôt une rafale.
const BANK_SYNC_COOLDOWN_KEY = 'wealthly:bank_sync_cooldown_until';
const getBankSyncCooldown = () => {
  try { return Number(window?.localStorage?.getItem(BANK_SYNC_COOLDOWN_KEY) || 0); } catch { return 0; }
};
const setBankSyncCooldown = (seconds) => {
  try { window?.localStorage?.setItem(BANK_SYNC_COOLDOWN_KEY, String(Date.now() + seconds * 1000)); } catch {}
};

async function syncBankingConnection(connectionId, daysBack = 90, { initialSync = false } = {}) {
  if (isDemo()) {
    return { connection_id: connectionId, imported: 0, skipped: 0, errors: [], status: 'ready', pending_accounts: [], accounts_read: 0, last_synced_at: new Date().toISOString(), new_tx_ids: [] };
  }
  const remainingSeconds = Math.ceil((getBankSyncCooldown() - Date.now()) / 1000);
  if (remainingSeconds > 0) {
    return { connection_id: connectionId, imported: 0, skipped: 0, errors: [], status: 'rate_limited', rate_limited_accounts: [], retry_after_seconds: remainingSeconds, pending_accounts: [], accounts_read: 0, new_tx_ids: [] };
  }
  const result = await post(`/banking/sync/${connectionId}?days_back=${daysBack}&initial_sync=${initialSync ? 'true' : 'false'}`, null, { timeoutMs: 90000, affectsBackendHealth: false });
  if (result?.status === 'rate_limited') {
    setBankSyncCooldown(Math.max(60, Number(result.retry_after_seconds) || 300));
  }
  return result;
}

export const banking = {
  /** Délai restant avant qu'une nouvelle lecture bancaire soit autorisée. */
  getSyncCooldownSeconds: () => Math.max(0, Math.ceil((getBankSyncCooldown() - Date.now()) / 1000)),

  /** List available banks in a country (default FR). Returns institutions
   *  with their GoCardless id (used as bank_name in /connect). */
  listBanks: (country = 'FR') => isDemo() ? Promise.resolve([]) : get(`/banking/banks?country=${country}`, { affectsBackendHealth: false }),

  /** Initiate connection → returns {redirect_url, connection_id, state}.
   *  The user is then sent to redirect_url to consent at their bank.
   *  Timeout étendu : 2-3 appels GoCardless séquentiels côté backend +
   *  cold start Railway → les 15 s par défaut coupaient AVANT la réponse
   *  (l'user croyait que « rien ne se passe » et recliquait → duplicats). */
  connect: (bankName, bankCountry = 'FR') =>
    post('/banking/connect', { bank_name: bankName, bank_country: bankCountry }, { timeoutMs: 40000, affectsBackendHealth: false }),

  /** Complete after the bank redirects back with ?ref={state}. */
  complete: (state) => post('/banking/complete', { state }, { timeoutMs: 40000, affectsBackendHealth: false }),

  /** Reconnexion en un clic d'une connexion existante (consentement DSP2
   *  expiré/proche de l'expiration). Réutilise la banque d'origine → renvoie
   *  {redirect_url, connection_id, state}, l'user est renvoyé chez sa banque. */
  reconnect: (connectionId) =>
    post(`/banking/reconnect/${connectionId}`, null, { timeoutMs: 40000, affectsBackendHealth: false }),

  /** Sync transactions for a connection. En démo : renvoie un succès vide
   *  immédiat plutôt qu'un throw, pour que le SyncButton ait un comportement
   *  crédible (badge "à l'instant", pas d'erreur visible). */
  sync: syncBankingConnection,

  /** Re-poll requisition status to update accounts list */
  refreshConnection: (id) => post(`/banking/refresh/${id}`, null, { timeoutMs: 40000, affectsBackendHealth: false }),

  /** List all connections. En démo : lit la liste seedée par YotoriApp
   *  (mis en cache dans localStorage lors du reloadAll démo). */
  listConnections: () => isDemo() ? Promise.resolve(DEMO_BANK_CONNECTIONS()) : get('/banking/connections'),

  /** Delete a connection (also revokes the GoCardless requisition) */
  deleteConnection: (id) => del(`/banking/connections/${id}`),

  /** Diagnostic santé d'une connexion (ping GoCardless en temps réel) */
  diagnose: (id) => isDemo()
    ? Promise.resolve({ connection_id: id, verdict: 'ok', issues: [], recommendation: null, local_status: 'authorized', gocardless_status: 'LN', last_sync_age_hours: 2 })
    : get(`/banking/connections/${id}/diagnose`, { affectsBackendHealth: false }),
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
