// ============================================================================
// LiquidityDetail — Compte courant + Livret (Account OR Asset savings_account).
// Extracted from Wealth.jsx lines 2135-2398.
// ============================================================================
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChevronLeft, X, Edit3, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils.js';
import { ownersList, splitTitle, DV3_TOOLTIP } from '../utils.js';
import { DetailV3Styles } from '../styles.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function LiquidityDetail({ item, accounts = [], accountBalances = {}, transactions = [], members = [], fmt, onEdit, onClose }) {
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
    <ResponsiveModal open={true} onClose={onClose}>
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
                  <div className="ds-panel-sub">Taux nominal {(livretRate * 100).toFixed(2).replace('.', ',')} % — exonéré d'impôt et de prélèvements sociaux</div>
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
      </ResponsiveModal>
  );
}
