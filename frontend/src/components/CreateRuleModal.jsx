import { useState, useEffect, useRef } from 'react';
import { Check, X, Sparkles } from 'lucide-react';

// Modal that lets the user create (and edit) a categorization rule.
// Pre-fills with the auto-extracted merchant keyword, but the user is free
// to override it with any free-form keyword. The rule pattern is a
// case-insensitive substring match against the transaction label.
//
// Props:
//  - open: boolean
//  - suggested: string — the auto-extracted merchant token
//  - categoryName: string — display name of the target category
//  - matchCount: (kw: string) => number — live count of matching txs
//  - onConfirm: (keyword: string) => Promise<void>
//  - onClose: () => void
export function CreateRuleModal({ open, suggested = '', categoryName, matchCount, onConfirm, onClose }) {
  const [keyword, setKeyword] = useState(suggested);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (open) setKeyword(suggested); }, [open, suggested]);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  if (!open) return null;

  const trimmed = keyword.trim();
  const count = trimmed.length >= 2 ? matchCount(trimmed) : 0;
  const canSubmit = trimmed.length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try { await onConfirm(trimmed); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <CreateRuleStyles/>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--accent)' }}/>
            Créer une <em>règle</em>
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <p className="rule-modal-intro">
            Toutes les transactions dont le libellé contient ce mot-clé seront classées automatiquement en <strong>{categoryName}</strong>.
          </p>
          <label className="rule-modal-label">
            <span>Mot-clé</span>
            <input
              ref={inputRef}
              className="rule-modal-input"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="ex: NESPRESSO, Netflix, EDF…"
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) submit(); if (e.key === 'Escape') onClose(); }}
            />
            <div className="rule-modal-hint">
              Recherche insensible à la casse, n'importe où dans le libellé.
            </div>
          </label>
          <div className={`rule-modal-count ${count > 0 ? 'has' : 'none'}`}>
            {trimmed.length < 2
              ? 'Tape au moins 2 caractères'
              : count === 0
                ? <>Aucune transaction existante ne correspond. La règle s'appliquera aux <em>futures</em> transactions.</>
                : <><strong>{count}</strong> transaction{count > 1 ? 's' : ''} similaire{count > 1 ? 's' : ''} {count > 1 ? 'seront' : 'sera'} reclassée{count > 1 ? 's' : ''} maintenant.</>
            }
          </div>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose} disabled={submitting}>Annuler</button>
          <button className="primary-btn" onClick={submit} disabled={!canSubmit}>
            <Check size={14}/> {submitting ? 'Création…' : 'Créer la règle'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateRuleStyles() {
  return (
    <style>{`
      .rule-modal-intro { font-size: 13px; color: var(--ink-2); margin: 0 0 16px; line-height: 1.5; }
      .rule-modal-intro strong { color: var(--ink); }
      .rule-modal-label { display: flex; flex-direction: column; gap: 6px; }
      .rule-modal-label > span { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 500; }
      .rule-modal-input { font-size: 15px; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg-elev); color: var(--ink); font-family: var(--font-mono, monospace); letter-spacing: 0.02em; }
      .rule-modal-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
      .rule-modal-hint { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
      .rule-modal-count { margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
      .rule-modal-count.has { background: var(--accent-soft); color: var(--accent); }
      .rule-modal-count.none { background: var(--bg-subtle, var(--bg-sunk)); color: var(--ink-2); }
      .rule-modal-count strong { font-variant-numeric: tabular-nums; }
    `}</style>
  );
}
