// ============================================================================
// Wealth — assets + liabilities, with sub-view filter, allocation donut,
// detail editors and the wealth-history chart.
// ============================================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from '../utils/gsapSetup.js';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area,
} from 'recharts';
import {
  Plus, Wallet, BarChart3, Bitcoin, TrendingUp, TrendingDown, CreditCard, Home, Sparkles, PiggyBank, ChevronRight,
} from 'lucide-react';
import { ASSET_CLASS_MAP } from '../constants.js';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';
import { wideThousands } from '../utils.js';
import { NetWorthChart } from '../components/NetWorthChart.jsx';
import { useWealthItems } from '../hooks/useWealthItems.js';
import { WealthItemDrawer } from '../components/WealthItemDrawer.jsx';
import { ImportPositionsModal } from '../components/ImportPositionsModal.jsx';
import { portfolioValueAfterImport } from '../utils/positionsImport.js';
import * as api from '../api.js';
// Sub-components — extracted from Wealth.jsx during découpe
import { CompletePatrimoinePicker } from './wealth/components/CompletePatrimoinePicker.jsx';
import { WealthItemRow } from './wealth/components/WealthItemRow.jsx';
import { WealthCategoryCard } from './wealth/components/WealthCategoryCard.jsx';
import { AssetEditor } from './wealth/editors/AssetEditor.jsx';
import { LiabilityEditor } from './wealth/editors/LiabilityEditor.jsx';
import { LiabilityDetail } from './wealth/details/LiabilityDetail.jsx';
import { RealEstateDetail } from './wealth/details/RealEstateDetail.jsx';
import { LiquidityDetail } from './wealth/details/LiquidityDetail.jsx';
import { InvestmentDetail } from './wealth/details/InvestmentDetail.jsx';
import { CryptoDetail } from './wealth/details/CryptoDetail.jsx';
import { OtherAssetDetail } from './wealth/details/OtherAssetDetail.jsx';

// ============================================================================
// WEALTH (Assets + Liabilities)
// ============================================================================
// v6 unified subviews — driven by the canonical WealthCategory taxonomy
// (types/wealth.js). 'all' shows everything; the others filter by category.
const WEALTH_SUBVIEWS = [
  { key: 'all',             labelKey: 'wealth.subnav.all',             categories: null,                  icon: BarChart3 },
  { key: 'liquidites',      labelKey: 'wealth.subnav.liquidites',      categories: ['liquidites'],        icon: Wallet },
  { key: 'investissements', labelKey: 'wealth.subnav.investissements', categories: ['investissements'],   icon: TrendingUp },
  { key: 'immobilier',      labelKey: 'wealth.subnav.immobilier',      categories: ['immobilier'],        icon: Home },
  { key: 'cryptos',         labelKey: 'wealth.subnav.cryptos',         categories: ['cryptos'],           icon: Bitcoin },
  { key: 'autres',          labelKey: 'wealth.subnav.autres',          categories: ['autres'],            icon: Sparkles },
  { key: 'emprunts',        labelKey: 'wealth.subnav.emprunts',        categories: ['emprunts'],          icon: CreditCard },
];

// Mapping subtype canonique (AddWealthModal) → type/subtype attendus par les
// éditeurs canoniques. Reflète api.js _resolveBackendType pour rester cohérent.
const SUBTYPE_TO_EDITOR = {
  // emprunts → LiabilityEditor avec le bon type
  mortgage:      { kind: 'liability', type: 'mortgage' },
  consumer_loan: { kind: 'liability', type: 'consumer_loan' },
  auto_loan:     { kind: 'liability', type: 'auto_loan' },
  other_loan:    { kind: 'liability', type: 'other_loan' },
  // immobilier → RealEstateEditor (type=real_estate)
  rp:      { kind: 'asset', type: 'real_estate', subtype: 'RP' },
  locatif: { kind: 'asset', type: 'real_estate', subtype: 'locative' },
  scpi:    { kind: 'asset', type: 'real_estate', subtype: 'scpi' },
  // investissements → SimpleAssetEditor avec le bon type
  pea:     { kind: 'asset', type: 'pea' },
  cto:     { kind: 'asset', type: 'stocks' },
  av:      { kind: 'asset', type: 'life_insurance' },
  per:     { kind: 'asset', type: 'per' },
  // liquidités manuelles → other_asset (compte_courant manuel) ou savings_account
  livret:         { kind: 'asset', type: 'savings_account' },
  cash:           { kind: 'asset', type: 'other_asset' },
  compte_courant: { kind: 'asset', type: 'other_asset' },
  // cryptos / autres
  crypto: { kind: 'asset', type: 'crypto' },
  or:     { kind: 'asset', type: 'other_asset' },
  autre:  { kind: 'asset', type: 'other_asset' },
};

