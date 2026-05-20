import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, X, Sparkles, ArrowLeftRight } from 'lucide-react';
import { CategoryDropdown } from './CategoryDropdown.jsx';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';

// Modal that lets the user create (and edit) a categorization rule.
// Pre-fills with the auto-extracted merchant keyword, but the user is free
// to override it with any free-form keyword. The rule pattern is a
// case-insensitive substring match against the transaction label.
//
// Props:
//  - open: boolean
//  - suggested: string — the auto-extracted merchant token
//  - categories: full categories list (with parent field for sub-cats)
//  - initialCategoryId: slug of the initially selected category (top or sub)
//  - matchCount: (kw: string) => number — live count of matching txs
//  - onConfirm: ({ keyword, categoryId }) => Promise<void>
//  - onClose: () => void
export function CreateRuleModal({ open, suggested = '', categories = [], initialCategoryId = '', matchCount, onConfirm, onClose }) {
  const [keyword, setKeyword] = useState(suggested);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('category'); // 'category' | 'transfer'
  const inputRef = useRef(null);

  // Resolve initial top-level + sub-level from the suggested category.
  const initial = useMemo(() => {
    const cat = categories.find(c => c.id === initialCategoryId);
    if (!cat) return { top: '', sub: '' };
    if (cat.parent) return { top: cat.parent, sub: cat.id };
    return { top: cat.id, sub: '' };
  }, [initialCategoryId, categories]);

  const [topId, setTopId] = useState(initial.top);
  const [subId, setSubId] = useState(initial.sub);

  useEffect(() => {
    if (open) {
      setKeyword(suggested);
      setTopId(initial.top);
      setSubId(initial.sub);
      setMode('category');
    }
  }, [open, suggested, initial.top, initial.sub]);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  if (!open) return null;

  const pickerCats = categories.filter(c => c.id !== 'uncategorized' && c.type !== 'income');
  const targetId = subId || topId;
  const targetCat = categories.find(c => c.id === targetId);

  // Linked picker handler — pick a sub from either dropdown → both filled.
  const onPickCat = (slug) => {
    if (!slug) { setTopId(''); setSubId(''); return; }
    const cat = categories.find(c => c.id === slug);
    if (!cat) return;
    if (cat.parent) { setTopId(cat.parent); setSubId(slug); }
    else { setTopId(slug); setSubId(''); }
  };

  const trimmed = keyword.trim();
  const count = trimmed.length >= 2 ? matchCount(trimmed, mode === 'transfer' ? null : targetId) : 0;
  const canSubmit = trimmed.length >= 2 && (mode === 'transfer' || !!targetId) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try { await onConfirm({ keyword: trimmed, categoryId: mode === 'category' ? targetId : null, mode }); }
    finally { setSubmitting(false); }
  };

  return (
    <ResponsiveModal open={true} onClose={onClose}>
        <CreateRuleStyles/>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--accent)' }}/>
            Créer une <em>règle</em>
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          {/* Mode toggle: catégoriser vs marquer comme virement interne.
              Utile pour les top-ups de cartes secondaires (Revolut, Lydia, AMEX)
              qui ne sont pas de vraies dépenses mais des transferts. */}
          <div className="rule-mode-toggle">
            <button
              type="button"
              className={`rule-mode-btn ${mode === 'category' ? 'active' : ''}`}
              onClick={() => setMode('category')}
            >
              <Sparkles size={13}/> Catégoriser
            </button>
            <button
              type="button"
              className={`rule-mode-btn ${mode === 'transfer' ? 'active' : ''}`}
              onClick={() => setMode('transfer')}
            >
              <ArrowLeftRight size={13}/> Virement interne
            </button>
          </div>

          <p className="rule-modal-intro">
            {mode === 'category' ? (
              <>Toutes les transactions dont le libellé contient ce mot-clé seront classées automatiquement
              {targetCat ? <> en <strong>{targetCat.icon} {targetCat.name}</strong></> : null}.</>
            ) : (
              <>Toutes les transactions dont le libellé contient ce mot-clé seront marquées comme <strong>↔ virement interne</strong> et exclues du cashflow.</>
            )}
          </p>
          <label className="rule-modal-label">
            <span>Mot-clé</span>
            <input
              ref={inputRef}
              className="rule-modal-input"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder={mode === 'category' ? 'ex: NESPRESSO, Netflix, EDF…' : 'ex: Revolut**, Lydia, N26…'}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) submit(); if (e.key === 'Escape') onClose(); }}
            />
            <div className="rule-modal-hint">
              Recherche insensible à la casse, n'importe où dans le libellé.
            </div>
          </label>

          {mode === 'category' && (
            <div className="rule-modal-row">
              <label className="rule-modal-label">
                <span>Catégorie</span>
                <CategoryDropdown
                  value={topId}
                  categories={pickerCats}
                  onChange={onPickCat}
                  placeholder="Catégorie"
                  grouped
                  clearable={false}
                  showParentInChip={false}
                />
              </label>
              <label className="rule-modal-label">
                <span>Détail <span className="rule-modal-optional">(optionnel)</span></span>
                <CategoryDropdown
                  value={subId}
                  categories={pickerCats}
                  onChange={onPickCat}
                  placeholder="Détail (optionnel)"
                  grouped
                  emptyLabel="Aucun détail"
                />
              </label>
            </div>
          )}

          <div className={`rule-modal-count ${count > 0 ? 'has' : 'none'}`}>
            {trimmed.length < 2
              ? 'Tape au moins 2 caractères'
              : (mode === 'category' && !targetId)
                ? 'Choisis une catégorie cible'
                : count === 0
                  ? <>Aucune transaction existante ne correspond. La règle s'appliquera aux <em>futures</em> transactions.</>
                  : <><strong>{count}</strong> transaction{count > 1 ? 's' : ''} {mode === 'transfer' ? 'sera' : (count > 1 ? 'seront' : 'sera')} {mode === 'transfer' ? (count > 1 ? 'marquées' : 'marquée') : (count > 1 ? 'reclassées' : 'reclassée')} maintenant.</>
            }
          </div>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose} disabled={submitting}>Annuler</button>
          <button className="primary-btn" onClick={submit} disabled={!canSubmit}>
            <Check size={14}/> {submitting ? '…' : (mode === 'transfer' ? 'Marquer comme virement' : 'Créer la règle')}
          </button>
        </div>
      </ResponsiveModal>
  );
}

