import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar, ComposedChart, Sankey, Layer, Rectangle } from 'recharts';
import { Upload, Plus, TrendingUp, TrendingDown, Wallet, Home, Coins, CreditCard, Users, Settings, Download, Trash2, Edit3, Check, X, ChevronRight, ChevronLeft, ChevronDown, AlertCircle, AlertTriangle, Repeat, Calendar, ArrowUpDown, Eye, EyeOff, Sparkles, PiggyBank, Bitcoin, Banknote, Landmark, BarChart3, Target, Heart, Sun, Moon, Zap, Activity, ArrowUp, ArrowDown, Minus, PartyPopper, Lightbulb, Bell, ChevronUp, Play, Lock, Unlock, LogOut, Cloud, RefreshCw, FileText, Calculator, Link2, Unlink, Menu } from 'lucide-react';
import * as api from './api.js';
import { useTranslation } from 'react-i18next';
import { LangButton } from './components/LangButton.jsx';
import { CurrencyButton } from './components/CurrencyButton.jsx';
import { HideAmountsContext } from './contexts/HideAmounts.jsx';
import { CurrencyContext } from './contexts/Currency.jsx';
import { getDemoData } from './demoData.js';
import {
  APP_NAME, STORAGE_KEYS, DEFAULT_CATEGORIES, DEFAULT_RULES, BANK_PROFILES,
  ASSET_TYPES, ASSET_CLASS_MAP, LIABILITY_TYPES,
} from './constants.js';
import { storage } from './storage.js';
import {
  formatCurrency, formatDate, monthKey, dayOfMonth, generateId, hashTransaction,
  parseCSV, detectBankProfile, autoDetectMapping, applyMapping,
  categorize, detectRecurring,
  accountIncludeInNetWorth, accountCountsAsIncome, accountCountsAsExpense,
  detectInternalTransfers, convertCurrency, ACCOUNT_ROLES,
} from './utils.js';
import { useRates } from './hooks/useRates.js';
import { useBaseCurrency } from './hooks/useBaseCurrency.js';
import { useQuotes } from './hooks/useQuotes.js';
import { Styles } from './Styles.jsx';
import { Toast } from './components/Toast.jsx';
import { AnimatedNumber } from './components/AnimatedNumber.jsx';
import { Onboarding } from './views/Onboarding.jsx';
import { Transactions } from './views/Transactions.jsx';
import { Analysis } from './views/Analysis.jsx';
import { Monthly } from './views/Monthly.jsx';
import { Cashflow } from './views/Cashflow.jsx';
import { Budgets } from './views/Budgets.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { Wealth } from './views/Wealth.jsx';
import { SettingsView } from './views/Settings.jsx';
import { Admin } from './views/Admin.jsx';
import { ImportFlow } from './views/ImportFlow.jsx';
import { DCAView } from './views/DCA.jsx';
import { dcaApi } from './api.js';
import { AccountDrawer } from './components/AccountDrawer.jsx';
import { useTheme, ThemeToggle } from './components/ui/ThemeToggle.jsx';
import Logo from './components/Logo.jsx';
import { AddWealthModal } from './components/AddWealthModal.jsx';
import { detectDuplicates } from './utils/duplicateDetector.js';
import { DuplicateMergeModal } from './components/DuplicateMergeModal.jsx';
import { useWealthItems } from './hooks/useWealthItems.js';

const TaxSimulator = lazy(() => import('./TaxSimulator.jsx'));

// Disable Recharts animations globally — they cause noticeable jank on iOS Safari
// (SVG <animate> on every render) and add no UX value for static financial data.
[Line, Bar, Area, Pie, RadialBar, Sankey].forEach((C) => {
  if (C) C.defaultProps = { ...(C.defaultProps || {}), isAnimationActive: false };
});

