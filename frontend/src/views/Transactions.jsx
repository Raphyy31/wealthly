// ============================================================================
// Transactions — searchable + multi-filterable + sortable list
//
// Filter panel is collapsible. The compact bar shows search + a Filtres button
// (with active-filter count badge) + reset; expanded panel adds multi-select
// catégories / comptes / membres, date range, amount range, and tx type.
// ============================================================================
import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ArrowUpDown, Repeat, Trash2, Filter, X, RotateCcw, Sparkles } from 'lucide-react';
import { formatDate } from '../utils.js';

const EMPTY_FILTERS = {
  cats: [],          // string[] — empty means "all"
  accs: [],          // string[]
  members: [],       // string[]
  tags: [],          // string[] — transverse tags filter
  dateFrom: '',      // YYYY-MM-DD
  dateTo: '',
  amountMin: '',     // string for input control, parsed at filter time
  amountMax: '',
  type: 'all',       // all | income | expense
  month: '',         // YYYY-MM
};

// Generic per-column header filter popover. Renders a small filter icon next
// to the sort arrow; click → popover anchored to the header cell. The icon
// turns accent if `active` is true (i.e. the column has an active filter).
// `children` is the popover content (caller-supplied — multi-select, range, etc.).
function HeaderFilter({ active, align = 'left', onReset, children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    const tid = setTimeout(() => { window.addEventListener('mousedown', onClick); window.addEventListener('keydown', onEsc); }, 50);
    return () => { clearTimeout(tid); window.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onEsc); };
  }, [open]);
  return (
    <span className="th-filter-wrap" ref={wrapRef} onClick={e => e.stopPropagation()}>
      <button
        className={`th-filter-btn ${active ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Filtrer cette colonne"
        title={active ? 'Filtre actif — cliquer pour modifier' : 'Filtrer'}
        type="button"
      >
        <Filter size={11}/>
      </button>
      {open && (
        <div className={`th-filter-popover th-filter-popover-${align}`}>
          {children({ close: () => setOpen(false) })}
          {active && onReset && (
            <div className="th-filter-foot">
              <button className="th-filter-reset" onClick={() => { onReset(); setOpen(false); }}>
                <RotateCcw size={11}/> Réinitialiser
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

// Scoped sub-category picker — shows only direct children of a given top-level
// category. Used by the "Détail" column so the user gets a focused list
// instead of the full taxonomy.
function SubCatPicker({ categories, topSlug, currentId, onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const tid = setTimeout(() => window.addEventListener('mousedown', handler), 80);
    return () => { clearTimeout(tid); window.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const subs = categories.filter(c => c.parent === topSlug);
  const top = categories.find(c => c.id === topSlug);

  return (
    <div className="cat-picker subcat-picker" ref={ref}>
      <div className="subcat-picker-head">
        <span className="subcat-picker-icon" style={{ color: top?.color }}>{top?.icon}</span>
        <span>Détail · <strong>{top?.name}</strong></span>
      </div>
      <div className="cat-picker-list">
        {subs.length === 0 ? (
          <div className="cat-picker-empty">Aucun détail disponible pour cette catégorie.</div>
        ) : (
          <>
            <button
              className={`cat-picker-item ${currentId === topSlug ? 'active' : ''}`}
              onClick={() => { onSelect(topSlug); onClose(); }}
              style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}
            >
              <span className="cat-picker-icon">·</span>
              <span>Aucun détail</span>
            </button>
            {subs.map(s => (
              <button
                key={s.id}
                className={`cat-picker-item ${currentId === s.id ? 'active' : ''}`}
                onClick={() => { onSelect(s.id); onClose(); }}
              >
                <span className="cat-picker-icon">{s.icon}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Inline tags editor for a single transaction. Tags are normalized to
// lowercase kebab-case (vacances-2026, pro, cadeau-anniv) for stable filtering.
function TxTagsInline({ tags = [], allTags = [], onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const normalize = (s) => s.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
  const commit = (raw) => {
    const t = normalize(raw);
    if (!t) { setAdding(false); setDraft(''); return; }
    if (tags.includes(t)) { setAdding(false); setDraft(''); return; }
    onChange([...tags, t]);
    setAdding(false); setDraft('');
  };
  const remove = (t) => onChange(tags.filter(x => x !== t));
  return (
    <span className="tx-tags-inline">
      {tags.map(t => (
        <button key={t} className="tx-tag-chip" onClick={(e) => { e.stopPropagation(); remove(t); }} title="Cliquer pour retirer">
          #{t}
        </button>
      ))}
      {adding ? (
        <input
          autoFocus
          className="tx-tag-input"
          list="tx-tag-suggestions"
          placeholder="tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
            if (e.key === 'Escape') { setAdding(false); setDraft(''); }
          }}
        />
      ) : (
        <button className="tx-tag-add" onClick={(e) => { e.stopPropagation(); setAdding(true); }} title="Ajouter un tag">+ tag</button>
      )}
    </span>
  );
}

function CatPicker({ categories, currentId, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    // small delay to avoid immediate close on the opening click
    const tid = setTimeout(() => window.addEventListener('mousedown', handler), 80);
    return () => { clearTimeout(tid); window.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const q = search.toLowerCase();
  const matchesSearch = (c) => q === '' || c.name.toLowerCase().includes(q);
  // Group by top-level parent. Categories with parent=null are top-level.
  // A search hit on a sub-cat surfaces its parent group; a hit on a top-level
  // surfaces all its sub-cats.
  const tops = categories.filter(c => !c.parent && c.id !== 'uncategorized');
  const groups = tops.map(top => {
    const subs = categories.filter(c => c.parent === top.id);
    const topHits = matchesSearch(top);
    const matchingSubs = subs.filter(matchesSearch);
    if (q && !topHits && matchingSubs.length === 0) return null;
    return { top, subs: q && !topHits ? matchingSubs : subs };
  }).filter(Boolean);

  const Row = ({ c, indent = false }) => (
    <button
      key={c.id}
      className={`cat-picker-item ${currentId === c.id ? 'active' : ''}`}
      onClick={() => { onSelect(c.id); onClose(); }}
      style={indent ? { paddingLeft: 28 } : undefined}
    >
      <span className="cat-picker-icon">{c.icon}</span>
      <span>{c.name}</span>
    </button>
  );

  return (
    <div className="cat-picker" ref={ref}>
      <div className="cat-picker-search">
        <Search size={12} />
        <input
          autoFocus
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        />
      </div>
      <div className="cat-picker-list">
        {groups.map(({ top, subs }) => (
          <div key={top.id}>
            <Row c={top}/>
            {subs.map(s => <Row key={s.id} c={s} indent/>)}
          </div>
        ))}
        {groups.length === 0 && <div className="cat-picker-empty">Aucune catégorie trouvée</div>}
      </div>
    </div>
  );
}

export function Transactions({ transactions, accounts, categories, members = [], recurringIds, toggleRecurring, transferIds = new Set(), setTransferOverride, updateCategory, updateTags, deleteTransaction, fmt, initialAccountFilter, onConsumeInitialFilter, onOpenAiPrompt }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  // Seed the account filter on mount if the parent passed one (e.g. coming
  // from the AccountDrawer "voir toutes les transactions" CTA).
  const [filters, setFilters] = useState(() =>
    initialAccountFilter ? { ...EMPTY_FILTERS, accs: [initialAccountFilter] } : EMPTY_FILTERS
  );
  const [showPanel, setShowPanel] = useState(false);
  const [catFilterSearch, setCatFilterSearch] = useState('');

  // Consume the initial filter so it doesn't re-apply on subsequent navigations
  // back to this view.
  useEffect(() => {
    if (initialAccountFilter && onConsumeInitialFilter) onConsumeInitialFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [editingTx, setEditingTx] = useState(null);
  const [editingSubcat, setEditingSubcat] = useState(null);  // tx.id whose Détail picker is open
  const panelRef = useRef(null);

  // Close the filter panel on outside click.
  useEffect(() => {
    if (!showPanel) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [showPanel]);

  // Index account → its member ids, for the per-tx member filter.
  const accountMembers = useMemo(() => {
    const m = {};
    accounts.forEach(a => { m[a.id] = a.memberIds || []; });
    return m;
  }, [accounts]);

  // Per-category transaction counts (shown next to each checkbox in the panel).
  const catCounts = useMemo(() => {
    const c = {};
    transactions.forEach(tx => { c[tx.categoryId || 'uncategorized'] = (c[tx.categoryId || 'uncategorized'] || 0) + 1; });
    return c;
  }, [transactions]);

  // All tags in use across the household, with counts. Sorted by frequency desc.
  const { allTags, tagCounts } = useMemo(() => {
    const counts = {};
    transactions.forEach(tx => (tx.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { allTags: sorted, tagCounts: counts };
  }, [transactions]);

  // Available months for the month filter bar.
  const availableMonths = useMemo(() => {
    const set = new Set();
    transactions.forEach(tx => { if (tx.date) set.add(tx.date.slice(0, 7)); });
    return [...set].sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const min = filters.amountMin === '' ? null : parseFloat(filters.amountMin);
    const max = filters.amountMax === '' ? null : parseFloat(filters.amountMax);
    return transactions
      .filter(tx => {
        if (q && !(tx.label || '').toLowerCase().includes(q)) return false;
        if (filters.cats.length > 0 && !filters.cats.includes(tx.categoryId || 'uncategorized')) return false;
        if (filters.accs.length > 0 && !filters.accs.includes(tx.accountId)) return false;
        if (filters.members.length > 0) {
          const owners = accountMembers[tx.accountId] || [];
          if (!filters.members.some(m => owners.includes(m))) return false;
        }
        if (filters.dateFrom && tx.date < filters.dateFrom) return false;
        if (filters.dateTo && tx.date > filters.dateTo) return false;
        if (min != null && Math.abs(tx.amount) < min) return false;
        if (max != null && Math.abs(tx.amount) > max) return false;
        if (filters.type === 'income' && tx.amount < 0) return false;
        if (filters.type === 'expense' && tx.amount >= 0) return false;
        if (filters.month && !tx.date.startsWith(filters.month)) return false;
        if (filters.tags.length > 0) {
          const txTags = tx.tags || [];
          if (!filters.tags.every(tag => txTags.includes(tag))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
        else if (sortKey === 'amount') cmp = a.amount - b.amount;
        else if (sortKey === 'label') cmp = (a.label || '').localeCompare(b.label || '');
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [transactions, search, filters, sortKey, sortDir, accountMembers]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleInList = (key, value) => {
    setFilters(f => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value],
    }));
  };

  const setField = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setSearch(''); };

  // Active filter count for the badge.
  const activeCount =
    filters.cats.length +
    filters.accs.length +
    filters.members.length +
    filters.tags.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.amountMin !== '' ? 1 : 0) +
    (filters.amountMax !== '' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.month ? 1 : 0);

  const catSearchQ = catFilterSearch.toLowerCase();
  const expenseCats = categories.filter(c => c.type === 'expense' && (catSearchQ === '' || c.name.toLowerCase().includes(catSearchQ)));
  const incomeCats = categories.filter(c => c.type === 'income' && (catSearchQ === '' || c.name.toLowerCase().includes(catSearchQ)));

  return (
    <div className="transactions-view">
      <div className="subview-header">
        <div>
          <h1>{t('views.transactions.title')} <em>{t('views.transactions.titleAccent')}</em></h1>
          <p>{t('views.transactions.subtitle')}</p>
        </div>
        {onOpenAiPrompt && (() => {
          const uncatCount = transactions.filter(tx => (!tx.categoryId || tx.categoryId === 'uncategorized') && (tx.label || '').trim()).length;
          return (
            <button
              className={`ds-btn ${uncatCount > 0 ? 'primary' : 'ghost'}`}
              onClick={onOpenAiPrompt}
              title="Génère un prompt à coller dans Claude/ChatGPT pour catégoriser en lot (sans clé API)"
              disabled={uncatCount === 0}
            >
              <Sparkles size={14}/> Catégoriser via IA
              {uncatCount > 0 && <span className="ds-btn-badge">{uncatCount}</span>}
            </button>
          );
        })()}
      </div>

      <div className="filters-bar" ref={panelRef}>
        <div className="search-box">
          <Search size={16}/>
          <input placeholder={t('views.transactions.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>

        <button
          className={`tx-filter-btn ${activeCount > 0 ? 'has-active' : ''}`}
          onClick={() => setShowPanel(s => !s)}
          aria-expanded={showPanel}
        >
          <Filter size={14}/>
          <span>Filtres</span>
          {activeCount > 0 && <span className="tx-filter-count">{activeCount}</span>}
        </button>

        {(activeCount > 0 || search) && (
          <button className="tx-filter-reset" onClick={resetFilters} title="Réinitialiser tous les filtres">
            <RotateCcw size={13}/> Réinitialiser
          </button>
        )}

        <span className="result-count">{filtered.length} transaction{filtered.length > 1 ? 's' : ''}</span>

        {showPanel && (
          <div className="tx-filter-panel">
            <div className="tx-filter-panel-header">
              <span>Filtres avancés</span>
              <button className="icon-btn-sm" onClick={() => setShowPanel(false)} aria-label="Fermer"><X size={14}/></button>
            </div>

            <div className="tx-filter-section">
              <div className="tx-filter-label">Type</div>
              <div className="tx-filter-radio-row">
                {[
                  { v: 'all',     l: 'Tout' },
                  { v: 'income',  l: 'Revenus' },
                  { v: 'expense', l: 'Dépenses' },
                ].map(o => (
                  <button
                    key={o.v}
                    className={`tx-filter-pill ${filters.type === o.v ? 'active' : ''}`}
                    onClick={() => setField('type', o.v)}
                  >{o.l}</button>
                ))}
              </div>
            </div>

            <div className="tx-filter-section">
              <div className="tx-filter-label">Période</div>
              <div className="tx-filter-row-2">
                <input type="date" value={filters.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)} aria-label="Date de début"/>
                <input type="date" value={filters.dateTo} onChange={(e) => setField('dateTo', e.target.value)} aria-label="Date de fin"/>
              </div>
            </div>

            <div className="tx-filter-section">
              <div className="tx-filter-label">Montant (€, valeur absolue)</div>
              <div className="tx-filter-row-2">
                <input type="number" placeholder="min" value={filters.amountMin} onChange={(e) => setField('amountMin', e.target.value)} min="0" step="0.01"/>
                <input type="number" placeholder="max" value={filters.amountMax} onChange={(e) => setField('amountMax', e.target.value)} min="0" step="0.01"/>
              </div>
            </div>

            {members.length > 1 && (
              <div className="tx-filter-section">
                <div className="tx-filter-label">Membre(s)</div>
                <div className="tx-filter-chips">
                  {members.map(m => (
                    <button
                      key={m.id}
                      className={`tx-filter-chip ${filters.members.includes(m.id) ? 'active' : ''}`}
                      onClick={() => toggleInList('members', m.id)}
                      style={filters.members.includes(m.id) ? { borderColor: m.color, color: m.color } : {}}
                    >
                      <span className="member-avatar" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {accounts.length > 0 && (
              <div className="tx-filter-section">
                <div className="tx-filter-label">Comptes</div>
                <div className="tx-filter-chips">
                  {accounts.map(a => (
                    <button
                      key={a.id}
                      className={`tx-filter-chip ${filters.accs.includes(a.id) ? 'active' : ''}`}
                      onClick={() => toggleInList('accs', a.id)}
                    >{a.name}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="tx-filter-section">
              <div className="tx-filter-label">Catégories</div>
              <input
                className="tx-filter-search-input"
                placeholder="Filtrer les catégories…"
                value={catFilterSearch}
                onChange={e => setCatFilterSearch(e.target.value)}
              />
              {incomeCats.length > 0 && (
                <>
                  <div className="tx-filter-sublabel">Revenus</div>
                  <div className="tx-filter-cat-grid">
                    {incomeCats.map(c => (
                      <label key={c.id} className={`tx-filter-cat ${filters.cats.includes(c.id) ? 'active' : ''}`}>
                        <input type="checkbox" checked={filters.cats.includes(c.id)} onChange={() => toggleInList('cats', c.id)}/>
                        <span className="tx-filter-cat-icon">{c.icon}</span>
                        <span className="tx-filter-cat-name">{c.name}</span>
                        <span className="tx-filter-cat-count">{catCounts[c.id] || 0}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {expenseCats.length > 0 && (
                <>
                  <div className="tx-filter-sublabel">Dépenses</div>
                  <div className="tx-filter-cat-grid">
                    {expenseCats.map(c => (
                      <label key={c.id} className={`tx-filter-cat ${filters.cats.includes(c.id) ? 'active' : ''}`}>
                        <input type="checkbox" checked={filters.cats.includes(c.id)} onChange={() => toggleInList('cats', c.id)}/>
                        <span className="tx-filter-cat-icon">{c.icon}</span>
                        <span className="tx-filter-cat-name">{c.name}</span>
                        <span className="tx-filter-cat-count">{catCounts[c.id] || 0}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="tx-filter-section">
                <div className="tx-filter-label">Tags</div>
                <div className="tx-filter-tags">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      className={`tx-filter-tag ${filters.tags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleInList('tags', tag)}
                    >
                      #{tag} <span className="tx-filter-tag-count">{tagCounts[tag] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="tx-filter-panel-footer">
              <button className="secondary-btn" onClick={resetFilters}>
                <RotateCcw size={13}/> Réinitialiser
              </button>
              <button className="primary-btn" onClick={() => setShowPanel(false)}>
                Voir {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {availableMonths.length > 0 && (
        <div className="tx-month-bar">
          <button
            className={`tx-month-chip ${!filters.month ? 'active' : ''}`}
            onClick={() => setField('month', '')}
          >Tous</button>
          {availableMonths.slice(0, 18).map(m => (
            <button
              key={m}
              className={`tx-month-chip ${filters.month === m ? 'active' : ''}`}
              onClick={() => setField('month', filters.month === m ? '' : m)}
            >
              {new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(m + '-02'))}
            </button>
          ))}
        </div>
      )}

      <div className="tx-table">
        <div className="tx-header">
          {/* Date — filter: range from/to */}
          <div className="th sortable" onClick={() => toggleSort('date')}>
            Date <ArrowUpDown size={12}/>
            <HeaderFilter
              active={!!filters.dateFrom || !!filters.dateTo}
              onReset={() => { setField('dateFrom', ''); setField('dateTo', ''); }}
            >
              {() => (
                <div className="th-filter-section">
                  <label className="th-filter-row">
                    <span>Du</span>
                    <input type="date" value={filters.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)}/>
                  </label>
                  <label className="th-filter-row">
                    <span>Au</span>
                    <input type="date" value={filters.dateTo} onChange={(e) => setField('dateTo', e.target.value)}/>
                  </label>
                </div>
              )}
            </HeaderFilter>
          </div>
          {/* Libellé — keeps the top-bar search; no column filter */}
          <div className="th sortable" onClick={() => toggleSort('label')}>Libellé <ArrowUpDown size={12}/></div>
          {/* Catégorie — multi-select top-levels */}
          <div className="th">
            Catégorie
            <HeaderFilter
              active={filters.cats.some(id => {
                const c = categories.find(x => x.id === id);
                return c && !c.parent;
              })}
              onReset={() => {
                const sub = filters.cats.filter(id => { const c = categories.find(x => x.id === id); return c && c.parent; });
                setField('cats', sub);
              }}
            >
              {() => (
                <div className="th-filter-section">
                  <input
                    className="th-filter-search"
                    placeholder="Filtrer…"
                    value={catFilterSearch}
                    onChange={e => setCatFilterSearch(e.target.value)}
                  />
                  {categories.filter(c => !c.parent && c.id !== 'uncategorized' && (catFilterSearch === '' || c.name.toLowerCase().includes(catFilterSearch))).map(c => (
                    <label key={c.id} className={`th-filter-chk ${filters.cats.includes(c.id) ? 'active' : ''}`}>
                      <input type="checkbox" checked={filters.cats.includes(c.id)} onChange={() => toggleInList('cats', c.id)}/>
                      <span className="th-filter-chk-icon">{c.icon}</span>
                      <span>{c.name}</span>
                      <span className="th-filter-chk-count">{catCounts[c.id] || 0}</span>
                    </label>
                  ))}
                </div>
              )}
            </HeaderFilter>
          </div>
          {/* Détail — multi-select sub-cats */}
          <div className="th">
            Détail
            <HeaderFilter
              active={filters.cats.some(id => {
                const c = categories.find(x => x.id === id);
                return c && c.parent;
              })}
              onReset={() => {
                const top = filters.cats.filter(id => { const c = categories.find(x => x.id === id); return c && !c.parent; });
                setField('cats', top);
              }}
            >
              {() => {
                const subs = categories.filter(c => c.parent && (catFilterSearch === '' || c.name.toLowerCase().includes(catFilterSearch)));
                // Group by parent for clarity
                const byParent = new Map();
                subs.forEach(s => {
                  const p = categories.find(c => c.id === s.parent);
                  if (!p) return;
                  if (!byParent.has(p.id)) byParent.set(p.id, { parent: p, subs: [] });
                  byParent.get(p.id).subs.push(s);
                });
                return (
                  <div className="th-filter-section">
                    <input
                      className="th-filter-search"
                      placeholder="Filtrer…"
                      value={catFilterSearch}
                      onChange={e => setCatFilterSearch(e.target.value)}
                    />
                    {[...byParent.values()].map(({ parent, subs }) => (
                      <div key={parent.id}>
                        <div className="th-filter-group">{parent.icon} {parent.name}</div>
                        {subs.map(s => (
                          <label key={s.id} className={`th-filter-chk ${filters.cats.includes(s.id) ? 'active' : ''}`}>
                            <input type="checkbox" checked={filters.cats.includes(s.id)} onChange={() => toggleInList('cats', s.id)}/>
                            <span className="th-filter-chk-icon">{s.icon}</span>
                            <span>{s.name}</span>
                            <span className="th-filter-chk-count">{catCounts[s.id] || 0}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              }}
            </HeaderFilter>
          </div>
          {/* Compte — multi-select */}
          <div className="th">
            Compte
            <HeaderFilter
              active={filters.accs.length > 0}
              onReset={() => setField('accs', [])}
            >
              {() => (
                <div className="th-filter-section">
                  {accounts.map(a => (
                    <label key={a.id} className={`th-filter-chk ${filters.accs.includes(a.id) ? 'active' : ''}`}>
                      <input type="checkbox" checked={filters.accs.includes(a.id)} onChange={() => toggleInList('accs', a.id)}/>
                      <span>{a.bank} — {a.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </HeaderFilter>
          </div>
          {/* Montant — type radio + min/max range */}
          <div className="th right sortable" onClick={() => toggleSort('amount')}>
            Montant <ArrowUpDown size={12}/>
            <HeaderFilter
              align="right"
              active={filters.type !== 'all' || filters.amountMin !== '' || filters.amountMax !== ''}
              onReset={() => { setField('type', 'all'); setField('amountMin', ''); setField('amountMax', ''); }}
            >
              {() => (
                <div className="th-filter-section">
                  <div className="th-filter-segmented">
                    {[['all', 'Tout'], ['income', 'Recettes'], ['expense', 'Dépenses']].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`th-filter-seg ${filters.type === id ? 'active' : ''}`}
                        onClick={() => setField('type', id)}
                      >{label}</button>
                    ))}
                  </div>
                  <label className="th-filter-row">
                    <span>Min €</span>
                    <input type="number" value={filters.amountMin} onChange={e => setField('amountMin', e.target.value)} placeholder="0"/>
                  </label>
                  <label className="th-filter-row">
                    <span>Max €</span>
                    <input type="number" value={filters.amountMax} onChange={e => setField('amountMax', e.target.value)} placeholder="∞"/>
                  </label>
                </div>
              )}
            </HeaderFilter>
          </div>
          <div className="th"></div>
        </div>
        <div className="tx-body">
          {filtered.slice(0, 200).map(tx => {
            const cat = categories.find(c => c.id === tx.categoryId);
            const acc = accounts.find(a => a.id === tx.accountId);
            const isRecurring = recurringIds.has(tx.id);
            const isTransfer = transferIds.has(tx.id);
            return (
              <div key={tx.id} className={`tx-row ${isTransfer ? 'tx-row-transfer' : ''}`}>
                <div className="td td-date">{formatDate(tx.date)}</div>
                <div className="td td-label" data-tooltip={tx.label || 'Sans libellé'}>
                  <span className="td-label-text">{tx.label || 'Sans libellé'}</span>
                  {isTransfer && (
                    <button
                      className="tx-transfer-badge"
                      onClick={() => setTransferOverride && setTransferOverride(tx.id, false)}
                      title="Transfert détecté — clic pour marquer comme transaction normale"
                    >↔ Transfert</button>
                  )}
                  {!isTransfer && setTransferOverride && (
                    <button
                      className="tx-transfer-toggle"
                      onClick={() => setTransferOverride(tx.id, true)}
                      title="Marquer cette transaction comme transfert interne (l'exclure du cashflow)"
                    >↔</button>
                  )}
                  <button className={`recurring-toggle ${isRecurring ? 'active' : ''}`} onClick={() => toggleRecurring(tx.id, !isRecurring)} title={isRecurring ? 'Marquer comme non-récurrent' : 'Marquer comme récurrent'}>
                    <Repeat size={11}/>
                  </button>
                  {updateTags && (
                    <TxTagsInline tags={tx.tags || []} onChange={(next) => updateTags(tx.id, next)}/>
                  )}
                </div>
                <div className="td td-cat" style={{ position: 'relative' }}>
                  {editingTx === tx.id ? (
                    <CatPicker
                      categories={categories}
                      currentId={tx.categoryId}
                      onSelect={(catId) => { updateCategory(tx.id, catId); }}
                      onClose={() => setEditingTx(null)}
                    />
                  ) : isTransfer ? (
                    <button className="cat-pill" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }} onClick={() => setEditingTx(tx.id)} title="Cliquez pour catégoriser malgré tout">
                      ↔ Virement interne
                    </button>
                  ) : (() => {
                    // Top-level category (parent if cat is a sub, else itself).
                    const topCat = cat?.parent ? categories.find(c => c.id === cat.parent) : cat;
                    const display = topCat || cat;
                    return (
                      <button className="cat-pill" style={{ background: (display?.color || '#999') + '1f', color: display?.color || '#666' }} onClick={() => setEditingTx(tx.id)}>
                        {display?.icon} {display?.name || 'Non catégorisé'}
                      </button>
                    );
                  })()}
                </div>
                <div className="td td-subcat" style={{ position: 'relative' }}>
                  {(() => {
                    if (isTransfer) return <span className="cat-pill-empty">—</span>;
                    if (!cat) return <span className="cat-pill-empty">—</span>;
                    // Determine which top-level the picker should scope to.
                    const topSlug = cat.parent || cat.id;
                    if (editingSubcat === tx.id) {
                      return (
                        <SubCatPicker
                          categories={categories}
                          topSlug={topSlug}
                          currentId={cat.id}
                          onSelect={(catId) => { updateCategory(tx.id, catId); }}
                          onClose={() => setEditingSubcat(null)}
                        />
                      );
                    }
                    if (cat.parent) {
                      return (
                        <button className="cat-pill cat-pill-sub" onClick={() => setEditingSubcat(tx.id)} title={`Détail · cliquer pour changer`}>
                          {cat.icon} {cat.name}
                        </button>
                      );
                    }
                    // Top-level cat, no sub yet — show "+ détail" hint button
                    const hasSubs = categories.some(c => c.parent === cat.id);
                    return hasSubs ? (
                      <button className="cat-pill-add-sub" onClick={() => setEditingSubcat(tx.id)} title="Ajouter un détail">
                        + détail
                      </button>
                    ) : <span className="cat-pill-empty">—</span>;
                  })()}
                </div>
                <div className="td td-acc">{acc?.name || '—'}</div>
                <div className={`td td-amount right ${tx.amount >= 0 ? 'positive' : ''}`}>{fmt(tx.amount, { sign: true })}</div>
                <div className="td td-actions">
                  <button className="icon-btn-sm" onClick={() => deleteTransaction(tx.id)}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length > 200 && <div className="tx-more">+ {filtered.length - 200} transactions (affinez les filtres)</div>}
      </div>
    </div>
  );
}
