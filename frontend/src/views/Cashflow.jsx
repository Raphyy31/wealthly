// ============================================================================
// Cashflow — Sankey + donut for income/expense flows over a chosen period
// ============================================================================
import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, Sankey, Layer, Rectangle, Tooltip,
} from 'recharts';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils.js';
import {
  classifyCashflowTransaction,
  FLOW_KINDS,
  summarizeCashflowFlows,
} from '../financeEngine.js';
import { useIsNarrow } from '../hooks/useIsNarrow.js';
import { usePageEnter } from '../hooks/usePageEnter.js';

export function Cashflow({
  transactions, categories, accounts, memberShare, fmt, currentMonth,
  transferIds = new Set(), jointContribIds = new Set(),
  isHouseholdScope = false, incomeShiftSettings = {},
}) {
  const [period, setPeriod] = useState('1M'); // 1M | 3M | 1A
  const [anchor, setAnchor] = useState(currentMonth); // YYYY-MM the period ends on (inclusive)
  const isNarrow = useIsNarrow(760);
  const rootRef = usePageEnter(); // motion d'entrée standard (charte Forêt)

  const monthsInPeriod = period === '1M' ? 1 : period === '3M' ? 3 : 12;

  // Build the [start, end] window
  const { startKey, endKey } = useMemo(() => {
    const [y, m] = anchor.split('-').map(Number);
    const endDate = new Date(y, m - 1, 1);
    const startDate = new Date(y, m - 1 - (monthsInPeriod - 1), 1);
    const sk = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    return { startKey: sk, endKey: anchor };
  }, [anchor, monthsInPeriod]);

  // Filtre sur le mois BUDGÉTAIRE produit par le moteur commun. Un salaire du
  // 30 juin apparaît donc bien en juillet ici comme sur Accueil et Budget.
  const filtered = useMemo(() => {
    return transactions.map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const sharedAmount = t.amount * share;
      const cat = categories.find(c => c.slug === t.categoryId || c.id === t.categoryId);
      const flow = classifyCashflowTransaction({
        transaction: { ...t, sharedAmount },
        account: acc,
        category: cat,
        accounts,
        isTransfer: transferIds.has(t.id),
        isJointContribution: jointContribIds.has(t.id),
        isHouseholdScope,
        settings: incomeShiftSettings,
      });
      return { ...t, sharedAmount, cashflowKind: flow.kind, cashflowAmount: flow.amount, cashflowMonth: flow.month };
    }).filter(t =>
      t.cashflowMonth >= startKey && t.cashflowMonth <= endKey
      && [FLOW_KINDS.INCOME, FLOW_KINDS.EXPENSE, FLOW_KINDS.SAVING, FLOW_KINDS.FUNDING].includes(t.cashflowKind)
    );
  }, [transactions, startKey, endKey, accounts, categories, memberShare, transferIds, jointContribIds, isHouseholdScope, incomeShiftSettings]);

  const incomeByCat = {};
  const expenseByCat = {};
  let totalSaving = 0;
  filtered.forEach(t => {
    if (t.cashflowKind === FLOW_KINDS.SAVING) {
      totalSaving += t.cashflowAmount;
      return;
    }
    const slug = t.cashflowKind === FLOW_KINDS.FUNDING ? 'joint-funding' : (t.categoryId || 'uncategorized');
    if ([FLOW_KINDS.INCOME, FLOW_KINDS.FUNDING].includes(t.cashflowKind)) {
      incomeByCat[slug] = (incomeByCat[slug] || 0) + t.cashflowAmount;
    } else if (t.cashflowKind === FLOW_KINDS.EXPENSE) {
      expenseByCat[slug] = (expenseByCat[slug] || 0) + t.cashflowAmount;
    }
  });
  const flowTotals = summarizeCashflowFlows(filtered);
  const totalIncome = flowTotals.resources;
  const totalExpense = flowTotals.expense;
  totalSaving = flowTotals.saving;
  const available = flowTotals.balance;

  // Sort categories by amount descending
  const incomeEntries = Object.entries(incomeByCat).sort((a, b) => b[1] - a[1]);
  const expenseEntries = Object.entries(expenseByCat).filter(([, value]) => value > 0.5).sort((a, b) => b[1] - a[1]);

  const catFor = (slug) => slug === 'joint-funding'
    ? { id: slug, name: 'Financement du compte commun', icon: '👥', color: 'var(--positive)' }
    : categories.find(c => c.slug === slug || c.id === slug);

  // Build Sankey data
  const sankeyData = useMemo(() => {
    if (totalIncome === 0 && totalExpense === 0 && totalSaving === 0) return null;
    const nodes = [];
    const links = [];
    // Income nodes (left)
    incomeEntries.forEach(([slug, value]) => {
      const cat = catFor(slug);
      nodes.push({ name: cat?.name || slug, kind: 'income', value, color: cat?.color || 'var(--success)' });
    });
    // Hub
    const hubIdx = nodes.length;
    nodes.push({ name: 'Disponible', kind: 'hub' });
    // Expense nodes (right)
    expenseEntries.forEach(([slug, value]) => {
      const cat = catFor(slug);
      nodes.push({ name: cat?.name || slug, kind: 'expense', value, color: cat?.color || 'var(--danger)' });
    });
    let savingIdx = null;
    if (totalSaving > 0) {
      savingIdx = nodes.length;
      nodes.push({ name: 'Épargne réellement versée', kind: 'savings', value: totalSaving, color: 'var(--primary)' });
    }
    // Le reliquat n'est pas encore de l'épargne : il reste disponible.
    let surplusIdx = null;
    if (available > 0) {
      surplusIdx = nodes.length;
      nodes.push({ name: 'Reste disponible', kind: 'available', value: available, color: 'var(--ink-3)' });
    }
    // Links: income → hub, hub → expense / savings
    incomeEntries.forEach((_, i) => {
      links.push({ source: i, target: hubIdx, value: incomeEntries[i][1] });
    });
    expenseEntries.forEach((_, i) => {
      const idx = hubIdx + 1 + i;
      links.push({ source: hubIdx, target: idx, value: expenseEntries[i][1] });
    });
    if (savingIdx !== null) links.push({ source: hubIdx, target: savingIdx, value: totalSaving });
    if (surplusIdx !== null) {
      links.push({ source: hubIdx, target: surplusIdx, value: available });
    }
    return { nodes, links };
  // eslint-disable-next-line
  }, [incomeByCat, expenseByCat, available, totalIncome, totalExpense, totalSaving, categories]);

  // Distribution donut data — expense categories
  const donutData = expenseEntries.map(([slug, value]) => {
    const cat = catFor(slug);
    return { name: cat?.name || slug, value, color: cat?.color || '#999' };
  });

  // Period navigation
  const shiftAnchor = (delta) => {
    const [y, m] = anchor.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const periodLabel = period === '1M'
    ? formatDate(anchor + '-01', { format: 'monthLong' })
    : `${formatDate(startKey + '-01', { format: 'monthYear' })} → ${formatDate(anchor + '-01', { format: 'monthYear' })}`;

  return (
    <div className="cashflow-view" ref={rootRef}>
      <div className="subview-header" data-reveal>
        <div>
          <h1>Votre <em>cashflow.</em></h1>
          <p>Entrées, sorties et soldes nets — visualisés sur la période.</p>
        </div>
      </div>
      <div className="cashflow-period" data-reveal>
        <div className="cashflow-period-nav">
          <button className="icon-btn" onClick={() => shiftAnchor(-1)} title="Période précédente"><ChevronLeft size={16}/></button>
          <span className="cashflow-period-label">{periodLabel}</span>
          <button className="icon-btn" onClick={() => shiftAnchor(1)} title="Période suivante"
            disabled={anchor >= currentMonth}><ChevronRight size={16}/></button>
        </div>
        <div className="nw-toggle-group">
          {['1M', '3M', '1A'].map(p => (
            <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      <div className="cashflow-grid" data-reveal>
        <section className="card cashflow-sankey-card">
          <div className="card-header">
            <h3>Flux d'argent</h3>
            <span className="card-meta">{filtered.length} transaction{filtered.length > 1 ? 's' : ''} sur la période</span>
          </div>
          {sankeyData ? (
            <ResponsiveContainer width="100%" height={isNarrow ? 520 : 420}>
              <Sankey
                data={sankeyData}
                nodePadding={isNarrow ? 16 : 28}
                nodeWidth={isNarrow ? 8 : 12}
                linkCurvature={0.5}
                iterations={64}
                node={<SankeyNode narrow={isNarrow}/>}
                link={{ stroke: 'var(--border)', strokeOpacity: 0.4, fill: 'var(--primary-soft)' }}
                margin={isNarrow ? { top: 8, right: 70, bottom: 8, left: 70 } : { top: 12, right: 180, bottom: 12, left: 180 }}
              >
                <Tooltip
                  formatter={(v) => fmt(v)}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <div className="empty-mini" style={{ padding: '60px 0' }}>
              <Activity size={28}/>
              <p>Aucune transaction sur cette période. Importe un CSV ou change de mois.</p>
            </div>
          )}

          <div className="cashflow-kpi-row">
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Entrées</div>
              <div className="cashflow-kpi-value positive">+{fmt(totalIncome)}</div>
            </div>
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Sorties</div>
              <div className="cashflow-kpi-value negative">−{fmt(totalExpense)}</div>
            </div>
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Épargne versée</div>
              <div className="cashflow-kpi-value positive">{fmt(totalSaving)}</div>
            </div>
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Reste disponible</div>
              <div className={`cashflow-kpi-value ${available >= 0 ? 'positive' : 'negative'}`}>{available >= 0 ? '+' : ''}{fmt(available)}</div>
            </div>
          </div>
        </section>

        <section className="card cashflow-distribution-card">
          <div className="card-header"><h3>Distribution</h3></div>
          {donutData.length > 0 ? (
            <div className="cashflow-distribution-bars">
              {/* Chiffre focal de la carte */}
              <div className="cashflow-dist-total" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="cashflow-donut-label">Somme sorties</span>
                <span className="cashflow-donut-value negative" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>−{fmt(totalExpense)}</span>
              </div>
              {/* Barre empilée (charte Forêt : barres > camemberts) */}
              <div role="img" aria-label="Répartition des dépenses par catégorie"
                style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, background: 'var(--bg-sunk)', margin: '14px 0 16px' }}>
                {donutData.map((d, i) => {
                  const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
                  return <span key={i} title={`${d.name} · ${pct.toFixed(0)} %`} style={{ width: `${pct}%`, background: d.color, minWidth: pct > 0 ? 3 : 0 }}/>;
                })}
              </div>
              {/* Légende « X % Catégorie » */}
              <div className="cashflow-dist-legend" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {donutData.slice(0, 6).map((d, i) => {
                  const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto auto', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, alignSelf: 'center' }}/>
                      <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>{pct.toFixed(0)} %</span>
                      <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right' }}>{fmt(d.value)}</span>
                    </div>
                  );
                })}
                {donutData.length > 6 && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>+{donutData.length - 6} autres catégories</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-mini"><Activity size={20}/><p>Pas encore de dépenses.</p></div>
          )}
        </section>
      </div>

      <div className="cashflow-cats-grid" data-reveal>
        <section className="card">
          <div className="card-header">
            <h3>Entrées</h3>
            <span className="card-meta">{incomeEntries.length} catégorie{incomeEntries.length > 1 ? 's' : ''}</span>
          </div>
          {incomeEntries.length === 0 ? (
            <div className="empty-mini"><p>Aucune entrée sur la période.</p></div>
          ) : (
            <div className="cashflow-cat-list">
              {incomeEntries.map(([slug, value]) => {
                const cat = catFor(slug);
                const pct = totalIncome > 0 ? (value / totalIncome) * 100 : 0;
                return (
                  <div key={slug} className="cashflow-cat-row">
                    <span className="cashflow-cat-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color }}>{cat?.icon || '💰'}</span>
                    <div className="cashflow-cat-info">
                      <div className="cashflow-cat-name">{cat?.name || slug}</div>
                      <div className="cashflow-cat-meta">{pct.toFixed(0)} % des entrées</div>
                    </div>
                    <div className="cashflow-cat-amount positive">+{fmt(value)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Sorties</h3>
            <span className="card-meta">{expenseEntries.length} catégorie{expenseEntries.length > 1 ? 's' : ''}</span>
          </div>
          {expenseEntries.length === 0 ? (
            <div className="empty-mini"><p>Aucune sortie sur la période.</p></div>
          ) : (
            <div className="cashflow-cat-list">
              {expenseEntries.map(([slug, value]) => {
                const cat = catFor(slug);
                const pct = totalExpense > 0 ? (value / totalExpense) * 100 : 0;
                return (
                  <div key={slug} className="cashflow-cat-row">
                    <span className="cashflow-cat-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color }}>{cat?.icon || '💸'}</span>
                    <div className="cashflow-cat-info">
                      <div className="cashflow-cat-name">{cat?.name || slug}</div>
                      <div className="cashflow-cat-meta">{pct.toFixed(0)} % des sorties</div>
                    </div>
                    <div className="cashflow-cat-amount negative">−{fmt(value)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Custom Sankey node — colored bar with label outside the diagram
const SankeyNode = React.memo(function SankeyNode({ x, y, width, height, index, payload, narrow }) {
  const isLeft = payload.kind === 'income';
  const color = payload.color || (payload.kind === 'hub' ? 'var(--primary)' : payload.kind === 'savings' ? 'var(--primary)' : payload.kind === 'income' ? 'var(--success)' : 'var(--danger)');
  const labelOffset = narrow ? 5 : 8;
  const fontSize = narrow ? 10 : 12;
  const valueLabel = payload.value
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(payload.value))
    : '';
  // On narrow viewports the sankey margins are tight (~70px each side), so we
  // drop the value suffix from labels to keep them readable.
  const labelText = narrow ? payload.name : `${payload.name}${valueLabel ? ` · ${valueLabel}` : ''}`;
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={payload.kind === 'hub' ? 0.9 : 0.75} stroke="none"/>
      {payload.kind !== 'hub' && (
        <text
          textAnchor={isLeft ? 'end' : 'start'}
          x={isLeft ? x - labelOffset : x + width + labelOffset}
          y={y + height / 2}
          dy={4}
          fontSize={fontSize}
          fill="var(--text-primary)"
        >
          {labelText}
        </text>
      )}
      {payload.kind === 'hub' && (
        <text
          textAnchor="middle"
          x={x + width / 2}
          y={y - 8}
          fontSize={11}
          fill="var(--text-tertiary)"
        >
          Disponible
        </text>
      )}
    </Layer>
  );
});