// Deterministic color from a bank name string (used in sidebar account dots).
// Uses the v3 dataviz palette (light-mode hex) so dots harmonise with charts.
function bankColor(name) {
  const colors = ['#2540D9','#1F8E6E','#C2733B','#7B57C6','#B85D7A','#4D4D4D','#E0B23E','#7a8aa8'];
  if (!name) return colors[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

// ============================================================================
// MAIN APP
// ============================================================================
export default function WealthlyApp({ demoMode = false, onExitDemo, onLogout }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === '1'; } catch { return false; }
  });
  // URL hash routing: #/<view>?m=<memberId>. Lets refresh / back-forward /
  // bookmark / share links restore the exact view + active member.
  const parseHash = () => {
    if (typeof window === 'undefined') return { view: 'dashboard', memberId: 'all' };
    const raw = (window.location.hash || '').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const params = new URLSearchParams(query || '');
    return { view: path || 'dashboard', memberId: params.get('m') || 'all' };
  };
  const initialHash = parseHash();
  const [view, setView] = useState(initialHash.view);
  // Account drawer + cross-view transaction filter (set when "voir toutes" is
  // clicked from the drawer, consumed by <Transactions> on mount).
  const [drawerAccount, setDrawerAccount] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [txInitialAccountFilter, setTxInitialAccountFilter] = useState(null);
  const [theme] = useTheme();
  const [members, setMembers] = useState([]);
  const [activeMemberId, setActiveMemberId] = useState(initialHash.memberId);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [customRules, setCustomRules] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [budgets, setBudgets] = useState({});
  const [recurringOverrides, setRecurringOverrides] = useState({});
  const [goals, setGoals] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [fixedCharges, setFixedCharges] = useState([]);
  const [dcaPlans, setDcaPlans] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('w2:current_user') || 'null'); } catch { return null; }
  });
  const [hideAmounts, setHideAmounts] = useState(false);
  useEffect(() => {
    if (hideAmounts) document.documentElement.setAttribute('data-hide-amounts', '1');
    else document.documentElement.removeAttribute('data-hide-amounts');
  }, [hideAmounts]);
  const [toast, setToast] = useState(null);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);

  // Multi-currency: user's display currency + live FX rates (Frankfurter, 1h cache).
  // EUR base is implicit (rates table is { USD: 1.08, GBP: 0.85, CHF: 0.97 }).
  const [baseCurrency, setBaseCurrency] = useBaseCurrency();
  const { rates, date: ratesDate } = useRates();

  // Live investment quotes — derive the unique ticker list from assets and
  // hand it to useQuotes. Yahoo Finance via /quotes endpoint (5-min cache).
  const tickerList = useMemo(
    () => assets.map(a => a.ticker).filter(Boolean),
    [assets]
  );
  const { quotes: liveQuotes } = useQuotes(tickerList);

  // Banking sync state
  const [bankConnections, setBankConnections] = useState([]);
  const [bankingPendingState, setBankingPendingState] = useState(null); // state param from callback URL

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showBankConnect, setShowBankConnect] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importStep, setImportStep] = useState('upload');
  const [parsedData, setParsedData] = useState(null);
  const [detectedBank, setDetectedBank] = useState(null);
  const [currentMapping, setCurrentMapping] = useState({});
  const [importAccount, setImportAccount] = useState({ name: '', bank: '', memberIds: [], type: 'checking', initialBalance: 0 });
  const [importPreview, setImportPreview] = useState([]);

  // ============================================================================
  // API â†" Frontend mapping helpers (snake_case â†" camelCase)
  // ============================================================================
  // Convert an Account from API shape to frontend shape (memberIds, initialBalance...)
  const accountFromApi = (a) => ({
    id: a.id,
    name: a.name,
    bank: a.bank,
    type: a.type,
    role: a.role || 'principal',
    initialBalance: a.initial_balance,
    currency: a.currency || 'EUR',
    memberIds: a.member_ids || [],
    currentBalance: a.current_balance,
  });
  const accountToApi = (a) => ({
    name: a.name,
    bank: a.bank,
    type: a.type,
    role: a.role || 'principal',
    initial_balance: parseFloat(a.initialBalance) || 0,
    currency: a.currency || 'EUR',
    member_ids: a.memberIds || [],
  });
  // Transactions
  const txFromApi = (t) => ({
    id: t.id,
    accountId: t.account_id,
    date: t.date,
    label: t.label || '',
    amount: t.amount,
    categoryId: t.category_slug, // we treat slugs as ids on the frontend
    isManualCategory: t.is_manual_category,
    isRecurringOverride: t.is_recurring_override,
    isTransferOverride: t.is_transfer_override ?? null,
    notes: t.notes || '',
  });
  const txToApi = (t) => ({
    account_id: t.accountId,
    date: t.date,
    label: t.label || '',
    amount: parseFloat(t.amount),
    category_slug: t.categoryId || null,
    is_manual_category: t.isManualCategory || false,
    is_recurring_override: t.isRecurringOverride ?? null,
    is_transfer_override: t.isTransferOverride ?? null,
    notes: t.notes || '',
  });
  // Assets
  const assetFromApi = (a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    currentValue: a.current_value,
    currency: a.currency || 'EUR',
    ticker: a.ticker || '',
    quantity: a.quantity ?? null,
    notes: a.notes || '',
    memberIds: a.member_ids || [],
    updatedAt: a.updated_at,
    subtype: a.subtype || null,
    purchasePrice: a.purchase_price ?? null,
    surfaceM2: a.surface_m2 ?? null,
    notaryFees: a.notary_fees ?? null,
    agencyFees: a.agency_fees ?? null,
    worksFees: a.works_fees ?? null,
    furnitureFees: a.furniture_fees ?? null,
    purchaseDate: a.purchase_date || null,
    constructionYear: a.construction_year ?? null,
    ownershipPct: a.ownership_pct ?? 100,
    address: a.address || '',
    parentAssetId: a.parent_asset_id || null,
  });
  const assetToApi = (a) => {
    const numOrNull = (v) => (v === '' || v == null) ? null : parseFloat(v);
    const intOrNull = (v) => (v === '' || v == null) ? null : parseInt(v, 10);
    return {
      type: a.type,
      name: a.name,
      current_value: parseFloat(a.currentValue) || 0,
      currency: a.currency || 'EUR',
      ticker: (a.ticker || '').trim().toUpperCase() || null,
      quantity: numOrNull(a.quantity),
      notes: a.notes || '',
      member_ids: a.memberIds || [],
      subtype: a.subtype || null,
      purchase_price: numOrNull(a.purchasePrice),
      surface_m2: numOrNull(a.surfaceM2),
      notary_fees: numOrNull(a.notaryFees),
      agency_fees: numOrNull(a.agencyFees),
      works_fees: numOrNull(a.worksFees),
      furniture_fees: numOrNull(a.furnitureFees),
      purchase_date: a.purchaseDate || null,
      construction_year: intOrNull(a.constructionYear),
      ownership_pct: numOrNull(a.ownershipPct) ?? 100,
      address: a.address || null,
      parent_asset_id: a.parentAssetId || null,
    };
  };
  // Liabilities
  const liaFromApi = (l) => ({
    id: l.id,
    type: l.type,
    name: l.name,
    initialCapital: l.initial_capital,
    remainingCapital: l.remaining_capital,
    monthlyPayment: l.monthly_payment,
    interestRate: l.interest_rate,
    endDate: l.end_date,
    currency: l.currency || 'EUR',
    notes: l.notes || '',
    memberIds: l.member_ids || [],
    downPayment: l.down_payment ?? null,
    insuranceRate: l.insurance_rate ?? null,
    applicationFees: l.application_fees ?? null,
    ownershipPct: l.ownership_pct ?? 100,
    durationMonths: l.duration_months ?? null,
    startDate: l.start_date || null,
    linkedAssetId: l.linked_asset_id || null,
  });
  const liaToApi = (l) => ({
    type: l.type,
    name: l.name,
    initial_capital: parseFloat(l.initialCapital) || 0,
    remaining_capital: parseFloat(l.remainingCapital) || 0,
    monthly_payment: parseFloat(l.monthlyPayment) || 0,
    interest_rate: parseFloat(l.interestRate) || 0,
    end_date: l.endDate || null,
    currency: l.currency || 'EUR',
    notes: l.notes || '',
    member_ids: l.memberIds || [],
    down_payment: l.downPayment !== '' && l.downPayment != null ? parseFloat(l.downPayment) : null,
    insurance_rate: l.insuranceRate !== '' && l.insuranceRate != null ? parseFloat(l.insuranceRate) : null,
    application_fees: l.applicationFees !== '' && l.applicationFees != null ? parseFloat(l.applicationFees) : null,
    ownership_pct: l.ownershipPct !== '' && l.ownershipPct != null ? parseFloat(l.ownershipPct) : 100,
    duration_months: l.durationMonths !== '' && l.durationMonths != null ? parseInt(l.durationMonths, 10) : null,
    start_date: l.startDate || null,
    linked_asset_id: l.linkedAssetId || null,
  });
  // Goals
  const goalFromApi = (g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji || '🎯',
    target: g.target_amount,
    current: g.current_amount,
    deadline: g.deadline,
  });
  const goalToApi = (g) => ({
    name: g.name,
    emoji: g.emoji || '🎯',
    target_amount: parseFloat(g.target) || 0,
    current_amount: parseFloat(g.current) || 0,
    deadline: g.deadline || null,
  });
  // Categories from API have a different shape — flatten
  const categoryFromApi = (c) => ({
    id: c.slug, // we use slug as id throughout the frontend
    name: c.name,
    color: c.color,
    icon: c.icon,
    type: c.type,
    kind: c.kind,
  });

  // Sync view + activeMember → URL hash, so refresh / back / forward / share work.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = activeMemberId && activeMemberId !== 'all' ? `?m=${activeMemberId}` : '';
    const next = `#/${view}${params}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [view, activeMemberId]);

  // Reflect browser back/forward (hashchange) into React state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const h = parseHash();
      setView(h.view);
      setActiveMemberId(h.memberId);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Drop a stale member id from the URL if the user is gone from the household
  // (avoids a "no data" silent state after a refresh on a deleted member).
  useEffect(() => {
    if (activeMemberId === 'all') return;
    if (members.length === 0) return; // not loaded yet
    if (!members.find(m => m.id === activeMemberId)) setActiveMemberId('all');
  }, [members, activeMemberId]);

  // Reload everything from the server (or from demoData.js in demo mode).
  const reloadAll = useCallback(async () => {
    if (demoMode) {
      const d = getDemoData();
      setMembers(d.members);
      setAccounts(d.accounts);
      setTransactions(d.transactions);
      setAssets(d.assets);
      setLiabilities(d.liabilities);
      setCategories(DEFAULT_CATEGORIES);
      setBudgets(d.budgets);
      setGoals(d.goals);
      setFixedCharges(d.fixedCharges || []);
      setWealthHistory(d.wealthHistory || []);
      setCustomRules(d.customRules);
      dcaApi.list().then(setDcaPlans).catch(() => {});
      return;
    }
    try {
      const [memList, accList, txList, astList, liaList, catList, budList, goalList, achList, ruleList, connList, dcaList] = await Promise.all([
        api.members.list(),
        api.accounts.list(),
        api.transactions.list(),
        api.assets.list(),
        api.liabilities.list(),
        api.categories.list(),
        api.budgets.list(),
        api.goals.list(),
        api.achievements.list().catch(() => []),
        api.rules.list(),
        api.banking.listConnections().catch(() => []),
        dcaApi.list().catch(() => []),
      ]);
      const mappedAccounts = accList.map(accountFromApi);
      const mappedTx = txList.map(txFromApi);
      const mappedAssets = astList.map(assetFromApi);
      const mappedLia = liaList.map(liaFromApi);
      const cats = (catList || []).map(categoryFromApi);
      const finalCats = cats.length > 0 ? cats : DEFAULT_CATEGORIES;
      const budDict = {};
      (budList || []).forEach(b => { budDict[b.category_slug] = b.amount; });
      const mappedGoals = (goalList || []).map(goalFromApi);
      const mappedRules = (ruleList || []).map(r => ({ pattern: r.pattern, categoryId: r.category_slug, source: r.source, _id: r.id }));
      setMembers(memList);
      setAccounts(mappedAccounts);
      setTransactions(mappedTx);
      setAssets(mappedAssets);
      setLiabilities(mappedLia);
      setCategories(finalCats);
      setBudgets(budDict);
      setGoals((goalList || []).map(goalFromApi));
      setAchievements((achList || []).map(a => a.achievement_slug));
      // Custom rules
      setCustomRules((ruleList || []).map(r => ({ pattern: r.pattern, categoryId: r.category_slug, source: r.source, _id: r.id })));
      setBankConnections(connList || []);
      setDcaPlans(dcaList || []);
    } catch (err) {
      showToast('Erreur de chargement : ' + err.message, 'error');
    }
  }, [demoMode]);

  // Load
  useEffect(() => {
    (async () => {
      // Load local UI prefs first (instant)
      const [ov, am] = await Promise.all([
        storage.get(STORAGE_KEYS.RECURRING_OVERRIDES, {}),
        storage.get(STORAGE_KEYS.ACTIVE_MEMBER, 'all'),
      ]);
      setRecurringOverrides(ov);
      // URL hash is the source of truth for activeMemberId (see parseHash).
      // Only fall back to storage when the hash didn't specify one, so a
      // bookmarked / refreshed per-member URL keeps winning over the prior
      // session preference. Demo mode also falls back to 'all' if no hash.
      if (initialHash.memberId === 'all') {
        setActiveMemberId(demoMode ? 'all' : am);
      }
      setColumnMappings(await storage.get(STORAGE_KEYS.MAPPINGS, {}));

      if (demoMode) {
        // Demo data is local — load synchronously then show.
        await reloadAll();
        setOnboarded(true);
        setLoading(false);
      } else {
        // Restore cache immediately (milliseconds — no network).
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.DATA_CACHE);
          if (raw) {
            const c = JSON.parse(raw);
            if (c.members) setMembers(c.members);
            if (c.accounts) setAccounts(c.accounts);
            if (c.transactions) setTransactions(c.transactions);
            if (c.assets) setAssets(c.assets);
            if (c.liabilities) setLiabilities(c.liabilities);
            if (c.categories) setCategories(c.categories);
            if (c.budgets) setBudgets(c.budgets);
            if (c.goals) setGoals(c.goals);
            if (c.fixedCharges) setFixedCharges(c.fixedCharges);
            if (c.customRules) setCustomRules(c.customRules);
          }
        } catch {}

        // Show the app NOW — don't gate on Railway cold-start (15-30s).
        // Empty states are fine; data fills in once the backend wakes up.
        setLoading(false);

        // Refresh from API in the background.
        reloadAll().then(async () => {
          try {
            const me = await api.auth.me();
            if (me) {
              setCurrentUser(me);
              try { localStorage.setItem('w2:current_user', JSON.stringify(me)); } catch {}
            }
            const memList = await api.members.list();
            const hasMembers = memList && memList.length > 0;
            setOnboarded(hasMembers);
            try { localStorage.setItem(STORAGE_KEYS.ONBOARDED, hasMembers ? '1' : '0'); } catch {}
            // Note : la synchro bancaire GoCardless se déclenche manuellement
            // depuis Settings ou via le bouton Synchroniser du Dashboard.
          } catch {}
        }).catch(() => {});
      }
      setLoading(false);

      // Handle GoCardless callback: URL contains ?ref={requisition_reference}
      // after the bank consent. Legacy ?state=&code= still accepted in case
      // someone has an old half-completed redirect bookmarked.
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref') || urlParams.get('state');
      if (refParam) {
        setBankingPendingState({ state: refParam });
        // Clean up URL without reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
  }, [reloadAll]);

  // persist is used only for client-side UI prefs (theme, active member, recurring overrides, mappings)
  const persist = useCallback(async (key, value) => { await storage.set(key, value); }, []);

  useEffect(() => { if (!loading) persist(STORAGE_KEYS.ACTIVE_MEMBER, activeMemberId); }, [activeMemberId, loading, persist]);

  // Toast helper
  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };


  // ===== Visibility filtering =====
  const visibleAccountIds = useMemo(() => {
    if (activeMemberId === 'all') return new Set(accounts.map(a => a.id));
    return new Set(accounts.filter(a => (a.memberIds || []).includes(activeMemberId)).map(a => a.id));
  }, [accounts, activeMemberId]);

  const visibleAccounts = useMemo(() => accounts.filter(a => visibleAccountIds.has(a.id)), [accounts, visibleAccountIds]);
  const visibleTransactions = useMemo(() => transactions.filter(t => visibleAccountIds.has(t.accountId)), [transactions, visibleAccountIds]);
  // Live-pricing pass: when an asset has a ticker + quantity AND we have a
  // quote for it, override its currentValue with quantity × livePrice.
  // We also surface livePrice / changePct / liveCurrency on the asset object
  // so views can render the "Live" badge and daily change badge.
  const livePricedAssets = useMemo(() => assets.map(a => {
    const t = (a.ticker || '').trim().toUpperCase();
    const qty = parseFloat(a.quantity);
    if (!t || !qty || !liveQuotes || !liveQuotes[t]) return a;
    const q = liveQuotes[t];
    return {
      ...a,
      currentValue: q.price * qty,
      currency: q.currency || a.currency || 'EUR',
      _livePrice: q.price,
      _liveChangePct: q.changePct,
      _liveAt: q.fetchedAt,
    };
  }), [assets, liveQuotes]);

  const visibleAssets = useMemo(() => activeMemberId === 'all' ? livePricedAssets : livePricedAssets.filter(a => (a.memberIds || []).includes(activeMemberId)), [livePricedAssets, activeMemberId]);
  const visibleLiabilities = useMemo(() => activeMemberId === 'all' ? liabilities : liabilities.filter(l => (l.memberIds || []).includes(activeMemberId)), [liabilities, activeMemberId]);

  const memberShare = useCallback((item) => {
    if (!item.memberIds || item.memberIds.length === 0) return 1;
    if (activeMemberId === 'all') return 1;
    if (!item.memberIds.includes(activeMemberId)) return 0;
    return 1 / item.memberIds.length;
  }, [activeMemberId]);

  // ===== Computed values =====
  const accountBalances = useMemo(() => {
    const balances = {};
    if (demoMode) {
      // Demo accounts carry a pre-computed currentBalance — use it directly so
      // displayed figures match the intended demo numbers instead of the raw
      // transaction sum (which diverges because initialBalance is not set to
      // match the 6-month transaction history).
      accounts.forEach(a => { balances[a.id] = a.currentBalance ?? (a.initialBalance || 0); });
      return balances;
    }
    accounts.forEach(a => { balances[a.id] = a.initialBalance || 0; });
    transactions.forEach(t => { balances[t.accountId] = (balances[t.accountId] || 0) + t.amount; });
    return balances;
  }, [accounts, transactions, demoMode]);

  // ---- Duplicate detection (Account vs Asset legacy duplicates) ----
  const [duplicatePairs, setDuplicatePairs] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);

  const allWealthItems = useWealthItems({ accounts, assets, liabilities, accountBalances });

  useEffect(() => {
    if (duplicatesDismissed) return;
    if (!accounts.length || !assets.length) return;
    const pairs = detectDuplicates(allWealthItems);
    setDuplicatePairs(pairs);
  }, [allWealthItems, accounts.length, assets.length, duplicatesDismissed]);

  const liquidWealth = useMemo(
    () => visibleAccounts
      .filter(a => accountIncludeInNetWorth(a.role))
      .reduce((sum, a) => sum + (accountBalances[a.id] || 0) * memberShare(a), 0),
    [visibleAccounts, accountBalances, memberShare]
  );
  const assetsValue = useMemo(() => visibleAssets.reduce((sum, a) => sum + (parseFloat(a.currentValue) || 0) * memberShare(a), 0), [visibleAssets, memberShare]);
  const liabilitiesValue = useMemo(() => visibleLiabilities.reduce((sum, l) => sum + (parseFloat(l.remainingCapital) || 0) * memberShare(l), 0), [visibleLiabilities, memberShare]);
  const netWorth = liquidWealth + assetsValue - liabilitiesValue;

  // ---- Wealth snapshots (patrimoine history) ----
  const [wealthHistory, setWealthHistory] = useState([]);
  const lastSnapshotKeyRef = useRef(null);

  // Load snapshot history once on mount.
  useEffect(() => {
    let cancelled = false;
    api.wealthSnapshots.list().then((rows) => {
      if (!cancelled && Array.isArray(rows)) setWealthHistory(rows);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Auto-upsert the current month's snapshot whenever the net-worth math
  // resolves to a meaningful value. Gated by a ref so we don't spam the
  // backend on every re-render — we only re-post if the month or the
  // computed totals changed materially.
  useEffect(() => {
    if (!Number.isFinite(netWorth)) return;
    if (liquidWealth === 0 && assetsValue === 0 && liabilitiesValue === 0) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Compute the breakdown fields needed by the brut / net / financier toggle.
    const realEstateValue = visibleAssets
      .filter(a => a.type === 'real_estate')
      .reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0);
    const financialAssetsValue = liquidWealth + (assetsValue - realEstateValue);
    const mortgageDebt = visibleLiabilities
      .filter(l => l.type === 'mortgage')
      .reduce((s, l) => s + (parseFloat(l.remainingCapital) || 0) * memberShare(l), 0);
    const otherDebt = liabilitiesValue - mortgageDebt;
    // Round to 1 â‚¬ so micro-fluctuations don't trigger noisy POSTs.
    const key = `${month}|${Math.round(netWorth)}|${Math.round(liquidWealth)}|${Math.round(assetsValue)}|${Math.round(liabilitiesValue)}|${Math.round(realEstateValue)}|${Math.round(mortgageDebt)}`;
    if (lastSnapshotKeyRef.current === key) return;
    lastSnapshotKeyRef.current = key;
    const handle = setTimeout(() => {
      api.wealthSnapshots.upsert({
        month,
        net_worth: Number(netWorth.toFixed(2)),
        liquid_wealth: Number(liquidWealth.toFixed(2)),
        assets_value: Number(assetsValue.toFixed(2)),
        liabilities_value: Number(liabilitiesValue.toFixed(2)),
        real_estate_value: Number(realEstateValue.toFixed(2)),
        financial_assets_value: Number(financialAssetsValue.toFixed(2)),
        mortgage_debt: Number(mortgageDebt.toFixed(2)),
        other_debt: Number(otherDebt.toFixed(2)),
      }).then((row) => {
        setWealthHistory((prev) => {
          const others = prev.filter((s) => s.month !== row.month);
          return [...others, row].sort((a, b) => a.month.localeCompare(b.month));
        });
      }).catch(() => {});
    }, 1500); // debounce — wait for any settling re-renders before posting
    return () => clearTimeout(handle);
  }, [netWorth, liquidWealth, assetsValue, liabilitiesValue, visibleAssets, visibleLiabilities, memberShare]);

  const recurringData = useMemo(() => detectRecurring(visibleTransactions, recurringOverrides), [visibleTransactions, recurringOverrides]);
  const recurringIds = recurringData.recurringIds;
  const recurringGroups = recurringData.recurringGroups;

  // Identify pair-matched transfers between the user's own accounts so we
  // can exclude them from cashflow aggregates. Recomputes whenever the
  // visible transaction set changes.
  // Effective set = auto-detected âˆª {override:true} âˆ’ {override:false}.
  // Override is the source of truth so the user can always correct a bad
  // auto-classification. Pairs come from auto-detection only — manual
  // overrides don't reconstruct a counterpart.
  const { transferIds, transferPairs } = useMemo(() => {
    const auto = detectInternalTransfers(visibleTransactions);
    const ids = new Set();
    visibleTransactions.forEach(t => {
      if (t.isTransferOverride === true) ids.add(t.id);
      else if (t.isTransferOverride === false) { /* explicitly NOT a transfer */ }
      else if (auto.has(t.id)) ids.add(t.id);
    });
    // Filter out pairs whose either leg has been overridden to "not a transfer"
    const overriddenOff = new Set(visibleTransactions.filter(t => t.isTransferOverride === false).map(t => t.id));
    const pairs = (auto.pairs || []).filter(p => !overriddenOff.has(p.outTxId) && !overriddenOff.has(p.inTxId));
    return { transferIds: ids, transferPairs: pairs };
  }, [visibleTransactions]);

  const monthlyEvolution = useMemo(() => {
    const monthly = {};
    const sortedTx = [...visibleTransactions].sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set();
    sortedTx.forEach(t => months.add(monthKey(t.date)));
    const sortedMonths = Array.from(months).sort();
    // Net worth running balance counts every account whose role contributes
    // to patrimoine net (everything except 'professionnel' by default).
    let runningTotal = visibleAccounts
      .filter(a => accountIncludeInNetWorth(a.role))
      .reduce((sum, a) => sum + (a.initialBalance || 0) * memberShare(a), 0);
    sortedMonths.forEach(m => { monthly[m] = { month: m, income: 0, expenses: 0, net: 0, balance: 0, fixed: 0, variable: 0, savings: 0 }; });
    sortedTx.forEach(t => {
      const m = monthKey(t.date);
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const sharedAmount = t.amount * share;
      const cat = categories.find(c => c.id === t.categoryId);
      const role = acc?.role || 'principal';
      const isTransfer = transferIds.has(t.id);
      // Cashflow attribution depends on (1) whether this tx is an internal
      // transfer (excluded from income/expense regardless of role), and
      // (2) the account's role for non-transfer flows.
      if (!isTransfer) {
        if (t.amount > 0) {
          if (accountCountsAsIncome(role)) monthly[m].income += sharedAmount;
        } else {
          if (accountCountsAsExpense(role)) {
            const absShared = Math.abs(sharedAmount);
            monthly[m].expenses += absShared;
            if (recurringIds.has(t.id)) monthly[m].fixed += absShared;
            else monthly[m].variable += absShared;
            if (cat?.kind === 'savings') monthly[m].savings += absShared;
          }
        }
      }
      // Running balance still tracks every transaction on a NW-eligible
      // account, so the net worth chart stays correct even when an epargne
      // account receives a transfer (the source account's symmetric outflow
      // cancels it out at the foyer level).
      if (accountIncludeInNetWorth(role)) monthly[m].net += sharedAmount;
    });
    sortedMonths.forEach(m => { runningTotal += monthly[m].net; monthly[m].balance = runningTotal; });
    return Object.values(monthly);
  }, [visibleTransactions, visibleAccounts, accounts, categories, recurringIds, memberShare, transferIds]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const thisMonthStats = useMemo(() => monthlyEvolution.find(x => x.month === currentMonth) || { income: 0, expenses: 0, net: 0, fixed: 0, variable: 0, savings: 0 }, [monthlyEvolution, currentMonth]);

  // 50/30/20 breakdown
  const fiftyThirtyTwenty = useMemo(() => {
    const breakdown = { needs: 0, wants: 0, savings: 0, total: 0 };
    visibleTransactions.forEach(t => {
      if (monthKey(t.date) !== currentMonth) return;
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const cat = categories.find(c => c.id === t.categoryId);
      if (t.amount < 0) {
        const abs = Math.abs(t.amount) * share;
        if (cat?.kind === 'needs') breakdown.needs += abs;
        else if (cat?.kind === 'wants') breakdown.wants += abs;
        else if (cat?.kind === 'savings') breakdown.savings += abs;
        breakdown.total += abs;
      }
    });
    return breakdown;
  }, [visibleTransactions, accounts, categories, currentMonth, memberShare]);

  // Category breakdown for current month, with previous 3-month avg
  const categoryAnalysis = useMemo(() => {
    const result = {};
    const lastMonths = monthlyEvolution.slice(-4, -1).map(m => m.month);
    categories.filter(c => c.type === 'expense').forEach(cat => {
      result[cat.id] = { current: 0, history: {}, avg3m: 0 };
      lastMonths.forEach(m => { result[cat.id].history[m] = 0; });
    });
    visibleTransactions.forEach(t => {
      if (t.amount >= 0) return;
      if (transferIds.has(t.id)) return; // skip internal transfers
      const acc = accounts.find(a => a.id === t.accountId);
      // Honor the account's role: epargne / investissement / professionnel
      // outflows are not real expenses, don't count them in the analysis.
      if (acc && !accountCountsAsExpense(acc.role)) return;
      const share = acc ? memberShare(acc) : 1;
      const m = monthKey(t.date);
      const abs = Math.abs(t.amount) * share;
      const catId = t.categoryId || 'uncategorized';
      if (!result[catId]) result[catId] = { current: 0, history: {}, avg3m: 0 };
      if (m === currentMonth) result[catId].current += abs;
      else if (lastMonths.includes(m)) result[catId].history[m] = (result[catId].history[m] || 0) + abs;
    });
    Object.values(result).forEach(v => {
      const histVals = Object.values(v.history);
      v.avg3m = histVals.length > 0 ? histVals.reduce((s, x) => s + x, 0) / histVals.length : 0;
    });
    return result;
  }, [visibleTransactions, categories, currentMonth, monthlyEvolution, accounts, memberShare, transferIds]);

  // Number of budget categories the user has overspent this month — drives
  // the red dot on the "Budgets" nav button so the user notices without
  // having to open the page.
  const budgetsOverCount = useMemo(() => {
    let count = 0;
    for (const [catId, budget] of Object.entries(budgets)) {
      if (budget > 0 && (categoryAnalysis[catId]?.current || 0) > budget) count += 1;
    }
    return count;
  }, [budgets, categoryAnalysis]);

  // Anomaly detection: categories that doubled vs avg
  const anomalies = useMemo(() => {
    return Object.entries(categoryAnalysis)
      .filter(([catId, data]) => data.avg3m > 30 && data.current > data.avg3m * 1.5)
      .map(([catId, data]) => {
        const cat = categories.find(c => c.id === catId);
        return {
          categoryId: catId,
          name: cat?.name,
          icon: cat?.icon,
          color: cat?.color,
          current: data.current,
          avg: data.avg3m,
          ratio: data.current / data.avg3m,
        };
      })
      .sort((a, b) => b.ratio - a.ratio);
  }, [categoryAnalysis, categories]);

  // Cashflow projection: based on day of month + recurring + avg
  const cashflowProjection = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = currentMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (!isCurrentMonth) return null;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayNum = today.getDate();
    const elapsed = dayNum / daysInMonth;
    const projected = { income: thisMonthStats.income / Math.max(elapsed, 0.05), expenses: thisMonthStats.expenses / Math.max(elapsed, 0.05) };
    return {
      daysLeft: daysInMonth - dayNum,
      elapsed: Math.round(elapsed * 100),
      projectedIncome: projected.income,
      projectedExpenses: projected.expenses,
      projectedNet: projected.income - projected.expenses,
    };
  }, [thisMonthStats, currentMonth]);

  // ============================================================================
  // ACTIONS — all hit the API
  // ============================================================================
  const completeOnboarding = async (data) => {
    try {
      // Create members on the server
      for (const m of data.members) {
        await api.members.create({ name: m.name, role: m.role, color: m.color });
      }
      await reloadAll();
      setOnboarded(true);
      showToast('Foyer configuré.', 'success');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    const text = await file.text();
    const parsed = parseCSV(text);
    setParsedData(parsed);
    const detected = detectBankProfile(parsed.headers);
    setDetectedBank(detected);
    if (detected && detected.profile.mapping) {
      setCurrentMapping(detected.profile.mapping);
      setImportAccount(prev => ({ ...prev, bank: detected.profile.name }));
    } else {
      setCurrentMapping(autoDetectMapping(parsed.headers));
    }
    setImportStep('mapping');
  };

  const proceedToAccountStep = () => {
    if (!currentMapping.date || (!currentMapping.amount && (!currentMapping.debit || !currentMapping.credit))) {
      showToast('Mappez au minimum la colonne Date et Montant (ou Débit + Crédit)', 'warning');
      return;
    }
    setImportStep('account');
  };

  const proceedToPreview = async () => {
    if (!importAccount.name) { showToast('Donnez un nom à ce compte', 'warning'); return; }
    if (!importAccount.memberIds || importAccount.memberIds.length === 0) { showToast('Assignez ce compte à au moins un membre', 'warning'); return; }
    let accountId;
    const existing = accounts.find(a => a.name === importAccount.name && a.bank === importAccount.bank);
    accountId = existing ? existing.id : generateId();
    const options = detectedBank ? (detectedBank.profile.options || {}) : {};
    const txs = applyMapping(parsedData.rows, currentMapping, accountId, options);

    // Pass 1: local regex categorization (instant)
    txs.forEach(t => { t.categoryId = categorize(t, customRules); });

    // Pass 2: AI categorization for uncategorized transactions
    const uncategorized = txs.filter(t => t.categoryId === 'uncategorized' && t.label);
    if (uncategorized.length > 0) {
      setImportStep('preview');
      setImportPreview(txs); // show immediately while AI runs
      try {
        const res = await api.categorizeAI.categorize(
          uncategorized.map(t => ({ label: t.label, amount: t.amount }))
        );
        if (res.ai_used) {
          txs.forEach(t => {
            if (t.categoryId === 'uncategorized' && res.results[t.label] && res.results[t.label] !== 'uncategorized') {
              t.categoryId = res.results[t.label];
              t.aiCategorized = true;
            }
          });
          const aiCount = txs.filter(t => t.aiCategorized).length;
          showToast(`${aiCount} transaction${aiCount > 1 ? 's' : ''} catégorisée${aiCount > 1 ? 's' : ''} par IA.`, 'success');
        }
      } catch {
        // AI unavailable — silent fallback, uncategorized stays as-is
      }
      setImportPreview([...txs]);
    } else {
      setImportPreview(txs);
      setImportStep('preview');
    }
  };

  const confirmImport = async () => {
    try {
      let accountId;
      const existing = accounts.find(a => a.name === importAccount.name && a.bank === importAccount.bank);
      if (existing) {
        accountId = existing.id;
      } else {
        // Create new account
        const created = await api.accounts.create(accountToApi({
          name: importAccount.name,
          bank: importAccount.bank,
          type: importAccount.type,
          initialBalance: importAccount.initialBalance,
          memberIds: importAccount.memberIds,
        }));
        accountId = created.id;
      }
      // Save bank mapping locally for next imports
      if (importAccount.bank) {
        const newMappings = { ...columnMappings, [importAccount.bank]: currentMapping };
        setColumnMappings(newMappings);
        await persist(STORAGE_KEYS.MAPPINGS, newMappings);
      }
      // Bulk import transactions via API (server handles dedup)
      const txsForApi = importPreview.map(tx => ({
        ...txToApi(tx),
        account_id: accountId, // override to ensure correct account
      }));
      const result = await api.transactions.bulkImport(accountId, txsForApi);
      showToast(`✅ ${result.inserted} transactions ajoutées${result.skipped_duplicates > 0 ? ` · ${result.skipped_duplicates} doublons ignorés` : ''}`, 'success');
      // Reload from server to get fresh state
      await reloadAll();
      setImportFile(null); setImportStep('upload'); setParsedData(null);
      setCurrentMapping({}); setImportPreview([]); setImportAccount({ name: '', bank: '', memberIds: [], type: 'checking', initialBalance: 0 });
      setView('dashboard');
    } catch (err) {
      showToast('Erreur d\'import : ' + err.message, 'error');
    }
  };

  const cancelImport = () => {
    setImportFile(null); setImportStep('upload'); setParsedData(null);
    setCurrentMapping({}); setImportPreview([]); setDetectedBank(null);
  };

  const updateTransactionCategory = async (txId, categoryId) => {
    try {
      await api.transactions.update(txId, { category_slug: categoryId, is_manual_category: true });
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, categoryId, isManualCategory: true } : t));
      // Learn rule for similar future transactions
      const tx = transactions.find(t => t.id === txId);
      if (tx && tx.label) {
        const keyword = tx.label.split(/\s+/).filter(w => w.length > 4).slice(0, 1)[0];
        if (keyword) {
          const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const exists = customRules.some(r => r.pattern === pattern && r.categoryId === categoryId);
          if (!exists) {
            try {
              const newRule = await api.rules.create({ pattern, category_slug: categoryId, source: 'learned' });
              setCustomRules(prev => [...prev, { pattern, categoryId, source: 'learned', _id: newRule.id }]);
            } catch {}
          }
        }
      }
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const toggleRecurring = async (txId, isFixed) => {
    // Stored locally as UI override (the backend has its own column but we keep this client-side for speed)
    const newOverrides = { ...recurringOverrides, [txId]: isFixed };
    setRecurringOverrides(newOverrides);
    await persist(STORAGE_KEYS.RECURRING_OVERRIDES, newOverrides);
    // Also persist to backend
    try { await api.transactions.update(txId, { is_recurring_override: isFixed }); } catch {}
  };

  // Override the auto-detected internal-transfer flag for a single tx.
  // Tri-state: true = force-transfer, false = force-not-transfer, null =
  // defer to auto-detection. Persisted to the backend via PUT /transactions.
  const setTransferOverride = async (txId, value) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, isTransferOverride: value } : t));
    try { await api.transactions.update(txId, { is_transfer_override: value }); }
    catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteTransaction = async (txId) => {
    if (!confirm('Supprimer cette transaction ?')) return;
    try {
      await api.transactions.delete(txId);
      setTransactions(prev => prev.filter(t => t.id !== txId));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const createAccount = async (fields) => {
    try {
      const created = await api.accounts.create(accountToApi(fields));
      setAccounts(prev => [...prev, accountFromApi(created)]);
      showToast('Compte ajouté', 'success');
      setShowAddAccount(false);
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const updateAccount = async (accId, patch) => {
    const fieldMap = { initialBalance: 'initial_balance', memberIds: 'member_ids' };
    const apiPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      apiPatch[fieldMap[k] || k] = k === 'initialBalance' ? (parseFloat(v) || 0) : v;
    }
    try {
      const updated = await api.accounts.update(accId, apiPatch);
      const mapped = accountFromApi(updated);
      setAccounts(prev => prev.map(a => a.id === accId ? { ...a, ...mapped } : a));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteAccount = async (accId) => {
    if (!confirm('Supprimer ce compte et toutes ses transactions ?')) return;
    try {
      await api.accounts.delete(accId);
      setAccounts(prev => prev.filter(a => a.id !== accId));
      setTransactions(prev => prev.filter(t => t.accountId !== accId));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const unlockAchievement = async (slug) => {
    try {
      await api.achievements.unlock(slug);
      setAchievements(prev => prev.includes(slug) ? prev : [...prev, slug]);
    } catch {}
  };

  // ===== Banking / GoCardless =====
  const completeBankCallback = useCallback(async (pending) => {
    try {
      const result = await api.banking.complete(pending.state);
      setBankingPendingState(null);
      if (result.status === 'authorized') {
        showToast('🏦 Banque connectée ! Vous pouvez maintenant synchroniser vos transactions.', 'success');
        const conns = await api.banking.listConnections();
        setBankConnections(conns);
      } else {
        showToast('En attente d\'autorisation bancaire...', 'info');
      }
    } catch (err) {
      setBankingPendingState(null);
      showToast('Erreur connexion bancaire : ' + err.message, 'error');
    }
  }, []);

  // Auto-complete when bankingPendingState is set (after URL callback detection)
  useEffect(() => {
    if (bankingPendingState && !loading) {
      completeBankCallback(bankingPendingState);
    }
  }, [bankingPendingState, loading, completeBankCallback]);

  const syncBankConnection = async (connectionId) => {
    try {
      showToast('⏳ Synchronisation en cours...', 'info');
      const result = await api.banking.sync(connectionId);
      showToast(`✅ ${result.imported} nouvelles transactions importées`, 'success');
      await reloadAll();
      if (result.imported > 0) unlockAchievement('first_import');
    } catch (err) {
      showToast('Erreur sync : ' + err.message, 'error');
    }
  };

  const syncAllBankAccounts = async () => {
    if (!bankConnections || bankConnections.length === 0) {
      showToast('Aucune banque connectée — ajoutez un compte via Réglages.', 'info');
      return;
    }
    showToast('Synchronisation en cours…', 'info');
    let totalImported = 0;
    let errors = 0;
    for (const conn of bankConnections) {
      try {
        const result = await api.banking.sync(conn.id);
        totalImported += result.imported || 0;
      } catch {
        errors++;
      }
    }
    await reloadAll();
    if (errors > 0 && totalImported === 0) {
      showToast(`Échec de la synchronisation (${errors} erreur${errors > 1 ? 's' : ''})`, 'error');
    } else if (errors > 0) {
      showToast(`${totalImported} transactions importées · ${errors} compte${errors > 1 ? 's' : ''} en erreur`, 'info');
    } else {
      showToast(
        totalImported > 0
          ? `${totalImported} nouvelle${totalImported > 1 ? 's' : ''} transaction${totalImported > 1 ? 's' : ''} importée${totalImported > 1 ? 's' : ''}`
          : 'Comptes synchronisés — déjà à jour',
        'success'
      );
    }
    if (totalImported > 0) unlockAchievement('first_import');
  };

  const deleteBankConnection = async (connectionId) => {
    if (!confirm('Déconnecter cette banque ?')) return;
    try {
      await api.banking.deleteConnection(connectionId);
      setBankConnections(prev => prev.filter(c => c.id !== connectionId));
      showToast('Connexion bancaire supprimée', 'info');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  const saveAsset = async (asset) => {
    try {
      const apiPayload = assetToApi(asset);
      let saved;
      if (asset.id) saved = await api.assets.update(asset.id, apiPayload);
      else saved = await api.assets.create(apiPayload);
      const mapped = assetFromApi(saved);
      setAssets(prev => asset.id ? prev.map(a => a.id === asset.id ? mapped : a) : [...prev, mapped]);
      showToast('💎 Actif enregistré', 'success');
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteAsset = async (assetId) => {
    if (!confirm('Supprimer cet actif ?')) return;
    try {
      await api.assets.delete(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const saveLiability = async (lia) => {
    try {
      const apiPayload = liaToApi(lia);
      let saved;
      if (lia.id) saved = await api.liabilities.update(lia.id, apiPayload);
      else saved = await api.liabilities.create(apiPayload);
      const mapped = liaFromApi(saved);
      setLiabilities(prev => lia.id ? prev.map(l => l.id === lia.id ? mapped : l) : [...prev, mapped]);
      showToast('💳 Prêt enregistré', 'success');
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteLiability = async (liaId) => {
    if (!confirm('Supprimer ce prêt ?')) return;
    try {
      await api.liabilities.delete(liaId);
      setLiabilities(prev => prev.filter(l => l.id !== liaId));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const saveMember = async (member) => {
    try {
      const payload = { name: member.name, role: member.role, color: member.color };
      let saved;
      if (member.id) saved = await api.members.update(member.id, payload);
      else saved = await api.members.create(payload);
      setMembers(prev => member.id ? prev.map(m => m.id === member.id ? saved : m) : [...prev, saved]);
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteMember = async (memberId) => {
    if (!confirm('Supprimer ce membre ? Les comptes/actifs liés ne seront pas supprimés.')) return;
    try {
      await api.members.delete(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      if (activeMemberId === memberId) setActiveMemberId('all');
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const setBudget = async (categoryId, amount) => {
    const num = parseFloat(amount) || 0;
    try {
      await api.budgets.set(categoryId, num);
      setBudgets(prev => ({ ...prev, [categoryId]: num }));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const saveGoal = async (goal) => {
    try {
      const apiPayload = goalToApi(goal);
      let saved;
      if (goal.id) saved = await api.goals.update(goal.id, apiPayload);
      else saved = await api.goals.create(apiPayload);
      const mapped = goalFromApi(saved);
      setGoals(prev => goal.id ? prev.map(g => g.id === goal.id ? mapped : g) : [...prev, mapped]);
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteGoal = async (id) => {
    if (!confirm('Supprimer cet objectif ?')) return;
    try {
      await api.goals.delete(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const saveFixedCharge = async (charge) => {
    try {
      const payload = {
        name: charge.name,
        amount: parseFloat(charge.amount) || 0,
        day_of_month: charge.day_of_month || null,
        category_slug: charge.category_slug || null,
        start_month: charge.start_month || null,
        end_month: charge.end_month || null,
        notes: charge.notes || '',
        member_ids: charge.member_ids || [],
      };
      let saved;
      if (charge.id) saved = await api.fixedCharges.update(charge.id, payload);
      else saved = await api.fixedCharges.create(payload);
      setFixedCharges(prev => charge.id ? prev.map(f => f.id === charge.id ? saved : f) : [...prev, saved]);
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const deleteFixedCharge = async (id) => {
    if (!confirm('Supprimer cette charge fixe ?')) return;
    try {
      await api.fixedCharges.delete(id);
      setFixedCharges(prev => prev.filter(f => f.id !== id));
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  };

  const exportData = () => {
    // Export current frontend state as JSON (matches v2 backup format)
    const data = {
      version: 2, app: 'Wealthly', exportedAt: new Date().toISOString(),
      members, accounts, transactions, assets, liabilities, categories, customRules, budgets, columnMappings, recurringOverrides, goals,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealthly-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('📥 Backup téléchargé', 'success');
  };

  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Importer ce backup ajoutera ses données à votre foyer actuel (les doublons sont ignorés). Continuer ?')) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.migrate.importJson(data);
      const stats = result.imported || {};
      showToast(`✅ Import : ${stats.transactions || 0} tx, ${stats.members || 0} membres, ${stats.assets || 0} actifs`, 'success');
      await reloadAll();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  };

  const resetAllData = async () => {
    if (!confirm('Effacer TOUTES les données du foyer ? Cette action est irréversible.')) return;
    if (!confirm('Vraiment sûr ? Faites un export avant !')) return;
    try {
      // Un seul appel backend qui purge tout en une transaction.
      // Beaucoup plus fiable que d'itérer entité par entité (où une
      // erreur silencieuse laissait des orphelins — comptes supprimés
      // mais positions enfants ou liabilities restantes → patrimoine
      // négatif après "reset").
      await api.wipeHousehold();
      // Purge aussi le state local et les caches localStorage
      setMembers([]);
      setAccounts([]);
      setTransactions([]);
      setAssets([]);
      setLiabilities([]);
      setGoals([]);
      setFixedCharges([]);
      setBudgets({});
      setBankConnections([]);
      setWealthHistory([]);
      setAchievements([]);
      setDcaPlans([]);
      setCustomRules([]);
      for (const k of Object.values(STORAGE_KEYS)) { try { await storage.delete(k); } catch {} }
      setOnboarded(false);
      showToast('Données effacées', 'success');
    } catch (err) {
      showToast('Erreur lors du reset : ' + err.message, 'error');
    }
  };

  const logout = async () => {
    // Fire-and-forget backend call to clear the HttpOnly cookie.
    // We don't await it — transition the UI immediately so the user
    // never sees a frozen screen. The cookie clear runs in the background.
    api.auth.logout().catch(() => {});
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  // Stable across renders so memoized children aren't invalidated when only
  // an unrelated piece of state changes. Identity flips only when the user
  // toggles "masquer montants".
  // Multi-currency: convert from the source currency (per-account/asset, default
  // EUR) to the user's chosen base before formatting. Rates come from Frankfurter
  // and are cached for 1h; when rates aren't loaded yet we no-op the conversion.
  const fmt = useCallback(
    (v, opts = {}) => {
      if (hideAmounts) return '···';
      const from = opts.from || opts.currency || 'EUR';
      const converted = convertCurrency(v, from, baseCurrency, rates);
      // Always display in the user's base currency, with the locale matching it.
      return formatCurrency(converted, { ...opts, currency: baseCurrency });
    },
    [hideAmounts, baseCurrency, rates]
  );

  if (loading) return <div className="loading-screen"><Styles theme={theme}/><div className="spinner"/><span>Chargement…</span></div>;

  if (!onboarded) {
    return (
      <>
        <Styles theme={theme}/>
        <Onboarding onComplete={completeOnboarding}/>
      </>
    );
  }

  const activeMember = members.find(m => m.id === activeMemberId);

  return (
    <CurrencyContext.Provider value={{ baseCurrency, rates }}>
    <HideAmountsContext.Provider value={hideAmounts}>
    <div className={`app theme-${theme}`}>
      <Styles theme={theme}/>
      {toast && <Toast message={toast.message} type={toast.type}/>}

      {demoMode && (
        <div className="demo-banner">
          <span className="demo-banner-pill">DÉMO</span>
          <span className="demo-banner-text">
            <span className="demo-banner-text-long">Données fictives — les modifications ne sont pas enregistrées.</span>
            <span className="demo-banner-text-short">Mode démo</span>
          </span>
          <button className="demo-banner-action" onClick={onExitDemo}>
            Quitter
          </button>
        </div>
      )}

      <div className="app-shell">
        {/* Desktop sidebar (â‰¥1024px) — Wealthly v3 handoff spec */}
        <aside className="ws-sidebar">
          <div className="ws-brand" onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>
            <Logo size={24} wordmark wordmarkSize={15} />
          </div>

          <nav className="ws-nav">
            <div className="ws-nav-group">{t('nav.group_pilotage')}</div>
            <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'on' : ''}>
              <Activity size={16}/> <span>{t('nav.dashboard')}</span>
            </button>
            <button onClick={() => setView('wealth')} className={view === 'wealth' ? 'on' : ''}>
              <Landmark size={16}/> <span>{t('nav.wealth')}</span>
            </button>
            <button onClick={() => setView('transactions')} className={view === 'transactions' ? 'on' : ''}>
              <BarChart3 size={16}/> <span>{t('nav.transactions')}</span>
            </button>
            <button onClick={() => setView('analysis')} className={view === 'analysis' ? 'on' : ''}>
              <TrendingUp size={16}/> <span>{t('nav.analysis')}</span>
            </button>

            <div className="ws-nav-group">{t('nav.group_gestion')}</div>
            <button onClick={() => setView('monthly')} className={view === 'monthly' ? 'on' : ''}>
              <Calendar size={16}/> <span>{t('nav.monthly')}</span>
              {budgetsOverCount > 0 && <span className="ws-badge">{budgetsOverCount}</span>}
            </button>
            <button onClick={() => setView('budgets')} className={view === 'budgets' ? 'on' : ''}>
              <Target size={16}/> <span>{t('nav.goals')}</span>
            </button>
            <button onClick={() => setView('tax')} className={view === 'tax' ? 'on' : ''}>
              <Calculator size={16}/> <span>{t('nav.tax')}</span>
            </button>
            <button onClick={() => setView('dca')} className={view === 'dca' ? 'on' : ''}>
              <TrendingUp size={16}/> <span>{t('nav.dca')}</span>
            </button>

            <div className="ws-nav-group">{t('nav.group_accounts')}</div>
            {(accounts || []).slice(0, 4).map(a => (
              <button key={a.id} onClick={() => setDrawerAccount(a)} className="ws-account-item">
                <span className="ws-bank-dot" style={{ background: bankColor(a.bank) }}>
                  {(a.bank || a.name || '?')[0].toUpperCase()}
                </span>
                <span>{a.bank || a.name}</span>
              </button>
            ))}
            <div className="ws-nav-group">{t('nav.group_config')}</div>
            <button onClick={() => setView('settings')} className={view === 'settings' ? 'on' : ''}>
              <Settings size={16}/> <span>{t('nav.settings')}</span>
            </button>
            {currentUser?.is_admin && (
              <button onClick={() => setView('admin')} className={view === 'admin' ? 'on' : ''}>
                <Lock size={16}/> <span>Admin</span>
              </button>
            )}
          </nav>

          <div className="ws-foot">
            <div className="ws-foot-actions">
              <ThemeToggle/>
              <LangButton/>
              <CurrencyButton baseCurrency={baseCurrency} setBaseCurrency={setBaseCurrency}/>
              <button className="ds-icon-btn" onClick={() => setHideAmounts(!hideAmounts)}
                      title={hideAmounts ? 'Afficher les montants' : 'Masquer les montants'}>
                {hideAmounts ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {currentUser && (
              <button className="ws-user" onClick={() => setSidebarMenuOpen(o => !o)} title={currentUser.email}>
                <div className="ws-user-avatar">
                  {(currentUser.full_name || currentUser.email || '?')[0].toUpperCase()}
                </div>
                <div className="ws-user-info">
                  <div className="ws-user-name">{currentUser.full_name || currentUser.email.split('@')[0]}</div>
                  <div className="ws-user-meta">
                    {currentUser.plan || 'Gratuit'} · <span style={{ color: 'var(--positive)' }}>DSP2 ✓</span>
                  </div>
                </div>
                <ChevronUp size={13} style={{ color: 'var(--ink-3)' }}/>
              </button>
            )}
            {sidebarMenuOpen && (
              <div className="ws-popover">
                <button onClick={() => { logout(); setSidebarMenuOpen(false); }} className="ws-popover-danger">
                  <LogOut size={14}/>
                  <span>Déconnexion</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="app-main">
          {/* Mobile-only top bar (<1024px) */}
          <header className="app-header-mobile">
            <button className="icon-btn hamburger-btn" onClick={() => setNavOpen(true)} title="Menu">
              <Menu size={20}/>
            </button>
            <div className="brand" onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>
              <Logo size={22} wordmark wordmarkSize={14} />
            </div>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setHideAmounts(!hideAmounts)} title="Masquer/afficher">
                {hideAmounts ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
              <button className="primary-btn" onClick={() => { setView('import'); setImportStep('upload'); }}>
                <Upload size={14}/> <span>{t('nav.import')}</span>
              </button>
            </div>
          </header>

          {members.length > 1 && (
            <div className="member-bar">
              <div className="member-tabs">
                <button className={`member-tab ${activeMemberId === 'all' ? 'active' : ''}`} onClick={() => setActiveMemberId('all')}>
                  <Users size={13}/> <span>Famille</span>
                </button>
                {members.map(m => (
                  <button key={m.id} className={`member-tab ${activeMemberId === m.id ? 'active' : ''}`} onClick={() => setActiveMemberId(m.id)}>
                    <span className="member-avatar" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                    <span>{m.name}</span>
                    {m.role === 'child' && <span className="role-badge">enfant</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {duplicatePairs.length > 0 && !showDuplicates && !duplicatesDismissed && (
            <div className="duplicates-banner">
              <span>
                <strong>{duplicatePairs.length}</strong> doublon{duplicatePairs.length > 1 ? 's' : ''} détecté{duplicatePairs.length > 1 ? 's' : ''} dans votre patrimoine.
              </span>
              <div>
                <button className="primary-btn" onClick={() => setShowDuplicates(true)}>Examiner</button>
                <button className="link-btn" onClick={() => setDuplicatesDismissed(true)}>Ignorer</button>
              </div>
            </div>
          )}

          <main className="content">
        {view === 'dashboard' && (
          <Dashboard
            netWorth={netWorth} liquidWealth={liquidWealth} assetsValue={assetsValue} liabilitiesValue={liabilitiesValue}
            thisMonthStats={thisMonthStats} monthlyEvolution={monthlyEvolution}
            visibleAccounts={visibleAccounts} accountBalances={accountBalances}
            visibleAssets={visibleAssets} visibleLiabilities={visibleLiabilities}
            members={members} activeMemberId={activeMemberId}
            transactions={visibleTransactions} categories={categories} fmt={fmt}
            memberShare={memberShare} categoryAnalysis={categoryAnalysis}
            anomalies={anomalies} cashflowProjection={cashflowProjection}
            goals={goals} budgets={budgets} wealthHistory={wealthHistory}
            recurringGroups={recurringGroups} currentMonth={currentMonth}
            transferIds={transferIds} transferPairs={transferPairs}
            setView={setView}
            onAccountClick={(a) => setDrawerAccount(a)}
            onAddAccount={() => setShowAddAccount(true)}
            onSyncAll={syncAllBankAccounts}
            hasConnections={bankConnections.length > 0}
            baseCurrency={baseCurrency} rates={rates}
            currentUser={currentUser}
          />
        )}
        {['monthly','cashflow','budgets'].includes(view) && (
          <div className="monthly-hub">
            {view === 'monthly' && (
              <Monthly
                transactions={visibleTransactions} accounts={accounts} categories={categories} members={members}
                recurringIds={recurringIds} recurringGroups={recurringGroups}
                monthlyEvolution={monthlyEvolution} thisMonthStats={thisMonthStats}
                anomalies={anomalies}
                categoryAnalysis={categoryAnalysis}
                fixedCharges={fixedCharges} saveFixedCharge={saveFixedCharge} deleteFixedCharge={deleteFixedCharge}
                budgets={budgets} setBudget={setBudget}
                transferIds={transferIds}
                memberShare={memberShare}
                currentMonth={currentMonth} fmt={fmt}
              />
            )}
            {view === 'cashflow' && (
              <Cashflow
                transactions={visibleTransactions} categories={categories} accounts={accounts}
                memberShare={memberShare} fmt={fmt} currentMonth={currentMonth}
              />
            )}
            {view === 'budgets' && (
              <Budgets
                categories={categories} budgets={budgets} setBudget={setBudget}
                categoryAnalysis={categoryAnalysis} fiftyThirtyTwenty={fiftyThirtyTwenty}
                thisMonthStats={thisMonthStats} cashflowProjection={cashflowProjection}
                goals={goals} saveGoal={saveGoal} deleteGoal={deleteGoal}
                fmt={fmt}
              />
            )}
          </div>
        )}
        {view === 'tax' && (
          <Suspense fallback={<div className="chart-empty"><Calculator size={28}/><span>Chargement du simulateur…</span></div>}>
            <TaxSimulator transactions={visibleTransactions} />
          </Suspense>
        )}
        {view === 'dca' && (
          <DCAView
            accounts={accounts} members={members}
            dcaPlans={dcaPlans} onPlansChange={setDcaPlans}
          />
        )}
        {view === 'wealth' && (
          <Wealth
            assets={assets} liabilities={liabilities} members={members} activeMemberId={activeMemberId}
            visibleAssets={visibleAssets} visibleLiabilities={visibleLiabilities}
            accounts={accounts} accountBalances={accountBalances}
            transactions={visibleTransactions}
            saveAsset={saveAsset} deleteAsset={deleteAsset}
            saveLiability={saveLiability} deleteLiability={deleteLiability}
            memberShare={memberShare} fmt={fmt}
            wealthHistory={wealthHistory}
            onOpenAddWizard={() => setShowAddAccount(true)}
            reload={reloadAll}
          />
        )}
        {view === 'transactions' && (
          <Transactions
            transactions={visibleTransactions} accounts={accounts} categories={categories}
            members={members}
            recurringIds={recurringIds} toggleRecurring={toggleRecurring}
            transferIds={transferIds} setTransferOverride={setTransferOverride}
            updateCategory={updateTransactionCategory} deleteTransaction={deleteTransaction} fmt={fmt}
            initialAccountFilter={txInitialAccountFilter}
            onConsumeInitialFilter={() => setTxInitialAccountFilter(null)}
          />
        )}
        {view === 'analysis' && (
          <Analysis
            transactions={visibleTransactions} categories={categories}
            recurringIds={recurringIds} recurringGroups={recurringGroups} monthlyEvolution={monthlyEvolution}
            accounts={accounts} memberShare={memberShare} fmt={fmt}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            members={members} accounts={accounts} accountBalances={accountBalances}
            saveMember={saveMember} deleteMember={deleteMember}
            deleteAccount={deleteAccount}
            updateAccount={updateAccount}
            transactions={visibleTransactions}
            exportData={exportData} importData={importData} resetAllData={resetAllData}
            bankConnections={bankConnections}
            syncBankConnection={syncBankConnection}
            deleteBankConnection={deleteBankConnection}
            categories={categories}
            fmt={fmt}
            baseCurrency={baseCurrency} setBaseCurrency={setBaseCurrency}
            rates={rates} ratesDate={ratesDate}
            currentUser={currentUser}
            onImport={() => { setView('import'); setImportStep('upload'); }}
          />
        )}
        {view === 'admin' && currentUser?.is_admin && (
          <Admin />
        )}
        {view === 'import' && (
          <ImportFlow
            step={importStep} parsedData={parsedData} mapping={currentMapping} setMapping={setCurrentMapping}
            account={importAccount} setAccount={setImportAccount} preview={importPreview}
            categories={categories} members={members} existingAccounts={accounts}
            knownMappings={columnMappings} detectedBank={detectedBank}
            handleFileUpload={handleFileUpload} proceedToAccountStep={proceedToAccountStep}
            proceedToPreview={proceedToPreview} confirmImport={confirmImport} cancelImport={cancelImport}
            setStep={setImportStep} fmt={fmt}
          />
        )}
          </main>
        </div>
      </div>

      {/* Mobile nav drawer — slide in from left */}
      {navOpen && (
        <div className="nav-drawer-overlay" onClick={() => setNavOpen(false)}>
          <aside className="nav-drawer" onClick={e => e.stopPropagation()}>
            <div className="nav-drawer-header">
              <div className="sidebar-brand" style={{padding:'0 0 0 4px', cursor:'default'}}>
                <Logo size={22} wordmark wordmarkSize={14} />
              </div>
              <button className="icon-btn" onClick={() => setNavOpen(false)}><X size={18}/></button>
            </div>
            <nav className="sidebar-nav" style={{flex:1}}>
              {[
                { v: 'dashboard', icon: <Activity size={16}/>, label: t('nav.dashboard') },
                { v: 'wealth',    icon: <Landmark size={16}/>,  label: t('nav.wealth') },
                { v: 'monthly',   icon: <Calendar size={16}/>,  label: t('nav.monthly'), badge: budgetsOverCount },
                { v: 'transactions', icon: <BarChart3 size={16}/>, label: t('nav.transactions') },
                { v: 'tax',       icon: <Calculator size={16}/>, label: t('nav.tax') },
                { v: 'settings',  icon: <Settings size={16}/>,  label: t('nav.settings') },
              ].map(({ v, icon, label, badge }) => (
                <button key={v}
                  className={view === v || (v === 'monthly' && ['monthly','cashflow','budgets'].includes(view)) ? 'active' : ''}
                  onClick={() => { setView(v); setNavOpen(false); }}>
                  {icon} <span>{label}</span>
                  {badge > 0 && <span className="nav-alert-dot">{badge}</span>}
                </button>
              ))}
            </nav>
            <div className="nav-drawer-footer">
              {currentUser && (
                <div className="sidebar-user">
                  <div className="sidebar-user-avatar">{(currentUser.full_name || currentUser.email || '?')[0].toUpperCase()}</div>
                  <div className="sidebar-user-info">
                    <div className="sidebar-user-name">{currentUser.full_name || currentUser.email}</div>
                    <div className="sidebar-user-email">{currentUser.email}</div>
                  </div>
                </div>
              )}
              <div style={{display:'flex', gap:6, marginTop:8}}>
                <LangButton />
                <button className="icon-btn" onClick={() => { setHideAmounts(!hideAmounts); }} title="Masquer/afficher">{hideAmounts ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                <button className="icon-btn" onClick={logout} title="Déconnexion"><LogOut size={16}/></button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile bottom nav (<768px) — fixed bottom bar */}
      <nav className="bottom-nav">
        <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''}><Activity size={18}/> <span>{t('nav.dashboard')}</span></button>
        <button onClick={() => setView('wealth')} className={view === 'wealth' ? 'active' : ''}><Landmark size={18}/> <span>{t('nav.wealth')}</span></button>
        <button onClick={() => setView('monthly')} className={['monthly','cashflow','budgets'].includes(view) ? 'active' : ''}>
          <Calendar size={18}/> <span>{t('nav.monthlyShort')}</span>
          {budgetsOverCount > 0 && <span className="nav-alert-dot">{budgetsOverCount}</span>}
        </button>
        <button onClick={() => setView('transactions')} className={view === 'transactions' ? 'active' : ''}><BarChart3 size={18}/> <span>{t('nav.transactionsShort')}</span></button>
        <button onClick={() => setView('tax')} className={view === 'tax' ? 'active' : ''}><Calculator size={18}/> <span>{t('nav.tax')}</span></button>
        <button onClick={() => setView('settings')} className={view === 'settings' ? 'active' : ''}><Settings size={18}/> <span>{t('nav.settings')}</span></button>
      </nav>

      {drawerAccount && (
        <AccountDrawer
          account={drawerAccount}
          transactions={transactions}
          members={members}
          accountBalance={accountBalances[drawerAccount.id] || 0}
          fmt={fmt}
          onClose={() => setDrawerAccount(null)}
          onSeeAll={(accountId) => {
            setDrawerAccount(null);
            setTxInitialAccountFilter(accountId);
            setView('transactions');
          }}
        />
      )}

      {showDuplicates && (
        <DuplicateMergeModal
          pairs={duplicatePairs}
          fmt={fmt}
          onMerge={async (pair, keep) => {
            const toDelete = keep === 'keep-account' ? pair.assetItem : pair.accountItem;
            try {
              await api.wealth.delete(toDelete);
              await reloadAll();
            } catch (err) {
              console.error('Failed to merge duplicate:', err);
            }
          }}
          onSkip={(_pair) => { /* placeholder — could persist a "skip" marker later */ }}
          onClose={() => { setShowDuplicates(false); setDuplicatesDismissed(true); }}
        />
      )}

      {showAddAccount && (
        <AddWealthModal
          members={members}
          assets={assets}
          onSave={async (payload) => {
            // En démo, l'API throw "Mode démo : modifications non enregistrées".
            // En prod, on récupère { target, data } pour pousser le nouvel
            // élément directement dans le state — pas besoin d'attendre que
            // reloadAll() propage (sinon l'utilisateur a l'impression que
            // rien ne s'est passé jusqu'à un refresh).
            try {
              const result = await api.wealth.create(payload);
              if (result && result.data) {
                if (result.target === 'asset') {
                  setAssets(prev => [...prev, assetFromApi(result.data)]);
                } else if (result.target === 'account') {
                  setAccounts(prev => [...prev, accountFromApi(result.data)]);
                } else if (result.target === 'liability') {
                  setLiabilities(prev => [...prev, liaFromApi(result.data)]);
                }
              }
              // Reload en arrière-plan pour récupérer d'éventuels effets de
              // bord côté backend (catégories par défaut, transactions, etc.).
              reloadAll().catch(() => {});
              showToast('Élément ajouté à ton patrimoine', 'success');
              setShowAddAccount(false);
            } catch (err) {
              const msg = err?.message || 'Création impossible.';
              showToast(msg, 'error');
              throw err;
            }
          }}
          onConnectBank={() => {
            setShowAddAccount(false);
            setShowBankConnect(true);
          }}
          onClose={() => setShowAddAccount(false)}
        />
      )}

      {showBankConnect && (
        <AddAccountModal
          members={members}
          onSave={createAccount}
          onClose={() => setShowBankConnect(false)}
          initialStep="bank-list"
        />
      )}
    </div>
    </HideAmountsContext.Provider>
    </CurrencyContext.Provider>
  );
}

// ============================================================================
// AddAccountModal — Finary-style multi-step: choice → bank flow OR manual form
// ============================================================================
const ACCOUNT_TYPES = [
  { value: 'checking',     label: 'Compte courant',   role: 'principal',      hint: 'Revenus et dépenses du quotidien comptabilisés dans le cashflow.' },
  { value: 'savings',      label: 'Livret / Épargne', role: 'epargne',        hint: 'Hors cashflow mensuel — solde inclus dans le patrimoine.' },
  { value: 'investment',   label: 'PEA / CTO / AV',  role: 'investissement', hint: 'Hors cashflow mensuel — valorisation incluse dans le patrimoine.' },
  { value: 'joint',        label: 'Compte joint',     role: 'principal',      hint: 'Revenus et dépenses partagés comptabilisés dans le cashflow.' },
  { value: 'professional', label: 'Professionnel',    role: 'professionnel',  hint: 'Entièrement exclu du patrimoine personnel et du cashflow.' },
];

const BANK_COUNTRIES = [
  { code: 'FR', name: '🇫🇷 France' },
  { code: 'DE', name: '🇩🇪 Allemagne' },
  { code: 'ES', name: '🇪🇸 Espagne' },
  { code: 'IT', name: '🇮🇹 Italie' },
  { code: 'BE', name: '🇧🇪 Belgique' },
  { code: 'NL', name: '🇳🇱 Pays-Bas' },
  { code: 'PT', name: '🇵🇹 Portugal' },
  { code: 'GB', name: '🇬🇧 Royaume-Uni' },
];

function AddAccountModal({ members = [], onSave, onClose, initialStep = 'choice' }) {
  // steps: 'choice' | 'bank-list' | 'manual'
  const [step, setStep] = useState(initialStep);

  // --- bank flow state ---
  const [country, setCountry] = useState('FR');
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [bankError, setBankError] = useState(null);
  const [search, setSearch] = useState('');

  // --- manual form state ---
  const [form, setForm] = useState({
    name: '', bank: '', type: 'checking', initialBalance: '', memberIds: [], currency: 'EUR',
  });
  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleMember = (id) =>
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter(x => x !== id) : [...f.memberIds, id],
    }));

  // Bank flow
  const loadBanks = async () => {
    setLoadingBanks(true);
    setBankError(null);
    try {
      const data = await api.banking.listBanks(country);
      const list = data?.banks || data || [];
      setBanks(Array.isArray(list) ? list : []);
      setStep('bank-list');
    } catch (err) {
      setBankError(err.message);
    } finally {
      setLoadingBanks(false);
    }
  };

  const connectBank = async (bankName) => {
    setConnecting(true);
    setBankError(null);
    try {
      const result = await api.banking.connect(bankName, country);
      if (result?.redirect_url) {
        window.location.href = result.redirect_url;
      } else {
        setBankError("Pas d'URL de redirection reçue");
        setConnecting(false);
      }
    } catch (err) {
      setBankError(err.message);
      setConnecting(false);
    }
  };

  const filteredBanks = banks.filter(b =>
    (b.name || b.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Manual form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const typeToRole = {
      checking: 'principal', savings: 'epargne', investment: 'investissement',
      joint: 'principal', professional: 'professionnel',
    };
    const role = typeToRole[form.type] || 'principal';
    await onSave({ ...form, role, initialBalance: parseFloat(form.initialBalance) || 0 });
    setSaving(false);
  };

  const titles = {
    'choice': 'Ajouter un compte',
    'bank-list': 'Connecter ma banque',
    'manual': 'Compte manuel',
  };

  const backStep = {
    'bank-list': 'choice',
    'manual': 'choice',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {backStep[step] && (
            <button className="icon-btn" onClick={() => setStep(backStep[step])} style={{ marginRight: 6 }}>
              <ChevronLeft size={18}/>
            </button>
          )}
          <h2 style={{ flex: 1 }}>{titles[step]}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {/* ── STEP 1: CHOICE ── */}
        {step === 'choice' && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
              Comment souhaitez-vous ajouter ce compte ?
            </p>

            {/* Bank connect card */}
            <button
              onClick={() => { setBankError(null); loadBanks(); }}
              disabled={loadingBanks}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                background: 'var(--bg-elevated, var(--bg-card))',
                border: '1px solid var(--border)',
                borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'border-color .15s, background .15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'var(--primary-soft, rgba(197,165,114,.12))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
              }}>
                <Cloud size={22}/>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {loadingBanks ? 'Chargement des banques…' : 'Connecter ma banque'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Synchronisation automatique via GoCardless (PSD2). Vos identifiants restent sur le site de votre banque.
                </div>
              </div>
              {loadingBanks
                ? <RefreshCw size={16} className="spin" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}/>
                : <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}/>
              }
            </button>

            {bankError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(196,113,88,.08)', borderRadius: 8 }}>
                {bankError}
              </div>
            )}

            {/* Manual card */}
            <button
              onClick={() => setStep('manual')}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                background: 'var(--bg-elevated, var(--bg-card))',
                border: '1px solid var(--border)',
                borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'border-color .15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'rgba(139,138,133,.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}>
                <Edit3 size={22}/>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>
                  Ajouter manuellement
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Saisissez le solde et les transactions à la main. Idéal pour les livrets, espèces ou comptes étrangers.
                </div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}/>
            </button>

            <div style={{ marginTop: 4 }}>
              <button className="secondary-btn" style={{ width: '100%' }} onClick={onClose}>Annuler</button>
            </div>
          </div>
        )}

        {/* ── STEP 2a: BANK LIST ── */}
        {step === 'bank-list' && (
          <div className="modal-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <input
                className="search-input"
                placeholder="Chercher votre banque…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1 }}
                autoFocus
              />
              <select
                value={country}
                onChange={e => { setCountry(e.target.value); setBanks([]); setSearch(''); }}
                style={{
                  background: 'var(--bg-input, var(--bg-card))', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {BANK_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>

            {banks.length === 0 && !loadingBanks && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
                Sélectionnez un pays et cliquez sur "Charger les banques"
              </div>
            )}

            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredBanks.map((bank, idx) => {
                const bankLabel = bank.name || bank.full_name || `Banque ${idx + 1}`;
                // GoCardless wants the institution_id (e.g. "BOURSORAMA_BOURFRPP"),
                // not the display name. Fallback to label only as a last resort.
                const bankId = bank.id || bank.institution_id || bankLabel;
                return (
                  <button
                    key={bankId || idx}
                    className="bank-option-btn"
                    onClick={() => connectBank(bankId)}
                    disabled={connecting}
                  >
                    <span className="bank-option-name">{bankLabel}</span>
                    {connecting
                      ? <RefreshCw size={13} className="spin" style={{ color: 'var(--text-tertiary)' }}/>
                      : <ChevronRight size={14}/>
                    }
                  </button>
                );
              })}
            </div>

            {bankError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', marginTop: 8, background: 'rgba(196,113,88,.08)', borderRadius: 8 }}>
                {bankError}
              </div>
            )}

            {country && banks.length === 0 && (
              <button className="primary-btn" style={{ width: '100%', marginTop: 12 }} onClick={loadBanks} disabled={loadingBanks}>
                {loadingBanks ? <><RefreshCw size={13} className="spin"/> Chargement…</> : 'Charger les banques'}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 2b: MANUAL FORM ── */}
        {step === 'manual' && (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Nom du compte *</label>
                <input className="form-input" placeholder="ex: Compte courant BNP" value={form.name}
                  onChange={e => setField('name', e.target.value)} autoFocus required/>
              </div>
              <div>
                <label className="form-label">Banque</label>
                <input className="form-input" placeholder="ex: BNP Paribas" value={form.bank}
                  onChange={e => setField('bank', e.target.value)}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type} onChange={e => setField('type', e.target.value)}>
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {(() => {
                    const t = ACCOUNT_TYPES.find(t => t.value === form.type);
                    if (!t) return null;
                    return (
                      <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{ACCOUNT_ROLES[t.role]?.label}</span>
                        {' '}— {t.hint}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <label className="form-label">Devise</label>
                  <select className="form-input" value={form.currency} onChange={e => setField('currency', e.target.value)}>
                    <option value="EUR">🇪🇺 EUR — Euro</option>
                    <option value="USD">🇺🇸 USD — Dollar US</option>
                    <option value="GBP">🇬🇧 GBP — Livre sterling</option>
                    <option value="CHF">🇨🇭 CHF — Franc suisse</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Solde initial ({form.currency})</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00"
                  value={form.initialBalance} onChange={e => setField('initialBalance', e.target.value)}/>
              </div>
              {members.length > 0 && (
                <div>
                  <label className="form-label">Titulaire(s)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {members.map(m => (
                      <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                          border: `1px solid ${form.memberIds.includes(m.id) ? 'var(--primary)' : 'var(--border)'}`,
                          background: form.memberIds.includes(m.id) ? 'var(--primary-soft)' : 'var(--bg-card)',
                          color: form.memberIds.includes(m.id) ? 'var(--primary-text)' : 'var(--text-primary)',
                          fontFamily: 'inherit',
                        }}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-btn" onClick={onClose}>Annuler</button>
              <button type="submit" className="primary-btn" disabled={saving || !form.name.trim()}>
                {saving ? 'Enregistrement…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
