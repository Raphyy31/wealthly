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
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ComposedChart, Bar, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Sankey, Layer, Rectangle, PieChart, Pie, Cell,
} from 'recharts';
import { useIsNarrow } from '../hooks/useIsNarrow.js';
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
  budgets = {}, setBudget = () => {},
  memberShare, currentMonth, fmt, transferIds = new Set(),
}) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingCharge, setEditingCharge] = useState(null);
  const [tab, setTab] = useState('budget'); // budget | evolution
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const monthBarRef = useRef(null);
  const [fluxMode, setFluxMode] = useState('reel'); // 'reel' | 'type'
  const [refMonth, setRefMonth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wealthly:ref_month') || 'null') || { lines: [] }; }
    catch { return { lines: [] }; }
  });

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

  useEffect(() => {
    localStorage.setItem('wealthly:ref_month', JSON.stringify(refMonth));
  }, [refMonth]);

  const monthData = useMemo(
    () => monthlyEvolution.find(m => m.month === selectedMonth) || { income: 0, expenses: 0, net: 0, fixed: 0, variable: 0, savings: 0 },
    [monthlyEvolution, selectedMonth]
  );
  const isCurrentMonth = selectedMonth === currentMonth;

  // ── Active fixed charges + fixed incomes for the selected month ────────
  const activeFixedAll = useMemo(() => {
    return (fixedCharges || []).filter(fc => {
      if (fc.start_month && selectedMonth < fc.start_month) return false;
      if (fc.end_month && selectedMonth > fc.end_month) return false;
      return true;
    });
  }, [fixedCharges, selectedMonth]);
  const activeFixedCharges = activeFixedAll.filter(fc => (fc.kind || 'expense') === 'expense');
  const activeFixedIncomes = activeFixedAll.filter(fc => fc.kind === 'income');
  const totalFixedBudgeted = activeFixedCharges.reduce((s, fc) => s + (fc.amount || 0), 0);
  const totalIncomeBudgeted = activeFixedIncomes.reduce((s, fc) => s + (fc.amount || 0), 0);

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

  // ── Cashflow tab: income/expense by category for selected month ────────
  const cashflowData = useMemo(() => {
    const catFor = slug => categories.find(c => c.slug === slug || c.id === slug);
    const monthTx = transactions
      .filter(t => {
        const [ty, tm] = t.date.split('-');
        const mk = `${ty}-${tm}`;
        return mk === selectedMonth && !transferIds.has(t.id);
      })
      .map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        const share = acc ? memberShare(acc) : 1;
        return { ...t, sharedAmount: t.amount * share };
      });

    const incomeByCat = {};
    const expenseByCat = {};
    monthTx.forEach(t => {
      const slug = t.categoryId || 'uncategorized';
      if (t.amount >= 0) incomeByCat[slug] = (incomeByCat[slug] || 0) + t.sharedAmount;
      else expenseByCat[slug] = (expenseByCat[slug] || 0) + Math.abs(t.sharedAmount);
    });

    const totalIncome = Object.values(incomeByCat).reduce((s, v) => s + v, 0);
    const totalExpense = Object.values(expenseByCat).reduce((s, v) => s + v, 0);
    const available = totalIncome - totalExpense;
    const incomeEntries = Object.entries(incomeByCat).sort((a, b) => b[1] - a[1]);
    const expenseEntries = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);

    const nodes = [];
    const links = [];
    incomeEntries.forEach(([slug, value]) => {
      const cat = catFor(slug);
      nodes.push({ name: cat?.name || slug, kind: 'income', value, color: cat?.color || 'var(--positive)' });
    });
    const hubIdx = nodes.length;
    nodes.push({ name: 'Disponible', kind: 'hub' });
    expenseEntries.forEach(([slug, value]) => {
      const cat = catFor(slug);
      nodes.push({ name: cat?.name || slug, kind: 'expense', value, color: cat?.color || 'var(--negative)' });
    });
    if (available > 0) {
      const surplusIdx = nodes.length;
      nodes.push({ name: 'Épargne', kind: 'savings', value: available, color: 'var(--accent)' });
      links.push({ source: hubIdx, target: surplusIdx, value: available });
    }
    incomeEntries.forEach((_, i) => links.push({ source: i, target: hubIdx, value: incomeEntries[i][1] }));
    expenseEntries.forEach((_, i) => links.push({ source: hubIdx, target: hubIdx + 1 + i, value: expenseEntries[i][1] }));

    return { nodes, links, totalIncome, totalExpense, available, incomeEntries, expenseEntries, catFor, hasData: totalIncome > 0 || totalExpense > 0 };
  }, [transactions, selectedMonth, transferIds, accounts, memberShare, categories]);

  // ── Average per category over the last 6 complete months ──────────────────
  const avgByCat = useMemo(() => {
    const [cy, cm] = currentMonth.split('-').map(Number);
    const pastMonths = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(cy, cm - 1 - i, 1);
      pastMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const N = pastMonths.length;
    const incomeSum = {}, expenseSum = {};
    transactions.forEach(t => {
      if (!pastMonths.includes(monthKey(t.date))) return;
      if (transferIds.has(t.id)) return;
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const amt = t.amount * share;
      const slug = t.categoryId || 'uncategorized';
      if (amt >= 0) incomeSum[slug] = (incomeSum[slug] || 0) + amt;
      else expenseSum[slug] = (expenseSum[slug] || 0) + Math.abs(amt);
    });
    const income = {}, expense = {};
    Object.entries(incomeSum).forEach(([s, v]) => { income[s] = v / N; });
    Object.entries(expenseSum).forEach(([s, v]) => { expense[s] = v / N; });
    return { income, expense };
  }, [transactions, currentMonth, transferIds, accounts, memberShare]);

  // ── Merge auto averages with manual overrides ─────────────────────────────
  const refMonthLines = useMemo(() => {
    const allSlugs = new Set([...Object.keys(avgByCat.income), ...Object.keys(avgByCat.expense)]);
    return [...allSlugs].map(slug => {
      const override = refMonth.lines.find(l => l.slug === slug);
      const avgIncome = avgByCat.income[slug] || 0;
      const avgExpense = avgByCat.expense[slug] || 0;
      const isIncome = avgIncome >= avgExpense;
      const avgVal = isIncome ? avgIncome : avgExpense;
      const mode = override?.mode || 'auto';
      const manualAmount = override?.amount ?? avgVal;
      const effectiveAmount = mode === 'manuel' ? manualAmount : avgVal;
      return { slug, isIncome, mode, manualAmount, avgVal, effectiveAmount };
    });
  }, [avgByCat, refMonth]);

  // ── Sankey data for the mois type view ────────────────────────────────────
  const refMonthCashflow = useMemo(() => {
    const catFor = slug => categories.find(c => c.slug === slug || c.id === slug);
    const incomeLines = refMonthLines.filter(l => l.isIncome && l.effectiveAmount > 0).sort((a, b) => b.effectiveAmount - a.effectiveAmount);
    const expenseLines = refMonthLines.filter(l => !l.isIncome && l.effectiveAmount > 0).sort((a, b) => b.effectiveAmount - a.effectiveAmount);
    const totalIncome = incomeLines.reduce((s, l) => s + l.effectiveAmount, 0);
    const totalExpense = expenseLines.reduce((s, l) => s + l.effectiveAmount, 0);
    const available = totalIncome - totalExpense;
    const nodes = [], links = [];
    incomeLines.forEach(l => {
      const cat = catFor(l.slug);
      nodes.push({ name: cat?.name || l.slug, kind: 'income', value: l.effectiveAmount, color: cat?.color || 'var(--positive)' });
    });
    const hubIdx = nodes.length;
    nodes.push({ name: 'Disponible', kind: 'hub' });
    expenseLines.forEach(l => {
      const cat = catFor(l.slug);
      nodes.push({ name: cat?.name || l.slug, kind: 'expense', value: l.effectiveAmount, color: cat?.color || 'var(--negative)' });
    });
    if (available > 0) {
      nodes.push({ name: 'Épargne', kind: 'savings', value: available, color: 'var(--accent)' });
      links.push({ source: hubIdx, target: nodes.length - 1, value: available });
    }
    incomeLines.forEach((_, i) => links.push({ source: i, target: hubIdx, value: incomeLines[i].effectiveAmount }));
    expenseLines.forEach((_, i) => links.push({ source: hubIdx, target: hubIdx + 1 + i, value: expenseLines[i].effectiveAmount }));
    return { nodes, links, totalIncome, totalExpense, available, incomeLines, expenseLines, catFor, hasData: totalIncome > 0 || totalExpense > 0 };
  }, [refMonthLines, categories]);

  const isNarrow = useIsNarrow(760);

  // ── Group expense categories into "Abonnements" vs "Charges fixes" vs
  // "Dépenses variables" based on whether they have a registered fixed
  // charge, the subscriptions tag, or are loose expense categories.
  const subsFixed = activeFixedCharges.filter(fc => (fc.category_slug || '').toLowerCase() === 'subscriptions');
  const otherFixed = activeFixedCharges.filter(fc => (fc.category_slug || '').toLowerCase() !== 'subscriptions');

  const subsByCategory = useMemo(() => groupByCategory(subsFixed, categories), [subsFixed, categories]);
  const fixedByCategory = useMemo(() => groupByCategory(otherFixed, categories), [otherFixed, categories]);

  // Variable expenses: month transactions that are NOT transfers, NOT income,
  // NOT covered by a recurring/fixed pattern. Roll up per category. Merge
  // budgeted categories (even with 0 spend) so users see what they planned.
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
    // Add budgeted-but-not-spent categories so they appear with budget but 0 spend
    Object.entries(budgets).forEach(([catId, amount]) => {
      if (!amount || amount <= 0) return;
      if (map.has(catId)) return;
      const cat = categories.find(c => c.id === catId || c.slug === catId);
      if (!cat || cat.type === 'income') return;
      map.set(catId, { id: catId, name: cat.name, icon: cat.icon || '?', color: cat.color, dépensé: 0, items: [] });
    });
    return [...map.values()].sort((a, b) => (b.dépensé + (budgets[b.id] || 0) * 0.1) - (a.dépensé + (budgets[a.id] || 0) * 0.1));
  }, [monthTransactions, categories, recurringIds, budgets]);
  const totalVariableSpent = variableByCategory.reduce((s, g) => s + g.dépensé, 0);
  const totalVariableBudgeted = variableByCategory.reduce((s, g) => s + (budgets[g.id] || 0), 0);

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
  const totalBudgeted = totalFixedBudgeted + totalVariableBudgeted;
  const totalSpent = monthData.expenses;
  // Estimated savings prefers planned income (totalIncomeBudgeted) if set,
  // otherwise actual received income.
  const incomePlanned = totalIncomeBudgeted || totalIncome;
  const estimatedSavings = incomePlanned - totalBudgeted;

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

  const startEdit = (chargeOrPartial) => {
    // If we get an existing charge (with an id), edit it as-is.
    // If we get a "creation seed" partial (no id), merge it into the empty draft.
    const isExisting = chargeOrPartial && chargeOrPartial.id;
    if (isExisting) {
      setEditingCharge(chargeOrPartial);
      return;
    }
    setEditingCharge({
      name: '', amount: '', day_of_month: 1,
      category_slug: chargeOrPartial?.kind === 'income' ? 'income' : 'subscriptions',
      start_month: selectedMonth, end_month: null, member_ids: [], notes: '',
      kind: 'expense',
      ...(chargeOrPartial || {}),
    });
  };

  const toggleGroup = (key) => setCollapsedGroups(g => ({ ...g, [key]: !g[key] }));
  const isGroupOpen = (key) => !collapsedGroups[key];
  const updateRefLine = (slug, updates) =>
    setRefMonth(prev => {
      const existing = prev.lines.find(l => l.slug === slug) || { slug, mode: 'auto', amount: 0 };
      return { ...prev, lines: [...prev.lines.filter(l => l.slug !== slug), { ...existing, ...updates }] };
    });
  const resetRefMonth = () => setRefMonth({ lines: [] });

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
            <div className="mon-summary-sub num">sur {fmt(totalIncomeBudgeted || monthData.income)} prévu</div>
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
        <button className={tab === 'cashflow' ? 'on' : ''} onClick={() => setTab('cashflow')}>Flux</button>
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
            budgeted={totalVariableBudgeted || null}
            actual={totalVariableSpent}
            open={isGroupOpen('variables')}
            onToggle={() => toggleGroup('variables')}
            fmt={fmt}
          >
            {variableByCategory.map(g => (
              <BudgetRow
                key={g.id}
                name={g.name}
                meta={g.items.length > 1 ? `${g.items.length} opérations` : (g.items.length === 1 ? '1 opération' : (budgets[g.id] > 0 ? 'Aucune dépense' : null))}
                icon={g.icon}
                color={g.color}
                budgeted={budgets[g.id] || 0}
                editableBudget
                onBudgetChange={(v) => setBudget(g.id, v)}
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
            budgeted={totalIncomeBudgeted || null}
            actual={totalIncome}
            actualLabel="reçu"
            open={isGroupOpen('revenus')}
            onToggle={() => toggleGroup('revenus')}
            onAdd={() => startEdit({ kind: 'income' })}
            fmt={fmt}
            isIncome
          >
            {activeFixedIncomes.map(it => (
              <BudgetRow
                key={it.id}
                name={it.name}
                meta={it.day_of_month ? `Prévu · J${it.day_of_month}` : 'Revenu fixe'}
                budgeted={it.amount}
                actual={null}
                isIncome
                fmt={fmt}
                onEdit={() => startEdit(it)}
                onDelete={() => deleteFixedCharge(it.id)}
              />
            ))}
            {incomeByCategory.length > 0 ? incomeByCategory.map(g => (
              <BudgetRow
                key={g.id}
                name={g.name}
                meta={g.items.length > 1 ? `${g.items.length} opérations détectées` : 'Détecté ce mois'}
                icon={g.icon}
                color={g.color}
                budgeted={null}
                actual={g.reçu}
                isIncome
                fmt={fmt}
              />
            )) : (activeFixedIncomes.length === 0 && <EmptyRow label="Aucun revenu enregistré ce mois"/>)}
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

      {tab === 'cashflow' && (
        <section className="mon-cashflow">
          {/* Sub-toggle Mois réel / Mois type */}
          <div className="flux-mode-bar">
            <div className="flux-mode-toggle">
              <button className={fluxMode === 'reel' ? 'on' : ''} onClick={() => setFluxMode('reel')}>Mois réel</button>
              <button className={`type ${fluxMode === 'type' ? 'on' : ''}`} onClick={() => setFluxMode('type')}>Mois type</button>
            </div>
            <span className="flux-mode-hint">
              {fluxMode === 'reel'
                ? formatDate(selectedMonth + '-01', { format: 'monthLong' })
                : 'Mois de référence — modifiable'}
            </span>
          </div>

          {fluxMode === 'reel' && (
            <>
              {cashflowData.hasData ? (
                <div className="mon-card" style={{ overflowX: 'auto' }}>
                  <div className="mon-card-head">
                    <h3>Flux du mois</h3>
                    <span className="mon-card-meta">{cashflowData.incomeEntries.length} source{cashflowData.incomeEntries.length > 1 ? 's' : ''} · {cashflowData.expenseEntries.length} catégorie{cashflowData.expenseEntries.length > 1 ? 's' : ''}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={isNarrow ? 480 : 380}>
                    <Sankey
                      data={{ nodes: cashflowData.nodes, links: cashflowData.links }}
                      nodePadding={isNarrow ? 14 : 22}
                      nodeWidth={isNarrow ? 8 : 10}
                      linkCurvature={0.5}
                      iterations={64}
                      node={<MonthlySankeyNode narrow={isNarrow}/>}
                      link={{ stroke: 'var(--border)', strokeOpacity: 0.45, fill: 'var(--accent-soft)' }}
                      margin={isNarrow ? { top: 8, right: 80, bottom: 8, left: 80 } : { top: 12, right: 160, bottom: 12, left: 160 }}
                    >
                      <Tooltip
                        formatter={v => fmt(v)}
                        contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      />
                    </Sankey>
                  </ResponsiveContainer>
                  <div className="cashflow-kpi-row" style={{ marginTop: 8 }}>
                    <div className="cashflow-kpi">
                      <div className="cashflow-kpi-label">Entrées</div>
                      <div className="cashflow-kpi-value positive">+{fmt(cashflowData.totalIncome)}</div>
                    </div>
                    <div className="cashflow-kpi">
                      <div className="cashflow-kpi-label">Sorties</div>
                      <div className="cashflow-kpi-value negative">−{fmt(cashflowData.totalExpense)}</div>
                    </div>
                    <div className="cashflow-kpi">
                      <div className="cashflow-kpi-label">Disponible</div>
                      <div className={`cashflow-kpi-value ${cashflowData.available >= 0 ? 'positive' : 'negative'}`}>
                        {cashflowData.available >= 0 ? '+' : ''}{fmt(cashflowData.available)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mon-empty"><Activity size={28}/><span>Aucune transaction ce mois-ci.</span></div>
              )}
              {cashflowData.hasData && (
                <div className="cashflow-cats-grid">
                  <div className="mon-card">
                    <div className="mon-card-head"><h3>Entrées</h3></div>
                    <div className="cashflow-cat-list">
                      {cashflowData.incomeEntries.map(([slug, value]) => {
                        const cat = cashflowData.catFor(slug);
                        const pct = cashflowData.totalIncome > 0 ? (value / cashflowData.totalIncome * 100).toFixed(0) : 0;
                        return (
                          <div key={slug} className="cashflow-cat-row">
                            <span className="cashflow-cat-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || 'var(--positive)' }}>{cat?.icon || '💰'}</span>
                            <div className="cashflow-cat-info">
                              <div className="cashflow-cat-name">{cat?.name || slug}</div>
                              <div className="cashflow-cat-meta">{pct} % des entrées</div>
                            </div>
                            <div className="cashflow-cat-amount positive">+{fmt(value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mon-card">
                    <div className="mon-card-head"><h3>Sorties</h3></div>
                    <div className="cashflow-cat-list">
                      {cashflowData.expenseEntries.map(([slug, value]) => {
                        const cat = cashflowData.catFor(slug);
                        const pct = cashflowData.totalExpense > 0 ? (value / cashflowData.totalExpense * 100).toFixed(0) : 0;
                        return (
                          <div key={slug} className="cashflow-cat-row">
                            <span className="cashflow-cat-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || 'var(--negative)' }}>{cat?.icon || '💸'}</span>
                            <div className="cashflow-cat-info">
                              <div className="cashflow-cat-name">{cat?.name || slug}</div>
                              <div className="cashflow-cat-meta">{pct} % des sorties</div>
                            </div>
                            <div className="cashflow-cat-amount negative">−{fmt(value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {fluxMode === 'type' && (
            <>
              {refMonthCashflow.hasData ? (
                <div className="mon-card" style={{ overflowX: 'auto' }}>
                  <div className="mon-card-head">
                    <h3>Flux type</h3>
                    <span className="mon-card-meta">Moyenne 6 mois · avec ajustements manuels</span>
                  </div>
                  <ResponsiveContainer width="100%" height={isNarrow ? 480 : 380}>
                    <Sankey
                      data={{ nodes: refMonthCashflow.nodes, links: refMonthCashflow.links }}
                      nodePadding={isNarrow ? 14 : 22}
                      nodeWidth={isNarrow ? 8 : 10}
                      linkCurvature={0.5}
                      iterations={64}
                      node={<MonthlySankeyNode narrow={isNarrow}/>}
                      link={{ stroke: 'var(--border)', strokeOpacity: 0.45, fill: 'var(--accent-soft)' }}
                      margin={isNarrow ? { top: 8, right: 80, bottom: 8, left: 80 } : { top: 12, right: 160, bottom: 12, left: 160 }}
                    >
                      <Tooltip
                        formatter={v => fmt(v)}
                        contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      />
                    </Sankey>
                  </ResponsiveContainer>
                  <div className="cashflow-kpi-row" style={{ marginTop: 8 }}>
                    <div className="cashflow-kpi">
                      <div className="cashflow-kpi-label">Entrées types</div>
                      <div className="cashflow-kpi-value positive">+{fmt(refMonthCashflow.totalIncome)}</div>
                    </div>
                    <div className="cashflow-kpi">
                      <div className="cashflow-kpi-label">Sorties types</div>
                      <div className="cashflow-kpi-value negative">−{fmt(refMonthCashflow.totalExpense)}</div>
                    </div>
                    <div className="cashflow-kpi">
                      <div className="cashflow-kpi-label">Épargne cible</div>
                      <div className={`cashflow-kpi-value ${refMonthCashflow.available >= 0 ? 'positive' : 'negative'}`}>
                        {refMonthCashflow.available >= 0 ? '+' : ''}{fmt(refMonthCashflow.available)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mon-empty"><Activity size={28}/><span>Pas assez de données pour calculer un mois type.</span></div>
              )}

              <div className="refmonth-section">
                <div className="refmonth-header">
                  <span className="refmonth-title">Définir le mois type</span>
                  <button className="refmonth-reset-btn" onClick={resetRefMonth}>
                    ↺ Initialiser depuis la moyenne
                  </button>
                </div>

                {refMonthCashflow.incomeLines.length > 0 && (
                  <div className="refmonth-group">
                    <div className="refmonth-group-head income-head">
                      <ArrowUp size={12}/> Revenus
                      <span className="refmonth-group-total">{fmt(refMonthCashflow.totalIncome)}</span>
                    </div>
                    {refMonthCashflow.incomeLines.map(line => (
                      <RefMonthLine key={line.slug} line={line} categories={categories} fmt={fmt} onUpdate={u => updateRefLine(line.slug, u)}/>
                    ))}
                  </div>
                )}

                {refMonthCashflow.expenseLines.length > 0 && (
                  <div className="refmonth-group">
                    <div className="refmonth-group-head expense-head">
                      <ArrowDown size={12}/> Dépenses
                      <span className="refmonth-group-total">{fmt(refMonthCashflow.totalExpense)}</span>
                    </div>
                    {refMonthCashflow.expenseLines.map(line => (
                      <RefMonthLine key={line.slug} line={line} categories={categories} fmt={fmt} onUpdate={u => updateRefLine(line.slug, u)}/>
                    ))}
                  </div>
                )}

                {refMonthLines.length === 0 && (
                  <div className="mon-empty"><Lightbulb size={24}/><span>Connectez des comptes et importez des transactions pour calculer un mois type.</span></div>
                )}
              </div>
            </>
          )}
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

function BudgetRow({ name, meta, icon, color, budgeted, actual, fmt, onEdit, onDelete, editableBudget, onBudgetChange, isNeutral, isIncome }) {
  const balance = budgeted != null && budgeted > 0 && actual != null ? budgeted - actual : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budgeted || '');
  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0 && v !== budgeted) onBudgetChange(v);
    setEditing(false);
  };
  return (
    <div className="mon-row">
      <div className="mon-row-name">
        {icon && <span className="mon-row-icon" style={color ? { background: color + '22', color } : null}>{icon}</span>}
        <div className="mon-row-info">
          <div className="mon-row-label">{name}</div>
          {meta && <div className="mon-row-meta">{meta}</div>}
        </div>
      </div>
      <div className="mon-row-val num">
        {editableBudget ? (
          editing ? (
            <input
              type="number"
              className="mon-budget-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(budgeted || ''); setEditing(false); } }}
              autoFocus
              placeholder="0"
            />
          ) : (
            <button
              className="mon-budget-edit"
              onClick={() => { setDraft(budgeted || ''); setEditing(true); }}
              title="Cliquer pour définir un budget"
            >{budgeted > 0 ? fmt(budgeted) : <span className="mon-budget-dash">+ budget</span>}</button>
          )
        ) : (budgeted != null ? fmt(budgeted) : '—')}
      </div>
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

function RefMonthLine({ line, categories, fmt, onUpdate }) {
  const cat = categories.find(c => c.slug === line.slug || c.id === line.slug);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.manualAmount);
  const isManuel = line.mode === 'manuel';
  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0) onUpdate({ mode: 'manuel', amount: v });
    setEditing(false);
  };
  return (
    <div className="refmonth-row">
      <span className="refmonth-cat-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || (line.isIncome ? 'var(--positive)' : 'var(--negative)') }}>
        {cat?.icon || '?'}
      </span>
      <div className="refmonth-cat-info">
        <div className="refmonth-cat-name">{cat?.name || line.slug}</div>
        <div className="refmonth-cat-sub">
          {isManuel
            ? <span className="refmonth-badge-manual">manuel</span>
            : <><span className="refmonth-badge-auto">moy.</span> {fmt(line.avgVal)}/mois · 6 mois</>
          }
        </div>
      </div>
      <div className="refmonth-mode-badge">
        <button
          className={`refmonth-mode-btn ${!isManuel ? 'on-auto' : ''}`}
          onClick={() => onUpdate({ mode: 'auto' })}
        >Auto</button>
        <button
          className={`refmonth-mode-btn ${isManuel ? 'on-manual' : ''}`}
          onClick={() => { if (!isManuel) { onUpdate({ mode: 'manuel', amount: line.avgVal }); setDraft(line.avgVal); setEditing(true); } }}
        >Manuel</button>
      </div>
      <div className="refmonth-amount">
        {isManuel && editing ? (
          <input
            className="refmonth-input"
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
        ) : (
          <button
            className={`refmonth-amount-btn ${!isManuel ? 'is-auto' : ''}`}
            onClick={() => { if (isManuel) { setDraft(line.manualAmount); setEditing(true); } }}
            disabled={!isManuel}
          >{fmt(line.effectiveAmount)}</button>
        )}
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

// ─── Sankey node for the Flux tab ───────────────────────────────────────────
const MonthlySankeyNode = React.memo(function MonthlySankeyNode({ x, y, width, height, index, payload, narrow }) {
  const isLeft = payload.kind === 'income';
  const color = payload.color || (payload.kind === 'hub' ? 'var(--accent)' : payload.kind === 'savings' ? 'var(--accent)' : payload.kind === 'income' ? 'var(--positive)' : 'var(--negative)');
  const labelOffset = narrow ? 5 : 8;
  const fontSize = narrow ? 10 : 12;
  const valueLabel = payload.value ? Math.round(payload.value).toLocaleString('fr-FR') + ' €' : '';
  const labelText = narrow ? payload.name : `${payload.name}${valueLabel ? ` · ${valueLabel}` : ''}`;
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={payload.kind === 'hub' ? 0.9 : 0.75} stroke="none"/>
      {payload.kind !== 'hub' && (
        <text textAnchor={isLeft ? 'end' : 'start'} x={isLeft ? x - labelOffset : x + width + labelOffset} y={y + height / 2} dy={4} fontSize={fontSize} fill="var(--ink-2)">
          {labelText}
        </text>
      )}
      {payload.kind === 'hub' && (
        <text textAnchor="middle" x={x + width / 2} y={y - 8} fontSize={11} fill="var(--ink-3)">Disponible</text>
      )}
    </Layer>
  );
});

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
.mon-budget-edit { background: transparent; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit; font-feature-settings: 'tnum'; transition: color var(--t-fast); }
.mon-budget-edit:hover { color: var(--accent); }
.mon-budget-dash { color: var(--ink-3); font-style: italic; font-size: 11px; opacity: 0.7; }
.mon-budget-edit:hover .mon-budget-dash { color: var(--accent); opacity: 1; }
.mon-budget-input { width: 90px; height: 26px; padding: 0 8px; background: var(--bg-elev); border: 1px solid var(--accent); border-radius: 5px; color: var(--ink); font-family: inherit; font-size: 13px; text-align: right; font-feature-settings: 'tnum'; outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }
@media (max-width: 760px) { .mon-budget-input { width: 70px; } }

/* Flux mode sub-toggle */
.mon-cashflow { display: flex; flex-direction: column; gap: 16px; }
.flux-mode-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.flux-mode-toggle { display: inline-flex; gap: 2px; padding: 2px; background: var(--bg-sunk); border: 1px solid var(--border); border-radius: 8px; }
.flux-mode-toggle button { background: transparent; border: none; padding: 5px 12px; border-radius: 6px; font: 500 12px/1 var(--font-sans); color: var(--ink-3); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); }
.flux-mode-toggle button:hover { color: var(--ink); }
.flux-mode-toggle button.on { background: var(--bg-elev); color: var(--ink); box-shadow: var(--shadow-sm); }
.flux-mode-toggle button.type.on { color: var(--accent); }
.flux-mode-hint { font-size: 12px; color: var(--ink-3); font-style: italic; }

/* Mois type: editable reference month */
.refmonth-section { display: flex; flex-direction: column; gap: 12px; }
.refmonth-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.refmonth-title { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-3); }
.refmonth-reset-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: transparent; border: 1px solid var(--border); border-radius: 7px; font: 500 12px/1 var(--font-sans); color: var(--ink-2); cursor: pointer; transition: border-color var(--t-fast), color var(--t-fast); }
.refmonth-reset-btn:hover { border-color: var(--accent-line); color: var(--accent); }

.refmonth-group { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.refmonth-group-head { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--bg-sunk); border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-3); }
.refmonth-group-head.income-head { color: var(--positive); }
.refmonth-group-head.expense-head { color: var(--negative); }
.refmonth-group-total { margin-left: auto; font-family: var(--font-mono); font-size: 13px; font-weight: 500; color: var(--ink); }

.refmonth-row { display: grid; grid-template-columns: 28px 1fr auto auto; gap: 12px; align-items: center; padding: 10px 16px; border-top: 1px dashed var(--border); transition: background var(--t-fast); }
.refmonth-row:first-child { border-top: none; }
.refmonth-row:hover { background: var(--bg-hover); }
.refmonth-cat-icon { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; font-size: 13px; flex-shrink: 0; }
.refmonth-cat-info { min-width: 0; }
.refmonth-cat-name { font-size: 13.5px; font-weight: 500; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refmonth-cat-sub { font-size: 11px; color: var(--ink-3); margin-top: 1px; display: flex; align-items: center; gap: 4px; }
.refmonth-badge-auto { display: inline-block; padding: 1px 5px; background: var(--bg-sunk); border-radius: 3px; font-size: 10px; color: var(--ink-3); font-family: var(--font-mono); }
.refmonth-badge-manual { display: inline-block; padding: 1px 5px; background: var(--accent-soft); border-radius: 3px; font-size: 10px; color: var(--accent-2); font-family: var(--font-mono); }

.refmonth-mode-badge { display: inline-flex; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); flex-shrink: 0; }
.refmonth-mode-btn { padding: 4px 9px; font: 500 11px/1 var(--font-sans); border: none; background: transparent; cursor: pointer; transition: background var(--t-fast), color var(--t-fast); color: var(--ink-3); }
.refmonth-mode-btn + .refmonth-mode-btn { border-left: 1px solid var(--border); }
.refmonth-mode-btn.on-auto { background: var(--bg-sunk); color: var(--ink-2); }
.refmonth-mode-btn.on-manual { background: var(--accent-soft); color: var(--accent-2); }

.refmonth-amount { text-align: right; min-width: 90px; }
.refmonth-amount-btn { background: transparent; border: none; padding: 0; font: 500 14px/1 var(--font-mono); color: var(--ink); cursor: default; font-feature-settings: 'tnum'; }
.refmonth-amount-btn.is-auto { color: var(--ink-2); font-weight: 400; }
.refmonth-amount-btn:not([disabled]):hover { color: var(--accent); cursor: pointer; }
.refmonth-input { width: 90px; height: 28px; padding: 0 8px; text-align: right; background: var(--bg-elev); border: 1.5px solid var(--accent); border-radius: 6px; color: var(--ink); font: 500 13px/1 var(--font-mono); outline: none; box-shadow: 0 0 0 3px var(--accent-soft); font-feature-settings: 'tnum'; }

@media (max-width: 760px) {
  .refmonth-row { grid-template-columns: 26px 1fr auto; gap: 8px; padding: 9px 12px; }
  .refmonth-amount { display: none; }
  .refmonth-mode-badge { display: none; }
}

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
    kind: charge.kind || 'expense',
  });
  const isIncome = draft.kind === 'income';
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
          <h2>{draft.id ? (isIncome ? 'Modifier le revenu fixe' : 'Modifier la charge fixe') : (isIncome ? 'Nouveau revenu fixe' : 'Nouvelle charge fixe')}</h2>
          <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <label>
            <span>Type</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button type="button" className={`secondary-btn ${!isIncome ? 'active' : ''}`} style={{ borderColor: !isIncome ? 'var(--primary)' : undefined, flex: 1 }} onClick={() => setDraft({ ...draft, kind: 'expense' })}>Dépense</button>
              <button type="button" className={`secondary-btn ${isIncome ? 'active' : ''}`} style={{ borderColor: isIncome ? 'var(--success)' : undefined, color: isIncome ? 'var(--success)' : undefined, flex: 1 }} onClick={() => setDraft({ ...draft, kind: 'income' })}>Revenu</button>
            </div>
          </label>
          <label><span>Nom</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={isIncome ? 'Salaire, APL, Allocation…' : 'Loyer, EDF, Netflix…'}/></label>
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
