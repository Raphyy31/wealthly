import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar, ComposedChart, Sankey, Layer, Rectangle } from 'recharts';
import { Upload, Plus, TrendingUp, TrendingDown, Wallet, Home, Coins, CreditCard, Users, Settings, Download, Trash2, Edit3, Check, X, ChevronRight, ChevronLeft, ChevronDown, AlertCircle, AlertTriangle, Repeat, Calendar, ArrowUpDown, Eye, EyeOff, Sparkles, PiggyBank, Bitcoin, Banknote, Landmark, BarChart3, Target, Heart, Sun, Moon, Zap, Activity, ArrowUp, ArrowDown, Minus, PartyPopper, Lightbulb, Bell, ChevronUp, Play, Lock, Unlock, LogOut, Cloud, RefreshCw, FileText, FileUp, Calculator, Link2, Unlink, Menu, Search } from 'lucide-react';
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
  categorize, detectRecurring, extractMerchantFromLabel,
  accountIncludeInNetWorth, accountCountsAsIncome, accountCountsAsExpense,
  detectInternalTransfers, convertCurrency, ACCOUNT_ROLES, bankColor,
  fmtAmount,
} from './utils.js';
import { useRates } from './hooks/useRates.js';
import { useBaseCurrency } from './hooks/useBaseCurrency.js';
import { useQuotes } from './hooks/useQuotes.js';
import { Combobox } from './components/Combobox.jsx';
import { Mandatory2FAOverlay } from './components/Mandatory2FAOverlay.jsx';
import { Skeleton } from './components/Skeleton.jsx';
import { Styles } from './Styles.jsx';
import { Toast } from './components/Toast.jsx';
import { AnimatedNumber } from './components/AnimatedNumber.jsx';
import { SyncProgressBar } from './components/SyncProgressBar.jsx';
import { Onboarding } from './views/Onboarding.jsx';
import { Transactions } from './views/Transactions.jsx';
import { Analysis } from './views/Analysis.jsx';
import { Monthly } from './views/Monthly.jsx';
import { SankeyMorphDemo } from './views/SankeyMorphDemo.jsx';
import { Cashflow } from './views/Cashflow.jsx';
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
import { CreateRuleModal } from './components/CreateRuleModal.jsx';
import { AiPromptModal } from './components/AiPromptModal.jsx';
import { detectDuplicates } from './utils/duplicateDetector.js';
import { DuplicateMergeModal } from './components/DuplicateMergeModal.jsx';
import { gsap } from './utils/gsapSetup.js';
import { useWealthItems } from './hooks/useWealthItems.js';

const TaxSimulator = lazy(() => import('./TaxSimulator.jsx'));

// Disable Recharts animations globally — they cause noticeable jank on iOS Safari
// (SVG <animate> on every render) and add no UX value for static financial data.
[Line, Bar, Area, Pie, RadialBar, Sankey].forEach((C) => {
  if (C) C.defaultProps = { ...(C.defaultProps || {}), isAnimationActive: false };
});