function CreateRuleStyles() {
  return (
    <style>{`
      .rule-mode-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; background: var(--bg-sunk); border-radius: 8px; margin: 0 0 14px; }
      .rule-mode-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 10px; background: transparent; border: none; border-radius: 6px; font: 500 12px var(--font-sans); color: var(--ink-2); cursor: pointer; transition: background 0.12s, color 0.12s; }
      .rule-mode-btn:hover { color: var(--ink); }
      .rule-mode-btn.active { background: var(--bg-elev); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
      .rule-modal-intro { font-size: 13px; color: var(--ink-2); margin: 0 0 16px; line-height: 1.5; }
      .rule-modal-intro strong { color: var(--ink); }
      .rule-modal-label { display: flex; flex-direction: column; gap: 6px; }
      .rule-modal-label > span { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 500; }
      .rule-modal-optional { text-transform: none; letter-spacing: 0; color: var(--ink-3); font-weight: 400; }
      .rule-modal-input { font-size: 15px; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg-elev); color: var(--ink); font-family: inherit; }
      .rule-modal-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
      .rule-modal-hint { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
      .rule-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
      @media (max-width: 540px) { .rule-modal-row { grid-template-columns: 1fr; } }
      .rule-modal-count { margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
      .rule-modal-count.has { background: var(--accent-soft); color: var(--accent); }
      .rule-modal-count.none { background: var(--bg-subtle, var(--bg-sunk)); color: var(--ink-2); }
      .rule-modal-count strong { font-variant-numeric: tabular-nums; }
    `}</style>
  );
}
