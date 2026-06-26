// ============================================================================
// Dashboard — Wealthly v3 (Refonte Claude Design)
//
// Spec source: design_handoff_wealthly_dashboard/README.md (Screen 01).
// Layout : main header (Bonsoir) + Hero KPI + Allocation (grid 1.5/1)
//          + Mes comptes + Transactions/Budget/Insights (grid 2/1).
//
// Interface props préservée pour ne pas casser WealthlyApp.jsx :
// (netWorth, liquidWealth, assetsValue, liabilitiesValue, thisMonthStats,
//  monthlyEvolution, visibleAccounts, accountBalances, visibleAssets,
//  visibleLiabilities, members, activeMemberId, transactions, categories,
//  fmt, memberShare, categoryAnalysis, budgets, transferIds, setView,
//  onAccountClick)
// ============================================================================
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MagneticButton } from '../components/MagneticButton.jsx';
import { gsap, ScrollTrigger } from '../utils/gsapSetup.js';
import { MiniCashflowCard } from './dashboard/MiniCashflowCard.jsx';
import {
  Plus, FileText, RefreshCw, ArrowUp, ArrowDown,
  TrendingUp, AlertTriangle, Sparkles, MoreHorizontal, Loader2,
} from 'lucide-react';
import { ASSET_CLASS_MAP } from '../constants.js';
import { useFormatEUR } from '../components/ui/Amount.jsx';
import { useHideAmounts } from '../contexts/HideAmounts.jsx';
import { BankMark } from '../components/ui/BankMark.jsx';
import { Sparkline } from '../components/ui/Sparkline.jsx';
import { BilanModal } from '../components/BilanModal.jsx';
// Note: fmtAmount/formatDelta retirés du Dashboard avec la suppression
// des multi-deltas 30j/3M/YTD (feedback user 2026-05-18 — perf % jugée
// peu utile sur la vitrine). KPI strip réorienté patrimoine cash + immo.
import { formatDate } from '../utils.js';

const PERIODS = [
  { id: '1m',  label: '1M',   months: 1 },
  { id: '3m',  label: '3M',   months: 3 },
  { id: '6m',  label: '6M',   months: 6 },
  { id: '1y',  label: '1A',   months: 12 },
  { id: '5y',  label: '5A',   months: 60 },
  { id: 'all', label: 'Tout', months: null },
];

const DATAVIZ = ['var(--d2)', 'var(--d1)', 'var(--d3)', 'var(--d5)', 'var(--d4)', 'var(--d6)', 'var(--d7)'];

