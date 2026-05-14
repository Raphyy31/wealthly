// ============================================================================
// Wealth — assets + liabilities, with sub-view filter, allocation donut,
// detail editors and the wealth-history chart.
//
// Includes the full editor cascade (CompletePatrimoinePicker, AssetEditor,
// SimpleAssetEditor, RealEstateEditor with its 5-step wizard, LiabilityEditor
// with its own 5-step wizard, LiabilityDetail) — they're tightly coupled and
// only invoked from this view, so colocating keeps prop-drilling sane.
// ============================================================================
import { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  Plus, Edit3, Check, ChevronLeft, ChevronRight, Home, Landmark,
  Wallet, CreditCard, Users, Sparkles, Lightbulb, BarChart3,
  Bitcoin, TrendingUp, X,
} from 'lucide-react';
import {
  ASSET_TYPES, ASSET_CLASS_MAP, LIABILITY_TYPES,
} from '../constants.js';
import { formatCurrency, formatDate, buildAmortization } from '../utils.js';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';
import { NetWorthChart } from '../components/NetWorthChart.jsx';
import { RegulatoryCaps } from '../components/RegulatoryCaps.jsx';
import { CATEGORY_LABELS } from '../types/wealth.js';
import { useWealthItems } from '../hooks/useWealthItems.js';
import { WealthItemDrawer } from '../components/WealthItemDrawer.jsx';
import { ImportPositionsModal } from '../components/ImportPositionsModal.jsx';
import { useLiveQuotes, cryptoToYahoo, relTimeFromTs } from '../utils/marketPrices.js';
import { RefreshCw } from 'lucide-react';
import * as api from '../api.js';

// ============================================================================
// WEALTH (Assets + Liabilities)
// ============================================================================
// v6 unified subviews — driven by the canonical WealthCategory taxonomy
// (types/wealth.js). 'all' shows everything; the others filter by category.
const WEALTH_SUBVIEWS = [
  { key: 'all',             label: 'Tout',                          categories: null,                  icon: BarChart3 },
  { key: 'liquidites',      label: CATEGORY_LABELS.liquidites,      categories: ['liquidites'],        icon: Wallet },
  { key: 'investissements', label: CATEGORY_LABELS.investissements, categories: ['investissements'],   icon: TrendingUp },
  { key: 'immobilier',      label: CATEGORY_LABELS.immobilier,      categories: ['immobilier'],        icon: Home },
  { key: 'cryptos',         label: CATEGORY_LABELS.cryptos,         categories: ['cryptos'],           icon: Bitcoin },
  { key: 'autres',          label: CATEGORY_LABELS.autres,          categories: ['autres'],            icon: Sparkles },
  { key: 'emprunts',        label: CATEGORY_LABELS.emprunts,        categories: ['emprunts'],          icon: CreditCard },
];

