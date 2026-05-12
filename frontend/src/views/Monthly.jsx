// ============================================================================
// Monthly — Suivi mensuel v4 (budget-table inspiré YNAB / Notion budget)
//
// Layout :
//   - Carrousel des mois (sticky, mois actuel en cobalt)
//   - Card synthèse : Revenu (X sur Y) · Dépenses (X sur Y) · Épargne
//   - Onglets Budget | Évolution
//   - Budget : table à colonnes Catégorie | Budgétisé | Dépensé | Solde
//     groupée par : Charges fixes / Abonnements / Variables / Opérations
//     neutres / Revenus
//   - Évolution : graph 6 mois (Income vs Expenses + solde net)
//
// Customisation (add/edit/delete des charges fixes) → bouton "+ Ajouter"
// dans chaque groupe ouvre le FixedChargeEditor existant.
// ============================================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ComposedChart, Bar, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  Plus, Trash2, Edit3, Check, AlertTriangle, Repeat, Sparkles, Lightbulb,
  TrendingUp, ArrowUp, ArrowDown, Minus, Activity, BarChart3, X,
  ChevronDown, ChevronRight, ArrowLeftRight, Wallet, Coffee, Tag,
} from 'lucide-react';
import { formatCurrency, formatDate, monthKey } from '../utils.js';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';

