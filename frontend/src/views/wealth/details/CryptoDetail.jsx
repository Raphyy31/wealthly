// ============================================================================
// CryptoDetail — single crypto asset detail view with live prices.
// Extracted from Wealth.jsx lines 3181-3345.
// ============================================================================
import { useState } from 'react';
import { ChevronLeft, X, Edit3, RefreshCw } from 'lucide-react';
import { formatDate } from '../../../utils.js';
import { ownersList, formatCryptoQty, cryptoColor } from '../utils.js';
import { DetailV3Styles } from '../styles.jsx';
import { LivePricesFooter } from '../components/LivePricesFooter.jsx';
import { useLiveQuotes, cryptoToYahoo, relTimeFromTs } from '../../../utils/marketPrices.js';

export function CryptoDetail({ asset, members = [], fmt, onEdit, onClose, onSync }) {
  const quantity = parseFloat(asset.quantity) || 0;
  const purchasePrice = parseFloat(asset.purchasePrice) || 0;
  const ticker = (asset.ticker || '').toUpperCase();
  const saisiValue = parseFloat(asset.currentValue) || 0;
  const saisiUnitPrice = quantity > 0 ? saisiValue / quantity : 0;

  // Cours live via Yahoo (BTC-EUR, ETH-EUR…)
  const yahooSym = cryptoToYahoo(ticker);
  const { prices, loading: liveLoading, refresh } = useLiveQuotes(
    yahooSym ? [yahooSym] : [],
    yahooSym ? { [yahooSym]: saisiUnitPrice } : {}
  );
  const liveQuote = yahooSym ? prices[yahooSym] : null;
  const livePrice = liveQuote?.price ?? null;
  const isLive = livePrice != null && quantity > 0;

  // Valeur utilisée pour tous les calculs : live si dispo, sinon saisi
  const currentValue = isLive ? quantity * livePrice : saisiValue;
  const unitPrice = isLive ? livePrice : saisiUnitPrice;

  const invested = purchasePrice * quantity;
  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const owners = ownersList(asset.memberIds, members);

  // Date helpers — combien de temps depuis l'achat
  const yearsSincePurchase = asset.purchaseDate
    ? (new Date() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  // Performance annualisée (CAGR) — bien plus parlant que le total %
  const cagrPct = invested > 0 && yearsSincePurchase >= 0.1
    ? (Math.pow(currentValue / invested, 1 / yearsSincePurchase) - 1) * 100
    : null;

  // Sync : pousse la valeur live dans currentValue (vrai bouton dans le footer)
  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    if (!isLive || !onSync) return;
    setSyncing(true);
    try { await onSync(asset, currentValue); } finally { setSyncing(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal dv3-page" onClick={e => e.stopPropagation()}>
        <DetailV3Styles/>

        <div className="dv3-head">
          <button className="dv3-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Cryptos
          </button>
          <button className="dv3-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="dv3-title-row">
            <div className="dv3-title-block-with-logo">
              <span className="dv3-crypto-logo" style={{ background: cryptoColor(ticker || asset.name) }}>
                {(ticker || asset.name || '?').slice(0, 3)}
              </span>
              <div>
                <div className="dv3-eyebrow">Crypto-actif</div>
                <h2 className="dv3-title">
                  {asset.name.split(' ')[0]} <em>{asset.name.split(' ').slice(1).join(' ') || ticker || ''}.</em>
                </h2>
                <div className="dv3-sub">
                  {isLive
                    ? <span className="dv3-badge dv3-badge-live">Cours live</span>
                    : <span className="dv3-badge">Saisi manuellement</span>}
                  {ticker && <><span className="dv3-dot">·</span><span className="mono">{ticker}</span></>}
                  {owners && <><span className="dv3-dot">·</span><span>{owners}</span></>}
                  {liveQuote?.fetchedAt && (
                    <><span className="dv3-dot">·</span><span>maj il y a {relTimeFromTs(liveQuote.fetchedAt)}</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="dv3-value-block">
              <div className="dv3-hero-num num">{fmt(currentValue)}</div>
              {invested > 0 && (
                <div className={`dv3-hero-delta ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  <span className="dv3-dot">·</span>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(2).replace('.', ',')} %</span>
                </div>
              )}
            </div>
          </div>

          <div className="dv3-kpis">
            <div className="dv3-kpi">
              <div className="ds-micro">Quantité détenue</div>
              <div className="dv3-kpi-val num">{formatCryptoQty(quantity)} {ticker && <span className="dv3-kpi-meta">{ticker}</span>}</div>
            </div>
            <div className="dv3-kpi">
              <div className="ds-micro">Prix de revient</div>
              <div className="dv3-kpi-val num">{fmt(purchasePrice)}<span className="dv3-kpi-meta"> / unité</span></div>
            </div>
            <div className="dv3-kpi">
              <div className="ds-micro">Cours actuel{isLive && <span className="dv3-live-tag"> ● live</span>}</div>
              <div className="dv3-kpi-val num">
                {fmt(unitPrice)}<span className="dv3-kpi-meta"> / unité</span>
                {isLive && saisiUnitPrice > 0 && Math.abs(saisiUnitPrice - unitPrice) / saisiUnitPrice > 0.005 && (
                  <span className="dv3-kpi-meta"> · saisi {fmt(saisiUnitPrice)}</span>
                )}
              </div>
            </div>
            {cagrPct !== null && (
              <div className="dv3-kpi">
                <div className="ds-micro">Perf. annualisée</div>
                <div className={`dv3-kpi-val num ${cagrPct >= 0 ? 'pos' : 'neg'}`}>
                  {cagrPct >= 0 ? '+' : ''}{cagrPct.toFixed(1).replace('.', ',')} %<span className="dv3-kpi-meta"> /an</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {(asset.notes || isLive) && (
          <div className="dv3-body">
            {asset.notes && (
              <section className="ds-panel">
                <div className="dv3-notes-body">{asset.notes}</div>
              </section>
            )}
            {isLive && (
              <section className="ds-panel" style={{ padding: 0 }}>
                <LivePricesFooter
                  fetchedAt={liveQuote?.fetchedAt}
                  count={1}
                  onRefresh={refresh}
                  loading={liveLoading}
                />
              </section>
            )}
          </div>
        )}

        <div className="dv3-foot">
          <div className="dv3-foot-meta">
            {asset.purchaseDate && <span>Acquis le <span className="num">{formatDate(asset.purchaseDate)}</span></span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isLive && Math.abs(saisiValue - currentValue) > 1 && (
              <button
                className="ds-btn"
                onClick={handleSync}
                disabled={syncing}
                title="Mettre à jour la valorisation enregistrée avec le cours live"
              >
                <RefreshCw size={13} style={{ animation: syncing || liveLoading ? 'spin 1s linear infinite' : undefined }}/>
                {syncing ? 'Sync…' : 'Synchroniser la valeur'}
              </button>
            )}
            <button className="ds-btn" onClick={() => onEdit && onEdit()}>
              <Edit3 size={14}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
