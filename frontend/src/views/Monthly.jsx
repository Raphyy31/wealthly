// ============================================================================
// Monthly — Budget mensuel v5 (2026-05-14)
//
// Layout :
//   - Header : titre + carrousel mois + boutons [Mois type] [📊 50/30/20] [📈 Évolution]
//   - KPI strip : Revenus / Dépenses / Épargne / Reste à vivre (avec écart vs Mois type)
//   - Sankey du Mois type (3 colonnes : Entrées → Catégories → Sous-catégories)
//   - Table comparaison : Réel vs Mois type, groupée par catégorie, dépliable
//   - Drawer RefMonthEditor (édition du mois type)
//   - Modal FiftyThirtyTwentyModal (analyse 50/30/20)
//   - Modal Évolution (chart 6 mois)
// ============================================================================
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ComposedChart, Bar, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Sankey, Layer, Rectangle,
} from 'recharts';
import {
  Edit3, Target, TrendingUp, TrendingDown, PiggyBank, Wallet,
  ChevronDown, ChevronRight, X, BarChart3, Calendar,
  ChevronLeft, Coins, Sparkles,
} from 'lucide-react';
import { formatCurrency, formatDate, monthKey } from '../utils.js';
import { useIsNarrow } from '../hooks/useIsNarrow.js';
import { RefMonthEditor } from '../components/RefMonthEditor.jsx';
import { FiftyThirtyTwentyModal } from '../components/FiftyThirtyTwentyModal.jsx';

const SAVING_SLUGS = new Set(['savings']);

function isSavingCategory(catId) {
  return catId && SAVING_SLUGS.has(String(catId).toLowerCase());
}

function monthLabel(m) {
  if (!m) return '';
  return formatDate(m + '-01', { format: 'monthYear' });
}

function shortMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}

