// ============================================================================
// InvestmentDetail — PEA / CTO / AV / PER detail view with live prices.
// Extracted from Wealth.jsx lines 2403-2715.
// EditableNumCell is colocated here (lines 2775-2824) because it is only used
// by this component — no shared usage found elsewhere.
// ============================================================================
import { useState, useMemo } from 'react';
import { ChevronLeft, X, Edit3, BarChart3, RefreshCw } from 'lucide-react';
import { Upload } from 'lucide-react';
import { ownersList, positionColor, formatQty } from '../utils.js';
import { InvestmentDetailStyles } from '../styles.jsx';
import { LivePricesFooter } from '../components/LivePricesFooter.jsx';
import { EditableNumCell } from '../components/EditableNumCell.jsx';
import { useLiveQuotes, relTimeFromTs } from '../../../utils/marketPrices.js';

export function InvestmentDetail({ asset, assets = [], members = [], fmt, onEdit, onClose, onSyncPositions, onImportCSV, onUpdatePosition }) {
  const positions = useMemo(
    () => assets.filter(a => a.parentAssetId === asset.id || a.parent_asset_id === asset.id),
    [assets, asset.id]
  );
  const hasPositions = positions.length > 0;

  // Récupère les cours live via Yahoo pour toutes les positions qui ont
  // un ticker (champ tickerYahoo / ticker_yahoo / ticker selon migration).
  const positionTickers = useMemo(
    () => positions
      .map(p => (p.tickerYahoo || p.ticker_yahoo || p.ticker || '').toString().toUpperCase().trim())
      .filter(Boolean),
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

  // Positions enrichies : si tickerYahoo + cours live dispo, on recompose la
  // valeur (qty × livePrice) à la volée. Sinon on retombe sur le saisi.
  const rows = useMemo(() => {
    return positions
      .map(p => {
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
        return {
          id: p.id,
          name: p.name || '—',
          isin: p.isin || sym || '',
          qty,
          cours,
          value,
          saisi,
          isLive,
          pl,
          plPct,
          invested,
          color: positionColor(p.name),
          initial: (p.name || '?').trim()[0]?.toUpperCase() || '?',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [positions, prices]);

  // Recalcule la valeur globale du compte avec les cours live quand dispo.
  const saisiValue = parseFloat(asset.currentValue) || 0;
  const positionsValue = rows.reduce((s, r) => s + r.value, 0);
  const saisiPositionsValue = positions.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  const cashAvailable = Math.max(0, saisiValue - saisiPositionsValue);
  const currentValue = hasPositions
    ? (positionsValue + cashAvailable)
    : saisiValue;

  const invested = hasPositions
    ? positions.reduce((s, p) => s + (parseFloat(p.purchasePrice) || 0) * (parseFloat(p.quantity) || 0), 0)
    : (parseFloat(asset.purchasePrice) || 0);

  const plLatente = currentValue - invested;
  const plLatentePct = invested > 0 ? (plLatente / invested) * 100 : 0;

  const subtype = asset.type;
  const subtypeLabel = ({ pea: 'PEA', life_insurance: 'Assurance-vie', per: 'PER', stocks: 'CTO' })[subtype] || "Compte d'investissement";
  const isPEA = subtype === 'pea';

  const owners = ownersList(asset.memberIds, members);

  // Sync : pousse les valorisations live dans la DB (positions + compte parent)
  const [syncing, setSyncing] = useState(false);
  const liveRowsToSync = rows.filter(r => r.isLive && Math.abs(r.value - r.saisi) > 0.5);
  const handleSync = async () => {
    if (!onSyncPositions || liveRowsToSync.length === 0) return;
    setSyncing(true);
    try {
      await onSyncPositions(asset, rows);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal inv-v3-page" onClick={e => e.stopPropagation()}>
        <InvestmentDetailStyles/>

        {/* Header */}
        <div className="inv-v3-head">
          <button className="drawer-back" onClick={onClose}>
            <ChevronLeft size={14}/> Patrimoine · Investissements
          </button>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={18}/>
          </button>

          <div className="inv-v3-title-row">
            <div className="inv-v3-title-block">
              <div className="inv-v3-eyebrow">{subtypeLabel}</div>
              <h2 className="inv-v3-title">
                {asset.name?.split(' ')[0] || 'Compte'}{' '}
                <em>{asset.name?.split(' ').slice(1).join(' ') || ''}.</em>
              </h2>
              <div className="inv-v3-sub">
                {anyLive
                  ? <span className="dv3-badge dv3-badge-live">Cours live</span>
                  : <span className="dv3-badge">Saisi manuellement</span>}
                {rows.length > 0 && <><span className="inv-v3-dot">·</span><span>{rows.length} position{rows.length > 1 ? 's' : ''}</span></>}
                {owners && <><span className="inv-v3-dot">·</span><span>{owners}</span></>}
                {lastFetchedAt && <><span className="inv-v3-dot">·</span><span>maj il y a {relTimeFromTs(lastFetchedAt)}</span></>}
              </div>
            </div>
            <div className="inv-v3-value-block">
              <div className="inv-v3-hero-num num">{fmt(currentValue)}</div>
              {invested > 0 && (
                <div className={`inv-v3-hero-delta ${plLatente >= 0 ? 'pos' : 'neg'}`}>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{fmt(plLatente)}</span>
                  <span className="inv-v3-dot">·</span>
                  <span className="num">{plLatente >= 0 ? '+' : ''}{plLatentePct.toFixed(2).replace('.', ',')} %</span>
                </div>
              )}
            </div>
          </div>

          {/* Compact KPI strip */}
          <div className="inv-v3-kpis">
            <div className="inv-v3-kpi">
              <div className="ds-micro">Investi</div>
              <div className="inv-v3-kpi-val num">{fmt(invested)}</div>
            </div>
            <div className="inv-v3-kpi">
              <div className="ds-micro">Valorisation</div>
              <div className="inv-v3-kpi-val num">{fmt(currentValue)}</div>
            </div>
            {hasPositions && (
              <div className="inv-v3-kpi">
                <div className="ds-micro">Liquidités</div>
                <div className="inv-v3-kpi-val num">{fmt(cashAvailable)}</div>
              </div>
            )}
            {isPEA && (
              <div className="inv-v3-kpi">
                <div className="ds-micro">Plafond PEA</div>
                <div className="inv-v3-kpi-val num">
                  {Math.round((invested / 150000) * 100)} %
                  <span className="inv-v3-kpi-meta"> de 150 000 €</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body : table de positions Finary-style, ou état vide. */}
        <div className="inv-v3-body">
          {hasPositions ? (
            <section className="ds-panel inv-v3-panel">
              <div className="ds-panel-head">
                <div>
                  <div className="ds-panel-title">Positions</div>
                  <div className="ds-panel-sub">Triées par valorisation décroissante</div>
                </div>
                {onImportCSV && (
                  <button
                    className="ds-btn"
                    onClick={() => onImportCSV(asset)}
                    title="Importer un relevé de positions (CSV ou XLSX, toutes banques)"
                  >
                    Importer
                  </button>
                )}
              </div>

              <div className="inv-v3-table-wrap">
                <div className="inv-v3-cols ds-micro">
                  <div>Nom</div>
                  <div className="cell-r">Quantité</div>
                  <div className="cell-r">Cours</div>
                  <div className="cell-r">Valeur</div>
                  <div className="cell-r">+/- value</div>
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
                    <EditableNumCell
                      value={r.qty}
                      format={formatQty}
                      onCommit={(v) => onUpdatePosition?.(r.id, { quantity: v })}
                      disabled={!onUpdatePosition}
                    />
                    <EditableNumCell
                      value={r.cours}
                      format={fmt}
                      onCommit={(v) => onUpdatePosition?.(r.id, { lastPrice: v })}
                      disabled={!onUpdatePosition || r.isLive}
                      title={r.isLive ? 'Cours synchronisé en live — désactive la sync pour saisir manuellement' : 'Cliquer pour modifier'}
                    />
                    <EditableNumCell
                      value={r.value}
                      format={fmt}
                      onCommit={(v) => onUpdatePosition?.(r.id, { currentValue: v })}
                      disabled={!onUpdatePosition}
                      className="inv-v3-val"
                    />
                    <div className={`cell-r inv-v3-pl ${r.pl >= 0 ? 'pos' : 'neg'}`}>
                      <div className="num">{r.pl >= 0 ? '+' : ''}{fmt(r.pl)}</div>
                      {r.invested > 0 && (
                        <div className="num inv-v3-pl-pct">
                          {r.pl >= 0 ? '+' : ''}{r.plPct.toFixed(2).replace('.', ',')} %
                        </div>
                      )}
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

              {anyLive && (
                <LivePricesFooter
                  fetchedAt={lastFetchedAt}
                  count={Object.keys(prices).length}
                  onRefresh={refreshLive}
                  loading={liveLoading}
                />
              )}
            </section>
          ) : (
            <section className="ds-panel inv-v3-empty">
              <div className="inv-v3-empty-inner">
                <BarChart3 size={28}/>
                <h3>Aucune position importée</h3>
                <p>Importe le relevé de positions de ton broker (CSV / XLSX — Boursorama, BNP, Bourse Direct, Trade Republic, IBKR…) pour voir le détail ligne à ligne et activer les cours live. En attendant la valorisation globale du compte reste à <strong>{fmt(currentValue)}</strong>.</p>
                {onImportCSV && (
                  <button
                    className="ds-btn primary"
                    onClick={() => onImportCSV(asset)}
                    style={{ marginTop: 16 }}
                  >
                    Importer un portefeuille
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="inv-v3-foot">
          {onImportCSV && (
            <button
              className="ds-btn primary"
              onClick={() => onImportCSV(asset)}
              title="Importer un relevé de positions (CSV / XLSX, toutes banques)"
            >
              <Upload size={14}/> Importer des positions
            </button>
          )}
          {liveRowsToSync.length > 0 && (
            <button
              className="ds-btn"
              onClick={handleSync}
              disabled={syncing}
              title={`Pousser le cours live dans ${liveRowsToSync.length} position(s)`}
            >
              <RefreshCw size={13} style={{ animation: syncing || liveLoading ? 'spin 1s linear infinite' : undefined }}/>
              {syncing ? 'Sync…' : `Synchroniser ${liveRowsToSync.length} position${liveRowsToSync.length > 1 ? 's' : ''}`}
            </button>
          )}
          <button className="ds-btn" onClick={() => onEdit && onEdit()}>
            <Edit3 size={14}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}
