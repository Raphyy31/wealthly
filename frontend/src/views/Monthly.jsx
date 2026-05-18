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
import { SubscriptionsWidget } from '../components/SubscriptionsWidget.jsx';

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
  refMonthScope = 'household',
  activeMember = null,
  activeMemberId = 'all',
  fiftyThirtyTwenty,
  transferIds = new Set(),
  memberShare,
  currentMonth, fmt,
}) {
  // Le scope détermine le libellé affiché et désactive l'édition pour les
  // enfants (qui n'ont pas leur propre Mois type — leurs dépenses sont
  // dans le scope Famille).
  const isChildScope = activeMember?.role === 'child';
  const scopeLabel = isChildScope
    ? `${activeMember.name} (enfant)`
    : refMonthScope === 'household'
      ? 'Famille (compte joint)'
      : (activeMember?.name || 'Personnel');
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
  // kind is derived from the category's type field, NOT the sign of the amount.
  // This prevents refunds (positive amounts on expense categories) from appearing under "Entrées".
  // Expense totals are signed: negative tx contributes positively, positive tx (refund) reduces.
  const realByCat = useMemo(() => {
    const map = new Map();
    for (const t of monthTx) {
      const catId = t.categoryId || 'uncategorized';
      const cat = catFor(catId);
      const kind = cat?.type === 'income' ? 'income' : isSavingCategory(catId) ? 'saving' : 'expense';
      const k = `${kind}::${catId}`;
      if (!map.has(k)) map.set(k, { kind, category_id: catId, total: 0, count: 0 });
      const v = map.get(k);
      // income: sum amounts as-is (positive = received). expense/saving: negate so expenses are positive.
      v.total += kind === 'income' ? t.sharedAmount : -t.sharedAmount;
      v.count += 1;
    }
    return map;
  }, [monthTx, categories]);

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
  //   Income lines  →  Parent categories  →  Sub-line leaves
  //
  // Niveau 2 = catégorie parente (Finance & épargne, Abonnements…). Si la
  // ligne cible déjà une top-level, on prend cette top-level comme niveau 2.
  // Niveau 3 = la sous-catégorie ou le label de la ligne (Crédit étudiant,
  // Netflix, Loyer…). Toujours affiché pour avoir 3 colonnes lisibles.
  const sankeyData = useMemo(() => {
    if (!hasRefMonth) return { nodes: [], links: [] };
    const incomeLines = refLines.filter(l => l.kind === 'income' && (parseFloat(l.amount) || 0) > 0);
    const spendLines = refLines.filter(l => l.kind !== 'income' && (parseFloat(l.amount) || 0) > 0);
    if (!incomeLines.length || !spendLines.length) return { nodes: [], links: [] };

    const parentSlug = (cat) => (cat?.parent || cat?.parent_slug || null);
    const topLevelFor = (cid) => {
      const cat = catFor(cid);
      const ps = parentSlug(cat);
      return ps ? catFor(ps) : cat;
    };

    const nodes = [];
    const links = [];

    // Level 1 — income nodes
    const incomeNodeIdx = {};
    incomeLines.forEach(l => {
      incomeNodeIdx[l.id] = nodes.length;
      nodes.push({
        name: l.label || 'Entrée',
        level: 0,
        kind: 'income',
        amount: parseFloat(l.amount) || 0,
        color: 'var(--positive)',
      });
    });

    // Level 2 — top-level parent categories (one node per unique top-level)
    const topNodeIdx = {};
    const topTotals = {};
    spendLines.forEach(l => {
      const top = topLevelFor(l.category_id || 'uncategorized');
      const topId = top?.id || top?.slug || 'uncategorized';
      if (!(topId in topNodeIdx)) {
        topNodeIdx[topId] = nodes.length;
        nodes.push({
          name: top?.name || topId,
          icon: top?.icon || '',
          level: 1,
          kind: 'cat',
          color: top?.color || 'var(--ink)',
          amount: 0,
        });
        topTotals[topId] = 0;
      }
      topTotals[topId] += parseFloat(l.amount) || 0;
    });
    // Total income for % computation. Tagged on each level-2 node so the
    // renderer can show "Logement · 28% du revenu" without re-summing.
    const totalIncomeForPct = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    Object.entries(topTotals).forEach(([topId, total]) => {
      const node = nodes[topNodeIdx[topId]];
      node.amount = total;
      node.pctOfIncome = totalIncomeForPct > 0 ? (total / totalIncomeForPct) * 100 : null;
    });

    // Level 3 — leaf per spend line (sub-cat or line label)
    spendLines.forEach(l => {
      const top = topLevelFor(l.category_id || 'uncategorized');
      const topId = top?.id || top?.slug || 'uncategorized';
      const cat = catFor(l.category_id);
      const sameTop = (cat?.id || cat?.slug) === topId;
      // If the line's category IS the top-level, use the line label as leaf
      // ("Loyer", "Frais bancaires"…) — fallback to the cat name otherwise.
      const leafName = sameTop
        ? (l.label || cat?.name || 'Ligne')
        : (cat?.name || l.label || 'Ligne');
      const leafIcon = sameTop ? '' : (cat?.icon || '');
      const leafColor = top?.color || 'var(--ink)';
      const idx = nodes.length;
      nodes.push({
        name: leafName,
        icon: leafIcon,
        level: 2,
        kind: l.kind,
        color: leafColor,
        amount: parseFloat(l.amount) || 0,
      });
      links.push({
        source: topNodeIdx[topId],
        target: idx,
        value: parseFloat(l.amount) || 0,
        color: leafColor,
      });
    });

    // Income → top-level links (proportional split based on income share)
    const totalIncome = incomeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const totalSpend = spendLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    if (totalIncome > 0 && totalSpend > 0) {
      incomeLines.forEach(inc => {
        const incVal = parseFloat(inc.amount) || 0;
        const incShare = incVal / totalIncome;
        Object.entries(topTotals).forEach(([topId, topTotal]) => {
          const val = topTotal * incShare;
          if (val > 0.5) {
            links.push({
              source: incomeNodeIdx[inc.id],
              target: topNodeIdx[topId],
              value: val,
              color: nodes[topNodeIdx[topId]].color,
            });
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

    // Roll up real entries: if a category has no direct mois type entry but its parent does,
    // merge into the parent key. This handles cases like "supermarche" → "courses",
    // or sub-insurance categories rolling up into the parent insurance line.
    const realMerged = new Map();
    for (const [key, val] of realByCat.entries()) {
      const [kind, catId] = key.split('::');
      const cat = catFor(catId);
      const parentKey = cat?.parent ? `${kind}::${cat.parent}` : null;
      const targetKey = (!refByCat.has(key) && parentKey && refByCat.has(parentKey)) ? parentKey : key;
      if (!realMerged.has(targetKey)) {
        const tCatId = targetKey.split('::')[1];
        realMerged.set(targetKey, { kind, category_id: tCatId, total: 0, count: 0 });
      }
      const v = realMerged.get(targetKey);
      v.total += val.total;
      v.count += val.count;
    }

    const allKeys = new Set([...refByCat.keys(), ...realMerged.keys()]);

    for (const key of allKeys) {
      const [kind, catId] = key.split('::');
      const ref = refByCat.get(key);
      const real = realMerged.get(key);
      const cat = catFor(catId);
      const refTotal = ref?.total || 0;
      const realTotal = Math.max(0, real?.total || 0); // clamp: net refund > expense shows as 0
      const item = {
        key,
        kind,
        category_id: catId,
        cat_name: cat?.name || catId,
        ref_total: refTotal,
        real_total: realTotal,
        lines: ref?.lines || [],
        is_unexpected: !ref && (real?.total || 0) > 0,
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
          <p>
            {t('views.monthly.subtitle')}
            <span className="mon-scope-chip" title={refMonthScope === 'household' ? 'Mois type partagé du foyer (compte joint)' : 'Mois type personnel'}>
              {refMonthScope === 'household' ? '👪' : '👤'} {scopeLabel}
            </span>
          </p>
        </div>
        <div className="mon-actions">
          <button className="ds-btn ghost" onClick={() => setShowEvolution(true)}>
            <TrendingUp size={14}/> {isNarrow ? '' : 'Évolution'}
          </button>
          <button className="ds-btn ghost" onClick={() => setShow5030(true)}>
            <Target size={14}/> {isNarrow ? '' : '50 / 30 / 20'}
          </button>
          {!isChildScope && (
            <button className="ds-btn primary" onClick={() => setShowEditor(true)}>
              <Edit3 size={14}/> {isNarrow ? 'Mois type' : 'Éditer mois type'}
            </button>
          )}
        </div>
      </div>

      {/* ── Child scope empty state — pas de Mois type perso pour les enfants ── */}
      {isChildScope && (
        <section className="card mon-empty-state">
          <div className="mon-empty-illu">
            <Target size={32}/>
          </div>
          <h3>Pas de <em>mois type</em> pour {activeMember.name}.</h3>
          <p>Les dépenses des enfants apparaissent dans le Mois type de la <strong>Famille</strong> (compte joint). Bascule sur l'onglet Famille en haut pour l'éditer.</p>
        </section>
      )}

      {/* ── Month picker ────────────────────────────────────────────── */}
      {!isChildScope && (
        <MonthPicker
          selectedMonth={selectedMonth}
          currentMonth={currentMonth}
          availableMonths={availableMonths}
          onChange={setSelectedMonth}
        />
      )}


      {/* ── KPI strip ───────────────────────────────────────────────── */}
      {!isChildScope && (
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
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!isChildScope && !hasRefMonth && (
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
      {!isChildScope && hasRefMonth && sankeyData.nodes.length > 0 && (
        <section className="card mon-sankey">
          <div className="card-header">
            <h3>Flux du mois type</h3>
            <span className="card-meta">Entrées → Catégories → Sous-catégories</span>
          </div>
          {/* Mini stats strip */}
          <div className="mon-sankey-stats">
            <div className="mon-sankey-stat">
              <span className="mon-sankey-stat-dot" style={{ background: 'var(--positive)' }}/>
              <span className="mon-sankey-stat-label">Entrées</span>
              <span className="mon-sankey-stat-val">{fmt(refTotals.income)}</span>
            </div>
            <span className="mon-sankey-stat-arrow">→</span>
            <div className="mon-sankey-stat">
              <span className="mon-sankey-stat-dot" style={{ background: 'var(--negative)' }}/>
              <span className="mon-sankey-stat-label">Dépenses</span>
              <span className="mon-sankey-stat-val">{fmt(refTotals.expense)}</span>
            </div>
            {refTotals.saving > 0 && <>
              <span className="mon-sankey-stat-arrow">·</span>
              <div className="mon-sankey-stat">
                <span className="mon-sankey-stat-dot" style={{ background: 'var(--accent)' }}/>
                <span className="mon-sankey-stat-label">Épargne</span>
                <span className="mon-sankey-stat-val">{fmt(refTotals.saving)}</span>
              </div>
            </>}
            {refTotals.balance > 0 && <>
              <span className="mon-sankey-stat-arrow">·</span>
              <div className="mon-sankey-stat">
                <span className="mon-sankey-stat-dot" style={{ background: 'var(--ink-3)' }}/>
                <span className="mon-sankey-stat-label">Reste</span>
                <span className="mon-sankey-stat-val positive">{fmt(refTotals.balance)}</span>
              </div>
            </>}
          </div>
          <div className="mon-sankey-body">
            <ResponsiveContainer width="100%" height={isNarrow ? 440 : Math.max(520, sankeyData.nodes.filter(n => n.level === 2).length * 36 + 100)}>
              <Sankey
                data={sankeyData}
                nodePadding={isNarrow ? 16 : 26}
                nodeWidth={14}
                iterations={64}
                margin={{ top: 24, right: isNarrow ? 130 : 220, bottom: 24, left: isNarrow ? 100 : 160 }}
                node={<SankeyNode fmt={fmt}/>}
                link={<SankeyLink/>}
              >
                <Tooltip
                  formatter={(v) => fmt(v)}
                  contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 8px 24px -8px rgba(0,0,0,.18)' }}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Comparison table ────────────────────────────────────────── */}
      {!isChildScope && hasRefMonth && (
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
            {tableSections.map(section => {
              const secReal = section.items.reduce((s, i) => s + i.real_total, 0);
              const secRef  = section.items.reduce((s, i) => s + i.ref_total,  0);
              return (
              <React.Fragment key={section.kind}>
                <div className={`mon-row-section mon-row-section-${section.kind}`}>
                  <span className="mon-section-left">
                    <span className="mon-section-icon">
                      {section.kind === 'income'
                        ? <TrendingUp size={12}/>
                        : section.kind === 'saving'
                        ? <PiggyBank size={12}/>
                        : <TrendingDown size={12}/>}
                    </span>
                    {section.title}
                  </span>
                  {(secReal > 0 || secRef > 0) && (
                    <span className="mon-section-totals">
                      {fmt(secReal)}{secRef > 0 && <><span className="sep">/</span>{fmt(secRef)} prévu</>}
                    </span>
                  )}
                </div>
                {section.items.length === 0 && (
                  <div className="mon-row mon-row-empty">Aucune ligne dans cette section</div>
                )}
                {section.items.map(item => {
                  const cat = catFor(item.category_id);
                  const ecart = item.real_total - item.ref_total;
                  const pct = item.ref_total > 0
                    ? Math.round((item.real_total / item.ref_total) * 100)
                    : (item.real_total > 0 ? 999 : 0);
                  const expanded = expandedRows.has(item.key);
                  const hasSubs = item.lines.length > 1;

                  // Écart semantic color: income=more is good, expense=more is bad
                  const ecartClass = ecart === 0 ? ''
                    : item.kind === 'income'
                      ? (ecart > 0 ? 'ecart-good' : 'ecart-bad')
                      : (ecart > 0 ? 'ecart-bad' : 'ecart-good');

                  // Progress bar state
                  const barState = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
                  const pctClass = pct > 100 ? 'pct-over' : pct > 85 ? 'pct-warn' : '';

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
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.cat_name}</span>
                          {item.is_unexpected && <span className="mon-pill warn">Nouveau</span>}
                        </span>
                        <span className="num">{item.ref_total > 0 ? fmt(item.ref_total) : '—'}</span>
                        <span className="num">{item.real_total > 0 ? fmt(item.real_total) : '—'}</span>
                        <span className={`num ${ecartClass}`}>
                          {ecart === 0 ? '—' : (ecart > 0 ? '+' : '') + fmt(Math.abs(ecart))}
                        </span>
                        <span className="mon-bar-wrap">
                          {item.ref_total > 0 ? (
                            <>
                              <span className={`mon-bar ${barState}`}>
                                <span className="mon-bar-fill" style={{ width: Math.min(pct, 100) + '%' }}/>
                              </span>
                              <span className={`mon-bar-pct ${pctClass}`}>{pct}%</span>
                            </>
                          ) : (
                            <span className="mon-bar-pct" style={{ color: 'var(--ink-3)' }}>—</span>
                          )}
                        </span>
                      </div>
                      {expanded && item.lines.map(line => (
                        <div key={line.id} className="mon-row mon-row-sub">
                          <span className="mon-sub-label">{line.label}</span>
                          <span className="num">{fmt(parseFloat(line.amount) || 0)}</span>
                          <span className="num">—</span>
                          <span className="num">—</span>
                          <span/>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
              );
            })}
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
          scopeLabel={scopeLabel}
          isHouseholdScope={refMonthScope === 'household'}
          onClose={() => setShowEditor(false)}
        />
      )}

      {show5030 && (
        <FiftyThirtyTwentyModal
          refMonth={refMonth}
          fiftyThirtyTwenty={fiftyThirtyTwenty}
          categories={categories}
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

      {/* ── Subscriptions widget ────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <SubscriptionsWidget transactions={transactions} categories={categories} fmt={fmt}/>
      </div>
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

function SankeyNode({ x, y, width, height, index, payload, fmt }) {
  if (!payload) return null;
  const isLeft = payload.level === 0;
  const isMiddle = payload.level === 1;
  const fill = payload.color || (payload.kind === 'income' ? 'var(--positive)' : '#94a3b8');
  const labelX = isLeft ? x - 16 : x + width + 16;
  const anchor = isLeft ? 'end' : 'start';
  const midY = y + height / 2;

  const displayName = (payload.icon ? `${payload.icon} ` : '') + (payload.name || '');
  const hasAmount = typeof payload.amount === 'number' && payload.amount > 0;
  const hasPct = isMiddle && typeof payload.pctOfIncome === 'number' && payload.pctOfIncome > 0;
  const nameY = hasAmount ? midY - 8 : midY;
  const amtStr = hasAmount ? (fmt ? fmt(payload.amount) : `${payload.amount}€`) : '';
  const pctStr = hasPct
    ? ` · ${payload.pctOfIncome >= 10 ? payload.pctOfIncome.toFixed(0) : payload.pctOfIncome.toFixed(1)}% du revenu`
    : '';

  return (
    <Layer key={`sn-${index}`}>
      {/* Node bar — rounded pill */}
      <rect x={x} y={y} width={width} height={height} rx={7} ry={7} fill={fill} fillOpacity={0.95}/>
      {/* Subtle inner highlight */}
      <rect x={x} y={y} width={width} height={Math.min(height, 3)} rx={7} ry={7} fill="#fff" fillOpacity={0.25}/>
      {/* Category name */}
      <text
        x={labelX} y={nameY}
        textAnchor={anchor}
        fontSize={isLeft ? 13 : 12.5}
        fontWeight={isLeft || isMiddle ? 600 : 500}
        fill="var(--ink)"
        dominantBaseline="middle"
      >
        {displayName}
      </text>
      {/* Amount + optional % */}
      {hasAmount && (
        <text
          x={labelX} y={midY + 10}
          textAnchor={anchor}
          fontSize={11}
          fill={hasPct ? payload.color || 'var(--ink-3)' : 'var(--ink-3)'}
          dominantBaseline="middle"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {amtStr}{pctStr}
        </text>
      )}
    </Layer>
  );
}

// Custom link with gradient from income green → category color.
function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, index }) {
  const color = payload?.color || '#94a3b8';
  const gradId = `sk-g-${index}`;
  const sw = Math.max(1, linkWidth);
  const d = `M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.5"/>
        </linearGradient>
      </defs>
      <path d={d} stroke={`url(#${gradId})`} strokeWidth={sw} fill="none" strokeLinecap="round"/>
    </g>
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
