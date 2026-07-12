// ============================================================================
// WealthCategoryCard — carte resume + drill par categorie de patrimoine.
// Refonte 2026-05-20 : remplace la single mega-liste par un grid de 6 cards,
// chacune montrant son total + son % patrimoine + top 3 items toujours
// visibles + chevron pour expand.
// ============================================================================
import { useState, useRef, useLayoutEffect } from 'react';
import { ChevronDown, Plus, Trash2, Wallet, TrendingUp, Home, Bitcoin, Sparkles, CreditCard } from 'lucide-react';
import { gsap } from '../../../utils/gsapSetup.js';

// Plafonds réglementés FR : détection inline + progress bar sur l'item
const REG_CAPS = [
  { label: 'PEA',      cap: 150000, match: (name) => /\bpea\b/i.test(name) && !/pme/i.test(name) },
  { label: 'PEA-PME',  cap: 225000, match: (name) => /pea[-\s]?pme/i.test(name) },
  { label: 'Livret A', cap: 22950,  match: (name) => /livret\s*a\b/i.test(name) },
  { label: 'LDDS',     cap: 12000,  match: (name) => /\bldds\b/i.test(name) || /(développement\s+durable)/i.test(name) },
  { label: 'LEP',      cap: 10000,  match: (name) => /\blep\b/i.test(name) },
];
const getRegCap = (name) => {
  if (!name) return null;
  return REG_CAPS.find(c => c.match(name)) || null;
};

const CATEGORY_VISUAL = {
  liquidites:      { Icon: Wallet,     color: 'var(--d2)',       tint: 'color-mix(in oklab, var(--d2) 14%, transparent)',       label: 'Liquidités' },
  investissements: { Icon: TrendingUp, color: 'var(--accent)',   tint: 'var(--accent-soft)',                                     label: 'Investissements' },
  immobilier:      { Icon: Home,       color: 'var(--d3)',       tint: 'color-mix(in oklab, var(--d3) 14%, transparent)',       label: 'Immobilier' },
  cryptos:         { Icon: Bitcoin,    color: 'var(--d7)',       tint: 'color-mix(in oklab, var(--d7) 14%, transparent)',       label: 'Cryptos' },
  autres:          { Icon: Sparkles,   color: 'var(--d4)',       tint: 'color-mix(in oklab, var(--d4) 14%, transparent)',       label: 'Autres' },
  emprunts:        { Icon: CreditCard, color: 'var(--negative)', tint: 'color-mix(in oklab, var(--negative) 14%, transparent)', label: 'Emprunts' },
};

const TOP_N_BY_DEFAULT = 3;

