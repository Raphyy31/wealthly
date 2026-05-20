// ============================================================================
// WealthCategoryCard — carte resume + drill par categorie de patrimoine.
// Refonte 2026-05-20 : remplace la single mega-liste par un grid de 6 cards,
// chacune montrant son total + son % patrimoine + top 3 items toujours
// visibles + chevron pour expand.
// ============================================================================
import { useState, useRef, useLayoutEffect } from 'react';
import { ChevronDown, Plus, Trash2, Wallet, TrendingUp, Home, Bitcoin, Sparkles, CreditCard } from 'lucide-react';
import { gsap } from '../../../utils/gsapSetup.js';

const CATEGORY_VISUAL = {
  liquidites:      { Icon: Wallet,     color: 'var(--d2)',       tint: 'color-mix(in oklab, var(--d2) 14%, transparent)',       label: 'Liquidités' },
  investissements: { Icon: TrendingUp, color: 'var(--accent)',   tint: 'var(--accent-soft)',                                     label: 'Investissements' },
  immobilier:      { Icon: Home,       color: 'var(--d3)',       tint: 'color-mix(in oklab, var(--d3) 14%, transparent)',       label: 'Immobilier' },
  cryptos:         { Icon: Bitcoin,    color: 'var(--d7)',       tint: 'color-mix(in oklab, var(--d7) 14%, transparent)',       label: 'Cryptos' },
  autres:          { Icon: Sparkles,   color: 'var(--d4)',       tint: 'color-mix(in oklab, var(--d4) 14%, transparent)',       label: 'Autres' },
  emprunts:        { Icon: CreditCard, color: 'var(--negative)', tint: 'color-mix(in oklab, var(--negative) 14%, transparent)', label: 'Emprunts' },
};

const TOP_N_BY_DEFAULT = 3;

export function WealthCategoryCard({ category, items, total, totalWealth, fmt, onItemClick, onItemDelete, onAdd, onHeaderClick }) {
  const visual = CATEGORY_VISUAL[category] || CATEGORY_VISUAL.autres;
  const Icon = visual.Icon;
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef(null);
  const contentRef = useRef(null);

  // Items tries par valeur desc (les plus gros postes en premier)
  const sorted = [...items].sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0));
  const isEmpty = sorted.length === 0;
  const showAll = expanded || sorted.length <= TOP_N_BY_DEFAULT;
  const displayed = showAll ? sorted : sorted.slice(0, TOP_N_BY_DEFAULT);
  const hidden = sorted.length - TOP_N_BY_DEFAULT;

  const pct = totalWealth > 0 ? (Math.abs(total) / Math.abs(totalWealth)) * 100 : 0;

  // Animation accordion via GSAP
  useLayoutEffect(() => {
    const wrap = bodyRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const targetH = content.scrollHeight;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(wrap, { height: targetH });
      return;
    }
    gsap.to(wrap, { height: targetH, duration: 0.32, ease: 'power3.out' });
  }, [expanded, displayed.length]);

  return (
    <div className={`wc-card ${isEmpty ? 'is-empty' : ''}`}>
      <button
        type="button"
        className="wc-card-head wc-card-head-btn"
        onClick={() => !isEmpty && onHeaderClick && onHeaderClick(category)}
        disabled={isEmpty}
        title={isEmpty ? '' : `Voir le détail ${visual.label}`}
      >
        <div className="wc-card-icon" style={{ background: visual.tint, color: visual.color }}>
          <Icon size={18}/>
        </div>
        <div className="wc-card-titles">
          <div className="wc-card-name">{visual.label}</div>
          <div className="wc-card-meta">
            {sorted.length === 0 ? 'Aucun élément' : `${sorted.length} ${category === 'emprunts' ? (sorted.length > 1 ? 'prêts' : 'prêt') : sorted.length > 1 ? 'actifs' : 'actif'}`}
            {totalWealth > 0 && !isEmpty && ` · ${pct.toFixed(1)}% du patrimoine`}
          </div>
        </div>
        <div className="wc-card-total-wrap">
          <div className={`wc-card-total num ${category === 'emprunts' ? 'neg' : ''}`}>
            {category === 'emprunts' && total > 0 ? '−' : ''}{fmt(Math.abs(total))}
          </div>
        </div>
      </button>

      <div ref={bodyRef} className="wc-card-body" style={{ height: 0, overflow: 'hidden' }}>
        <div ref={contentRef}>
          {isEmpty ? (
            <button className="wc-card-empty-cta" onClick={onAdd}>
              <Plus size={14}/> Ajouter
            </button>
          ) : (
            <>
              <ul className="wc-card-items">
                {displayed.map(item => (
                  <li
                    key={item.id}
                    className="wc-card-item"
                    role={onItemClick ? 'button' : undefined}
                    tabIndex={onItemClick ? 0 : undefined}
                    onClick={() => onItemClick && onItemClick(item)}
                    onKeyDown={(e) => { if (onItemClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onItemClick(item); } }}
                  >
                    <div className="wc-card-item-info">
                      <div className="wc-card-item-name">{item.name}</div>
                      <div className="wc-card-item-meta">
                        {item.meta?.bank && <span>{item.meta.bank}</span>}
                        <span className={`badge badge-${item.syncMode}`}>
                          {item.syncMode === 'synced' ? 'Sync' : 'Manuel'}
                        </span>
                      </div>
                    </div>
                    <div className="wc-card-item-value-wrap">
                      <div className="wc-card-item-value num">{fmt(item.value)}</div>
                      {item.plLatente != null && category !== 'immobilier' && Math.abs(item.plLatente) > 0.5 && (
                        <div className={`wc-card-item-delta num ${item.plLatente >= 0 ? 'up' : 'down'}`}>
                          {item.plLatente >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(item.plLatente))}
                        </div>
                      )}
                    </div>
                    {onItemDelete && item.sourceTable !== 'account' && (
                      <button
                        className="wc-card-item-del"
                        title="Supprimer"
                        onClick={(e) => { e.stopPropagation(); onItemDelete(item); }}
                      >
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {hidden > 0 && (
                <button className="wc-card-toggle" onClick={() => setExpanded(e => !e)}>
                  {expanded ? 'Replier' : `+ ${hidden} de plus`}
                  <ChevronDown size={13} className={`wc-card-toggle-chev ${expanded ? 'is-up' : ''}`}/>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
