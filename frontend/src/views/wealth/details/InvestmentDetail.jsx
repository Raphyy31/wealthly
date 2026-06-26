// ============================================================================
// InvestmentDetail — PEA / CTO / AV / PER avec cours live. Migré sur DetailShell
// (chrome unifié). La table de positions + cellules éditables sont préservées
// telles quelles (styles inv-v3-* injectés dans le corps).
// ============================================================================
import React, { useState, useMemo } from 'react';
import { BarChart3, RefreshCw, Upload, PieChart, TrendingUp } from 'lucide-react';
import { ownersList, positionColor, formatQty } from '../utils.js';
import { InvestmentDetailStyles } from '../styles.jsx';
import { LivePricesFooter } from '../components/LivePricesFooter.jsx';
import { EditableNumCell } from '../components/EditableNumCell.jsx';
import { useLiveQuotes, relTimeFromTs } from '../../../utils/marketPrices.js';
import { DetailShell, DetailSection, DetailInsight, DetailDonut } from '../components/DetailShell.jsx';
import { exportInvestmentPositionsXlsx } from '../../../xlsExport.js';

export function InvestmentDetail({ asset, assets = [], members = [], fmt, onEdit, onClose, onSyncPositions, onImportCSV, onUpdatePosition }) {
  const positions = useMemo(
    () => assets.filter(a => a.parentAssetId === asset.id || a.parent_asset_id === asset.id),
    [assets, asset.id]
  );
  const hasPositions = positions.length > 0;

  const positionTickers = useMemo(
    () => positions.map(p => (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim()).filter(Boolean),
    [positions]
  );
  const demoSeedPrices = useMemo(() => {
    const seeds = {};
    positions.forEach(p => {
      const sym = (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim();
      const qty = parseFloat(p.quantity) || 0;
      const val = parseFloat(p.currentValue) || 0;
      if (sym && qty > 0) seeds[sym] = val / qty;
    });
    return seeds;
  }, [positions]);
  const { prices, loading: liveLoading, refresh: refreshLive } = useLiveQuotes(positionTickers, demoSeedPrices);
  const lastFetchedAt = useMemo(() => {
    let max = 0;
    Object.values(prices).forEach(q => { if (q?.fetchedAt > max) max = q.fetchedAt; });
    return max || null;
  }, [prices]);
  const anyLive = Object.keys(prices).length > 0;

  const rows = useMemo(() => {
    return positions.map(p => {
      const qty = parseFloat(p.quantity) || 0;
      const saisi = parseFloat(p.currentValue) || 0;
      const buy = parseFloat(p.purchasePrice) || 0;
      const sym = (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim();
      const livePx = sym && prices[sym] ? prices[sym].price : null;
      const isLive = livePx != null && qty > 0;
      const value = isLive ? qty * livePx : saisi;
      const cours = isLive ? livePx : (qty > 0 ? saisi / qty : 0);
      const invested = buy * qty;
      const pl = value - invested;
      const plPct = invested > 0 ? (pl / invested) * 100 : 0;
      return { id: p.id, name: p.name || '—', isin: p.isin || sym || '', qty, cours, value, saisi, isLive, pl, plPct, invested, color: positionColor(p.name), initial: (p.name || '?').trim()[0]?.toUpperCase() || '?' };
    }).sort((a, b) => b.value - a.value);
  }, [positions, prices]);

  const saisiValue = parseFloat(asset.currentValue) || 0;
  const positionsValue = rows.reduce((s, r) => s + r.value, 0);
  const saisiPositionsValue = positions.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  const cashAvailable = Math.max(0, saisiValue - saisiPositionsValue);
  const currentValue = hasPositions ? (positionsValue + cashAvailable) : saisiValue;
  const invested = hasPositions
    ? positions.reduce((s, p) => s + (parseFloat(p.purchasePrice) || 0) * (parseFloat(p.quantity) || 0), 0)
    : (parseFloat(asset.purchasePrice) || 0);
  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const subtype = asset.type;
  const subtypeLabel = ({ pea: 'PEA', life_insurance: 'Assurance-vie', per: 'PER', stocks: 'CTO' })[subtype] || "Compte d'investissement";
  const isPEA = subtype === 'pea';
  const owners = ownersList(asset.memberIds, members);
  const pct = (v, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d).replace('.', ',')} %`;

  const [syncing, setSyncing] = useState(false);
  const liveRowsToSync = rows.filter(r => r.isLive && Math.abs(r.value - r.saisi) > 0.5);
  const handleSync = async () => {
    if (!onSyncPositions || liveRowsToSync.length === 0) return;
    setSyncing(true);
    try { await onSyncPositions(asset, rows); } finally { setSyncing(false); }
  };

  const [first, ...rest] = (asset.name || 'Compte').split(' ');
  // Charte Forêt — max 3 KPI ; la valorisation est déjà le chiffre focal du hero.
  const kpis = [
    { label: 'Investi', value: fmt(invested) },
    hasPositions && { label: 'Liquidités', value: fmt(cashAvailable) },
    isPEA && { label: 'Plafond PEA', value: `${Math.round((invested / 150000) * 100)} %`, sub: 'de 150 000 €' },
  ].filter(Boolean).slice(0, 3);

  const allocDonut = [
    ...rows.map(r => ({ name: r.name, value: Math.round(r.value), color: r.color, meta: currentValue > 0 ? `${Math.round((r.value / currentValue) * 100)} %` : null })),
    cashAvailable > 0 && { name: 'Liquidités', value: Math.round(cashAvailable), color: 'var(--d6)', meta: currentValue > 0 ? `${Math.round((cashAvailable / currentValue) * 100)} %` : null },
  ].filter(Boolean);
  const topPos = rows[0] || null;
  const topWeight = topPos && currentValue > 0 ? (topPos.value / currentValue) * 100 : 0;

  return (
    <DetailShell
      breadcrumb="Patrimoine · Investissements"
      onClose={onClose}
      onEdit={onEdit ? () => onEdit() : undefined}
      onExport={() => exportInvestmentPositionsXlsx(
        rows.length > 0 ? rows : [{ name: asset.name, isin: '', qty: 0, cours: 0, invested, value: currentValue, pl: plLatente, plPct: plLatentePct }],
        { accountName: asset.name }
      )}
      heroIcon={<TrendingUp size={32} strokeWidth={1.8}/>}
      eyebrow={subtypeLabel}
      title={<>{first} <em>{rest.join(' ') || ''}.</em></>}
      subtitle={<>
        {anyLive ? <span className="dv3-badge dv3-badge-live">Cours live</span> : <span className="dv3-badge">Saisi manuellement</span>}
        {rows.length > 0 && <span>· {rows.length} position{rows.length > 1 ? 's' : ''}</span>}
        {owners && <span>· {owners}</span>}
        {lastFetchedAt && <span>· maj il y a {relTimeFromTs(lastFetchedAt)}</span>}
      </>}
      valueLabel="Valorisation totale"
      value={fmt(currentValue)}
      valueSub={invested > 0 ? `${fmt(invested)} investis` : null}
      delta={invested > 0 ? { text: `${plLatente >= 0 ? '+' : ''}${fmt(plLatente)} · ${pct(plLatentePct)}`, positive: plLatente >= 0 } : null}
      kpis={kpis}
      footer={<>
        {onImportCSV && <button className="ds-btn primary" onClick={() => onImportCSV(asset)} title="Importer un relevé de positions (CSV / XLSX)"><Upload size={14}/> Importer des positions</button>}
        {liveRowsToSync.length > 0 && (
          <button className="ds-btn" onClick={handleSync} disabled={syncing} title={`Pousser le cours live dans ${liveRowsToSync.length} position(s)`}>
            <RefreshCw size={13} className={syncing || liveLoading ? 'spin' : ''}/> {syncing ? 'Sync…' : `Synchroniser ${liveRowsToSync.length} position${liveRowsToSync.length > 1 ? 's' : ''}`}
          </button>
        )}
      </>}
    >
      <InvestmentDetailStyles/>
      {hasPositions && topPos && (
        <DetailInsight icon={<PieChart size={15}/>}>
          {rows.length > 1
            ? <><strong>{topPos.name}</strong> est ta plus grosse ligne : <strong>{Math.round(topWeight)} %</strong> du compte.</>
            : <>Performance <strong>{plLatente >= 0 ? '+' : ''}{pct(plLatentePct)}</strong> ({plLatente >= 0 ? '+' : ''}{fmt(plLatente)}) sur ton investissement.</>}
        </DetailInsight>
      )}
      {hasPositions && allocDonut.length > 1 && (
        <DetailSection title="Allocation">
          <DetailDonut data={allocDonut} fmt={fmt} centerLabel="Valorisation" centerValue={fmt(currentValue)}/>
        </DetailSection>
      )}
      {hasPositions ? (
        <DetailSection title="Positions" aside={onImportCSV ? <button className="ds-btn" onClick={() => onImportCSV(asset)} title="Importer un relevé (CSV / XLSX)">Importer</button> : null}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: -6, marginBottom: 10 }}>Triées par valorisation décroissante</div>
          <div className="inv-v3-table-wrap">
            <div className="inv-v3-cols ds-micro">
              <div>Nom</div><div className="cell-r">Quantité</div><div className="cell-r">Cours</div><div className="cell-r">Valeur</div><div className="cell-r">+/- value</div>
            </div>
            {rows.map(r => (
              <div key={r.id} className="inv-v3-row">
                <div className="inv-v3-name">
                  <span className="inv-v3-logo" style={{ background: r.color }}>{r.initial}</span>
                  <div className="inv-v3-name-block">
                    <div className="inv-v3-name-line">{r.name}</div>
                    {r.isin && <div className="inv-v3-name-meta mono">{r.isin}</div>}
                  </div>
                </div>
                <EditableNumCell value={r.qty} format={formatQty} onCommit={(v) => onUpdatePosition?.(r.id, { quantity: v })} disabled={!onUpdatePosition}/>
                <EditableNumCell value={r.cours} format={fmt} onCommit={(v) => onUpdatePosition?.(r.id, { lastPrice: v })} disabled={!onUpdatePosition || r.isLive} title={r.isLive ? 'Cours synchronisé en live' : 'Cliquer pour modifier'}/>
                <EditableNumCell value={r.value} format={fmt} onCommit={(v) => onUpdatePosition?.(r.id, { currentValue: v })} disabled={!onUpdatePosition} className="inv-v3-val"/>
                <div className={`cell-r inv-v3-pl ${r.pl >= 0 ? 'pos' : 'neg'}`}>
                  <div className="num">{r.pl >= 0 ? '+' : ''}{fmt(r.pl)}</div>
                  {r.invested > 0 && <div className="num inv-v3-pl-pct">{pct(r.plPct)}</div>}
                </div>
              </div>
            ))}
          </div>
          {cashAvailable > 0 && (
            <div className="inv-v3-cash-row">
              <div className="inv-v3-name">
                <span className="inv-v3-logo inv-v3-logo-cash">€</span>
                <div className="inv-v3-name-block">
                  <div className="inv-v3-name-line">Liquidités du compte</div>
                  <div className="inv-v3-name-meta">Cash disponible</div>
                </div>
              </div>
              <div className="cell-r num inv-v3-val">{fmt(cashAvailable)}</div>
            </div>
          )}
          {anyLive && <LivePricesFooter fetchedAt={lastFetchedAt} count={Object.keys(prices).length} onRefresh={refreshLive} loading={liveLoading}/>}
        </DetailSection>
      ) : (
        <DetailSection>
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)' }}>
            <BarChart3 size={28}/>
            <h3 style={{ margin: '12px 0 4px', fontSize: 15, color: 'var(--text-primary)' }}>Aucune position importée</h3>
            <p style={{ margin: '0 auto', maxWidth: 440, fontSize: 13, lineHeight: 1.5 }}>Importe le relevé de positions de ton broker (CSV / XLSX) pour voir le détail ligne à ligne et activer les cours live. La valorisation globale du compte reste à <strong>{fmt(currentValue)}</strong>.</p>
            {onImportCSV && <button className="ds-btn primary" onClick={() => onImportCSV(asset)} style={{ marginTop: 16 }}>Importer un portefeuille</button>}
          </div>
        </DetailSection>
      )}
    </DetailShell>
  );
}
