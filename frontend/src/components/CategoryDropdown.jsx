// ============================================================================
// CategoryDropdown — picker partagé pour les catégories.
//
// Bouton trigger qui affiche la catégorie sélectionnée comme un "pill" (icône
// + nom coloré), popover liste cliquable avec search optionnel. Utilisé pour
// les pickers parent/sous-catégorie dans Réglages → Règles et Mois type.
//
// Pourquoi pas <select> natif : le rendu du <select> diverge entre navigateurs
// (option avec emoji + couleur peu lisible sur Safari, dropdown sans search,
// pas de pill visuel sur le trigger). Ce composant donne le même rendu que le
// filtre Catégorie/Détail de la table Transactions.
// ============================================================================
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// Helpers — read parent slug whether it's stored as `parent` (frontend
// constants) or `parent_slug` (backend payload).
const parentOf = (c) => c?.parent || c?.parent_slug || null;
const slugOf = (c) => c?.id || c?.slug;

export function CategoryDropdown({
  value,
  categories,
  onChange,
  placeholder = 'Choisir…',
  disabled = false,
  align = 'left',
  searchable = true,
  clearable = true,
  emptyLabel = 'Aucune catégorie',
  grouped = false,            // when true, render top-level + indented children
  showParentInChip = true,    // when a sub is selected, show "Parent › Sub" in trigger
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const tid = setTimeout(() => window.addEventListener('mousedown', handler), 80);
    return () => { clearTimeout(tid); window.removeEventListener('mousedown', handler); };
  }, [open]);

  useEffect(() => { if (!open) setSearch(''); }, [open]);

  const selected = categories.find(c => slugOf(c) === value);
  const parentCat = selected && parentOf(selected)
    ? categories.find(c => slugOf(c) === parentOf(selected))
    : null;

  const q = search.toLowerCase().trim();
  const matches = (c) => q === '' || (c.name || '').toLowerCase().includes(q);
  const showSearch = searchable && categories.length > 8;

  // Build the rows to render. In grouped mode we surface top-level cats and
  // indent their direct children right below — search hits on a sub keep the
  // parent visible (for context), search hits on a top surface all its subs.
  let rows;
  if (grouped) {
    const tops = categories.filter(c => !parentOf(c)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    rows = [];
    for (const top of tops) {
      const subs = categories.filter(c => parentOf(c) === slugOf(top))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const topHit = matches(top);
      const matchedSubs = subs.filter(matches);
      if (q && !topHit && matchedSubs.length === 0) continue;
      rows.push({ cat: top, indent: false });
      const subsToShow = (q && !topHit) ? matchedSubs : subs;
      for (const s of subsToShow) rows.push({ cat: s, indent: true });
    }
  } else {
    rows = categories.filter(matches).map(c => ({ cat: c, indent: false }));
  }

  return (
    <span className={`cat-dd ${disabled ? 'is-disabled' : ''} ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`cat-dd-trigger ${selected ? 'has-value' : ''}`}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        disabled={disabled}
      >
        {selected ? (
          <span className="cat-dd-chip" style={{ '--cat-color': selected.color || parentCat?.color || 'var(--accent)' }}>
            <span className="cat-dd-chip-icon" aria-hidden="true">{selected.icon || parentCat?.icon || '·'}</span>
            {parentCat && showParentInChip ? (
              <>
                <span className="cat-dd-chip-parent">{parentCat.name}</span>
                <span className="cat-dd-chip-sep" aria-hidden="true">›</span>
              </>
            ) : null}
            <span className="cat-dd-chip-name">{selected.name}</span>
          </span>
        ) : (
          <span className="cat-dd-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={14} className="cat-dd-caret" />
      </button>
      {open && !disabled && (
        <div className={`cat-dd-pop cat-dd-pop-${align}`}>
          {showSearch && (
            <div className="cat-dd-search">
              <Search size={12} />
              <input
                autoFocus
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
              />
            </div>
          )}
          <div className="cat-dd-list">
            {clearable && value && (
              <button
                type="button"
                className="cat-dd-item cat-dd-item-clear"
                onClick={() => { onChange(''); setOpen(false); }}
              >
                <span className="cat-dd-icon">·</span>
                <span className="cat-dd-name">{emptyLabel}</span>
              </button>
            )}
            {rows.length === 0 ? (
              <div className="cat-dd-empty">Aucun résultat</div>
            ) : (
              rows.map(({ cat, indent }) => {
                const id = slugOf(cat);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`cat-dd-item ${indent ? 'is-sub' : 'is-top'} ${value === id ? 'is-active' : ''}`}
                    onClick={() => { onChange(id); setOpen(false); }}
                  >
                    <span className="cat-dd-icon" style={{ color: cat.color || 'inherit' }}>{cat.icon || '·'}</span>
                    <span className="cat-dd-name">{cat.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </span>
  );
}