export function Wealth({ assets, liabilities, members, activeMemberId, visibleAssets, visibleLiabilities, saveAsset, deleteAsset, saveLiability, deleteLiability, memberShare, fmt, wealthHistory = [], accounts = [], accountBalances = {}, transactions = [], onOpenAddWizard, reload }) {
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
          <h1>Votre <em>patrimoine.</em></h1>
          <p>Actifs, passifs et allocation — par classe d'actif.</p>
        </div>
        <button className="primary-btn" onClick={() => (onOpenAddWizard ? onOpenAddWizard() : setShowAddPicker(true))}><Plus size={14}/> Ajouter</button>
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
              <span>{s.label}</span>
              {count > 0 && <span className="wealth-subnav-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {/* Subview header (when not 'all') */}
      {!isAll && (
        <section className="card subview-hero">
          <div className="subview-hero-info">
            <div className="subview-hero-label">{currentSub.label}</div>
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
            <div className="wk-label">Actif net</div>
            <div className="wk-value">{fmt(netWealthAssets)}</div>
            <div className="wk-meta">{fmt(totalAssets)} d'actifs</div>
          </div>
          {debtRatioWealth !== null && (
            <div className={`wk-card ${debtRatioWealth > 50 ? 'warn' : ''}`}>
              <div className="wk-label">Ratio d'endettement</div>
              <div className="wk-value">{debtRatioWealth.toFixed(1)}%</div>
              <div className="wk-meta">{debtRatioWealth < 30 ? 'Faible' : debtRatioWealth < 50 ? 'Modéré' : 'Élevé'}</div>
            </div>
          )}
          {illiquidRatio !== null && (
            <div className="wk-card">
              <div className="wk-label">Part immobilier</div>
              <div className="wk-value">{illiquidRatio.toFixed(1)}%</div>
              <div className="wk-meta">{illiquidRatio > 70 ? 'Peu diversifié' : 'Équilibré'}</div>
            </div>
          )}
          {totalMonthlyDebt > 0 && (
            <div className="wk-card">
              <div className="wk-label">Mensualités totales</div>
              <div className="wk-value">{fmt(totalMonthlyDebt)}</div>
              <div className="wk-meta">/mois (tous prêts)</div>
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
          <div className="card-header"><h3><BarChart3 size={16}/> Allocation par classe d'actifs</h3></div>
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
        <section className="wealth-summary">
          <div className="ws-card positive">
            <div className="ws-icon"><Landmark size={20}/></div>
            <div className="ws-content">
              <div className="ws-label">Total actifs</div>
              <div className="ws-value"><AnimatedNumber value={totalAssets} format={(v) => fmt(v)}/></div>
              <div className="ws-meta">{visibleAssets.length} actif{visibleAssets.length > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="ws-card negative">
            <div className="ws-icon"><CreditCard size={20}/></div>
            <div className="ws-content">
              <div className="ws-label">Total passifs</div>
              <div className="ws-value"><AnimatedNumber value={totalLiabilities} format={(v) => fmt(v)}/></div>
              <div className="ws-meta">{visibleLiabilities.length} prêt{visibleLiabilities.length > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="ws-card net">
            <div className="ws-icon"><Sparkles size={20}/></div>
            <div className="ws-content">
              <div className="ws-label">Patrimoine (hors liquidités)</div>
              <div className="ws-value"><AnimatedNumber value={totalAssets - totalLiabilities} format={(v) => fmt(v)}/></div>
            </div>
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
            <p>Aucun élément dans <em>{currentSub.label.toLowerCase()}</em>.</p>
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

      {editingAsset && <AssetEditor asset={editingAsset} members={members} liabilities={visibleLiabilities} onSave={(a) => { saveAsset(a); setEditingAsset(null); }} onCancel={() => setEditingAsset(null)}/>}
      {editingLia && <LiabilityEditor liability={editingLia} members={members} assets={assets} onSave={(l) => { saveLiability(l); setEditingLia(null); }} onCancel={() => setEditingLia(null)}/>}
      {viewingLia && <LiabilityDetail liability={viewingLia} assets={assets} members={members} memberShare={memberShare} fmt={fmt} onEdit={() => { setEditingLia(viewingLia); setViewingLia(null); }} onClose={() => setViewingLia(null)}/>}
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

function CompletePatrimoinePicker({ onClose, onPickAsset, onPickLiability }) {
  const [filter, setFilter] = useState('');
  const items = [
    ...ASSET_TYPES.map(t => ({ kind: 'asset', id: t.id, name: t.name, description: t.description, icon: t.icon, color: t.color })),
    { kind: 'liability', id: 'mortgage', name: 'Crédit / Emprunt', description: 'Crédit immo, conso, auto…', icon: CreditCard, color: '#7c2d12' },
  ];
  const filtered = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()) || i.description.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Compléter mon patrimoine</h2>
          <button className="icon-btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <label>
            <span>Rechercher</span>
            <input autoFocus type="text" placeholder="Immobilier, PEA, Crypto, Crédit…" value={filter} onChange={(e) => setFilter(e.target.value)}/>
          </label>
          <div className="patrimoine-picker-grid">
            {filtered.map((it, i) => {
              const Icon = it.icon;
              const onClick = () => it.kind === 'asset' ? onPickAsset(it.id) : onPickLiability();
              return (
                <button key={i} className="patrimoine-picker-card" onClick={onClick}>
                  <div className="ppc-icon" style={{ background: it.color + '22', color: it.color }}><Icon size={20}/></div>
                  <div className="ppc-text">
                    <div className="ppc-name">{it.name}</div>
                    <div className="ppc-desc">{it.description}</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>Aucun résultat.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetEditor({ asset, members, liabilities = [], onSave, onCancel }) {
  // Real-estate gets the multi-step wizard; the rest stays the lighter form.
  if (asset.type === 'real_estate') {
    return <RealEstateEditor asset={asset} members={members} liabilities={liabilities} onSave={onSave} onCancel={onCancel}/>;
  }
  return <SimpleAssetEditor asset={asset} members={members} onSave={onSave} onCancel={onCancel}/>;
}

function SimpleAssetEditor({ asset, members, onSave, onCancel }) {
  const [draft, setDraft] = useState(asset);
  const handleSave = () => {
    if (!draft.name) { alert('Donnez un nom à cet actif'); return; }
    if (!draft.memberIds || draft.memberIds.length === 0) { alert('Assignez à au moins un membre'); return; }
    onSave({ ...draft, updatedAt: new Date().toISOString() });
  };
  const toggleMember = (mid) => {
    const ids = draft.memberIds || [];
    setDraft({ ...draft, memberIds: ids.includes(mid) ? ids.filter(i => i !== mid) : [...ids, mid] });
  };
  const type = ASSET_TYPES.find(t => t.id === draft.type);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{asset.id ? 'Modifier' : 'Nouvel actif'}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <label><span>Type</span>
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label><span>Devise</span>
              <select value={draft.currency || 'EUR'} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
                <option value="EUR">🇪🇺 EUR</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="GBP">🇬🇧 GBP</option>
                <option value="CHF">🇨🇭 CHF</option>
              </select>
            </label>
          </div>
          {type && <div className="field-help">{type.description}</div>}
          <label><span>Nom</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex: Appartement Paris 11e, AV Linxea Spirit"/>
          </label>
          <label><span>Valeur actuelle ({draft.currency || 'EUR'})</span>
            <input
              type="number"
              value={draft.currentValue}
              onChange={(e) => setDraft({ ...draft, currentValue: e.target.value })}
              step="any"
              disabled={!!(draft.ticker && draft.quantity)}
              title={draft.ticker && draft.quantity ? 'Valeur calculée automatiquement à partir du cours live' : ''}
            />
            {draft.ticker && draft.quantity ? (
              <div className="field-help" style={{ color: 'var(--success)', fontWeight: 500 }}>
                ⚡ Valeur calculée en live : {draft.quantity} × cours actuel
              </div>
            ) : null}
          </label>

          {/* Live-pricing block — visible for market-traded asset types */}
          {['stocks', 'pea', 'crypto', 'life_insurance'].includes(draft.type) && (
            <div style={{ padding: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                ⚡ Suivi en temps réel <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 11 }}>(optionnel)</span>
              </div>
              <div className="field-row">
                <label><span>Ticker / symbole</span>
                  <input
                    value={draft.ticker || ''}
                    onChange={(e) => setDraft({ ...draft, ticker: e.target.value.toUpperCase() })}
                    placeholder="ex: AAPL, CW8.PA, BTC-EUR"
                    style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}
                  />
                </label>
                <label><span>Quantité (parts/actions)</span>
                  <input
                    type="number"
                    value={draft.quantity ?? ''}
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                    placeholder="ex: 124"
                    step="any"
                  />
                </label>
              </div>
              <div className="field-help" style={{ marginTop: 6 }}>
                Si renseignés, la valeur actuelle sera <strong>recalculée automatiquement</strong> à partir du cours en direct (Yahoo Finance). Format : ticker US (AAPL), Euronext Paris (CW8.PA), crypto (BTC-EUR).
              </div>
            </div>
          )}

          <div className="field-row">
            <label><span>Prix de revient ({draft.currency || 'EUR'}) <span className="hint">optionnel</span></span>
              <input type="number" value={draft.purchasePrice ?? ''} onChange={(e) => setDraft({ ...draft, purchasePrice: e.target.value })} step="any" placeholder="ex: 12 500"/>
            </label>
            <label><span>Date d'acquisition <span className="hint">optionnel</span></span>
              <input type="date" value={draft.purchaseDate || ''} onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })}/>
            </label>
          </div>
          <div className="field-help">Si renseigné, l'app calcule automatiquement la plus-value latente (€ et %) sur la fiche du patrimoine.</div>
          <label><span>Propriétaires</span>
            <div className="member-checks">
              {members.map(m => (
                <label key={m.id} className={`member-check ${(draft.memberIds || []).includes(m.id) ? 'active' : ''}`} style={{ borderColor: (draft.memberIds || []).includes(m.id) ? m.color : undefined }}>
                  <input type="checkbox" checked={(draft.memberIds || []).includes(m.id)} onChange={() => toggleMember(m.id)}/>
                  <span className="member-avatar" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </label>
          <label><span>Notes (optionnel)</span>
            <textarea value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows="2" placeholder="Allocation, support, etc."/>
          </label>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <button className="primary-btn" onClick={handleSave}><Check size={14}/> Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// REAL ESTATE WIZARD — 4 steps: Description / Caractéristiques / Détails / Emprunts
// ============================================================================
const RE_SUBTYPES = [
  { key: 'rp',         label: 'Résidence principale' },
  { key: 'secondaire', label: 'Résidence secondaire' },
  { key: 'locative',   label: 'Investissement locatif' },
  { key: 'scpi',       label: 'SCPI' },
  { key: 'other',      label: 'Autre' },
];

const RE_STEPS = [
  { key: 'desc',  label: 'Description' },
  { key: 'specs', label: 'Caractéristiques' },
  { key: 'detail', label: 'Détails' },
  { key: 'loans', label: 'Emprunts rattachés' },
];

function RealEstateEditor({ asset, members, liabilities, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    ...asset,
    subtype: asset.subtype || 'rp',
    address: asset.address || '',
    purchasePrice: asset.purchasePrice ?? '',
    surfaceM2: asset.surfaceM2 ?? '',
    notaryFees: asset.notaryFees ?? '',
    agencyFees: asset.agencyFees ?? '',
    worksFees: asset.worksFees ?? '',
    furnitureFees: asset.furnitureFees ?? '',
    purchaseDate: asset.purchaseDate || '',
    constructionYear: asset.constructionYear ?? '',
    ownershipPct: asset.ownershipPct ?? 100,
    currentValue: asset.currentValue ?? '',
  });
  const [stepIdx, setStepIdx] = useState(0);
  const step = RE_STEPS[stepIdx].key;
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const toggleMember = (mid) => {
    const ids = draft.memberIds || [];
    set('memberIds', ids.includes(mid) ? ids.filter(i => i !== mid) : [...ids, mid]);
  };
  const linkedLoans = (liabilities || []).filter(l => l.linkedAssetId === asset.id);

  const canSave = draft.name && (draft.memberIds || []).length > 0;
  const submit = () => {
    if (!canSave) { alert('Renseigne un nom et au moins un propriétaire.'); return; }
    onSave({ ...draft, updatedAt: new Date().toISOString() });
  };

  // Auto-suggest current value when not set (purchase + works + furniture)
  const suggestedValue = (() => {
    const p = parseFloat(draft.purchasePrice) || 0;
    const w = parseFloat(draft.worksFees) || 0;
    const f = parseFloat(draft.furnitureFees) || 0;
    return p + w + f;
  })();

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{asset.id ? 'Modifier mon immobilier' : 'Ajouter mon immobilier'}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="wizard-body">
          <nav className="wizard-steps">
            {RE_STEPS.map((s, i) => (
              <button
                key={s.key}
                className={`wizard-step ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
                onClick={() => setStepIdx(i)}
              >
                <span className="wizard-step-num">{i + 1}</span>
                <span className="wizard-step-label">{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="wizard-pane">
            {step === 'desc' && (
              <>
                <label><span>Nom du bien</span>
                  <input autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Appartement Paris 11e"/>
                </label>
                <label><span>Adresse <em>optionnel</em></span>
                  <input value={draft.address} onChange={(e) => set('address', e.target.value)} placeholder="58bis Cité Durmar, 75011 Paris"/>
                </label>
                <label><span>Catégorie</span>
                  <select value={draft.subtype} onChange={(e) => set('subtype', e.target.value)}>
                    {RE_SUBTYPES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
                <label><span>Propriétaires</span>
                  <div className="member-checks">
                    {members.map(m => (
                      <label key={m.id} className={`member-check ${(draft.memberIds || []).includes(m.id) ? 'active' : ''}`} style={{ borderColor: (draft.memberIds || []).includes(m.id) ? m.color : undefined }}>
                        <input type="checkbox" checked={(draft.memberIds || []).includes(m.id)} onChange={() => toggleMember(m.id)}/>
                        <span className="member-avatar" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
              </>
            )}

            {step === 'specs' && (
              <>
                <label><span>Prix d'achat hors frais (€)</span>
                  <input type="number" value={draft.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} step="any"/>
                </label>
                <div className="field-row">
                  <label><span>Surface (m²)</span>
                    <input type="number" value={draft.surfaceM2} onChange={(e) => set('surfaceM2', e.target.value)} step="0.1"/>
                  </label>
                  <label><span>Détention (%)</span>
                    <input type="number" min={0} max={100} value={draft.ownershipPct} onChange={(e) => set('ownershipPct', e.target.value)} step="0.1"/>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Frais d'agence (€) <em>optionnel</em></span>
                    <input type="number" value={draft.agencyFees} onChange={(e) => set('agencyFees', e.target.value)} step="any"/>
                  </label>
                  <label><span>Frais de notaire (€) <em>optionnel</em></span>
                    <input type="number" value={draft.notaryFees} onChange={(e) => set('notaryFees', e.target.value)} step="any"/>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Frais de travaux (€) <em>optionnel</em></span>
                    <input type="number" value={draft.worksFees} onChange={(e) => set('worksFees', e.target.value)} step="any"/>
                  </label>
                  <label><span>Frais d'ameublement (€) <em>optionnel</em></span>
                    <input type="number" value={draft.furnitureFees} onChange={(e) => set('furnitureFees', e.target.value)} step="any"/>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Date d'achat <em>optionnel</em></span>
                    <input type="date" value={draft.purchaseDate || ''} onChange={(e) => set('purchaseDate', e.target.value)}/>
                  </label>
                  <label><span>Année de construction <em>optionnel</em></span>
                    <input type="number" value={draft.constructionYear} onChange={(e) => set('constructionYear', e.target.value)} placeholder="1985"/>
                  </label>
                </div>
              </>
            )}

            {step === 'detail' && (
              <>
                <label><span>Valeur actuelle (€)</span>
                  <input type="number" value={draft.currentValue} onChange={(e) => set('currentValue', e.target.value)} step="any"/>
                </label>
                {suggestedValue > 0 && (!draft.currentValue || parseFloat(draft.currentValue) === 0) && (
                  <button type="button" className="secondary-btn" style={{ alignSelf: 'flex-start' }} onClick={() => set('currentValue', String(suggestedValue))}>
                    Estimer à {Math.round(suggestedValue).toLocaleString('fr-FR')} € (achat + travaux + ameublement)
                  </button>
                )}
                <label><span>Notes <em>optionnel</em></span>
                  <textarea rows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="DPE, locataire, copro…"/>
                </label>
              </>
            )}

            {step === 'loans' && (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Les emprunts rattachés à ce bien apparaissent ici. Pour lier un nouveau crédit, ajoute-le depuis Patrimoine → Emprunts et sélectionne ce bien dans l'étape "Actifs liés" du wizard.
                </p>
                {linkedLoans.length === 0 ? (
                  <div className="empty-mini" style={{ padding: '32px 0' }}>
                    <CreditCard size={24}/>
                    <p>Aucun emprunt rattaché à ce bien.</p>
                  </div>
                ) : (
                  <div className="liability-list">
                    {linkedLoans.map(l => (
                      <div key={l.id} className="liability-card-v2" style={{ cursor: 'default' }}>
                        <div className="lia-header">
                          <div className="lia-icon" style={{ background: '#7c2d1222', color: '#7c2d12' }}><Home size={14}/></div>
                          <div className="lia-name-block">
                            <span className="lia-name">{l.name}</span>
                            <span className="lia-type">Restant dû : {Math.round(l.remainingCapital || 0).toLocaleString('fr-FR')} €</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="modal-footer wizard-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <div style={{ flex: 1 }}/>
          {stepIdx > 0 && <button className="secondary-btn" onClick={() => setStepIdx(stepIdx - 1)}><ChevronLeft size={14}/> Retour</button>}
          {stepIdx < RE_STEPS.length - 1 ? (
            <button className="primary-btn" onClick={() => setStepIdx(stepIdx + 1)}>Suivant <ChevronRight size={14}/></button>
          ) : (
            <button className="primary-btn" onClick={submit} disabled={!canSave}><Check size={14}/> Enregistrer</button>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// LIABILITY WIZARD (5 steps — inspired by Finary)
// ============================================================================
const LIABILITY_STEPS = [
  { key: 'main',    label: 'Infos principales' },
  { key: 'specs',   label: 'Caractéristiques' },
  { key: 'duration',label: 'Durée' },
  { key: 'fees',    label: 'Frais & détention' },
  { key: 'linked',  label: 'Actifs liés' },
];

function LiabilityEditor({ liability, members, assets = [], onSave, onCancel }) {
  const [draft, setDraft] = useState({
    ...liability,
    initialCapital: liability.initialCapital ?? '',
    remainingCapital: liability.remainingCapital ?? '',
    monthlyPayment: liability.monthlyPayment ?? '',
    interestRate: liability.interestRate ?? '',
    downPayment: liability.downPayment ?? '',
    insuranceRate: liability.insuranceRate ?? '',
    applicationFees: liability.applicationFees ?? '',
    ownershipPct: liability.ownershipPct ?? 100,
    durationMonths: liability.durationMonths ?? '',
    startDate: liability.startDate || '',
    linkedAssetId: liability.linkedAssetId || '',
  });
  const [stepIdx, setStepIdx] = useState(0);
  const step = LIABILITY_STEPS[stepIdx].key;

  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const toggleMember = (mid) => {
    const ids = draft.memberIds || [];
    set('memberIds', ids.includes(mid) ? ids.filter(i => i !== mid) : [...ids, mid]);
  };

  const canSave = draft.name && (draft.memberIds || []).length > 0;
  const submit = () => {
    if (!canSave) { alert('Renseigne au moins un nom et un emprunteur.'); return; }
    onSave(draft);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{liability.id ? 'Modifier l\'emprunt' : 'Ajouter un emprunt'}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="wizard-body">
          <nav className="wizard-steps">
            {LIABILITY_STEPS.map((s, i) => (
              <button
                key={s.key}
                className={`wizard-step ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
                onClick={() => setStepIdx(i)}
              >
                <span className="wizard-step-num">{i + 1}</span>
                <span className="wizard-step-label">{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="wizard-pane">
            {step === 'main' && (
              <>
                <label><span>Nom</span>
                  <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Emprunt RP, Auto, …" autoFocus/>
                </label>
                <div className="field-row">
                  <label><span>Type</span>
                    <select value={draft.type} onChange={(e) => set('type', e.target.value)}>
                      {LIABILITY_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label><span>Devise</span>
                    <select value={draft.currency || 'EUR'} onChange={(e) => set('currency', e.target.value)}>
                      <option value="EUR">🇪🇺 EUR</option>
                      <option value="USD">🇺🇸 USD</option>
                      <option value="GBP">🇬🇧 GBP</option>
                      <option value="CHF">🇨🇭 CHF</option>
                    </select>
                  </label>
                </div>
                <div className="field-row">
                  <label><span>Montant emprunté ({draft.currency || 'EUR'})</span>
                    <input type="number" value={draft.initialCapital} onChange={(e) => set('initialCapital', e.target.value)} step="any"/>
                  </label>
                  <label><span>Apport ({draft.currency || 'EUR'}) <em>optionnel</em></span>
                    <input type="number" value={draft.downPayment} onChange={(e) => set('downPayment', e.target.value)} step="any"/>
                  </label>
                </div>
                <label><span>Emprunteurs</span>
                  <div className="member-checks">
                    {members.map(m => (
                      <label key={m.id} className={`member-check ${(draft.memberIds || []).includes(m.id) ? 'active' : ''}`} style={{ borderColor: (draft.memberIds || []).includes(m.id) ? m.color : undefined }}>
                        <input type="checkbox" checked={(draft.memberIds || []).includes(m.id)} onChange={() => toggleMember(m.id)}/>
                        <span className="member-avatar" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
              </>
            )}

            {step === 'specs' && (
              <>
                <div className="field-row">
                  <label><span>Mensualité totale ({draft.currency || 'EUR'})</span>
                    <input type="number" value={draft.monthlyPayment} onChange={(e) => set('monthlyPayment', e.target.value)} step="any"/>
                  </label>
                  <label><span>Taux d'intérêt (%)</span>
                    <input type="number" value={draft.interestRate} onChange={(e) => set('interestRate', e.target.value)} step="0.01"/>
                  </label>
                </div>
                <label><span>Taux d'assurance (%) <em>optionnel</em></span>
                  <input type="number" value={draft.insuranceRate} onChange={(e) => set('insuranceRate', e.target.value)} step="0.01"/>
                </label>
                <label><span>Capital restant dû ({draft.currency || 'EUR'})</span>
                  <input type="number" value={draft.remainingCapital} onChange={(e) => set('remainingCapital', e.target.value)} step="any"/>
                </label>
              </>
            )}

            {step === 'duration' && (
              <>
                <div className="field-row">
                  <label><span>Date de première échéance</span>
                    <input type="date" value={draft.startDate || ''} onChange={(e) => set('startDate', e.target.value)}/>
                  </label>
                  <label><span>Durée totale (mois)</span>
                    <input type="number" value={draft.durationMonths} onChange={(e) => set('durationMonths', e.target.value)} placeholder="240"/>
                  </label>
                </div>
                <label><span>Date de fin</span>
                  <input type="date" value={draft.endDate || ''} onChange={(e) => set('endDate', e.target.value)}/>
                </label>
                <div className="settings-info">
                  <Lightbulb size={14}/>
                  <span>Tu peux soit saisir la durée totale, soit la date de fin. Wealthly utilise les deux pour calculer le calendrier d'amortissement.</span>
                </div>
              </>
            )}

            {step === 'fees' && (
              <>
                <div className="field-row">
                  <label><span>Frais de dossier (€) <em>optionnel</em></span>
                    <input type="number" value={draft.applicationFees} onChange={(e) => set('applicationFees', e.target.value)} step="any"/>
                  </label>
                  <label><span>Détention de l'emprunt (%) <em>optionnel</em></span>
                    <input type="number" value={draft.ownershipPct} onChange={(e) => set('ownershipPct', e.target.value)} min="0" max="100" step="0.1"/>
                  </label>
                </div>
                <label><span>Notes</span>
                  <textarea rows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)}/>
                </label>
              </>
            )}

            {step === 'linked' && (
              <>
                <label><span>Actif lié <em>optionnel</em></span>
                  <select value={draft.linkedAssetId || ''} onChange={(e) => set('linkedAssetId', e.target.value)}>
                    <option value="">— Aucun —</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <div className="settings-info">
                  <Lightbulb size={14}/>
                  <span>Lier un emprunt à un actif (ex: ton crédit immobilier à ta résidence principale) permet à Wealthly de croiser les deux dans tes vues Patrimoine.</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer wizard-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <div style={{ flex: 1 }}/>
          {stepIdx > 0 && <button className="secondary-btn" onClick={() => setStepIdx(stepIdx - 1)}><ChevronLeft size={14}/> Retour</button>}
          {stepIdx < LIABILITY_STEPS.length - 1 ? (
            <button className="primary-btn" onClick={() => setStepIdx(stepIdx + 1)}>Suivant <ChevronRight size={14}/></button>
          ) : (
            <button className="primary-btn" onClick={submit} disabled={!canSave}><Check size={14}/> Enregistrer</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOAN AMORTIZATION + DETAIL VIEW
// ============================================================================

/**
 * Compute a fixed-rate annuity amortization schedule.
 *
 * Returns one row per month: { idx, date, capital, interest, insurance,
 * payment, remaining }. The last row's `remaining` should be ~0.
 *
 * Inputs:
 *  - principal   : initial capital (€)
 *  - annualRate  : annual interest rate in % (e.g. 1.25 → 1.25%)
 *  - durationM   : total duration in months
 *  - insuranceRate : annual insurance rate in % of initial principal
 *  - startDate   : ISO date string for the first payment (used to label rows)
 *  - paymentOverride : optional fixed monthly payment (capital + interest);
 *                       used if provided so the UI can match the value the
 *                       user actually pays — otherwise computed from formula.
 */
// buildAmortization moved to utils.js so the PDF generator can reuse it.

function LiabilityDetail({ liability, assets, members, memberShare, fmt, onEdit, onClose }) {
  const l = liability;
  const [activeTab, setActiveTab] = useState('synthese');

  const schedule = useMemo(() => buildAmortization({
    principal: l.initialCapital,
    annualRate: l.interestRate,
    durationM: l.durationMonths,
    insuranceRate: l.insuranceRate,
    startDate: l.startDate,
    paymentOverride: l.monthlyPayment,
  }), [l]);

  const today = new Date().toISOString().slice(0, 10);
  const paidRows = schedule.filter(r => r.date <= today);
  const remainingRows = schedule.filter(r => r.date > today);
  const totalCost = schedule.reduce((s, r) => s + r.payment, 0) + (parseFloat(l.applicationFees) || 0);
  const totalCapitalPaid = paidRows.reduce((s, r) => s + r.capital, 0);
  const totalInterestPaid = paidRows.reduce((s, r) => s + r.interest, 0);
  const totalInsurancePaid = paidRows.reduce((s, r) => s + r.insurance, 0);
  const totalPaid = totalCapitalPaid + totalInterestPaid + totalInsurancePaid;
  const totalRemaining = remainingRows.reduce((s, r) => s + r.payment, 0);
  const computedRemaining = remainingRows.length > 0 ? remainingRows[0].remaining + remainingRows[0].capital : 0;
  const remainingCapital = parseFloat(l.remainingCapital) > 0 ? parseFloat(l.remainingCapital) : computedRemaining;
  const principal = parseFloat(l.initialCapital) || 0;
  const pctRepaid = principal > 0 ? Math.min(100, ((principal - remainingCapital) / principal) * 100) : 0;
  const linkedAsset = l.linkedAssetId ? assets.find(a => a.id === l.linkedAssetId) : null;
  const owners = (l.memberIds || []).map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(' & ');
  const monthlyPayment = parseFloat(l.monthlyPayment) || (schedule[0]?.payment ?? 0);

  const chartData = schedule.map(r => ({
    date: r.date,
    remaining: Math.round(r.remaining),
    payment: Math.round(r.payment),
  }));

  // Current/next monthly breakdown — find first unpaid row (or fallback to first row)
  const currentRow = remainingRows[0] || schedule[0] || null;
  const breakdownCapital = currentRow ? currentRow.capital : 0;
  const breakdownInterest = currentRow ? currentRow.interest : 0;
  const breakdownInsurance = currentRow ? currentRow.insurance : 0;
  const breakdownTotal = breakdownCapital + breakdownInterest + breakdownInsurance;
  const endDate = schedule.length > 0 ? schedule[schedule.length - 1].date : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--detail loan-finary" onClick={(e) => e.stopPropagation()}>
        {/* Top bar — back arrow + name + actions */}
        <header className="loan-finary-topbar">
          <button className="loan-finary-back" onClick={onClose} aria-label="Fermer">
            <ChevronLeft size={18}/>
          </button>
          <span className="loan-finary-pagetitle">Loan</span>
          <div className="loan-finary-topbar-actions">
            <button className="secondary-btn" onClick={onEdit}><Edit3 size={13}/> Modifier</button>
          </div>
        </header>

        {/* KPI strip — title + 4 inline metrics */}
        <div className="loan-finary-kpi-strip">
          <div className="loan-finary-title-block">
            <span className="loan-finary-eyebrow">Loan</span>
            <h2 className="loan-finary-title">{l.name}</h2>
          </div>

          <div className="loan-finary-kpis">
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Remboursé</div>
              <div className="loan-finary-progress">
                <div className="loan-finary-progress-fill" style={{ width: `${pctRepaid}%` }}/>
              </div>
            </div>
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Taux d'intérêt</div>
              <div className="loan-finary-kpi-value w-num">{l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)}%` : '—'}</div>
            </div>
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Mensualité</div>
              <div className="loan-finary-kpi-value w-num">{fmt(monthlyPayment)}</div>
            </div>
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Capital restant dû</div>
              <div className="loan-finary-kpi-value w-num">{fmt(remainingCapital)}</div>
            </div>
          </div>
        </div>

        {/* Tabs — Synthèse / Mensualités */}
        <div className="loan-finary-tabs">
          <button className={activeTab === 'synthese' ? 'active' : ''} onClick={() => setActiveTab('synthese')}>Synthèse</button>
          <button className={activeTab === 'mensualites' ? 'active' : ''} onClick={() => setActiveTab('mensualites')}>Mensualités</button>
        </div>

        <div className="loan-finary-body">
          {activeTab === 'synthese' && (
            <>
              <div className="loan-finary-grid">
                {/* Area chart — capital remaining over time, smooth cobalt line + subtle fill */}
                <div className="loan-finary-chart">
                  {schedule.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="loanRemainingFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22}/>
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                        <XAxis dataKey="date" tickFormatter={(d) => d.slice(0, 4)} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(schedule.length / 8))}/>
                        <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                        <Tooltip
                          formatter={(v) => [fmt(v), 'Capital restant']}
                          labelFormatter={(d) => formatDate(d, { format: 'monthYear' })}
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                        />
                        <Area type="monotone" dataKey="remaining" stroke="var(--accent)" strokeWidth={2} fill="url(#loanRemainingFill)" dot={false} activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--bg-elev, var(--bg-card))', strokeWidth: 2 }}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-mini" style={{ padding: '60px 0' }}>
                      <BarChart3 size={24}/>
                      <p>Renseigne le capital, le taux et la durée pour voir la courbe d'amortissement.</p>
                    </div>
                  )}
                </div>

                {/* Right monthly panel — big amount + breakdown + stats + progress */}
                <div className="loan-monthly-panel">
                  <div className="loan-monthly-eyebrow">Mensualité</div>
                  <div className="loan-monthly-amount">
                    <em>{fmt(breakdownTotal || monthlyPayment)}</em>
                  </div>
                  <div className="loan-monthly-sub">par mois</div>

                  <ul className="loan-monthly-breakdown">
                    <li>
                      <span className="loan-monthly-dot" style={{ background: 'var(--accent)' }}/>
                      <span className="loan-monthly-label">Capital</span>
                      <span className="loan-monthly-value w-num">{fmt(breakdownCapital)}</span>
                    </li>
                    <li>
                      <span className="loan-monthly-dot" style={{ background: 'var(--positive)' }}/>
                      <span className="loan-monthly-label">Intérêts</span>
                      <span className="loan-monthly-value w-num">{fmt(breakdownInterest)}</span>
                    </li>
                    <li>
                      <span className="loan-monthly-dot" style={{ background: 'var(--negative)' }}/>
                      <span className="loan-monthly-label">Assurance</span>
                      <span className="loan-monthly-value w-num">{fmt(breakdownInsurance)}</span>
                    </li>
                  </ul>

                  <div className="loan-monthly-stats">
                    <div className="loan-monthly-stat">
                      <span className="loan-monthly-stat-label">Échéances payées</span>
                      <span className="loan-monthly-stat-value w-num">{paidRows.length}</span>
                    </div>
                    <div className="loan-monthly-stat">
                      <span className="loan-monthly-stat-label">Échéances restantes</span>
                      <span className="loan-monthly-stat-value w-num">{remainingRows.length}</span>
                    </div>
                    <div className="loan-monthly-stat">
                      <span className="loan-monthly-stat-label">Date de fin</span>
                      <span className="loan-monthly-stat-value">{endDate ? formatDate(endDate, { format: 'monthLong' }) : '—'}</span>
                    </div>
                  </div>

                  <p className="loan-progress-text">
                    Vous avez remboursé <strong className="w-num">{pctRepaid.toFixed(0)} %</strong> <em>du capital du prêt</em>
                  </p>
                </div>
              </div>

              {/* Synthèse coût — une seule ligne compacte (le détail vit dans l'onglet Mensualités) */}
              <div className="loan-cost-band">
                <div className="loan-cost-item">
                  <div className="loan-monthly-label">Coût total du crédit</div>
                  <div className="loan-cost-val w-num">{fmt(Math.max(0, totalCost - principal))}</div>
                  <div className="loan-cost-meta">intérêts + assurances + frais sur la durée du prêt</div>
                </div>
                <div className="loan-cost-item">
                  <div className="loan-monthly-label">Total remboursé à ce jour</div>
                  <div className="loan-cost-val w-num">{fmt(totalPaid)}</div>
                  <div className="loan-cost-meta">
                    dont capital <strong className="w-num">{fmt(totalCapitalPaid)}</strong>
                    {' · '}intérêts <strong className="w-num">{fmt(totalInterestPaid)}</strong>
                  </div>
                </div>
                <div className="loan-cost-item">
                  <div className="loan-monthly-label">Restant à rembourser</div>
                  <div className="loan-cost-val w-num">{fmt(totalRemaining)}</div>
                  <div className="loan-cost-meta">
                    <strong className="w-num">{(100 - pctRepaid).toFixed(0)} %</strong> du capital encore dû
                  </div>
                </div>
              </div>

              {/* Linked asset card */}
              {linkedAsset && (
                <div className="loan-finary-linked">
                  <div className="loan-finary-linked-icon">
                    <Home size={18}/>
                  </div>
                  <div className="loan-finary-linked-text">
                    <div className="loan-finary-linked-label">Actif lié à l'emprunt</div>
                    <div className="loan-finary-linked-name">
                      {linkedAsset.name}{linkedAsset.address ? ` · ${linkedAsset.address}` : ''}
                    </div>
                  </div>
                  <ChevronRight size={16} className="loan-finary-linked-chevron"/>
                </div>
              )}

              {owners && (
                <div className="loan-finary-meta">
                  <Users size={13}/> {owners}
                </div>
              )}
            </>
          )}

          {activeTab === 'mensualites' && (
            <div className="loan-finary-table-wrap">
              {schedule.length === 0 ? (
                <div className="empty-mini" style={{ padding: '60px 0' }}>
                  <BarChart3 size={24}/>
                  <p>Échéancier indisponible — renseigne capital, taux et durée.</p>
                </div>
              ) : (
                <table className="loan-finary-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="right">Mensualité</th>
                      <th className="right">Capital</th>
                      <th className="right">Intérêts</th>
                      <th className="right">Assurance</th>
                      <th className="right">Capital restant</th>
                      <th className="center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((r, i) => {
                      const isPaid = r.date <= today;
                      return (
                        <tr key={i} className={isPaid ? 'paid' : 'pending'}>
                          <td className="w-num">{formatDate(r.date, { format: 'monthYear' })}</td>
                          <td className="right w-num">{fmt(r.payment)}</td>
                          <td className="right w-num">{fmt(r.capital)}</td>
                          <td className="right w-num">{fmt(r.interest)}</td>
                          <td className="right w-num">{fmt(r.insurance)}</td>
                          <td className="right w-num">{fmt(r.remaining)}</td>
                          <td className="center">
                            <span className={`loan-finary-status ${isPaid ? 'paid' : 'pending'}`}>
                              {isPaid ? 'Payée' : 'À venir'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        <LiabilityPatchStyles/>
      </div>
    </div>
  );
}

function LiabilityPatchStyles() {
  const css = String.raw`
.loan-cost-band {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-top: 16px;
  overflow: hidden;
}
@media (max-width: 720px) { .loan-cost-band { grid-template-columns: 1fr; } }
.loan-cost-item { padding: 16px 20px; border-right: 1px solid var(--border); }
.loan-cost-item:last-child { border-right: none; }
@media (max-width: 720px) {
  .loan-cost-item { border-right: none; border-bottom: 1px solid var(--border); }
  .loan-cost-item:last-child { border-bottom: none; }
}
.loan-cost-val {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 22px;
  line-height: 1.1;
  color: var(--ink);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.loan-cost-meta { color: var(--ink-3); font-size: 12px; margin-top: 6px; line-height: 1.4; }
.loan-cost-meta .w-num { color: var(--ink); font-weight: 500; }
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

// ============================================================================
// WealthItemRow — unified row for accounts + assets + liabilities (v6)
// ============================================================================
function WealthItemRow({ item, fmt, onClick }) {
  const positive = (item.plLatente || 0) >= 0;
  return (
    <div
      className="wealth-item-row"
      onClick={() => onClick && onClick(item)}
      role={onClick ? 'button' : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="wealth-item-row-left">
        <div className="wealth-item-icon">{(item.name || '?').charAt(0).toUpperCase()}</div>
        <div>
          <div className="wealth-item-name">{item.name}</div>
          <div className="wealth-item-meta">
            <span className={`badge badge-${item.syncMode}`}>
              {item.syncMode === 'synced' ? 'Synchronisé' : 'Manuel'}
            </span>
            {item.positions && item.positions.length > 0 && (
              <span className="wealth-item-meta-muted"> · {item.positions.length} positions</span>
            )}
          </div>
        </div>
      </div>
      <div className="wealth-item-row-right">
        <div className="wealth-item-value w-num">{fmt(item.value)}</div>
        {item.plLatente !== null && item.plLatente !== undefined && (
          <div className={`wealth-item-delta ${positive ? 'up' : 'down'}`}>
            {positive ? '+' : ''}{fmt(item.plLatente)}
            {item.plLatentePct !== null && item.plLatentePct !== undefined &&
              ` · ${positive ? '+' : ''}${item.plLatentePct.toFixed(1)}%`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RealEstateDetail — Finary-style rich detail view for real-estate assets.
// Mirrors LiabilityDetail's polish (KPI strip + AreaChart + 3 synth cards).
// ============================================================================
function RealEstateDetail({ asset, liabilities = [], members = [], memberShare, fmt, onEdit, onClose }) {
  const subtypeLabel = {
    RP: 'Résidence principale',
    locative: 'Locatif',
    secondaire: 'Résidence secondaire',
    scpi: 'SCPI',
    other: 'Autre',
  }[asset.subtype] || 'Bien immobilier';

  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const notaryFees = parseFloat(asset.notaryFees) || 0;
  const agencyFees = parseFloat(asset.agencyFees) || 0;
  const worksFees = parseFloat(asset.worksFees) || 0;
  const furnitureFees = parseFloat(asset.furnitureFees) || 0;
  const totalAcquisitionCost = purchasePrice + notaryFees + agencyFees + worksFees + furnitureFees;

  const currentValue = parseFloat(asset.currentValue) || 0;
  const plLatente = currentValue - totalAcquisitionCost;
  const plLatentePct = totalAcquisitionCost > 0 ? (plLatente / totalAcquisitionCost) * 100 : 0;

  const surface = parseFloat(asset.surfaceM2) || 0;
  const pricePerM2 = surface > 0 ? currentValue / surface : 0;
  const purchasePricePerM2 = surface > 0 && purchasePrice > 0 ? purchasePrice / surface : 0;

  const ownershipPct = parseFloat(asset.ownershipPct) || 100;
  const yearsSincePurchase = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  const yieldAnnual = totalAcquisitionCost > 0 && yearsSincePurchase > 0
    ? (plLatente / totalAcquisitionCost / yearsSincePurchase) * 100
    : 0;

  const linkedLoan = liabilities.find(l => l.linkedAssetId === asset.id);
  const remainingCapital = linkedLoan ? parseFloat(linkedLoan.remainingCapital) || 0 : 0;
  const monthlyPayment = linkedLoan ? parseFloat(linkedLoan.monthlyPayment) || 0 : 0;
  const initialCapital = linkedLoan ? parseFloat(linkedLoan.initialCapital) || 0 : 0;
  const netValue = currentValue - remainingCapital;

  const owners = (asset.memberIds || [])
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(' & ') || '—';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal loan-finary-page re-finary-page" onClick={e => e.stopPropagation()}>
        <div className="loan-finary-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Immobilier
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="drawer-title-row">
            <div>
              <h2 className="drawer-title">
                {subtypeLabel} <em>{asset.name}.</em>
              </h2>
              <div className="drawer-meta">
                <span className="badge badge-manual"><Edit3 size={11}/> Manuel</span>
                {asset.address && <span style={{ marginLeft: 8 }}>{asset.address}</span>}
              </div>
            </div>
            <div className="drawer-total">
              <div className="drawer-total-val w-num">{fmt(currentValue)}</div>
              {totalAcquisitionCost > 0 && (
                <div className={`drawer-total-delta ${plLatente >= 0 ? 'up' : 'down'}`}>
                  {plLatente >= 0 ? '+' : ''}{fmt(plLatente)} · {plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          {/* KPI strip — Prix d'acquisition + Caractéristiques */}
          <div className="re-kpi-strip">
            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">PRIX D'ACQUISITION</div>
              <div className="loan-monthly-val w-num">
                <em>{fmt(totalAcquisitionCost)}</em>
              </div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-cobalt"/>Prix d'achat <span className="w-num">{fmt(purchasePrice)}</span></div>
                {notaryFees > 0 && <div><span className="dot dot-sage"/>Frais notaire <span className="w-num">{fmt(notaryFees)}</span></div>}
                {agencyFees > 0 && <div><span className="dot dot-terra"/>Agence <span className="w-num">{fmt(agencyFees)}</span></div>}
                {worksFees > 0 && <div><span className="dot dot-ocre"/>Travaux <span className="w-num">{fmt(worksFees)}</span></div>}
                {furnitureFees > 0 && <div><span className="dot dot-mauve"/>Mobilier <span className="w-num">{fmt(furnitureFees)}</span></div>}
              </div>
            </div>

            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">CARACTÉRISTIQUES</div>
              <div className="re-stats">
                {surface > 0 && <div className="re-stat-row"><span>Surface</span><span className="w-num">{surface} m²</span></div>}
                {pricePerM2 > 0 && <div className="re-stat-row"><span>Prix au m²</span><span className="w-num">{fmt(pricePerM2)} /m²</span></div>}
                {purchasePricePerM2 > 0 && <div className="re-stat-row"><span>Prix d'achat au m²</span><span className="w-num">{fmt(purchasePricePerM2)} /m²</span></div>}
                {asset.constructionYear && <div className="re-stat-row"><span>Année construction</span><span className="w-num">{asset.constructionYear}</span></div>}
                {ownershipPct !== 100 && <div className="re-stat-row"><span>Quote-part</span><span className="w-num">{ownershipPct} %</span></div>}
              </div>
              {asset.purchaseDate && (
                <p className="loan-progress-text">
                  Acheté en <strong className="w-num">{new Date(asset.purchaseDate).getFullYear()}</strong>
                  {yearsSincePurchase >= 1 && <> · il y a <strong className="w-num">{Math.round(yearsSincePurchase)} ans</strong></>}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="loan-finary-body">
          {/* Bilan net du bien — couplé au prêt si lié */}
          {linkedLoan && (
            <div className="re-net-panel">
              <div>
                <div className="loan-monthly-label">PATRIMOINE NET DU BIEN</div>
                <div className="re-net-value w-num">{fmt(netValue)}</div>
                <div className="re-net-meta">
                  <span className="w-num">{fmt(currentValue)} de valeur</span>
                  <span> − </span>
                  <span className="w-num">{fmt(remainingCapital)} de capital restant dû</span>
                </div>
              </div>
              <div className="re-net-loan">
                <div className="loan-monthly-label">PRÊT LIÉ</div>
                <div className="re-net-loan-rows">
                  <div><span>Mensualité</span><span className="w-num">{fmt(monthlyPayment)}</span></div>
                  <div><span>% remboursé</span><span className="w-num">{initialCapital > 0 ? Math.round((1 - remainingCapital / initialCapital) * 100) : 0} %</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Plus-value latente (si data acquisition disponible) */}
          {totalAcquisitionCost > 0 && (
            <div className="re-pl-panel">
              <div className="loan-monthly-label">PLUS-VALUE LATENTE</div>
              <div className={`re-pl-value w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>
                {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                <span className="re-pl-pct">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span>
              </div>
              {yieldAnnual !== 0 && (
                <div className="re-pl-meta">
                  Rendement annualisé : <strong className="w-num">{yieldAnnual >= 0 ? '+' : ''}{yieldAnnual.toFixed(1)} %/an</strong>
                  <em> · avant fiscalité de cession</em>
                </div>
              )}
            </div>
          )}

          {/* Détenteurs */}
          <div className="loan-finary-meta" style={{ marginTop: 4 }}>
            <Users size={13}/> Détenu par {owners}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="secondary-btn" onClick={() => onEdit && onEdit(asset)}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
        <RealEstatePatchStyles/>
      </div>
    </div>
  );
}

function RealEstatePatchStyles() {
  const css = String.raw`
.re-net-panel {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 24px;
  margin-top: 4px;
}
@media (max-width: 720px) { .re-net-panel { grid-template-columns: 1fr; } }
.re-net-value {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 30px;
  line-height: 1.1;
  color: var(--ink);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.re-net-meta { color: var(--ink-3); font-size: 12.5px; margin-top: 6px; }
.re-net-loan { border-left: 1px solid var(--border); padding-left: 24px; }
@media (max-width: 720px) { .re-net-loan { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 16px; } }
.re-net-loan-rows { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.re-net-loan-rows > div { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink-2); }
.re-net-loan-rows .w-num { color: var(--ink); font-weight: 500; }

.re-pl-panel {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 24px;
  margin-top: 12px;
}
.re-pl-value {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 26px;
  line-height: 1.1;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}
.re-pl-pct { font-size: 14px; font-family: var(--font-sans); font-weight: 500; opacity: 0.85; }
.re-pl-meta { color: var(--ink-2); font-size: 12.5px; margin-top: 6px; }
.re-pl-meta em { font-family: var(--font-serif); font-style: italic; color: var(--ink-3); }
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

// ============================================================================
// Shared helper — owners string
// ============================================================================
function ownersList(memberIds = [], members = []) {
  return (memberIds || [])
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(' & ') || '—';
}

// ============================================================================
// LiquidityDetail — Compte courant + Livret (Account OR Asset savings_account)
// ============================================================================
function LiquidityDetail({ item, accounts = [], accountBalances = {}, transactions = [], members = [], fmt, onEdit, onClose }) {
  const isAccount = !!item.isAccount;
  const accountId = isAccount ? item.sourceId : null;
  const balance = isAccount
    ? (accountBalances[accountId] ?? (parseFloat(item.value) || 0))
    : (parseFloat(item.currentValue) || 0);

  const name = item.name || '—';
  const bank = item.bank || '';
  const syncMode = isAccount ? (item.syncMode || 'manual') : 'manual';
  const memberIds = item.memberIds || [];
  const owners = ownersList(memberIds, members);

  const subtype = isAccount
    ? item.subtype
    : (item.type === 'savings_account' ? 'livret' : 'compte_courant');
  const isLivret = subtype === 'livret' || ['Livret A', 'LDDS', 'LEP', 'PEL'].some(k => (name || '').includes(k));

  // Détection du type de produit réglementé (plafond + taux nominal)
  let livretCap = 22950;
  let livretRate = 0.03;
  let livretLabel = 'Livret A';
  const lowerName = (name || '').toLowerCase();
  if (lowerName.includes('ldds')) { livretCap = 12000; livretRate = 0.03; livretLabel = 'LDDS'; }
  else if (lowerName.includes('lep')) { livretCap = 10000; livretRate = 0.06; livretLabel = 'LEP'; }
  else if (lowerName.includes('pel')) { livretCap = 61200; livretRate = 0.025; livretLabel = 'PEL'; }
  else if (lowerName.includes('cel')) { livretCap = 15300; livretRate = 0.02; livretLabel = 'CEL'; }

  const interests = isLivret ? balance * livretRate : 0;
  const fiscalRatio = isLivret && livretCap > 0 ? Math.min(100, (balance / livretCap) * 100) : 0;
  const livretMargin = Math.max(0, livretCap - balance);

  const accountTx = useMemo(() => {
    if (!isAccount || !accountId) return [];
    return [...transactions]
      .filter(t => t.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, accountId, isAccount]);

  const today = new Date();
  const cutoff30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const last30 = accountTx.filter(t => t.date >= cutoff30);
  const inflows30 = last30.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflows30 = last30.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net30 = inflows30 - outflows30;

  // Tendance — moyenne mensuelle sur les 6 derniers mois
  const sixMonthAvg = useMemo(() => {
    if (!isAccount || accountTx.length === 0) return null;
    const monthly = {};
    accountTx.forEach(t => {
      const key = t.date.slice(0, 7);
      monthly[key] = (monthly[key] || 0) + (parseFloat(t.amount) || 0);
    });
    const last6Keys = Object.keys(monthly).sort().slice(-6);
    if (last6Keys.length === 0) return null;
    const sum = last6Keys.reduce((s, k) => s + monthly[k], 0);
    return sum / last6Keys.length;
  }, [accountTx, isAccount]);

  // Chart 90j — vraie data, calculée en remontant les tx depuis le solde actuel
  const chartData = useMemo(() => {
    if (!isAccount || accountTx.length === 0) return [];
    let running = balance;
    const points = [];
    const cutoff = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    points.push({ date: today.toISOString().slice(0, 10), balance: Math.round(balance) });
    for (const t of accountTx) {
      if (t.date < cutoff) break;
      running -= (parseFloat(t.amount) || 0);
      points.push({ date: t.date, balance: Math.round(running) });
    }
    return points.reverse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTx, balance, isAccount]);

  // Top 8 transactions récentes — qu'est-ce qui s'est passé sur ce compte
  const recentTx = useMemo(() => accountTx.slice(0, 8), [accountTx]);

  const trendLabel = sixMonthAvg === null ? 'Insuffisant'
    : sixMonthAvg > 50 ? 'Croissant'
    : sixMonthAvg < -50 ? 'Décroissant'
    : 'Stable';

  // Eyebrow type selon le subtype
  const typeLabel = isLivret ? livretLabel
    : subtype === 'pea' ? 'PEA Espèces'
    : subtype === 'av' || subtype === 'life_insurance' ? 'Fonds euro'
    : 'Compte courant';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal dv3-page" onClick={e => e.stopPropagation()}>
        <DetailV3Styles/>

        <div className="dv3-head">
          <button className="dv3-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Liquidités
          </button>
          <button className="dv3-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="dv3-title-row">
            <div className="dv3-title-block">
              <div className="dv3-eyebrow">{typeLabel}{bank ? ` · ${bank}` : ''}</div>
              <h2 className="dv3-title">
                {splitTitle(name).head} <em>{splitTitle(name).tail}.</em>
              </h2>
              <div className="dv3-sub">
                <span className={`dv3-badge ${syncMode === 'synced' ? 'pos' : ''}`}>
                  {syncMode === 'synced' ? '⚡ Synchronisé' : 'Manuel'}
                </span>
                {owners && <><span className="dv3-dot">·</span><span>{owners}</span></>}
              </div>
            </div>
            <div className="dv3-value-block">
              <div className="dv3-hero-num num">{fmt(balance)}</div>
              {isAccount && last30.length > 0 && (
                <div className={`dv3-hero-delta ${net30 >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{net30 >= 0 ? '+' : ''}{fmt(net30)}</span>
                  <span className="dv3-dot">·</span>
                  <span>30 j</span>
                </div>
              )}
            </div>
          </div>

          <div className="dv3-kpis">
            <div className="dv3-kpi">
              <div className="ds-micro">Entrées · 30j</div>
              <div className="dv3-kpi-val num pos">+{fmt(inflows30)}</div>
            </div>
            <div className="dv3-kpi">
              <div className="ds-micro">Sorties · 30j</div>
              <div className="dv3-kpi-val num neg">−{fmt(outflows30)}</div>
            </div>
            <div className="dv3-kpi">
              <div className="ds-micro">Tendance 6 mois</div>
              <div className="dv3-kpi-val num">
                {sixMonthAvg === null ? '—' : `${sixMonthAvg >= 0 ? '+' : ''}${fmt(sixMonthAvg)}`}
                <span className="dv3-kpi-meta"> /mois · {trendLabel}</span>
              </div>
            </div>
            {isLivret && (
              <div className="dv3-kpi">
                <div className="ds-micro">Plafond {livretLabel}</div>
                <div className="dv3-kpi-val num">
                  {fiscalRatio.toFixed(0)} %
                  <span className="dv3-kpi-meta"> · {fmt(livretCap)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dv3-body">
          {/* Chart 90j — vraie data calculée depuis les transactions */}
          {chartData.length >= 2 && (
            <section className="ds-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">Évolution du solde</div>
                  <div className="ds-panel-sub">90 derniers jours · {accountTx.length} transactions au total</div>
                </div>
              </div>
              <div className="dv3-chart-pad">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ left: 0, right: 16, top: 10, bottom: 8 }}>
                    <defs>
                      <linearGradient id="liqBalanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18}/>
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 6))}/>
                    <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Solde']}
                      labelFormatter={(d) => formatDate(d)}
                      contentStyle={DV3_TOOLTIP}
                      cursor={{ stroke: 'var(--ink-mute)', strokeDasharray: '3 3' }}
                    />
                    <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#liqBalanceFill)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Carte produit réglementé (plafond + intérêts annuels) */}
          {isLivret && (
            <section className="ds-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">{livretLabel} · Épargne réglementée</div>
                  <div className="ds-panel-sub">Taux nominal {(livretRate * 100).toFixed(2)} % — exonéré d'impôt et de prélèvements sociaux</div>
                </div>
                <div className="dv3-livret-yield num pos">
                  +{fmt(interests)} <span className="dv3-kpi-meta">/an estimé</span>
                </div>
              </div>
              <div className="dv3-livret-body">
                <div className="dv3-livret-bar">
                  <div className="dv3-livret-fill" style={{ width: `${fiscalRatio}%` }}/>
                </div>
                <div className="dv3-livret-labels">
                  <span className="num">{fmt(balance)} sur {fmt(livretCap)}</span>
                  <span className="num dv3-livret-margin">
                    {livretMargin > 0 ? `${fmt(livretMargin)} de marge disponible` : 'Plafond atteint — basculer le surplus vers un autre support'}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Liste des dernières transactions — l'info la plus utile pour un compte */}
          {recentTx.length > 0 && (
            <section className="ds-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">Dernières transactions</div>
                  <div className="ds-panel-sub">Les 8 mouvements les plus récents</div>
                </div>
              </div>
              <div className="dv3-tx-list">
                {recentTx.map(t => (
                  <div key={t.id} className="dv3-tx-row">
                    <div className="dv3-tx-info">
                      <div className="dv3-tx-label">{t.label || '(sans libellé)'}</div>
                      <div className="dv3-tx-meta">{formatDate(t.date)}</div>
                    </div>
                    <div className={`dv3-tx-amount num ${t.amount >= 0 ? 'pos' : ''}`}>
                      {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* État vide si actif manuel sans transactions */}
          {!isAccount && (
            <section className="ds-panel">
              <div className="dv3-empty">
                <BarChart3 size={24}/>
                <h3>Actif manuel</h3>
                <p>Cette ligne d'épargne est saisie à la main. Connecte ton compte bancaire pour voir les transactions et l'évolution réelle du solde.</p>
              </div>
            </section>
          )}
        </div>

        <div className="dv3-foot">
          <button className="ds-btn" onClick={() => onEdit && onEdit()}>
            <Edit3 size={14}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// InvestmentDetail — PEA / CTO / AV / PER
// ============================================================================
function InvestmentDetail({ asset, assets = [], members = [], fmt, onEdit, onClose, onSyncPositions }) {
  const positions = useMemo(
    () => assets.filter(a => a.parentAssetId === asset.id || a.parent_asset_id === asset.id),
    [assets, asset.id]
  );
  const hasPositions = positions.length > 0;

  // Récupère les cours live via Yahoo pour toutes les positions qui ont
  // un ticker (champ tickerYahoo / ticker_yahoo / ticker selon migration).
  const positionTickers = useMemo(
    () => positions
      .map(p => (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim())
      .filter(Boolean),
    [positions]
  );
  const demoSeedPrices = useMemo(() => {
    const seeds = {};
    positions.forEach(p => {
      const sym = (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim();
      const qty = parseFloat(p.quantity) || 0;
      const val = parseFloat(p.currentValue) || 0;
      if (sym && qty > 0) seeds[sym] = val / qty;
    });
    return seeds;
  }, [positions]);
  const { prices, loading: liveLoading, refresh: refreshLive } = useLiveQuotes(positionTickers, demoSeedPrices);
  const lastFetchedAt = useMemo(() => {
    let max = 0;
    Object.values(prices).forEach(q => { if (q?.fetchedAt > max) max = q.fetchedAt; });
    return max || null;
  }, [prices]);
  const anyLive = Object.keys(prices).length > 0;

  // Positions enrichies : si tickerYahoo + cours live dispo, on recompose la
  // valeur (qty × livePrice) à la volée. Sinon on retombe sur le saisi.
  const rows = useMemo(() => {
    return positions
      .map(p => {
        const qty = parseFloat(p.quantity) || 0;
        const saisi = parseFloat(p.currentValue) || 0;
        const buy = parseFloat(p.purchasePrice) || 0;
        const sym = (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim();
        const livePx = sym && prices[sym] ? prices[sym].price : null;
        const isLive = livePx != null && qty > 0;
        const value = isLive ? qty * livePx : saisi;
        const cours = isLive ? livePx : (qty > 0 ? saisi / qty : 0);
        const invested = buy * qty;
        const pl = value - invested;
        const plPct = invested > 0 ? (pl / invested) * 100 : 0;
        return {
          id: p.id,
          name: p.name || '—',
          isin: p.isin || sym || '',
          qty,
          cours,
          value,
          saisi,
          isLive,
          pl,
          plPct,
          invested,
          color: positionColor(p.name),
          initial: (p.name || '?').trim()[0]?.toUpperCase() || '?',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [positions, prices]);

  // Recalcule la valeur globale du compte avec les cours live quand dispo.
  const saisiValue = parseFloat(asset.currentValue) || 0;
  const positionsValue = rows.reduce((s, r) => s + r.value, 0);
  const saisiPositionsValue = positions.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  const cashAvailable = Math.max(0, saisiValue - saisiPositionsValue);
  const currentValue = hasPositions
    ? (positionsValue + cashAvailable)
    : saisiValue;

  const invested = hasPositions
    ? positions.reduce((s, p) => s + (parseFloat(p.purchasePrice) || 0) * (parseFloat(p.quantity) || 0), 0)
    : (parseFloat(asset.purchasePrice) || 0);

  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const subtype = asset.type;
  const subtypeLabel = ({ pea: 'PEA', life_insurance: 'Assurance-vie', per: 'PER', stocks: 'CTO' })[subtype] || "Compte d'investissement";
  const isPEA = subtype === 'pea';

  const owners = ownersList(asset.memberIds, members);

  // Sync : pousse les valorisations live dans la DB (positions + compte parent)
  const [syncing, setSyncing] = useState(false);
  const liveRowsToSync = rows.filter(r => r.isLive && Math.abs(r.value - r.saisi) > 0.5);
  const handleSync = async () => {
    if (!onSyncPositions || liveRowsToSync.length === 0) return;
    setSyncing(true);
    try {
      await onSyncPositions(asset, rows);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal inv-v3-page" onClick={e => e.stopPropagation()}>
        <InvestmentDetailStyles/>

        {/* Header */}
        <div className="inv-v3-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Investissements
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="inv-v3-title-row">
            <div className="inv-v3-title-block">
              <div className="inv-v3-eyebrow">{subtypeLabel}</div>
              <h2 className="inv-v3-title">
                {asset.name?.split(' ')[0] || 'Compte'}{' '}
                <em>{asset.name?.split(' ').slice(1).join(' ') || ''}.</em>
              </h2>
              <div className="inv-v3-sub">
                {anyLive
                  ? <span className="dv3-badge dv3-badge-live">Cours live</span>
                  : <span className="dv3-badge">Saisi manuellement</span>}
                {rows.length > 0 && <><span className="inv-v3-dot">·</span><span>{rows.length} position{rows.length > 1 ? 's' : ''}</span></>}
                {owners && <><span className="inv-v3-dot">·</span><span>{owners}</span></>}
                {lastFetchedAt && <><span className="inv-v3-dot">·</span><span>maj il y a {relTimeFromTs(lastFetchedAt)}</span></>}
              </div>
            </div>
            <div className="inv-v3-value-block">
              <div className="inv-v3-hero-num num">{fmt(currentValue)}</div>
              {invested > 0 && (
                <div className={`inv-v3-hero-delta ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  <span className="inv-v3-dot">·</span>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(2)} %</span>
                </div>
              )}
            </div>
          </div>

          {/* Compact KPI strip */}
          <div className="inv-v3-kpis">
            <div className="inv-v3-kpi">
              <div className="ds-micro">Investi</div>
              <div className="inv-v3-kpi-val num">{fmt(invested)}</div>
            </div>
            <div className="inv-v3-kpi">
              <div className="ds-micro">Valorisation</div>
              <div className="inv-v3-kpi-val num">{fmt(currentValue)}</div>
            </div>
            {hasPositions && (
              <div className="inv-v3-kpi">
                <div className="ds-micro">Liquidités</div>
                <div className="inv-v3-kpi-val num">{fmt(cashAvailable)}</div>
              </div>
            )}
            {isPEA && (
              <div className="inv-v3-kpi">
                <div className="ds-micro">Plafond PEA</div>
                <div className="inv-v3-kpi-val num">
                  {Math.round((invested / 150000) * 100)} %
                  <span className="inv-v3-kpi-meta"> de 150 000 €</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body : table de positions Finary-style, ou état vide. */}
        <div className="inv-v3-body">
          {hasPositions ? (
            <section className="ds-panel inv-v3-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">Positions</div>
                  <div className="ds-panel-sub">Triées par valorisation décroissante</div>
                </div>
              </div>

              <div className="inv-v3-table-wrap">
                <div className="inv-v3-cols ds-micro">
                  <div>Nom</div>
                  <div className="cell-r">Quantité</div>
                  <div className="cell-r">Cours</div>
                  <div className="cell-r">Valeur</div>
                  <div className="cell-r">+/- value</div>
                </div>
                {rows.map(r => (
                  <div key={r.id} className="inv-v3-row">
                    <div className="inv-v3-name">
                      <span className="inv-v3-logo" style={{ background: r.color }}>{r.initial}</span>
                      <div className="inv-v3-name-block">
                        <div className="inv-v3-name-line">{r.name}</div>
                        {r.isin && <div className="inv-v3-name-meta mono">{r.isin}</div>}
                      </div>
                    </div>
                    <div className="cell-r num">{formatQty(r.qty)}</div>
                    <div className="cell-r num">{fmt(r.cours)}</div>
                    <div className="cell-r num inv-v3-val">{fmt(r.value)}</div>
                    <div className={`cell-r inv-v3-pl ${r.pl >= 0 ? 'pos' : 'neg'}`}>
                      <div className="num">{r.pl >= 0 ? '+' : ''}{fmt(r.pl)}</div>
                      {r.invested > 0 && (
                        <div className="num inv-v3-pl-pct">
                          {r.pl >= 0 ? '+' : ''}{r.plPct.toFixed(2)} %
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {cashAvailable > 0 && (
                <div className="inv-v3-cash-row">
                  <div className="inv-v3-name">
                    <span className="inv-v3-logo inv-v3-logo-cash">€</span>
                    <div className="inv-v3-name-block">
                      <div className="inv-v3-name-line">Liquidités du compte</div>
                      <div className="inv-v3-name-meta">Cash disponible</div>
                    </div>
                  </div>
                  <div className="cell-r num inv-v3-val">{fmt(cashAvailable)}</div>
                </div>
              )}
            </section>
          ) : (
            <section className="ds-panel inv-v3-empty">
              <div className="inv-v3-empty-inner">
                <BarChart3 size={28}/>
                <h3>Aucune position importée</h3>
                <p>Importe le relevé de positions de ton broker (CSV Bourse Direct, Boursorama…) pour voir le détail ligne à ligne. En attendant la valorisation globale du compte reste à <strong>{fmt(currentValue)}</strong>.</p>
              </div>
            </section>
          )}
        </div>

        <div className="inv-v3-foot">
          {liveRowsToSync.length > 0 && (
            <button
              className="ds-btn"
              onClick={handleSync}
              disabled={syncing}
              title={`Pousser le cours live dans ${liveRowsToSync.length} position(s)`}
            >
              <RefreshCw size={13} style={{ animation: syncing || liveLoading ? 'spin 1s linear infinite' : undefined }}/>
              {syncing ? 'Sync…' : `Synchroniser ${liveRowsToSync.length} position${liveRowsToSync.length > 1 ? 's' : ''}`}
            </button>
          )}
          <button className="ds-btn" onClick={() => onEdit && onEdit()}>
            <Edit3 size={14}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// Couleur déterministe par nom (cobalt / sage / terracotta / mauve / pink / grey / ocre).
function positionColor(name) {
  const colors = ['#2540D9', '#1F8E6E', '#C2733B', '#7B57C6', '#B85D7A', '#4D4D4D', '#E0B23E', '#7a8aa8'];
  if (!name) return colors[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function formatQty(q) {
  if (q === 0) return '0';
  if (Math.abs(q) >= 100) return q.toFixed(0);
  if (Math.abs(q) >= 1) return q.toFixed(2);
  return q.toFixed(4).replace(/\.?0+$/, '');
}

function InvestmentDetailStyles() {
  const css = `
.inv-v3-page {
  max-width: 1180px; width: 95vw;
  max-height: 92vh;
  display: flex; flex-direction: column;
  padding: 0;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.inv-v3-page .num { font-variant-numeric: tabular-nums; }
.inv-v3-page .mono { font-family: var(--font-mono); }
.inv-v3-page .cell-r { text-align: right; }

/* Header */
.inv-v3-head {
  position: relative;
  padding: 18px 28px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.inv-v3-head .drawer-back {
  background: transparent; border: none; padding: 0;
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-3);
  cursor: pointer;
  margin-bottom: 14px;
  transition: color var(--t-fast);
}
.inv-v3-head .drawer-back:hover { color: var(--ink); }
.inv-v3-head .drawer-close {
  position: absolute; top: 16px; right: 18px;
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elev);
  color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.inv-v3-head .drawer-close:hover { background: var(--bg-hover); color: var(--ink); }

.inv-v3-title-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; flex-wrap: wrap;
}
.inv-v3-title-block { min-width: 0; flex: 1; }
.inv-v3-eyebrow {
  font: 500 11px/1.2 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}
.inv-v3-title {
  font: 500 26px/1.15 var(--font-sans);
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 6px;
}
.inv-v3-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
  color: var(--ink-2);
}
.inv-v3-sub {
  display: inline-flex; align-items: center; gap: 6px;
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-3);
}
.inv-v3-dot { color: var(--ink-mute); padding: 0 2px; }

.inv-v3-value-block { text-align: right; }
.inv-v3-hero-num {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 38px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
}
.inv-v3-hero-delta {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font: 500 13px/1 var(--font-sans);
}
.inv-v3-hero-delta.pos { background: var(--positive-soft); color: var(--positive); }
.inv-v3-hero-delta.neg { background: var(--negative-soft); color: var(--negative); }

/* KPI strip */
.inv-v3-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin: 20px -28px 0;
  border-top: 1px solid var(--border);
}
.inv-v3-kpi {
  padding: 14px 20px;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 4px;
}
.inv-v3-kpi:last-child { border-right: none; }
.inv-v3-kpi-val {
  font: 500 16px/1.1 var(--font-sans);
  color: var(--ink);
}
.inv-v3-kpi-meta {
  font: 400 11px/1 var(--font-sans);
  color: var(--ink-3);
  margin-left: 4px;
}

/* Body */
.inv-v3-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  background: var(--bg);
}
.inv-v3-panel { background: var(--bg-elev); }

.inv-v3-table-wrap { padding: 0; }
.inv-v3-cols {
  display: grid;
  grid-template-columns: 2.2fr 0.9fr 0.9fr 1fr 1.2fr;
  gap: 14px;
  padding: 10px 20px;
  background: var(--bg-sunk);
  border-bottom: 1px solid var(--border);
}
.inv-v3-row {
  display: grid;
  grid-template-columns: 2.2fr 0.9fr 0.9fr 1fr 1.2fr;
  gap: 14px;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  transition: background var(--t-fast);
}
.inv-v3-row:first-of-type { border-top: none; }
.inv-v3-row:hover { background: var(--bg-hover); }

.inv-v3-name { display: flex; align-items: center; gap: 12px; min-width: 0; }
.inv-v3-logo {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font: 600 12px/1 var(--font-sans);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.inv-v3-logo-cash {
  background: var(--bg-sunk);
  color: var(--ink-2);
  border: 1px solid var(--border);
  font-family: var(--font-serif);
  font-size: 16px;
}
.inv-v3-name-block { min-width: 0; }
.inv-v3-name-line {
  font: 500 14px/1.2 var(--font-sans);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inv-v3-name-meta {
  font: 400 11px/1.2 var(--font-mono);
  color: var(--ink-3);
  margin-top: 2px;
  letter-spacing: 0.02em;
}

.inv-v3-val { font: 500 14px/1.2 var(--font-sans); color: var(--ink); }
.inv-v3-pl { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font: 500 13px/1.2 var(--font-sans); }
.inv-v3-pl.pos { color: var(--positive); }
.inv-v3-pl.neg { color: var(--negative); }
.inv-v3-pl-pct { font-size: 11px; opacity: 0.8; }

.inv-v3-cash-row {
  display: grid;
  grid-template-columns: 2.2fr 0.9fr 0.9fr 1fr 1.2fr;
  gap: 14px;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-sunk);
}
.inv-v3-cash-row > .cell-r { grid-column: 5; }

.inv-v3-empty { padding: 0; }
.inv-v3-empty-inner {
  padding: 48px 24px;
  text-align: center;
  color: var(--ink-3);
}
.inv-v3-empty-inner svg { color: var(--ink-3); margin-bottom: 12px; }
.inv-v3-empty-inner h3 {
  margin: 0 0 8px;
  font: 500 16px/1.2 var(--font-sans);
  color: var(--ink);
}
.inv-v3-empty-inner p {
  margin: 0 auto;
  max-width: 520px;
  font: 400 13px/1.55 var(--font-sans);
}
.inv-v3-empty-inner strong { color: var(--ink); font-weight: 500; }

/* Footer */
.inv-v3-foot {
  padding: 14px 28px;
  border-top: 1px solid var(--border);
  background: var(--bg-elev);
  display: flex; justify-content: flex-end; gap: 8px;
}

/* Mobile */
@media (max-width: 720px) {
  .inv-v3-page { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
  .inv-v3-head { padding: 14px 18px 0; }
  .inv-v3-head .drawer-close { top: 12px; right: 12px; }
  .inv-v3-title { font-size: 22px; }
  .inv-v3-hero-num { font-size: 30px; }
  .inv-v3-kpis { margin: 16px -18px 0; grid-template-columns: repeat(2, 1fr); }
  .inv-v3-kpi { padding: 12px 16px; }
  .inv-v3-kpi:nth-child(2n) { border-right: none; }
  .inv-v3-body { padding: 14px; }
  .inv-v3-cols,
  .inv-v3-row,
  .inv-v3-cash-row {
    grid-template-columns: 1.5fr 1fr 1.1fr;
    gap: 10px;
    padding: 12px 14px;
  }
  .inv-v3-cols > div:nth-child(2),
  .inv-v3-cols > div:nth-child(3),
  .inv-v3-row > .cell-r:nth-child(2),
  .inv-v3-row > .cell-r:nth-child(3) { display: none; }
  .inv-v3-cash-row > .cell-r { grid-column: 3; }
  .inv-v3-foot { padding: 12px 18px; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

// ============================================================================
// CryptoDetail — Single crypto asset
// ============================================================================
function CryptoDetail({ asset, members = [], fmt, onEdit, onClose, onSync }) {
  const quantity = parseFloat(asset.quantity) || 0;
  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const ticker = (asset.ticker || '').toUpperCase();
  const saisiValue = parseFloat(asset.currentValue) || 0;
  const saisiUnitPrice = quantity > 0 ? saisiValue / quantity : 0;

  // Cours live via Yahoo (BTC-EUR, ETH-EUR…)
  const yahooSym = cryptoToYahoo(ticker);
  const { prices, loading: liveLoading, refresh } = useLiveQuotes(
    yahooSym ? [yahooSym] : [],
    yahooSym ? { [yahooSym]: saisiUnitPrice } : {}
  );
  const liveQuote = yahooSym ? prices[yahooSym] : null;
  const livePrice = liveQuote?.price ?? null;
  const isLive = livePrice != null && quantity > 0;

  // Valeur utilisée pour tous les calculs : live si dispo, sinon saisi
  const currentValue = isLive ? quantity * livePrice : saisiValue;
  const unitPrice = isLive ? livePrice : saisiUnitPrice;

  const invested = purchasePrice * quantity;
  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const owners = ownersList(asset.memberIds, members);

  // Date helpers — combien de temps depuis l'achat
  const yearsSincePurchase = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  // Performance annualisée (CAGR) — bien plus parlant que le total %
  const cagrPct = invested > 0 && yearsSincePurchase >= 0.1
    ? (Math.pow(currentValue / invested, 1 / yearsSincePurchase) - 1) * 100
    : null;

  // Sync : pousse la valeur live dans currentValue (vrai bouton dans le footer)
  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    if (!isLive || !onSync) return;
    setSyncing(true);
    try { await onSync(asset, currentValue); } finally { setSyncing(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal dv3-page" onClick={e => e.stopPropagation()}>
        <DetailV3Styles/>

        <div className="dv3-head">
          <button className="dv3-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Cryptos
          </button>
          <button className="dv3-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="dv3-title-row">
            <div className="dv3-title-block-with-logo">
              <span className="dv3-crypto-logo" style={{ background: cryptoColor(ticker || asset.name) }}>
                {(ticker || asset.name || '?').slice(0, 3)}
              </span>
              <div>
                <div className="dv3-eyebrow">Crypto-actif</div>
                <h2 className="dv3-title">
                  {asset.name.split(' ')[0]} <em>{asset.name.split(' ').slice(1).join(' ') || ticker || ''}.</em>
                </h2>
                <div className="dv3-sub">
                  {isLive
                    ? <span className="dv3-badge dv3-badge-live">Cours live</span>
                    : <span className="dv3-badge">Saisi manuellement</span>}
                  {ticker && <><span className="dv3-dot">·</span><span className="mono">{ticker}</span></>}
                  {owners && <><span className="dv3-dot">·</span><span>{owners}</span></>}
                  {liveQuote?.fetchedAt && (
                    <><span className="dv3-dot">·</span><span>maj il y a {relTimeFromTs(liveQuote.fetchedAt)}</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="dv3-value-block">
              <div className="dv3-hero-num num">{fmt(currentValue)}</div>
              {invested > 0 && (
                <div className={`dv3-hero-delta ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  <span className="dv3-dot">·</span>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(2)} %</span>
                </div>
              )}
            </div>
          </div>

          <div className="dv3-kpis">
            <div className="dv3-kpi">
              <div className="ds-micro">Quantité détenue</div>
              <div className="dv3-kpi-val num">{formatCryptoQty(quantity)} {ticker && <span className="dv3-kpi-meta">{ticker}</span>}</div>
            </div>
            <div className="dv3-kpi">
              <div className="ds-micro">Prix de revient</div>
              <div className="dv3-kpi-val num">{fmt(purchasePrice)}<span className="dv3-kpi-meta"> / unité</span></div>
            </div>
            <div className="dv3-kpi">
              <div className="ds-micro">Cours actuel{isLive && <span className="dv3-live-tag"> ● live</span>}</div>
              <div className="dv3-kpi-val num">
                {fmt(unitPrice)}<span className="dv3-kpi-meta"> / unité</span>
                {isLive && saisiUnitPrice > 0 && Math.abs(saisiUnitPrice - unitPrice) / saisiUnitPrice > 0.005 && (
                  <span className="dv3-kpi-meta"> · saisi {fmt(saisiUnitPrice)}</span>
                )}
              </div>
            </div>
            {cagrPct !== null && (
              <div className="dv3-kpi">
                <div className="ds-micro">Perf. annualisée</div>
                <div className={`dv3-kpi-val num ${cagrPct >= 0 ? 'pos' : 'neg'}`}>
                  {cagrPct >= 0 ? '+' : ''}{cagrPct.toFixed(1)} %<span className="dv3-kpi-meta"> /an</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {asset.notes && (
          <div className="dv3-body">
            <section className="ds-panel">
              <div className="dv3-notes-body">{asset.notes}</div>
            </section>
          </div>
        )}

        <div className="dv3-foot">
          <div className="dv3-foot-meta">
            {asset.purchaseDate && <span>Acquis le <span className="num">{formatDate(asset.purchaseDate)}</span></span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isLive && Math.abs(saisiValue - currentValue) > 1 && (
              <button
                className="ds-btn"
                onClick={handleSync}
                disabled={syncing}
                title="Mettre à jour la valorisation enregistrée avec le cours live"
              >
                <RefreshCw size={13} style={{ animation: syncing || liveLoading ? 'spin 1s linear infinite' : undefined }}/>
                {syncing ? 'Sync…' : 'Synchroniser la valeur'}
              </button>
            )}
            <button className="ds-btn" onClick={() => onEdit && onEdit()}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OtherAssetDetail — Or, montres, collectibles, autres
// ============================================================================
function OtherAssetDetail({ asset, members = [], fmt, onEdit, onClose }) {
  const currentValue = parseFloat(asset.currentValue) || 0;
  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const plLatente = currentValue - purchasePrice;
  const plLatentePct = purchasePrice > 0 ? (plLatente / purchasePrice) * 100 : 0;

  const subtypeLabel = asset.subtype || 'Autre actif';
  const owners = ownersList(asset.memberIds, members);

  const yearsSincePurchase = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  const cagrPct = purchasePrice > 0 && yearsSincePurchase >= 0.5
    ? (Math.pow(currentValue / purchasePrice, 1 / yearsSincePurchase) - 1) * 100
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal dv3-page dv3-page-narrow" onClick={e => e.stopPropagation()}>
        <DetailV3Styles/>

        <div className="dv3-head">
          <button className="dv3-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Autres actifs
          </button>
          <button className="dv3-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="dv3-title-row">
            <div className="dv3-title-block-with-logo">
              <span className="dv3-other-logo"><Sparkles size={18}/></span>
              <div>
                <div className="dv3-eyebrow">{subtypeLabel}</div>
                <h2 className="dv3-title">
                  {asset.name.split(' ')[0]} <em>{asset.name.split(' ').slice(1).join(' ') || ''}.</em>
                </h2>
                <div className="dv3-sub">
                  <span className="dv3-badge">Manuel</span>
                  {owners && <><span className="dv3-dot">·</span><span>{owners}</span></>}
                </div>
              </div>
            </div>
            <div className="dv3-value-block">
              <div className="dv3-hero-num num">{fmt(currentValue)}</div>
              {purchasePrice > 0 && (
                <div className={`dv3-hero-delta ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  <span className="dv3-dot">·</span>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dv3-body">
          <section className="ds-panel">
            <div className="ds-panel-head">
              <div>
                <div className="ds-panel-title">Détail de l'actif</div>
                {asset.purchaseDate && yearsSincePurchase >= 0.5 && (
                  <div className="ds-panel-sub">
                    Détenu depuis {yearsSincePurchase < 1 ? `${Math.round(yearsSincePurchase * 12)} mois` : `${yearsSincePurchase.toFixed(1)} ans`}
                  </div>
                )}
              </div>
            </div>
            <div className="dv3-kv-list">
              {asset.subtype && (
                <div className="dv3-kv-row">
                  <span>Catégorie</span>
                  <span>{subtypeLabel}</span>
                </div>
              )}
              <div className="dv3-kv-row">
                <span>Prix d'achat</span>
                <span className="num">{fmt(purchasePrice)}</span>
              </div>
              {asset.purchaseDate && (
                <div className="dv3-kv-row">
                  <span>Date d'acquisition</span>
                  <span>{formatDate(asset.purchaseDate)}</span>
                </div>
              )}
              <div className="dv3-kv-row dv3-kv-sep">
                <span>Valeur actuelle estimée</span>
                <span className="num dv3-kv-bold">{fmt(currentValue)}</span>
              </div>
              {purchasePrice > 0 && (
                <div className="dv3-kv-row">
                  <span>Plus-value latente</span>
                  <span className={`num dv3-kv-bold ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                    {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                    <span className="dv3-kv-pct"> · {plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span>
                  </span>
                </div>
              )}
              {cagrPct !== null && (
                <div className="dv3-kv-row">
                  <span>Performance annualisée</span>
                  <span className={`num ${cagrPct >= 0 ? 'pos' : 'neg'}`}>
                    {cagrPct >= 0 ? '+' : ''}{cagrPct.toFixed(1)} % /an
                  </span>
                </div>
              )}
              <div className="dv3-kv-row">
                <span>Détenteur·s</span>
                <span>{owners}</span>
              </div>
            </div>
          </section>

          {asset.notes && (
            <section className="ds-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">Notes</div>
                </div>
              </div>
              <div className="dv3-notes-body">
                {asset.notes}
              </div>
            </section>
          )}
        </div>

        <div className="dv3-foot">
          <button className="ds-btn" onClick={() => onEdit && onEdit()}>
            <Edit3 size={14}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers + styles partagés v3 pour les popups de détail
// (Liquidités, Crypto, Autres + à terme les autres)
// ============================================================================
function splitTitle(name) {
  if (!name) return { head: "—", tail: "" };
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return { head: parts[0], tail: "" };
  return { head: parts[0], tail: parts.slice(1).join(" ") };
}

function formatCryptoQty(q) {
  if (q === 0) return "0";
  if (Math.abs(q) >= 1) return q.toFixed(4).replace(/\.?0+$/, "");
  return q.toFixed(8).replace(/\.?0+$/, "");
}

function cryptoColor(key) {
  const fixed = { BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", USDC: "#2775CA", ADA: "#0033AD", DOT: "#E6007A", BNB: "#F0B90B" };
  if (fixed[key]) return fixed[key];
  const colors = ["#2540D9", "#1F8E6E", "#C2733B", "#7B57C6", "#B85D7A", "#4D4D4D", "#E0B23E"];
  let h = 0;
  for (let i = 0; i < (key || "").length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

const DV3_TOOLTIP = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--ink)",
  boxShadow: "var(--shadow-md)",
};

function DetailV3Styles() {
  const css = String.raw`
.dv3-page {
  max-width: 1100px; width: 95vw;
  max-height: 92vh;
  display: flex; flex-direction: column;
  padding: 0;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.dv3-page-narrow { max-width: 720px; }
.dv3-page .num { font-variant-numeric: tabular-nums; }
.dv3-page .mono { font-family: var(--font-mono); }
.dv3-page .pos { color: var(--positive); }
.dv3-page .neg { color: var(--negative); }

/* Header */
.dv3-head {
  position: relative;
  padding: 18px 28px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.dv3-back {
  background: transparent; border: none; padding: 0;
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-3);
  cursor: pointer;
  margin-bottom: 14px;
  transition: color var(--t-fast);
}
.dv3-back:hover { color: var(--ink); }
.dv3-close {
  position: absolute; top: 16px; right: 18px;
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elev);
  color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.dv3-close:hover { background: var(--bg-hover); color: var(--ink); }

.dv3-title-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; flex-wrap: wrap;
}
.dv3-title-block { min-width: 0; flex: 1; }
.dv3-title-block-with-logo {
  display: flex; align-items: flex-start; gap: 14px;
  min-width: 0; flex: 1;
}
.dv3-eyebrow {
  font: 500 11px/1.2 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}
.dv3-title {
  font: 500 26px/1.15 var(--font-sans);
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 6px;
}
.dv3-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
  color: var(--ink-2);
}
.dv3-sub {
  display: inline-flex; align-items: center; gap: 8px;
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-3);
  flex-wrap: wrap;
}
.dv3-dot { color: var(--ink-mute); padding: 0 2px; }
.dv3-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  font: 500 11px/1.4 var(--font-sans);
  letter-spacing: 0.02em;
  background: var(--neutral-soft);
  color: var(--ink-2);
  border-radius: 999px;
}
.dv3-badge.pos { background: var(--positive-soft); color: var(--positive); }
.dv3-badge-live {
  background: var(--positive-soft);
  color: var(--positive);
  position: relative;
}
.dv3-badge-live::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 50%; transform: translateY(-50%);
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--positive);
  animation: dv3-pulse 2s ease-in-out infinite;
}
.dv3-badge-live { padding-left: 20px; }
.dv3-live-tag {
  color: var(--positive);
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.04em;
}
@keyframes dv3-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes spin { to { transform: rotate(360deg); } }

.dv3-crypto-logo {
  width: 44px; height: 44px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font: 700 11px/1 var(--font-mono);
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.dv3-other-logo {
  width: 44px; height: 44px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-2);
  flex-shrink: 0;
}

.dv3-value-block { text-align: right; }
.dv3-hero-num {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 38px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
}
.dv3-hero-delta {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font: 500 13px/1 var(--font-sans);
}
.dv3-hero-delta.pos { background: var(--positive-soft); color: var(--positive); }
.dv3-hero-delta.neg { background: var(--negative-soft); color: var(--negative); }

/* KPI strip */
.dv3-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin: 20px -28px 0;
  border-top: 1px solid var(--border);
}
.dv3-kpi {
  padding: 14px 20px;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 4px;
}
.dv3-kpi:last-child { border-right: none; }
.dv3-kpi-val {
  font: 500 15px/1.2 var(--font-sans);
  color: var(--ink);
}
.dv3-kpi-meta {
  font: 400 11px/1 var(--font-sans);
  color: var(--ink-3);
  margin-left: 2px;
  font-weight: 400;
}
.dv3-kpi-val.pos { color: var(--positive); }
.dv3-kpi-val.neg { color: var(--negative); }

/* Body */
.dv3-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  background: var(--bg);
  display: flex; flex-direction: column; gap: 14px;
}
.dv3-body .ds-panel { background: var(--bg-elev); }
.dv3-chart-pad { padding: 16px 20px 20px; }

/* KV list (clé/valeur) */
.dv3-kv-list { padding: 4px 0 12px; }
.dv3-kv-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 16px;
  padding: 10px 20px;
  border-top: 1px solid var(--border);
  font: 400 13px/1.4 var(--font-sans);
  color: var(--ink-2);
}
.dv3-kv-row:first-child { border-top: none; }
.dv3-kv-row > span:first-child { color: var(--ink-2); }
.dv3-kv-row > span:last-child { color: var(--ink); text-align: right; }
.dv3-kv-row em { font-family: var(--font-serif); font-style: italic; font-size: 12px; color: var(--ink-3); }
.dv3-kv-sep { border-top: 1px solid var(--border-strong); margin-top: 4px; }
.dv3-kv-bold { font: 500 15px/1.2 var(--font-sans); }
.dv3-kv-pct { font-size: 12px; font-weight: 400; opacity: 0.85; }
.dv3-kv-notes { flex-direction: column; align-items: flex-start; gap: 4px; }
.dv3-kv-notes-text {
  font-family: var(--font-serif); font-style: italic; font-size: 14px;
  color: var(--ink-2); text-align: left !important;
  margin-top: 4px;
}

/* Transactions list */
.dv3-tx-list { padding: 0 0 6px; }
.dv3-tx-row {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  transition: background var(--t-fast);
}
.dv3-tx-row:hover { background: var(--bg-hover); }
.dv3-tx-info { min-width: 0; }
.dv3-tx-label {
  font: 500 13.5px/1.2 var(--font-sans);
  color: var(--ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dv3-tx-meta {
  font: 400 11.5px/1.2 var(--font-sans);
  color: var(--ink-3);
  margin-top: 2px;
}
.dv3-tx-amount {
  font: 500 14px/1.2 var(--font-sans);
  color: var(--ink);
  flex-shrink: 0;
}
.dv3-tx-amount.pos { color: var(--positive); }

/* Livret progress */
.dv3-livret-body { padding: 16px 20px 20px; }
.dv3-livret-bar {
  height: 8px;
  background: var(--bg-sunk);
  border-radius: 4px;
  overflow: hidden;
}
.dv3-livret-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width var(--t-med);
}
.dv3-livret-labels {
  display: flex; justify-content: space-between;
  margin-top: 10px;
  font: 400 12px/1.3 var(--font-sans);
  color: var(--ink-2);
}
.dv3-livret-margin { color: var(--ink-3); }
.dv3-livret-yield {
  font: 500 14px/1.2 var(--font-sans);
}

/* Notes panel */
.dv3-notes-body {
  padding: 16px 20px 20px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-2);
}

/* Empty state */
.dv3-empty {
  padding: 36px 24px;
  text-align: center;
  color: var(--ink-3);
}
.dv3-empty svg { color: var(--ink-3); margin-bottom: 12px; }
.dv3-empty h3 {
  margin: 0 0 8px;
  font: 500 15px/1.2 var(--font-sans);
  color: var(--ink);
}
.dv3-empty p {
  margin: 0 auto;
  max-width: 460px;
  font: 400 13px/1.55 var(--font-sans);
}

/* Footer */
.dv3-foot {
  padding: 14px 28px;
  border-top: 1px solid var(--border);
  background: var(--bg-elev);
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
}
.dv3-foot-meta {
  font: 400 12px/1.3 var(--font-sans);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.dv3-foot-meta:empty { display: none; }

/* Mobile */
@media (max-width: 720px) {
  .dv3-page { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
  .dv3-head { padding: 14px 18px 0; }
  .dv3-close { top: 12px; right: 12px; }
  .dv3-title { font-size: 22px; }
  .dv3-hero-num { font-size: 30px; }
  .dv3-kpis { margin: 16px -18px 0; grid-template-columns: repeat(2, 1fr); }
  .dv3-kpi { padding: 12px 16px; }
  .dv3-kpi:nth-child(2n) { border-right: none; }
  .dv3-body { padding: 14px; }
  .dv3-foot { padding: 12px 18px; }
  .dv3-kv-row { padding: 10px 14px; }
  .dv3-tx-row { padding: 10px 14px; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
