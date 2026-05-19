// ============================================================================
// LivePricesFooter — discrete band under the positions table or crypto panel,
// showing live-price source, last-fetched time, and a manual refresh button.
// Extracted from Wealth.jsx lines 2737-2773.
// ============================================================================
import { RefreshCw } from 'lucide-react';
import { relTimeFromTs } from '../../../utils/marketPrices.js';

export function LivePricesFooter({ fetchedAt, count = 0, onRefresh, loading }) {
  return (
    <div className="lpf-bar">
      <div className="lpf-left">
        <span className="lpf-dot"/>
        <span>
          {count > 1
            ? <>Cours actualisés en direct sur <strong>{count} positions</strong></>
            : <>Cours actualisé en direct</>}
          <span className="lpf-sep">·</span>
          <span>
            source <em>Yahoo Finance</em>
          </span>
          {fetchedAt && (
            <>
              <span className="lpf-sep">·</span>
              <span>maj il y a {relTimeFromTs(fetchedAt)}</span>
            </>
          )}
          <span className="lpf-sep">·</span>
          <span>auto-refresh toutes les 5 min</span>
        </span>
      </div>
      {onRefresh && (
        <button
          className="lpf-refresh"
          onClick={onRefresh}
          disabled={loading}
          title="Forcer un rafraîchissement maintenant"
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }}/>
          Rafraîchir
        </button>
      )}
    </div>
  );
}
