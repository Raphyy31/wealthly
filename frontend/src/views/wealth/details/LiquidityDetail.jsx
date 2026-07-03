// ============================================================================
// LiquidityDetail — Compte courant + Livret. Migré sur DetailShell.
// ============================================================================
import React, { useMemo } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { BarChart3, PiggyBank, Wallet } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils.js';
import { ownersList, splitTitle, DV3_TOOLTIP } from '../utils.js';
import { DetailShell, DetailSection, DetailProgress, DetailInsight } from '../components/DetailShell.jsx';

export function LiquidityDetail({ item, accounts = [], accountBalances = {}, transactions = [], members = [], fmt, onEdit, onClose }) {
  const isAccount = !!item.isAccount;
  const accountId = isAccount ? item.sourceId : null;
  const balance = isAccount
    ? (accountBalances[accountId] ?? (parseFloat(item.value) || 0))
    : (parseFloat(item.currentValue) || 0);

  const name = item.name || '—';
  const bank = item.bank || '';
  const syncMode = isAccount ? (item.syncMode || 'manual') : 'manual';
  const owners = ownersList(item.memberIds || [], members);

  const subtype = isAccount ? item.subtype : (item.type === 'savings_account' ? 'livret' : 'compte_courant');
  const isLivret = subtype === 'livret' || ['Livret A', 'LDDS', 'LEP', 'PEL'].some(k => (name || '').includes(k));

  let livretCap = 22950, livretRate = 0.03, livretLabel = 'Livret A';
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
    return [...transactions].filter(t => t.accountId === accountId).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, accountId, isAccount]);

  const today = new Date();
  const cutoff30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const last30 = accountTx.filter(t => t.date >= cutoff30);
  const inflows30 = last30.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflows30 = last30.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net30 = inflows30 - outflows30;

  const sixMonthAvg = useMemo(() => {
    if (!isAccount || accountTx.length === 0) return null;
    const monthly = {};
    accountTx.forEach(t => { const k = t.date.slice(0, 7); monthly[k] = (monthly[k] || 0) + (parseFloat(t.amount) || 0); });
    const last6 = Object.keys(monthly).sort().slice(-6);
    if (last6.length === 0) return null;
    return last6.reduce((s, k) => s + monthly[k], 0) / last6.length;
  }, [accountTx, isAccount]);

  const chartData = useMemo(() => {
    if (!isAccount || accountTx.length === 0) return [];
    let running = balance;
    const points = [{ date: today.toISOString().slice(0, 10), balance: Math.round(balance) }];
    const cutoff = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    for (const t of accountTx) {
      if (t.date < cutoff) break;
      running -= (parseFloat(t.amount) || 0);
      points.push({ date: t.date, balance: Math.round(running) });
    }
    return points.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTx, balance, isAccount]);

  const recentTx = useMemo(() => accountTx.slice(0, 8), [accountTx]);
  const trendLabel = sixMonthAvg === null ? 'Insuffisant' : sixMonthAvg > 50 ? 'Croissant' : sixMonthAvg < -50 ? 'Décroissant' : 'Stable';
  const typeLabel = isLivret ? livretLabel
    : subtype === 'pea' ? 'PEA Espèces'
    : subtype === 'av' || subtype === 'life_insurance' ? 'Fonds euro'
    : 'Compte courant';
  const st = splitTitle(name);

  const kpis = [
    { label: 'Entrées · 30j', value: <span style={{ color: 'var(--positive)' }}>+{fmt(inflows30)}</span> },
    { label: 'Sorties · 30j', value: <span style={{ color: 'var(--negative)' }}>−{fmt(outflows30)}</span> },
    { label: 'Tendance 6 mois', value: sixMonthAvg === null ? '—' : `${sixMonthAvg >= 0 ? '+' : ''}${fmt(sixMonthAvg)}`, sub: `/mois · ${trendLabel}` },
    isLivret && { label: `Plafond ${livretLabel}`, value: `${fiscalRatio.toFixed(0)} %`, sub: fmt(livretCap) },
  ].filter(Boolean).slice(0, 3); // charte Forêt — max 3 KPI (plafond livret repris dans le corps)

  return (
    <DetailShell
      breadcrumb="Patrimoine · Liquidités"
      onClose={onClose}
      onEdit={onEdit ? () => onEdit() : undefined}
      heroIcon={isLivret ? <PiggyBank size={32} strokeWidth={1.8}/> : <Wallet size={32} strokeWidth={1.8}/>}
      eyebrow={`${typeLabel}${bank ? ` · ${bank}` : ''}`}
      title={<>{st.head} <em>{st.tail}.</em></>}
      subtitle={<><span className={`dv3-badge ${syncMode === 'synced' ? 'pos' : ''}`}>{syncMode === 'synced' ? '⚡ Synchronisé' : 'Manuel'}</span>{owners && <span>· {owners}</span>}</>}
      valueLabel="Solde actuel"
      value={fmt(balance)}
      valueSub={isLivret ? `Plafond ${livretLabel} : ${fmt(livretCap)}` : null}
      delta={isAccount && last30.length > 0 ? { text: `${net30 >= 0 ? '+' : ''}${fmt(net30)} · 30 j`, positive: net30 >= 0 } : null}
      kpis={kpis}
    >
      {isLivret ? (
        <DetailInsight tone="positive">
          À {(livretRate * 100).toFixed(2).replace('.', ',')} %, ce {livretLabel} rapporte ~<strong>{fmt(interests)}/an</strong> net d'impôt.{livretMargin > 0 ? <> Il te reste <strong>{fmt(livretMargin)}</strong> avant le plafond.</> : ' Plafond atteint.'}
        </DetailInsight>
      ) : (isAccount && sixMonthAvg !== null && (
        <DetailInsight>
          Sur 6 mois, le solde {sixMonthAvg >= 0 ? 'progresse' : 'baisse'} de ~<strong>{sixMonthAvg >= 0 ? '+' : ''}{fmt(sixMonthAvg)}/mois</strong> en moyenne.
        </DetailInsight>
      ))}
      {chartData.length >= 2 && (
        <DetailSection title="Évolution du solde">
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: -6, marginBottom: 8 }}>90 derniers jours · {accountTx.length} transactions au total</div>
          <div className="dsh-chart-pad">
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
                <Tooltip formatter={(v) => [fmt(v), 'Solde']} labelFormatter={(d) => formatDate(d)} contentStyle={DV3_TOOLTIP} cursor={{ stroke: 'var(--ink-mute)', strokeDasharray: '3 3' }}/>
                <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#liqBalanceFill)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DetailSection>
      )}

      {isLivret && (
        <DetailSection title={`${livretLabel} · Épargne réglementée`} aside={<span style={{ color: 'var(--positive)', fontWeight: 600 }}>+{fmt(interests)} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 12 }}>/an estimé</span></span>}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: -6, marginBottom: 10 }}>Taux nominal {(livretRate * 100).toFixed(2).replace('.', ',')} % — exonéré d'impôt et de prélèvements sociaux</div>
          <DetailProgress pct={fiscalRatio} label={<><span className="w-num">{fmt(balance)} sur {fmt(livretCap)}</span> · <span className="w-num">{livretMargin > 0 ? `${fmt(livretMargin)} de marge disponible` : 'Plafond atteint'}</span></>}/>
        </DetailSection>
      )}

      {recentTx.length > 0 && (
        <DetailSection title="Dernières transactions">
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: -6, marginBottom: 8 }}>Les 8 mouvements les plus récents</div>
          <div className="dsh-list">
            {recentTx.map(t => (
              <div key={t.id} className="dsh-list-row">
                <div className="dsh-list-main">
                  <div className="dsh-list-label">{t.label || '(sans libellé)'}</div>
                  <div className="dsh-list-meta">{formatDate(t.date)}</div>
                </div>
                <div className={`dsh-list-amount ${t.amount >= 0 ? 'pos' : 'neg'}`}>{t.amount >= 0 ? '+' : ''}{fmt(t.amount)}</div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {!isAccount && (
        <DetailSection>
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)' }}>
            <BarChart3 size={24}/>
            <h3 style={{ margin: '10px 0 4px', fontSize: 14, color: 'var(--text-primary)' }}>Actif manuel</h3>
            <p style={{ margin: 0, fontSize: 13, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>Cette ligne d'épargne est saisie à la main. Connectez votre compte bancaire pour voir les transactions et l'évolution réelle du solde.</p>
          </div>
        </DetailSection>
      )}
    </DetailShell>
  );
}
