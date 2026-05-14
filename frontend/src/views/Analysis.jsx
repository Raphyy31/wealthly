// ============================================================================
// Analysis — évolution mensuelle + top marchands + drill-down par catégorie
// Migré vers le design system v3 : ds-panel / tokens canoniques (--ink, --bg,
// --accent, --positive, --negative) pour matcher Dashboard.jsx et les autres
// vues.
// ============================================================================
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { formatCurrency, formatDate, monthKey } from '../utils.js';

const TOOLTIP_STYLE = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--ink)',
  boxShadow: 'var(--shadow-md)',
};

export function Analysis({ transactions, categories, recurringIds, recurringGroups, monthlyEvolution, accounts, memberShare, fmt }) {
  const { t } = useTranslation();
  const [selectedCat, setSelectedCat] = useState('all');

  const catTimeData = useMemo(() => {
    const data = {};
    transactions.forEach(t => {
      if (t.amount >= 0) return;
      if (selectedCat !== 'all' && t.categoryId !== selectedCat) return;
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const m = monthKey(t.date);
      data[m] = (data[m] || 0) + Math.abs(t.amount) * share;
    });
    return Object.entries(data).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions, selectedCat, accounts, memberShare]);

  const topMerchants = useMemo(() => {
    const m = {};
    transactions.forEach(t => {
      if (t.amount >= 0) return;
      const acc = accounts.find(a => a.id === t.accountId);
      const share = acc ? memberShare(acc) : 1;
      const key = (t.label || '').slice(0, 30);
      if (!m[key]) m[key] = { label: key, total: 0, count: 0 };
      m[key].total += Math.abs(t.amount) * share;
      m[key].count += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [transactions, accounts, memberShare]);

  return (
    <div className="analysis-view-v3">
      <AnalysisStyles/>

      <div className="subview-header">
        <div>
          <h1>{t('views.analysis.title')} <em>{t('views.analysis.titleAccent')}</em></h1>
          <p>{t('views.analysis.subtitle')}</p>
        </div>
      </div>

      <section className="ds-panel">
        <div className="ds-panel-head">
          <div>
            <div className="ds-panel-title">Évolution mensuelle</div>
            <div className="ds-panel-sub">12 derniers mois — revenus vs dépenses</div>
          </div>
        </div>
        <div className="ana-chart-pad">
          {monthlyEvolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyEvolution.slice(-12)} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="month" tickFormatter={(m) => formatDate(m + '-01', { format: 'monthYear' })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false}/>
                <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--bg-hover)' }}/>
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle"/>
                <Bar dataKey="income" name="Revenus" fill="var(--positive)" radius={[3, 3, 0, 0]} maxBarSize={28}/>
                <Bar dataKey="expenses" name="Dépenses" fill="var(--negative)" radius={[3, 3, 0, 0]} maxBarSize={28}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="ana-empty">Pas de données</div>}
        </div>
      </section>

      <div className="ana-grid">
        <section className="ds-panel">
          <div className="ds-panel-head">
            <div>
              <div className="ds-panel-title">Top marchands</div>
              <div className="ds-panel-sub">Sur toute la période</div>
            </div>
          </div>
          <div className="ana-merchants">
            {topMerchants.length === 0 && (
              <div className="ana-empty">{t('views.analysis.empty')}</div>
            )}
            {topMerchants.map((m, idx) => (
              <div key={idx} className="ana-merchant-row">
                <div className="ana-merchant-rank mono">{String(idx + 1).padStart(2, '0')}</div>
                <div className="ana-merchant-info">
                  <div className="ana-merchant-name">{m.label || 'Sans libellé'}</div>
                  <div className="ana-merchant-meta">{m.count} transaction{m.count > 1 ? 's' : ''}</div>
                </div>
                <div className="ana-merchant-total num">{fmt(m.total)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-panel">
          <div className="ds-panel-head">
            <div>
              <div className="ds-panel-title">Évolution par catégorie</div>
              <div className="ds-panel-sub">Filtrer pour zoomer sur une dépense</div>
            </div>
            <select
              className="ds-input ana-select"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
            >
              <option value="all">Toutes dépenses</option>
              {categories.filter(c => c.type === 'expense').map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="ana-chart-pad">
            {catTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
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
      </div>
    </div>
  );
}

function AnalysisStyles() {
  const css = `
.analysis-view-v3 { display: flex; flex-direction: column; gap: 16px; max-width: 1320px; margin: 0 auto; }
.analysis-view-v3 .mono { font-family: var(--font-mono); }
.analysis-view-v3 .num { font-variant-numeric: tabular-nums; }
.analysis-view-v3 .ana-chart-pad { padding: 16px 20px 20px; }
.analysis-view-v3 .ana-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--ink-3);
  font-size: 13px;
}
.analysis-view-v3 .ana-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
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
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}
.analysis-view-v3 .ana-merchant-info { min-width: 0; }
.analysis-view-v3 .ana-merchant-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.analysis-view-v3 .ana-merchant-meta {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}
.analysis-view-v3 .ana-merchant-total {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }}/>;
}
