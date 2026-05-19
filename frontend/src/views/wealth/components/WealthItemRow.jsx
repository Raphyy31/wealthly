// ============================================================================
// WealthItemRow — unified row for accounts + assets + liabilities (v6).
// Extracted from Wealth.jsx lines 1657-1705.
// ============================================================================
import { Trash2 } from 'lucide-react';

export function WealthItemRow({ item, fmt, onClick, onDelete }) {
  const positive = (item.plLatente || 0) >= 0;
  // Pas de PV latente affichée sur les biens immobiliers dans la liste —
  // le détail (brute marché vs nette fiscale) vit sur la fiche du prêt lié.
  const showPlLatente = item.category !== 'immobilier';
  return (
    <div
      className="wealth-item-row"
      onClick={() => onClick && onClick(item)}
      role={onClick ? 'button' : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="wealth-item-row-left">
        <div className="wealth-item-icon">{(item.name || '?').charAt(0).toUpperCase()}</div>
        <div>
          <div className="wealth-item-name">{item.name}</div>
          <div className="wealth-item-meta">
            {item.meta?.bank && <span className="wealth-item-bank">{item.meta.bank}</span>}
            <span className={`badge badge-${item.syncMode}`}>
              {item.syncMode === 'synced' ? 'Synchronisé' : 'Manuel'}
            </span>
            {item.positions && item.positions.length > 0 && (
              <span className="wealth-item-meta-muted"> · {item.positions.length} positions</span>
            )}
          </div>
        </div>
      </div>
      <div className="wealth-item-row-right">
        <div className="wealth-item-value w-num">{fmt(item.value)}</div>
        {showPlLatente && item.plLatente !== null && item.plLatente !== undefined && (
          <div className={`wealth-item-delta ${positive ? 'up' : 'down'}`}>
            {positive ? '+' : ''}{fmt(item.plLatente)}
            {item.plLatentePct !== null && item.plLatentePct !== undefined &&
              ` · ${positive ? '+' : ''}${item.plLatentePct.toFixed(1)}%`}
          </div>
        )}
        {onDelete && item.sourceTable !== 'account' && (
          <button
            className="wealth-item-delete-btn"
            title="Supprimer"
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          >
            <Trash2 size={13}/>
          </button>
        )}
      </div>
    </div>
  );
}
