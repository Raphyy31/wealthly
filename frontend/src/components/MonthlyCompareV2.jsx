// ============================================================================
// MonthlyCompareV2 — Refonte Reel vs Mois type (2026-05-19)
//
// Direction A (diverging bars) — pattern YNAB / Lunchmoney : chaque categorie
// devient une barre divergente centree autour de la reference. A gauche : sous
// budget. A droite : depassement. Trie par magnitude pour faire emerger les
// anomalies en haut de liste.
//
// Bonus design (utile, pas IA) :
//   1. "Cap journalier" — combien tu peux depenser / jour pour rester dans le
//      mois type, calcule sur les jours restants. Pratique daily.
//   2. "Pace" — sur le mois en cours, indicateur de vitesse de depense (en
//      avance / en retard / pile sur le rythme).
//   3. Hover/click categorie -> drawer transactions filtrees.
// ============================================================================
import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, X, ArrowUp, ArrowDown, Calendar } from 'lucide-react';

const KIND_LABELS = {
  income: 'Revenus',
  expense: 'Depenses',
  saving: 'Epargne',
};

// Pour les revenus / epargne, plus = bon (vert). Pour les depenses, plus = mauvais.
const isGoodVariance = (kind, variance) => {
  if (variance === 0) return null;
  if (kind === 'income' || kind === 'saving') return variance > 0;
  return variance < 0;
};

