// ============================================================================
// Transactions — searchable + multi-filterable + sortable list
//
// Filter panel is collapsible. The compact bar shows search + a Filtres button
// (with active-filter count badge) + reset; expanded panel adds multi-select
// catégories / comptes / membres, date range, amount range, and tx type.
// ============================================================================
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, ArrowUpDown, Repeat, Trash2, Filter, X, RotateCcw, Sparkles, Plus, Download, ArrowLeftRight, PiggyBank, CreditCard, Inbox, FilterX, Copy, CircleHelp, CheckCircle2 } from 'lucide-react';
import { formatDate, getTransferType, getTransferDestAccountId, buildTransferDestTag, ACCOUNT_ROLES } from '../utils.js';
import { gsap } from '../utils/gsapSetup.js';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { SyncButton } from '../components/SyncButton.jsx';
import { AddTransactionModal } from '../components/AddTransactionModal.jsx';
import { gsap as gsapTx } from '../utils/gsapSetup.js';
import { useIsNarrow } from '../hooks/useIsNarrow.js';
import { needsTransactionReview } from '../components/ActionCenter.jsx';

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

const isUnclassifiedTransaction = (tx, transferIds = new Set()) => Boolean(
  tx && !transferIds.has(tx.id) && (!tx.categoryId || tx.categoryId === 'uncategorized')
);

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

  // GSAP entry
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(ref.current, { opacity: 1 });
      return;
    }
    gsap.fromTo(ref.current,
      { opacity: 0, scale: 0.96, y: -6 },
      { opacity: 1, scale: 1, y: 0, duration: 0.24, ease: 'power3.out' }
    );
  }, []);

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

  // GSAP entry : scale + fade in (premium feel)
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(ref.current, { opacity: 1 });
      return;
    }
    gsap.fromTo(ref.current,
      { opacity: 0, scale: 0.96, y: -6 },
      { opacity: 1, scale: 1, y: 0, duration: 0.24, ease: 'power3.out' }
    );
  }, []);

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

// TxFilterPanel — wrapper avec GSAP scale+fade entry (desktop) ou slide-up
// (mobile bottom-sheet). Pas de framer-motion ici.
function TxFilterPanel({ children, onClose }) {
  const ref = useRef(null);
  const isMobile = useIsNarrow(640);

  useLayoutEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(ref.current, { opacity: 1 });
      return;
    }
    if (isMobile) {
      // Bottom-sheet: slide up from bottom
      gsap.fromTo(ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' }
      );
    } else {
      // Desktop: scale+fade from top-right
      gsap.fromTo(ref.current,
        { opacity: 0, scale: 0.97, y: -8 },
        { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power3.out' }
      );
    }
  }, [isMobile]);
  // ESC pour fermer
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="tx-filter-panel"
      style={{ transformOrigin: isMobile ? 'bottom center' : 'top right', opacity: 0 }}
    >
      {children}
    </div>
  );
}

