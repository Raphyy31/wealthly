// ============================================================================
// CryptoDetail — fiche détail crypto-actif (cours live). Migré sur DetailShell.
// ============================================================================
import React, { useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { formatDate } from '../../../utils.js';
import { ownersList, formatCryptoQty, cryptoColor } from '../utils.js';
import { LivePricesFooter } from '../components/LivePricesFooter.jsx';
import { useLiveQuotes, cryptoToYahoo, relTimeFromTs } from '../../../utils/marketPrices.js';
import { DetailShell, DetailSection, DetailInsight } from '../components/DetailShell.jsx';

export function CryptoDetail({ asset, members = [], fmt, onEdit, onClose, onSync }) {
  const quantity = parseFloat(asset.quantity) || 0;
  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const ticker = (asset.ticker || '').toUpperCase();
  const saisiValue = parseFloat(asset.currentValue) || 0;
  const saisiUnitPrice = quantity > 0 ? saisiValue / quantity : 0;

  const yahooSym = cryptoToYahoo(ticker);
  const { prices, loading: liveLoading, refresh } = useLiveQuotes(
    yahooSym ? [yahooSym] : [],
    yahooSym ? { [yahooSym]: saisiUnitPrice } : {}
  );
  const liveQuote = yahooSym ? prices[yahooSym] : null;
  const livePrice = liveQuote?.price ?? null;
  const isLive = livePrice != null && quantity > 0;

  const currentValue = isLive ? quantity * livePrice : saisiValue;
  const unitPrice = isLive ? livePrice : saisiUnitPrice;

  const invested = purchasePrice * quantity;
  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const owners = ownersList(asset.memberIds, members);
  const yearsSincePurchase = asset.purchaseDate ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365) : 0;
  const cagrPct = invested > 0 && yearsSincePurchase >= 0.1 ? (Math.pow(currentValue / invested, 1 / yearsSincePurchase) - 1) * 100 : null;
  const pct = (v, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d).replace('.', ',')} %`;

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    if (!isLive || !onSync) return;
    setSyncing(true);
    try { await onSync(asset, currentValue); } finally { setSyncing(false); }
  };

  const [first, ...rest] = (asset.name || '').split(' ');
  const logo = (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: cryptoColor(ticker || asset.name), color: '#fff', fontSize: 9, fontWeight: 700 }}>
      {(ticker || asset.name || '?').slice(0, 3)}
    </span>
  );

  const showSaisi = isLive && saisiUnitPrice > 0 && Math.abs(saisiUnitPrice - unitPrice) / saisiUnitPrice > 0.005;
  const kpis = [
    { label: 'Quantité détenue', value: <>{formatCryptoQty(quantity)} {ticker && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{ticker}</span>}</> },
    { label: 'Prix de revient', value: fmt(purchasePrice), sub: '/ unité' },
    { label: <>Cours actuel{isLive && <span style={{ color: 'var(--positive)', fontSize: 9 }}> ● live</span>}</>, value: fmt(unitPrice), sub: showSaisi ? `saisi ${fmt(saisiUnitPrice)}` : '/ unité' },
    cagrPct !== null && { label: 'Perf. annualisée', value: <span style={{ color: cagrPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{pct(cagrPct, 1)} /an</span> },
  ].filter(Boolean);

  return (
    <DetailShell
      breadcrumb="Patrimoine · Cryptos"
      onClose={onClose}
      onEdit={onEdit ? () => onEdit() : undefined}
      icon={logo}
      eyebrow="Crypto-actif"
      title={<>{first} <em>{rest.join(' ') || ticker || ''}.</em></>}
      subtitle={<>
        {isLive ? <span className="dv3-badge dv3-badge-live">Cours live</span> : <span className="dv3-badge">Saisi manuellement</span>}
        {ticker && <span>· {ticker}</span>}
        {owners && <span>· {owners}</span>}
        {liveQuote?.fetchedAt && <span>· maj il y a {relTimeFromTs(liveQuote.fetchedAt)}</span>}
      </>}
      value={fmt(currentValue)}
      delta={invested > 0 ? { text: `${plLatente >= 0 ? '+' : ''}${fmt(plLatente)} · ${pct(plLatentePct)}`, positive: plLatente >= 0 } : null}
      kpis={kpis}
      footer={<>
        <span className="dsh-foot-owners">{asset.purchaseDate && <>Acquis le <span className="w-num">{formatDate(asset.purchaseDate)}</span></>}</span>
        {isLive && Math.abs(saisiValue - currentValue) > 1 && (
          <button className="ds-btn" onClick={handleSync} disabled={syncing} title="Mettre à jour la valorisation avec le cours live">
            <RefreshCw size={13} className={syncing || liveLoading ? 'spin' : ''}/> {syncing ? 'Sync…' : 'Synchroniser la valeur'}
          </button>
        )}
      </>}
    >
      {invested > 0 && (
        <DetailInsight icon={<TrendingUp size={15}/>} tone={plLatente >= 0 ? 'positive' : 'warning'}>
          Cours actuel <strong>{plLatente >= 0 ? '+' : ''}{pct(plLatentePct)}</strong> vs ton prix de revient — <strong>{fmt(unitPrice)}</strong> contre {fmt(purchasePrice)} l'unité.
        </DetailInsight>
      )}
      {asset.notes && (
        <DetailSection title="Notes">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{asset.notes}</div>
        </DetailSection>
      )}
      {isLive && (
        <DetailSection>
          <LivePricesFooter fetchedAt={liveQuote?.fetchedAt} count={1} onRefresh={refresh} loading={liveLoading}/>
        </DetailSection>
      )}
    </DetailShell>
  );
}