export function MonthlyCompareV2({
  tableSections,
  refTotals,
  realTotals,
  selectedMonth,
  isCurrentMonth,
  daysInMonth,
  daysLeft,
  monthTx,
  categories,
  fmt,
  catFor,
}) {
  const [activeKind, setActiveKind] = useState('expense'); // 'all' | 'income' | 'expense' | 'saving'
  const [drawer, setDrawer] = useState(null); // { item, transactions }

  // Flatten tableSections, filter by activeKind, sort by abs variance desc.
  const rows = useMemo(() => {
    const flat = [];
    for (const section of tableSections) {
      if (activeKind !== 'all' && section.kind !== activeKind) continue;
      for (const item of section.items) {
        const variance = item.real_total - item.ref_total;
        // Skip rows with neither ref nor real (shouldn't happen but safety).
        if (item.ref_total === 0 && item.real_total === 0) continue;
        flat.push({ ...item, variance });
      }
    }
    flat.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    return flat;
  }, [tableSections, activeKind]);

  // Max abs variance for bar scaling. Falls back to max ref/real if everything is on-target.
  const maxScale = useMemo(() => {
    let m = 0;
    for (const r of rows) {
      m = Math.max(m, Math.abs(r.variance));
      m = Math.max(m, r.ref_total, r.real_total);
    }
    return m || 1;
  }, [rows]);

  // KPI Hero figures depend on activeKind.
  const hero = useMemo(() => {
    if (activeKind === 'income') {
      const real = realTotals.income;
      const ref = refTotals.income;
      const variance = real - ref;
      const pct = ref > 0 ? (real / ref) * 100 : 0;
      return {
        label: 'Revenus encaisses',
        value: real,
        target: ref,
        variance,
        pct,
        positiveIsGood: true,
      };
    }
    if (activeKind === 'saving') {
      const real = realTotals.saving;
      const ref = refTotals.saving;
      const variance = real - ref;
      const pct = ref > 0 ? (real / ref) * 100 : 0;
      return {
        label: 'Epargne du mois',
        value: real,
        target: ref,
        variance,
        pct,
        positiveIsGood: true,
      };
    }
    // expense (default) — "Restant a depenser" si mois courant, sinon "Depense totale"
    const real = realTotals.expense;
    const ref = refTotals.expense;
    const remaining = Math.max(0, ref - real);
    const overshoot = Math.max(0, real - ref);
    const pct = ref > 0 ? (real / ref) * 100 : 0;
    return {
      label: isCurrentMonth ? 'Reste a depenser' : 'Depense totale',
      value: isCurrentMonth ? remaining : real,
      target: ref,
      variance: real - ref, // positive = overshoot = bad
      pct,
      positiveIsGood: false,
      overshoot,
      consumed: real,
    };
  }, [activeKind, realTotals, refTotals, isCurrentMonth]);

  // Cap journalier (bonus design utile) — uniquement sur depenses + mois en cours.
  const dailyCap = useMemo(() => {
    if (!isCurrentMonth || activeKind !== 'expense' || daysLeft <= 0) return null;
    const remaining = Math.max(0, refTotals.expense - realTotals.expense);
    if (remaining <= 0) return null;
    return remaining / daysLeft;
  }, [isCurrentMonth, activeKind, daysLeft, refTotals, realTotals]);

  // Pace indicator (bonus design utile) — sur mois courant, compare le %
  // consomme du budget au % du mois ecoule. Avance/retard/pile.
  const pace = useMemo(() => {
    if (!isCurrentMonth || activeKind !== 'expense') return null;
    if (refTotals.expense <= 0) return null;
    const dayOfMonth = new Date().getDate();
    const monthProgress = (dayOfMonth - 1) / Math.max(1, daysInMonth - 1); // 0..1
    const budgetConsumed = realTotals.expense / refTotals.expense;
    const delta = budgetConsumed - monthProgress; // positif = consomme plus vite que le rythme
    let state, label;
    if (delta > 0.1) { state = 'fast'; label = 'En avance sur la depense'; }
    else if (delta < -0.1) { state = 'slow'; label = 'En retard sur la depense'; }
    else { state = 'ontrack'; label = 'Sur le rythme'; }
    return { state, label, delta, monthProgress, budgetConsumed };
  }, [isCurrentMonth, activeKind, refTotals, realTotals, daysInMonth]);

  const openDrawer = useCallback((item) => {
    // Filtrer les transactions de la categorie pour ce mois.
    const catId = item.category_id;
    const cat = catFor(catId);
    // Inclure aussi les sous-categories enfants si la categorie a des enfants.
    const childIds = new Set(
      categories.filter(c => (c.parent || c.parent_slug) === (cat?.id || cat?.slug)).map(c => c.id)
    );
    const txs = monthTx
      .filter(t => t.categoryId === catId || childIds.has(t.categoryId))
      .sort((a, b) => b.date.localeCompare(a.date));
    setDrawer({ item, transactions: txs, cat });
  }, [catFor, categories, monthTx]);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  return (
    <section className="mcv2-root">
      <McvStyles/>

      <header className="mcv2-head">
        <div className="mcv2-head-left">
          <h3 className="mcv2-title">
            Reel <em>vs Mois type</em>
          </h3>
          <p className="mcv2-sub">Comparaison par categorie, triee par ecart absolu.</p>
        </div>
        <div className="mcv2-tabs" role="tablist">
          {['expense', 'income', 'saving', 'all'].map(k => (
            <button
              key={k}
              role="tab"
              aria-selected={activeKind === k}
              className={`mcv2-tab ${activeKind === k ? 'on' : ''}`}
              onClick={() => setActiveKind(k)}
            >
              {k === 'all' ? 'Tout' : KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </header>

      {/* ── Hero summary ────────────────────────────────────────────── */}
      <div className="mcv2-hero">
        <div className="mcv2-hero-main">
          <span className="mcv2-hero-label">{hero.label}</span>
          <span className="mcv2-hero-value num">{fmt(hero.value)}</span>
          {hero.target > 0 && (
            <span className="mcv2-hero-target num">sur {fmt(hero.target)} prevu</span>
          )}
        </div>

        <div className="mcv2-hero-bar-wrap">
          <div className="mcv2-hero-bar">
            <div
              className={`mcv2-hero-bar-fill ${hero.pct > 100 ? 'over' : hero.pct > 85 ? 'warn' : ''}`}
              style={{ width: `${Math.min(hero.pct, 100)}%` }}
            />
            {hero.pct > 100 && (
              <div
                className="mcv2-hero-bar-overshoot"
                style={{ width: `${Math.min(hero.pct - 100, 50)}%` }}
              />
            )}
          </div>
          <span className={`mcv2-hero-pct num ${hero.pct > 100 ? 'over' : ''}`}>
            {hero.pct.toFixed(0)} %
          </span>
        </div>

        {/* Sub-KPIs : variance + cap journalier + pace */}
        <div className="mcv2-sub-kpis">
          {hero.variance !== 0 && (
            <div className={`mcv2-sub-kpi ${
              isGoodVariance(activeKind === 'all' ? 'expense' : activeKind, hero.variance) ? 'pos' : 'neg'
            }`}>
              <span className="mcv2-sub-kpi-label">Ecart global</span>
              <span className="mcv2-sub-kpi-val num">
                {hero.variance > 0 ? '+' : ''}{fmt(hero.variance)}
              </span>
            </div>
          )}

          {dailyCap != null && (
            <div className="mcv2-sub-kpi info">
              <span className="mcv2-sub-kpi-label">
                <Calendar size={11} style={{ marginRight: 4, verticalAlign: '-1px' }}/>
                Cap journalier ({daysLeft} j)
              </span>
              <span className="mcv2-sub-kpi-val num">{fmt(dailyCap)}/jour</span>
            </div>
          )}

          {pace && (
            <div className={`mcv2-sub-kpi pace pace-${pace.state}`}>
              <span className="mcv2-sub-kpi-label">Cadence</span>
              <span className="mcv2-sub-kpi-val">{pace.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Diverging bars list ─────────────────────────────────────── */}
      <div className="mcv2-list">
        {rows.length === 0 && (
          <div className="mcv2-empty">
            <em>Aucune donnee a comparer pour cette section.</em>
          </div>
        )}
        {rows.map(item => {
          const cat = catFor(item.category_id);
          const v = item.variance;
          const good = isGoodVariance(item.kind, v);
          const absV = Math.abs(v);
          const widthPct = maxScale > 0 ? (absV / maxScale) * 100 : 0;
          // Real bar (filled) vs ref tick marker.
          const refPct = maxScale > 0 ? (item.ref_total / maxScale) * 100 : 0;
          const realPct = maxScale > 0 ? (item.real_total / maxScale) * 100 : 0;

          return (
            <button
              key={item.key}
              type="button"
              className={`mcv2-row ${good === true ? 'good' : good === false ? 'bad' : 'neutral'}`}
              onClick={() => openDrawer(item)}
              aria-label={`Detail ${item.cat_name}`}
            >
              <span className="mcv2-row-cat">
                <span className="mcv2-cat-dot" style={{ background: cat?.color || 'var(--border-strong)' }}/>
                <span className="mcv2-cat-icon" aria-hidden="true">{cat?.icon || ''}</span>
                <span className="mcv2-cat-name">{item.cat_name}</span>
                {item.is_unexpected && <span className="mcv2-pill warn">Nouveau</span>}
              </span>

              {/* Comparative bars : ref (gris) + real (accent). Cap a 100% du maxScale. */}
              <span className="mcv2-bars">
                <span className="mcv2-bar-ref" style={{ width: `${Math.min(refPct, 100)}%` }}>
                  <span className="mcv2-bar-ref-label num">{item.ref_total > 0 ? fmt(item.ref_total) : '—'}</span>
                </span>
                <span
                  className={`mcv2-bar-real ${good === true ? 'good' : good === false ? 'bad' : ''}`}
                  style={{ width: `${Math.min(realPct, 100)}%` }}
                >
                  <span className="mcv2-bar-real-label num">{item.real_total > 0 ? fmt(item.real_total) : '—'}</span>
                </span>
              </span>

              <span className={`mcv2-variance num ${good === true ? 'pos' : good === false ? 'neg' : ''}`}>
                {v !== 0 && (v > 0 ? <ArrowUp size={11}/> : <ArrowDown size={11}/>)}
                {v > 0 ? '+' : ''}{fmt(absV)}
              </span>

              <span className="mcv2-chevron" aria-hidden="true">
                <ChevronRight size={14}/>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Drawer transactions ─────────────────────────────────────── */}
      {drawer && (
        <>
          <div className="mcv2-drawer-backdrop" onClick={closeDrawer}/>
          <aside className="mcv2-drawer" role="dialog" aria-label={`Transactions ${drawer.item.cat_name}`}>
            <div className="mcv2-drawer-head">
              <div className="mcv2-drawer-title-wrap">
                <span className="mcv2-cat-dot" style={{ background: drawer.cat?.color || 'var(--border-strong)' }}/>
                <span className="mcv2-cat-icon" aria-hidden="true">{drawer.cat?.icon || ''}</span>
                <h4 className="mcv2-drawer-title">{drawer.item.cat_name}</h4>
              </div>
              <button className="mcv2-drawer-close" onClick={closeDrawer} aria-label="Fermer">
                <X size={18}/>
              </button>
            </div>

            <div className="mcv2-drawer-stats">
              <div>
                <span className="mcv2-drawer-stat-label">Mois type</span>
                <span className="mcv2-drawer-stat-val num">{fmt(drawer.item.ref_total)}</span>
              </div>
              <div>
                <span className="mcv2-drawer-stat-label">Ce mois</span>
                <span className="mcv2-drawer-stat-val num">{fmt(drawer.item.real_total)}</span>
              </div>
              <div>
                <span className="mcv2-drawer-stat-label">Ecart</span>
                <span className={`mcv2-drawer-stat-val num ${
                  isGoodVariance(drawer.item.kind, drawer.item.variance) === true ? 'pos'
                  : isGoodVariance(drawer.item.kind, drawer.item.variance) === false ? 'neg'
                  : ''
                }`}>
                  {drawer.item.variance > 0 ? '+' : ''}{fmt(Math.abs(drawer.item.variance))}
                </span>
              </div>
            </div>

            <div className="mcv2-drawer-list">
              {drawer.transactions.length === 0 && (
                <div className="mcv2-drawer-empty">
                  <em>Aucune transaction sur cette categorie ce mois.</em>
                </div>
              )}
              {drawer.transactions.map(tx => (
                <div key={tx.id} className="mcv2-tx-row">
                  <span className="mcv2-tx-date mono">{formatTxDate(tx.date)}</span>
                  <span className="mcv2-tx-label">{tx.label || 'Sans libelle'}</span>
                  <span className={`mcv2-tx-amount num ${tx.amount > 0 ? 'pos' : ''}`}>
                    {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </section>
  );
}

function formatTxDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function McvStyles() {
  const css = `
.mcv2-root { display: flex; flex-direction: column; gap: 20px; position: relative; }

/* ── Header ──────────────────────────────────────────────────────── */
.mcv2-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
}
.mcv2-title {
  font: 500 20px/1.2 var(--font-sans);
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0 0 4px;
}
.mcv2-title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
}
.mcv2-sub {
  font: 400 12.5px/1.4 var(--font-serif);
  font-style: italic;
  color: var(--ink-3);
  margin: 0;
}
.mcv2-tabs {
  display: inline-flex; gap: 2px;
  padding: 3px;
  background: var(--bg-sunk);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.mcv2-tab {
  border: none; background: transparent;
  padding: 6px 14px;
  font: 500 12px/1 var(--font-sans);
  color: var(--ink-3);
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  letter-spacing: 0.01em;
}
.mcv2-tab:hover { color: var(--ink); }
.mcv2-tab.on {
  background: var(--bg-elev);
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

/* ── Hero ───────────────────────────────────────────────────────── */
.mcv2-hero {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px 24px;
  display: flex; flex-direction: column;
  gap: 14px;
}
.mcv2-hero-main {
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
}
.mcv2-hero-label {
  font: 500 11px/1 var(--font-sans);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-right: 4px;
}
.mcv2-hero-value {
  font: 500 32px/1.05 var(--font-sans);
  letter-spacing: -0.025em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.mcv2-hero-target {
  font: 400 12.5px/1 var(--font-serif);
  font-style: italic;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.mcv2-hero-bar-wrap {
  display: flex; align-items: center; gap: 12px;
}
.mcv2-hero-bar {
  flex: 1;
  position: relative;
  height: 6px;
  background: var(--bg-sunk);
  border-radius: 3px;
  overflow: visible;
}
.mcv2-hero-bar-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: var(--accent);
  border-radius: 3px;
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mcv2-hero-bar-fill.warn { background: var(--warning); }
.mcv2-hero-bar-fill.over { background: var(--negative); }
.mcv2-hero-bar-overshoot {
  position: absolute; left: 100%; top: -2px; bottom: -2px;
  background: repeating-linear-gradient(
    45deg,
    var(--negative),
    var(--negative) 3px,
    transparent 3px,
    transparent 6px
  );
  border-radius: 0 3px 3px 0;
  opacity: 0.6;
}
.mcv2-hero-pct {
  font: 500 13px/1 var(--font-sans);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  min-width: 44px;
  text-align: right;
}
.mcv2-hero-pct.over { color: var(--negative); }

.mcv2-sub-kpis {
  display: flex; flex-wrap: wrap;
  gap: 24px;
  padding-top: 4px;
  border-top: 1px dashed var(--border);
  padding-top: 14px;
}
.mcv2-sub-kpi {
  display: flex; flex-direction: column; gap: 3px;
  min-width: 120px;
}
.mcv2-sub-kpi-label {
  font: 500 10.5px/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.mcv2-sub-kpi-val {
  font: 500 15px/1.1 var(--font-sans);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.mcv2-sub-kpi.pos .mcv2-sub-kpi-val { color: var(--positive); }
.mcv2-sub-kpi.neg .mcv2-sub-kpi-val { color: var(--negative); }
.mcv2-sub-kpi.info .mcv2-sub-kpi-val { color: var(--accent); }
.mcv2-sub-kpi.pace .mcv2-sub-kpi-val {
  font: 500 13px/1.2 var(--font-sans);
  letter-spacing: 0;
}
.mcv2-sub-kpi.pace-fast .mcv2-sub-kpi-val { color: var(--negative); }
.mcv2-sub-kpi.pace-slow .mcv2-sub-kpi-val { color: var(--positive); }
.mcv2-sub-kpi.pace-ontrack .mcv2-sub-kpi-val { color: var(--ink-2); }

/* ── Diverging bars list ─────────────────────────────────────────── */
.mcv2-list {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.mcv2-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--ink-3);
  font: 400 14px/1.5 var(--font-serif);
  font-style: italic;
}

.mcv2-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) 2.4fr minmax(90px, auto) 16px;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border: none;
  border-top: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background var(--t-fast);
  width: 100%;
}
.mcv2-row:first-child { border-top: none; }
.mcv2-row:hover { background: var(--bg-hover); }
.mcv2-row:focus-visible {
  outline: 2px solid var(--focus-ring, var(--accent));
  outline-offset: -2px;
  background: var(--bg-hover);
}

.mcv2-row-cat {
  display: inline-flex; align-items: center; gap: 8px;
  min-width: 0;
}
.mcv2-cat-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mcv2-cat-icon {
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}
.mcv2-cat-name {
  font: 500 13.5px/1.3 var(--font-sans);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcv2-pill.warn {
  font: 500 9.5px/1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 6px;
  background: var(--warning-soft, rgba(142, 100, 26, 0.12));
  color: var(--warning);
  border-radius: 4px;
  flex-shrink: 0;
}

/* Bars : empilees verticalement (ref au-dessus, real en-dessous). Plus lisible
   qu'une seule barre car on voit le delta de longueur immediatement. */
.mcv2-bars {
  display: flex; flex-direction: column;
  gap: 4px;
  min-width: 0;
  position: relative;
}
.mcv2-bar-ref,
.mcv2-bar-real {
  position: relative;
  height: 14px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-width: 4px;
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mcv2-bar-ref {
  background: var(--bg-sunk);
  border: 1px solid var(--border);
}
.mcv2-bar-ref-label {
  font: 400 10.5px/1 var(--font-sans);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mcv2-bar-real {
  background: var(--ink-2);
}
.mcv2-bar-real.good { background: var(--positive); }
.mcv2-bar-real.bad { background: var(--negative); }
.mcv2-bar-real-label {
  font: 500 10.5px/1 var(--font-sans);
  color: var(--bg-elev);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mcv2-bar-real.bad .mcv2-bar-real-label,
.mcv2-bar-real.good .mcv2-bar-real-label { color: white; }

.mcv2-variance {
  font: 500 13px/1 var(--font-sans);
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  justify-content: flex-end;
}
.mcv2-variance.pos { color: var(--positive); }
.mcv2-variance.neg { color: var(--negative); }

.mcv2-chevron {
  color: var(--ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Drawer ──────────────────────────────────────────────────────── */
.mcv2-drawer-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 90;
  animation: mcv2-fade-in 200ms ease-out;
}
.mcv2-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(440px, 100vw);
  background: var(--bg-elev);
  border-left: 1px solid var(--border);
  z-index: 91;
  display: flex; flex-direction: column;
  box-shadow: -8px 0 32px -8px rgba(0,0,0,0.18);
  animation: mcv2-slide-in 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
@keyframes mcv2-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes mcv2-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
@media (prefers-reduced-motion: reduce) {
  .mcv2-drawer-backdrop, .mcv2-drawer { animation: none; }
}

.mcv2-drawer-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.mcv2-drawer-title-wrap {
  display: inline-flex; align-items: center; gap: 10px;
}
.mcv2-drawer-title {
  font: 500 16px/1.2 var(--font-sans);
  color: var(--ink);
  margin: 0;
}
.mcv2-drawer-close {
  background: transparent; border: none;
  color: var(--ink-3);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  transition: background var(--t-fast), color var(--t-fast);
}
.mcv2-drawer-close:hover { background: var(--bg-sunk); color: var(--ink); }

.mcv2-drawer-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-sunk);
}
.mcv2-drawer-stats > div {
  display: flex; flex-direction: column; gap: 4px;
}
.mcv2-drawer-stat-label {
  font: 500 10px/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.mcv2-drawer-stat-val {
  font: 500 15px/1.2 var(--font-sans);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.mcv2-drawer-stat-val.pos { color: var(--positive); }
.mcv2-drawer-stat-val.neg { color: var(--negative); }

.mcv2-drawer-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.mcv2-drawer-empty {
  padding: 32px 22px;
  text-align: center;
  font: 400 13px/1.5 var(--font-serif);
  font-style: italic;
  color: var(--ink-3);
}
.mcv2-tx-row {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 22px;
  border-bottom: 1px solid var(--border);
  transition: background var(--t-fast);
}
.mcv2-tx-row:hover { background: var(--bg-hover); }
.mcv2-tx-row:last-child { border-bottom: none; }
.mcv2-tx-date {
  font: 400 11px/1 var(--font-mono);
  color: var(--ink-3);
  text-transform: lowercase;
}
.mcv2-tx-label {
  font: 400 13px/1.3 var(--font-sans);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcv2-tx-amount {
  font: 500 13px/1 var(--font-sans);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.mcv2-tx-amount.pos { color: var(--positive); }

/* ── Mobile responsive ────────────────────────────────────────────── */
@media (max-width: 760px) {
  .mcv2-row {
    grid-template-columns: 1fr 90px 16px;
    grid-template-areas:
      "cat variance chevron"
      "bars bars bars";
    gap: 10px;
    padding: 12px 16px;
  }
  .mcv2-row-cat { grid-area: cat; }
  .mcv2-variance { grid-area: variance; }
  .mcv2-chevron { grid-area: chevron; }
  .mcv2-bars { grid-area: bars; }
  .mcv2-hero { padding: 16px 18px; }
  .mcv2-hero-value { font-size: 26px; }
  .mcv2-sub-kpis { gap: 16px; }
  .mcv2-sub-kpi { min-width: 100px; }
  .mcv2-drawer { width: 100vw; }
  .mcv2-tabs { width: 100%; justify-content: stretch; }
  .mcv2-tab { flex: 1; padding: 8px 10px; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