export function Transactions({ transactions, accounts, categories, members = [], customRules = [], recurringIds, toggleRecurring, transferIds = new Set(), setTransferOverride, updateCategory, updateTags, deleteTransaction, createTransaction, fmt, initialAccountFilter, onConsumeInitialFilter, onCategorizeAI, aiCatRunning = false, aiCatSummary = null, onOpenAiPrompt, onAfterSync, initialReviewMode, onConsumeInitialReviewMode, onMarkReviewed }) {
  const { t } = useTranslation();
  const latestTransactionMonth = transactions.reduce((latest, tx) => {
    const month = tx.date?.slice(0, 7) || '';
    return month > latest ? month : latest;
  }, '');
  const [search, setSearch] = useState('');
  const [showAddTx, setShowAddTx] = useState(false);
  // Seed the account filter on mount if the parent passed one (e.g. coming
  // from the AccountDrawer "voir toutes les transactions" CTA).
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    month: initialReviewMode ? '' : latestTransactionMonth,
    accs: initialAccountFilter ? [initialAccountFilter] : [],
  }));
  const [showPanel, setShowPanel] = useState(false);
  const [catFilterSearch, setCatFilterSearch] = useState('');
  const [reviewMode, setReviewMode] = useState(() => initialReviewMode === 'review'
    ? (transactions.some(tx => isUnclassifiedTransaction(tx, transferIds)) ? 'unclassified' : 'confirm')
    : (initialReviewMode || 'all'));

  // GSAP page-enter — fade-in du header + filtres + premieres rows
  // (sprint 2026-05-20). Cap a 20 rows pour eviter 200 anims simultanees.
  const txRef = useRef(null);
  useEffect(() => {
    if (!txRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsapTx.context(() => {
      gsapTx.fromTo(
        ['.subview-header', '.filters-bar', '.tx-sort-bar'],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'expo.out', stagger: 0.05, clearProps: 'transform' }
      );
      gsapTx.fromTo(
        '.tx-row',
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.26, ease: 'power2.out', stagger: 0.018, delay: 0.18, clearProps: 'transform' }
      );
    }, txRef);
    return () => ctx.revert();
  }, []);
  useEffect(() => {
    if (!initialReviewMode) return;
    setReviewMode(initialReviewMode === 'review'
      ? (transactions.some(tx => isUnclassifiedTransaction(tx, transferIds)) ? 'unclassified' : 'confirm')
      : initialReviewMode);
    onConsumeInitialReviewMode?.();
  }, [initialReviewMode, onConsumeInitialReviewMode, transactions, transferIds]);

  // Consume the initial filter so it doesn't re-apply on subsequent navigations
  // back to this view.
  useEffect(() => {
    if (initialAccountFilter && onConsumeInitialFilter) onConsumeInitialFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [editingTx, setEditingTx] = useState(null);
  // Popover "marquer comme virement interne" : { txId, anchorRect } | null
  const [transferPickerTx, setTransferPickerTx] = useState(null);
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

  // Effective category for a transaction: transfers (auto-detected or manual override)
  // are treated as 'transfer', regardless of their stored categoryId.
  const effectiveCatId = (tx) =>
    transferIds.has(tx.id) ? 'transfer' : (tx.categoryId || 'uncategorized');

  // Per-category transaction counts (shown next to each checkbox in the panel).
  // A transaction with a sub-category (e.g. resto_meal) is also counted under
  // its parent (restaurants), so the filter count reflects all children too.
  const catCounts = useMemo(() => {
    const c = {};
    transactions.forEach(tx => {
      const id = transferIds.has(tx.id) ? 'transfer' : (tx.categoryId || 'uncategorized');
      c[id] = (c[id] || 0) + 1;
      const cat = categories.find(cat => cat.id === id);
      if (cat?.parent) c[cat.parent] = (c[cat.parent] || 0) + 1;
    });
    return c;
  }, [transactions, categories, transferIds]);

  const uncategorizedCount = useMemo(() => transactions.filter(tx =>
    isUnclassifiedTransaction(tx, transferIds) &&
    (tx.label || '').trim()
  ).length, [transactions, transferIds]);

  const reviewCounts = useMemo(() => {
    const counts = { all: transactions.length, unclassified: 0, confirm: 0, auto: 0, reviewed: 0 };
    transactions.forEach(tx => {
      if (isUnclassifiedTransaction(tx, transferIds)) counts.unclassified += 1;
      else if (needsTransactionReview(tx, transferIds)) counts.confirm += 1;
      else if (tx.reviewStatus === 'reviewed' || tx.isManualCategory) counts.reviewed += 1;
      else counts.auto += 1;
    });
    return counts;
  }, [transactions, transferIds]);
  const reviewableIds = useMemo(() => transactions.filter(tx =>
    !isUnclassifiedTransaction(tx, transferIds)
    && needsTransactionReview(tx, transferIds)
    && tx.categoryId
    && tx.categoryId !== 'uncategorized'
  ).map(tx => tx.id), [transactions, transferIds]);

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

  // Pre-index category names (top + parent) by slug, lowercased — used so the
  // search bar also matches when the user types a category name (e.g.
  // "Carburant") instead of just the raw bank label.
  const catSearchIndex = useMemo(() => {
    const m = {};
    categories.forEach(c => {
      const parent = c.parent ? categories.find(p => p.id === c.parent) : null;
      const tokens = [c.name];
      if (parent) tokens.push(parent.name);
      m[c.id] = tokens.join(' ').toLowerCase();
    });
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const min = filters.amountMin === '' ? null : parseFloat(filters.amountMin);
    const max = filters.amountMax === '' ? null : parseFloat(filters.amountMax);
    return transactions
      .filter(tx => {
        const needsReview = needsTransactionReview(tx, transferIds);
        const isUnclassified = isUnclassifiedTransaction(tx, transferIds);
        if (reviewMode === 'review' && !isUnclassified && !needsReview) return false;
        if (reviewMode === 'unclassified' && !isUnclassified) return false;
        if (reviewMode === 'confirm' && (isUnclassified || !needsReview)) return false;
        if (reviewMode === 'reviewed' && (isUnclassified || needsReview || (tx.reviewStatus !== 'reviewed' && !tx.isManualCategory))) return false;
        if (reviewMode === 'auto' && (isUnclassified || needsReview || tx.reviewStatus === 'reviewed' || tx.isManualCategory)) return false;
        if (q) {
          const labelHit = (tx.label || '').toLowerCase().includes(q);
          const catHit = tx.categoryId ? (catSearchIndex[tx.categoryId] || '').includes(q) : false;
          if (!labelHit && !catHit) return false;
        }
        if (filters.cats.length > 0) {
          const txCatId = effectiveCatId(tx);
          const txCat = categories.find(c => c.id === txCatId);
          const matches = filters.cats.some(filterId => {
            if (filterId === txCatId) return true;
            // a top-level (no parent) filter selection also matches its children
            const filterCat = categories.find(c => c.id === filterId);
            return !filterCat?.parent && txCat?.parent === filterId;
          });
          if (!matches) return false;
        }
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
  }, [transactions, search, filters, sortKey, sortDir, accountMembers, catSearchIndex, transferIds, reviewMode]);

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
  const resetFilters = () => {
    setFilters({ ...EMPTY_FILTERS, month: latestTransactionMonth });
    setSearch('');
  };

  // Les compteurs de la boîte de classement portent sur tout l'historique.
  // Quand on ouvre « À classer » / « À confirmer », on retire donc les
  // filtres de période et de recherche : auparavant le badge annonçait 1
  // opération mais juillet restait sélectionné, ce qui affichait une liste
  // vide si l'opération se trouvait en avril.
  const selectReviewMode = (mode) => {
    setReviewMode(mode);
    setSearch('');
    setFilters({
      ...EMPTY_FILTERS,
      month: mode === 'all' ? latestTransactionMonth : '',
    });
  };

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
    (filters.type !== 'all' ? 1 : 0);

  const catSearchQ = catFilterSearch.toLowerCase();
  const expenseCats = categories.filter(c => c.type === 'expense' && (catSearchQ === '' || c.name.toLowerCase().includes(catSearchQ)));
  const incomeCats = categories.filter(c => c.type === 'income' && (catSearchQ === '' || c.name.toLowerCase().includes(catSearchQ)));
  const transferCat = categories.find(c => c.id === 'transfer');
  const transferCatVisible = (catSearchQ === '' || 'virements internes'.includes(catSearchQ)) && (catCounts['transfer'] || 0) > 0;

  const exportCsv = () => {
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Date', 'Libellé', 'Payee', 'Montant', 'Catégorie', 'Sous-catégorie', 'Source', 'Compte'];
    const rows = filtered.map(tx => {
      const effCat = effectiveCatId(tx);
      const cat = categories.find(c => c.id === effCat);
      const parentCat = cat?.parent ? categories.find(c => c.id === cat.parent) : null;
      const acc = accounts.find(a => a.id === tx.accountId);
      return [
        tx.date,
        tx.label || '',
        tx.payeeName || '',
        tx.amount,
        parentCat ? parentCat.name : (cat?.name || effCat),
        parentCat ? cat.name : '',
        tx.catSource || '',
        acc?.name || '',
      ].map(escape).join(',');
    });
    const csv = [header.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yotori-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="transactions-view" ref={txRef}>
      <div className="subview-header">
        <div>
          <h1>{t('views.transactions.title')} <em>{t('views.transactions.titleAccent')}</em></h1>
          <p>{t('views.transactions.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SyncButton onAfterSync={onAfterSync}/>
          {createTransaction && (
            <button
              className="ds-btn ghost tx-hdr-btn"
              onClick={() => setShowAddTx(true)}
              title="Saisir une transaction à la main (comptes manuels, espèces, oubli de sync…)"
              disabled={accounts.length === 0}
            >
              <Plus size={14}/> <span className="tx-hdr-label">Ajouter</span>
            </button>
          )}
          <button className="ds-btn ghost tx-hdr-btn" onClick={exportCsv} title={`Exporter les ${filtered.length} transactions visibles en CSV`}>
            <Download size={14}/> <span className="tx-hdr-label">Export CSV</span>
          </button>
        </div>
      </div>

      {(reviewCounts.unclassified > 0 || reviewCounts.confirm > 0 || reviewMode !== 'all') && (
      <div className="tx-inbox-tabs" role="tablist" aria-label="État de classement">
        {[
          ['all', 'Toutes'],
          ...(reviewCounts.unclassified > 0 || reviewMode === 'unclassified' ? [['unclassified', 'À classer']] : []),
          ...(reviewCounts.confirm > 0 || reviewMode === 'confirm' ? [['confirm', 'À confirmer']] : []),
          ...(reviewMode === 'auto' ? [['auto', 'Automatiques']] : []),
          ...(reviewMode === 'reviewed' ? [['reviewed', 'Validées']] : []),
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={reviewMode === id} className={reviewMode === id ? 'is-active' : ''} onClick={() => selectReviewMode(id)}>
            <span>{label}</span>{id !== 'all' && <strong>{reviewCounts[id]}</strong>}
          </button>
        ))}
        {reviewMode === 'confirm' && reviewableIds.length > 0 && onMarkReviewed && (
          <button className="tx-inbox-validate" onClick={() => onMarkReviewed(reviewableIds)}>
            <CheckCircle2 size={13}/> Tout valider ({reviewableIds.length})
          </button>
        )}
      </div>
      )}

      {(uncategorizedCount > 0 || reviewCounts.confirm > 0 || aiCatSummary) && (
        <section className={`ai-review-card ${aiCatSummary?.status || 'idle'}`} aria-live="polite">
          <div className="ai-review-icon">
            {uncategorizedCount === 0 && reviewCounts.confirm === 0
              ? <CheckCircle2 size={20}/>
              : <CircleHelp size={20}/>
            }
          </div>
          <div className="ai-review-main">
            <div className="ai-review-heading">
              <strong>
                {aiCatRunning
                  ? aiCatSummary?.phase || 'Analyse en cours'
                  : uncategorizedCount > 0
                    ? `${uncategorizedCount} opération${uncategorizedCount > 1 ? 's' : ''} à éclaircir`
                    : reviewCounts.confirm > 0
                      ? `${reviewCounts.confirm} proposition${reviewCounts.confirm > 1 ? 's' : ''} à confirmer`
                    : 'Toutes les opérations sont classées'}
              </strong>
              {aiCatSummary?.status === 'done' && aiCatSummary.categorized > 0 && (
                <span className="ai-review-success">{aiCatSummary.categorized} classée{aiCatSummary.categorized > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="ai-review-breakdown" aria-label="État du classement">
              <button type="button" onClick={() => selectReviewMode('unclassified')}>
                <strong>{reviewCounts.unclassified}</strong><span>à classer</span>
              </button>
              <button type="button" onClick={() => selectReviewMode('confirm')}>
                <strong>{reviewCounts.confirm}</strong><span>à confirmer</span>
              </button>
              <button type="button" onClick={() => selectReviewMode('reviewed')}>
                <strong>{reviewCounts.reviewed}</strong><span>validées</span>
              </button>
            </div>
            <p>
              {aiCatRunning
                ? `Passe ${aiCatSummary?.phaseIndex || 1}/${aiCatSummary?.phaseCount || 2} · lot ${aiCatSummary?.currentBatch || 1}/${aiCatSummary?.batchCount || 1} · ${aiCatSummary?.phaseProcessed || 0}/${aiCatSummary?.phaseTotal || uncategorizedCount} examinées dans cette passe.`
                  : uncategorizedCount > 0
                  ? aiCatSummary?.status === 'done'
                    ? `Les restantes ont résisté aux règles et aux deux passes IA : libellé trop générique, marchand inconnu ou virement ambigu. Elles restent visibles et modifiables — rien n'est masqué.`
                    : `Une première passe classe les marchands connus. Une seconde passe plus minutieuse reprend automatiquement les cas ambigus. Les derniers cas restent dans une file à vérifier.`
                  : reviewCounts.confirm > 0
                    ? `Les catégories sont déjà appliquées. Confirme toutes les propositions en une seule fois, ou corrige uniquement celles qui te semblent douteuses.`
                  : `La boîte « À vérifier » est vide. Les corrections manuelles continueront d'améliorer les règles du foyer.`}
            </p>
            {aiCatSummary?.diagnostic && (
              <div className="ai-review-diagnostic">L’analyse automatique est momentanément indisponible. Les opérations restent modifiables et pourront être relancées.</div>
            )}
            {aiCatRunning && (
              <div className="ai-review-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(aiCatSummary?.progress || 0)}>
                <span style={{ width: `${Math.min(100, aiCatSummary?.progress || 0)}%` }}/>
              </div>
            )}
          </div>
          <div className="ai-review-actions">
            {reviewCounts.confirm > 0 && onMarkReviewed && (
              <button className="ds-btn primary" onClick={() => onMarkReviewed(reviewableIds)} disabled={aiCatRunning}>
                <CheckCircle2 size={14}/> Valider les {reviewCounts.confirm} proposition{reviewCounts.confirm > 1 ? 's' : ''}
              </button>
            )}
            {uncategorizedCount > 0 && onCategorizeAI && (
              <button className={`ds-btn ${reviewCounts.confirm > 0 ? 'ghost' : 'primary'}`} onClick={onCategorizeAI} disabled={aiCatRunning}>
                <Sparkles size={14}/>
                {aiCatRunning ? 'Analyse en cours…' : aiCatSummary?.status === 'done' ? `Retenter les ${uncategorizedCount}` : `Analyser les ${uncategorizedCount}`}
              </button>
            )}
            {uncategorizedCount > 0 && (
              <button
                className="ds-btn ghost"
                onClick={() => selectReviewMode('unclassified')}
              >
                Classer manuellement
              </button>
            )}
            {uncategorizedCount > 0 && onOpenAiPrompt && (
              <button className="ds-btn ghost" onClick={onOpenAiPrompt} disabled={aiCatRunning} title="Méthode sans clé API">
                <Copy size={14}/> Méthode sans clé
              </button>
            )}
          </div>
        </section>
      )}

      <div className="filters-bar" ref={panelRef}>
        <div className={`search-box ${search ? 'has-value' : ''}`}>
          <Search size={16}/>
          <input placeholder={t('views.transactions.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}/>
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch('')}
              title="Vider la recherche"
              aria-label="Vider la recherche"
            >
              <X size={13}/>
            </button>
          )}
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

        <span className="result-count">
          <strong className="num"><AnimatedNumber value={filtered.length} duration={0.4} format={(v) => Math.round(v).toString()}/></strong>
          {' '}transaction{filtered.length > 1 ? 's' : ''}
        </span>

        {/* Backdrop for filter panel on mobile — shows as bottom-sheet overlay */}
        {showPanel && <div className="tx-filter-overlay" onClick={() => setShowPanel(false)} />}

        {showPanel && (
          <TxFilterPanel onClose={() => setShowPanel(false)}>
            <div className="tx-filter-panel-header">
              <span>Filtres avancés</span>
              <button className="icon-btn-sm" onClick={() => setShowPanel(false)} aria-label="Fermer"><X size={14}/></button>
            </div>

            {/* 1. Type (segmented) — la ligne la plus visible */}
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

            {/* 2. Période + Montant cote-a-cote — economise une rangee */}
            <div className="tx-filter-grid-2col">
              <div className="tx-filter-section">
                <div className="tx-filter-label">Période</div>
                <div className="tx-filter-row-2">
                  <input type="date" value={filters.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)} aria-label="Date de début"/>
                  <input type="date" value={filters.dateTo} onChange={(e) => setField('dateTo', e.target.value)} aria-label="Date de fin"/>
                </div>
              </div>
              <div className="tx-filter-section">
                <div className="tx-filter-label">Montant (€)</div>
                <div className="tx-filter-row-2">
                  <input type="number" placeholder="min" value={filters.amountMin} onChange={(e) => setField('amountMin', e.target.value)} min="0" step="0.01"/>
                  <input type="number" placeholder="max" value={filters.amountMax} onChange={(e) => setField('amountMax', e.target.value)} min="0" step="0.01"/>
                </div>
              </div>
            </div>

            {/* 3. Catégories — chips horizontaux, type indique par couleur du dot
                Le filtre Type au-dessus deja exprime revenus/depenses, donc les
                sous-headers sont redondants. Une seule liste compacte. */}
            <div className="tx-filter-section">
              <div className="tx-filter-section-head">
                <div className="tx-filter-label">Catégories</div>
                <input
                  className="tx-filter-search-input"
                  placeholder="Rechercher…"
                  value={catFilterSearch}
                  onChange={e => setCatFilterSearch(e.target.value)}
                />
              </div>
              <div className="tx-filter-cat-chips">
                {transferCatVisible && transferCat && (
                  <button
                    key="transfer"
                    className={`tx-filter-cat-chip ${filters.cats.includes('transfer') ? 'active' : ''}`}
                    onClick={() => toggleInList('cats', 'transfer')}
                  >
                    <span className="tx-filter-cat-chip-icon">{transferCat.icon}</span>
                    {transferCat.name}
                    <span className="tx-filter-cat-chip-count">{catCounts['transfer'] || 0}</span>
                  </button>
                )}
                {[...incomeCats, ...expenseCats].map(c => (
                  <button
                    key={c.id}
                    className={`tx-filter-cat-chip ${filters.cats.includes(c.id) ? 'active' : ''} ${c.type === 'income' ? 'is-income' : ''}`}
                    onClick={() => toggleInList('cats', c.id)}
                  >
                    <span className="tx-filter-cat-chip-icon">{c.icon}</span>
                    {c.name}
                    <span className="tx-filter-cat-chip-count">{catCounts[c.id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Comptes + Membres — chips compactes */}
            {(accounts.length > 0 || members.length > 1) && (
              <div className="tx-filter-grid-2col">
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
                {members.length > 1 && (
                  <div className="tx-filter-section">
                    <div className="tx-filter-label">Membres</div>
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
              </div>
            )}

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
              <button className="ds-btn" onClick={resetFilters}>
                <RotateCcw size={13}/> Réinitialiser
              </button>
              <button className="ds-btn primary" onClick={() => setShowPanel(false)}>
                Voir {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </button>
            </div>
          </TxFilterPanel>
        )}
      </div>

      {/* Active filter chips — shows what's filtering so the badge count makes sense */}
      {activeCount > 0 && (
        <div className="tx-active-chips">
          {filters.cats.map(catId => {
            const cat = categories.find(c => c.id === catId);
            return cat ? (
              <button key={catId} className="tx-active-chip" onClick={() => toggleInList('cats', catId)}>
                {cat.icon} {cat.name} <X size={11}/>
              </button>
            ) : null;
          })}
          {filters.type !== 'all' && (
            <button className="tx-active-chip" onClick={() => setField('type', 'all')}>
              {filters.type === 'income' ? 'Revenus' : 'Dépenses'} <X size={11}/>
            </button>
          )}
          {filters.accs.map(accId => {
            const acc = accounts.find(a => a.id === accId);
            return acc ? (
              <button key={accId} className="tx-active-chip" onClick={() => toggleInList('accs', accId)}>
                {acc.name} <X size={11}/>
              </button>
            ) : null;
          })}
          {filters.members.map(mId => {
            const m = members.find(x => x.id === mId);
            return m ? (
              <button key={mId} className="tx-active-chip" onClick={() => toggleInList('members', mId)}>
                {m.name} <X size={11}/>
              </button>
            ) : null;
          })}
          {(filters.dateFrom || filters.dateTo) && (
            <button className="tx-active-chip" onClick={() => { setField('dateFrom', ''); setField('dateTo', ''); }}>
              {filters.dateFrom || '…'} → {filters.dateTo || '…'} <X size={11}/>
            </button>
          )}
          {(filters.amountMin !== '' || filters.amountMax !== '') && (
            <button className="tx-active-chip" onClick={() => { setField('amountMin', ''); setField('amountMax', ''); }}>
              {filters.amountMin !== '' ? `≥ ${filters.amountMin}€` : ''}{filters.amountMin !== '' && filters.amountMax !== '' ? ' ' : ''}{filters.amountMax !== '' ? `≤ ${filters.amountMax}€` : ''} <X size={11}/>
            </button>
          )}
          {filters.tags.map(tag => (
            <button key={tag} className="tx-active-chip" onClick={() => toggleInList('tags', tag)}>
              #{tag} <X size={11}/>
            </button>
          ))}
        </div>
      )}

      {availableMonths.length > 0 && (
        <div className="tx-month-bar">
          {availableMonths.slice(0, 18).map(m => (
            <button
              key={m}
              className={`tx-month-chip ${filters.month === m ? 'active' : ''}`}
              onClick={() => setField('month', m)}
            >
              {new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(m + '-02'))}
            </button>
          ))}
          <button
            className={`tx-month-chip ${!filters.month ? 'active' : ''}`}
            onClick={() => setField('month', '')}
          >Tout l’historique</button>
        </div>
      )}

      {/* Shared datalist for tx tag autocomplete — populated with every tag
          already in use across the household. The id is referenced by each
          TxTagsInline input via list="tx-tag-suggestions". */}
      <datalist id="tx-tag-suggestions">
        {allTags.map(tag => <option key={tag} value={tag}/>)}
      </datalist>

      {/* Période totals — somme nette de la période/filtres actuels.
          Exclut les virements internes (PRELEVEMENT AUTOMATIQUE Amex,
          DÉPENSE ÉCHELONNÉE pairs, top-ups Revolut, etc.) pour donner
          la VRAIE dépense / vrai revenu de la période. */}
      {(() => {
        let inc = 0, exp = 0, txfCount = 0, txfTotal = 0;
        for (const tx of filtered) {
          if (transferIds.has(tx.id)) {
            txfCount++;
            txfTotal += Math.abs(tx.amount || 0);
            continue;
          }
          if (tx.amount > 0) inc += tx.amount;
          else exp += Math.abs(tx.amount);
        }
        const net = inc - exp;
        const monthLabel = filters.month
          ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(filters.month + '-02'))
          : 'toute la période';
        return (
          <div className="tx-period-summary">
            <div className="tx-period-summary-head">
              <span className="tx-period-summary-label">Total sur {monthLabel}</span>
              <span className="tx-period-summary-count">{filtered.length} tx</span>
            </div>
            <div className="tx-period-summary-row">
              <div className="tx-period-stat">
                <span className="tx-period-stat-label">Revenus</span>
                <span className="tx-period-stat-value num positive">+{fmt(inc)}</span>
              </div>
              <div className="tx-period-stat">
                <span className="tx-period-stat-label">Dépenses</span>
                <span className="tx-period-stat-value num negative">-{fmt(exp)}</span>
              </div>
              <div className="tx-period-stat">
                <span className="tx-period-stat-label">Solde net</span>
                <span className={`tx-period-stat-value num ${net >= 0 ? 'positive' : 'negative'}`}>
                  {net >= 0 ? '+' : ''}{fmt(net)}
                </span>
              </div>
              {txfCount > 0 && (
                <div className="tx-period-stat transfers">
                  <span className="tx-period-stat-label">↔ Virements internes <span className="muted">(exclus)</span></span>
                  <span className="tx-period-stat-value num neutral">{txfCount} · {fmt(txfTotal)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sort toolbar */}
      <div className="tx-sort-bar">
        <span className="tx-sort-label">Afficher par</span>
        <select
          className="tx-sort-select"
          value={sortKey}
          onChange={(event) => {
            setSortKey(event.target.value);
            setSortDir('desc');
          }}
          aria-label="Trier les opérations"
        >
          <option value="date">Date</option>
          <option value="amount">Montant</option>
          <option value="label">Libellé</option>
        </select>
        <button className="tx-sort-direction" onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}>
          <ArrowUpDown size={12}/>
          {sortKey === 'date'
            ? (sortDir === 'desc' ? 'Plus récentes' : 'Plus anciennes')
            : (sortDir === 'desc' ? 'Décroissant' : 'Croissant')}
        </button>
        <span className="tx-sort-meta">{filtered.length} opération{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Day-grouped feed */}
      {(() => {
        const visible = filtered.slice(0, 200);
        if (visible.length === 0) {
          // Deux cas distincts : (1) le foyer n'a aucune transaction du tout,
          // (2) les filtres actifs ne renvoient rien. Le CTA change selon le cas.
          const isReallyEmpty = transactions.length === 0;
          if (isReallyEmpty) {
            // Foyer avec au moins un compte → la saisie manuelle est le chemin
            // le plus court (comptes manuels notamment). Sinon on oriente vers
            // l'import CSV / la connexion bancaire.
            const canAddManually = accounts.length > 0 && createTransaction;
            return (
              <EmptyState
                icon={Inbox}
                title={<>Aucune <em>transaction.</em></>}
                description={canAddManually
                  ? "Saisissez une transaction à la main, importez un relevé bancaire (CSV) ou connectez une banque via Open Banking."
                  : "Importez un relevé bancaire (CSV) ou connectez une banque via Open Banking pour voir vos mouvements ici."}
                cta={canAddManually
                  ? { label: 'Ajouter une transaction', icon: Plus, onClick: () => setShowAddTx(true) }
                  : { label: 'Importer un CSV', icon: Download, onClick: () => { window.location.hash = '#/settings'; } }}
              />
            );
          }
          return (
            <EmptyState
              icon={FilterX}
              tone="warning"
              compact
              title={<>Rien <em>à afficher.</em></>}
              description="Aucune transaction ne correspond à vos filtres actuels."
              cta={{ label: 'Réinitialiser les filtres', icon: RotateCcw, onClick: resetFilters }}
            />
          );
        }
        // Group by day while respecting current sort order. When sorted by
        // date, the natural order already puts days together. When sorted
        // differently (label/amount), each tx still lands in its day group
        // but groups may interleave — that's expected.
        const groups = [];
        const seenDay = new Map();
        for (const tx of visible) {
          let bucket = seenDay.get(tx.date);
          if (!bucket) {
            bucket = { date: tx.date, txs: [] };
            seenDay.set(tx.date, bucket);
            groups.push(bucket);
          }
          bucket.txs.push(tx);
        }

        const fmtDay = (iso) => {
          try {
            const d = new Date(iso + 'T00:00:00');
            return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
          } catch { return iso; }
        };

        return (
          <div className="tx-feed">
            {groups.map(({ date, txs }) => {
              const total = txs.reduce((s, t) => s + (t.amount || 0), 0);
              const totalCls = total > 0.005 ? 'positive' : total < -0.005 ? 'negative' : 'neutral';
              return (
                <section key={date} className="tx-day">
                  <header className="tx-day-head">
                    <span className="tx-day-label">{fmtDay(date)}</span>
                    <span className={`tx-day-total num ${totalCls}`}>
                      {total > 0 ? '+' : ''}{fmt(total)}
                    </span>
                  </header>
                  <div className="tx-day-rows">
                    {txs.map(tx => {
                      const cat = categories.find(c => c.id === tx.categoryId);
                      const acc = accounts.find(a => a.id === tx.accountId);
                      const isRecurring = recurringIds.has(tx.id);
                      const isTransfer = transferIds.has(tx.id);
                      const topCat = cat?.parent ? categories.find(c => c.id === cat.parent) : cat;
                      const display = topCat || cat;
                      const isUnclassified = isUnclassifiedTransaction(tx, transferIds);
                      const needsReview = isUnclassified || needsTransactionReview(tx, transferIds);
                      const tileBg = isTransfer ? 'var(--bg-sunk)' : ((display?.color || '#9ca3af') + '22');
                      const tileFg = isTransfer ? 'var(--ink-2)' : (display?.color || '#6b7280');
                      const amtCls = isTransfer ? 'transfer' : (tx.amount >= 0 ? 'positive' : 'negative');
                      return (
                        <div key={tx.id} className={`tx-card ${isTransfer ? 'tx-card-transfer' : ''} ${needsReview ? 'tx-card-needs-review' : ''}`}>
                          <button
                            className="tx-card-icon"
                            style={{ background: tileBg, color: tileFg }}
                            onClick={() => setEditingTx(tx.id)}
                            title="Changer la catégorie"
                          >
                            <span aria-hidden="true">{isTransfer ? '↔' : (display?.icon || '❓')}</span>
                          </button>
                          {editingTx === tx.id && (
                            <div className="tx-card-picker" ref={(el) => { if (el) el.dataset.txid = tx.id; }}>
                              <CatPicker
                                categories={categories}
                                currentId={tx.categoryId}
                                onSelect={(catId) => {
                                  // Interception : si l'utilisateur choisit
                                  // "Virement interne", on ouvre la popover
                                  // de destination au lieu d'appliquer direct.
                                  if (catId === 'transfer') {
                                    const pickerEl = document.querySelector(`.tx-card-picker[data-txid="${tx.id}"]`);
                                    const rect = pickerEl?.getBoundingClientRect();
                                    setEditingTx(null);
                                    setTransferPickerTx({ txId: tx.id, anchorRect: rect || { bottom: 0, left: 0 } });
                                  } else {
                                    updateCategory(tx.id, catId);
                                  }
                                }}
                                onClose={() => setEditingTx(null)}
                              />
                            </div>
                          )}
                          <div className="tx-card-label" data-tooltip={tx.label || 'Sans libellé'}>
                            <span className="tx-card-label-text">
                              {tx.label || 'Sans libellé'}
                              {tx.payeeName && <span className="tx-card-payee" title="Marchand canonique"> · {tx.payeeName}</span>}
                              {needsReview && (
                                <span
                                  className="tx-needs-review-badge"
                                  title={isUnclassified
                                    ? "Aucune catégorie suffisamment fiable n'a été trouvée."
                                    : 'Proposition automatique à confirmer.'}
                                >
                                  {isUnclassified ? 'À classer' : 'À confirmer'}
                                </span>
                              )}
                            </span>
                            {tx.catSource && tx.catSource !== 'unknown' && (
                              <span className={`tx-cat-source-dot src-${tx.catSource}`} title={({
                                'user_rule': 'Catégorisé via votre règle',
                                'payee_default': 'Catégorie par défaut du marchand',
                                'learned_rule': 'Règle apprise automatiquement',
                                'builtin_rule': 'Règle intégrée Yotori Finance',
                                'llm': 'Catégorisé par l\'IA',
                              })[tx.catSource]}/>
                            )}
                            {acc && <span className="tx-card-account">{acc.name || acc.bank}</span>}
                            {/* Mobile-only: category shown as second line below label */}
                            {!isTransfer && (
                              <button
                                className="tx-mobile-cat"
                                onClick={() => setEditingTx(tx.id)}
                                title="Changer la catégorie"
                              >
                                {display
                                  ? <><span>{display.icon}</span> {display.name}</>
                                  : <><span>❓</span> Non catégorisé</>
                                }
                              </button>
                            )}
                          </div>
                          <div className="tx-card-classification">
                          <div className="tx-card-col tx-card-col-cat">
                            {isTransfer ? (() => {
                              const txfType = getTransferType(tx, accounts);
                              const destId = getTransferDestAccountId(tx);
                              const destAcc = destId ? accounts.find(a => a.id === destId) : null;
                              const label = txfType === 'savings'
                                ? '↔ → Épargne'
                                : txfType === 'secondary'
                                  ? '↔ → Dépense secondaire'
                                  : '↔ Virement interne';
                              const cls = txfType === 'savings' ? 'transfer savings' : txfType === 'secondary' ? 'transfer secondary' : 'transfer';
                              return (
                                <span className={`tx-card-cat-pill-wrap ${cls}`}>
                                  <button
                                    className={`tx-card-cat-pill ${cls} no-radius-right`}
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTransferPickerTx({ txId: tx.id, anchorRect: rect });
                                    }}
                                    title={destAcc ? `Vers ${destAcc.name || destAcc.bank} — clic pour modifier` : 'Clic pour préciser le compte cible'}
                                  >
                                    {label}
                                  </button>
                                  <button
                                    className={`tx-card-cat-pill-x ${cls}`}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      // Retire le tag transfer-dest + override = false
                                      const currentTags = (tx.tags || []).filter(t => !(typeof t === 'string' && t.startsWith('transfer-dest:')));
                                      if (updateTags) await updateTags(tx.id, currentTags);
                                      if (setTransferOverride) await setTransferOverride(tx.id, false);
                                    }}
                                    title="Retirer le marquage virement"
                                    aria-label="Retirer le marquage virement"
                                  >
                                    <X size={11}/>
                                  </button>
                                </span>
                              );
                            })() : (
                              <button
                                className="tx-card-cat-pill"
                                style={{
                                  color: display?.color || 'var(--ink-2)',
                                  background: (display?.color || '#9ca3af') + '22',
                                }}
                                onClick={() => setEditingTx(tx.id)}
                              >
                                {display?.name || 'Non catégorisé'}
                              </button>
                            )}
                          </div>
                          <div className="tx-card-col tx-card-col-sub">
                            {!isTransfer && cat ? (cat.parent ? (
                              editingSubcat === tx.id ? (
                                <SubCatPicker
                                  categories={categories}
                                  topSlug={cat.parent}
                                  currentId={cat.id}
                                  onSelect={(catId) => { updateCategory(tx.id, catId); }}
                                  onClose={() => setEditingSubcat(null)}
                                />
                              ) : (
                                <button className="tx-card-sub-pill" onClick={() => setEditingSubcat(tx.id)} title="Changer le détail">
                                  {cat.icon} {cat.name}
                                </button>
                              )
                            ) : (
                              categories.some(c => c.parent === cat.id) ? (
                                editingSubcat === tx.id ? (
                                  <SubCatPicker
                                    categories={categories}
                                    topSlug={cat.id}
                                    currentId={cat.id}
                                    onSelect={(catId) => { updateCategory(tx.id, catId); }}
                                    onClose={() => setEditingSubcat(null)}
                                  />
                                ) : (
                                  <button className="tx-card-sub-add" onClick={() => setEditingSubcat(tx.id)} title="Préciser la sous-catégorie">
                                    <Plus size={11}/> détail
                                  </button>
                                )
                              ) : <span className="tx-card-col-empty">—</span>
                            )) : <span className="tx-card-col-empty">—</span>}
                          </div>
                          </div>
                          <div className="tx-card-actions">
                            {!isUnclassified && needsTransactionReview(tx, transferIds) && onMarkReviewed && (
                              <button
                                className="tx-card-action review-confirm"
                                onClick={() => onMarkReviewed([tx.id])}
                                title="Confirmer cette catégorie"
                                aria-label="Confirmer cette catégorie"
                              >
                                <CheckCircle2 size={13}/>
                              </button>
                            )}
                            {/* C14 (2026-05-18) : bouton "récurrent" manuel retiré.
                                Le badge auto-détecté reste affiché en lecture seule (isRecurring),
                                et un toast propose la création de FixedCharge après 3 occurrences. */}
                            {isRecurring && (
                              <span
                                className="tx-card-action recurring active is-readonly"
                                title="Détecté comme récurrent (3+ occurrences)"
                              >
                                <Repeat size={12}/>
                              </span>
                            )}
                            {!isTransfer && setTransferOverride && (
                              <button
                                className="tx-card-action transfer-toggle"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTransferPickerTx({ txId: tx.id, anchorRect: rect });
                                }}
                                title="Marquer comme virement interne…"
                              ><ArrowLeftRight size={12}/></button>
                            )}
                            <button
                              className="tx-card-action delete"
                              onClick={() => deleteTransaction(tx.id)}
                              title="Supprimer"
                            >
                              <Trash2 size={12}/>
                            </button>
                          </div>
                          <div className={`tx-card-amount num ${amtCls}`}>
                            {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {filtered.length > 200 && (
              <div className="tx-feed-more">+ {filtered.length - 200} transactions — affinez vos filtres pour les voir.</div>
            )}
          </div>
        );
      })()}

      {transferPickerTx && (
        <TransferDestPopover
          tx={transactions.find(t => t.id === transferPickerTx.txId)}
          anchorRect={transferPickerTx.anchorRect}
          accounts={accounts}
          fmt={fmt}
          onClose={() => setTransferPickerTx(null)}
          onMark={async (destAccountId, isTransfer, opts = {}) => {
            const tx = transactions.find(t => t.id === transferPickerTx.txId);
            if (!tx) { setTransferPickerTx(null); return; }
            const currentTags = (tx.tags || []).filter(t => !(typeof t === 'string' && t.startsWith('transfer-dest:')));
            if (isTransfer) {
              if (destAccountId) currentTags.push(buildTransferDestTag(destAccountId));
              if (updateTags) await updateTags(tx.id, currentTags);
              if (setTransferOverride) await setTransferOverride(tx.id, true);
              // Si le compte cible est manuel et l'utilisateur a accepte,
              // creer la tx miroir : montant oppose, meme date, label clair.
              if (opts.createMirror && destAccountId && createTransaction) {
                const destAcc = accounts.find(a => a.id === destAccountId);
                await createTransaction({
                  accountId: destAccountId,
                  amount: -(tx.amount || 0),
                  date: tx.date,
                  label: `Virement reçu — ${tx.label || 'sans libellé'}`,
                  isTransferOverride: true,
                  tags: [buildTransferDestTag(tx.accountId)],
                });
              }
            } else {
              if (updateTags) await updateTags(tx.id, currentTags);
              if (setTransferOverride) await setTransferOverride(tx.id, false);
            }
            setTransferPickerTx(null);
          }}
          onChooseCategory={async () => {
            const tx = transactions.find(t => t.id === transferPickerTx.txId);
            if (!tx) { setTransferPickerTx(null); return; }
            const currentTags = (tx.tags || []).filter(t => !(typeof t === 'string' && t.startsWith('transfer-dest:')));
            if (updateTags) await updateTags(tx.id, currentTags);
            if (setTransferOverride) await setTransferOverride(tx.id, false);
            setTransferPickerTx(null);
            // Ouvre le cat picker tout de suite
            setEditingTx(tx.id);
          }}
        />
      )}

      {showAddTx && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          customRules={customRules}
          defaultAccountId={filters.accs.length === 1 ? filters.accs[0] : null}
          onSave={createTransaction}
          onClose={() => setShowAddTx(false)}
        />
      )}
    </div>
  );
}

// ─── TransferDestPopover ─────────────────────────────────────────────
// Popover positionne pres du bouton ↔ d'une transaction. Liste les autres
// comptes (sauf celui de la tx), groupes par role pour clarifier. Click =
// marque la tx comme virement avec destination, type derive du role :
//   - epargne / investissement → 'savings' (compte en epargne)
//   - depenses → 'secondary' (neutralise, vraies depenses sur le cible)
//   - principal → marquage 'sans destination' (legacy)
// Animation GSAP : scale + opacity in 220ms.
function TransferDestPopover({ tx, anchorRect, accounts, fmt, onClose, onMark, onChooseCategory }) {
  const ref = useRef(null);
  const overlayRef = useRef(null);
  // Step 2 : confirmation tx miroir pour compte manuel
  const [mirrorStep, setMirrorStep] = useState(null); // { destAccountId, destAcc }

  useLayoutEffect(() => {
    if (!ref.current || !overlayRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(ref.current, { opacity: 1, scale: 1 });
      return;
    }
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out' });
    gsap.fromTo(ref.current,
      { opacity: 0, scale: 0.94, y: -6 },
      { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power3.out' }
    );
  }, []);

  // ESC pour fermer
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!tx) return null;

  // Position : sous le bouton, ajuste si overflow droite
  const popWidth = 320;
  const top = (anchorRect?.bottom || 0) + 8 + window.scrollY;
  let left = (anchorRect?.left || 0) + window.scrollX;
  if (left + popWidth > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - popWidth - 16);
  }

  // Filtre les comptes : pas celui de la tx + ordre par role
  const eligible = (accounts || []).filter(a => a.id !== tx.accountId);
  const grouped = {
    savings: eligible.filter(a => a.role === 'epargne' || a.role === 'investissement'),
    secondary: eligible.filter(a => a.role === 'depenses'),
    principal: eligible.filter(a => !a.role || a.role === 'principal'),
    other: eligible.filter(a => a.role && !['epargne','investissement','depenses','principal'].includes(a.role)),
  };

  const isManualAccount = (acc) => acc?.source !== 'gocardless' && !acc?.externalId;

  const renderAccount = (acc, hint) => (
    <button
      key={acc.id}
      className="tdp-acc"
      onClick={() => {
        // Si compte manuel : etape de confirmation tx miroir
        if (isManualAccount(acc)) {
          setMirrorStep({ destAccountId: acc.id, destAcc: acc });
        } else {
          onMark(acc.id, true);
        }
      }}
    >
      <span className="tdp-acc-name">
        <span className="tdp-acc-dot" style={{ background: acc.role === 'epargne' ? 'var(--accent)' : acc.role === 'depenses' ? 'var(--warning)' : 'var(--ink-3)' }}/>
        {acc.name || acc.bank || '—'}
        {isManualAccount(acc) && <span className="tdp-acc-manual">manuel</span>}
      </span>
      <span className="tdp-acc-hint">{hint}</span>
    </button>
  );

  // Step 2 : confirmation tx miroir pour compte manuel.
  if (mirrorStep) {
    const mirrorAmount = -(tx.amount || 0);
    const mirrorPositive = mirrorAmount >= 0;
    const fmtFn = fmt || ((v) => `${v.toFixed(2)} €`);
    const popover2 = (
      <>
        <div ref={overlayRef} className="tdp-overlay" onClick={onClose}/>
        <div
          ref={ref}
          className="tdp-popover"
          style={{ position: 'absolute', top, left, width: popWidth, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Confirmation transaction miroir"
        >
          <div className="tdp-head">
            <div className="tdp-title">Compte manuel détecté</div>
            <div className="tdp-sub">
              <strong>{mirrorStep.destAcc.name || mirrorStep.destAcc.bank}</strong> n'est pas synchronisé.
              Vous pouvez créer la transaction miroir maintenant pour garder votre solde à jour.
            </div>
          </div>

          <div className="tdp-mirror-preview">
            <div className="tdp-mirror-row">
              <span className="tdp-mirror-label">À créer sur {mirrorStep.destAcc.name || mirrorStep.destAcc.bank}</span>
              <span className={`tdp-mirror-amt num ${mirrorPositive ? 'pos' : 'neg'}`}>
                {mirrorPositive ? '+' : ''}{fmtFn(mirrorAmount)}
              </span>
            </div>
            <div className="tdp-mirror-row">
              <span className="tdp-mirror-label">Date</span>
              <span className="tdp-mirror-meta">{tx.date}</span>
            </div>
            <div className="tdp-mirror-row">
              <span className="tdp-mirror-label">Libellé</span>
              <span className="tdp-mirror-meta">Virement reçu — {tx.label || 'sans libellé'}</span>
            </div>
          </div>

          <div className="tdp-foot">
            <button className="tdp-foot-btn" onClick={() => onMark(mirrorStep.destAccountId, true, { createMirror: false })}>
              Sans tx miroir
            </button>
            <button className="tdp-foot-btn primary" onClick={() => onMark(mirrorStep.destAccountId, true, { createMirror: true })}>
              Créer la tx miroir
            </button>
          </div>
        </div>
      </>
    );
    return createPortal(popover2, document.body);
  }

  const popover = (
    <>
      <div ref={overlayRef} className="tdp-overlay" onClick={onClose}/>
      <div
        ref={ref}
        className="tdp-popover"
        style={{ position: 'absolute', top, left, width: popWidth, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choisir le compte cible du virement interne"
      >
        <div className="tdp-head">
          <div className="tdp-title">Vers quel compte ?</div>
          <div className="tdp-sub">Le type de virement est déduit du rôle du compte cible.</div>
        </div>

        {grouped.savings.length > 0 && (
          <div className="tdp-group">
            <div className="tdp-group-title"><PiggyBank size={11}/> → ÉPARGNE</div>
            {grouped.savings.map(a => renderAccount(a, 'Comptera en épargne'))}
          </div>
        )}

        {grouped.secondary.length > 0 && (
          <div className="tdp-group">
            <div className="tdp-group-title"><CreditCard size={11}/> → DÉPENSE SECONDAIRE</div>
            {grouped.secondary.map(a => renderAccount(a, 'Neutralisé (dépenses sur le compte cible)'))}
          </div>
        )}

        {grouped.principal.length > 0 && (
          <div className="tdp-group">
            <div className="tdp-group-title">→ AUTRE COMPTE PRINCIPAL</div>
            {grouped.principal.map(a => renderAccount(a, 'Neutralisé (mais pas un cas type)'))}
          </div>
        )}

        {grouped.other.length > 0 && (
          <div className="tdp-group">
            <div className="tdp-group-title">→ AUTRES</div>
            {grouped.other.map(a => renderAccount(a, ''))}
          </div>
        )}

        <div className="tdp-foot">
          <button className="tdp-foot-btn" onClick={() => onMark(null, true)} title="Marquer comme virement interne sans compte cible (neutralisé)">
            Sans destination précise
          </button>
          {onChooseCategory && (
            <button className="tdp-foot-btn" onClick={onChooseCategory} title="Retire le marquage virement et ouvre le sélecteur de catégorie">
              Choisir une catégorie…
            </button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(popover, document.body);
}