export function Wealth({ assets, liabilities, members, activeMemberId, visibleAssets, visibleLiabilities, saveAsset, deleteAsset, saveLiability, deleteLiability, memberShare, fmt, wealthHistory = [], accounts = [], accountBalances = {}, transactions = [], liquidWealth = 0, onOpenAddWizard, reload, seededNewItem, onSeededConsumed }) {
  const { t } = useTranslation();
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingLia, setEditingLia] = useState(null);
  const [viewingLia, setViewingLia] = useState(null);
  const [viewingRE, setViewingRE] = useState(null);
  const [viewingLiq, setViewingLiq] = useState(null);
  const [viewingInv, setViewingInv] = useState(null);
  const [viewingCrypto, setViewingCrypto] = useState(null);
  const [viewingOther, setViewingOther] = useState(null);
  const [subview, setSubview] = useState('all');
  const [showAddPicker, setShowAddPicker] = useState(false);

  // GSAP page-enter stagger (sprint 2026-05-20) — fade-in cascade des
  // sections principales : hero + alloc + grid cards categorie + items.
  // Donne du rythme visuel a chaque arrivee sur Patrimoine.
  const wealthRef = useRef(null);
  useEffect(() => {
    if (!wealthRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ['.wealth-hero', '.wealth-alloc-mini', '.wc-card'],
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out', stagger: 0.05, clearProps: 'transform' }
      );
    }, wealthRef);
    return () => ctx.revert();
  }, [subview]);

  // Quand le wizard "+ Ajouter" termine en mode manuel, YotoriApp passe
  // ici { category, subtype } via seededNewItem. On ouvre alors l'éditeur
  // canonique correspondant avec un objet blanc préfixé (type + subtype).
  useEffect(() => {
    if (!seededNewItem) return;
    const mapping = SUBTYPE_TO_EDITOR[seededNewItem.subtype];
    if (!mapping) {
      onSeededConsumed && onSeededConsumed();
      return;
    }
    const baseMembers = activeMemberId !== 'all' ? [activeMemberId] : [];
    if (mapping.kind === 'liability') {
      setEditingLia({
        id: null, type: mapping.type, name: '',
        initialCapital: '', remainingCapital: '', monthlyPayment: '',
        interestRate: '', endDate: '', memberIds: baseMembers, notes: '',
        downPayment: '', insuranceRate: '', applicationFees: '',
        ownershipPct: 100, durationMonths: '', startDate: '', linkedAssetId: '',
        currency: 'EUR',
      });
    } else {
      setEditingAsset({
        id: null, type: mapping.type,
        ...(mapping.subtype ? { subtype: mapping.subtype } : {}),
        name: '', currentValue: 0, memberIds: baseMembers, notes: '',
        currency: 'EUR', updatedAt: new Date().toISOString(),
      });
    }
    onSeededConsumed && onSeededConsumed();
  }, [seededNewItem, activeMemberId, onSeededConsumed]);
  const [drawerItem, setDrawerItem] = useState(null);
  const [importingTo, setImportingTo] = useState(null);

  // Unified WealthItem stream — accounts + assets + liabilities normalised
  const allItems = useWealthItems({ accounts, assets, liabilities, accountBalances });
  const visibleItems = useMemo(() => (
    activeMemberId === 'all'
      ? allItems
      : allItems.filter(i => i.memberIds.includes(activeMemberId))
  ), [allItems, activeMemberId]);

  // Valeur brute des comptes bancaires visibles. On la calcule depuis le flux unifié
  // pour garder la même convention « valeur complète du bien/compte » que les
  // lignes de cette page, y compris lorsqu'un membre du foyer est filtré. Les
  // actifs liquides manuels (Livret, cash…) restent dans totalAssets : ne pas
  // les reprendre ici, sinon ils seraient comptés deux fois.
  const visibleLiquidTotal = useMemo(() => visibleItems
    .filter(i => i.category === 'liquidites' && i.sourceTable === 'account')
    .reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0), [visibleItems]);

  const currentSub = WEALTH_SUBVIEWS.find(s => s.key === subview) || WEALTH_SUBVIEWS[0];
  const isAll = subview === 'all';
  const isLiabilitiesOnly = subview === 'emprunts';

  const filteredItems = useMemo(() => (
    currentSub.categories === null
      ? visibleItems
      : visibleItems.filter(i => currentSub.categories.includes(i.category))
  ), [visibleItems, currentSub.categories]);

  // Bug fix 2026-05-19 (user signalé) : avant, le header total appliquait
  // memberShare mais les rows individuels affichaient la valeur full →
  // incohérence x2 (ex: header 339k€ vs rows 678k€). Décision UX :
  // → afficher la valeur **full du foyer** partout dans le listing Wealth
  //   (les biens joints sont des biens réels du foyer, pas une fraction)
  // → memberShare ne s'applique QU'au Patrimoine net Total Dashboard,
  //   pour le calcul d'équité personnelle d'un membre filtré.
  const subviewTotal = filteredItems
    .filter(i => i.sourceTable !== 'liability')
    .reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
  const subviewLiabTotal = filteredItems
    .filter(i => i.sourceTable === 'liability')
    .reduce((s, i) => s + (parseFloat(i.value) || 0), 0);

  // Convention de calcul Wealth (bug fix 2026-05-19) — TOUS les calculs
  // affichés dans cette vue utilisent la valeur **full** du foyer.
  // Rationale : un bien immo joint vaut sa valeur réelle (1.5M€), pas la
  // moitié (750k€) — Yotori Finance Wealth = inventaire des biens du foyer.
  // Le memberShare s'applique uniquement au "Patrimoine net total" du
  // Dashboard pour les calculs d'équité d'un membre adulte filtré.
  const totalAssets = visibleAssets.reduce((s, a) => s + (parseFloat(a.currentValue) || 0), 0);
  const totalLiabilities = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.remainingCapital) || 0), 0);
  const grossAssetsTotal = visibleLiquidTotal + totalAssets;
  const netWealthTotal = grossAssetsTotal - totalLiabilities;

  // Patrimoine financier : exclut immobilier + prêts immo
  const realEstateValue = visibleAssets.filter(a => a.type === 'real_estate')
    .reduce((s, a) => s + (parseFloat(a.currentValue) || 0), 0);
  const mortgageDebt = visibleLiabilities.filter(l => l.type === 'mortgage')
    .reduce((s, l) => s + (parseFloat(l.remainingCapital) || 0), 0);
  const financialWealthLocal = visibleLiquidTotal + (totalAssets - realEstateValue) - (totalLiabilities - mortgageDebt);
  // Patrimoine immo net = valorisation residence - emprunt residence
  const realEstateNetWealth = realEstateValue - mortgageDebt;

  // Series mensuelles pour les sparklines des hero cards
  const sparkSeries = useMemo(() => {
    const sorted = [...(wealthHistory || [])].sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    const last12 = sorted.slice(-12);
    const fin = last12.map(s => {
      const liquid = s.liquid_wealth || 0;
      const assets = s.assets_value || 0;
      const liab = s.liabilities_value || 0;
      const re = s.real_estate_value;
      const f = s.financial_assets_value;
      const mort = s.mortgage_debt;
      const otherDebt = s.other_debt != null ? s.other_debt : (mort == null ? 0 : Math.max(0, liab - mort));
      const finVal = f != null ? f : (liquid + Math.max(0, assets - (re || 0)));
      return { month: s.month, value: finVal - otherDebt };
    });
    const immo = last12.map(s => {
      const re = s.real_estate_value || 0;
      const mort = s.mortgage_debt || 0;
      return { month: s.month, value: re - mort };
    });
    return { fin, immo };
  }, [wealthHistory]);

  // Modal detail categorie (popup quand on clique sur le header d'une category card)
  const [openCategoryModal, setOpenCategoryModal] = useState(null); // catKey | null

  // Asset class allocation for donut chart
  const classAllocation = useMemo(() => {
    const classes = {};
    if (visibleLiquidTotal > 0) {
      classes.Liquidités = { value: visibleLiquidTotal, color: 'var(--d2)' };
    }
    visibleAssets.forEach(a => {
      const cls = ASSET_CLASS_MAP[a.type]?.class || 'Divers';
      const color = ASSET_CLASS_MAP[a.type]?.color || '#6b7280';
      const val = (parseFloat(a.currentValue) || 0);
      if (!classes[cls]) classes[cls] = { value: 0, color };
      classes[cls].value += val;
    });
    return Object.entries(classes).filter(([, d]) => d.value > 0)
      .map(([name, d]) => ({ name, value: d.value, color: d.color, pct: grossAssetsTotal > 0 ? (d.value / grossAssetsTotal) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [visibleAssets, visibleLiquidTotal, grossAssetsTotal]);

  // Private wealth KPIs
  const debtRatioWealth = grossAssetsTotal > 0 ? (totalLiabilities / grossAssetsTotal) * 100 : null;
  const totalMonthlyDebt = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0), 0);
  const iliquidAssets = visibleAssets.filter(a => ['real_estate'].includes(a.type))
    .reduce((s, a) => s + (parseFloat(a.currentValue) || 0), 0);
  const illiquidRatio = grossAssetsTotal > 0 ? (iliquidAssets / grossAssetsTotal) * 100 : null;
  const activeMemberName = activeMemberId !== 'all' ? members.find(m => m.id === activeMemberId)?.name : null;

  return (
    <div className="wealth-view" ref={wealthRef}>
      <div className="subview-header">
        <div>
          <h1>{t('views.wealth.title')} <em>{t('views.wealth.titleAccent')}</em></h1>
          <p>{t('views.wealth.subtitle')}</p>
        </div>
        <button className="ds-btn primary" onClick={() => (onOpenAddWizard ? onOpenAddWizard() : setShowAddPicker(true))}><Plus size={14}/> Ajouter au patrimoine</button>
      </div>

      {isAll && (
        <section className="wealth-net-summary" aria-label="Calcul du patrimoine net">
          <div className="wealth-net-main">
            <span className="wealth-net-kicker">{activeMemberName ? `Patrimoine lié à ${activeMemberName}` : 'Patrimoine net du foyer'}</span>
            <div className={`wealth-net-value num ${netWealthTotal < 0 ? 'negative' : ''}`}>
              <AnimatedNumber value={netWealthTotal} format={(v) => wideThousands(fmt(v))}/>
            </div>
            <p>La valeur de tout ce que vous possédez, après déduction des emprunts restants.</p>
          </div>
          <div className="wealth-net-formula">
            <div className="wealth-net-term is-positive">
              <span>Ce que vous possédez</span>
              <strong className="num">{fmt(grossAssetsTotal)}</strong>
              <small>Comptes, placements et biens</small>
            </div>
            <span className="wealth-net-operator" aria-hidden="true">−</span>
            <div className="wealth-net-term is-negative">
              <span>Ce que vous devez</span>
              <strong className="num">{fmt(totalLiabilities)}</strong>
              <small>Capital restant des emprunts</small>
            </div>
            <span className="wealth-net-operator" aria-hidden="true">=</span>
            <div className="wealth-net-term is-result">
              <span>Patrimoine net</span>
              <strong className="num">{fmt(netWealthTotal)}</strong>
              <small>Votre valeur patrimoniale réelle</small>
            </div>
          </div>
        </section>
      )}


      {/* HERO 2 cards + grid de categories — placement TOP pour visibilite immediate */}
      {isAll && (
        <section className="wealth-hero">
          <button
            type="button"
            className="wealth-hero-card wealth-hero-card--financial"
            onClick={() => setOpenCategoryModal('chart-fin')}
            title="Voir l'évolution complète"
          >
            <div className="wealth-hero-eyebrow">
              <PiggyBank size={12}/>
              <span>Patrimoine financier</span>
            </div>
            <div className="wealth-hero-row">
              <div className="wealth-hero-value-block">
                <div className="wealth-hero-value num">
                  <AnimatedNumber value={financialWealthLocal} format={(v) => wideThousands(fmt(v))}/>
                </div>
                <div className="wealth-hero-meta">
                  Liquidités, investissements, cryptos · hors immobilier
                </div>
              </div>
              {sparkSeries.fin.length >= 2 && (
                <div className="wealth-hero-spark">
                  <ResponsiveContainer width="100%" height={56}>
                    <AreaChart data={sparkSeries.fin} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sparkFinGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35}/>
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={1.8} fill="url(#sparkFinGrad)" dot={false} isAnimationActive={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="wealth-hero-spark-hint">12 derniers mois ↗</div>
                </div>
              )}
            </div>
            <div className="wealth-hero-breakdown">
              <span><span className="wh-dot" style={{ background: 'var(--d2)' }}/> Liquidités <strong className="num">{fmt(visibleLiquidTotal)}</strong></span>
              {(totalAssets - realEstateValue) > 0 && (
                <span><span className="wh-dot" style={{ background: 'var(--d1)' }}/> Invest. + crypto <strong className="num">{fmt(totalAssets - realEstateValue)}</strong></span>
              )}
              {(totalLiabilities - mortgageDebt) > 0 && (
                <span><span className="wh-dot" style={{ background: 'var(--negative)' }}/> Conso/auto <strong className="num">−{fmt(totalLiabilities - mortgageDebt)}</strong></span>
              )}
            </div>
          </button>
          <button
            type="button"
            className="wealth-hero-card wealth-hero-card--realestate"
            onClick={() => setOpenCategoryModal('chart-immo')}
            title="Voir l'évolution complète"
          >
            <div className="wealth-hero-eyebrow">
              <Home size={12}/>
              <span>Patrimoine immobilier net</span>
            </div>
            <div className="wealth-hero-row">
              <div className="wealth-hero-value-block">
                <div className={`wealth-hero-value num ${realEstateNetWealth < 0 ? 'neg' : ''}`}>
                  <AnimatedNumber value={realEstateNetWealth} format={(v) => wideThousands(fmt(v))}/>
                </div>
                <div className="wealth-hero-meta">
                  Valorisation résidence − emprunt résidence
                </div>
              </div>
              {sparkSeries.immo.length >= 2 && realEstateValue > 0 && (
                <div className="wealth-hero-spark">
                  <ResponsiveContainer width="100%" height={56}>
                    <AreaChart data={sparkSeries.immo} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sparkImmoGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--d3)" stopOpacity={0.35}/>
                          <stop offset="100%" stopColor="var(--d3)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke="var(--d3)" strokeWidth={1.8} fill="url(#sparkImmoGrad)" dot={false} isAnimationActive={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="wealth-hero-spark-hint">12 derniers mois</div>
                </div>
              )}
            </div>
            <div className="wealth-hero-breakdown">
              {realEstateValue > 0 && (
                <span><span className="wh-dot" style={{ background: 'var(--d3)' }}/> Valorisation <strong className="num">{fmt(realEstateValue)}</strong></span>
              )}
              {mortgageDebt > 0 && (
                <span><span className="wh-dot" style={{ background: 'var(--negative)' }}/> Emprunt <strong className="num">−{fmt(mortgageDebt)}</strong></span>
              )}
              {realEstateValue === 0 && (
                <span className="wealth-hero-empty">Pas encore de bien immobilier</span>
              )}
            </div>
          </button>
        </section>
      )}

      {/* Allocation mini — barre empilée (charte Forêt : barres > camemberts),
          click pour la vue détaillée. */}
      {isAll && classAllocation.length > 0 && (
        <button
          type="button"
          className="wealth-alloc-mini wealth-alloc-mini--bar"
          onClick={() => setOpenCategoryModal('chart-alloc')}
          title="Voir l'allocation détaillée"
        >
          <div className="wealth-alloc-mini-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="wealth-alloc-mini-label">Allocation par classe d'actif</div>
            <div
              role="img"
              aria-label="Répartition du patrimoine par classe d'actif"
              style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, background: 'var(--bg-sunk)', margin: '8px 0 10px' }}
            >
              {classAllocation.map((c, i) => (
                <span key={i} title={`${c.name} · ${c.pct.toFixed(0)} %`} style={{ width: `${c.pct}%`, background: c.color, minWidth: c.pct > 0 ? 3 : 0 }}/>
              ))}
            </div>
            <div className="wealth-alloc-mini-legend">
              {classAllocation.slice(0, 4).map((c, i) => (
                <span key={i} className="wealth-alloc-mini-chip">
                  <span className="wealth-alloc-mini-dot" style={{ background: c.color }}/>
                  {c.name} <strong>{c.pct.toFixed(0)}{' '}%</strong>
                </span>
              ))}
              {classAllocation.length > 4 && (
                <span className="wealth-alloc-mini-more">+{classAllocation.length - 4}</span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="wealth-alloc-mini-chev"/>
        </button>
      )}

      {/* Grid de cards par categorie — apres hero, AVANT chart/kpis */}
      {isAll && (() => {
        const handleItemClick = (it) => {
          if (it.sourceTable === 'liability') {
            const l = liabilities.find(x => x.id === it.sourceId);
            if (l) { setViewingLia(l); return; }
          }
          if (it.sourceTable === 'asset') {
            const a = assets.find(x => x.id === it.sourceId);
            if (a) {
              if (it.category === 'immobilier')      { setViewingRE(a); return; }
              if (it.category === 'liquidites')      { setViewingLiq({ ...a, _item: it, isAccount: false }); return; }
              if (it.category === 'investissements') { setViewingInv(a); return; }
              if (it.category === 'cryptos')         { setViewingCrypto(a); return; }
              if (it.category === 'autres')          { setViewingOther(a); return; }
            }
          }
          if (it.sourceTable === 'account') {
            setViewingLiq({ ...it, isAccount: true });
            return;
          }
          setDrawerItem(it);
        };
        const handleItemDelete = (it) => {
          if (it.sourceTable === 'asset')     deleteAsset(it.sourceId);
          if (it.sourceTable === 'liability') deleteLiability(it.sourceId);
        };
        const handleAdd = () => (onOpenAddWizard ? onOpenAddWizard() : setShowAddPicker(true));
        const CATEGORIES_ORDER = ['liquidites', 'investissements', 'immobilier', 'cryptos', 'autres', 'emprunts'];
        return (
          <div className="wealth-cards-grid">
            {CATEGORIES_ORDER.map(catKey => {
              const items = visibleItems.filter(i => i.category === catKey);
              const total = items.reduce((s, i) => s + Math.abs(parseFloat(i.value) || 0), 0);
              return (
                <WealthCategoryCard
                  key={catKey}
                  category={catKey}
                  items={items}
                  total={total}
                  grossAssetsTotal={grossAssetsTotal}
                  fmt={fmt}
                  onItemClick={handleItemClick}
                  onItemDelete={handleItemDelete}
                  onAdd={handleAdd}
                  onHeaderClick={(k) => setOpenCategoryModal(k)}
                />
              );
            })}
          </div>
        );
      })()}

      {/* Subview header (when not 'all') */}
      {!isAll && (() => {
        const SubIcon = currentSub.icon || BarChart3;
        return (
          <section className="card subview-hero">
            <div className="subview-hero-icon-wrap">
              <SubIcon size={22}/>
            </div>
            <div className="subview-hero-info">
              <div className="subview-hero-label">{t(currentSub.labelKey)}</div>
              <div className="subview-hero-value">
                <AnimatedNumber value={isLiabilitiesOnly ? subviewLiabTotal : subviewTotal} format={(v) => fmt(v)}/>
              </div>
              <div className="subview-hero-meta">
                {isLiabilitiesOnly
                  ? `${filteredItems.length} prêt${filteredItems.length > 1 ? 's' : ''} · ${fmt(visibleLiabilities.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0), 0))} / mois`
                  : `${filteredItems.length} actif${filteredItems.length > 1 ? 's' : ''} · ${totalAssets > 0 ? ((subviewTotal / totalAssets) * 100).toFixed(0) : 0}% du patrimoine`}
              </div>
            </div>
          </section>
        );
      })()}



      {/* Filtre actif : single liste detaillee (le WealthItemRow refondu) */}
      {!isAll && (() => {
        const handleItemClick = (it) => {
          if (it.sourceTable === 'liability') {
            const l = liabilities.find(x => x.id === it.sourceId);
            if (l) { setViewingLia(l); return; }
          }
          if (it.sourceTable === 'asset') {
            const a = assets.find(x => x.id === it.sourceId);
            if (a) {
              if (it.category === 'immobilier')      { setViewingRE(a); return; }
              if (it.category === 'liquidites')      { setViewingLiq({ ...a, _item: it, isAccount: false }); return; }
              if (it.category === 'investissements') { setViewingInv(a); return; }
              if (it.category === 'cryptos')         { setViewingCrypto(a); return; }
              if (it.category === 'autres')          { setViewingOther(a); return; }
            }
          }
          if (it.sourceTable === 'account') {
            setViewingLiq({ ...it, isAccount: true });
            return;
          }
          setDrawerItem(it);
        };
        const handleItemDelete = (it) => {
          if (it.sourceTable === 'asset')     deleteAsset(it.sourceId);
          if (it.sourceTable === 'liability') deleteLiability(it.sourceId);
        };
        const handleAdd = () => (onOpenAddWizard ? onOpenAddWizard() : setShowAddPicker(true));
        return (
          <section className="card">
            <div className="card-header">
              <h3><Wallet size={16}/> {t(currentSub.labelKey)}</h3>
            </div>
            {filteredItems.length === 0 ? (
              <div className="wealth-empty-state">
                <p style={{ fontFamily: 'Geist, system-ui, sans-serif', fontStyle: 'italic', color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.5 }}>
                  {t('wealth.emptyCategory', { category: t(currentSub.labelKey).toLowerCase() })}
                </p>
                <button className="ds-btn primary" onClick={handleAdd}>
                  <Plus size={14}/> Ajouter
                </button>
              </div>
            ) : (
              <div className="wealth-items-list">
                {filteredItems.map(item => (
                  <WealthItemRow
                    key={item.id}
                    item={item}
                    fmt={fmt}
                    onDelete={handleItemDelete}
                    onClick={handleItemClick}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {openCategoryModal && (
        <CategoryDetailModal
          categoryKey={openCategoryModal}
          items={
            // Bug fix 2026-05-21 : avant le mode 'chart-immo' passait [] -> modale
            // vide (ecran noir presque) si on n'avait pas >=2 points wealth
            // history. Maintenant on passe les biens + emprunts immo pour avoir
            // toujours du contenu utile en dessous du chart.
            openCategoryModal === 'chart-immo'
              ? visibleItems.filter(i => i.category === 'immobilier' || i.category === 'emprunts')
              : openCategoryModal === 'chart-fin'
              ? visibleItems.filter(i => i.category !== 'immobilier' && i.category !== 'emprunts')
              : openCategoryModal.startsWith('chart-')
              ? []
              : visibleItems.filter(i => i.category === openCategoryModal)
          }
          wealthHistory={wealthHistory}
          sparkSeries={sparkSeries}
          financialWealthLocal={financialWealthLocal}
          realEstateNetWealth={realEstateNetWealth}
          classAllocation={classAllocation}
          totalAssets={totalAssets}
          fmt={fmt}
          onClose={() => setOpenCategoryModal(null)}
          onItemClick={(it) => {
            setOpenCategoryModal(null);
            // Reuse the same item click logic via setTimeout pour laisser le modal se fermer
            setTimeout(() => {
              if (it.sourceTable === 'liability') {
                const l = liabilities.find(x => x.id === it.sourceId);
                if (l) { setViewingLia(l); return; }
              }
              if (it.sourceTable === 'asset') {
                const a = assets.find(x => x.id === it.sourceId);
                if (a) {
                  if (it.category === 'immobilier')      { setViewingRE(a); return; }
                  if (it.category === 'liquidites')      { setViewingLiq({ ...a, _item: it, isAccount: false }); return; }
                  if (it.category === 'investissements') { setViewingInv(a); return; }
                  if (it.category === 'cryptos')         { setViewingCrypto(a); return; }
                  if (it.category === 'autres')          { setViewingOther(a); return; }
                }
              }
              if (it.sourceTable === 'account') { setViewingLiq({ ...it, isAccount: true }); return; }
              setDrawerItem(it);
            }, 50);
          }}
        />
      )}
      {editingAsset && <AssetEditor asset={editingAsset} members={members} liabilities={visibleLiabilities} onSave={async (a) => {
        const wasNew = !a.id;
        const saved = await saveAsset(a);
        if (!saved) throw new Error("L'actif n'a pas pu être enregistré.");
        setEditingAsset(null);
        if (wasNew && saved?.id && ['pea', 'stocks', 'life_insurance', 'per'].includes(saved.type || a.type)) {
          setImportingTo({
            sourceId: saved.id,
            currency: saved.currency || a.currency || 'EUR',
            memberIds: saved.memberIds || a.memberIds || [],
            name: saved.name || a.name,
            initialMode: 'choice',
          });
        }
        return saved;
      }} onCancel={() => setEditingAsset(null)}/>}
      {editingLia && <LiabilityEditor liability={editingLia} members={members} assets={assets} onSave={async (l) => {
        const saved = await saveLiability(l);
        if (!saved) throw new Error("L'emprunt n'a pas pu être enregistré.");
        setEditingLia(null);
        return saved;
      }} onCancel={() => setEditingLia(null)}/>}
      {viewingLia && (
        <LiabilityDetail
          liability={viewingLia}
          assets={assets}
          members={members}
          memberShare={memberShare}
          fmt={fmt}
          onEdit={() => { setEditingLia(viewingLia); setViewingLia(null); }}
          onClose={() => setViewingLia(null)}
          onOpenLinkedAsset={(a) => {
            // Ferme le détail de l'emprunt et ouvre le bon popup d'actif
            // selon sa catégorie (immobilier, investissement, crypto, etc.).
            setViewingLia(null);
            if (!a) return;
            if (a.type === 'real_estate') setViewingRE(a);
            else if (['pea', 'stocks', 'life_insurance', 'per'].includes(a.type)) setViewingInv(a);
            else if (a.type === 'crypto') setViewingCrypto(a);
            else if (a.type === 'savings_account') setViewingLiq({ ...a, isAccount: false });
            else setViewingOther(a);
          }}
        />
      )}
      {viewingRE && <RealEstateDetail asset={viewingRE} liabilities={liabilities} members={members} memberShare={memberShare} fmt={fmt} onEdit={() => { setEditingAsset(viewingRE); setViewingRE(null); }} onClose={() => setViewingRE(null)}/>}
      {viewingLiq && (
        <LiquidityDetail
          item={viewingLiq}
          accounts={accounts}
          accountBalances={accountBalances}
          transactions={transactions || []}
          members={members}
          fmt={fmt}
          onEdit={() => {
            if (!viewingLiq.isAccount && viewingLiq.id) {
              setEditingAsset(viewingLiq);
            }
            setViewingLiq(null);
          }}
          onClose={() => setViewingLiq(null)}
        />
      )}
      {viewingInv && (
        <InvestmentDetail
          asset={viewingInv}
          assets={assets}
          members={members}
          fmt={fmt}
          onEdit={() => { setEditingAsset(viewingInv); setViewingInv(null); }}
          onImportCSV={(a, mode = 'choice') => {
            // Convertit l'asset en WealthItem compatible avec ImportPositionsModal
            // (qui attend `sourceId` + `currency` + `memberIds`).
            const item = allItems.find(it => it.sourceTable === 'asset' && it.sourceId === a.id);
            setImportingTo({ ...(item || { sourceId: a.id, currency: a.currency || 'EUR', memberIds: a.memberIds || [], name: a.name }), initialMode: mode });
            setViewingInv(null);
          }}
          onUpdatePosition={async (positionId, patch) => {
            // Inline-edit d'une position depuis la table — pas de popup.
            const pos = assets.find(a => a.id === positionId);
            if (!pos) return;
            const updated = { ...pos };
            // patch peut contenir : quantity, lastPrice, currentValue.
            if (patch.quantity != null) {
              updated.quantity = patch.quantity;
              // Re-dérive currentValue à partir du nouveau qty × ancien cours
              const oldQty = parseFloat(pos.quantity) || 0;
              const oldVal = parseFloat(pos.currentValue) || 0;
              const oldCours = oldQty > 0 ? oldVal / oldQty : 0;
              updated.currentValue = patch.quantity * oldCours;
            }
            if (patch.lastPrice != null) {
              const qty = parseFloat(updated.quantity) || 0;
              updated.currentValue = qty * patch.lastPrice;
            }
            if (patch.currentValue != null) {
              updated.currentValue = patch.currentValue;
            }
            await saveAsset(updated);
          }}
          onSyncPositions={async (parent, rows) => {
            // Push live values into each position's currentValue, then update
            // the parent asset's total to reflect the new positions sum + cash.
            const liveRows = rows.filter(r => r.isLive && Math.abs(r.value - r.saisi) > 0.5);
            for (const r of liveRows) {
              const pos = assets.find(a => a.id === r.id);
              if (pos) await saveAsset({ ...pos, currentValue: Math.round(r.value * 100) / 100 });
            }
            // Update parent currentValue too (= positions live + cash original)
            const newPositionsValue = rows.reduce((s, r) => s + r.value, 0);
            const cashAvailable = Math.max(0, (parseFloat(parent.currentValue) || 0) - rows.reduce((s, r) => s + r.saisi, 0));
            await saveAsset({ ...parent, currentValue: Math.round((newPositionsValue + cashAvailable) * 100) / 100 });
            if (reload) await reload();
          }}
          onClose={() => setViewingInv(null)}
        />
      )}
      {viewingCrypto && (
        <CryptoDetail
          asset={viewingCrypto}
          members={members}
          fmt={fmt}
          onEdit={() => { setEditingAsset(viewingCrypto); setViewingCrypto(null); }}
          onSync={async (a, newValue) => {
            await saveAsset({ ...a, currentValue: newValue });
            setViewingCrypto({ ...viewingCrypto, currentValue: newValue });
          }}
          onClose={() => setViewingCrypto(null)}
        />
      )}
      {viewingOther && (
        <OtherAssetDetail
          asset={viewingOther}
          members={members}
          fmt={fmt}
          onEdit={() => { setEditingAsset(viewingOther); setViewingOther(null); }}
          onClose={() => setViewingOther(null)}
        />
      )}
      {showAddPicker && (
        <CompletePatrimoinePicker
          onClose={() => setShowAddPicker(false)}
          onPickAsset={(typeId) => {
            setShowAddPicker(false);
            setEditingAsset({ id: null, type: typeId, name: '', currentValue: 0, memberIds: activeMemberId !== 'all' ? [activeMemberId] : [], notes: '', updatedAt: new Date().toISOString() });
          }}
          onPickLiability={() => {
            setShowAddPicker(false);
            setEditingLia({ id: null, type: 'mortgage', name: '', initialCapital: '', remainingCapital: '', monthlyPayment: '', interestRate: '', endDate: '', memberIds: activeMemberId !== 'all' ? [activeMemberId] : [], notes: '', downPayment: '', insuranceRate: '', applicationFees: '', ownershipPct: 100, durationMonths: '', startDate: '', linkedAssetId: '' });
          }}
        />
      )}
      {drawerItem && (
        <WealthItemDrawer
          item={drawerItem}
          fmt={fmt}
          members={members}
          liabilities={liabilities}
          onClose={() => setDrawerItem(null)}
          onEdit={(it) => {
            if (it.sourceTable === 'asset') {
              const a = assets.find(x => x.id === it.sourceId);
              if (a) { setEditingAsset(a); setDrawerItem(null); }
            } else if (it.sourceTable === 'liability') {
              const l = liabilities.find(x => x.id === it.sourceId);
              if (l) { setEditingLia(l); setDrawerItem(null); }
            }
            // account: no editor today (would need a future AccountEditor); no-op
          }}
          onDelete={async (it) => {
            if (!confirm(`Supprimer "${it.name}" ?`)) return;
            try {
              await api.wealth.delete(it);
              setDrawerItem(null);
              if (reload) await reload();
            } catch (err) {
              console.error('Failed to delete wealth item:', err);
            }
          }}
          onImportCSV={(it) => setImportingTo({ ...it, initialMode: 'choice' })}
        />
      )}
      {importingTo && (
        <ImportPositionsModal
          parentAsset={importingTo}
          fmt={fmt}
          initialMode={importingTo.initialMode}
          onClose={() => setImportingTo(null)}
          onConfirm={async (positions, { mode = 'replace' } = {}) => {
            const existing = assets.filter(a => a.parentAssetId === importingTo.sourceId || a.parent_asset_id === importingTo.sourceId);
            const parent = assets.find(a => a.id === importingTo.sourceId);
            const created = [];
            try {
              for (const p of positions) {
                const createdPosition = await api.assets.create({
                  type: 'stocks',
                  name: p.name,
                  current_value: p.amount || p.quantity * p.lastPrice,
                  currency: importingTo.currency || 'EUR',
                  quantity: p.quantity,
                  purchase_price: p.buyingPrice,
                  parent_asset_id: importingTo.sourceId,
                  member_ids: importingTo.memberIds || [],
                  // Stocke ISIN + ticker Yahoo si détectés — base pour les cours
                  // live dans InvestmentDetail. Le backend peut ignorer ces
                  // champs s'il ne les supporte pas encore (forward-compat).
                  ...(p.isin && { isin: p.isin }),
                  ...(p.ticker && { ticker: p.ticker }),
                  ...(p.tickerYahoo && { ticker_yahoo: p.tickerYahoo }),
                });
                if (createdPosition?.id) created.push(createdPosition.id);
              }
              const nextPortfolioValue = portfolioValueAfterImport({
                mode,
                parentValue: parent?.currentValue || 0,
                existingPositions: existing,
                importedPositions: positions,
              });
              if (parent) {
                const updatedParent = await saveAsset({ ...parent, currentValue: nextPortfolioValue });
                if (!updatedParent) throw new Error('La valorisation globale du portefeuille n’a pas pu être mise à jour.');
              }
              if (mode === 'replace') {
                for (const old of existing) await api.assets.delete(old.id);
              }
              if (reload) await reload();
            } catch (error) {
              // Si la création échoue avant le remplacement, on retire les
              // nouvelles lignes afin de conserver le portefeuille précédent.
              for (const id of created) {
                try { await api.assets.delete(id); } catch {}
              }
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}

// ─── CategoryDetailModal ──────────────────────────────────────────────
// Popup quand on clique sur le header d'une category card (Liquidités,
// Investissements...) OU sur un hero card (Financier / Immo).
// Affiche : titre + total + chart 12 mois + liste complete des items.
import { X as CloseIcon, Wallet as WalletIcon, TrendingUp as TUpIcon, Home as HomeIcon, Bitcoin as BitcoinIcon, Sparkles as SparklesIcon, CreditCard as CCIcon, LineChart as LCIcon } from 'lucide-react';

const MODAL_CATEGORY_META = {
  liquidites:      { Icon: WalletIcon, color: 'var(--d2)',     title: 'Liquidités' },
  investissements: { Icon: TUpIcon,    color: 'var(--accent)', title: 'Investissements' },
  immobilier:      { Icon: HomeIcon,   color: 'var(--d3)',     title: 'Immobilier' },
  cryptos:         { Icon: BitcoinIcon,color: 'var(--d7)',     title: 'Cryptos' },
  autres:          { Icon: SparklesIcon,color: 'var(--d4)',    title: 'Autres' },
  emprunts:        { Icon: CCIcon,     color: 'var(--negative)', title: 'Emprunts' },
  'chart-fin':     { Icon: LCIcon,     color: 'var(--accent)', title: 'Patrimoine financier — Évolution' },
  'chart-immo':    { Icon: LCIcon,     color: 'var(--d3)',     title: 'Patrimoine immobilier net — Évolution' },
  'chart-alloc':   { Icon: BarChart3,  color: 'var(--accent)', title: 'Allocation par classe d\'actif' },
};

// Helper detection plafonds reglementes (utilise dans le modal et la card)
const _REG_CAPS = [
  { label: 'PEA',      cap: 150000, match: (n) => /\bpea\b/i.test(n) && !/pme/i.test(n) },
  { label: 'PEA-PME',  cap: 225000, match: (n) => /pea[-\s]?pme/i.test(n) },
  { label: 'Livret A', cap: 22950,  match: (n) => /livret\s*a\b/i.test(n) },
  { label: 'LDDS',     cap: 12000,  match: (n) => /\bldds\b/i.test(n) || /(développement\s+durable)/i.test(n) },
  { label: 'LEP',      cap: 10000,  match: (n) => /\blep\b/i.test(n) },
];
const _getRegCap = (name) => name ? (_REG_CAPS.find(c => c.match(name)) || null) : null;

function CategoryDetailModal({ categoryKey, items, wealthHistory, sparkSeries, financialWealthLocal, realEstateNetWealth, classAllocation = [], totalAssets = 0, fmt, onClose, onItemClick }) {
  const meta = MODAL_CATEGORY_META[categoryKey] || MODAL_CATEGORY_META.autres;
  const Icon = meta.Icon;
  const isChartFin = categoryKey === 'chart-fin';
  const isChartImmo = categoryKey === 'chart-immo';
  const isChartAlloc = categoryKey === 'chart-alloc';
  const isChartMode = isChartFin || isChartImmo;

  const total = isChartFin ? financialWealthLocal
    : isChartImmo ? realEstateNetWealth
    : isChartAlloc ? totalAssets
    : items.reduce((s, i) => s + Math.abs(parseFloat(i.value) || 0), 0);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chartData = isChartFin ? sparkSeries.fin : isChartImmo ? sparkSeries.immo : [];

  return (
    <div className="cdm-overlay" onClick={onClose}>
      <div className="cdm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={meta.title}>
        <header className="cdm-head">
          <div className="cdm-head-id">
            <div className="cdm-icon" style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}>
              <Icon size={20}/>
            </div>
            <div>
              <div className="cdm-title">{meta.title}</div>
              <div className="cdm-meta">
                {isChartMode ? '12 derniers mois' : `${items.length} ${categoryKey === 'emprunts' ? (items.length > 1 ? 'prêts' : 'prêt') : items.length > 1 ? 'actifs' : 'actif'}`}
              </div>
            </div>
          </div>
          <div className="cdm-head-right">
            <div className={`cdm-total num ${categoryKey === 'emprunts' ? 'neg' : ''}`}>
              {categoryKey === 'emprunts' && total > 0 ? '−' : ''}{fmt(Math.abs(total))}
            </div>
            <button className="cdm-close" onClick={onClose} aria-label="Fermer">
              <CloseIcon size={18}/>
            </button>
          </div>
        </header>

        {/* Chart big si mode chart-fin/chart-immo OU si on a au moins 2 points wealth history pour cette categorie */}
        {isChartMode && chartData.length >= 2 && (
          <div className="cdm-chart">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`cdmGrad-${categoryKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.36}/>
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} fill={`url(#cdmGrad-${categoryKey})`} dot={false}/>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {isChartAlloc && (
          <div className="cdm-alloc">
            <div className="cdm-alloc-donut">
              <ResponsiveContainer width={240} height={240}>
                <PieChart>
                  <Pie data={classAllocation} dataKey="value" cx="50%" cy="50%" innerRadius={72} outerRadius={108} paddingAngle={2} cornerRadius={3} stroke="none">
                    {classAllocation.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="allocation-center">
                <div className="allocation-center-label">Total actifs</div>
                <div className="allocation-center-value num"><AnimatedNumber value={totalAssets} format={(v) => fmt(v)}/></div>
              </div>
            </div>
            <div className="allocation-legend">
              {classAllocation.map((c, i) => (
                <div key={i} className="alloc-row">
                  <div className="alloc-row-head">
                    <div className="alloc-dot" style={{ background: c.color }}/>
                    <div className="alloc-name">{c.name}</div>
                    <div className="alloc-val num">{fmt(c.value)}</div>
                  </div>
                  <div className="alloc-bar">
                    <div className="alloc-bar-fill" style={{ width: `${c.pct}%`, background: c.color }}/>
                  </div>
                  <div className="alloc-pct num">{c.pct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body items — affiche aussi pour chart-fin / chart-immo (= breakdown
            des biens et emprunts en dessous du chart) sauf chart-alloc qui
            a son propre body donut+legende. Bug fix 2026-05-21 modale immo
            vide quand peu d'historique. */}
        {!isChartAlloc && (
          <div className="cdm-body">
            {items.length === 0 ? (
              <div className="cdm-empty">
                <em>{isChartImmo
                  ? 'Aucun bien immobilier renseigné. Ajoute une résidence depuis Patrimoine.'
                  : isChartFin
                  ? 'Aucun actif financier renseigné.'
                  : 'Aucun élément dans cette catégorie.'}</em>
              </div>
            ) : (
              <ul className="cdm-items">
                {items.sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0)).map(item => (
                  <li
                    key={item.id}
                    className="cdm-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onItemClick(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(item); } }}
                  >
                    <div className="cdm-item-info">
                      <div className="cdm-item-name">{item.name}</div>
                      <div className="cdm-item-meta">
                        {item.meta?.bank && <span>{item.meta.bank}</span>}
                        <span className={`badge badge-${item.syncMode}`}>
                          {item.syncMode === 'synced' ? 'Sync' : 'Manuel'}
                        </span>
                      </div>
                      {(() => {
                        const cap = _getRegCap(item.name);
                        if (!cap) return null;
                        const val = Math.abs(item.value || 0);
                        const pct = Math.min(100, (val / cap.cap) * 100);
                        const state = pct >= 99 ? 'over' : pct >= 90 ? 'warn' : 'ok';
                        const remaining = Math.max(0, cap.cap - val);
                        return (
                          <div className={`wc-cap-bar state-${state}`} title={`Plafond ${cap.label} · reste ${fmt(remaining)}`}>
                            <div className="wc-cap-bar-track">
                              <div className="wc-cap-bar-fill" style={{ width: `${pct}%` }}/>
                            </div>
                            <span className="wc-cap-bar-label">{cap.label} · {pct.toFixed(0)}%</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="cdm-item-value-wrap">
                      <div className="cdm-item-value num">{fmt(item.value)}</div>
                      {item.plLatente != null && categoryKey !== 'immobilier' && Math.abs(item.plLatente) > 0.5 && (
                        <div className={`cdm-item-delta num ${item.plLatente >= 0 ? 'up' : 'down'}`}>
                          {item.plLatente >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(item.plLatente))}
                          {item.plLatentePct != null && ` · ${item.plLatente >= 0 ? '+' : ''}${item.plLatentePct.toFixed(1)}%`}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
