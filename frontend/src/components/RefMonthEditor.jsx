// ============================================================================
// RefMonthEditor — drawer latéral pour éditer le Mois type.
//
// Forme refMonth :
//   { version, updated_at, lines: [{ id, category_id, kind, label, amount, locked }] }
//   kind = 'income' | 'expense' | 'saving'
//
// Suggestion d'historique : médiane sur les 3 derniers mois complets,
// par (category_id, kind). Min 2 mois avec ≥1 tx pour suggérer.
// ============================================================================
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw, Lock, Unlock, Plus, Trash2, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { monthKey } from '../utils.js';

function _uuid() {
  return 'rm-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Hoverable suggestion chip — shows mean by default, expands to a popover
// listing the contributing transactions on hover. Helps the user understand
// "where does this 39 €/mois come from?".
function SuggestionHover({ sug, fmt }) {
  const [open, setOpen] = useState(false);
  if (!sug) return <span className="ds-micro">Pas assez d'historique</span>;
  const sample = sug.txs.slice(0, 10);
  const more = Math.max(0, sug.txs.length - sample.length);
  return (
    <span
      className={`rm-suggest-chip ${open ? 'open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      ≈ {fmt(sug.mean)}/mois <span className="ds-micro">· moyenne {sug.months} mois</span>
      {open && (
        <span className="rm-suggest-pop">
          <span className="rm-suggest-pop-head">
            <span><strong>Moyenne</strong> {fmt(sug.mean)} · <strong>Médiane</strong> {fmt(sug.median)}</span>
            <span className="ds-micro">
              {sug.txs.length} opération{sug.txs.length > 1 ? 's' : ''} · {sug.months} mois
              {sug.outlierCount > 0 && <> · {sug.outlierCount} valeur{sug.outlierCount > 1 ? 's' : ''} exceptionnelle{sug.outlierCount > 1 ? 's' : ''} exclue{sug.outlierCount > 1 ? 's' : ''} (moyenne brute {fmt(sug.meanRaw)})</>}
            </span>
          </span>
          <span className="rm-suggest-pop-list">
            {sample.map(t => (
              <span key={t.id} className="rm-suggest-pop-row">
                <span className="rm-suggest-pop-date">{t.date.slice(5)}</span>
                <span className="rm-suggest-pop-label">{t.label || 'Sans libellé'}</span>
                <span className="rm-suggest-pop-amount num">{fmt(t.amount)}</span>
              </span>
            ))}
            {more > 0 && <span className="rm-suggest-pop-more">+ {more} autre{more > 1 ? 's' : ''}</span>}
          </span>
        </span>
      )}
    </span>
  );
}

function medianOf(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function meanOf(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Compute mean + median + contributing transactions per (category_id, kind)
 * over the last 3 complete months.
 * Returns: {
 *   [`${kind}::${categoryId}`]: { mean, median, months, txs: [{id,date,label,amount}] }
 * }
 */
function buildHistorySuggestions({ transactions, accounts, memberShare, transferIds, currentMonth, fixedCharges = [], saving_slugs }) {
  if (!transactions || !currentMonth) return {};

  // Last 3 complete months (excludes current).
  const [cy, cm] = currentMonth.split('-').map(Number);
  const months = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(cy, cm - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Per (kind, catId) → { byMonth: {month: amount}, txs: [...] }
  const agg = {};
  for (const t of transactions) {
    const mk = monthKey(t.date);
    if (!months.includes(mk)) continue;
    if (transferIds && transferIds.has(t.id)) continue;
    const acc = accounts.find(a => a.id === t.accountId);
    const share = acc ? memberShare(acc) : 1;
    const amt = (t.amount || 0) * share;
    const catId = t.categoryId || 'uncategorized';
    const kind = amt >= 0 ? 'income' : (saving_slugs && saving_slugs.has(catId) ? 'saving' : 'expense');
    const k = `${kind}::${catId}`;
    if (!agg[k]) agg[k] = { byMonth: {}, txs: [] };
    agg[k].byMonth[mk] = (agg[k].byMonth[mk] || 0) + Math.abs(amt);
    agg[k].txs.push({
      id: t.id,
      date: t.date,
      label: t.label || '',
      amount: amt,
    });
  }

  // Build final stats — keep entries with ≥2 months of data.
  // We exclude outliers from the *suggested* mean (months whose total > 2× the
  // median of the others), so a one-off bonus / refund doesn't inflate the
  // recurring budget. Both raw and trimmed means are exposed so the popover
  // can show "moyenne ajustée" + "moyenne brute".
  const result = {};
  for (const [k, a] of Object.entries(agg)) {
    const values = Object.values(a.byMonth).filter(v => v > 0);
    if (values.length < 2) continue;
    const med = medianOf(values);
    const trimmed = med > 0 ? values.filter(v => v <= 2 * med) : values;
    const outliers = values.filter(v => v > 2 * med);
    result[k] = {
      mean: Math.round(meanOf(trimmed)),         // used for auto-fill (recurring budget)
      meanRaw: Math.round(meanOf(values)),       // shown as info in popover
      median: Math.round(med),
      months: values.length,
      outlierCount: outliers.length,
      txs: a.txs.sort((x, y) => y.date.localeCompare(x.date)),
    };
  }
  return result;
}

const SAVING_SLUGS_DEFAULT = new Set(['savings']);

const KIND_ORDER = ['income', 'expense', 'saving'];
const KIND_LABEL = {
  income: 'Entrées',
  expense: 'Dépenses',
  saving: 'Épargne',
};
const KIND_ICON = {
  income:  <TrendingUp size={14}/>,
  expense: <TrendingDown size={14}/>,
  saving:  <PiggyBank size={14}/>,
};
const KIND_COLOR = {
  income:  'var(--positive)',
  expense: 'var(--ink-2)',
  saving:  'var(--accent)',
};

// Starter template for first-time editing. Each entry creates an empty line
// (amount=0) — the user fills in the values. Categories chosen for a typical
// French household (couple + enfants, propriétaire ou locataire).
const STARTER_TEMPLATE = [
  // Entrées
  { kind: 'income',  category_id: 'salary',        label: 'Salaire' },
  // Logement
  { kind: 'expense', category_id: 'housing',       label: 'Loyer / prêt' },
  { kind: 'expense', category_id: 'housing',       label: 'Charges / copropriété' },
  // Énergie & utilities
  { kind: 'expense', category_id: 'utilities',     label: 'Électricité / gaz' },
  { kind: 'expense', category_id: 'utilities',     label: 'Internet & mobile' },
  // Vie quotidienne
  { kind: 'expense', category_id: 'groceries',     label: 'Courses' },
  { kind: 'expense', category_id: 'food',          label: 'Restaurants & sorties' },
  { kind: 'expense', category_id: 'transport',     label: 'Transports' },
  { kind: 'expense', category_id: 'fuel',          label: 'Carburant' },
  // Assurances, santé, enfants
  { kind: 'expense', category_id: 'insurance',     label: 'Assurances' },
  { kind: 'expense', category_id: 'health',        label: 'Santé' },
  { kind: 'expense', category_id: 'children',      label: 'Enfants' },
  // Récurrent
  { kind: 'expense', category_id: 'subscriptions', label: 'Abonnements' },
  { kind: 'expense', category_id: 'shopping',      label: 'Shopping & loisirs' },
  // Épargne
  { kind: 'saving',  category_id: 'savings',       label: 'Versement épargne' },
];

function _buildStarter() {
  return STARTER_TEMPLATE.map(t => ({
    id: _uuid(),
    category_id: t.category_id,
    kind: t.kind,
    label: t.label,
    amount: 0,
    locked: false,
  }));
}

export function RefMonthEditor({
  refMonth, saveRefMonth,
  categories, transactions, accounts, memberShare, transferIds,
  currentMonth, fmt, onClose,
}) {
  const { t } = useTranslation();
  // First-time open with no saved Mois type → seed with classic categories
  // so the user doesn't face an empty drawer.
  const [draft, setDraft] = useState(() => {
    const existing = refMonth?.lines || [];
    return existing.length > 0 ? existing : _buildStarter();
  });
  // Snapshot of the initial state for dirty-check on close.
  const initialSnapshot = useRef(JSON.stringify(refMonth?.lines || []));
  const [saving, setSaving] = useState(false);

  // Intercept close: if dirty, ask confirmation before discarding edits.
  const handleClose = () => {
    const currentSerialized = JSON.stringify(draft);
    if (currentSerialized !== initialSnapshot.current) {
      if (!window.confirm('Vous avez des modifications non sauvegardées. Les abandonner ?')) return;
    }
    onClose && onClose();
  };

  // Re-sync draft if refMonth prop changes from outside (after save).
  useEffect(() => {
    const existing = refMonth?.lines || [];
    if (existing.length > 0) setDraft(existing);
  }, [refMonth]);

  const saving_slugs = SAVING_SLUGS_DEFAULT;

  const suggestions = useMemo(() => buildHistorySuggestions({
    transactions, accounts, memberShare, transferIds, currentMonth, saving_slugs,
  }), [transactions, accounts, memberShare, transferIds, currentMonth]);

  const catFor = (id) => categories.find(c => c.id === id || c.slug === id);

  // Group draft lines by category for display.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const line of draft) {
      const k = `${line.kind}::${line.category_id || 'uncategorized'}`;
      if (!map.has(k)) map.set(k, { kind: line.kind, category_id: line.category_id, lines: [] });
      map.get(k).lines.push(line);
    }
    return [...map.values()].sort((a, b) => {
      const ki = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (ki !== 0) return ki;
      return (catFor(a.category_id)?.name || a.category_id || '').localeCompare(catFor(b.category_id)?.name || b.category_id || '');
    });
  }, [draft, categories]);

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, saving: 0 };
    for (const line of draft) {
      const v = parseFloat(line.amount) || 0;
      t[line.kind] = (t[line.kind] || 0) + v;
    }
    t.balance = t.income - t.expense - t.saving;
    return t;
  }, [draft]);

  const updateLine = (id, patch) => {
    setDraft(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };
  const addLine = ({ kind, category_id }) => {
    const cat = catFor(category_id);
    setDraft(prev => [...prev, {
      id: _uuid(),
      category_id,
      kind,
      label: cat?.name || (kind === 'income' ? 'Entrée' : 'Ligne'),
      amount: 0,
      locked: false,
    }]);
  };
  const removeLine = (id) => setDraft(prev => prev.filter(l => l.id !== id));

  const resyncAll = () => {
    // For each (kind, category_id) that has a suggestion AND at least one unlocked
    // line, overwrite the FIRST unlocked line's amount with the suggestion.
    // Also create missing top-line for suggestions not present at all.
    const next = [...draft];
    const seenKeys = new Set();
    for (const line of next) {
      const k = `${line.kind}::${line.category_id || 'uncategorized'}`;
      if (line.locked) { seenKeys.add(k); continue; }
      const sug = suggestions[k];
      if (sug && !seenKeys.has(k)) {
        line.amount = sug.mean;
        seenKeys.add(k);
      }
    }
    // Create lines for suggested keys not present.
    for (const [k, sug] of Object.entries(suggestions)) {
      if (seenKeys.has(k)) continue;
      const [kind, category_id] = k.split('::');
      const cat = catFor(category_id);
      next.push({
        id: _uuid(),
        category_id,
        kind,
        label: cat?.name || (kind === 'income' ? 'Entrée' : 'Ligne'),
        amount: sug.mean,
        locked: false,
      });
    }
    setDraft(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRefMonth({ version: 1, lines: draft.map(l => ({ ...l, amount: parseFloat(l.amount) || 0 })) });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  // Sorted list of categories per kind for the "add line" picker.
  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense' && c.id !== 'uncategorized');

  return (
    <>
      <div className="ref-month-backdrop" onClick={handleClose}/>
      <aside className="ref-month-drawer" role="dialog" aria-label="Éditer mon mois type">
        <div className="rm-head">
          <div>
            <h2>Mois type <em>de référence</em></h2>
            <p className="ds-micro">Le budget mensuel auquel l'app compare chaque mois.</p>
          </div>
          <button className="ds-icon-btn" onClick={handleClose} aria-label="Fermer"><X size={16}/></button>
        </div>

        <div className="rm-toolbar">
          <button className="ds-btn ghost" onClick={resyncAll}>
            <RotateCcw size={14}/> Synchroniser depuis l'historique
          </button>
          <span className="ds-micro" style={{ marginLeft: 'auto' }}>
            {refMonth?.updated_at ? `Maj ${refMonth.updated_at}` : 'Jamais enregistré'}
          </span>
        </div>

        <div className="rm-body">
          {KIND_ORDER.map(kind => {
            const groups = grouped.filter(g => g.kind === kind);
            const cats = kind === 'income' ? incomeCats : expenseCats;
            return (
              <section key={kind} className="rm-section">
                <h3 className="rm-section-head" style={{ color: KIND_COLOR[kind] }}>
                  <span className="rm-section-icon" style={{ color: KIND_COLOR[kind] }}>{KIND_ICON[kind]}</span>
                  {KIND_LABEL[kind]}
                </h3>
                {groups.length === 0 && (
                  <p className="ds-micro" style={{ padding: '6px 0', color: 'var(--ink-3)' }}>
                    Aucune ligne — ajoutez-en pour démarrer.
                  </p>
                )}
                {groups.map(g => {
                  const cat = catFor(g.category_id);
                  const catColor = cat?.color || 'var(--border-strong)';
                  return (
                    <div key={`${kind}-${g.category_id}`} className="rm-group" style={{ borderLeftColor: catColor }}>
                      <div className="rm-group-head">
                        <span className="rm-cat-name">
                          <span className="rm-cat-icon" aria-hidden="true">{cat?.icon || '•'}</span>
                          {cat?.name || g.category_id}
                        </span>
                        <span className="rm-cat-total num">{fmt(g.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0))}</span>
                      </div>
                      {g.lines.map(line => {
                        const sugKey = `${line.kind}::${line.category_id || 'uncategorized'}`;
                        const sug = suggestions[sugKey];
                        return (
                          <div key={line.id} className="rm-line">
                            <input
                              className="rm-line-label"
                              value={line.label}
                              onChange={e => updateLine(line.id, { label: e.target.value })}
                              placeholder="Libellé"
                            />
                            <div className="rm-line-input">
                              <input
                                className="num"
                                type="number"
                                step="0.01"
                                value={line.amount}
                                onChange={e => updateLine(line.id, { amount: e.target.value, locked: true })}
                                placeholder="0"
                              />
                              <span className="rm-currency">€</span>
                            </div>
                            <button
                              className="ds-icon-btn"
                              onClick={() => updateLine(line.id, { locked: !line.locked })}
                              title={line.locked ? 'Déverrouiller (laissera la synchro écraser cette valeur)' : 'Verrouiller (la synchro ne touche plus à cette valeur)'}
                            >
                              {line.locked ? <Lock size={14}/> : <Unlock size={14}/>}
                            </button>
                            <button className="ds-icon-btn rm-trash" onClick={() => removeLine(line.id)} aria-label="Supprimer">
                              <Trash2 size={14}/>
                            </button>
                            <div className="rm-suggest">
                              <SuggestionHover sug={sug} fmt={fmt}/>
                            </div>
                          </div>
                        );
                      })}
                      <button className="rm-add-sub" onClick={() => addLine({ kind, category_id: g.category_id })}>
                        <Plus size={12}/> Ajouter une sous-ligne
                      </button>
                    </div>
                  );
                })}
                <RefMonthAddCategory kind={kind} cats={cats} onAdd={(catId) => addLine({ kind, category_id: catId })}/>
              </section>
            );
          })}
        </div>

        <div className="rm-footer">
          <div className="rm-totals">
            <div><span className="ds-micro">Entrées</span><span className="num">{fmt(totals.income)}</span></div>
            <div><span className="ds-micro">Dépenses</span><span className="num">{fmt(-totals.expense)}</span></div>
            <div><span className="ds-micro">Épargne</span><span className="num">{fmt(-totals.saving)}</span></div>
            <div className="rm-balance"><span className="ds-micro">Balance</span><span className="num">{totals.balance >= 0 ? '+' : ''}{fmt(totals.balance)}</span></div>
          </div>
          <div className="rm-actions">
            <button className="ds-btn ghost" onClick={handleClose}>Annuler</button>
            <button className="ds-btn primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function RefMonthAddCategory({ kind, cats, onAdd }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  if (!open) return (
    <button className="rm-add-cat" onClick={() => setOpen(true)}>
      <Plus size={14}/> Ajouter une catégorie {kind === 'income' ? 'd\'entrée' : (kind === 'saving' ? 'd\'épargne' : 'de dépense')}
    </button>
  );
  return (
    <div className="rm-add-cat-form">
      <select value={value} onChange={e => setValue(e.target.value)}>
        <option value="">— Choisir —</option>
        {cats.map(c => <option key={c.id} value={c.id || c.slug}>{c.name}</option>)}
      </select>
      <button className="ds-btn primary sm" onClick={() => { if (value) { onAdd(value); setOpen(false); setValue(''); } }}>Ajouter</button>
      <button className="ds-btn ghost sm" onClick={() => { setOpen(false); setValue(''); }}>Annuler</button>
    </div>
  );
}
