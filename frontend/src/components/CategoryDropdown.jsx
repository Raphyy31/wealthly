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

  const selected = categories.find(c => (c.id || c.slug) === value);
  const q = search.toLowerCase().trim();
  const filtered = q ? categories.filter(c => (c.name || '').toLowerCase().includes(q)) : categories;
  const showSearch = searchable && categories.length > 8;

  return (
    <span className={`cat-dd ${disabled ? 'is-disabled' : ''} ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`cat-dd-trigger ${selected ? 'has-value' : ''}`}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        disabled={disabled}
      >
        {selected ? (
          <span className="cat-dd-chip" style={{ '--cat-color': selected.color || 'var(--accent)' }}>
            <span className="cat-dd-chip-icon" aria-hidden="true">{selected.icon || '·'}</span>
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
            {filtered.length === 0 ? (
              <div className="cat-dd-empty">Aucun résultat</div>
            ) : (
              filtered.map(c => {
                const id = c.id || c.slug;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`cat-dd-item ${value === id ? 'is-active' : ''}`}
                    onClick={() => { onChange(id); setOpen(false); }}
                  >
                    <span className="cat-dd-icon" style={{ color: c.color || 'inherit' }}>{c.icon || '·'}</span>
                    <span className="cat-dd-name">{c.name}</span>
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