export function Monthly({
  transactions, accounts, categories, members, recurringIds, recurringGroups,
  monthlyEvolution, thisMonthStats, anomalies, categoryAnalysis,
  fixedCharges, saveFixedCharge, deleteFixedCharge,
  memberShare, currentMonth, fmt, transferIds = new Set(),
}) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingCharge, setEditingCharge] = useState(null);
  const [tab, setTab] = useState('budget'); // budget | evolution
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const monthBarRef = useRef(null);

  // ── Available months (last 12 + future 3, current in middle) ───────────
  const availableMonths = useMemo(() => {
    const [cy, cm] = currentMonth.split('-').map(Number);
    const arr = [];
    for (let i = -12; i <= 3; i++) {
      const d = new Date(cy, cm - 1 + i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, [currentMonth]);

  // Scroll the month carousel to centre the selected month on first mount
  useEffect(() => {
    if (!monthBarRef.current) return;
    const active = monthBarRef.current.querySelector('.mon-month.is-active');
    if (active) {
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
    }
  }, [selectedMonth]);

  const monthData = useMemo(
    () => monthlyEvolution.find(m => m.month === selectedMonth) || { income: 0, expenses: 0, net: 0, fixed: 0, variable: 0, savings: 0 },
    [monthlyEvolution, selectedMonth]
  );
  const isCurrentMonth = selectedMonth === currentMonth;

  // ── Active fixed charges for the selected month ────────────────────────
  const activeFixedCharges = useMemo(() => {
    return (fixedCharges || []).filter(fc => {
      if (fc.start_month && selectedMonth < fc.start_month) return false;
      if (fc.end_month && selectedMonth > fc.end_month) return false;
      return true;
    });
  }, [fixedCharges, selectedMonth]);
  const totalFixedBudgeted = activeFixedCharges.reduce((s, fc) => s + (fc.amount || 0), 0);

  // ── Selected month transactions, with member share resolved ────────────
  const monthTransactions = useMemo(() => {
    return transactions
      .filter(t => monthKey(t.date) === selectedMonth)
      .map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        const share = acc ? memberShare(acc) : 1;
        return { ...t, sharedAmount: t.amount * share, isTransfer: transferIds.has(t.id) };
      });
  }, [transactions, selectedMonth, accounts, memberShare, transferIds]);

  // ── Group expense categories into "Abonnements" vs "Charges fixes" vs
  // "Dépenses variables" based on whether they have a registered fixed
  // charge, the subscriptions tag, or are loose expense categories.
  const subsFixed = activeFixedCharges.filter(fc => (fc.category_slug || '').toLowerCase() === 'subscriptions');
  const otherFixed = activeFixedCharges.filter(fc => (fc.category_slug || '').toLowerCase() !== 'subscriptions');

  const subsByCategory = useMemo(() => groupByCategory(subsFixed, categories), [subsFixed, categories]);
  const fixedByCategory = useMemo(() => groupByCategory(otherFixed, categories), [otherFixed, categories]);

  // Variable expenses: month transactions that are NOT transfers, NOT income,
  // NOT covered by a recurring/fixed pattern. Roll up per category.
  const variableByCategory = useMemo(() => {
    const map = new Map();
    monthTransactions.forEach(t => {
      if (t.isTransfer) return;
      if (t.amount >= 0) return; // income
      if (recurringIds.has(t.id)) return; // already counted in fixed
      const cat = categories.find(c => c.id === t.categoryId || c.slug === t.categoryId);
      const key = cat?.id || cat?.slug || 'uncategorised';
      if (!map.has(key)) map.set(key, { id: key, name: cat?.name || 'Non catégorisé', icon: cat?.icon || '?', color: cat?.color, dépensé: 0, items: [] });
      const entry = map.get(key);
      entry.dépensé += Math.abs(t.sharedAmount);
      entry.items.push(t);
    });
    return [...map.values()].sort((a, b) => b.dépensé - a.dépensé);
  }, [monthTransactions, categories, recurringIds]);
  const totalVariableSpent = variableByCategory.reduce((s, g) => s + g.dépensé, 0);

  // Neutral operations: internal transfers (always 0 net but useful to surface)
  const neutralOps = useMemo(() => {
    return monthTransactions.filter(t => t.isTransfer);
  }, [monthTransactions]);
  const neutralTotal = neutralOps.reduce((s, t) => s + Math.abs(t.sharedAmount), 0) / 2; // each pair counted twice

  // Income — positive non-transfer transactions, rolled up per category
  const incomeByCategory = useMemo(() => {
    const map = new Map();
    monthTransactions.forEach(t => {
      if (t.isTransfer) return;
      if (t.amount <= 0) return;
      const cat = categories.find(c => c.id === t.categoryId || c.slug === t.categoryId);
      const key = cat?.id || cat?.slug || 'autre-revenu';
      if (!map.has(key)) map.set(key, { id: key, name: cat?.name || 'Autre revenu', icon: cat?.icon || '💰', color: cat?.color, reçu: 0, items: [] });
      const entry = map.get(key);
      entry.reçu += t.sharedAmount;
      entry.items.push(t);
    });
    return [...map.values()].sort((a, b) => b.reçu - a.reçu);
  }, [monthTransactions, categories]);
  const totalIncome = incomeByCategory.reduce((s, g) => s + g.reçu, 0);

  // Synthesise top summary
  const totalBudgeted = totalFixedBudgeted;
  const totalSpent = monthData.expenses;
  const estimatedSavings = totalIncome - totalSpent;

  // Group budgétisé totals (subscriptions + other fixed = together they're "budgeted")
  const subsBudgeted = subsByCategory.reduce((s, g) => s + g.total, 0);
  const fixedBudgeted = fixedByCategory.reduce((s, g) => s + g.total, 0);

  // Actual spent per category (from transactions) — joined onto each fixed cat
  const spentByCategoryId = useMemo(() => {
    const map = new Map();
    monthTransactions.forEach(t => {
      if (t.isTransfer || t.amount >= 0) return;
      const key = t.categoryId || 'uncategorised';
      map.set(key, (map.get(key) || 0) + Math.abs(t.sharedAmount));
    });
    return map;
  }, [monthTransactions]);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const startEdit = (charge) => {
    setEditingCharge(charge || {
      name: '', amount: '', day_of_month: 1, category_slug: 'subscriptions',
      start_month: selectedMonth, end_month: null, member_ids: [], notes: '',
    });
  };

  const toggleGroup = (key) => setCollapsedGroups(g => ({ ...g, [key]: !g[key] }));
  const isGroupOpen = (key) => !collapsedGroups[key];

  return (
    <div className="monthly-view">
      <div className="subview-header">
        <div>
          <h1>Suivi <em>mensuel.</em></h1>
          <p>Tous vos flux du mois — charges, abonnements, opérations neutres, revenus.</p>
        </div>
      </div>

      {/* Month carousel */}
      <div className="mon-monthbar" ref={monthBarRef}>
        {availableMonths.map(m => {
          const d = new Date(m + '-01');
          const year = d.getFullYear();
          const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
          const isActive = m === selectedMonth;
          const isCurrent = m === currentMonth;
          return (
            <button
              key={m}
              className={`mon-month ${isActive ? 'is-active' : ''} ${isCurrent ? 'is-today' : ''}`}
              onClick={() => setSelectedMonth(m)}
              title={d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            >
              <span className="mon-month-year">{year}</span>
              <span className="mon-month-label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Synthèse card */}
      <section className="mon-summary">
        <div className="mon-summary-head">
          <div className="mon-summary-title">{formatDate(selectedMonth + '-01', { format: 'monthLong' })}</div>
          {isCurrentMonth && <span className="mon-summary-tag">en cours</span>}
        </div>
        <div className="mon-summary-grid">
          <div className="mon-summary-cell">
            <div className="mon-summary-label">Revenus</div>
            <div className="mon-summary-value num">{fmt(totalIncome)}</div>
            <div className="mon-summary-sub num">sur {fmt(monthData.income)} prévu</div>
          </div>
          <div className="mon-summary-cell">
            <div className="mon-summary-label">Dépenses</div>
            <div className="mon-summary-value num">{fmt(totalSpent)}</div>
            <div className="mon-summary-sub num">sur {fmt(totalBudgeted)} budgétisé</div>
          </div>
          <div className="mon-summary-cell">
            <div className="mon-summary-label">Épargne estimée</div>
            <div className={`mon-summary-value mon-hero num ${estimatedSavings >= 0 ? 'pos' : 'neg'}`}>
              <AnimatedNumber value={estimatedSavings} format={(v) => fmt(v, { sign: true })}/>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mon-tabs">
        <button className={tab === 'budget' ? 'on' : ''} onClick={() => setTab('budget')}>Budget</button>
        <button className={tab === 'evolution' ? 'on' : ''} onClick={() => setTab('evolution')}>Évolution</button>
      </div>

      {tab === 'budget' && (
        <section className="mon-budget">
          <div className="mon-table-head">
            <div>Catégorie</div>
            <div className="num">Budgétisé</div>
            <div className="num">Dépensé</div>
            <div className="num">Solde</div>
          </div>

          <BudgetGroup
            id="charges-fixes"
            icon={<Repeat size={14}/>}
            name="Charges fixes"
            budgeted={fixedBudgeted}
            actual={spentSumFromGroups(fixedByCategory, spentByCategoryId)}
            open={isGroupOpen('charges-fixes')}
            onToggle={() => toggleGroup('charges-fixes')}
            onAdd={() => startEdit({ category_slug: 'housing' })}
            fmt={fmt}
          >
            {fixedByCategory.flatMap(g => g.items.map(it => (
              <BudgetRow
                key={it.id}
                name={it.name}
                meta={it.day_of_month ? `J${it.day_of_month}` : null}
                budgeted={it.amount}
                actual={spentByCategoryId.get(it.category_slug) ? null : 0}
                fmt={fmt}
                onEdit={() => startEdit(it)}
                onDelete={() => deleteFixedCharge(it.id)}
              />
            )))}
            {fixedByCategory.length === 0 && <EmptyRow label="Aucune charge fixe enregistrée"/>}
          </BudgetGroup>

          <BudgetGroup
            id="abonnements"
            icon={<Sparkles size={14}/>}
            name="Abonnements"
            budgeted={subsBudgeted}
            actual={subsBudgeted}
            open={isGroupOpen('abonnements')}
            onToggle={() => toggleGroup('abonnements')}
            onAdd={() => startEdit({ category_slug: 'subscriptions' })}
            fmt={fmt}
            yearlyTotal={subsBudgeted * 12}
          >
            {subsByCategory.flatMap(g => g.items.map(it => (
              <BudgetRow
                key={it.id}
                name={it.name}
                meta={`${fmt(it.amount * 12)}/an`}
                budgeted={it.amount}
                actual={it.amount}
                fmt={fmt}
                onEdit={() => startEdit(it)}
                onDelete={() => deleteFixedCharge(it.id)}
              />
            )))}
            {subsByCategory.length === 0 && <EmptyRow label="Aucun abonnement"/>}
          </BudgetGroup>

          <BudgetGroup
            id="variables"
            icon={<Coffee size={14}/>}
            name="Dépenses variables"
            budgeted={null}
            actual={totalVariableSpent}
            open={isGroupOpen('variables')}
            onToggle={() => toggleGroup('variables')}
            fmt={fmt}
          >
            {variableByCategory.map(g => (
              <BudgetRow
                key={g.id}
                name={g.name}
                meta={g.items.length > 1 ? `${g.items.length} opérations` : null}
                icon={g.icon}
                color={g.color}
                budgeted={null}
                actual={g.dépensé}
                fmt={fmt}
              />
            ))}
            {variableByCategory.length === 0 && <EmptyRow label="Aucune dépense variable"/>}
          </BudgetGroup>

          <BudgetGroup
            id="neutres"
            icon={<ArrowLeftRight size={14}/>}
            name="Opérations neutres"
            budgeted={null}
            actual={neutralTotal}
            actualLabel="déplacé"
            open={isGroupOpen('neutres')}
            onToggle={() => toggleGroup('neutres')}
            fmt={fmt}
            isNeutral
          >
            {neutralOps.length > 0 ? neutralOps.slice(0, 8).map(t => {
              const from = accounts.find(a => a.id === t.accountId);
              return (
                <BudgetRow
                  key={t.id}
                  name={t.label || 'Virement'}
                  meta={`${from?.name || ''}${t.amount < 0 ? ' → autre compte' : ' ← autre compte'}`}
                  budgeted={null}
                  actual={Math.abs(t.sharedAmount)}
                  fmt={fmt}
                  isNeutral
                />
              );
            }) : <EmptyRow label="Aucun virement interne détecté"/>}
            {neutralOps.length > 8 && <EmptyRow label={`… et ${neutralOps.length - 8} autres`}/>}
          </BudgetGroup>

          <BudgetGroup
            id="revenus"
            icon={<TrendingUp size={14}/>}
            name="Revenus"
            budgeted={null}
            actual={totalIncome}
            actualLabel="reçu"
            open={isGroupOpen('revenus')}
            onToggle={() => toggleGroup('revenus')}
            fmt={fmt}
            isIncome
          >
            {incomeByCategory.length > 0 ? incomeByCategory.map(g => (
              <BudgetRow
                key={g.id}
                name={g.name}
                meta={g.items.length > 1 ? `${g.items.length} opérations` : null}
                icon={g.icon}
                color={g.color}
                budgeted={null}
                actual={g.reçu}
                isIncome
                fmt={fmt}
              />
            )) : <EmptyRow label="Aucun revenu enregistré ce mois"/>}
          </BudgetGroup>

          {anomalies.length > 0 && isCurrentMonth && (
            <div className="mon-alert">
              <AlertTriangle size={14}/>
              <div>
                <strong>{anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} détectée{anomalies.length > 1 ? 's' : ''}</strong>
                <span>
                  {anomalies.slice(0, 3).map(a => a.name).join(', ')}
                  {anomalies.length > 3 ? `, +${anomalies.length - 3}` : ''} — dépenses plus élevées que d'habitude.
                </span>
              </div>
            </div>
          )}

          <div className="mon-tip">
            <Lightbulb size={14}/>
            <span>Astuce : vérifie chaque trimestre tes abonnements ({fmt(subsBudgeted * 12)}/an au total ici) — il y a souvent 20-30 €/mois qui passent inaperçus.</span>
          </div>
        </section>
      )}

      {tab === 'evolution' && (
        <section className="mon-evolution">
          <div className="mon-card">
            <div className="mon-card-head">
              <h3>Flux mensuel sur 6 mois</h3>
              <span className="mon-card-meta">Revenus, dépenses et solde net</span>
            </div>
            {monthlyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyEvolution.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="month" tickFormatter={(m) => formatDate(m + '-01', { format: 'monthYear' })} stroke="var(--ink-3)" fontSize={11}/>
                  <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--ink-3)" fontSize={11}/>
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Bar dataKey="income" name="Revenus" fill="var(--positive)" radius={[3, 3, 0, 0]} maxBarSize={24}/>
                  <Bar dataKey="expenses" name="Dépenses" fill="var(--negative)" radius={[3, 3, 0, 0]} maxBarSize={24}/>
                  <Line type="monotone" dataKey="net" name="Solde net" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} activeDot={{ r: 5 }}/>
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="mon-empty"><BarChart3 size={28}/><span>Pas encore de données mensuelles</span></div>}
          </div>
        </section>
      )}

      {editingCharge && (
        <FixedChargeEditor
          charge={editingCharge}
          categories={expenseCategories}
          members={members}
          currentMonth={currentMonth}
          onSave={(c) => { saveFixedCharge(c); setEditingCharge(null); }}
          onCancel={() => setEditingCharge(null)}
        />
      )}

      <Styles/>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function BudgetGroup({ id, icon, name, budgeted, actual, actualLabel = 'dépensé', open, onToggle, onAdd, children, fmt, yearlyTotal, isNeutral, isIncome }) {
  const balance = budgeted != null ? budgeted - (actual || 0) : null;
  return (
    <div className={`mon-grp ${open ? 'is-open' : ''} ${isNeutral ? 'is-neutral' : ''} ${isIncome ? 'is-income' : ''}`}>
      <button className="mon-grp-head" onClick={onToggle}>
        <span className="mon-grp-caret">{open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</span>
        <span className="mon-grp-icon">{icon}</span>
        <span className="mon-grp-name">{name}</span>
        {yearlyTotal != null && <span className="mon-grp-yearly num">· {fmt(yearlyTotal)}/an</span>}
        <span className="mon-grp-spacer"/>
        <span className="mon-grp-val num">{budgeted != null ? fmt(budgeted) : '—'}</span>
        <span className="mon-grp-val num">{actual != null ? fmt(actual) : '—'}</span>
        <span className={`mon-grp-val num ${balance != null ? (balance >= 0 ? 'pos' : 'neg') : ''}`}>
          {balance != null ? fmt(balance, { sign: true }) : '—'}
        </span>
        {onAdd && (
          <button
            className="mon-grp-add"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            title="Ajouter une ligne"
          ><Plus size={13}/></button>
        )}
      </button>
      {open && <div className="mon-grp-body">{children}</div>}
    </div>
  );
}

function BudgetRow({ name, meta, icon, color, budgeted, actual, fmt, onEdit, onDelete, isNeutral, isIncome }) {
  const balance = budgeted != null && actual != null ? budgeted - actual : null;
  return (
    <div className="mon-row">
      <div className="mon-row-name">
        {icon && <span className="mon-row-icon" style={color ? { background: color + '22', color } : null}>{icon}</span>}
        <div className="mon-row-info">
          <div className="mon-row-label">{name}</div>
          {meta && <div className="mon-row-meta">{meta}</div>}
        </div>
      </div>
      <div className="mon-row-val num">{budgeted != null ? fmt(budgeted) : '—'}</div>
      <div className={`mon-row-val num ${isIncome ? 'pos' : isNeutral ? 'neutral' : ''}`}>
        {actual != null ? fmt(actual) : '—'}
      </div>
      <div className={`mon-row-val num ${balance != null ? (balance >= 0 ? 'pos' : 'neg') : ''}`}>
        {balance != null ? fmt(balance, { sign: true }) : '—'}
      </div>
      <div className="mon-row-actions">
        {onEdit && <button className="mon-row-act" onClick={onEdit} title="Modifier"><Edit3 size={12}/></button>}
        {onDelete && <button className="mon-row-act" onClick={onDelete} title="Supprimer"><Trash2 size={12}/></button>}
      </div>
    </div>
  );
}

function EmptyRow({ label }) {
  return <div className="mon-row mon-row-empty"><div className="mon-row-name">{label}</div><div/><div/><div/><div/></div>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupByCategory(charges, categories) {
  const map = {};
  charges.forEach(fc => {
    const slug = fc.category_slug || 'other';
    const cat = categories.find(c => c.slug === slug || c.id === slug);
    if (!map[slug]) map[slug] = { category: cat, slug, total: 0, items: [] };
    map[slug].total += fc.amount || 0;
    map[slug].items.push(fc);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function spentSumFromGroups(groups, spentMap) {
  let total = 0;
  groups.forEach(g => {
    g.items.forEach(it => {
      total += spentMap.get(it.category_slug) || 0;
    });
  });
  return total;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}

const css = `
.monthly-view { display: flex; flex-direction: column; gap: 18px; }

/* Month carousel */
.mon-monthbar {
  display: flex; gap: 6px; overflow-x: auto;
  padding: 4px 2px 8px; margin: 0 -2px;
  scrollbar-width: thin; scroll-snap-type: x proximity;
  position: sticky; top: 0; z-index: 5;
  background: var(--bg);
}
.mon-monthbar::-webkit-scrollbar { height: 4px; }
.mon-monthbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.mon-month {
  display: inline-flex; flex-direction: column; align-items: center;
  flex: 0 0 auto; padding: 6px 12px; min-width: 56px;
  background: transparent; border: 1px solid transparent;
  border-radius: 999px; color: var(--ink-3); font-family: inherit;
  cursor: pointer; transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
  scroll-snap-align: center;
}
.mon-month-year { font-size: 10px; letter-spacing: 0.06em; opacity: 0.7; font-feature-settings: 'tnum'; }
.mon-month-label { font-size: 13px; font-weight: 500; text-transform: capitalize; }
.mon-month:hover { background: var(--bg-hover); color: var(--ink); }
.mon-month.is-active { background: var(--accent-soft); color: var(--accent-2); border-color: var(--accent-line); font-weight: 600; }
.mon-month.is-today:not(.is-active) { color: var(--accent); }

/* Summary card */
.mon-summary { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 22px 24px; }
.mon-summary-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.mon-summary-title { font-family: var(--font-serif); font-style: italic; font-size: 22px; letter-spacing: -0.025em; color: var(--ink); text-transform: capitalize; }
.mon-summary-tag { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); background: var(--accent-soft); padding: 2px 8px; border-radius: 4px; }
.mon-summary-grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 28px; }
.mon-summary-cell { display: flex; flex-direction: column; gap: 4px; }
.mon-summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-3); }
.mon-summary-value { font-family: var(--font-serif); font-size: 30px; letter-spacing: -0.025em; color: var(--ink); font-weight: 400; }
.mon-summary-value.pos { color: var(--positive); }
.mon-summary-value.neg { color: var(--negative); }
.mon-hero { font-size: 38px; }
.mon-summary-sub { font-size: 11.5px; color: var(--ink-3); }

/* Tabs */
.mon-tabs { display: inline-flex; gap: 2px; padding: 3px; background: var(--bg-sunk); border: 1px solid var(--border); border-radius: 10px; align-self: flex-start; }
.mon-tabs button { background: transparent; border: none; padding: 6px 14px; border-radius: 7px; font: 500 13px/1 var(--font-sans); color: var(--ink-2); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
.mon-tabs button:hover { color: var(--ink); }
.mon-tabs button.on { background: var(--bg-elev); color: var(--ink); box-shadow: var(--shadow-sm); }

/* Budget table */
.mon-budget { display: flex; flex-direction: column; gap: 1px; background: var(--bg); }
.mon-table-head {
  display: grid; grid-template-columns: 1fr 120px 120px 120px;
  gap: 12px; padding: 8px 16px;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-3); font-weight: 500;
}
.mon-table-head .num { text-align: right; }

.mon-grp { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.mon-grp + .mon-grp { margin-top: 8px; }
.mon-grp-head {
  display: grid; grid-template-columns: 14px 18px 1fr auto 1fr 120px 120px 120px 28px;
  gap: 8px; align-items: center;
  padding: 12px 16px;
  background: transparent; border: none; cursor: pointer; width: 100%;
  font-family: inherit; text-align: left;
  transition: background var(--t-fast);
}
.mon-grp-head:hover { background: var(--bg-hover); }
.mon-grp.is-open .mon-grp-head { background: var(--bg-sunk); border-bottom: 1px solid var(--border); }
.mon-grp-caret { display: grid; place-items: center; color: var(--ink-3); }
.mon-grp-icon { display: grid; place-items: center; color: var(--accent); }
.mon-grp.is-neutral .mon-grp-icon { color: var(--ink-3); }
.mon-grp.is-income .mon-grp-icon { color: var(--positive); }
.mon-grp-name { font-family: var(--font-serif); font-style: italic; font-size: 16px; letter-spacing: -0.02em; color: var(--ink); font-weight: 400; }
.mon-grp-yearly { font-size: 11px; color: var(--ink-3); font-style: italic; }
.mon-grp-spacer { /* absorbs flex */ }
.mon-grp-val { text-align: right; font-size: 13px; font-weight: 500; color: var(--ink); font-feature-settings: 'tnum'; }
.mon-grp-val.pos { color: var(--positive); }
.mon-grp-val.neg { color: var(--negative); }
.mon-grp-add {
  display: grid; place-items: center;
  width: 24px; height: 24px;
  background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--ink-2); cursor: pointer; transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.mon-grp-add:hover { background: var(--accent-soft); color: var(--accent-2); border-color: var(--accent-line); }

.mon-grp-body { display: flex; flex-direction: column; }

.mon-row {
  display: grid; grid-template-columns: 1fr 120px 120px 120px 56px;
  gap: 12px; align-items: center;
  padding: 10px 16px;
  border-top: 1px dashed var(--border);
  transition: background var(--t-fast);
}
.mon-row:first-child { border-top: none; }
.mon-row:hover { background: var(--bg-hover); }
.mon-row-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.mon-row-icon { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; background: var(--bg-sunk); color: var(--ink-2); flex-shrink: 0; }
.mon-row-info { min-width: 0; }
.mon-row-label { font-size: 13.5px; font-weight: 500; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mon-row-meta { font-size: 11px; color: var(--ink-3); margin-top: 1px; }
.mon-row-val { text-align: right; font-size: 13px; color: var(--ink-2); font-feature-settings: 'tnum'; }
.mon-row-val.pos { color: var(--positive); font-weight: 500; }
.mon-row-val.neg { color: var(--negative); font-weight: 500; }
.mon-row-val.neutral { color: var(--ink-3); font-style: italic; }
.mon-row-actions { display: flex; gap: 4px; justify-content: flex-end; opacity: 0; transition: opacity var(--t-fast); }
.mon-row:hover .mon-row-actions { opacity: 1; }
.mon-row-act { background: transparent; border: none; color: var(--ink-3); cursor: pointer; padding: 4px; border-radius: 4px; transition: background var(--t-fast), color var(--t-fast); }
.mon-row-act:hover { background: var(--bg-sunk); color: var(--ink); }
.mon-row-empty { color: var(--ink-3); font-size: 12.5px; font-style: italic; padding: 12px 16px; }
.mon-row-empty .mon-row-name { font-family: var(--font-serif); }

/* Alert + tip */
.mon-alert { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: var(--warning-soft); border: 1px solid var(--warning); border-radius: 12px; color: var(--warning); margin-top: 8px; }
.mon-alert > svg { flex-shrink: 0; margin-top: 2px; }
.mon-alert strong { display: block; font-size: 13px; margin-bottom: 2px; }
.mon-alert span { font-size: 12.5px; opacity: 0.85; }
.mon-tip { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; background: var(--bg-sunk); border-radius: 10px; font-size: 12.5px; color: var(--ink-2); margin-top: 4px; line-height: 1.5; }
.mon-tip > svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }

/* Evolution tab */
.mon-card { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 20px 24px; }
.mon-card-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
.mon-card-head h3 { font-family: var(--font-serif); font-size: 18px; font-weight: 400; font-style: italic; letter-spacing: -0.02em; color: var(--ink); margin: 0; }
.mon-card-meta { font-size: 12px; color: var(--ink-3); }
.mon-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: var(--ink-3); font-size: 13px; }

/* Responsive — phones */
@media (max-width: 760px) {
  .mon-summary { padding: 18px 16px; }
  .mon-summary-title { font-size: 18px; }
  .mon-summary-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
  .mon-summary-cell:last-child { grid-column: 1 / -1; }
  .mon-summary-value { font-size: 22px; }
  .mon-hero { font-size: 28px; }

  .mon-table-head { grid-template-columns: 1fr 80px 80px; padding: 6px 12px; }
  .mon-table-head > div:nth-child(2) { display: none; }
  .mon-grp { border-radius: 10px; }
  .mon-grp-head { grid-template-columns: 14px 18px 1fr 80px 80px 24px; padding: 10px 12px; gap: 6px; }
  .mon-grp-head .mon-grp-yearly { display: none; }
  .mon-grp-head .mon-grp-val:first-of-type { display: none; }
  .mon-row { grid-template-columns: 1fr 80px 80px 32px; padding: 9px 12px; gap: 8px; }
  .mon-row .mon-row-val:first-of-type { display: none; }
  .mon-row-actions { opacity: 1; }
  .mon-row-act { padding: 2px; }
}
`;

// ─── Modal: FixedChargeEditor (unchanged) ──────────────────────────────────

function FixedChargeEditor({ charge, categories, members, currentMonth, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    id: charge.id || null,
    name: charge.name || '',
    amount: charge.amount ?? '',
    day_of_month: charge.day_of_month || 1,
    category_slug: charge.category_slug || 'subscriptions',
    start_month: charge.start_month || currentMonth,
    end_month: charge.end_month || '',
    notes: charge.notes || '',
    member_ids: charge.member_ids || [],
  });
  const submit = () => {
    if (!draft.name.trim() || !draft.amount) return;
    onSave({
      ...draft,
      amount: parseFloat(draft.amount),
      end_month: draft.end_month || null,
    });
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{draft.id ? 'Modifier la charge fixe' : 'Nouvelle charge fixe'}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <label><span>Nom</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Loyer, EDF, Netflix…"/></label>
          <label><span>Montant mensuel (€)</span><input type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })}/></label>
          <label><span>Jour du mois</span>
            <input type="number" min={1} max={31} value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: parseInt(e.target.value, 10) || 1 })}/>
          </label>
          <label><span>Catégorie</span>
            <select value={draft.category_slug} onChange={(e) => setDraft({ ...draft, category_slug: e.target.value })}>
              {categories.map(c => <option key={c.slug || c.id} value={c.slug || c.id}>{c.icon} {c.name}</option>)}
            </select>
          </label>
          <label><span>Actif depuis</span>
            <input type="month" value={draft.start_month} onChange={(e) => setDraft({ ...draft, start_month: e.target.value })}/>
          </label>
          <label><span>Actif jusqu'à (optionnel)</span>
            <input type="month" value={draft.end_month} onChange={(e) => setDraft({ ...draft, end_month: e.target.value })}/>
          </label>
          {members && members.length > 0 && (
            <label><span>Membres concernés</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {members.map(m => {
                  const checked = draft.member_ids.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`secondary-btn ${checked ? 'active' : ''}`}
                      style={{ borderColor: checked ? 'var(--primary)' : undefined }}
                      onClick={() => setDraft({
                        ...draft,
                        member_ids: checked ? draft.member_ids.filter(x => x !== m.id) : [...draft.member_ids, m.id],
                      })}
                    >{m.name}</button>
                  );
                })}
              </div>
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <button className="primary-btn" onClick={submit}><Check size={14}/> Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
