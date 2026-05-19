// ============================================================================
// Wealth — assets + liabilities, with sub-view filter, allocation donut,
// detail editors and the wealth-history chart.
// ============================================================================
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Plus, Wallet, BarChart3, Bitcoin, TrendingUp, CreditCard, Home, Sparkles,
} from 'lucide-react';
import { ASSET_CLASS_MAP } from '../constants.js';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';
import { NetWorthChart } from '../components/NetWorthChart.jsx';
import { RegulatoryCaps } from '../components/RegulatoryCaps.jsx';
import { useWealthItems } from '../hooks/useWealthItems.js';
import { WealthItemDrawer } from '../components/WealthItemDrawer.jsx';
import { ImportPositionsModal } from '../components/ImportPositionsModal.jsx';
import * as api from '../api.js';
// Sub-components — extracted from Wealth.jsx during découpe
import { CompletePatrimoinePicker } from './wealth/components/CompletePatrimoinePicker.jsx';
import { WealthItemRow } from './wealth/components/WealthItemRow.jsx';
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

  // Quand le wizard "+ Ajouter" termine en mode manuel, WealthlyApp passe
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

  const currentSub = WEALTH_SUBVIEWS.find(s => s.key === subview) || WEALTH_SUBVIEWS[0];
  const isAll = subview === 'all';
  const isLiabilitiesOnly = subview === 'emprunts';

  const filteredItems = useMemo(() => (
    currentSub.categories === null
      ? visibleItems
      : visibleItems.filter(i => currentSub.categories.includes(i.category))
  ), [visibleItems, currentSub.categories]);

  const subviewTotal = filteredItems
    .filter(i => i.sourceTable !== 'liability')
    .reduce((s, i) => s + (parseFloat(i.value) || 0) * memberShare(i), 0);
  const subviewLiabTotal = filteredItems
    .filter(i => i.sourceTable === 'liability')
    .reduce((s, i) => s + (parseFloat(i.value) || 0) * memberShare(i), 0);

  const totalAssets = visibleAssets.reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0);
  const totalLiabilities = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.remainingCapital) || 0) * memberShare(l), 0);
  const netWealthAssets = totalAssets - totalLiabilities;

  // Patrimoine financier : exclut immobilier + prêts immo
  const realEstateValue = visibleAssets.filter(a => a.type === 'real_estate')
    .reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0);
  const mortgageDebt = visibleLiabilities.filter(l => l.type === 'mortgage')
    .reduce((s, l) => s + (parseFloat(l.remainingCapital) || 0) * memberShare(l), 0);
  const financialWealthLocal = liquidWealth + (totalAssets - realEstateValue) - (totalLiabilities - mortgageDebt);

  // Asset class allocation for donut chart
  const classAllocation = useMemo(() => {
    const classes = {};
    visibleAssets.forEach(a => {
      const cls = ASSET_CLASS_MAP[a.type]?.class || 'Divers';
      const color = ASSET_CLASS_MAP[a.type]?.color || '#6b7280';
      const val = (parseFloat(a.currentValue) || 0) * memberShare(a);
      if (!classes[cls]) classes[cls] = { value: 0, color };
      classes[cls].value += val;
    });
    return Object.entries(classes).filter(([, d]) => d.value > 0)
      .map(([name, d]) => ({ name, value: d.value, color: d.color, pct: totalAssets > 0 ? (d.value / totalAssets) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [visibleAssets, memberShare, totalAssets]);

  // Private wealth KPIs
  const debtRatioWealth = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : null;
  const totalMonthlyDebt = visibleLiabilities.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0) * memberShare(l), 0);
  const iliquidAssets = visibleAssets.filter(a => ['real_estate'].includes(a.type))
    .reduce((s, a) => s + (parseFloat(a.currentValue) || 0) * memberShare(a), 0);
  const illiquidRatio = totalAssets > 0 ? (iliquidAssets / totalAssets) * 100 : null;

  return (
    <div className="wealth-view">
      <div className="subview-header">
        <div>
          <h1>{t('views.wealth.title')} <em>{t('views.wealth.titleAccent')}</em></h1>
          <p>{t('views.wealth.subtitle')}</p>
        </div>
        <button className="primary-btn" onClick={() => (onOpenAddWizard ? onOpenAddWizard() : setShowAddPicker(true))}><Plus size={14}/> {t('actions.add')}</button>
      </div>

      <nav className="wealth-subnav">
        {WEALTH_SUBVIEWS.map(s => {
          const Icon = s.icon;
          const count = s.categories === null
            ? visibleItems.length
            : visibleItems.filter(i => s.categories.includes(i.category)).length;
          return (
            <button
              key={s.key}
              className={`wealth-subnav-btn ${subview === s.key ? 'active' : ''}`}
              onClick={() => setSubview(s.key)}
            >
              <Icon size={14}/>
              <span>{t(s.labelKey)}</span>
              {count > 0 && <span className="wealth-subnav-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {/* Subview header (when not 'all') */}
      {!isAll && (
        <section className="card subview-hero">
          <div className="subview-hero-info">
            <div className="subview-hero-label">{t(currentSub.labelKey)}</div>
            <div className="subview-hero-value">{fmt(isLiabilitiesOnly ? subviewLiabTotal : subviewTotal)}</div>
            <div className="subview-hero-meta">
              {isLiabilitiesOnly
                ? `${filteredItems.length} prêt${filteredItems.length > 1 ? 's' : ''} · ${fmt(visibleLiabilities.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0) * memberShare(l), 0))} / mois`
                : `${filteredItems.length} actif${filteredItems.length > 1 ? 's' : ''} · ${totalAssets > 0 ? ((subviewTotal / totalAssets) * 100).toFixed(0) : 0}% du patrimoine`}
            </div>
          </div>
        </section>
      )}

      {/* Patrimoine history with brut / net / financier toggle */}
      {isAll && wealthHistory.length >= 1 && (
        <section className="card chart-card">
          <NetWorthChart snapshots={wealthHistory} fmt={fmt}/>
        </section>
      )}

      {/* Private wealth KPI strip */}
      {isAll && totalAssets > 0 && (
        <section className="wealth-kpis">
          <div className="wk-card">
            <div className="wk-label">{t('wealth.netAssets')}</div>
            <div className="wk-value">{fmt(netWealthAssets)}</div>
            <div className="wk-meta">{t('wealth.ofAssets', { amount: fmt(totalAssets) })}</div>
          </div>
          {debtRatioWealth !== null && (
            <div className={`wk-card ${debtRatioWealth > 50 ? 'warn' : ''}`}>
              <div className="wk-label">{t('wealth.debtRatio')}</div>
              <div className="wk-value">{debtRatioWealth.toFixed(1)}%</div>
              <div className="wk-meta">{debtRatioWealth < 30 ? t('wealth.low') : debtRatioWealth < 50 ? t('wealth.moderate') : t('wealth.high')}</div>
            </div>
          )}
          {illiquidRatio !== null && (
            <div className="wk-card">
              <div className="wk-label">{t('wealth.realEstateShare')}</div>
              <div className="wk-value">{illiquidRatio.toFixed(1)}%</div>
              <div className="wk-meta">{illiquidRatio > 70 ? t('wealth.concentrated') : t('wealth.balanced')}</div>
            </div>
          )}
          {totalMonthlyDebt > 0 && (
            <div className="wk-card">
              <div className="wk-label">{t('wealth.totalMonthly')}</div>
              <div className="wk-value">{fmt(totalMonthlyDebt)}</div>
              <div className="wk-meta">{t('wealth.perMonthAllLoans')}</div>
            </div>
          )}
        </section>
      )}

      {/* Plafonds régulés — only on 'all', renders nothing if no PEA/Livret A/LDDS detected */}
      {isAll && (
        <RegulatoryCaps visibleAssets={visibleAssets} memberShare={memberShare} fmt={fmt}/>
      )}

      {/* Asset class allocation — only on 'all' */}
      {isAll && classAllocation.length > 0 && (
        <section className="card allocation-card">
          <div className="card-header"><h3><BarChart3 size={16}/> {t('wealth.allocationByClass')}</h3></div>
          <div className="allocation-body">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={classAllocation} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2}>
                  {classAllocation.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="allocation-legend">
              {classAllocation.map((c, i) => (
                <div key={i} className="alloc-row">
                  <div className="alloc-dot" style={{ background: c.color }}/>
                  <div className="alloc-name">{c.name}</div>
                  <div className="alloc-pct">{c.pct.toFixed(1)}%</div>
                  <div className="alloc-val">{fmt(c.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isAll && (
        <section className="wealth-summary-net">
          <div className="wsn-card">
            <div className="wsn-label">Patrimoine financier <span style={{ fontSize: '0.75em', color: 'var(--ink-3)', fontWeight: 400 }}>· hors immobilier</span></div>
            <div className="wsn-value"><AnimatedNumber value={financialWealthLocal} format={(v) => fmt(v)}/></div>
            {totalLiabilities > 0 && (
              <div className="wsn-debt-mini num">
                {t('wealth.totalLiabilities')} · {fmt(-totalLiabilities)} ({visibleLiabilities.length} prêt{visibleLiabilities.length > 1 ? 's' : ''})
              </div>
            )}
          </div>
        </section>
      )}

      {/* Unified WealthItem list (v6) — accounts + assets + liabilities */}
      <section className="card">
        <div className="card-header">
          <h3><Wallet size={16}/> {isAll ? 'Patrimoine' : currentSub.label}</h3>
          {/* The header CTA is canonical (subview-header, top of page). No duplicate here. */}
        </div>

        {filteredItems.length === 0 ? (
          <div className="wealth-empty-state">
            <p style={{ fontFamily: 'Newsreader,Georgia,serif', fontStyle: 'italic', color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.5 }}>
              {t('wealth.emptyCategory', { category: t(currentSub.labelKey).toLowerCase() })}
            </p>
            <button className="primary-btn" onClick={() => (onOpenAddWizard ? onOpenAddWizard() : setShowAddPicker(true))}>
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
                onDelete={(it) => {
                  if (it.sourceTable === 'asset')     deleteAsset(it.sourceId);
                  if (it.sourceTable === 'liability') deleteLiability(it.sourceId);
                }}
                onClick={(it) => {
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
                }}
              />
            ))}
          </div>
        )}
      </section>

      {editingAsset && <AssetEditor asset={editingAsset} members={members} liabilities={visibleLiabilities} onSave={async (a) => { const saved = await saveAsset(a); setEditingAsset(null); return saved; }} onCancel={() => setEditingAsset(null)}/>}
      {editingLia && <LiabilityEditor liability={editingLia} members={members} assets={assets} onSave={(l) => { saveLiability(l); setEditingLia(null); }} onCancel={() => setEditingLia(null)}/>}
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
          onImportCSV={(a) => {
            // Convertit l'asset en WealthItem compatible avec ImportPositionsModal
            // (qui attend `sourceId` + `currency` + `memberIds`).
            const item = allItems.find(it => it.sourceTable === 'asset' && it.sourceId === a.id);
            setImportingTo(item || { sourceId: a.id, currency: a.currency || 'EUR', memberIds: a.memberIds || [], name: a.name });
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
          onImportCSV={(it) => setImportingTo(it)}
        />
      )}
      {importingTo && (
        <ImportPositionsModal
          parentAsset={importingTo}
          fmt={fmt}
          onClose={() => setImportingTo(null)}
          onConfirm={async (positions) => {
            for (const p of positions) {
              await api.assets.create({
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
            }
            if (reload) await reload();
          }}
        />
      )}
    </div>
  );
}
