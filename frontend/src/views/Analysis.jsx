// ============================================================================
// Analysis — KPI strip + évolution mensuelle + top marchands + drill par catégorie
//
// Refonte 2026-05-20 :
//   - Period selector (3M / 6M / 12M / Tout) segmented control
//   - KPI strip avec icones et AnimatedNumber pulse
//   - Top marchands panel (utilise le CSS deja prepare)
//   - Layout 2-col pour le bas (cat drill | top marchands)
// ============================================================================
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, PiggyBank, Receipt, Store } from 'lucide-react';
import { formatCurrency, formatDate, monthKey } from '../utils.js';
import { CategoryDropdown } from '../components/CategoryDropdown.jsx';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';

const TOOLTIP_STYLE = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--ink)',
  boxShadow: 'var(--shadow-md)',
};

const PERIODS = [
  { id: '3m',  label: '3 mois',  months: 3 },
  { id: '6m',  label: '6 mois',  months: 6 },
  { id: '12m', label: '12 mois', months: 12 },
  { id: 'all', label: 'Tout',    months: null },
];

export function Analysis({ transactions, categories, recurringIds, recurringGroups, monthlyEvolution, accounts, memberShare, fmt, transferIds = new Set() }) {
  const { t } = useTranslation();
  const [selectedCat, setSelectedCat] = useState('all');
  const [period, setPeriod] = useState('12m');

  const periodConfig = PERIODS.find(p => p.id === period) || PERIODS[2];
  const periodMonths = periodConfig.months;

  // Date cutoff selon la periode (null = pas de cutoff)
  const cutoffDate = useMemo(() => {
    if (!periodMonths) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - periodMonths);
    return d.toISOString().slice(0, 10);
  }, [periodMonths]);

  // Tx filtrees par periode (excluent transferts)
  const periodTx = useMemo(() => {
    return transactions.filter(t => {
      if (transferIds.has(t.id)) return;
      if (cutoffDate && (t.date || '') < cutoffDate) return false;
      return true;
    });
  }, [transactions, transferIds, cutoffDate]);

  // KPIs : revenus / dépenses / solde / taux d'epargne sur la periode
  const kpis = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of periodTx) {
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const v = (t.amount || 0) * share;
      if (v > 0) income += v;
      else expense += -v;
    }
    const balance = income - expense;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    return { income, expense, balance, savingsRate };
  }, [periodTx, accounts, memberShare]);

  // Top marchands : group by canonical payee or label si payee absent.
  const topMerchants = useMemo(() => {
    const map = new Map();
    for (const t of periodTx) {
      if ((t.amount || 0) >= 0) continue; // depenses uniquement
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const key = (t.payeeName || t.label || '—').trim();
      if (!key || key === '—') continue;
      if (!map.has(key)) map.set(key, { name: key, total: 0, count: 0, lastDate: t.date });
      const entry = map.get(key);
      entry.total += Math.abs(t.amount || 0) * share;
      entry.count += 1;
      if ((t.date || '') > (entry.lastDate || '')) entry.lastDate = t.date;
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [periodTx, accounts, memberShare]);

  // Evolution mensuelle filtree par periode
  const filteredMonthlyEvolution = useMemo(() => {
    if (!periodMonths) return monthlyEvolution;
    return monthlyEvolution.slice(-periodMonths);
  }, [monthlyEvolution, periodMonths]);

  const catTimeData = useMemo(() => {
    const data = {};
    periodTx.forEach(t => {
      if (t.amount >= 0) return;
      if (selectedCat !== 'all' && t.categoryId !== selectedCat) return;
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const m = monthKey(t.date);
      data[m] = (data[m] || 0) + Math.abs(t.amount) * share;
    });
    return Object.entries(data).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
  }, [periodTx, selectedCat, accounts, memberShare]);

  return (
    <div className="analysis-view-v3">
      <AnalysisStyles/>

      <div className="subview-header">
        <div>
          <h1>{t('views.analysis.title')} <em>{t('views.analysis.titleAccent')}</em></h1>
          <p>{t('views.analysis.subtitle')}</p>
        </div>
        {/* Period selector — segmented control coherent avec reg-tabs */}
        <div className="ana-period-tabs" role="tablist" aria-label="Période d'analyse">
          {PERIODS.map(p => (
            <button
              key={p.id}
              className={`ana-period-tab ${period === p.id ? 'is-active' : ''}`}
              onClick={() => setPeriod(p.id)}
              role="tab"
              aria-selected={period === p.id}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip — coherent avec Wealth */}
      <section className="ana-kpis">
        <div className="ana-kpi">
          <div className="ana-kpi-head">
            <span className="ana-kpi-icon"><TrendingUp size={14}/></span>
            <span className="ana-kpi-label">Revenus</span>
          </div>
          <div className="ana-kpi-value"><AnimatedNumber value={kpis.income} format={(v) => fmt(v)}/></div>
          <div className="ana-kpi-meta">{periodConfig.label.toLowerCase()}</div>
        </div>
        <div className="ana-kpi">
          <div className="ana-kpi-head">
            <span className="ana-kpi-icon negative"><TrendingDown size={14}/></span>
            <span className="ana-kpi-label">Dépenses</span>
          </div>
          <div className="ana-kpi-value"><AnimatedNumber value={kpis.expense} format={(v) => fmt(v)}/></div>
          <div className="ana-kpi-meta">{periodConfig.label.toLowerCase()}</div>
        </div>
        <div className="ana-kpi">
          <div className="ana-kpi-head">
            <span className={`ana-kpi-icon ${kpis.balance >= 0 ? 'positive' : 'negative'}`}><Receipt size={14}/></span>
            <span className="ana-kpi-label">Solde</span>
          </div>
          <div className={`ana-kpi-value ${kpis.balance >= 0 ? 'pos' : 'neg'}`}>
            {kpis.balance >= 0 ? '+' : ''}<AnimatedNumber value={kpis.balance} format={(v) => fmt(v)}/>
          </div>
          <div className="ana-kpi-meta">{kpis.balance >= 0 ? 'Tu as épargné' : 'Tu as puisé'}</div>
        </div>
        <div className="ana-kpi">
          <div className="ana-kpi-head">
            <span className="ana-kpi-icon"><PiggyBank size={14}/></span>
            <span className="ana-kpi-label">Taux d'épargne</span>
          </div>
          <div className="ana-kpi-value">{kpis.savingsRate.toFixed(1)}%</div>
          <div className="ana-kpi-meta">{kpis.savingsRate >= 20 ? 'Excellent' : kpis.savingsRate >= 10 ? 'Bon' : kpis.savingsRate >= 0 ? 'À surveiller' : 'Découvert'}</div>
        </div>
      </section>

      {/* Evolution mensuelle */}
      <section className="ds-panel">
        <div className="ds-panel-head">
          <div>
            <div className="ds-panel-title">Évolution mensuelle</div>
            <div className="ds-panel-sub">{periodConfig.label} — revenus vs dépenses</div>
          </div>
        </div>
        <div className="ana-chart-pad">
          {filteredMonthlyEvolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredMonthlyEvolution} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="month" tickFormatter={(m) => formatDate(m + '-01', { format: 'monthYear' })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false}/>
                <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--bg-hover)' }}/>
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle"/>
                <Bar dataKey="income" name="Revenus" fill="var(--positive)" radius={[3, 3, 0, 0]} maxBarSize={28}/>
                <Bar dataKey="expenses" name="Dépenses" fill="var(--negative)" radius={[3, 3, 0, 0]} maxBarSize={28}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="ana-empty">Pas de données sur cette période</div>}
        </div>
      </section>

      {/* Layout 2-col : evolution par cat | top marchands */}
      <div className="ana-grid">
        <section className="ds-panel">
          <div className="ds-panel-head">
            <div>
              <div className="ds-panel-title">Évolution par catégorie</div>
              <div className="ds-panel-sub">Filtrer pour zoomer sur une dépense</div>
            </div>
            <div className="ana-select">
              <CategoryDropdown
                value={selectedCat === 'all' ? '' : selectedCat}
                categories={categories.filter(c => c.type === 'expense' && c.id !== 'uncategorized')}
                onChange={(v) => setSelectedCat(v || 'all')}
                placeholder="Toutes dépenses"
                grouped
                emptyLabel="Toutes dépenses"
                align="right"
              />
            </div>
          </div>
          <div className="ana-chart-pad">
            {catTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={catTimeData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="month" tickFormatter={(m) => formatDate(m + '-01', { format: 'monthYear' })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false}/>
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'var(--ink-mute)', strokeDasharray: '3 3' }}/>
                  <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--accent)' }} activeDot={{ r: 4 }}/>
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="ana-empty">{t('views.analysis.emptyData')}</div>}
          </div>
        </section>

        {/* Top marchands — exploite le CSS existant ana-merchants */}
        <section className="ds-panel">
          <div className="ds-panel-head">
            <div>
              <div className="ds-panel-title"><Store size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/> Top marchands</div>
              <div className="ds-panel-sub">Les 10 enseignes qui te coutent le plus sur {periodConfig.label.toLowerCase()}</div>
            </div>
          </div>
          <div className="ana-merchants">
            {topMerchants.length === 0 ? (
              <div className="ana-empty">Pas encore de marchand détecté</div>
            ) : topMerchants.map((m, i) => (
              <div key={m.name} className="ana-merchant-row">
                <span className="ana-merchant-rank num">#{i + 1}</span>
                <div className="ana-merchant-info">
                  <div className="ana-merchant-name">{m.name}</div>
                  <div className="ana-merchant-meta">{m.count} tx · dernière {formatDate(m.lastDate, { format: 'short' })}</div>
                </div>
                <span className="ana-merchant-total num">{fmt(m.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AnalysisStyles() {
  const css = `
.analysis-view-v3 { display: flex; flex-direction: column; gap: 16px; max-width: 100%; margin: 0; }
.analysis-view-v3 .mono { font-family: var(--font-mono); }
.analysis-view-v3 .num { font-variant-numeric: tabular-nums; }
.analysis-view-v3 .ana-chart-pad { padding: 16px 20px 20px; }
.analysis-view-v3 .ana-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--ink-3);
  font-size: 13px;
  font-style: italic;
  font-family: Newsreader, Georgia, serif;
}

/* Period selector — segmented control coherent avec reg-tabs */
.ana-period-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--bg-sunk);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.ana-period-tab {
  padding: 6px 14px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--ink-3);
  font: 600 12px/1 var(--font-sans);
  cursor: pointer;
  transition: color 0.18s, background 0.18s, box-shadow 0.22s;
}
.ana-period-tab:hover { color: var(--ink-2); }
.ana-period-tab.is-active {
  background: var(--bg-elev);
  color: var(--accent);
  box-shadow: 0 1px 3px color-mix(in oklab, var(--ink) 8%, transparent);
}

/* KPI strip */
.ana-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.ana-kpi {
  padding: 16px 18px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 0.22s, box-shadow 0.22s;
}
.ana-kpi:hover {
  border-color: var(--border-strong);
  box-shadow: 0 2px 8px -4px color-mix(in oklab, var(--ink) 8%, transparent);
}
.ana-kpi-head {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.ana-kpi-icon {
  width: 26px; height: 26px;
  border-radius: 7px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}
.ana-kpi-icon.positive {
  background: color-mix(in oklab, var(--positive) 14%, transparent);
  color: var(--positive);
}
.ana-kpi-icon.negative {
  background: color-mix(in oklab, var(--negative) 14%, transparent);
  color: var(--negative);
}
.ana-kpi-label {
  font: 600 10.5px/1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.ana-kpi-value {
  font: 500 24px/1.05 var(--font-sans);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.ana-kpi-value.pos { color: var(--positive); }
.ana-kpi-value.neg { color: var(--negative); }
.ana-kpi-meta {
  font: 400 11.5px/1.4 var(--font-sans);
  color: var(--ink-3);
  margin-top: 4px;
}

.analysis-view-v3 .ana-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}
@media (max-width: 1024px) {
  .analysis-view-v3 .ana-grid { grid-template-columns: 1fr; }
}
.analysis-view-v3 .ana-select {
  height: 32px;
  width: auto;
  min-width: 180px;
  font-size: 12px;
}

.analysis-view-v3 .ana-merchants {
  padding: 6px 0 10px;
  display: flex;
  flex-direction: column;
}
.analysis-view-v3 .ana-merchant-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 20px;
  border-top: 1px solid var(--border);
  transition: background var(--t-fast);
}
.analysis-view-v3 .ana-merchant-row:first-child { border-top: none; }
.analysis-view-v3 .ana-merchant-row:hover { background: var(--bg-hover); }
.analysis-view-v3 .ana-merchant-rank {
  font: 600 11px/1 var(--font-mono);
  color: var(--ink-3);
  letter-spacing: 0.04em;
}
.analysis-view-v3 .ana-merchant-info { min-width: 0; }
.analysis-view-v3 .ana-merchant-name {
  font: 500 13.5px/1.2 var(--font-sans);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.analysis-view-v3 .ana-merchant-meta {
  font: 400 11px/1.3 var(--font-sans);
  color: var(--ink-3);
  margin-top: 2px;
}
.analysis-view-v3 .ana-merchant-total {
  font: 600 14px/1 var(--font-sans);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