export function Monthly({
  transactions, accounts, categories, members,
  recurringIds, recurringGroups,
  monthlyEvolution, thisMonthStats,
  categoryAnalysis,
  fixedCharges, saveFixedCharge, deleteFixedCharge,
  refMonth, saveRefMonth,
  fiftyThirtyTwenty,
  transferIds = new Set(),
  memberShare,
  currentMonth, fmt,
}) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showEditor, setShowEditor] = useState(false);
  const [show5030, setShow5030] = useState(false);
  const [showEvolution, setShowEvolution] = useState(false);
  const [expandedRows, setExpandedRows] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wealthly:monthly_expanded') || '[]')); }
    catch { return new Set(); }
  });
  const isNarrow = useIsNarrow(760);

  useEffect(() => {
    try { localStorage.setItem('wealthly:monthly_expanded', JSON.stringify([...expandedRows])); } catch {}
  }, [expandedRows]);

  // Available months: 12 past + 3 future.
  const availableMonths = useMemo(() => {
    const [cy, cm] = currentMonth.split('-').map(Number);
    const arr = [];
    for (let i = -12; i <= 3; i++) {
      const d = new Date(cy, cm - 1 + i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, [currentMonth]);

  const catFor = (id) => categories.find(c => c.id === id || c.slug === id);

  // Mois type, parsed and grouped by (kind, category_id).
  const refLines = refMonth?.lines || [];
  const refByCat = useMemo(() => {
    const map = new Map();
    for (const l of refLines) {
      const k = `${l.kind}::${l.category_id || 'uncategorized'}`;
      if (!map.has(k)) map.set(k, { kind: l.kind, category_id: l.category_id, lines: [], total: 0 });
      const v = map.get(k);
      v.lines.push(l);
      v.total += parseFloat(l.amount) || 0;
    }
    return map;
  }, [refLines]);

  const refTotals = useMemo(() => {
    const t = { income: 0, expense: 0, saving: 0 };
    for (const l of refLines) {
      const v = parseFloat(l.amount) || 0;
      t[l.kind] = (t[l.kind] || 0) + v;
    }
    t.balance = t.income - t.expense - t.saving;
    return t;
  }, [refLines]);

  const hasRefMonth = refLines.length > 0;

  // Real month: aggregate transactions by (kind, categoryId).
  const monthTx = useMemo(() => {
    return transactions
      .filter(t => monthKey(t.date) === selectedMonth)
      .filter(t => !transferIds.has(t.id))
      .map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        const share = acc ? memberShare(acc) : 1;
        return { ...t, sharedAmount: (t.amount || 0) * share };
      });
  }, [transactions, accounts, memberShare, transferIds, selectedMonth]);

  // Per (kind, categoryId) totals for the selected real month.
  const realByCat = useMemo(() => {
    const map = new Map();
    for (const t of monthTx) {
      const catId = t.categoryId || 'uncategorized';
      const kind = t.amount >= 0 ? 'income' : (isSavingCategory(catId) ? 'saving' : 'expense');
      const k = `${kind}::${catId}`;
      if (!map.has(k)) map.set(k, { kind, category_id: catId, total: 0, count: 0 });
      const v = map.get(k);
      v.total += Math.abs(t.sharedAmount);
      v.count += 1;
    }
    return map;
  }, [monthTx]);

  const realTotals = useMemo(() => {
    const t = { income: 0, expense: 0, saving: 0 };
    for (const v of realByCat.values()) {
      t[v.kind] = (t[v.kind] || 0) + v.total;
    }
    t.balance = t.income - t.expense - t.saving;
    return t;
  }, [realByCat]);

  // KPI strip
  const isCurrentMonth = selectedMonth === currentMonth;
  const today = new Date();
  const [sy, sm] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(sy, sm, 0).getDate();
  const daysLeft = isCurrentMonth ? Math.max(0, daysInMonth - today.getDate()) : 0;
  const restToLive = isCurrentMonth ? Math.max(0, realTotals.income - realTotals.expense - realTotals.saving) : 0;
  const dailyBudget = daysLeft > 0 ? restToLive / daysLeft : 0;

  // Sankey data — Mois type only. 3 levels :
  //   Income lines (node per line) → Categories (one per unique catId for expense+saving) → Sub-lines
  const sankeyData = useMemo(() => {
    if (!hasRefMonth) return { nodes: [], links: [] };
    const incomeLines = refLines.filter(l => l.kind === 'income' && (parseFloat(l.amount) || 0) > 0);
    const spendLines = refLines.filter(l => l.kind !== 'income' && (parseFloat(l.amount) || 0) > 0);
    if (!incomeLines.length || !spendLines.length) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];

    // Level 1 — income nodes
    const incomeNodeIdx = {};
    incomeLines.forEach(l => {
      incomeNodeIdx[l.id] = nodes.length;
      nodes.push({ name: l.label || 'Entrée', level: 0, value: parseFloat(l.amount) || 0, kind: 'income' });
    });

    // Level 2 — categories (unique catId from spend+saving)
    const catKeys = [...new Set(spendLines.map(l => `${l.category_id || 'uncategorized'}`))];
    const catNodeIdx = {};
    catKeys.forEach(cid => {
      catNodeIdx[cid] = nodes.length;
      const cat = catFor(cid);
      nodes.push({ name: cat?.name || cid, level: 1, kind: 'cat' });
    });

    // Level 3 — sub-lines
    spendLines.forEach(l => {
      const cid = l.category_id || 'uncategorized';
      const cat = catFor(cid);
      // Only emit a separate level-3 node if the category has multiple lines.
      // Otherwise the category node IS the leaf — skip to avoid empty links.
      const catHasMultiple = spendLines.filter(x => (x.category_id || 'uncategorized') === cid).length > 1;
      if (catHasMultiple) {
        const idx = nodes.length;
        nodes.push({ name: l.label || cat?.name || 'Ligne', level: 2, kind: l.kind });
        links.push({ source: catNodeIdx[cid], target: idx, value: parseFloat(l.amount) || 0 });
      }
    });

    // Income → category links (proportional split — each income contributes
    // proportionally to each category, based on income share of total income).
    const totalIncome = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const totalSpend = spendLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    if (totalIncome > 0 && totalSpend > 0) {
      // For each category, total spend in that cat.
      const catTotals = {};
      spendLines.forEach(l => {
        const cid = l.category_id || 'uncategorized';
        catTotals[cid] = (catTotals[cid] || 0) + (parseFloat(l.amount) || 0);
      });
      // Each income line contributes (incomeAmount / totalIncome) × catTotal to each cat.
      incomeLines.forEach(inc => {
        const incVal = parseFloat(inc.amount) || 0;
        const incShare = incVal / totalIncome;
        Object.entries(catTotals).forEach(([cid, catTotal]) => {
          const val = catTotal * incShare;
          if (val > 0.5) {
            links.push({ source: incomeNodeIdx[inc.id], target: catNodeIdx[cid], value: val });
          }
        });
      });
    }

    return { nodes, links };
  }, [refLines, hasRefMonth, categories]);

  // Comparison table — sections: income / expense / saving.
  const tableSections = useMemo(() => {
    const sections = [
      { kind: 'income', title: 'Entrées', items: [] },
      { kind: 'expense', title: 'Dépenses', items: [] },
      { kind: 'saving', title: 'Épargne', items: [] },
    ];

    const allKeys = new Set();
    for (const k of refByCat.keys()) allKeys.add(k);
    for (const k of realByCat.keys()) allKeys.add(k);

    for (const key of allKeys) {
      const [kind, catId] = key.split('::');
      const ref = refByCat.get(key);
      const real = realByCat.get(key);
      const cat = catFor(catId);
      const refTotal = ref?.total || 0;
      const realTotal = real?.total || 0;
      const item = {
        key,
        kind,
        category_id: catId,
        cat_name: cat?.name || catId,
        ref_total: refTotal,
        real_total: realTotal,
        lines: ref?.lines || [],
        is_unexpected: !ref && real,
      };
      const target = sections.find(s => s.kind === kind);
      if (target) target.items.push(item);
    }

    // Sort items inside each section by ref desc, then real desc.
    sections.forEach(s => s.items.sort((a, b) => (b.ref_total || b.real_total) - (a.ref_total || a.real_total)));
    return sections;
  }, [refByCat, realByCat, categories]);

  const toggleRow = (key) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="monthly-v5">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="subview-header">
        <div>
          <h1>{t('views.monthly.title')} <em>{t('views.monthly.titleAccent')}</em></h1>
          <p>{t('views.monthly.subtitle')}</p>
        </div>
        <div className="mon-actions">
          <button className="ds-btn ghost" onClick={() => setShowEvolution(true)}>
            <TrendingUp size={14}/> {isNarrow ? '' : 'Évolution'}
          </button>
          <button className="ds-btn ghost" onClick={() => setShow5030(true)}>
            <Target size={14}/> {isNarrow ? '' : '50 / 30 / 20'}
          </button>
          <button className="ds-btn primary" onClick={() => setShowEditor(true)}>
            <Edit3 size={14}/> {isNarrow ? 'Mois type' : 'Éditer mois type'}
          </button>
        </div>
      </div>

      {/* ── Month picker ────────────────────────────────────────────── */}
      <MonthPicker
        selectedMonth={selectedMonth}
        currentMonth={currentMonth}
        availableMonths={availableMonths}
        onChange={setSelectedMonth}
      />


      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <Kpi
        realTotals={realTotals}
        refTotals={refTotals}
        hasRefMonth={hasRefMonth}
        restToLive={restToLive}
        dailyBudget={dailyBudget}
        daysLeft={daysLeft}
        isCurrentMonth={isCurrentMonth}
        fmt={fmt}
      />

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!hasRefMonth && (
        <section className="card mon-empty-state">
          <div className="mon-empty-illu">
            <Sparkles size={20} className="mon-empty-spark mon-empty-spark-1"/>
            <Target size={32}/>
            <Sparkles size={14} className="mon-empty-spark mon-empty-spark-2"/>
          </div>
          <h3>Configure ton <em>mois type.</em></h3>
          <p>Définis ton salaire et tes dépenses habituelles — l'app comparera chaque mois pour t'aider à rester sur la bonne trajectoire.</p>
          <button className="ds-btn primary lg" onClick={() => setShowEditor(true)}>
            <Edit3 size={14}/> Configurer mon mois type
          </button>
        </section>
      )}

      {/* ── Sankey du Mois type ─────────────────────────────────────── */}
      {hasRefMonth && sankeyData.nodes.length > 0 && (
        <section className="card mon-sankey">
          <div className="card-header">
            <h3>Flux du mois type</h3>
            <span className="card-meta">Entrées → Catégories → Sous-catégories</span>
          </div>
          <div className="mon-sankey-body">
            <ResponsiveContainer width="100%" height={isNarrow ? 360 : 420}>
              <Sankey
                data={sankeyData}
                nodePadding={isNarrow ? 12 : 18}
                nodeWidth={10}
                margin={{ top: 8, right: 100, bottom: 8, left: 100 }}
                node={<SankeyNode/>}
                link={{ stroke: 'var(--accent-soft)', strokeOpacity: 0.7 }}
              >
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
              </Sankey>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Comparison table ────────────────────────────────────────── */}
      {hasRefMonth && (
        <section className="card mon-compare">
          <div className="card-header">
            <h3>Réel vs Mois type — {monthLabel(selectedMonth)}</h3>
            <span className="card-meta">{realByCat.size} catégorie{realByCat.size > 1 ? 's' : ''} ce mois</span>
          </div>
          <div className="mon-compare-table">
            <div className="mon-row mon-row-head ds-micro">
              <span>Catégorie</span>
              <span className="num">Mois type</span>
              <span className="num">Ce mois</span>
              <span className="num">Écart</span>
              <span>Progression</span>
            </div>
            {tableSections.map(section => (
              <React.Fragment key={section.kind}>
                <div className={`mon-row mon-row-section mon-row-section-${section.kind}`}>
                  <span className="mon-section-icon">
                    {section.kind === 'income'
                      ? <TrendingUp size={12}/>
                      : section.kind === 'saving'
                      ? <PiggyBank size={12}/>
                      : <TrendingDown size={12}/>}
                  </span>
                  {section.title}
                </div>
                {section.items.length === 0 && (
                  <div className="mon-row mon-row-empty ds-micro">Aucune ligne dans cette section</div>
                )}
                {section.items.map(item => {
                  const cat = catFor(item.category_id);
                  const ecart = item.real_total - item.ref_total;
                  const pct = item.ref_total > 0 ? Math.round((item.real_total / item.ref_total) * 100) : (item.real_total > 0 ? 999 : 0);
                  const expanded = expandedRows.has(item.key);
                  const hasSubs = item.lines.length > 1;
                  return (
                    <React.Fragment key={item.key}>
                      <div
                        className={`mon-row mon-row-cat ${item.is_unexpected ? 'unexpected' : ''} ${hasSubs ? 'expandable' : ''}`}
                        onClick={hasSubs ? () => toggleRow(item.key) : undefined}
                      >
                        <span className="mon-cat-name">
                          {hasSubs
                            ? (expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>)
                            : <span style={{ width: 12, display: 'inline-block' }}/>}
                          <span className="mon-cat-dot" style={{ background: cat?.color || 'var(--border-strong)' }}/>
                          <span className="mon-cat-emoji" aria-hidden="true">{cat?.icon || '•'}</span>
                          {item.cat_name}
                          {item.is_unexpected && <span className="mon-pill warn">? Inattendu</span>}
                        </span>
                        <span className="num">{item.ref_total > 0 ? fmt(item.ref_total) : '—'}</span>
                        <span className="num">{item.real_total > 0 ? fmt(item.real_total) : '—'}</span>
                        <span className="num">{ecart === 0 ? '—' : (ecart > 0 ? '+' : '') + fmt(ecart)}</span>
                        <span className="mon-bar-wrap">
                          {item.ref_total > 0 && (
                            <span className={`mon-bar ${pct > 100 ? 'over' : ''}`}>
                              <span className="mon-bar-fill" style={{ width: Math.min(pct, 100) + '%' }}/>
                              {pct > 100 && <span className="mon-bar-over" style={{ width: Math.min(pct - 100, 50) + '%' }}/>}
                            </span>
                          )}
                          <span className="ds-micro num">{item.ref_total > 0 ? `${pct}%` : ''}</span>
                        </span>
                      </div>
                      {expanded && item.lines.map(line => {
                        const lineAmount = parseFloat(line.amount) || 0;
                        return (
                          <div key={line.id} className="mon-row mon-row-sub">
                            <span className="mon-sub-label">{line.label}</span>
                            <span className="num">{fmt(lineAmount)}</span>
                            <span className="num">—</span>
                            <span className="num">—</span>
                            <span/>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
            {/* Footer totals */}
            <div className="mon-row mon-row-foot">
              <span>Balance</span>
              <span className="num">{refTotals.balance >= 0 ? '+' : ''}{fmt(refTotals.balance)}</span>
              <span className="num">{realTotals.balance >= 0 ? '+' : ''}{fmt(realTotals.balance)}</span>
              <span className="num">{(realTotals.balance - refTotals.balance) >= 0 ? '+' : ''}{fmt(realTotals.balance - refTotals.balance)}</span>
              <span/>
            </div>
          </div>
        </section>
      )}

      {/* ── Drawer / Modals ─────────────────────────────────────────── */}
      {showEditor && (
        <RefMonthEditor
          refMonth={refMonth}
          saveRefMonth={saveRefMonth}
          categories={categories}
          transactions={transactions}
          accounts={accounts}
          memberShare={memberShare}
          transferIds={transferIds}
          currentMonth={currentMonth}
          fmt={fmt}
          onClose={() => setShowEditor(false)}
        />
      )}

      {show5030 && (
        <FiftyThirtyTwentyModal
          refMonth={refMonth}
          fiftyThirtyTwenty={fiftyThirtyTwenty}
          fmt={fmt}
          onClose={() => setShow5030(false)}
        />
      )}

      {showEvolution && (
        <EvolutionModal
          monthlyEvolution={monthlyEvolution}
          fmt={fmt}
          onClose={() => setShowEvolution(false)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
function Kpi({ realTotals, refTotals, hasRefMonth, restToLive, dailyBudget, daysLeft, isCurrentMonth, fmt }) {
  const renderDelta = (real, ref, invert = false) => {
    if (!hasRefMonth || !ref) return null;
    const d = real - ref;
    if (Math.abs(d) < 1) return <span className="ds-micro">vs {fmt(ref)}</span>;
    const positive = invert ? d > 0 : d < 0;
    return (
      <span className={`mon-kpi-delta ds-micro num ${positive ? 'pos' : 'neg'}`}>
        {d > 0 ? '+' : ''}{fmt(d)} vs type
      </span>
    );
  };
  return (
    <section className="mon-kpi-strip">
      <div className="mon-kpi mon-kpi-income">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><TrendingUp size={14}/></span>
          <span className="ds-micro">Revenus</span>
        </div>
        <span className="num mon-kpi-value">{fmt(realTotals.income)}</span>
        {renderDelta(realTotals.income, refTotals.income, true)}
      </div>
      <div className="mon-kpi mon-kpi-expense">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><TrendingDown size={14}/></span>
          <span className="ds-micro">Dépenses</span>
        </div>
        <span className="num mon-kpi-value">{fmt(realTotals.expense)}</span>
        {renderDelta(realTotals.expense, refTotals.expense, false)}
      </div>
      <div className="mon-kpi mon-kpi-saving">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><PiggyBank size={14}/></span>
          <span className="ds-micro">Épargne</span>
        </div>
        <span className="num mon-kpi-value">{fmt(realTotals.saving)}</span>
        {renderDelta(realTotals.saving, refTotals.saving, true)}
      </div>
      <div className="mon-kpi mon-kpi-rest">
        <div className="mon-kpi-head">
          <span className="mon-kpi-icon"><Wallet size={14}/></span>
          <span className="ds-micro">{isCurrentMonth ? 'Reste à vivre' : 'Balance mois'}</span>
        </div>
        <span className="num mon-kpi-value">{fmt(isCurrentMonth ? restToLive : realTotals.balance)}</span>
        {isCurrentMonth && daysLeft > 0
          ? <span className="ds-micro num">{fmt(dailyBudget)}/jour · {daysLeft}j restants</span>
          : null}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
function MonthPicker({ selectedMonth, currentMonth, availableMonths, onChange }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => parseInt(selectedMonth.split('-')[0], 10));
  useEffect(() => {
    if (open) setYear(parseInt(selectedMonth.split('-')[0], 10));
  }, [open, selectedMonth]);

  const close = () => setOpen(false);

  // Available months grouped by year for navigation.
  const minYear = Math.min(...availableMonths.map(m => parseInt(m.split('-')[0], 10)));
  const maxYear = Math.max(...availableMonths.map(m => parseInt(m.split('-')[0], 10)));
  const monthsForYear = useMemo(() => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const enabled = availableMonths.includes(key);
      arr.push({ key, month: m, enabled });
    }
    return arr;
  }, [year, availableMonths]);

  const label = formatDate(selectedMonth + '-01', { format: 'monthYear' });
  const monthLabels = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

  return (
    <div className="mon-picker-wrap">
      <button
        className="mon-picker-toggle"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={14}/>
        <span>{label}</span>
        <ChevronDown size={14} className={open ? 'rot' : ''}/>
      </button>
      {open && (
        <>
          <div className="mon-picker-backdrop" onClick={close}/>
          <div className="mon-picker-pop" role="dialog">
            <div className="mon-picker-head">
              <button
                className="ds-icon-btn"
                disabled={year <= minYear}
                onClick={() => setYear(y => y - 1)}
                aria-label="Année précédente"
              ><ChevronLeft size={14}/></button>
              <strong>{year}</strong>
              <button
                className="ds-icon-btn"
                disabled={year >= maxYear}
                onClick={() => setYear(y => y + 1)}
                aria-label="Année suivante"
              ><ChevronRight size={14}/></button>
            </div>
            <div className="mon-picker-grid">
              {monthsForYear.map(({ key, month, enabled }) => {
                const isActive = key === selectedMonth;
                const isCurrent = key === currentMonth;
                return (
                  <button
                    key={key}
                    className={`mon-picker-cell ${isActive ? 'is-active' : ''} ${isCurrent ? 'is-current' : ''}`}
                    disabled={!enabled}
                    onClick={() => { onChange(key); close(); }}
                  >
                    {monthLabels[month - 1]}
                  </button>
                );
              })}
            </div>
            <button
              className="mon-picker-today"
              onClick={() => { onChange(currentMonth); close(); }}
            >
              Aujourd'hui
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SankeyNode({ x, y, width, height, index, payload }) {
  if (!payload) return null;
  const isLeaf = payload.level === 2 || (payload.level === 1 && payload.kind !== 'income');
  return (
    <Layer key={`sn-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={payload.kind === 'income' ? 'var(--positive)' : (payload.kind === 'saving' ? 'var(--accent)' : 'var(--ink)')} fillOpacity={0.85}/>
      <text
        x={payload.level === 0 ? x - 6 : x + width + 6}
        y={y + height / 2 + 4}
        fontSize={11}
        fill="var(--ink-2)"
        textAnchor={payload.level === 0 ? 'end' : 'start'}
      >
        {payload.name}
      </text>
    </Layer>
  );
}

function EvolutionModal({ monthlyEvolution, fmt, onClose }) {
  return (
    <div className="ftt-overlay" onClick={onClose}>
      <div className="ftt-modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="ftt-head">
          <div>
            <h2><TrendingUp size={18}/> Évolution sur 6 mois</h2>
            <p className="ds-micro">Revenus, dépenses, solde net.</p>
          </div>
          <button className="ds-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16}/></button>
        </div>
        {monthlyEvolution.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthlyEvolution.slice(-6)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="month" tickFormatter={(m) => formatDate(m + '-01', { format: 'monthYear' })} stroke="var(--ink-3)" fontSize={11}/>
              <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--ink-3)" fontSize={11}/>
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="income" name="Revenus" fill="var(--positive)" radius={[3, 3, 0, 0]} maxBarSize={24}/>
              <Bar dataKey="expenses" name="Dépenses" fill="var(--negative)" radius={[3, 3, 0, 0]} maxBarSize={24}/>
              <Line type="monotone" dataKey="net" name="Solde" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }}/>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="mon-empty"><BarChart3 size={28}/><span>Pas encore de données</span></div>
        )}
      </div>
    </div>
  );
}
