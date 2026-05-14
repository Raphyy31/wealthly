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
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw, Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { monthKey } from '../utils.js';

function _uuid() {
  return 'rm-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function medianOf(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute median amount per (category_id, kind) over the last 3 complete months.
 * Returns: { [`${kind}::${categoryId}`]: { median, months } }
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

  // Per (catId, kind, month) → total amount this month.
  const perMonth = new Map();
  for (const t of transactions) {
    const mk = monthKey(t.date);
    if (!months.includes(mk)) continue;
    if (transferIds && transferIds.has(t.id)) continue;
    const acc = accounts.find(a => a.id === t.accountId);
    const share = acc ? memberShare(acc) : 1;
    const amt = (t.amount || 0) * share;
    const catId = t.categoryId || 'uncategorized';
    const kind = amt >= 0 ? 'income' : (saving_slugs && saving_slugs.has(catId) ? 'saving' : 'expense');
    const k = `${kind}::${catId}::${mk}`;
    perMonth.set(k, (perMonth.get(k) || 0) + Math.abs(amt));
  }

  // Aggregate per (catId, kind) over months → median + months with data.
  const out = {};
  for (const m of months) {
    for (const t of transactions) {
      const mk = monthKey(t.date);
      if (mk !== m) continue;
      if (transferIds && transferIds.has(t.id)) continue;
      const catId = t.categoryId || 'uncategorized';
      const amt = (t.amount || 0);
      const kind = amt >= 0 ? 'income' : (saving_slugs && saving_slugs.has(catId) ? 'saving' : 'expense');
      const k = `${kind}::${catId}`;
      out[k] = out[k] || { byMonth: {}, months: 0 };
      const monthKey2 = `${kind}::${catId}::${m}`;
      if (out[k].byMonth[m] == null) {
        out[k].byMonth[m] = perMonth.get(monthKey2) || 0;
        if (out[k].byMonth[m] > 0) out[k].months += 1;
      }
    }
  }

  // Build final → median over months with data.
  const result = {};
  for (const [k, agg] of Object.entries(out)) {
    const values = Object.values(agg.byMonth).filter(v => v > 0);
    if (values.length < 2) continue; // need at least 2 months with data
    result[k] = { median: Math.round(medianOf(values)), months: values.length };
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

export function RefMonthEditor({
  refMonth, saveRefMonth,
  categories, transactions, accounts, memberShare, transferIds,
  currentMonth, fmt, onClose,
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(refMonth?.lines || []);
  const [saving, setSaving] = useState(false);

  // Re-sync draft if refMonth prop changes from outside (after save).
  useEffect(() => { setDraft(refMonth?.lines || []); }, [refMonth]);

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
        line.amount = sug.median;
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
        amount: sug.median,
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
      <div className="ref-month-backdrop" onClick={onClose}/>
      <aside className="ref-month-drawer" role="dialog" aria-label="Éditer mon mois type">
        <div className="rm-head">
          <div>
            <h2>Mois type <em>de référence</em></h2>
            <p className="ds-micro">Le budget mensuel auquel l'app compare chaque mois.</p>
          </div>
          <button className="ds-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16}/></button>
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
                <h3 className="rm-section-head">{KIND_LABEL[kind]}</h3>
                {groups.length === 0 && (
                  <p className="ds-micro" style={{ padding: '6px 0', color: 'var(--ink-3)' }}>
                    Aucune ligne — ajoutez-en pour démarrer.
                  </p>
                )}
                {groups.map(g => {
                  const cat = catFor(g.category_id);
                  return (
                    <div key={`${kind}-${g.category_id}`} className="rm-group">
                      <div className="rm-group-head">
                        <span className="rm-cat-name">{cat?.name || g.category_id}</span>
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
                              {sug
                                ? <>≈ {fmt(sug.median)}/mois <span className="ds-micro">· médiane {sug.months} mois</span></>
                                : <span className="ds-micro">Pas assez d'historique</span>}
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
            <button className="ds-btn ghost" onClick={onClose}>Annuler</button>
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