// localStorage : on garde l'état déplié/replié de chaque classe pour ne pas
// repartir tout fermé à chaque visite. Clé par catégorie.
const OPEN_LS_KEY = 'yotori:wcOpen';
function readOpenMap() {
  try { return JSON.parse(localStorage.getItem(OPEN_LS_KEY) || '{}') || {}; } catch { return {}; }
}
function writeOpenMap(map) {
  try { localStorage.setItem(OPEN_LS_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function WealthCategoryCard({ category, items, total, grossAssetsTotal, fmt, onItemClick, onItemDelete, onAdd, onHeaderClick }) {
  const visual = CATEGORY_VISUAL[category] || CATEGORY_VISUAL.autres;
  const Icon = visual.Icon;
  // « expanded » = afficher tous les items (au lieu de top 3)
  const [expanded, setExpanded] = useState(false);
  // « isOpen » = card dépliée (items visibles) vs repliée (header seul)
  // Mémorisé en localStorage par catégorie ; default = ouvert pour la 1re visite
  // (sauf si l'user a explicitement replié).
  const [isOpen, setIsOpen] = useState(() => {
    const m = readOpenMap();
    return m[category] !== false; // undefined → ouvert ; false explicite → fermé
  });
  const bodyRef = useRef(null);
  const contentRef = useRef(null);

  // Items tries par valeur desc (les plus gros postes en premier)
  const sorted = [...items].sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0));
  const isEmpty = sorted.length === 0;
  const showAll = expanded || sorted.length <= TOP_N_BY_DEFAULT;
  const displayed = showAll ? sorted : sorted.slice(0, TOP_N_BY_DEFAULT);
  const hidden = sorted.length - TOP_N_BY_DEFAULT;

  const pct = grossAssetsTotal > 0 ? (Math.abs(total) / grossAssetsTotal) * 100 : 0;

  // Animation accordion via GSAP — anime à 0 (replié) ou scrollHeight (déplié)
  useLayoutEffect(() => {
    const wrap = bodyRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const targetH = isOpen ? content.scrollHeight : 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(wrap, { height: targetH });
      return;
    }
    gsap.to(wrap, { height: targetH, duration: 0.32, ease: 'power3.out' });
  }, [expanded, displayed.length, isOpen]);

  const toggleOpen = () => {
    if (isEmpty) return;
    const next = !isOpen;
    setIsOpen(next);
    const m = readOpenMap();
    m[category] = next;
    writeOpenMap(m);
  };

  return (
    <div
      className={`wc-card ${isEmpty ? 'is-empty' : ''} ${isOpen ? 'is-open' : 'is-closed'}`}
      style={{
        // Bande latérale colorée + header teinté à la couleur de la classe.
        // Les --wc-* tokens sont consommés par Styles.jsx.
        '--wc-accent': visual.color,
        '--wc-tint': visual.tint,
      }}
    >
      <button
        type="button"
        className="wc-card-head wc-card-head-btn"
        onClick={toggleOpen}
        disabled={isEmpty}
        aria-expanded={isOpen}
        title={isEmpty ? '' : (isOpen ? 'Replier' : `Voir les ${visual.label.toLowerCase()}`)}
      >
        <div className="wc-card-icon" style={{ background: visual.tint, color: visual.color }}>
          <Icon size={18}/>
        </div>
        <div className="wc-card-titles">
          <div className="wc-card-name">{visual.label}</div>
          <div className="wc-card-meta">
            {sorted.length === 0 ? 'Aucun élément' : `${sorted.length} ${category === 'emprunts' ? (sorted.length > 1 ? 'prêts' : 'prêt') : sorted.length > 1 ? 'actifs' : 'actif'}`}
            {grossAssetsTotal > 0 && !isEmpty && (category === 'emprunts'
              ? ` · ${pct.toFixed(1)}% de vos actifs à rembourser`
              : ` · ${pct.toFixed(1)}% de vos actifs`)}
          </div>
        </div>
        <div className="wc-card-total-wrap">
          <div className={`wc-card-total num ${category === 'emprunts' ? 'neg' : ''}`}>
            {category === 'emprunts' && total > 0 ? '−' : ''}{fmt(Math.abs(total))}
          </div>
        </div>
        {!isEmpty && (
          <ChevronDown size={16} className={`wc-card-chev ${isOpen ? 'is-up' : ''}`} aria-hidden="true"/>
        )}
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
                      {(() => {
                        const cap = getRegCap(item.name);
                        if (!cap) return null;
                        const val = Math.abs(item.value || 0);
                        const pct = Math.min(100, (val / cap.cap) * 100);
                        const state = pct >= 99 ? 'over' : pct >= 90 ? 'warn' : 'ok';
                        const remaining = Math.max(0, cap.cap - val);
                        return (
                          <div className={`wc-cap-bar state-${state}`} title={`Plafond ${cap.label} · reste ${fmt(remaining)}`}>
                            <div className="wc-cap-bar-track">
                              <div className="wc-cap-bar-fill" style={{ width: `${pct}%` }}/>
                            </div>
                            <span className="wc-cap-bar-label">{cap.label} · {pct.toFixed(0)}%</span>
                          </div>
                        );
                      })()}
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
              {onHeaderClick && (
                <button
                  type="button"
                  className="wc-card-detail-link"
                  onClick={(e) => { e.stopPropagation(); onHeaderClick(category); }}
                >
                  Voir le détail {visual.label.toLowerCase()} →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
