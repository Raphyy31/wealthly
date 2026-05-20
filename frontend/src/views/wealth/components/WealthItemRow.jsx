// ============================================================================
// WealthItemRow — unified row for accounts + assets + liabilities (v6).
// Refonte 2026-05-20 : icones Lucide par categorie, chevron clickable,
// no italic sur les valeurs, hover refined.
// ============================================================================
import { Trash2, ChevronRight, Wallet, TrendingUp, Home, Bitcoin, Sparkles, CreditCard } from 'lucide-react';

// Mapping categorie -> { icon Lucide, color CSS var }
const CATEGORY_VISUAL = {
  liquidites:      { Icon: Wallet,     color: 'var(--d2)',     tint: 'color-mix(in oklab, var(--d2) 14%, transparent)' },
  investissements: { Icon: TrendingUp, color: 'var(--accent)', tint: 'var(--accent-soft)' },
  immobilier:      { Icon: Home,       color: 'var(--d3)',     tint: 'color-mix(in oklab, var(--d3) 14%, transparent)' },
  cryptos:         { Icon: Bitcoin,    color: 'var(--d7)',     tint: 'color-mix(in oklab, var(--d7) 14%, transparent)' },
  autres:          { Icon: Sparkles,   color: 'var(--d4)',     tint: 'color-mix(in oklab, var(--d4) 14%, transparent)' },
  emprunts:        { Icon: CreditCard, color: 'var(--negative)', tint: 'color-mix(in oklab, var(--negative) 14%, transparent)' },
};

export function WealthItemRow({ item, fmt, onClick, onDelete }) {
  const positive = (item.plLatente || 0) >= 0;
  // Pas de PV latente affichée sur les biens immobiliers dans la liste —
  // le détail (brute marché vs nette fiscale) vit sur la fiche du prêt lié.
  const showPlLatente = item.category !== 'immobilier';
  const visual = CATEGORY_VISUAL[item.category] || CATEGORY_VISUAL.autres;
  const Icon = visual.Icon;
  const isClickable = !!onClick;
  return (
    <div
      className={`wealth-item-row ${isClickable ? 'is-clickable' : ''}`}
      onClick={() => onClick && onClick(item)}
      role={onClick ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => { if (isClickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(item); } }}
    >
      <div className="wealth-item-row-left">
        <div className="wealth-item-icon" style={{ background: visual.tint, color: visual.color }}>
          <Icon size={16}/>
        </div>
        <div className="wealth-item-id">
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
        <div className="wealth-item-value-wrap">
          <div className="wealth-item-value num">{fmt(item.value)}</div>
          {showPlLatente && item.plLatente !== null && item.plLatente !== undefined && (
            <div className={`wealth-item-delta num ${positive ? 'up' : 'down'}`}>
              {positive ? '↑ +' : '↓ '}{fmt(Math.abs(item.plLatente))}
              {item.plLatentePct !== null && item.plLatentePct !== undefined &&
                ` · ${positive ? '+' : ''}${item.plLatentePct.toFixed(1)}%`}
            </div>
          )}
        </div>
        {onDelete && item.sourceTable !== 'account' && (
          <button
            className="wealth-item-delete-btn"
            title="Supprimer"
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          >
            <Trash2 size={13}/>
          </button>
        )}
        {isClickable && (
          <ChevronRight size={16} className="wealth-item-chevron" aria-hidden="true"/>
        )}
      </div>
    </div>
  );
}