// ─── AllocationCard ─────────────────────────────────────────────────────
// Refonte 2026-05-21 (user feedback "le cadre est moche mal proportionné,
// utilise gsap et ui ux"). Avant : Donut + liste simple, ratio vide qui
// laissait 50% de blanc en bas.
//
// Maintenant : Donut compact + barres horizontales par classe (largeur =
// % du total) qui s'animent en GSAP au mount. Plus dense visuellement,
// pas de vide. height: fit-content -> ne stretch plus pour matcher le hero.
function AllocationCard({ allocationData, allocationTotal, formatEUR, hidden, onDetails, t }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      // La barre empilée pousse de 0 → cible (charte Forêt : jauges qui se
      // construisent au mount), puis la légende entre en cascade.
      gsap.fromTo('[data-alloc-seg]',
        { width: '0%' },
        { width: (i, el) => el.dataset.target, duration: 0.9, ease: 'expo.out', stagger: 0.07, delay: 0.2 }
      );
      gsap.fromTo('[data-alloc-legend]',
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.42, ease: 'expo.out', stagger: 0.05, delay: 0.35 }
      );
    }, wrapRef);
    return () => ctx.revert();
  }, [allocationData.length]);

  if (!allocationData.length) {
    return (
      <div className="alloc-card" style={{ height: 'fit-content' }}>
        <div className="alloc-head">
          <div className="dash-eyebrow">
            <span className="dash-eyebrow-label">{t('dashboard.allocation')}</span>
          </div>
          <button className="link-btn" onClick={onDetails}>{t('dashboard.details')} →</button>
        </div>
        <div className="dash-empty">
          <span className="dash-empty-lead">{t('dashboard.noAllocData')}</span>
          <button className="link-btn" onClick={onDetails}>{t('dashboard.details')} →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="alloc-card" ref={wrapRef} style={{ height: 'fit-content', alignSelf: 'flex-start' }}>
      <div className="alloc-head">
        <div className="dash-eyebrow">
          <span className="dash-eyebrow-label">{t('dashboard.allocation')}</span>
        </div>
        <button className="link-btn" onClick={onDetails}>{t('dashboard.details')} →</button>
      </div>

      {/* Total actifs — chiffre de contexte, subordonné au hero */}
      <div className="alloc-total">
        <span className="alloc-total-cap">Total actifs</span>
        <span className="alloc-total-val num">{hidden ? '···' : formatEUR(allocationTotal)}</span>
        <span className="alloc-total-sub">
          réparti sur {allocationData.length} classe{allocationData.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre empilée — lisible au coup d'œil, remplace le donut (charte Forêt) */}
      <div className="alloc-stack" role="img" aria-label="Répartition du patrimoine par classe d'actifs">
        {allocationData.map((d) => {
          const pct = allocationTotal ? (d.value / allocationTotal) * 100 : 0;
          return (
            <span key={d.name} data-alloc-seg data-target={`${pct}%`}
              title={`${d.name} · ${pct.toFixed(0)} %`}
              style={{ width: '0%', background: d.color }} />
          );
        })}
      </div>

      {/* Légende « 71 % Immobilier » */}
      <div className="alloc-legend">
        {allocationData.map((d) => {
          const pct = allocationTotal ? (d.value / allocationTotal) * 100 : 0;
          return (
            <div key={d.name} data-alloc-legend className="alloc-leg-item">
              <span className="alloc-leg-dot" style={{ background: d.color }} />
              <span className="alloc-leg-name">{d.name}</span>
              <span className="alloc-leg-pct num">{hidden ? '··' : `${pct.toFixed(0)} %`}</span>
              <span className="alloc-leg-val num">{hidden ? '···' : formatEUR(d.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INITIAL = (s) => {
  if (!s) return '••';
  const t = String(s).trim().split(/\s+/);
  return ((t[0]?.[0] || '') + (t[1]?.[0] || t[0]?.[1] || '')).toUpperCase();
};

// "il y aX min" relative time pour la sync
function parseUtcDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = String(input);
  const hasTz = /[Z]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
}
const relTime = (input, tFn = (k) => k) => {
  const d = parseUtcDate(input) || (input instanceof Date ? input : new Date(Date.now() - 4 * 60_000));
  if (!d || Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'a l\'instant';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `il y a${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a${h} h`;
  return `il y a${Math.floor(h / 24)} j`;
};

const greeting = (t) => {
  const h = new Date().getHours();
  if (h < 5) return t('dashboard.greetingNight');
  if (h < 12) return t('dashboard.greetingMorning');
  if (h < 18) return t('dashboard.greetingAfternoon');
  return t('dashboard.greetingEvening');
};

export function Dashboard({
  netWorth, liquidWealth, assetsValue, liabilitiesValue,
  thisMonthStats, monthlyEvolution,
  accounts = [],
  visibleAccounts, accountBalances,
  visibleAssets, visibleAssetsAll = visibleAssets, visibleLiabilities, liabilityShare,
  members, activeMemberId,
  transactions, categories, fmt, memberShare,
  categoryAnalysis = {}, anomalies = [], cashflowProjection,
  goals, budgets = {}, wealthHistory = [],
  recurringGroups, currentMonth,
  transferIds = new Set(), transferPairs = [],
  setView, onAccountClick, onAddAccount,
  onSyncAll, hasConnections = false,
  baseCurrency = 'EUR', rates = null,
  currentUser = null,
}) {
  const { t } = useTranslation();
  const formatEUR = useFormatEUR();
  const hidden = useHideAmounts();
  const [period, setPeriod] = useState('6m');
  const [txFilter, setTxFilter] = useState('all'); // all | expense | income
  const [hover, setHover] = useState(null); // chart hover point
  const [bilanOpen, setBilanOpen] = useState(false); // modale Bilan patrimonial complet
  const [syncing, setSyncing] = useState(false);
  // Bascule Financier / Total — un seul chiffre focal à la fois (charte Forêt).
  const [heroMode, setHeroMode] = useState('fin'); // 'fin' | 'total'

  // GSAP page-enter stagger — fade-in en cascade des sections principales
  // a chaque mount du Dashboard. Donne une sensation premium 'app qui se
  // construit sous les yeux'. Respecte prefers-reduced-motion.
  const dashRef = useRef(null);
  useEffect(() => {
    if (!dashRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      // Page-enter stagger (head + hero immediately visible)
      gsap.fromTo(
        ['.dash-head', '.dash-hero-row'],
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.08, clearProps: 'transform' }
      );
      // ScrollTrigger reveal pour les rows below-the-fold (all-in GSAP per
      // user feedback 2026-05-21). Fade-up declanche quand 88% de la
      // viewport touche le top de la section.
      gsap.utils.toArray('[data-dash-reveal]').forEach(el => {
        gsap.fromTo(el,
          { opacity: 0, y: 18 },
          {
            opacity: 1, y: 0, duration: 0.55, ease: 'expo.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
            clearProps: 'transform',
          }
        );
      });
    }, dashRef);
    return () => {
      ctx.revert();
      // Cleanup ScrollTrigger instances scoped a ce composant
      ScrollTrigger?.getAll().forEach(s => s.kill());
    };
  }, []);

  // ── Allocation : liquidités + actifs par classe ─────────────────────────
  const allocationData = useMemo(() => {
    const classes = {};
    if (liquidWealth > 0) {
      classes['Liquidités'] = { value: liquidWealth };
    }
    (visibleAssets || []).forEach(a => {
      const cls = ASSET_CLASS_MAP[a.type]?.class || 'Divers';
      const val = (parseFloat(a.currentValue) || 0) * (memberShare?.(a) ?? 1);
      if (!classes[cls]) classes[cls] = { value: 0 };
      classes[cls].value += val;
    });
    const entries = Object.entries(classes)
      .filter(([, d]) => d.value > 0)
      .map(([name, d]) => ({ name, value: d.value }))
      .sort((a, b) => b.value - a.value);
    return entries.map((e, i) => ({ ...e, color: DATAVIZ[i % DATAVIZ.length] }));
  }, [liquidWealth, visibleAssets, memberShare]);
  const allocationTotal = allocationData.reduce((s, d) => s + d.value, 0);

  // ── Performance ────────────────────────────────────────────────────────
  // Préférer wealthHistory (snapshots NW mensuels) au monthlyEvolution
  // (soldes bancaires uniquement). Sans ça, le chart affiche l'évolution
  // des comptes courants alors que le hero affiche le patrimoine net,
  // donnant des deltas absurdes (+149 % sur 6 mois en démo).
  const sortedEvo = useMemo(() => {
    if (wealthHistory && wealthHistory.length >= 2) {
      return [...wealthHistory]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(s => {
          // Le hero affiche le patrimoine FINANCIER net → la courbe, le delta
          // ET le survol doivent mesurer la MÊME grandeur. Avant : on traçait
          // `net_worth` (patrimoine TOTAL, immo compris) sous un chiffre
          // financier → delta incohérent + survol qui injectait le total
          // (~620 k) dans le slot du financier (~104 k). Fix : financier net =
          // financial_assets_value − other_debt (champs du snapshot).
          const fin = s.financial_assets_value ?? s.financialAssetsValue;
          const otherD = s.other_debt ?? s.otherDebt ?? 0;
          let balance;
          if (fin != null) {
            balance = fin - otherD;
          } else {
            // Snapshots legacy sans le champ financier : financier = net total
            // − (immo − crédit immo).
            const nw = s.net_worth ?? s.netWorth ?? 0;
            const re = s.real_estate_value ?? s.realEstateValue ?? 0;
            const mort = s.mortgage_debt ?? s.mortgageDebt ?? 0;
            balance = nw - (re - mort);
          }
          return { month: s.month, balance };
        });
    }
    return [...(monthlyEvolution || [])].sort((a, b) => a.month.localeCompare(b.month));
  }, [wealthHistory, monthlyEvolution]);

  const chartData = useMemo(() => {
    const p = PERIODS.find(p => p.id === period);
    return p?.months ? sortedEvo.slice(-p.months - 1) : sortedEvo;
  }, [sortedEvo, period]);

  const periodDelta = useMemo(() => {
    if (chartData.length < 2) return { abs: 0, pct: 0 };
    const first = chartData[0].balance;
    const last = chartData[chartData.length - 1].balance;
    return { abs: last - first, pct: first ? ((last - first) / Math.abs(first)) * 100 : 0 };
  }, [chartData]);

  // KPI strip refondu (feedback user 2026-05-18) — 3 cellules orientées
  // patrimoine plutôt que perf %.
  //   1. Patrimoine cash = liquidités + placements + épargne + retraite
  //   2. Patrimoine immo net = immobilier − crédits immo (mortgage)
  //   3. Épargne du mois (conservée, utile en daily check)
  // CHANTIER 2 — Epargne effective (= virements savings + cat=savings),
  // pas "income - expenses" (qui est le reste a vivre, concept different).
  // thisMonthStats.savings est rempli par monthlyEvolution depuis 2026-05-21.
  const monthSaving = thisMonthStats?.savings || 0;

  // cashWealth (Patrimoine financier brut, avant deduction crédits conso) =
  // liquidWealth + tous les actifs non-immobiliers (Placements, Épargne,
  // Retraite, Alternatifs, Divers). Aligne sur la formule Wealth.jsx
  // (financialWealthLocal = liquidWealth + (totalAssets - realEstateValue)
  // − consumerLoans) pour eviter divergence cross-views.
  const cashWealth = useMemo(() => {
    let total = liquidWealth || 0;
    (visibleAssets || []).forEach(a => {
      // Tout actif NON-immobilier compte dans le financier. On filtre sur
      // `type === 'real_estate'` (comme la valeur canonique WealthlyApp), PAS
      // sur la classe ASSET_CLASS_MAP : un type non mappé (ex. or/métal) avait
      // une classe falsy et tombait en silence → Dashboard 100 860 vs Wealth
      // 104 310. Désormais les deux réconcilient.
      if (a.type !== 'real_estate') {
        total += (parseFloat(a.currentValue) || 0) * (memberShare?.(a) ?? 1);
      }
    });
    return total;
  }, [liquidWealth, visibleAssets, memberShare]);

  const realEstateNet = useMemo(() => {
    let immoAssets = 0;
    (visibleAssets || []).forEach(a => {
      if (a.type === 'real_estate') {
        immoAssets += (parseFloat(a.currentValue) || 0) * (memberShare?.(a) ?? 1);
      }
    });
    let mortgageDebt = 0;
    (visibleLiabilities || []).forEach(l => {
      if (l.type === 'mortgage') {
        // Bug fix 2026-05-19 : frontend utilise `remainingCapital` (camelCase),
        // pas `currentBalance` qui n'existe pas → renvoyait toujours 0 →
        // "Patrimoine immo net" affichait la valeur brute de l'immo au lieu
        // de (immo − emprunt restant). Fallback snake_case pour robustesse.
        const bal = parseFloat(l.remainingCapital ?? l.remaining_capital ?? 0) || 0;
        // 2026-05-21 : liabilityShare (binary 1/0) au lieu de memberShare
        // (qui divise par nb co-emprunteurs). Un emprunt est solidaire,
        // pas une fraction.
        mortgageDebt += bal * (liabilityShare?.(l) ?? memberShare?.(l) ?? 1);
      }
    });
    return { value: immoAssets - mortgageDebt, assets: immoAssets, debt: mortgageDebt };
  }, [visibleAssets, visibleLiabilities, memberShare, liabilityShare]);

  // CHANTIER 1 — Refonte calculs Patrimoine (user feedback 2026-05-21)
  // ─────────────────────────────────────────────────────────────────
  // Logique cible :
  //   Patrimoine financier net = liquidWealth + placements/épargne
  //                              − crédits non-immo (conso, auto, etc.)
  //   Patrimoine immo net      = immobilier − crédit immo
  //   Patrimoine net total     = financier net + immo net
  //
  // Test user :
  //   Liquidités 30000 + PEA 1870 − Crédit conso 11000 = 20 870 (financier)
  //   RP 755000 − Mortgage 670000 = 85 000 (immo net)
  //   Total = 105 870
  // ─────────────────────────────────────────────────────────────────

  // Autres dettes = total liabilities − crédit immo (crédits conso/auto/etc).
  const otherDebt = useMemo(() => {
    const total = Math.abs(liabilitiesValue || 0);
    return Math.max(0, total - (realEstateNet.debt || 0));
  }, [liabilitiesValue, realEstateNet.debt]);

  // Patrimoine financier net = cashWealth brut − dettes non-immo.
  const financialNet = useMemo(
    () => (cashWealth || 0) - (otherDebt || 0),
    [cashWealth, otherDebt]
  );

  // Label intelligent pour les dettes non-immo (= otherDebt). Avant on
  // hardcodait "Crédits conso" → mensonger si l'user a seulement un crédit
  // auto. Maintenant on derive du(des) type(s) reels :
  //   - 1 seul type non-immo → label specifique ("Crédit auto", "Crédit conso"...)
  //   - 2+ types non-immo    → "Autres crédits" (generique)
  //   - 0 type               → null (KPI/breakdown caches)
  const otherDebtLabel = useMemo(() => {
    const nonMortgage = (visibleLiabilities || []).filter(l =>
      l.type !== 'mortgage' && (parseFloat(l.remainingCapital) || 0) > 0.5
    );
    if (nonMortgage.length === 0) return null;
    const types = new Set(nonMortgage.map(l => l.type || 'other_loan'));
    if (types.size === 1) {
      const t = [...types][0];
      return ({
        consumer_loan: 'Crédit conso',
        auto_loan: 'Crédit auto',
        other_loan: 'Autre prêt',
      })[t] || 'Autres crédits';
    }
    return 'Autres crédits';
  }, [visibleLiabilities]);

  // Patrimoine net total = financier + immo. Doit egaler netWorth (Actifs −
  // Passifs) sinon il y a divergence (= bug d'agregation a tracer).
  const patrimoineNetTotal = useMemo(
    () => financialNet + (realEstateNet.value || 0),
    [financialNet, realEstateNet.value]
  );

  // ── Hero bascule Financier / Total ──────────────────────────────────────
  // Un seul chiffre focal à la fois (charte Forêt). Le graphe + le delta
  // restent la trajectoire FINANCIÈRE (seule série historisée) ; en mode
  // « Total » on remplace le delta par la décomposition financier/immo.
  const heroValue = heroMode === 'total' ? patrimoineNetTotal : financialNet;
  const heroLabel = heroMode === 'total' ? 'Patrimoine net total' : 'Patrimoine financier net';

  // Count-up au mount : le chiffre se construit de 0 → valeur (signature
  // « l'app se construit sous les yeux »). rAF maison car AnimatedNumber ne
  // compte pas au tout premier mount ; le survol du graphe court-circuite le
  // tween pour un scrub instantané.
  const [countUp, setCountUp] = useState(null);
  const countUpDone = useRef(false);
  useEffect(() => {
    if (countUpDone.current) return;
    countUpDone.current = true;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof heroValue !== 'number' || !Number.isFinite(heroValue)) return;
    const target = heroValue, start = performance.now(), dur = 1100;
    let raf;
    setCountUp(0);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setCountUp(target * e);
      if (p < 1) raf = requestAnimationFrame(tick); else setCountUp(null);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []); // mount once — count up vers la valeur initiale (financier)
  const heroDisplay = hover?.balance ?? (countUp != null ? countUp : heroValue);

  const kpis = [
    {
      label: 'Patrimoine financier net',
      sub: otherDebtLabel
        ? `Liquidités + Placements − ${otherDebtLabel}`
        : 'Liquidités + Placements',
      value: financialNet,
      delta: null,
      negative: financialNet < 0,
    },
    {
      label: 'Patrimoine immo net',
      sub: 'Immobilier − Crédit immo',
      value: realEstateNet.value,
      delta: null,
      negative: realEstateNet.value < 0,
    },
    {
      label: t('dashboard.savingsMonth'),
      sub: 'Mis de côté ce mois',
      value: monthSaving,
      // Bug fix 2026-05-19 : avant on calculait (monthSaving / income) * 100
      // ce qui donnait -59 423 % quand income était un petit remboursement
      // (ex. 8 €). Garde-fou : on n'affiche le taux d'épargne que si les
      // revenus du mois sont >= 500 € ET que le résultat reste dans
      // [-100 %, +100 %].
      delta: (() => {
        const income = thisMonthStats?.income || 0;
        if (income < 500) return null;
        const rate = (monthSaving / income) * 100;
        if (!Number.isFinite(rate) || rate < -100 || rate > 100) return null;
        return rate;
      })(),
    },
  ];
  const totalDebt = Math.abs(liabilitiesValue || 0);

  // Transactions filtrées par chip
  const recentTx = useMemo(() => {
    let list = [...(transactions || [])].sort((a, b) => b.date.localeCompare(a.date));
    if (txFilter === 'expense') list = list.filter(t => t.amount < 0 && !transferIds.has(t.id));
    if (txFilter === 'income')  list = list.filter(t => t.amount > 0 && !transferIds.has(t.id));
    return list.slice(0, 9);
  }, [transactions, txFilter, transferIds]);

  // Grouped by day for display
  const txByDay = useMemo(() => {
    const groups = new Map();
    recentTx.forEach(t => {
      const key = t.date.slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });
    return [...groups.entries()].map(([day, txs]) => ({
      day,
      txs,
      total: txs.reduce((s, t) => s + t.amount, 0),
    }));
  }, [recentTx]);

  // Budget panel (top 5 expense categories with budget set)
  const budgetItems = useMemo(() => {
    const items = Object.entries(budgets)
      .map(([catId, amount]) => {
        const spent = categoryAnalysis[catId]?.current || 0;
        const cat = categories.find(c => c.id === catId || c.slug === catId);
        return { catId, label: cat?.name || catId, amount, spent, pct: amount ? (spent / amount) * 100 : 0 };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
    return items;
  }, [budgets, categoryAnalysis, categories]);
  const totalBudget = budgetItems.reduce((s, i) => s + i.amount, 0);
  const totalSpent  = budgetItems.reduce((s, i) => s + i.spent, 0);

  // Moyenne glissante par catégorie sur les mois passés AVEC DONNÉES (max 6),
  // excluant le mois en cours. Critique : on divisait toujours par 6, donc un
  // user avec 2 mois d'historique voyait des deltas absurdes (+200% sur tout).
  // Maintenant on track les mois qui contiennent vraiment des tx et on divise
  // par ce nombre réel. Si < 2 mois d'historique on désactive l'insight.
  const categoryCompare = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const prevKeys = new Set();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(curYear, curMonth - i, 1);
      prevKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const current = {};
    const prevSums = {};
    const monthsWithData = new Set(); // mois passés qui ont au moins 1 tx eligible
    (transactions || []).forEach(tx => {
      if (!tx?.date || typeof tx.amount !== 'number') return;
      if (tx.amount >= 0) return;
      if (transferIds.has(tx.id)) return;
      const catId = tx.categoryId;
      if (!catId) return;
      const key = String(tx.date).slice(0, 7);
      const abs = Math.abs(tx.amount);
      if (key === curKey) {
        current[catId] = (current[catId] || 0) + abs;
      } else if (prevKeys.has(key)) {
        prevSums[catId] = (prevSums[catId] || 0) + abs;
        monthsWithData.add(key);
      }
    });

    // Garde-fou anti-mensonge : pas assez d'historique → on ne sort aucun
    // delta plutôt que de diviser par 6 et afficher "+412%" sur 1 mois.
    const monthsUsed = monthsWithData.size;
    if (monthsUsed < 2) {
      return { items: [], monthsUsed };
    }

    const result = [];
    const all = [];
    Object.keys(current).forEach(catId => {
      const cur = current[catId];
      const sum = prevSums[catId] || 0;
      if (sum <= 0) return;
      const avg = sum / monthsUsed; // ← divise par les VRAIS mois dispos
      const deltaPct = ((cur - avg) / avg) * 100;
      all.push({ catId, current: cur, avg, deltaPct });
      if (cur <= 30) return;
      if (Math.abs(deltaPct) <= 15) return;
      result.push({ catId, current: cur, avg, deltaPct });
    });
    result.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
    if (result.length === 0 && all.length > 0) {
      // Fallback : surfacer le plus gros mover comme signal neutre pour pas
      // laisser le dashboard vide si aucune cat ne passe les seuils stricts.
      all.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
      const top = all[0];
      if (top && top.avg > 0 && top.current > 0) {
        result.push({ ...top, fallback: true });
      }
    }
    return { items: result, monthsUsed };
  }, [transactions, transferIds]);

  // Insights
  const insights = useMemo(() => {
    const list = [];

    // Comparer mois — surface up to 2 catégories avec le plus gros écart vs
    // la moyenne sur les mois passés AVEC DONNÉES (max 6, min 2 — sinon skip).
    // Le body affiche "moyenne sur N mois" pour ne plus mentir sur la période.
    const { items: cmpItems, monthsUsed } = categoryCompare;
    const monthsLabel = `${monthsUsed} mois`;
    cmpItems.slice(0, 2).forEach(({ catId, current, avg, deltaPct, fallback }) => {
      const cat = categories?.find(c => c.id === catId || c.slug === catId);
      const catLabel = cat?.name || catId;
      const pct = Math.round(deltaPct);
      const pctStr = (pct > 0 ? '+' : '') + pct;
      const isIncrease = deltaPct > 0;
      const avgWithPeriod = `${formatEUR(avg)} (moy. ${monthsLabel})`;
      if (fallback) {
        list.push({
          variant: 'neutral',
          icon: <Sparkles size={14}/>,
          title: t('dashboard.compareNeutralTitle', { category: catLabel, pct: pctStr }),
          body: t('dashboard.compareNeutralBody', { current: formatEUR(current), avg: avgWithPeriod }),
        });
        return;
      }
      const tKey = isIncrease ? 'dashboard.compareIncrease' : 'dashboard.compareDecrease';
      list.push({
        variant: isIncrease ? 'neg' : 'pos',
        icon: isIncrease ? <AlertTriangle size={14}/> : <TrendingUp size={14}/>,
        title: t(`${tKey}Title`, { category: catLabel, pct: pctStr }),
        body: t(`${tKey}Body`, { current: formatEUR(current), avg: avgWithPeriod }),
      });
    });

    if (thisMonthStats?.income > 0) {
      const rate = (monthSaving / thisMonthStats.income) * 100;
      if (rate >= 30) {
        list.push({ variant: 'pos', icon: <TrendingUp size={14}/>, title: t('dashboard.insightSavingsExcellentTitle'), body: t('dashboard.insightSavingsExcellentBody', { amount: formatEUR(monthSaving), pct: rate.toFixed(0) }) /* OLD */ });
        // _ B` });
      } else if (rate < 0) {
        list.push({ variant: 'neg', icon: <AlertTriangle size={14}/>, title: t('dashboard.insightOverspendTitle'), body: `${formatEUR(Math.abs(monthSaving))} à combler ce mois.` });
      } else {
        list.push({ variant: 'neutral', icon: <Sparkles size={14}/>, title: t('dashboard.insightMarginTitle'), body: `${formatEUR(monthSaving)} de marge — visez 30 % pour solidifier l'épargne.` });
      }
    }
    const overBudgets = Object.entries(budgets).filter(([id, a]) => (categoryAnalysis[id]?.current || 0) > a);
    if (overBudgets.length) {
      list.push({ variant: 'neg', icon: <AlertTriangle size={14}/>, title: t('dashboard.insightBudgetOverTitle', { count: overBudgets.length }), body: t('dashboard.insightBudgetOverBody') });
    }
    if (periodDelta.pct > 5) {
      list.push({ variant: 'pos', icon: <TrendingUp size={14}/>, title: t('dashboard.insightWealthUpTitle'), body: `+${periodDelta.pct.toFixed(1)} % sur la période — la trajectoire est bonne.` });
    }
    return list.slice(0, 3);
  }, [thisMonthStats, monthSaving, budgets, categoryAnalysis, periodDelta, categoryCompare, categories, formatEUR, t]);

  const userFirstName = currentUser?.full_name?.split(' ')[0]
    || currentUser?.email?.split('@')[0]
    || (activeMemberId !== 'all' ? members?.find(m => m.id === activeMemberId)?.name : null)
    || members?.[0]?.name
    || '';

  return (
    <div className="dash-v3" ref={dashRef}>
      <DashStyles/>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="dash-head">
        <div>
          <h1 className="dash-h1">
            {greeting(t)}
            {userFirstName && <em className="dash-h1-em">{` ${userFirstName}`}</em>}
          </h1>
          <div className="dash-sub">
            {t('dashboard.accountsConnected', { count: visibleAccounts?.length || 0 })}
            {/* "X filtré(s) sur" retire 2026-05-21 (user feedback) — l'info ne
                parlait a personne, on garde juste le nombre de comptes connectes. */}
          </div>
        </div>
        <div className="dash-actions">
          <MagneticButton
            strength={0.15}
            scale={1.03}
            className="ds-btn"
            title={t('dashboard.pdfTitle')}
            onClick={async () => {
              const { generateBilanHtmlReport } = await import('../reportHtml.js');
              generateBilanHtmlReport({
                netWorth, liquidWealth, assetsValue, liabilitiesValue,
                thisMonthStats, monthlyEvolution, wealthHistory, budgets,
                visibleAccounts, accountBalances, visibleAssets: visibleAssetsAll, visibleLiabilities,
                members, activeMemberId,
                recurringGroups, categoryAnalysis, categories,
                memberShare, currentMonth,
                ASSET_CLASS_MAP,
              });
            }}
          >
            <FileText size={14}/> <span className="dash-btn-label">{t('dashboard.pdf', 'Bilan PDF')}</span>
          </MagneticButton>
          <MagneticButton
            strength={0.15}
            scale={1.03}
            className="ds-btn"
            disabled={syncing}
            onClick={async () => {
              if (!onSyncAll) return;
              setSyncing(true);
              try { await onSyncAll(); } finally { setSyncing(false); }
            }}
            title={hasConnections ? t('dashboard.syncTitle') : t('dashboard.noBanksTitle')}
            style={{ opacity: syncing ? 0.6 : 1 }}
          >
            {syncing
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/> <span className="dash-btn-label">{t('dashboard.syncing')}</span></>
              : <><RefreshCw size={14}/> <span className="dash-btn-label">{t('dashboard.sync')}</span></>
            }
          </MagneticButton>
          <MagneticButton className="ds-btn primary" onClick={onAddAccount}><Plus size={14}/> <span className="dash-btn-label">{t('dashboard.newAccount')}</span></MagneticButton>
        </div>
      </header>

      {/* ── §01 Hero KPI + Allocation ──────────────────────────────────── */}
      <section className="dash-hero-row">
        <div className="hero-card">
          <div className="hero-top">
            <div className="dash-eyebrow">
              <span className="dash-eyebrow-label">{heroLabel}</span>
            </div>
            <div className="ds-range-tabs" role="tablist" aria-label="Patrimoine affiché">
              <button role="tab" aria-selected={heroMode === 'fin'}
                className={heroMode === 'fin' ? 'on' : ''}
                onClick={() => setHeroMode('fin')}>Financier</button>
              <button role="tab" aria-selected={heroMode === 'total'}
                className={heroMode === 'total' ? 'on' : ''}
                onClick={() => setHeroMode('total')}>Total</button>
            </div>
          </div>

          {/* Chiffre focal UNIQUE (charte Forêt) — Geist Mono tabulaire, count-up
              au mount, scrub direct au survol du graphe. La bascule Financier/
              Total ci-dessus pilote la grandeur affichée ; jamais deux nombres
              en concurrence. Décompo inline sobre + delta (financier). */}
          <div className="hero-number-row">
            <div className="hero-net-stack">
              <span className="ds-hero-num">{formatEUR(heroDisplay, { decimals: 0 })}</span>
              <div className="hero-breakdown">
                {heroMode === 'fin' ? (
                  <>
                    <span><span className="hero-bd-k">Liquidités</span>{' '}<span className="hero-bd-v">{formatEUR(liquidWealth)}</span></span>
                    {(cashWealth - liquidWealth) > 0.5 && (
                      <>
                        <span className="hero-bd-dot">·</span>
                        <span><span className="hero-bd-k">Placements</span>{' '}<span className="hero-bd-v">{formatEUR(cashWealth - liquidWealth)}</span></span>
                      </>
                    )}
                    {otherDebt > 0.5 && otherDebtLabel && (
                      <>
                        <span className="hero-bd-dot">·</span>
                        <span><span className="hero-bd-k">{otherDebtLabel}</span>{' '}<span className="hero-bd-v neg">−{formatEUR(otherDebt)}</span></span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span><span className="hero-bd-k">Financier net</span>{' '}<span className="hero-bd-v">{formatEUR(financialNet)}</span></span>
                    <span className="hero-bd-dot">·</span>
                    <span><span className="hero-bd-k">Immo net</span>{' '}<span className="hero-bd-v">{formatEUR(realEstateNet.value)}</span></span>
                  </>
                )}
              </div>
            </div>
            {heroMode === 'fin' && periodDelta.abs !== 0 && (
              <div className="hero-delta">
                <span className={`ds-pill ${periodDelta.abs >= 0 ? 'pos' : 'neg'}`}>
                  {periodDelta.abs >= 0 ? <ArrowUp size={11}/> : <ArrowDown size={11}/>}
                  <span className="num">{periodDelta.abs >= 0 ? '+' : ''}{formatEUR(periodDelta.abs)} · {hidden ? '···' : `${periodDelta.pct >= 0 ? '+' : ''}${periodDelta.pct.toFixed(2).replace('.', ',')} %`}</span>
                </span>
                <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{t('dashboard.vsStart')}</span>
              </div>
            )}
          </div>

          {/* Bannière éditoriale quand l'état est partiel (pas d'actifs) */}
          {(assetsValue || 0) === 0 && totalDebt > 0 && (
            <div className="hero-banner">
              <span className="hero-banner-lead">
                Ajoutez vos actifs (immobilier, placements, comptes) pour une vue patrimoniale complète.
              </span>
              <button className="link-btn" onClick={() => setView?.('wealth')}>
                Compléter mon patrimoine →
              </button>
            </div>
          )}

          {/* Trajectoire financière (série historisée) + sélecteur de période,
              contrôle secondaire — ne concurrence pas le chiffre focal. */}
          <div className="hero-chart-head">
            <span className="hero-chart-cap">Évolution · patrimoine financier</span>
            <div className="ds-range-tabs">
              {PERIODS.map(p => (
                <button key={p.id}
                  className={period === p.id ? 'on' : ''}
                  onClick={() => setPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <HeroChart data={chartData} onHover={setHover} hover={hover}/>

          {/* Voir tout le patrimoine — ouvre le bilan complet (immo incluse).
              Le hero focus le financier ; l'immo reste à la demande. */}
          <button type="button" className="hero-bilan-btn" onClick={() => setBilanOpen(true)}>
            <FileText size={13}/>
            <span>Voir tout le patrimoine (incl. immo)</span>
            <span className="hero-bilan-arrow">→</span>
          </button>

          <div className="kpi-strip" style={{ marginTop: 24 }}>
            {kpis.map((k, i) => {
              // Color-code: negative explicit (autres dettes, monthSaving<0) → terracotta.
              const negative = k.negative || (typeof k.value === 'number' && k.value < 0);
              const valColor = negative ? 'var(--negative)' : 'var(--ink)';
              return (
                <div key={i} className="kpi-cell">
                  <div className="ds-micro">{k.label}</div>
                  {k.sub && <div className="kpi-sub">{k.sub}</div>}
                  <div className="kpi-val num" style={{ color: valColor }}>
                    {hidden ? '···' : formatEUR(k.value)}
                  </div>
                  {k.delta != null && (
                    <div className={`kpi-delta num ${k.delta >= 0 ? 'pos' : 'neg'}`}>
                      {hidden ? '···' : `${k.delta >= 0 ? '+' : ''}${k.delta.toFixed(1).replace('.', ',')} %`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <AllocationCard
          allocationData={allocationData}
          allocationTotal={allocationTotal}
          formatEUR={formatEUR}
          hidden={hidden}
          onDetails={() => setView?.('wealth')}
          t={t}
        />
      </section>

      {/* ── §02 Cashflow mini — vue du mois en cours (sprint 2026-05-20) ── */}
      <div data-dash-reveal>
      <MiniCashflowCard
        thisMonthStats={thisMonthStats}
        currentMonth={currentMonth}
        formatEUR={formatEUR}
        hidden={hidden}
        onOpenMonthly={() => setView?.('monthly')}
      />
      </div>

      {/* ── §03 Mes comptes — masque 2026-05-21 (user feedback refonte ciblee
              "skip Insights et Mes comptes"). Garde le code en historique git,
              ressort facile via setShowFullAccounts ulterieurement. */}
      {false && (
      <section className="accounts-panel ds-panel">
        <div className="ds-panel-head">
          <div className="dash-eyebrow">
            <span className="dash-eyebrow-label">{t('dashboard.accounts')} · {visibleAccounts?.length || 0}</span>
          </div>
          <button className="link-btn" onClick={() => setView?.('settings')}>{t('dashboard.viewAll')} →</button>
        </div>

        <div className="accounts-cols ds-micro">
          <div>{t('dashboard.colAccount')}</div>
          <div style={{ textAlign: 'right' }}>{t('dashboard.colBalance')}</div>
          <div style={{ textAlign: 'right' }}>{t('dashboard.col30d')}</div>
          <div style={{ textAlign: 'right' }}>{t('dashboard.colType')}</div>
          <div style={{ textAlign: 'right' }}>{t('dashboard.colSync')}</div>
          <div/>
        </div>

        <div className="accounts-rows">
          {(visibleAccounts || []).map(a => {
            const bal = accountBalances?.[a.id] ?? 0;
            const spark = buildSparkData(transactions, a.id, bal);
            return (
              <button key={a.id} className="account-row" onClick={() => onAccountClick?.(a)}>
                <div className="account-id">
                  <BankMark bank={a.bank} name={a.name}/>
                  <div className="account-name">
                    <div className="line1">{a.bank ? `${a.bank} · ` : ''}{a.name}</div>
                    <div className="line2 mono">{a.currency || 'EUR'}</div>
                  </div>
                </div>
                <div className="num cell-r">{formatEUR(bal)}</div>
                <div className="cell-r"><Sparkline data={spark}/></div>
                <div className="cell-r" style={{ color: 'var(--ink-3)', fontSize: 12 }}>{prettyType(a.type)}</div>
                <div className="cell-r" style={{ color: a.lastSyncedAt ? 'var(--positive)' : 'var(--ink-3)', fontSize: 11.5 }}>
                  {a.lastSyncedAt ? relTime(new Date(a.lastSyncedAt), t) : (a.source === 'gocardless' ? t('dashboard.syncPending') : '—')}
                </div>
                <div className="cell-r"><span className="ds-icon-btn" style={{ width: 26, height: 26 }} onClick={(e) => e.stopPropagation()}><MoreHorizontal size={14}/></span></div>
              </button>
            );
          })}
          {!visibleAccounts?.length && (
            <div className="dash-empty">
              <span className="dash-empty-lead">{t('dashboard.noAccounts')}</span>
              <button className="link-btn" onClick={onAddAccount}>{t('dashboard.connectBank')}</button>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ── Mouvements internes du mois (C15 2026-05-18) ──────────────── */}
      {(() => {
        // Filtre les paires détectées sur le mois courant + max 6 lignes
        const cm = currentMonth || new Date().toISOString().slice(0, 7);
        const monthPairs = (transferPairs || []).filter(p => (p.date || '').startsWith(cm)).slice(0, 6);
        const totalPairs = (transferPairs || []).filter(p => (p.date || '').startsWith(cm)).length;
        if (!monthPairs.length) return null;
        const accName = id => visibleAccounts?.find(a => a.id === id)?.name
          || accounts?.find(a => a.id === id)?.name
          || '—';
        return (
          <section className="ds-panel xfer-panel">
            <div className="ds-panel-head">
              <div>
                <div className="dash-eyebrow">
                  <span className="dash-eyebrow-label">Mouvements internes · {totalPairs}</span>
                </div>
                <div className="ds-panel-sub" style={{ marginTop: 4 }}>
                  Paires détectées automatiquement entre vos comptes, exclues du cashflow.
                </div>
              </div>
            </div>
            <div className="xfer-list">
              {monthPairs.map((p, i) => (
                <div key={i} className="xfer-row">
                  <div className="xfer-arrow">↔</div>
                  <div className="xfer-route">
                    <span className="xfer-from">{accName(p.fromAccountId)}</span>
                    <span className="xfer-sep">→</span>
                    <span className="xfer-to">{accName(p.toAccountId)}</span>
                  </div>
                  <div className="xfer-amt num">{formatEUR(Math.abs(p.amount))}</div>
                  <div className="xfer-date">{formatDate(p.date, { format: 'short' })}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ── Transactions : déplacées vers leur page dédiée (charte Forêt :
          un écran = un focal). Ancien panneau conservé en historique, gardé
          inerte ; le Dashboard n'expose qu'un point d'entrée sobre (plus bas). */}
      {false && (
      <section className="dash-bottom-row" data-dash-reveal>
        {/* §04 Transactions panel */}
        <div className="ds-panel">
          <div className="ds-panel-head">
            <div>
              <div className="dash-eyebrow">
                <span className="dash-eyebrow-label">{t('dashboard.recent')}</span>
              </div>
              <div className="ds-panel-sub" style={{ marginTop: 4 }}>{t('dashboard.recentMeta')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['all', t('dashboard.filterAll')], ['expense', t('dashboard.filterExpenses')], ['income', t('dashboard.filterIncome')]].map(([id, label]) => (
                <button key={id}
                  className={`ds-chip ${txFilter === id ? 'on' : ''}`}
                  onClick={() => setTxFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="tx-list">
            {txByDay.map(grp => (
              <div key={grp.day}>
                <div className="tx-day">
                  <span className="ds-micro">{prettyDay(grp.day)}</span>
                  <span className="num" style={{ color: grp.total >= 0 ? 'var(--positive)' : 'var(--ink-2)', fontSize: 12 }}>
                    {grp.total >= 0 ? '+' : ''}{formatEUR(grp.total)}
                  </span>
                </div>
                {grp.txs.map(tx => {
                  const cat = categories.find(c => c.id === tx.categoryId || c.slug === tx.categoryId);
                  const isTransfer = transferIds.has(tx.id);
                  return (
                    <div key={tx.id} className="tx-row">
                      <div className="ds-tx-icon" style={{
                        background: tx.amount >= 0 ? 'var(--positive-soft)' : 'var(--neutral-soft)',
                        color: tx.amount >= 0 ? 'var(--positive)' : 'var(--ink-2)',
                      }}>{INITIAL(tx.label)}</div>
                      <div className="tx-mid">
                        <div className="tx-label" title={tx.label || t('dashboard.noLabel')}>{tx.label || t('dashboard.noLabel')}</div>
                        <div className="tx-meta">
                          {isTransfer
                            ? <span className="ds-pill accent">{t('dashboard.transferPill')}</span>
                            : (() => {
                                const topCat = cat?.parent ? categories.find(c => c.id === cat.parent) : cat;
                                return (
                                  <>
                                    <span className="ds-pill">{topCat?.name || t('dashboard.uncategorized')}</span>
                                    {cat?.parent && <span className="ds-pill-sub">{cat.name}</span>}
                                  </>
                                );
                              })()}
                          <span>{accountName(visibleAccounts, tx.accountId)}</span>
                        </div>
                      </div>
                      <div className="tx-amount num" style={{ color: tx.amount > 0 ? 'var(--positive)' : 'var(--ink)' }}>
                        {tx.amount >= 0 ? '+' : ''}{formatEUR(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {!recentTx.length && (
              <div className="dash-empty">
                <span className="dash-empty-lead">{t('dashboard.noTransactions')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="dash-side-stack">
          {/* §05 Budget panel — retire 2026-05-21 (user feedback :
              "ca renvoi a rien ce bouton plus c'st faux , vire ce cadre
              useless"). Le routing 'budgets' n'est pas wirre, totaux toujours
              a 0 -> aucune valeur. Garde en historique git. */}
          {false && (
          <div className="ds-panel">
            <div className="ds-panel-head">
              <div>
                <div className="dash-eyebrow">
                  <span className="dash-eyebrow-label">{t('dashboard.budgetTitle', { month: monthName(currentMonth) })}</span>
                </div>
                <div className="ds-panel-sub num" style={{ marginTop: 4 }}>{formatEUR(totalSpent)} / {formatEUR(totalBudget)}</div>
              </div>
              <button className="link-btn" onClick={() => setView?.('budgets')}>{t('dashboard.viewAll')} →</button>
            </div>
            <div className="budget-list">
              {budgetItems.map(b => (
                <div key={b.catId} className="budget-item">
                  <div className="budget-line1">
                    <span>{b.label}</span>
                    <span className="num" style={{ fontWeight: 500 }}>
                      {formatEUR(b.spent)} <span style={{ color: 'var(--ink-3)' }}>/ {formatEUR(b.amount)}</span>
                    </span>
                  </div>
                  <div className="budget-bar">
                    <div
                      className="budget-fill"
                      style={{
                        width: `${Math.min(100, b.pct)}%`,
                        background: b.pct >= 100 ? 'var(--negative)' : b.pct >= 80 ? 'var(--warning)' : 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="budget-line3">
                    <span style={{ color: 'var(--ink-3)' }}>{b.pct >= 100 ? t('dashboard.budgetOver') : t('dashboard.budgetRest', { amount: formatEUR(Math.max(0, b.amount - b.spent)) })}</span>
                    <span className="mono num">{b.pct.toFixed(0)} %</span>
                  </div>
                </div>
              ))}
              {!budgetItems.length && (
                <div className="dash-empty">
                  <span className="dash-empty-lead">{t('dashboard.budgetEmpty')}</span>
                  <button className="link-btn" onClick={() => setView?.('budgets')}>{t('dashboard.budgetCreate')}</button>
                </div>
              )}
            </div>
          </div>
          )}

          {/* §06 Insights panel — masque 2026-05-21 (user feedback :
              "skip Insights et Mes comptes pour la demo"). Garde le code
              en historique git. Pour le pitch on focus le storytelling
              sur Patrimoine / Cashflow / Transactions. */}
          {false && (
          <div className="ds-panel">
            <div className="ds-panel-head">
              <div>
                <div className="dash-eyebrow">
                  <span className="dash-eyebrow-label">{t('dashboard.insights')}</span>
                </div>
                <div className="ds-panel-sub" style={{ marginTop: 4 }}>{t('dashboard.insightsGenerated')}</div>
              </div>
            </div>
            <div className="insights-list">
              {insights.map((it, i) => (
                <div key={i} className={`insight ${it.variant}`}>
                  <div className="insight-icon">{it.icon}</div>
                  <div>
                    <div className="insight-title">{it.title}</div>
                    <div className="insight-body">{it.body}</div>
                  </div>
                </div>
              ))}
              {!insights.length && (
                <div className="dash-empty">
                  <span className="dash-empty-lead">{t('dashboard.insightsEmpty')}</span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </section>
      )}

      {/* Point d'entrée sobre vers la page Transactions (liste déplacée) */}
      <button type="button" className="dash-tx-link" data-dash-reveal onClick={() => setView?.('transactions')}>
        <span className="dash-tx-link-main">
          <span className="dash-eyebrow-label">{t('dashboard.recent')}</span>
          <span className="dash-tx-link-sub">{t('dashboard.recentMeta')}</span>
        </span>
        <span className="dash-tx-link-cta">Voir les transactions →</span>
      </button>

      {/* Modale Bilan complet (clic "Voir tout le patrimoine") */}
      <BilanModal
        open={bilanOpen}
        onClose={() => setBilanOpen(false)}
        visibleAccounts={visibleAccounts}
        accountBalances={accountBalances}
        visibleAssets={visibleAssets}
        visibleLiabilities={visibleLiabilities}
        memberShare={memberShare}
        liabilityShare={liabilityShare}
        ASSET_CLASS_MAP={ASSET_CLASS_MAP}
        formatEUR={formatEUR}
        hidden={hidden}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Hero chart — SVG manuel, viewBox 700×200, aire avec gradient accent.
// ────────────────────────────────────────────────────────────────────────
function HeroChart({ data, onHover, hover }) {
  if (!data || data.length < 2) {
    return (
      <div style={{
        height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-3)', fontSize: 13,
        borderTop: '1px dashed var(--border)', marginTop: 16,
      }}>
        Pas encore assez d'historique pour tracer la courbe.
      </div>
    );
  }
  const W = 700, H = 200, PT = 16, PB = 28, PL = 0, PR = 8;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const vals = data.map(d => d.balance);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = innerW / (data.length - 1);
  const xy = data.map((d, i) => ({
    x: PL + i * stepX,
    y: PT + innerH - ((d.balance - min) / range) * innerH,
    d,
  }));
  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${xy[xy.length-1].x.toFixed(1)} ${PT + innerH} L ${xy[0].x.toFixed(1)} ${PT + innerH} Z`;

  // Gridlines (4 horizontal, pointillées)
  const grid = [0.25, 0.5, 0.75, 1].map(f => PT + innerH * f);

  // Axis labels
  const sampleEvery = Math.max(1, Math.ceil(data.length / 7));
  const labels = data.map((d, i) => ({ i, d, show: i % sampleEvery === 0 || i === data.length - 1 }));

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = xy[0], best = Infinity;
    for (const p of xy) {
      const dx = Math.abs(p.x - x);
      if (dx < best) { best = dx; nearest = p; }
    }
    onHover?.(nearest.d);
  };

  return (
    <div className="hero-chart" onMouseLeave={() => onHover?.(null)} onMouseMove={handleMove}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {grid.map((y, i) => (
          <line key={i} x1={PL} x2={W - PR} y1={y} y2={y}
                stroke="var(--border)" strokeDasharray="2 4" strokeWidth="1"/>
        ))}
        <path d={area} fill="url(#heroFill)"/>
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
        {/* Last point */}
        <circle cx={xy[xy.length-1].x} cy={xy[xy.length-1].y}
                r="4" fill="var(--bg-elev)" stroke="var(--accent)" strokeWidth="2"/>
        {/* Hover */}
        {hover && (() => {
          const p = xy.find(p => p.d === hover);
          if (!p) return null;
          return (
            <g>
              <line x1={p.x} x2={p.x} y1={PT} y2={PT + innerH}
                    stroke="var(--ink-mute)" strokeDasharray="3 3" strokeWidth="1"/>
              <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-elev)" stroke="var(--accent)" strokeWidth="2"/>
            </g>
          );
        })()}
      </svg>
      <div className="hero-axis">
        {labels.filter(l => l.show).map(l => (
          <span key={l.i} className="mono">{shortMonth(l.d.month)}</span>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────
function prettyDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const ytd = new Date(today); ytd.setDate(today.getDate() - 1);
  const eq = (a, b) => a.toDateString() === b.toDateString();
  if (eq(d, today)) return "Aujourd'hui";
  if (eq(d, ytd))   return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function shortMonth(m) {
  if (!m) return '';
  const d = new Date(m + '-01');
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function monthName(m) {
  if (!m) {
    return new Date().toLocaleDateString('fr-FR', { month: 'long' });
  }
  const d = new Date(m + '-01');
  return d.toLocaleDateString('fr-FR', { month: 'long' });
}

function accountName(accounts, id) {
  const a = accounts?.find(x => x.id === id);
  return a ? (a.bank ? `${a.bank} · ${a.name}` : a.name) : '';
}

function prettyType(t) {
  const map = {
    checking:    'Courant',
    savings:     'Épargne',
    pea:         'PEA',
    cto:         'CTO',
    assurance_vie: 'Assurance vie',
    crypto:      'Crypto',
    other:       'Autre',
  };
  return map[t] || t || '—';
}

function buildSparkData(transactions, accountId, currentBalance) {
  const txs = (transactions || []).filter(t => t.accountId === accountId).slice(-12);
  if (!txs.length) return [currentBalance, currentBalance];
  let bal = currentBalance;
  const series = [bal];
  for (let i = txs.length - 1; i >= 0; i--) {
    bal -= txs[i].amount;
    series.unshift(bal);
  }
  return series;
}

// ────────────────────────────────────────────────────────────────────────
// Styles spécifiques Dashboard (CSS-in-JS scopé).
// ────────────────────────────────────────────────────────────────────────
function DashStyles() {
  const css = `
@keyframes spin { to { transform: rotate(360deg); } }
.dash-v3 {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Pleine largeur — cap geree par .content. Avant cape a 1320 recreait du vide. */
  max-width: 100%;
  margin: 0;
}
.dash-v3 .mono { font-family: var(--font-mono); }
.dash-v3 .link-btn {
  background: transparent; border: none; padding: 0;
  color: var(--ink-3); font-size: 12px; cursor: pointer;
  font-family: var(--font-sans);
  transition: color var(--t-fast);
}
.dash-v3 .link-btn:hover { color: var(--ink); }
.dash-v3 .cell-r { text-align: right; }

/* Cards hover effect — refonte all-in 2026-05-21. NO translateY (design
   rule), juste box-shadow grow + border accent fade. Cohabite avec les
   stages d'apparition GSAP (clearProps: transform). */
.dash-v3 .hero-card,
.dash-v3 .alloc-card,
.dash-v3 .mcc-card,
.dash-v3 .ds-panel,
.dash-v3 .accounts-panel {
  transition: box-shadow 280ms ease, border-color 280ms ease;
}
.dash-v3 .hero-card:hover,
.dash-v3 .alloc-card:hover,
.dash-v3 .mcc-card:hover,
.dash-v3 .ds-panel:hover {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  box-shadow:
    0 1px 0 rgba(255,255,255,0.04) inset,
    0 12px 32px -16px color-mix(in srgb, var(--accent) 30%, transparent);
}

/* Header */
.dash-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 4px; flex-wrap: wrap; }
.dash-h1 { font: 500 26px/1.15 var(--font-sans); letter-spacing: -0.02em; margin: 0 0 6px; color: var(--ink); }
.dash-h1-em { font-family: var(--font-sans); font-style: normal; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.dash-sub { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-3); }
.dash-actions { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 640px) {
  .dash-actions { gap: 6px; }
  .dash-actions .ds-btn { padding: 0 10px; height: 34px; font-size: 12.5px; }
  .dash-actions .ds-btn .dash-btn-label { display: none; }
  .dash-actions .ds-btn.primary .dash-btn-label { display: inline; }
}

/* Hero row */
/* dash-hero-row : 2026-05-21 grid 8/4 strict (sur 12-cols) — refonte
   visuelle. Avant 1.5/1 = 7.5/4 approximatif. */
.dash-hero-row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
@media (max-width: 1024px) { .dash-hero-row { grid-template-columns: 1fr; } }

.hero-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 28px 28px 0;
}
.hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hero-number-row { display: flex; align-items: baseline; gap: 16px; margin-top: 18px; flex-wrap: wrap; }
.hero-net-stack { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.hero-debt-mini { font-size: 12px; color: var(--ink-3); letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.hero-delta { display: flex; align-items: center; gap: 8px; }
.hero-sub-debts { margin-top: 6px; color: var(--ink-2); font-size: 13px; font-variant-numeric: tabular-nums; }
.hero-chart { margin: 8px -4px 0; position: relative; cursor: crosshair; }
.hero-axis { display: flex; justify-content: space-between; padding: 4px 8px 12px; color: var(--ink-3); font-size: 11px; }

/* ── Charte Forêt — bascule, chiffre focal, barre de répartition ───────── */
/* Press tactile : brightness (charte « pas de translate brutal ») */
.dash-v3 .ds-range-tabs button:active,
.dash-v3 .ds-chip:active { filter: var(--press-feedback); }

.hero-breakdown {
  margin-top: 12px;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 13px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.hero-bd-k { color: var(--ink-2); }
.hero-bd-v { color: var(--ink); font-weight: 500; }
.hero-bd-v.neg { color: var(--negative); }
.hero-bd-dot { color: var(--ink-3); opacity: 0.4; }

.hero-chart-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-top: 20px;
}
.hero-chart-cap {
  font: 500 11px/1 var(--font-mono);
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);
}

.hero-bilan-btn {
  margin-top: 16px; align-self: flex-start;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-md);
  background: transparent; border: 1px solid var(--border);
  color: var(--ink-2);
  font: 500 12.5px/1 var(--font-sans); cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast), filter var(--t-fast);
}
.hero-bilan-btn:hover { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent-2); }
.hero-bilan-btn:active { filter: var(--press-feedback); }
.hero-bilan-arrow { color: var(--ink-3); margin-left: 4px; }
.hero-bilan-btn:hover .hero-bilan-arrow { color: var(--accent-2); }

/* Allocation — total (contexte) + barre empilée + légende */
.alloc-total { display: flex; flex-direction: column; gap: 2px; }
.alloc-total-cap {
  font: 500 10px/1 var(--font-mono);
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3);
}
.alloc-total-val {
  font: 600 24px/1.1 var(--font-sans); color: var(--ink);
  letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-top: 4px;
}
.alloc-total-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }

.alloc-stack {
  display: flex; height: 14px; border-radius: 7px; overflow: hidden; gap: 2px;
  background: var(--bg-sunk);
}
.alloc-stack > span { display: block; height: 100%; min-width: 0; }

.alloc-legend { display: flex; flex-direction: column; gap: 9px; }
.alloc-leg-item {
  display: grid; grid-template-columns: 10px 1fr auto auto;
  align-items: baseline; gap: 10px;
}
.alloc-leg-dot { width: 8px; height: 8px; border-radius: 2px; align-self: center; }
.alloc-leg-name { font-size: 13px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alloc-leg-pct { font: 600 12.5px/1 var(--font-sans); color: var(--ink); font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }
.alloc-leg-val { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; min-width: 64px; text-align: right; }

/* Lien sobre vers Transactions (liste déplacée hors Dashboard) */
.dash-tx-link {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  width: 100%; text-align: left;
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius-xl); padding: 18px 22px; cursor: pointer;
  transition: box-shadow 280ms ease, border-color 280ms ease, filter var(--t-fast);
  font-family: inherit;
}
.dash-tx-link:hover {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px color-mix(in srgb, var(--accent) 30%, transparent);
}
.dash-tx-link:active { filter: var(--press-feedback); }
.dash-tx-link-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dash-tx-link-sub { font-size: 12px; color: var(--ink-3); }
.dash-tx-link-cta { font: 500 13px/1 var(--font-sans); color: var(--accent); white-space: nowrap; }

/* Eyebrow Geist Mono "§ 0X" — pattern canonique des sections Dashboard (C4) */
.dash-eyebrow { display: inline-flex; align-items: baseline; gap: 8px; }
.dash-eyebrow-num {
  font: 500 11px/1 var(--font-mono);
  letter-spacing: 0.08em;
  color: var(--ink-3);
  opacity: 0.7;
}
.dash-eyebrow-label {
  font: 600 11px/1 var(--font-sans);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-2);
}


/* Empty states éditoriaux — Newsreader italic, ton sobre (C4) */
/* ── Mouvements internes panel (C15 2026-05-18) ──────────────────────── */
.xfer-panel { margin-top: 28px; padding: 18px 22px 14px; }
.xfer-list { margin-top: 10px; display: flex; flex-direction: column; }
.xfer-row {
  display: grid;
  grid-template-columns: 22px 1fr auto auto;
  align-items: center;
  gap: 14px;
  padding: 9px 0;
  border-bottom: 1px dotted var(--border);
}
.xfer-row:last-child { border-bottom: 0; }
.xfer-arrow {
  font-family: var(--font-mono);
  color: var(--accent);
  font-size: 16px;
  font-weight: 500;
  text-align: center;
}
.xfer-route {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink);
  letter-spacing: -0.005em;
  min-width: 0;
}
.xfer-route .xfer-from,
.xfer-route .xfer-to {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xfer-sep {
  color: var(--ink-3);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.xfer-amt {
  font: 500 13px/1 var(--font-sans);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.xfer-date {
  font: 400 11px/1 var(--font-mono);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 760px) {
  .xfer-row { grid-template-columns: 22px 1fr auto; }
  .xfer-date { display: none; }
}

.dash-empty {
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.dash-empty-lead {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--ink-2);
  line-height: 1.5;
}

/* Header sub-aside — info de filtre membre (compteur "X filtrés sur") */
.dash-sub-aside {
  color: var(--ink-3);
  font-size: 0.95em;
}

/* Hero split — état partiel (que des dettes ou que des actifs) */
.hero-split {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 4px;
  padding-top: 4px;
}
.hero-split-cell {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
}
.hero-split-label {
  font: 500 9.5px/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.hero-split-val {
  font: 500 14px/1 var(--font-sans);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.hero-split-minus {
  font: 500 16px/1 var(--font-mono);
  color: var(--ink-3);
  align-self: flex-end;
  padding-bottom: 1px;
}

/* Hero banner éditorial — quand l'état est partiel */
.hero-banner {
  margin: 14px -28px 0;
  padding: 12px 28px;
  background: var(--accent-soft);
  border-top: 1px solid var(--accent-line);
  border-bottom: 1px solid var(--accent-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.hero-banner-lead {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13.5px;
  color: var(--accent-2);
  line-height: 1.4;
  flex: 1;
  min-width: 240px;
}
.hero-banner .link-btn {
  color: var(--accent-2);
  font-weight: 500;
  white-space: nowrap;
}

.kpi-strip {
  display: grid; grid-template-columns: repeat(3, 1fr);
  margin: 0 -28px;
  border-top: 1px solid var(--border);
}
.kpi-cell { padding: 16px 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
.kpi-cell:last-child { border-right: none; }
.kpi-val { font-size: 22px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.kpi-sub { font: 400 11px/1.3 'Geist', system-ui, sans-serif; font-style: italic; color: var(--ink-3); margin-top: -2px; }
.kpi-delta { font-size: 11px; }
.kpi-delta.pos { color: var(--positive); }
.kpi-delta.neg { color: var(--negative); }

/* Allocation card */
.alloc-card { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 24px; display: flex; flex-direction: column; gap: 18px; }
.alloc-head { display: flex; justify-content: space-between; align-items: baseline; }
.alloc-body { display: flex; gap: 18px; align-items: center; }
.alloc-list { list-style: none; margin: 0; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.alloc-list li { display: grid; grid-template-columns: 10px 1fr auto auto; gap: 8px; align-items: center; }
.alloc-list .swatch { width: 8px; height: 8px; border-radius: 2px; }
.alloc-list .alloc-name { font-size: 13px; color: var(--ink); }
.alloc-list .alloc-val { font-size: 13px; color: var(--ink-2); font-weight: 500; }
.alloc-list .alloc-pct { font-size: 11px; color: var(--ink-3); min-width: 38px; text-align: right; }

/* Accounts panel */
.accounts-panel { margin-top: 0; }
.accounts-cols {
  display: grid;
  grid-template-columns: 1.7fr 1fr 1fr 0.8fr 0.9fr 30px;
  padding: 10px 20px;
  background: var(--bg-sunk);
  gap: 12px;
}
.accounts-rows { display: flex; flex-direction: column; }
.account-row {
  display: grid;
  grid-template-columns: 1.7fr 1fr 1fr 0.8fr 0.9fr 30px;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: transparent;
  border-left: none; border-right: none; border-bottom: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast);
  font-family: inherit;
}
.account-row:hover { background: var(--bg-hover); }
.account-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
.account-name { min-width: 0; }
.account-name .line1 { font-size: 13px; font-weight: 500; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-name .line2 { font-size: 11px; color: var(--ink-3); }

/* Bottom row */
/* dash-bottom-row : 2026-05-21 refonte ciblee — Insights cache, Transactions
   prend toute la largeur (12 cols). Anciennement 2fr/1fr quand Insights
   etait visible a droite. */
.dash-bottom-row { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (max-width: 1024px) { .dash-bottom-row { grid-template-columns: 1fr; } }
.dash-side-stack { display: flex; flex-direction: column; gap: 16px; }

/* Transactions list */
.tx-list { padding: 0; }
.tx-day { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: var(--bg); color: var(--ink-3); }
.tx-row { display: grid; grid-template-columns: 32px minmax(0,1fr) auto; gap: 12px; align-items: center; padding: 10px 20px; border-top: 1px solid var(--border); transition: background var(--t-fast); }
.tx-row:hover { background: var(--bg-hover); }
.tx-mid { min-width: 0; overflow: hidden; }
.tx-label { font-size: 13.5px; font-weight: 500; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; font-size: 11px; color: var(--ink-3); overflow: hidden; }
.tx-meta > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tx-amount { font-size: 14px; font-weight: 500; flex-shrink: 0; white-space: nowrap; }

/* Budget panel */
.budget-list { padding: 4px 8px 12px; }
.budget-item { padding: 12px 12px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 6px; transition: background var(--t-fast); }
.budget-item:hover { background: var(--bg-hover); }
.budget-line1 { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink); }
.budget-bar { height: 6px; border-radius: 3px; background: var(--bg-sunk); overflow: hidden; }
.budget-fill { height: 100%; border-radius: 3px; transition: width var(--t-med); }
.budget-line3 { display: flex; justify-content: space-between; font-size: 11px; }

/* Insights */
.insights-list { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.insight { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border); transition: border-color var(--t-fast); }
.insight:hover { border-color: var(--border-strong); }
.insight-icon { width: 28px; height: 28px; border-radius: var(--radius-md); background: var(--neutral-soft); color: var(--ink-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.insight.pos .insight-icon { background: var(--positive-soft); color: var(--positive); }
.insight.neg .insight-icon { background: var(--negative-soft); color: var(--negative); }
.insight-title { font-size: 13px; font-weight: 500; color: var(--ink); }
.insight-body { font-size: 12px; color: var(--ink-2); line-height: 1.45; margin-top: 2px; }

/* ── MiniCashflowCard (sprint Dashboard 2026-05-20) ─────────────────── */
.mcc-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mcc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mcc-title { margin: 6px 0 0; font: 500 18px/1.2 var(--font-sans); letter-spacing: -0.02em; color: var(--ink); }
.mcc-title em { font: italic 400 18px var(--font-serif); color: var(--accent); letter-spacing: -0.025em; }
.mcc-link { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.mcc-rows { display: flex; flex-direction: column; gap: 10px; }
.mcc-row {
  display: grid;
  grid-template-columns: 96px 1fr 110px;
  align-items: center;
  gap: 12px;
}
.mcc-row-label { display: inline-flex; align-items: center; gap: 6px; font: 500 12.5px var(--font-sans); color: var(--ink-2); }
.mcc-row-ic {
  width: 18px; height: 18px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mcc-row-ic.tone-positive { background: color-mix(in oklab, var(--positive) 14%, transparent); color: var(--positive); }
.mcc-row-ic.tone-negative { background: color-mix(in oklab, var(--negative) 12%, transparent); color: var(--negative); }
.mcc-row-ic.tone-accent   { background: var(--accent-soft); color: var(--accent); }
.mcc-bar-track {
  height: 8px;
  background: var(--bg-sunk);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}
.mcc-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: none; /* GSAP gere la transition */
}
.mcc-bar-fill.tone-positive { background: linear-gradient(90deg, color-mix(in oklab, var(--positive) 70%, transparent), var(--positive)); }
.mcc-bar-fill.tone-negative { background: linear-gradient(90deg, color-mix(in oklab, var(--negative) 70%, transparent), var(--negative)); }
.mcc-bar-fill.tone-accent   { background: linear-gradient(90deg, var(--accent-soft), var(--accent)); }
.mcc-row-val { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13px; }
.mcc-row-val.tone-positive { color: var(--positive); }
.mcc-row-val.tone-negative { color: var(--negative); }
.mcc-row-val.tone-accent   { color: var(--accent); }

@media (max-width: 640px) {
  .mcc-card { padding: 14px 14px 16px; }
  .mcc-title { font-size: 16px; }
  .mcc-title em { font-size: 16px; }
  .mcc-row { grid-template-columns: 78px 1fr 88px; gap: 8px; }
  .mcc-row-label { font-size: 11.5px; }
  .mcc-row-val { font-size: 12px; }
}

/* ── Hero sparkline (option d) — petite courbe 6m dans le hero ─────── */
.hero-sparkline-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dotted var(--border);
}
.hero-sparkline-label {
  font: 500 11px var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.hero-sparkline-svg { flex: 1; min-width: 0; }

/* Mobile */
@media (max-width: 768px) {
  .dash-v3 { padding: 16px; gap: 12px; }
  .kpi-strip { grid-template-columns: repeat(2, 1fr); }
  .kpi-cell:nth-child(2) { border-right: none; }
  .accounts-cols, .account-row { grid-template-columns: 1.4fr 1fr 30px; }
  .accounts-cols > div:nth-child(3),
  .accounts-cols > div:nth-child(4),
  .accounts-cols > div:nth-child(5),
  .account-row > :nth-child(3),
  .account-row > :nth-child(4),
  .account-row > :nth-child(5) { display: none; }

  /* Hero card: period tabs wrap below the eyebrow instead of overflowing */
  .hero-top { flex-wrap: wrap; gap: 8px; align-items: center; }
  /* Reduce period button size to fit all 6 in one row on wrap */
  .hero-top .ds-range-tabs button { padding: 0 7px; font-size: 11px; height: 24px; }
  /* Eyebrow takes full width so tabs start on next line */
  .hero-top .dash-eyebrow { flex: 1 1 100%; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