// bankColor is now in utils.js (shared with Settings → Comptes avatars).

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
  //
  // Edge case 2026-05-19 : Settings utilise son propre format `#settings/<section>`
  // (sans `/` après `#`). Sans normalisation, parseHash retournait "settings/securite"
  // qui ne matchait aucune vue → fallback Dashboard sur refresh. On strip tout ce
  // qui suit le premier `/` pour récupérer juste "settings".
  const parseHash = () => {
    if (typeof window === 'undefined') return { view: 'dashboard', memberId: 'all' };
    const raw = (window.location.hash || '').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const params = new URLSearchParams(query || '');
    // Normalise les sous-chemins (ex: "settings/securite" → "settings")
    const view = (path || 'dashboard').split('/')[0] || 'dashboard';
    return { view, memberId: params.get('m') || 'all' };
  };
  const initialHash = parseHash();
  const [view, setView] = useState(initialHash.view);
  // Page transitions GSAP : a chaque changement de view, le contenu fade-in
  // depuis y+12 / opacity 0. Respect prefers-reduced-motion (skip si actif).
  const contentRef = useRef(null);
  useEffect(() => {
    if (!contentRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(contentRef.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out' }
    );
  }, [view]);
  // Sidebar nav magic line : un trait cobalt unique glisse vers l'item actif
  // au lieu d'apparaitre brusquement. Mesure top/height du bouton .on et
  // anime l'indicator. Premier rendu = snap (sans anim), changements = slide.
  const navRef = useRef(null);
  const navIndicatorRef = useRef(null);
  const navIndicatorMountedRef = useRef(false);
  useEffect(() => {
    const nav = navRef.current;
    const indicator = navIndicatorRef.current;
    if (!nav || !indicator) return;
    const activeBtn = nav.querySelector('button.on');
    if (!activeBtn) {
      gsap.to(indicator, { opacity: 0, duration: 0.18, ease: 'power2.out' });
      return;
    }
    const top = activeBtn.offsetTop + (activeBtn.offsetHeight - 18) / 2;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!navIndicatorMountedRef.current || reduced) {
      gsap.set(indicator, { y: top, opacity: 1 });
      navIndicatorMountedRef.current = true;
    } else {
      gsap.to(indicator, {
        y: top,
        opacity: 1,
        duration: 0.42,
        ease: 'expo.out',
      });
    }
  }, [view, loading]);
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
  // Mois type est scoped par (foyer, membre). Map { scopeKey: refMonth }.
  // scopeKey = activeMemberId si adulte, sinon 'household' (Famille / compte joint).
  const [refMonthsByScope, setRefMonthsByScope] = useState({});
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('w2:current_user') || 'null'); } catch { return null; }
  });
  const [hideAmounts, setHideAmounts] = useState(false);
  useEffect(() => {
    if (hideAmounts) document.documentElement.setAttribute('data-hide-amounts', '1');
    else document.documentElement.removeAttribute('data-hide-amounts');
  }, [hideAmounts]);
  const [toast, setToast] = useState(null);
  // Sync orchestration — remplace le syncBusy string par un objet structure
  // qui pilote SyncProgressBar (top bar + pill stages). Shape :
  //   null                                = idle
  //   { stage, label, current, total, progress } = en cours
  //   stage = 'connecting' | 'balance' | 'transactions' | 'success' | 'error'
  // Helper utilitaires juste apres.
  const [syncStatus, setSyncStatus] = useState(null);
  const setSyncStage = useCallback((stage, label, opts = {}) => {
    setSyncStatus({
      stage,
      label,
      current: opts.current || 1,
      total: opts.total || 1,
      progress: typeof opts.progress === 'number' ? opts.progress : null,
    });
  }, []);
  // Garde une compat avec les callsites existants qui passent juste un string.
  // Resout en stage 'connecting' (= spinner) pour ne casser ni les anciens
  // appels ni l'API setSyncBusy ailleurs dans le code.
  const setSyncBusy = useCallback((labelOrNull) => {
    if (labelOrNull === null || labelOrNull === undefined) {
      setSyncStatus(null);
    } else {
      setSyncStage('connecting', labelOrNull);
    }
  }, [setSyncStage]);
  // Category Learning : quand le backend crée une règle apprise après 2
  // recatégorisations manuelles du même payee, on propose à l'user d'appliquer
  // la règle aux tx historiques du marchand. null = idle, sinon les infos
  // pour rendre la bannière + appeler /apply-retroactively.
  const [learningOffer, setLearningOffer] = useState(null);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  // C4 — workspace switcher (member dropdown, kept for fallback / future)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

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
  // Etape initiale du modal compte bancaire (sidebar + button vs Dashboard
  // CTA). null = ferme, 'choice' = ouvre sur le choix banque / manuel,
  // 'bank-list' = skip directement a la liste des banques.
  const [addBankAccountStep, setAddBankAccountStep] = useState(null);
  const [showBankConnect, setShowBankConnect] = useState(false);
  // Quand le wizard "+ Ajouter" termine en mode manuel, on stocke ici
  // { category, subtype } pour que la vue Patrimoine ouvre l'éditeur
  // canonique correspondant (LiabilityEditor / RealEstateEditor / SimpleAssetEditor).
  const [seededNewItem, setSeededNewItem] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [importStep, setImportStep] = useState('upload');
  const [parsedData, setParsedData] = useState(null);
  const [detectedBank, setDetectedBank] = useState(null);
  const [currentMapping, setCurrentMapping] = useState({});
  const [importAccount, setImportAccount] = useState({ name: '', bank: '', memberIds: [], type: 'checking', initialBalance: 0 });
  const [importPreview, setImportPreview] = useState([]);
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [importing, setImporting] = useState(false);

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
    isJoint: !!a.is_joint,
    iban: a.iban || null,
    initialBalance: a.initial_balance,
    currency: a.currency || 'EUR',
    memberIds: a.member_ids || [],
    currentBalance: a.current_balance,
    // Solde officiel banque rafraichi a chaque sync GoCardless. null = compte
    // manuel/CSV (alors le frontend fallback sur initial + somme tx).
    last_known_balance: a.last_known_balance,
    last_balance_at: a.last_balance_at || null,
    // Alias camelCase pour les vues (Dashboard) qui affichent "synced il y a X".
    // Reflete la derniere fois ou le solde officiel a ete rafraichi.
    lastSyncedAt: a.last_balance_at || null,
    source: a.source || 'manual',
    externalId: a.external_id || null,
  });
  const accountToApi = (a) => ({
    name: a.name,
    bank: a.bank,
    type: a.type,
    role: a.role || 'principal',
    is_joint: !!a.isJoint,
    iban: a.iban || null,
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
    tags: t.tags || [],
    payeeId: t.payee_id || null,
    payeeName: t.payee_name || null,
    catSource: t.cat_source || null, // user_rule | payee_default | learned_rule | builtin_rule | llm | unknown
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
    tags: t.tags || [],
  });
  // Assets
  const assetFromApi = (a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    currentValue: a.current_value,
    currency: a.currency || 'EUR',
    ticker: a.ticker || '',
    isin: a.isin || '',
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
    parent: c.parent_slug || null,
  });

  // Sync view + activeMember → URL hash, so refresh / back / forward / share work.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Edge case 2026-05-19 : Settings gère son propre format de hash
    // (#settings/<section>) pour permettre le deep-link vers la section
    // sélectionnée. On ne réécrit PAS le hash dans ce cas, sinon le refresh
    // perd la section et retombe sur 'profil' par défaut.
    if (view === 'settings' && window.location.hash.startsWith('#settings/')) {
      return;
    }
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
      api.refMonth.get().then(rm => setRefMonthsByScope({ household: rm })).catch(() => {});
      return;
    }
    try {
      const [memList, accList, txList, astList, liaList, catList, budList, goalList, achList, ruleList, connList, dcaList, rmData] = await Promise.all([
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
        api.refMonth.get().catch(() => ({ version: 1, updated_at: null, lines: [] })),
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
      // rmData est le Mois type 'Famille' (member_id absent → ménage).
      // Les Mois types personnels des adultes se chargent à la demande quand
      // l'utilisateur switche sur leur onglet.
      setRefMonthsByScope({ household: rmData || { version: 1, updated_at: null, lines: [] } });
    } catch (err) {
      showToast(t('toasts.loadError', { message: err.message }), 'error');
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
  //   - Onglet Famille (activeMemberId='all') → uniquement les comptes joints
  //     (marqués `is_joint`). Si aucun compte n'est encore marqué joint, on
  //     retombe sur "tous les comptes" pour ne pas casser l'expérience
  //     avant qu'un compte n'ait été tagué.
  //   - Onglet adulte → comptes où l'adulte est listé ET qui ne sont PAS
  //     joints (= ses comptes perso). Les comptes joints restent en Famille.
  const visibleAccountIds = useMemo(() => {
    if (activeMemberId === 'all') {
      const joints = accounts.filter(a => a.isJoint);
      const pool = joints.length > 0 ? joints : accounts;
      return new Set(pool.map(a => a.id));
    }
    return new Set(
      accounts
        .filter(a => !a.isJoint && (a.memberIds || []).includes(activeMemberId))
        .map(a => a.id)
    );
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
      accounts.forEach(a => { balances[a.id] = a.currentBalance ?? (a.initialBalance || 0); });
      return balances;
    }
    // Fix 2026-05-19 (retour user "solde Revolut faux") : pour les comptes
    // synchronises via GoCardless, on utilise EN PRIORITE le `currentBalance`
    // renvoye par le backend (qui vaut last_known_balance officiel banque
    // depuis le commit 3cedc26). Avant, on recalculait initial + Σtx, ce qui
    // donnait un solde lisse sur la periode au lieu du solde courant — typique
    // sur Revolut ou les transactions pending ne remontent pas via DSP2.
    //
    // Pour les comptes manuels / CSV (last_known_balance == null), on retombe
    // sur le calcul classique car ces comptes n'ont pas de balance officiel.
    accounts.forEach(a => {
      const hasOfficial = a.last_known_balance !== null && a.last_known_balance !== undefined;
      if (hasOfficial) {
        balances[a.id] = a.currentBalance ?? a.last_known_balance ?? 0;
      } else {
        balances[a.id] = a.initialBalance || 0;
      }
    });
    // Pour les comptes SANS solde officiel, on ajoute les tx. Pour les comptes
    // AVEC solde officiel, le solde est deja correct — ne pas re-ajouter les
    // tx (sinon double comptage).
    const hasOfficial = new Set(
      accounts.filter(a => a.last_known_balance !== null && a.last_known_balance !== undefined).map(a => a.id)
    );
    transactions.forEach(t => {
      if (hasOfficial.has(t.accountId)) return;
      balances[t.accountId] = (balances[t.accountId] || 0) + t.amount;
    });
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

  // Patrimoine financier : exclut immobilier (valeur du bien) + emprunts immo
  // (mortgage). C'est le patrimoine 'liquide' que l'user peut effectivement
  // utiliser, sans l'équity bloquée dans la pierre.
  const realEstateValue = useMemo(
    () => visibleAssets.filter(a => a.type === 'real_estate').reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0),
    [visibleAssets, memberShare]
  );
  const mortgageDebt = useMemo(
    () => visibleLiabilities.filter(l => l.type === 'mortgage').reduce((s, l) => s + (parseFloat(l.remainingCapital) || 0) * memberShare(l), 0),
    [visibleLiabilities, memberShare]
  );
  const financialWealth = liquidWealth + (assetsValue - realEstateValue) - (liabilitiesValue - mortgageDebt);

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
    // Fix 2026-05-19 : avant on partait de initialBalance puis on ajoutait
    // chronologiquement -> le balance final divergeait du solde courant
    // affiche sur le Dashboard (last_known_balance officiel banque). Le
    // chart d'evolution n'aboutissait pas au vrai chiffre courant.
    //
    // Maintenant : on part du solde CURRENT (= accountBalances qui pioche
    // last_known_balance pour comptes synces, fallback initial+sumtx sinon)
    // et on remonte dans le temps en soustrayant le net mensuel. Garantit
    // que balance(mois le plus recent) === netWorth Dashboard.
    const currentTotalNW = visibleAccounts
      .filter(a => accountIncludeInNetWorth(a.role))
      .reduce((sum, a) => sum + (accountBalances[a.id] || 0) * memberShare(a), 0);
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
        // Manual category override : si l'user a explicitement catégorisé
        // une transaction en income/expense sur un compte de rôle qui exclut
        // ces flux par défaut (ex : cadeau Lydia sur un compte depenses,
        // ou retrait manuel d'un livret), on respecte la volonté de l'user.
        const isManualIncome = t.isManualCategory && cat?.type === 'income';
        const isManualExpense = t.isManualCategory && cat?.type === 'expense';
        if (t.amount > 0) {
          if (accountCountsAsIncome(role) || isManualIncome) monthly[m].income += sharedAmount;
        } else {
          if (accountCountsAsExpense(role) || isManualExpense) {
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
    // Marche a rebours depuis le mois le plus recent en partant du solde
    // courant officiel. balance(mois n) = solde a la fin du mois n.
    // balance(mois n - 1) = balance(mois n) - net(mois n).
    let cursor = currentTotalNW;
    for (let i = sortedMonths.length - 1; i >= 0; i--) {
      const m = sortedMonths[i];
      monthly[m].balance = cursor;
      cursor -= monthly[m].net;
    }
    return Object.values(monthly);
  }, [visibleTransactions, visibleAccounts, accounts, categories, recurringIds, memberShare, transferIds, accountBalances]);

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
      const cat = categories.find(c => c.id === t.categoryId);
      // Honor the account's role: epargne / investissement / professionnel
      // outflows are not real expenses — UNLESS the user explicitly tagged
      // this transaction with an expense category (manual override).
      const isManualExpense = t.isManualCategory && cat?.type === 'expense';
      if (acc && !accountCountsAsExpense(acc.role) && !isManualExpense) return;
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
      showToast(t('toasts.householdSet'), 'success');
    } catch (err) {
      showToast(t('toasts.genericError', { message: err.message }), 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);

    let parsed;
    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      // Parse Excel file with SheetJS
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Convert to array of arrays (raw), preserving header row
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (raw.length < 2) {
        showToast('Le fichier Excel semble vide ou sans données', 'error');
        return;
      }
      const headers = raw[0].map(h => String(h).trim());
      // SheetJS lit les dates en UTC (serial Excel → Date UTC minuit), donc
      // getUTCFullYear/Month/Date évite le décalage d'un jour selon le fuseau.
      const cellToString = (v) => {
        if (v === undefined || v === null) return '';
        if (v instanceof Date) {
          if (Number.isNaN(v.getTime())) return '';
          const y = v.getUTCFullYear();
          const m = String(v.getUTCMonth() + 1).padStart(2, '0');
          const d = String(v.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        return String(v);
      };
      const rows = raw.slice(1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h, cellToString(row[i])]))
      );
      parsed = { headers, rows, delimiter: 'xlsx' };
    } else {
      const text = await file.text();
      parsed = parseCSV(text);
    }

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
      showToast(t('toasts.mapColumns'), 'warning');
      return;
    }
    setImportStep('account');
  };

  const proceedToPreview = async () => {
    if (!importAccount.name) { showToast(t('toasts.nameAccount'), 'warning'); return; }
    if (!importAccount.memberIds || importAccount.memberIds.length === 0) { showToast(t('toasts.assignAccount'), 'warning'); return; }
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
      setImportPreview(txs.map(x => ({ ...x }))); // show immediately while AI runs (clone so React tracks)
      setAiCategorizing(true);
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
          showToast(t('toasts.aiCategorized', { count: aiCount }), 'success');
        }
      } catch {
        // AI unavailable — silent fallback, uncategorized stays as-is
      }
      // Replace with cloned objects so React re-renders with the new categories
      setImportPreview(txs.map(x => ({ ...x })));
      setAiCategorizing(false);
    } else {
      setImportPreview(txs);
      setImportStep('preview');
    }
  };

  const confirmImport = async () => {
    if (importing || aiCategorizing) return;
    setImporting(true);
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
      showToast(result.skipped_duplicates > 0 ? t('toasts.importedTxDup', { count: result.inserted, dup: result.skipped_duplicates }) : t('toasts.importedTx', { count: result.inserted }), 'success');
      // Reload from server to get fresh state
      await reloadAll();
      setImportFile(null); setImportStep('upload'); setParsedData(null);
      setCurrentMapping({}); setImportPreview([]); setImportAccount({ name: '', bank: '', memberIds: [], type: 'checking', initialBalance: 0 });
      setView('dashboard');
    } catch (err) {
      showToast(t('toasts.importError', { message: err.message }), 'error');
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    setImportFile(null); setImportStep('upload'); setParsedData(null);
    setCurrentMapping({}); setImportPreview([]); setDetectedBank(null);
  };

  // State for the rule-creation modal (set after a manual category change).
  const [ruleModal, setRuleModal] = useState(null); // { txId, categoryId, suggested, categoryName }
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);

  // Apply a batch of categorizations from the AI prompt response.
  const applyAiCategorizations = async (updates) => {
    // updates: [{ txId, slug }, ...]
    await Promise.allSettled(updates.map(u =>
      api.transactions.update(u.txId, { category_slug: u.slug })
    ));
    setTransactions(prev => prev.map(tx => {
      const u = updates.find(x => x.txId === tx.id);
      return u ? { ...tx, categoryId: u.slug } : tx;
    }));
    showToast(`${updates.length} transaction${updates.length > 1 ? 's' : ''} catégorisée${updates.length > 1 ? 's' : ''} via IA externe.`, 'success');
  };

  const updateTransactionCategory = async (txId, categoryId) => {
    // 'transfer' is not a real category — it triggers the transfer-override flag instead.
    if (categoryId === 'transfer') { setTransferOverride(txId, true); return; }
    const tx = transactions.find(x => x.id === txId);
    const prevCategoryId = tx?.categoryId;
    // Optimistic update — UI reflects the change instantly, even if Railway is cold-starting
    setTransactions(prev => prev.map(x => x.id === txId ? { ...x, categoryId, isManualCategory: true } : x));
    let resp;
    try {
      resp = await api.transactions.update(txId, { category_slug: categoryId, is_manual_category: true });
      // Si le backend a créé/mis à jour une règle apprise (Category Learning
      // a passé le seuil de 2 observations), on propose à l'user d'appliquer
      // la règle aux transactions historiques du même marchand.
      if (resp?.learned_rule) {
        setLearningOffer({
          ruleId: resp.learned_rule.rule_id,
          payeeName: resp.learned_rule.payee_name,
          categoryName: resp.learned_rule.category_name,
          matchableCount: resp.learned_rule.matchable_count || 0,
          updated: resp.learned_rule.updated,
        });
      }
    } catch (err) {
      // Roll back the optimistic update on failure
      setTransactions(prev => prev.map(x => x.id === txId ? { ...x, categoryId: prevCategoryId, isManualCategory: tx?.isManualCategory } : x));
      showToast(t('toasts.genericError', { message: err.message }), 'error');
      return;
    }
    if (!tx?.label) return;
    const suggested = extractMerchantFromLabel(tx.label) || '';
    if (suggested.length < 2) return; // not enough to build a meaningful rule
    // Don't offer a rule if we already have one for the same (suggested, target).
    const existing = customRules.some(r =>
      r.pattern.toLowerCase() === suggested.toLowerCase() && r.categoryId === categoryId
    );
    if (existing) return;
    const cat = categories.find(c => c.id === categoryId);
    // Ask before popping the rule editor — was too aggressive when it opened
    // systematically on every category change. User can say no and keep
    // working; they can still create rules manually from Réglages.
    const accept = window.confirm(
      `Créer une règle pour catégoriser automatiquement les futures transactions « ${suggested} » en « ${cat?.name || categoryId} » ?`
    );
    if (!accept) return;
    setRuleModal({
      txId,
      categoryId,
      suggested,
      categoryName: cat?.name || categoryId,
    });
  };

  // Confirm callback from CreateRuleModal — actually creates the rule and
  // applies it retroactively to non-manually-categorized matching txs.
  // chosen = { keyword, categoryId } where categoryId is the target slug
  // (sub-category if user picked one, else the top-level).
  const applyRule = async (chosen) => {
    if (!ruleModal) return;
    const { txId } = ruleModal;
    const keyword = (chosen?.keyword || '').trim();
    const mode = chosen?.mode || 'category';
    const targetSlug = chosen?.categoryId;
    if (!keyword) { setRuleModal(null); return; }
    if (mode === 'category' && !targetSlug) { setRuleModal(null); return; }
    const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(pattern, 'i');

    // ─── Mode 'transfer' : persiste une CategorisationRule(rule_type='transfer')
    // + flag les tx existantes matching pour UX immédiate. Le moteur backend
    // (engine.py couche user_rule) flag automatiquement les futurs imports
    // ET les sync GoCardless via la même règle persistée.
    if (mode === 'transfer') {
      const matches = transactions.filter(x => regex.test(x.label || ''));
      try {
        // 1) Persiste la règle pour les futurs imports
        const newRule = await api.rules.create({
          pattern, category_slug: 'uncategorized', source: 'learned',
          created_by: 'user', rule_type: 'transfer', priority: 100,
        });
        setCustomRules(prev => [...prev, { pattern, categoryId: 'uncategorized', source: 'learned', _id: newRule.id, rule_type: 'transfer' }]);
        // 2) Flag les tx existantes (instant feedback)
        if (matches.length > 0) {
          await Promise.allSettled(matches.map(x => setTransferOverride(x.id, true)));
        }
        showToast(
          matches.length > 0
            ? `Règle « ${keyword} » créée — ${matches.length} transaction${matches.length > 1 ? 's' : ''} marquée${matches.length > 1 ? 's' : ''} comme virement, futurs imports auto-flag.`
            : `Règle « ${keyword} » créée — les futurs imports seront marqués comme virement interne.`,
          'success'
        );
      } catch (err) {
        showToast(t('toasts.genericError', { message: err.message }), 'error');
      } finally {
        setRuleModal(null);
      }
      return;
    }

    // ─── Mode 'category' (comportement historique)
    const targetCat = categories.find(c => c.id === targetSlug);
    const targetName = targetCat?.name || targetSlug;
    const toUpdate = transactions.filter(x =>
      x.id !== txId &&
      !x.isManualCategory &&
      x.categoryId !== targetSlug &&
      regex.test(x.label || '')
    );
    try {
      const newRule = await api.rules.create({ pattern, category_slug: targetSlug, source: 'learned' });
      setCustomRules(prev => [...prev, { pattern, categoryId: targetSlug, source: 'learned', _id: newRule.id }]);
      if (ruleModal.categoryId !== targetSlug) {
        try { await api.transactions.update(txId, { category_slug: targetSlug, is_manual_category: true }); } catch { /* tolerated */ }
        setTransactions(prev => prev.map(x => x.id === txId ? { ...x, categoryId: targetSlug, isManualCategory: true } : x));
      }
      if (toUpdate.length > 0) {
        await Promise.allSettled(toUpdate.map(x =>
          api.transactions.update(x.id, { category_slug: targetSlug })
        ));
        setTransactions(prev => prev.map(x =>
          toUpdate.some(u => u.id === x.id) ? { ...x, categoryId: targetSlug } : x
        ));
        showToast(`Règle « ${keyword} » → ${targetName} appliquée à ${toUpdate.length + 1} transaction${toUpdate.length + 1 > 1 ? 's' : ''}.`, 'success');
      } else {
        showToast(`Règle « ${keyword} » créée.`, 'success');
      }
    } catch (err) {
      showToast(t('toasts.genericError', { message: err.message }), 'error');
    } finally {
      setRuleModal(null);
    }
  };

  // Live count of matching txs for the rule modal preview.
  // targetSlug=null means "transfer mode" → count any tx matching the keyword
  // (no exclusion by category) since we'll flag them all as internal transfer.
  const countRuleMatches = (keyword, targetSlug) => {
    if (!keyword || keyword.length < 2 || !ruleModal) return 0;
    try {
      const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(pattern, 'i');
      if (targetSlug === null) {
        return transactions.filter(x => regex.test(x.label || '')).length;
      }
      const slug = targetSlug || ruleModal.categoryId;
      return transactions.filter(x =>
        x.id !== ruleModal.txId &&
        !x.isManualCategory &&
        x.categoryId !== slug &&
        regex.test(x.label || '')
      ).length;
    } catch { return 0; }
  };

  // Re-applique categorize() aux transactions actuellement non catégorisées.
  // Utile après un import où l'IA n'a pas tourné (pas de clé) ou après avoir
  // étoffé les règles. Ne touche pas aux transactions déjà catégorisées
  // manuellement ou automatiquement à un slug différent d'uncategorized.
  const recategorizeUncategorized = async () => {
    const candidates = transactions.filter(tx => !tx.categoryId || tx.categoryId === 'uncategorized');
    if (candidates.length === 0) {
      showToast('Aucune transaction non catégorisée.', 'info');
      return;
    }
    const updates = [];
    for (const tx of candidates) {
      const newCat = categorize(tx, customRules);
      if (newCat && newCat !== 'uncategorized' && newCat !== tx.categoryId) {
        updates.push({ id: tx.id, categoryId: newCat });
      }
    }
    if (updates.length === 0) {
      showToast('Aucune correspondance trouvée — étoffe tes règles ou catégorise manuellement quelques transactions.', 'info');
      return;
    }
    const results = await Promise.allSettled(
      updates.map(u => api.transactions.update(u.id, { category_slug: u.categoryId }))
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setTransactions(prev => prev.map(tx => {
      const u = updates.find(uu => uu.id === tx.id);
      return u && results[updates.indexOf(u)].status === 'fulfilled'
        ? { ...tx, categoryId: u.categoryId }
        : tx;
    }));
    showToast(`${ok} transactions re-catégorisées sur ${candidates.length} candidates.`, 'success');
  };

  // Re-run the v2 engine's transfer-detection layer on existing transactions.
  // Backend filters to is_transfer_override IS NULL (no manual user decision)
  // and flags those whose label matches a xfer.* rule. Manual overrides
  // (true OR false) are never touched.
  //
  // Use case: tx imported before 2026-05-16 (when engine v2 shipped) that
  // never traversed the engine and still pollute period totals — typically
  // AMEX PRELEVEMENT AUTOMATIQUE arriving as +X via GoCardless and counted
  // as fake "income".
  const [transferRecatResult, setTransferRecatResult] = useState(null);
  const recategorizeTransfers = async () => {
    console.log('[recategorizeTransfers] click — démarrage…');
    try {
      const res = await api.transactions.recategorizeTransfers();
      console.log('[recategorizeTransfers] réponse backend :', res);
      const flagged = res?.flagged ?? 0;
      if (flagged > 0) {
        // Reload tx so the frontend Set transferIds includes the new flags
        // and the Total période panel updates.
        await reloadAll();
      }
      // Toujours afficher la modale — même si flagged=0, l'utilisateur veut
      // savoir que le clic a fait quelque chose. C'est le retour visuel
      // attendu (vs un toast qui peut passer inaperçu).
      setTransferRecatResult({
        scanned: res?.scanned ?? 0,
        flagged,
        details: res?.details ?? [],
      });
    } catch (e) {
      console.error('[recategorizeTransfers] erreur :', e);
      showToast(e.message || 'Erreur lors de la détection des virements internes.', 'error');
    }
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
    const tx = transactions.find(x => x.id === txId);
    const prev = tx?.isTransferOverride ?? null;
    setTransactions(ts => ts.map(t => t.id === txId ? { ...t, isTransferOverride: value } : t));
    try { await api.transactions.update(txId, { is_transfer_override: value }); }
    catch (err) {
      setTransactions(ts => ts.map(t => t.id === txId ? { ...t, isTransferOverride: prev } : t));
      showToast(t('toasts.genericError', { message: err.message }), 'error');
    }
  };

  // Update transverse tags on a transaction. tags is the full new array.
  const updateTransactionTags = async (txId, tags) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, tags } : t));
    try { await api.transactions.update(txId, { tags }); }
    catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteTransaction = async (txId) => {
    if (!confirm(t('confirms.deleteTransaction'))) return;
    try {
      await api.transactions.delete(txId);
      setTransactions(prev => prev.filter(t => t.id !== txId));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const createAccount = async (fields) => {
    try {
      const created = await api.accounts.create(accountToApi(fields));
      setAccounts(prev => [...prev, accountFromApi(created)]);
      showToast(t('toasts.accountAdded'), 'success');
      setShowAddAccount(false);
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const updateAccount = async (accId, patch) => {
    // Optimistic update : applique immédiatement le patch côté UI pour que
    // le toggle réponde tout de suite. Si l'API rejette ou renvoie un état
    // différent (ex : Railway en cours de déploiement avant migration),
    // on réconcilie avec la réponse.
    const localPatch = { ...patch };
    if ('initialBalance' in localPatch) localPatch.initialBalance = parseFloat(localPatch.initialBalance) || 0;
    setAccounts(prev => prev.map(a => a.id === accId ? { ...a, ...localPatch } : a));

    const fieldMap = { initialBalance: 'initial_balance', memberIds: 'member_ids', isJoint: 'is_joint' };
    const apiPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      apiPatch[fieldMap[k] || k] = k === 'initialBalance' ? (parseFloat(v) || 0) : v;
    }
    try {
      const updated = await api.accounts.update(accId, apiPatch);
      const mapped = accountFromApi(updated);
      setAccounts(prev => prev.map(a => a.id === accId ? { ...a, ...mapped } : a));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteAccount = async (accId) => {
    if (!confirm(t('confirms.deleteAccount'))) return;
    try {
      await api.accounts.delete(accId);
      setAccounts(prev => prev.filter(a => a.id !== accId));
      setTransactions(prev => prev.filter(t => t.accountId !== accId));
    } catch (err) {
      // Compte fantôme : présent en state mais introuvable en DB (ex : DB
      // reset, autre session, dédup raté). On nettoie quand même le state
      // local et on resynchronise pour ne pas bloquer l'utilisateur.
      const msg = String(err?.message || '');
      if (/non trouv|not found|404/i.test(msg)) {
        setAccounts(prev => prev.filter(a => a.id !== accId));
        setTransactions(prev => prev.filter(t => t.accountId !== accId));
        try { await reloadAll(); } catch {}
        showToast(t('toasts.accountCleaned', { defaultValue: 'Compte fantôme retiré' }), 'success');
      } else {
        showToast(t('toasts.genericError', { message: err.message }), 'error');
      }
    }
  };

  const mergeAccounts = async (targetId, sourceId) => {
    try {
      const updated = await api.accounts.merge(targetId, sourceId);
      const mapped = accountFromApi(updated);
      setAccounts(prev => prev.filter(a => a.id !== sourceId).map(a => a.id === targetId ? mapped : a));
      await reloadAll();
      showToast('Comptes fusionnés avec succès', 'success');
    } catch (err) {
      showToast(t('toasts.genericError', { message: err.message }), 'error');
    }
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
        showToast(t('toasts.bankConnected'), 'success');
        const conns = await api.banking.listConnections();
        setBankConnections(conns);
        // Auto-sync the freshly-connected bank so the user doesn't have to
        // chase down a hidden Sync button to see their transactions.
        if (result.connection_id) {
          // Stages dedies pour la 1ere sync post-connexion (moment le plus
          // visible — l'utilisateur vient de finir le flow OAuth banque).
          setSyncStage('balance', 'Lecture du solde de votre compte…', { current: 1, total: 1 });
          try {
            // Petit delai cosmetique : laisse le user voir "Lecture du solde"
            // avant de passer en "Récupération des opérations" — sinon le stage
            // change si vite qu'on ne voit que le dernier.
            await new Promise(r => setTimeout(r, 400));
            setSyncStage('transactions', 'Récupération de vos opérations…', { current: 1, total: 1 });
            const syncRes = await api.banking.sync(result.connection_id);
            setSyncStage('success',
              syncRes.imported > 0
                ? `${syncRes.imported} opération${syncRes.imported > 1 ? 's' : ''} importée${syncRes.imported > 1 ? 's' : ''}`
                : 'Banque connectée',
              { current: 1, total: 1, progress: 1 }
            );
            await reloadAll();
            if (syncRes.imported > 0) unlockAchievement('first_import');
            setTimeout(() => setSyncStatus(null), 1800);
          } catch (syncErr) {
            setSyncStage('error',
              syncErr?.detail || syncErr?.message || 'Erreur pendant la synchronisation',
              { current: 1, total: 1, progress: 1 }
            );
            // Erreur du backend deja user-friendly grace a _gc() retry.
            const friendly = syncErr?.detail || syncErr?.message || 'Réessayez dans quelques instants.';
            showToast(friendly, 'error');
            setTimeout(() => setSyncStatus(null), 3500);
          }
        }
      } else {
        showToast(t('toasts.bankPending'), 'info');
      }
    } catch (err) {
      setBankingPendingState(null);
      showToast(t('toasts.bankError', { message: err.message }), 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-complete when bankingPendingState is set (after URL callback detection)
  useEffect(() => {
    if (bankingPendingState && !loading) {
      completeBankCallback(bankingPendingState);
    }
  }, [bankingPendingState, loading, completeBankCallback]);

  const syncBankConnection = async (connectionId) => {
    const conn = bankConnections.find(c => c.id === connectionId);
    const bankLabel = conn?.bank_name || 'votre banque';
    setSyncStage('balance', `Lecture du solde — ${bankLabel}…`, { current: 1, total: 1 });
    try {
      await new Promise(r => setTimeout(r, 400));
      setSyncStage('transactions', `${bankLabel} — récupération des opérations…`, { current: 1, total: 1 });
      const result = await api.banking.sync(connectionId);
      setSyncStage('success',
        result.imported > 0
          ? `${result.imported} opération${result.imported > 1 ? 's' : ''} importée${result.imported > 1 ? 's' : ''}`
          : 'Banque à jour',
        { current: 1, total: 1, progress: 1 }
      );
      await reloadAll();
      if (result.imported > 0) unlockAchievement('first_import');
      setTimeout(() => setSyncStatus(null), 1800);
    } catch (err) {
      setSyncStage('error',
        err?.detail || err?.message || 'Erreur pendant la synchronisation',
        { current: 1, total: 1, progress: 1 }
      );
      const friendly = err?.detail || err?.message || 'Réessayez dans quelques instants.';
      showToast(friendly, 'error');
      setTimeout(() => setSyncStatus(null), 3500);
    }
  };

  const syncAllBankAccounts = async ({ silent = false } = {}) => {
    if (!bankConnections || bankConnections.length === 0) {
      if (!silent) showToast(t('toasts.noBankConnected'), 'info');
      return { totalImported: 0, errors: 0 };
    }
    const N = bankConnections.length;
    if (!silent) {
      setSyncStage('connecting',
        N === 1
          ? `Connexion à ${bankConnections[0].bank_name || 'votre banque'}…`
          : `Synchronisation de ${N} banques…`,
        { current: 1, total: N }
      );
    }
    let totalImported = 0;
    let errors = 0;
    let firstError = null;
    try {
      for (let i = 0; i < N; i++) {
        const conn = bankConnections[i];
        if (!silent) {
          setSyncStage('transactions',
            `${conn.bank_name || 'Banque'} — récupération des opérations…`,
            { current: i + 1, total: N, progress: N > 1 ? i / N : null }
          );
        }
        try {
          const result = await api.banking.sync(conn.id);
          totalImported += result.imported || 0;
        } catch (err) {
          errors++;
          if (!firstError) firstError = err;
        }
      }
      await reloadAll();
    } finally {
      if (!silent) {
        // Stage final : success ou error. On laisse la barre une seconde
        // visible pour que l'utilisateur voie l'aboutissement avant cleanup.
        if (errors === 0) {
          setSyncStage('success',
            totalImported > 0
              ? `${totalImported} opération${totalImported > 1 ? 's' : ''} importée${totalImported > 1 ? 's' : ''}`
              : 'Comptes à jour',
            { current: N, total: N, progress: 1 }
          );
          setTimeout(() => setSyncStatus(null), 1800);
        } else {
          setSyncStage('error',
            errors === N ? 'Échec de la synchronisation' : `${N - errors}/${N} banques synchronisées`,
            { current: N, total: N, progress: 1 }
          );
          setTimeout(() => setSyncStatus(null), 3000);
        }
      }
    }
    if (silent) return { totalImported, errors, firstError };
    if (errors > 0 && totalImported === 0) {
      // Détecte les erreurs 401/403 → consentement GoCardless expiré (90j max)
      const msg = (firstError?.detail || firstError?.message || '').toLowerCase();
      const expired = /expir|401|403|reconnexion|invalid.*consent/i.test(msg);
      if (expired) {
        showToast('Le consentement bancaire a expiré (max 90 jours). Reconnectez votre banque depuis Réglages → Comptes bancaires.', 'error');
      } else {
        // Message du backend si dispo (maintenant user-friendly grace au retry _gc)
        const detail = firstError?.detail || firstError?.message;
        showToast(detail || t('toasts.syncAllFail', { count: errors }), 'error');
      }
    } else if (errors > 0) {
      showToast(t('toasts.syncAllPartial', { count: totalImported, errors }), 'info');
    } else if (totalImported > 0) {
      showToast(t('toasts.syncImported', { count: totalImported }), 'success');
    } else {
      showToast('Vos comptes sont à jour — aucune nouvelle opération.', 'info');
    }
    if (totalImported > 0) unlockAchievement('first_import');
  };

  // Auto-sync au chargement de l'app — si au moins une connexion bancaire
  // n'a pas été synchronisée depuis 6h, on déclenche un sync silencieux en
  // arrière-plan (pas de toast, pas de spinner). Empêche le scénario
  // "données pourries parce que l'utilisateur a oublié de cliquer Sync".
  // Capped à 1 exécution par session (ref) pour éviter les boucles.
  const autoSyncRef = useRef(false);
  useEffect(() => {
    if (autoSyncRef.current) return;
    if (loading || demoMode) return;
    if (!bankConnections || bankConnections.length === 0) return;
    const STALE_HOURS = 6;
    const now = Date.now();
    const isStale = bankConnections.some(c => {
      if (!c.last_synced_at) return true;
      const last = new Date(c.last_synced_at).getTime();
      return (now - last) > STALE_HOURS * 3600 * 1000;
    });
    if (!isStale) return;
    autoSyncRef.current = true;
    // Délai 2s après le mount pour laisser le rendu initial respirer
    const tid = setTimeout(() => {
      syncAllBankAccounts({ silent: true }).then(res => {
        if (res?.totalImported > 0) {
          showToast(`${res.totalImported} nouvelle${res.totalImported > 1 ? 's' : ''} opération${res.totalImported > 1 ? 's' : ''} récupérée${res.totalImported > 1 ? 's' : ''} en arrière-plan.`, 'success');
        }
      });
    }, 2000);
    return () => clearTimeout(tid);
  }, [loading, demoMode, bankConnections]);  // eslint-disable-line react-hooks/exhaustive-deps

  const deleteBankConnection = async (connectionId) => {
    const conn = bankConnections.find(c => c.id === connectionId);
    const bankLabel = conn?.bank_name || 'cette banque';
    // Confirm dialog clair sur l'effet — le backend cascade-delete les
    // comptes + transactions GoCardless liees (cf delete_connection).
    const ok = window.confirm(
      `Déconnecter ${bankLabel} ?\n\n` +
      `Les comptes synchronisés et leur historique seront retirés. ` +
      `Vous pourrez reconnecter cette banque plus tard.`
    );
    if (!ok) return;
    try {
      const result = await api.banking.deleteConnection(connectionId);
      // reloadAll pour refresh accounts + transactions cote frontend
      // (le simple setBankConnections suffit pas — les Account etaient
      // toujours en state local, d'ou le bug "comptes fantomes en sidebar").
      await reloadAll();
      const nAcc = result?.deleted_accounts || 0;
      const nTx = result?.deleted_transactions || 0;
      let msg = `${bankLabel} déconnectée.`;
      if (nAcc > 0) {
        msg += ` ${nAcc} compte${nAcc > 1 ? 's' : ''} retiré${nAcc > 1 ? 's' : ''}`;
        if (nTx > 0) msg += ` (${nTx} opération${nTx > 1 ? 's' : ''})`;
        msg += '.';
      }
      showToast(msg, 'success');
    } catch (err) {
      const friendly = err?.detail || err?.message || 'Échec de la déconnexion.';
      showToast(friendly, 'error');
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
      showToast(t('toasts.assetSaved'), 'success');
      return mapped;
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteAsset = async (assetId) => {
    if (!confirm(t('confirms.deleteAsset'))) return;
    try {
      await api.assets.delete(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const saveLiability = async (lia) => {
    try {
      const apiPayload = liaToApi(lia);
      let saved;
      if (lia.id) saved = await api.liabilities.update(lia.id, apiPayload);
      else saved = await api.liabilities.create(apiPayload);
      const mapped = liaFromApi(saved);
      setLiabilities(prev => lia.id ? prev.map(l => l.id === lia.id ? mapped : l) : [...prev, mapped]);
      showToast(t('toasts.loanSaved'), 'success');
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteLiability = async (liaId) => {
    if (!confirm(t('confirms.deleteLoan'))) return;
    try {
      await api.liabilities.delete(liaId);
      setLiabilities(prev => prev.filter(l => l.id !== liaId));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const saveMember = async (member) => {
    try {
      const payload = { name: member.name, role: member.role, color: member.color };
      let saved;
      if (member.id) saved = await api.members.update(member.id, payload);
      else saved = await api.members.create(payload);
      setMembers(prev => member.id ? prev.map(m => m.id === member.id ? saved : m) : [...prev, saved]);
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteMember = async (memberId) => {
    if (!confirm(t('confirms.deleteMember'))) return;
    try {
      await api.members.delete(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      if (activeMemberId === memberId) setActiveMemberId('all');
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const setBudget = async (categoryId, amount) => {
    const num = parseFloat(amount) || 0;
    try {
      await api.budgets.set(categoryId, num);
      setBudgets(prev => ({ ...prev, [categoryId]: num }));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  // Scope helper — 'household' for famille (compte joint), sinon le memberId
  // (Mois type personnel d'un adulte). Les enfants n'ont pas de Mois type.
  const refMonthScope = useMemo(() => {
    if (activeMemberId === 'all') return 'household';
    const m = members.find(x => x.id === activeMemberId);
    if (!m || m.role === 'child') return 'household';
    return activeMemberId;
  }, [activeMemberId, members]);

  // Le Mois type courant — celui du scope actif. Fallback vide tant que
  // le fetch n'a pas répondu (ex: switch vers un membre dont on n'a pas
  // encore chargé le scope).
  const refMonth = refMonthsByScope[refMonthScope] || { version: 1, updated_at: null, lines: [] };

  // Charger à la volée le Mois type d'un scope quand l'utilisateur switche
  // sur cet onglet membre pour la première fois.
  useEffect(() => {
    if (loading) return;
    if (refMonthsByScope[refMonthScope]) return; // déjà chargé
    const arg = refMonthScope === 'household' ? undefined : refMonthScope;
    api.refMonth.get(arg)
      .then(rm => setRefMonthsByScope(prev => ({ ...prev, [refMonthScope]: rm })))
      .catch(() => {});
  }, [refMonthScope, loading, refMonthsByScope]);

  // Persist the Mois type template pour le scope actif. Optimistic update,
  // backend round-trip réinjecte la version canonique (avec updated_at).
  //
  // FIX 2026-05-18 (bug critique) : avant ce fix le catch silencieux avalait
  // les erreurs réseau / 401 / 422 → l'utilisateur voyait l'optimistic en
  // local mais le backend n'avait rien stocké. Au refresh, mois type vide.
  //
  // Comportement correct :
  //   - en cas d'erreur : ROLLBACK de l'optimistic + toast explicite +
  //     RE-THROW pour que l'appelant (RefMonthEditor.handleSave) ne ferme
  //     PAS la modale.
  //   - en cas de succès : on remplace l'optimistic par la version backend
  //     (updated_at correct).
  const saveRefMonth = async (next) => {
    const scope = refMonthScope;
    const previous = refMonthsByScope[scope] || { version: 1, updated_at: null, lines: [] };
    setRefMonthsByScope(prev => ({ ...prev, [scope]: next }));
    try {
      const arg = scope === 'household' ? undefined : scope;
      const saved = await api.refMonth.put(arg, { version: next.version || 1, lines: next.lines || [] });
      setRefMonthsByScope(prev => ({ ...prev, [scope]: saved }));
      return saved;
    } catch (err) {
      // Rollback optimistic + alerte explicite — pas de toast générique
      setRefMonthsByScope(prev => ({ ...prev, [scope]: previous }));
      const detail = err?.detail || err?.message || 'erreur inconnue';
      showToast(`Mois type non enregistré : ${detail}. Vos modifications locales ont été annulées.`, 'error');
      throw err;  // ← critique : laisse RefMonthEditor savoir qu'il a échoué
    }
  };

  const saveGoal = async (goal) => {
    try {
      const apiPayload = goalToApi(goal);
      let saved;
      if (goal.id) saved = await api.goals.update(goal.id, apiPayload);
      else saved = await api.goals.create(apiPayload);
      const mapped = goalFromApi(saved);
      setGoals(prev => goal.id ? prev.map(g => g.id === goal.id ? mapped : g) : [...prev, mapped]);
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteGoal = async (id) => {
    if (!confirm(t('confirms.deleteGoal'))) return;
    try {
      await api.goals.delete(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
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
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
  };

  const deleteFixedCharge = async (id) => {
    if (!confirm(t('confirms.deleteFixed'))) return;
    try {
      await api.fixedCharges.delete(id);
      setFixedCharges(prev => prev.filter(f => f.id !== id));
    } catch (err) { showToast(t('toasts.genericError', { message: err.message }), 'error'); }
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
    showToast(t('toasts.backupDownloaded'), 'success');
  };

  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm(t('confirms.import'))) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.migrate.importJson(data);
      const stats = result.imported || {};
      showToast(t('toasts.backupImported', { tx: stats.transactions || 0, members: stats.members || 0, assets: stats.assets || 0 }), 'success');
      await reloadAll();
    } catch (err) {
      showToast(t('toasts.genericError', { message: err.message }), 'error');
    }
  };

  const resetAllData = async () => {
    if (!confirm(t('confirms.resetAll1'))) return;
    if (!confirm(t('confirms.resetAll2'))) return;
    try {
      // Un seul appel backend qui purge tout en une transaction.
      // Beaucoup plus fiable que d'itérer entité par entité (où une
      // erreur silencieuse laissait des orphelins — comptes supprimés
      // mais positions enfants ou liabilities restantes → patrimoine
      // négatif après "reset").
      await api.wipeHousehold();
      // Reset le ref snapshot pour éviter que l'auto-upsert re-poste
      // des valeurs stales pendant le transitoire post-wipe.
      lastSnapshotKeyRef.current = null;
      // Purge le state local et les caches localStorage
      setMembers([]);
      setAccounts([]);
      setTransactions([]);
      setAssets([]);
      setLiabilities([]);
      setCategories(DEFAULT_CATEGORIES);
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
      showToast(t('toasts.resetDone'), 'success');
    } catch (err) {
      showToast(t('toasts.resetError', { message: err.message }), 'error');
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

  if (loading) {
    // Skeleton de chargement (sprint visuel 2026-05-19) — remplace le spinner
    // bloquant par une silhouette de l'app shell + Dashboard pour donner une
    // impression de chargement plus rapide et stable (pas de CLS au mount).
    return (
      <div className="app theme-light">
        <Styles theme={theme}/>
        <div style={{
          display: 'flex',
          height: '100vh',
          background: 'var(--bg)',
        }} role="status" aria-live="polite" aria-label="Chargement de l'application">
          {/* Sidebar shell */}
          <div style={{
            width: 256,
            borderRight: '1px solid var(--border)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <Skeleton w="60%" h={28} radius={6}/>
            <Skeleton w="100%" h={32} radius={8}/>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={28} radius={6}/>)}
            </div>
          </div>
          {/* Main shell */}
          <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Skeleton w="40%" h={32}/>
            <Skeleton w="22%" h={14}/>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginTop: 16 }}>
              <Skeleton.Card height={280}/>
              <Skeleton.Card height={280}/>
            </div>
            <div style={{ marginTop: 8 }}>
              <Skeleton.Row/>
              <Skeleton.Row/>
              <Skeleton.Row/>
            </div>
          </div>
        </div>
        <span className="sr-only">Chargement…</span>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <>
        <Styles theme={theme}/>
        <Onboarding onComplete={completeOnboarding}/>
      </>
    );
  }

  const activeMember = members.find(m => m.id === activeMemberId);

  // 2FA obligatoire (cyber expert request 2026-05-19) : tout utilisateur
  // sans totp_enabled doit configurer la 2FA avant d'accéder à l'app.
  // Le mode démo et l'admin sont exemptés (admin déjà sensibilisé).
  const requires2FA = !demoMode
    && currentUser
    && currentUser.totp_enabled === false;

  return (
    <CurrencyContext.Provider value={{ baseCurrency, rates }}>
    <HideAmountsContext.Provider value={hideAmounts}>
    <div className={`app theme-${theme}`}>
      <Styles theme={theme}/>
      {toast && <Toast message={toast.message} type={toast.type}/>}
      {requires2FA && (
        <Mandatory2FAOverlay
          onComplete={async () => {
            try {
              const me = await api.auth.me();
              if (me) setCurrentUser(me);
            } catch {}
          }}
          onLogoutEscape={() => { logout(); }}
        />
      )}
      {transferRecatResult && (
        <div className="modal-backdrop" onClick={() => setTransferRecatResult(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 640, width: '92%' }}
          >
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>Détection des virements internes</h2>
              <button className="ds-btn ghost" onClick={() => setTransferRecatResult(null)}>Fermer</button>
            </div>
            <div style={{ padding: '8px 4px 16px' }}>
              <div style={{ marginBottom: 12, color: 'var(--ink-2)', fontSize: 13 }}>
                <strong style={{ color: 'var(--ink)' }}>{transferRecatResult.scanned}</strong> transaction(s) analysée(s) ·{' '}
                <strong style={{ color: 'var(--ink)' }}>{transferRecatResult.flagged}</strong> flaggée(s) comme virement interne.
              </div>
              {transferRecatResult.flagged === 0 ? (
                <div style={{ padding: 16, background: 'var(--bg-sunk)', borderRadius: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                  Aucune nouvelle transaction à flagger. Toutes les tx éligibles ont
                  déjà soit un override manuel, soit ont été traitées par le moteur.
                </div>
              ) : (
                <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)' }}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500, color: 'var(--ink-3)' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500, color: 'var(--ink-3)' }}>Libellé</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500, color: 'var(--ink-3)' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferRecatResult.details.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{d.date}</td>
                          <td style={{ padding: '8px 10px' }}>{d.label}</td>
                          <td className="num" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {(d.amount >= 0 ? '+' : '') + (d.amount?.toFixed(2) ?? '0.00')} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>
                Ces transactions sont désormais exclues des totaux Revenus / Dépenses.
                Tu peux toujours en débloquer une manuellement (clic sur le badge ↔ dans la liste).
              </div>
            </div>
          </div>
        </div>
      )}
      <SyncProgressBar status={syncStatus}/>

      {learningOffer && (
        <div className="learning-banner" role="status">
          <div className="learning-banner-text">
            <span className="learning-banner-icon">🧠</span>
            <span>
              <strong>Wealthly a appris</strong> : « {learningOffer.payeeName} » → <strong>{learningOffer.categoryName}</strong>.
              {learningOffer.matchableCount > 0 && <> Appliquer aux <strong>{learningOffer.matchableCount}</strong> transaction{learningOffer.matchableCount > 1 ? 's' : ''} historique{learningOffer.matchableCount > 1 ? 's' : ''} de ce marchand ?</>}
            </span>
          </div>
          <div className="learning-banner-actions">
            {learningOffer.matchableCount > 0 && (
              <button
                className="ds-btn primary sm"
                onClick={async () => {
                  try {
                    const res = await api.transactions.applyRuleRetroactively(learningOffer.ruleId);
                    showToast(`${res.updated || 0} transaction${(res.updated || 0) > 1 ? 's' : ''} reclassée${(res.updated || 0) > 1 ? 's' : ''}.`, 'success');
                    await reloadAll();
                  } catch (err) {
                    showToast(t('toasts.genericError', { message: err.message }), 'error');
                  } finally {
                    setLearningOffer(null);
                  }
                }}
              >
                Appliquer
              </button>
            )}
            <button className="ds-btn ghost sm" onClick={() => setLearningOffer(null)}>
              Plus tard
            </button>
          </div>
        </div>
      )}

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

          {/* Brand block — identité app fixe, séparée du filtre membre */}
          <div className="ws-brand-row" onClick={() => setView('dashboard')} role="button" tabIndex={0}>
            <div className="ws-brand-logo"><Logo size={20} /></div>
            <div className="ws-brand-name">Wealthly</div>
          </div>

          {/* Member filter — pills horizontales avec mini-avatars (C+D hybride).
              Toujours visible, scale jusqu'à ~5 membres dans 256 px. */}
          <div className="ws-member-filter">
            <div className="ws-member-filter-label">{t('nav.filtered_on')}</div>
            <div className="ws-member-pills" role="radiogroup" aria-label={t('nav.switch_member')}>
              <button
                type="button"
                className={`ws-pill ws-pill--family ${activeMemberId === 'all' ? 'on' : ''}`}
                onClick={() => setActiveMemberId('all')}
                role="radio"
                aria-checked={activeMemberId === 'all'}
                title={t('nav.all_members')}
              >
                <span className="ws-pill-avatar"><Users size={10}/></span>
                <span>{t('nav.family_view')}</span>
              </button>
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`ws-pill ${activeMemberId === m.id ? 'on' : ''}`}
                  onClick={() => setActiveMemberId(m.id)}
                  role="radio"
                  aria-checked={activeMemberId === m.id}
                  title={`${m.name} · ${m.role === 'child' ? t('nav.role_child') : t('nav.role_adult')}`}
                >
                  <span className="ws-pill-avatar" style={{ background: m.color }}>
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{m.name}</span>
                </button>
              ))}
              <button
                type="button"
                className="ws-pill ws-pill--add"
                onClick={() => setView('settings')}
                title={t('nav.manage_members')}
              >
                <Plus size={11}/>
              </button>
            </div>
          </div>

          <nav className="ws-nav" aria-label="Navigation principale" ref={navRef}>
            <span className="ws-nav-indicator" ref={navIndicatorRef} aria-hidden="true"/>

            <div className="ws-nav-group">
              <span className="ws-nav-group-label">{t('nav.group_pilotage')}</span>
            </div>
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

            <div className="ws-nav-group">
              <span className="ws-nav-group-label">{t('nav.group_gestion')}</span>
            </div>
            <button onClick={() => setView('monthly')} className={view === 'monthly' ? 'on' : ''}>
              <Calendar size={16}/> <span>{t('nav.monthly')}</span>
              {budgetsOverCount > 0 && (
                <span className="ws-nav-dot" title={`${budgetsOverCount} budget(s) dépassé(s)`}>
                  {budgetsOverCount}
                </span>
              )}
            </button>
            <button onClick={() => setView('tax')} className={view === 'tax' ? 'on' : ''}>
              <Calculator size={16}/> <span>{t('nav.tax')}</span>
            </button>
            <button onClick={() => setView('dca')} className={view === 'dca' ? 'on' : ''}>
              <TrendingUp size={16}/> <span>{t('nav.dca')}</span>
            </button>

            <div className="ws-nav-group ws-nav-group--with-cta">
              <span className="ws-nav-group-label">{t('nav.group_accounts')}</span>
              <button
                type="button"
                className="ws-nav-group-cta"
                onClick={() => setAddBankAccountStep('choice')}
                title="Ajouter un compte bancaire (DSP2 ou manuel)"
                aria-label="Ajouter un compte bancaire"
              >
                <Plus size={11}/>
              </button>
            </div>
            {(accounts || []).map(a => {
              const balance = accountBalances?.[a.id];
              return (
                <button
                  key={a.id}
                  onClick={() => setDrawerAccount(a)}
                  className="ws-account-item"
                  title={a.name || a.bank}
                >
                  <span className="ws-bank-dot" style={{ background: bankColor(a.bank) }}>
                    {(a.name || a.bank || '?')[0].toUpperCase()}
                  </span>
                  <span className="ws-account-name">{a.name || a.bank}</span>
                  {Number.isFinite(balance) && !hideAmounts && (
                    <span className="ws-account-balance">
                      {fmtAmount(balance, 'card', { currency: a.currency || 'EUR' })}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="ws-nav-group">
              <span className="ws-nav-group-label">{t('nav.group_config')}</span>
            </div>
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
              <button
                className={`ws-user ${sidebarMenuOpen ? 'open' : ''}`}
                onClick={() => setSidebarMenuOpen(o => !o)}
                title={currentUser.email}
                aria-expanded={sidebarMenuOpen}
                aria-haspopup="menu"
              >
                <div className="ws-user-avatar">
                  {(currentUser.full_name || currentUser.email || '?')[0].toUpperCase()}
                </div>
                <div className="ws-user-info">
                  <div className="ws-user-name">
                    {currentUser.full_name || currentUser.email.split('@')[0]}
                  </div>
                  <div className="ws-user-meta">
                    <span className="ws-plan-badge">{currentUser.plan || 'Gratuit'}</span>
                    <span className="ws-dsp2-badge" title="Open Banking DSP2 actif">DSP2</span>
                  </div>
                </div>
                <ChevronUp size={13} className={`ws-user-chev ${sidebarMenuOpen ? 'open' : ''}`}/>
              </button>
            )}
            {sidebarMenuOpen && (
              <>
                <div className="ws-popover-overlay" onClick={() => setSidebarMenuOpen(false)}/>
                <div className="ws-popover" role="menu">
                  <div className="ws-popover-eyebrow">{currentUser?.email}</div>
                  <button onClick={() => { setView('settings'); setSidebarMenuOpen(false); }} role="menuitem">
                    <Settings size={14}/>
                    <span>{t('nav.settings')}</span>
                  </button>
                  <div className="ws-popover-divider"/>
                  <button
                    onClick={() => { logout(); setSidebarMenuOpen(false); }}
                    className="ws-popover-danger"
                    role="menuitem"
                  >
                    <LogOut size={14}/>
                    <span>{t('nav.logout') || 'Déconnexion'}</span>
                  </button>
                </div>
              </>
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

          <main ref={contentRef} className="content">
        {view === 'dashboard' && (
          <Dashboard
            netWorth={netWorth} liquidWealth={liquidWealth} assetsValue={assetsValue} liabilitiesValue={liabilitiesValue}
            thisMonthStats={thisMonthStats} monthlyEvolution={monthlyEvolution}
            accounts={accounts}
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
        {view === 'sankey-demo' && (
          <Suspense fallback={null}>
            <SankeyMorphDemo/>
          </Suspense>
        )}
        {['monthly','cashflow'].includes(view) && (
          <div className="monthly-hub">
            {view === 'monthly' && (
              <Monthly
                transactions={visibleTransactions} accounts={accounts} categories={categories} members={members}
                recurringIds={recurringIds} recurringGroups={recurringGroups}
                monthlyEvolution={monthlyEvolution} thisMonthStats={thisMonthStats}
                anomalies={anomalies}
                categoryAnalysis={categoryAnalysis}
                fixedCharges={fixedCharges} saveFixedCharge={saveFixedCharge} deleteFixedCharge={deleteFixedCharge}
                refMonth={refMonth} saveRefMonth={saveRefMonth}
                refMonthScope={refMonthScope}
                activeMember={activeMember} activeMemberId={activeMemberId}
                fiftyThirtyTwenty={fiftyThirtyTwenty}
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
            liquidWealth={liquidWealth}
            onOpenAddWizard={() => setShowAddAccount(true)}
            reload={reloadAll}
            seededNewItem={seededNewItem}
            onSeededConsumed={() => setSeededNewItem(null)}
          />
        )}
        {view === 'transactions' && (
          <Transactions
            transactions={visibleTransactions} accounts={accounts} categories={categories}
            members={members}
            recurringIds={recurringIds} toggleRecurring={toggleRecurring}
            transferIds={transferIds} setTransferOverride={setTransferOverride}
            updateCategory={updateTransactionCategory} updateTags={updateTransactionTags} deleteTransaction={deleteTransaction} fmt={fmt}
            initialAccountFilter={txInitialAccountFilter}
            onConsumeInitialFilter={() => setTxInitialAccountFilter(null)}
            onOpenAiPrompt={() => setShowAiPromptModal(true)}
          />
        )}
        {view === 'analysis' && (
          <Analysis
            transactions={visibleTransactions} categories={categories}
            recurringIds={recurringIds} recurringGroups={recurringGroups} monthlyEvolution={monthlyEvolution}
            accounts={accounts} memberShare={memberShare} fmt={fmt}
            transferIds={transferIds}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            members={members} accounts={accounts} accountBalances={accountBalances}
            saveMember={saveMember} deleteMember={deleteMember}
            deleteAccount={deleteAccount}
            updateAccount={updateAccount}
            mergeAccounts={mergeAccounts}
            transactions={visibleTransactions}
            exportData={exportData} importData={importData} resetAllData={resetAllData}
            bankConnections={bankConnections}
            syncBankConnection={syncBankConnection}
            deleteBankConnection={deleteBankConnection}
            categories={categories}
            showToast={showToast}
            onCategoryCreated={(apiCat) => {
              if (!apiCat) return;
              const mapped = categoryFromApi(apiCat);
              setCategories(prev => {
                if (prev.some(c => c.id === mapped.id)) return prev;
                return [...prev, mapped];
              });
            }}
            onCategoryDeleted={(slug) => {
              setCategories(prev => prev.filter(c => c.id !== slug && c.parent !== slug));
            }}
            reloadCategories={async () => {
              try {
                const list = await api.categories.list();
                if (Array.isArray(list)) setCategories(list.map(categoryFromApi));
              } catch (err) { showToast(t('toasts.loadError', { message: err.message }), 'error'); }
            }}
            fmt={fmt}
            baseCurrency={baseCurrency} setBaseCurrency={setBaseCurrency}
            rates={rates} ratesDate={ratesDate}
            currentUser={currentUser}
            onImport={() => { setView('import'); setImportStep('upload'); }}
            recategorizeUncategorized={recategorizeUncategorized}
            recategorizeTransfers={recategorizeTransfers}
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
            aiCategorizing={aiCategorizing} importing={importing}
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
                  className={view === v || (v === 'monthly' && ['monthly','cashflow'].includes(view)) ? 'active' : ''}
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
        <button onClick={() => setView('monthly')} className={['monthly','cashflow'].includes(view) ? 'active' : ''}>
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

      <CreateRuleModal
        open={!!ruleModal}
        suggested={ruleModal?.suggested || ''}
        categories={categories}
        initialCategoryId={ruleModal?.categoryId || ''}
        matchCount={countRuleMatches}
        onConfirm={applyRule}
        onClose={() => setRuleModal(null)}
      />

      <AiPromptModal
        open={showAiPromptModal}
        transactions={visibleTransactions}
        categories={categories}
        accounts={accounts}
        onApply={applyAiCategorizations}
        onClose={() => setShowAiPromptModal(false)}
      />

      {showAddAccount && (
        <AddWealthModal
          onPickType={({ category, subtype }) => {
            // Mode manuel: l'éditeur canonique 5-step (LiabilityEditor /
            // RealEstateEditor / SimpleAssetEditor) prend le relais côté
            // vue Patrimoine pour capturer toutes les infos d'un coup.
            setSeededNewItem({ category, subtype });
            setShowAddAccount(false);
            // Bascule en vue Patrimoine si on n'y est pas déjà.
            if (view !== 'wealth') setView('wealth');
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

      {/* Bouton + sidebar (section Comptes) -> modal compte bancaire avec
          choix DSP2 / manuel / CSV. Le 'choice' step affiche les 3 options
          en cards cliquables ; le 'bank-list' skipperait direct vers les
          banques (utilise par un autre flow). */}
      {addBankAccountStep && (
        <AddAccountModal
          members={members}
          onSave={async (fields) => {
            await createAccount(fields);
            setAddBankAccountStep(null);
          }}
          onClose={() => setAddBankAccountStep(null)}
          onImportCsv={() => { setView('import'); setImportStep('upload'); }}
          initialStep={addBankAccountStep}
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

function AddAccountModal({ members = [], onSave, onClose, onImportCsv, initialStep = 'choice' }) {
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

            {/* CSV import card — affichee uniquement si la prop onImportCsv
                est fournie (sidebar context). Pas affichee depuis Dashboard
                "Nouveau compte" qui ne propage pas ce callback. */}
            {onImportCsv && (
              <button
                onClick={() => { onClose(); onImportCsv(); }}
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
                  <FileUp size={22}/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>
                    Importer un CSV
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Importez l'historique d'une banque non compatible DSP2 depuis un fichier exporté.
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}/>
              </button>
            )}

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
              <Combobox
                value={country}
                onChange={val => { setCountry(val); setBanks([]); setSearch(''); }}
                options={BANK_COUNTRIES.map(c => ({ value: c.code, label: c.name }))}
                placeholder="Pays…"
              />
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
                  <Combobox
                    value={form.type}
                    onChange={val => setField('type', val)}
                    options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                  />
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
                  <Combobox
                    value={form.currency}
                    onChange={val => setField('currency', val)}
                    options={[
                      { value: 'EUR', label: 'EUR — Euro',           icon: '🇪🇺' },
                      { value: 'USD', label: 'USD — Dollar US',      icon: '🇺🇸' },
                      { value: 'GBP', label: 'GBP — Livre sterling', icon: '🇬🇧' },
                      { value: 'CHF', label: 'CHF — Franc suisse',   icon: '🇨🇭' },
                    ]}
                  />
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
