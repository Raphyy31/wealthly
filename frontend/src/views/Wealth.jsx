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
          onClose={() => setViewingInv(null)}
        />
      )}
      {viewingCrypto && (
        <CryptoDetail
          asset={viewingCrypto}
          members={members}
          fmt={fmt}
          onEdit={() => { setEditingAsset(viewingCrypto); setViewingCrypto(null); }}
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
                current_value: p.quantity * p.lastPrice,
                currency: importingTo.currency || 'EUR',
                quantity: p.quantity,
                purchase_price: p.buyingPrice,
                parent_asset_id: importingTo.sourceId,
                member_ids: importingTo.memberIds || [],
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

              {/* Synthèse — 3 cards horizontales */}
              <div className="loan-synth-cards">
                <div className="card loan-synth-card">
                  <div className="loan-synth-eyebrow">Coût total de l'emprunt</div>
                  <div className="loan-synth-value w-num">{fmt(totalCost)}</div>
                  <ul className="loan-synth-sub">
                    <li><span>Capital</span><span className="w-num">{fmt(principal)}</span></li>
                    <li><span>Intérêts &amp; assurances</span><span className="w-num">{fmt(Math.max(0, totalCost - principal - (parseFloat(l.applicationFees) || 0)))}</span></li>
                    <li><span>Frais de dossier</span><span className="w-num">{l.applicationFees ? fmt(parseFloat(l.applicationFees)) : '—'}</span></li>
                  </ul>
                </div>

                <div className="card loan-synth-card">
                  <div className="loan-synth-eyebrow">Total remboursé</div>
                  <div className="loan-synth-value w-num">{fmt(totalPaid)}</div>
                  <ul className="loan-synth-sub">
                    <li><span>Dont capital</span><span className="w-num">{fmt(totalCapitalPaid)}</span></li>
                    <li><span>Dont intérêts</span><span className="w-num">{fmt(totalInterestPaid)}</span></li>
                    <li><span>Dont assurances</span><span className="w-num">{fmt(totalInsurancePaid)}</span></li>
                  </ul>
                </div>

                <div className="card loan-synth-card">
                  <div className="loan-synth-eyebrow">Capital restant dû</div>
                  <div className="loan-synth-value w-num">{fmt(remainingCapital)}</div>
                  <ul className="loan-synth-sub">
                    <li><span>Restant à rembourser</span><span className="w-num">{fmt(totalRemaining)}</span></li>
                    <li><span>Reste à rembourser (%)</span><span className="w-num">{(100 - pctRepaid).toFixed(0)} %</span></li>
                  </ul>
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
      </div>
    </div>
  );
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

  // Linear interpolation purchase → current value (v1)
  const chartData = [];
  if (asset.purchaseDate && purchasePrice > 0) {
    const startYear = new Date(asset.purchaseDate).getFullYear();
    const endYear = new Date().getFullYear();
    const years = Math.max(1, endYear - startYear);
    for (let i = 0; i <= years; i++) {
      const year = startYear + i;
      const ratio = i / years;
      const interpolated = purchasePrice + (currentValue - purchasePrice) * ratio;
      chartData.push({ year: String(year), value: Math.round(interpolated) });
    }
  }

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
          <div className="loan-finary-grid">
            <div className="loan-finary-chart">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 10, bottom: 8 }}>
                    <defs>
                      <linearGradient id="reValueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                    <XAxis dataKey="year" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Valeur estimée']}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#reValueFill)"/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-mini" style={{ padding: '60px 0' }}>
                  <BarChart3 size={24}/>
                  <p>Renseigne le prix d'achat et la date pour voir l'évolution de la valeur.</p>
                </div>
              )}
            </div>

            <div className="loan-finary-details">
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Valeur actuelle</span>
                  <span className="loan-finary-detail-value w-num">{fmt(currentValue)}</span>
                </div>
                {surface > 0 && (
                  <ul className="loan-finary-sub">
                    <li><span>Prix au m²</span><span className="w-num">{fmt(pricePerM2)} /m²</span></li>
                  </ul>
                )}
              </div>

              {totalAcquisitionCost > 0 && (
                <div className="loan-finary-detail-block">
                  <div className="loan-finary-detail-head">
                    <span>Plus-value latente</span>
                    <span className={`loan-finary-detail-value w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>
                      {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                    </span>
                  </div>
                  <ul className="loan-finary-sub">
                    <li><span>Performance</span><span className="w-num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
                    {yieldAnnual !== 0 && (
                      <li><span>Rendement annualisé</span><span className="w-num">{yieldAnnual >= 0 ? '+' : ''}{yieldAnnual.toFixed(1)} %/an</span></li>
                    )}
                  </ul>
                </div>
              )}

              {linkedLoan && (
                <div className="loan-finary-detail-block">
                  <div className="loan-finary-detail-head">
                    <span>Patrimoine net du bien</span>
                    <span className="loan-finary-detail-value w-num">{fmt(netValue)}</span>
                  </div>
                  <ul className="loan-finary-sub">
                    <li><span>Capital restant dû</span><span className="w-num">{fmt(remainingCapital)}</span></li>
                    <li><span>Mensualité</span><span className="w-num">{fmt(monthlyPayment)}</span></li>
                  </ul>
                </div>
              )}

              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Détenteur·s</span>
                  <span className="loan-finary-detail-value">{owners}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Synthèse cards */}
          <div className="loan-synth-cards">
            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">COÛT TOTAL D'ACQUISITION</div>
              <div className="loan-synth-value w-num"><em>{fmt(totalAcquisitionCost)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Prix d'achat</span><span className="w-num">{fmt(purchasePrice)}</span></li>
                <li><span>Frais d'acquisition</span><span className="w-num">{fmt(notaryFees + agencyFees + worksFees + furnitureFees)}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">VALEUR ACTUELLE</div>
              <div className="loan-synth-value w-num"><em>{fmt(currentValue)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Plus-value latente</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span></li>
                <li><span>Performance</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">{linkedLoan ? 'PATRIMOINE NET DU BIEN' : 'STATUT FINANCIER'}</div>
              <div className="loan-synth-value w-num"><em>{fmt(netValue)}</em></div>
              <ul className="loan-synth-sub">
                {linkedLoan ? (
                  <>
                    <li><span>Reste à rembourser</span><span className="w-num">{fmt(remainingCapital)}</span></li>
                    <li><span>% remboursé</span><span className="w-num">{initialCapital > 0 ? Math.round((1 - remainingCapital / initialCapital) * 100) : 0} %</span></li>
                  </>
                ) : (
                  <li><span>Statut</span><span>Propriété acquittée</span></li>
                )}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="secondary-btn" onClick={() => onEdit && onEdit(asset)}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const syncMode = isAccount ? (item.syncMode || 'manual') : 'manual';
  const memberIds = item.memberIds || [];
  const owners = ownersList(memberIds, members);

  const subtype = isAccount
    ? item.subtype
    : (item.type === 'savings_account' ? 'livret' : 'compte_courant');
  const isLivret = subtype === 'livret';

  let livretCap = 22950;
  let livretRate = 0.03;
  let livretLabel = 'Plafond Livret A';
  const lowerName = (name || '').toLowerCase();
  if (lowerName.includes('ldds')) { livretCap = 12000; livretRate = 0.03; livretLabel = 'Plafond LDDS'; }
  else if (lowerName.includes('lep')) { livretCap = 10000; livretRate = 0.06; livretLabel = 'Plafond LEP'; }
  else if (lowerName.includes('pel')) { livretCap = 61200; livretRate = 0.025; livretLabel = 'Plafond PEL'; }

  const interests = isLivret ? balance * livretRate : 0;
  const fiscalRatio = isLivret && livretCap > 0 ? Math.min(100, (balance / livretCap) * 100) : 0;

  const accountTx = useMemo(() => {
    if (!isAccount || !accountId) return [];
    return transactions.filter(t => t.accountId === accountId);
  }, [transactions, accountId, isAccount]);

  const today = new Date();
  const cutoff30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const last30 = accountTx.filter(t => t.date >= cutoff30);
  const inflows30 = last30.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflows30 = last30.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net30 = inflows30 - outflows30;

  const yearStart = `${today.getFullYear()}-01-01`;
  const ytdTx = accountTx.filter(t => t.date >= yearStart);
  const inflowsYTD = ytdTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflowsYTD = ytdTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netYTD = inflowsYTD - outflowsYTD;

  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const monthTx = accountTx.filter(t => t.date >= monthStart);
  const inflowsMonth = monthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflowsMonth = monthTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netMonth = inflowsMonth - outflowsMonth;

  const chartData = useMemo(() => {
    if (!isAccount || accountTx.length === 0) return [];
    const sorted = [...accountTx].sort((a, b) => b.date.localeCompare(a.date));
    let running = balance;
    const points = [];
    const cutoff = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    points.push({ date: today.toISOString().slice(0, 10), balance: Math.round(balance) });
    for (const t of sorted) {
      if (t.date < cutoff) break;
      running -= (parseFloat(t.amount) || 0);
      points.push({ date: t.date, balance: Math.round(running) });
    }
    return points.reverse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTx, balance, isAccount]);

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

  const trendDir = sixMonthAvg === null ? '→'
    : sixMonthAvg > 50 ? '↑'
    : sixMonthAvg < -50 ? '↓'
    : '→';
  const trendLabel = sixMonthAvg === null ? 'Insuffisant'
    : sixMonthAvg > 50 ? 'Croissant'
    : sixMonthAvg < -50 ? 'Décroissant'
    : 'Stable';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal loan-finary-page" onClick={e => e.stopPropagation()}>
        <div className="loan-finary-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Liquidités
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="drawer-title-row">
            <div>
              <h2 className="drawer-title">
                {isLivret ? 'Livret' : 'Compte'} <em>{name}.</em>
              </h2>
              <div className="drawer-meta">
                <span className={`badge badge-${syncMode}`}>
                  {syncMode === 'synced' ? 'Synchronisé' : 'Manuel'}
                </span>
              </div>
            </div>
            <div className="drawer-total">
              <div className="drawer-total-val w-num">{fmt(balance)}</div>
              {isAccount && last30.length > 0 && (
                <div className={`drawer-total-delta ${net30 >= 0 ? 'up' : 'down'}`}>
                  {net30 >= 0 ? '+' : ''}{fmt(net30)} <em>· 30 j</em>
                </div>
              )}
            </div>
          </div>

          <div className="re-kpi-strip">
            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">SOLDE ACTUEL</div>
              <div className="loan-monthly-val w-num"><em>{fmt(balance)}</em></div>
              <p className="loan-progress-text">
                {isAccount ? 'Solde courant du compte' : 'Valeur actuelle du livret'}
              </p>
            </div>

            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">MOUVEMENTS · 30 J</div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-sage"/>Entrées <span className="w-num pl-up">+{fmt(inflows30)}</span></div>
                <div><span className="dot dot-terra"/>Sorties <span className="w-num pl-down">−{fmt(outflows30)}</span></div>
                <div><span className="dot dot-cobalt"/>Net <span className={`w-num ${net30 >= 0 ? 'pl-up' : 'pl-down'}`}>{net30 >= 0 ? '+' : ''}{fmt(net30)}</span></div>
              </div>
              {!isAccount && (
                <p className="loan-progress-text"><em>Pas de transactions liées à cet actif manuel</em></p>
              )}
            </div>
          </div>
        </div>

        <div className="loan-finary-body">
          <div className="loan-finary-grid">
            <div className="loan-finary-chart">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 10, bottom: 8 }}>
                    <defs>
                      <linearGradient id="liqBalanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 6))}/>
                    <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Solde']}
                      labelFormatter={(d) => formatDate(d)}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#liqBalanceFill)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-mini" style={{ padding: '60px 0' }}>
                  <BarChart3 size={24}/>
                  <p>{isAccount ? "Pas assez de transactions pour tracer l'évolution du solde." : "Connecte ton compte ou ajoute des transactions pour voir l'évolution."}</p>
                </div>
              )}
            </div>

            <div className="loan-finary-details">
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Solde courant</span>
                  <span className="loan-finary-detail-value w-num">{fmt(balance)}</span>
                </div>
              </div>

              {isLivret && (
                <div className="loan-finary-detail-block">
                  <div className="loan-finary-detail-head">
                    <span>{livretLabel}</span>
                    <span className="loan-finary-detail-value w-num">{fmt(balance)} / {fmt(livretCap)}</span>
                  </div>
                  <div className="fiscal-bar"><div className="fiscal-bar-fill" style={{ width: `${fiscalRatio}%` }}/></div>
                  <ul className="loan-finary-sub">
                    <li><span>Atteint</span><span className="w-num">{fiscalRatio.toFixed(0)} %</span></li>
                  </ul>
                </div>
              )}

              {isLivret && (
                <div className="loan-finary-detail-block">
                  <div className="loan-finary-detail-head">
                    <span>Intérêts annuels estimés</span>
                    <span className="loan-finary-detail-value w-num pl-up">+{fmt(interests)}</span>
                  </div>
                  <ul className="loan-finary-sub">
                    <li><span>Taux nominal</span><span className="w-num">{(livretRate * 100).toFixed(2)} %</span></li>
                  </ul>
                </div>
              )}

              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Détenteur·s</span>
                  <span className="loan-finary-detail-value">{owners}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="loan-synth-cards">
            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">CETTE ANNÉE</div>
              <div className="loan-synth-value w-num"><em>{netYTD >= 0 ? '+' : ''}{fmt(netYTD)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Entrées</span><span className="w-num pl-up">+{fmt(inflowsYTD)}</span></li>
                <li><span>Sorties</span><span className="w-num pl-down">−{fmt(outflowsYTD)}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">MOIS COURANT</div>
              <div className="loan-synth-value w-num"><em>{netMonth >= 0 ? '+' : ''}{fmt(netMonth)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Entrées</span><span className="w-num pl-up">+{fmt(inflowsMonth)}</span></li>
                <li><span>Sorties</span><span className="w-num pl-down">−{fmt(outflowsMonth)}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">TENDANCE 6 MOIS</div>
              <div className="loan-synth-value w-num"><em>{trendDir} {trendLabel}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Évolution mensuelle moyenne</span><span className={`w-num ${(sixMonthAvg || 0) >= 0 ? 'pl-up' : 'pl-down'}`}>{sixMonthAvg === null ? '—' : ((sixMonthAvg >= 0 ? '+' : '') + fmt(sixMonthAvg))}</span></li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="secondary-btn" onClick={() => onEdit && onEdit()}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// InvestmentDetail — PEA / CTO / AV / PER
// ============================================================================
function InvestmentDetail({ asset, assets = [], members = [], fmt, onEdit, onClose }) {
  const positions = useMemo(
    () => assets.filter(a => a.parentAssetId === asset.id || a.parent_asset_id === asset.id),
    [assets, asset.id]
  );
  const hasPositions = positions.length > 0;

  const currentValue = parseFloat(asset.currentValue) || 0;
  const positionsValue = positions.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  const cashAvailable = Math.max(0, currentValue - positionsValue);

  const invested = hasPositions
    ? positions.reduce((s, p) => s + (parseFloat(p.purchasePrice) || 0) * (parseFloat(p.quantity) || 0), 0)
    : (parseFloat(asset.purchasePrice) || 0);

  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const subtype = asset.type;
  const subtypeLabel = ({ pea: 'PEA', life_insurance: 'Assurance-vie', per: 'PER', stocks: 'CTO' })[subtype] || "Compte d'investissement";
  const isPEA = subtype === 'pea';

  const owners = ownersList(asset.memberIds, members);

  const topPosition = useMemo(() => {
    if (!hasPositions) return null;
    const sorted = [...positions].sort((a, b) => (parseFloat(b.currentValue) || 0) - (parseFloat(a.currentValue) || 0));
    const top = sorted[0];
    const v = parseFloat(top.currentValue) || 0;
    return { name: top.name, value: v, pct: currentValue > 0 ? (v / currentValue) * 100 : 0 };
  }, [positions, currentValue, hasPositions]);

  const allocData = useMemo(() => {
    if (positions.length < 2) return [];
    const colors = ['var(--d1)', 'var(--d2)', 'var(--d3)', 'var(--d4)', 'var(--d5)', 'var(--d6)', 'var(--d7)'];
    return positions
      .map((p, i) => ({
        name: p.name,
        value: parseFloat(p.currentValue) || 0,
        color: colors[i % colors.length],
        pct: currentValue > 0 ? ((parseFloat(p.currentValue) || 0) / currentValue) * 100 : 0,
      }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [positions, currentValue]);

  const chartData = useMemo(() => {
    if (!asset.purchaseDate || invested <= 0) return [];
    const startYear = new Date(asset.purchaseDate).getFullYear();
    const endYear = new Date().getFullYear();
    const years = Math.max(1, endYear - startYear);
    const pts = [];
    for (let i = 0; i <= years; i++) {
      const ratio = i / years;
      pts.push({ year: String(startYear + i), value: Math.round(invested + (currentValue - invested) * ratio) });
    }
    return pts;
  }, [asset.purchaseDate, invested, currentValue]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal loan-finary-page" onClick={e => e.stopPropagation()}>
        <div className="loan-finary-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Investissements
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
                {hasPositions && <span style={{ marginLeft: 8 }}>{positions.length} positions</span>}
              </div>
            </div>
            <div className="drawer-total">
              <div className="drawer-total-val w-num">{fmt(currentValue)}</div>
              {invested > 0 && (
                <div className={`drawer-total-delta ${plLatente >= 0 ? 'up' : 'down'}`}>
                  {plLatente >= 0 ? '+' : ''}{fmt(plLatente)} · {plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          <div className="re-kpi-strip">
            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">PERFORMANCE</div>
              <div className="loan-monthly-val w-num">
                <em className={plLatente >= 0 ? 'pl-up' : 'pl-down'}>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</em>
              </div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-cobalt"/>Investi <span className="w-num">{fmt(invested)}</span></div>
                <div><span className="dot dot-sage"/>Valeur actuelle <span className="w-num">{fmt(currentValue)}</span></div>
                <div><span className={`dot ${plLatente >= 0 ? 'dot-sage' : 'dot-terra'}`}/>Performance <span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)}%</span></div>
              </div>
            </div>

            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">COMPOSITION</div>
              <div className="loan-monthly-val w-num"><em>{positions.length} position{positions.length > 1 ? 's' : ''}</em></div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-cobalt"/>Titres <span className="w-num">{fmt(positionsValue)}</span></div>
                <div><span className="dot dot-ocre"/>Cash disponible <span className="w-num">{fmt(cashAvailable)}</span></div>
                {topPosition && (
                  <div><span className="dot dot-mauve"/>Top : {topPosition.name} <span className="w-num">{topPosition.pct.toFixed(0)} %</span></div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="loan-finary-body">
          <div className="loan-finary-grid">
            <div className="loan-finary-chart">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 10, bottom: 8 }}>
                    <defs>
                      <linearGradient id="invValueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                    <XAxis dataKey="year" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Valeur']}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#invValueFill)"/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-mini" style={{ padding: '60px 0' }}>
                  <BarChart3 size={24}/>
                  <p>Renseigne la date d'achat et le prix de revient pour voir la courbe.</p>
                </div>
              )}
            </div>

            <div className="loan-finary-details">
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Valeur actuelle</span>
                  <span className="loan-finary-detail-value w-num">{fmt(currentValue)}</span>
                </div>
              </div>

              {invested > 0 && (
                <div className="loan-finary-detail-block">
                  <div className="loan-finary-detail-head">
                    <span>Plus-value latente</span>
                    <span className={`loan-finary-detail-value w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>
                      {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                    </span>
                  </div>
                  <ul className="loan-finary-sub">
                    <li><span>Performance</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
                    <li><span>Capital investi</span><span className="w-num">{fmt(invested)}</span></li>
                  </ul>
                </div>
              )}

              {isPEA && (
                <div className="loan-finary-detail-block">
                  <div className="loan-finary-detail-head">
                    <span>Plafond PEA</span>
                    <span className="loan-finary-detail-value w-num">{fmt(invested)} / {fmt(150000)}</span>
                  </div>
                  <div className="fiscal-bar"><div className="fiscal-bar-fill" style={{ width: `${Math.min(100, (invested / 150000) * 100)}%` }}/></div>
                  <ul className="loan-finary-sub">
                    <li><span>Versements cumulés</span><span className="w-num">{((invested / 150000) * 100).toFixed(0)} %</span></li>
                  </ul>
                </div>
              )}

              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Détenteur·s</span>
                  <span className="loan-finary-detail-value">{owners}</span>
                </div>
              </div>
            </div>
          </div>

          {allocData.length >= 2 && (
            <div className="card invest-allocation">
              <div className="loan-synth-eyebrow">RÉPARTITION DES POSITIONS</div>
              <div className="allocation-body" style={{ marginTop: 12 }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={allocData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2}>
                      {allocData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="invest-allocation-list">
                  {allocData.map((p, i) => (
                    <div key={i} className="invest-allocation-row">
                      <span><span className="invest-allocation-dot" style={{ background: p.color }}/>{p.name}</span>
                      <span><span className="w-num">{fmt(p.value)}</span> · <span className="w-num">{p.pct.toFixed(1)} %</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="loan-synth-cards">
            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">INVESTI</div>
              <div className="loan-synth-value w-num"><em>{fmt(invested)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Capital placé</span><span className="w-num">{fmt(invested)}</span></li>
                <li><span>Nombre de positions</span><span className="w-num">{positions.length}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">VALORISATION ACTUELLE</div>
              <div className="loan-synth-value w-num"><em>{fmt(currentValue)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Performance globale</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
                <li><span>Cash disponible</span><span className="w-num">{fmt(cashAvailable)}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">PLUS-VALUE LATENTE</div>
              <div className="loan-synth-value w-num"><em className={plLatente >= 0 ? 'pl-up' : 'pl-down'}>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>%</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
                <li><span><em>Avant fiscalité</em></span><span/></li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="secondary-btn" onClick={() => onEdit && onEdit()}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CryptoDetail — Single crypto asset
// ============================================================================
function CryptoDetail({ asset, members = [], fmt, onEdit, onClose }) {
  const currentValue = parseFloat(asset.currentValue) || 0;
  const quantity = parseFloat(asset.quantity) || 0;
  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const ticker = asset.ticker || '';

  const invested = purchasePrice * quantity;
  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const unitPrice = quantity > 0 ? currentValue / quantity : 0;
  const owners = ownersList(asset.memberIds, members);

  const chartData = useMemo(() => {
    if (!asset.purchaseDate || invested <= 0) return [];
    const startYear = new Date(asset.purchaseDate).getFullYear();
    const endYear = new Date().getFullYear();
    const years = Math.max(1, endYear - startYear);
    const pts = [];
    for (let i = 0; i <= years; i++) {
      const ratio = i / years;
      pts.push({ year: String(startYear + i), value: Math.round(invested + (currentValue - invested) * ratio) });
    }
    return pts;
  }, [asset.purchaseDate, invested, currentValue]);

  const formatQty = (q) => {
    if (q === 0) return '0';
    if (Math.abs(q) >= 1) return q.toFixed(4).replace(/\.?0+$/, '');
    return q.toFixed(8).replace(/\.?0+$/, '');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal loan-finary-page" onClick={e => e.stopPropagation()}>
        <div className="loan-finary-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Cryptos
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="drawer-title-row">
            <div>
              <h2 className="drawer-title">
                Crypto <em>{asset.name}.</em>
              </h2>
              <div className="drawer-meta">
                <span className="badge badge-manual"><Edit3 size={11}/> Manuel</span>
                {ticker && <span className="crypto-ticker" style={{ marginLeft: 8 }}>{ticker}</span>}
              </div>
            </div>
            <div className="drawer-total">
              <div className="drawer-total-val w-num">{fmt(currentValue)}</div>
              {invested > 0 && (
                <div className={`drawer-total-delta ${plLatente >= 0 ? 'up' : 'down'}`}>
                  {plLatente >= 0 ? '+' : ''}{fmt(plLatente)} · {plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          <div className="re-kpi-strip">
            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">VALEUR ACTUELLE</div>
              <div className="loan-monthly-val w-num"><em>{fmt(currentValue)}</em></div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-cobalt"/>Quantité <span className="w-num">{formatQty(quantity)} {ticker}</span></div>
                <div><span className="dot dot-ocre"/>Cours unitaire <span className="w-num">{fmt(unitPrice)}</span></div>
              </div>
            </div>

            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">PERFORMANCE</div>
              <div className="loan-monthly-val w-num">
                <em className={plLatente >= 0 ? 'pl-up' : 'pl-down'}>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</em>
              </div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-cobalt"/>Investi <span className="w-num">{fmt(invested)}</span></div>
                <div>
                  <span className={`dot ${plLatente >= 0 ? 'dot-sage' : 'dot-terra'}`}/>%
                  <span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="loan-finary-body">
          <div className="loan-finary-grid">
            <div className="loan-finary-chart">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 10, bottom: 8 }}>
                    <defs>
                      <linearGradient id="cryptoValueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                    <XAxis dataKey="year" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                    <Tooltip
                      formatter={(v) => [fmt(v), 'Valeur']}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#cryptoValueFill)"/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-mini" style={{ padding: '60px 0' }}>
                  <Bitcoin size={24}/>
                  <p>Renseigne la date d'achat et le prix de revient pour voir l'évolution.</p>
                </div>
              )}
            </div>

            <div className="loan-finary-details">
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Quantité détenue</span>
                  <span className="loan-finary-detail-value w-num">{formatQty(quantity)} {ticker}</span>
                </div>
              </div>

              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Prix de revient moyen</span>
                  <span className="loan-finary-detail-value w-num">{fmt(purchasePrice)}</span>
                </div>
              </div>

              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Plus-value latente</span>
                  <span className={`loan-finary-detail-value w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>
                    {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                  </span>
                </div>
                {invested > 0 && (
                  <ul className="loan-finary-sub">
                    <li><span>Performance</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
                  </ul>
                )}
              </div>

              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Détenteur·s</span>
                  <span className="loan-finary-detail-value">{owners}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="loan-synth-cards">
            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">DÉTENU</div>
              <div className="loan-synth-value w-num"><em>{formatQty(quantity)} {ticker}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Cours moyen d'achat</span><span className="w-num">{fmt(purchasePrice)}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">VALEUR ACTUELLE</div>
              <div className="loan-synth-value w-num"><em>{fmt(currentValue)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Cours actuel</span><span className="w-num">{fmt(unitPrice)}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">PLUS-VALUE</div>
              <div className="loan-synth-value w-num"><em className={plLatente >= 0 ? 'pl-up' : 'pl-down'}>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>%</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="secondary-btn" onClick={() => onEdit && onEdit()}>
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal loan-finary-page" onClick={e => e.stopPropagation()}>
        <div className="loan-finary-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Autres
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="drawer-title-row">
            <div>
              <h2 className="drawer-title">
                <Sparkles size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }}/>
                Autre actif <em>{asset.name}.</em>
              </h2>
              <div className="drawer-meta">
                <span className="badge badge-manual"><Edit3 size={11}/> Manuel</span>
                {asset.subtype && <span style={{ marginLeft: 8 }}>{subtypeLabel}</span>}
              </div>
            </div>
            <div className="drawer-total">
              <div className="drawer-total-val w-num">{fmt(currentValue)}</div>
              {purchasePrice > 0 && (
                <div className={`drawer-total-delta ${plLatente >= 0 ? 'up' : 'down'}`}>
                  {plLatente >= 0 ? '+' : ''}{fmt(plLatente)} · {plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          <div className="re-kpi-strip" style={{ gridTemplateColumns: '1fr' }}>
            <div className="loan-monthly-panel">
              <div className="loan-monthly-label">VALORISATION</div>
              <div className="loan-monthly-val w-num"><em>{fmt(currentValue)}</em></div>
              <div className="loan-monthly-breakdown">
                <div><span className="dot dot-cobalt"/>Prix d'achat <span className="w-num">{fmt(purchasePrice)}</span></div>
                {purchasePrice > 0 && (
                  <div>
                    <span className={`dot ${plLatente >= 0 ? 'dot-sage' : 'dot-terra'}`}/>
                    Plus-value latente
                    <span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="loan-finary-body">
          <div className="loan-finary-details" style={{ marginTop: 4 }}>
            {asset.subtype && (
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Type / Sous-catégorie</span>
                  <span className="loan-finary-detail-value">{subtypeLabel}</span>
                </div>
              </div>
            )}

            {asset.purchaseDate && (
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Date d'acquisition</span>
                  <span className="loan-finary-detail-value w-num">{formatDate(asset.purchaseDate)}</span>
                </div>
              </div>
            )}

            <div className="loan-finary-detail-block">
              <div className="loan-finary-detail-head">
                <span>Valeur actuelle</span>
                <span className="loan-finary-detail-value w-num">{fmt(currentValue)}</span>
              </div>
            </div>

            <div className="loan-finary-detail-block">
              <div className="loan-finary-detail-head">
                <span>Prix d'achat</span>
                <span className="loan-finary-detail-value w-num">{fmt(purchasePrice)}</span>
              </div>
            </div>

            {purchasePrice > 0 && (
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Plus-value latente</span>
                  <span className={`loan-finary-detail-value w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>
                    {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                  </span>
                </div>
                <ul className="loan-finary-sub">
                  <li><span>Performance</span><span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(1)} %</span></li>
                </ul>
              </div>
            )}

            {asset.notes && (
              <div className="loan-finary-detail-block">
                <div className="loan-finary-detail-head">
                  <span>Notes</span>
                </div>
                <p style={{ margin: '6px 0 0', fontFamily: 'Newsreader, serif', fontStyle: 'italic', color: 'var(--ink-2)', fontSize: 14 }}>
                  {asset.notes}
                </p>
              </div>
            )}

            <div className="loan-finary-detail-block">
              <div className="loan-finary-detail-head">
                <span>Détenteur·s</span>
                <span className="loan-finary-detail-value">{owners}</span>
              </div>
            </div>
          </div>

          <div className="loan-synth-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 24 }}>
            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">ACHAT</div>
              <div className="loan-synth-value w-num"><em>{fmt(purchasePrice)}</em></div>
              <ul className="loan-synth-sub">
                <li><span>Date</span><span className="w-num">{asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}</span></li>
              </ul>
            </div>

            <div className="card loan-synth-card">
              <div className="loan-synth-eyebrow">VALEUR ACTUELLE</div>
              <div className="loan-synth-value w-num"><em>{fmt(currentValue)}</em></div>
              <ul className="loan-synth-sub">
                <li>
                  <span>vs achat</span>
                  <span className={`w-num ${plLatente >= 0 ? 'pl-up' : 'pl-down'}`}>
                    {plLatente >= 0 ? '+' : ''}{fmt(plLatente)}
                    {purchasePrice > 0 && ` · ${plLatente >= 0 ? '+' : ''}${plLatentePct.toFixed(1)} %`}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="secondary-btn" onClick={() => onEdit && onEdit()}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
