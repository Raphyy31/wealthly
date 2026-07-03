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
import { Sankey, Layer, Rectangle, Tooltip, ResponsiveContainer } from 'recharts';
import { X, RotateCcw, RefreshCw, Lock, Unlock, Plus, Trash2, TrendingUp, TrendingDown, PiggyBank, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { monthKey } from '../utils.js';
import { CategoryDropdown } from './CategoryDropdown.jsx';

function _uuid() {
  return 'rm-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Hoverable suggestion chip — shows mean by default, expands to a popover
// listing the contributing transactions on hover. Helps the user understand
// "where does this 39 €/mois come from?".
// onFill: optional callback(amount) — adds a "← utiliser" button to auto-fill.
function SuggestionHover({ sug, fmt, onFill }) {
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
      {sug && onFill && (
        <button
          className="rm-suggest-use"
          onClick={e => { e.stopPropagation(); onFill(sug.mean); }}
          title={`Utiliser la moyenne : ${fmt(sug.mean)}/mois`}
        >
          ← utiliser
        </button>
      )}
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

// Montants ronds, sans centimes — pour les récaps lisibles.
const EUR0 = (v) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(Math.round(v || 0));

// Étapes du wizard : Entrées → Dépenses → Épargne → Bilan.
const WIZARD_STEPS = [
  { kind: 'income',  short: 'Entrées',  title: 'Tes entrées',  sub: 'Salaires, revenus et virements reçus chaque mois.', accent: 'var(--positive)' },
  { kind: 'expense', short: 'Dépenses', title: 'Tes dépenses', sub: 'Loyer, courses, factures, abonnements, transports…', accent: 'var(--negative)' },
  { kind: 'saving',  short: 'Épargne',  title: 'Votre épargne',  sub: 'Ce que vous mettez de côté automatiquement chaque mois.', accent: 'var(--accent)' },
  { kind: null,      short: 'Bilan',    title: 'Votre bilan',    sub: 'Vérifiez votre flux mensuel, puis enregistrez.', accent: 'var(--accent)' },
];

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
  { kind: 'expense', category_id: 'household',     label: 'Ménage' },
  { kind: 'expense', category_id: 'restaurants',   label: 'Restaurants & sorties' },
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
  scopeLabel = 'Famille',
  isHouseholdScope = true,
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

  // Wizard : étape courante (0..3) + direction d'animation (1 avant, -1 arrière).
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const lastStep = WIZARD_STEPS.length - 1;

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

  // If a category has a parent, group under the parent. Top-level cats group under themselves.
  const effectiveGroupId = (category_id) => {
    const cat = catFor(category_id);
    return cat?.parent || category_id || 'uncategorized';
  };

  // Group draft lines by PARENT category so sub-cats appear nested under their parent header.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const line of draft) {
      const groupId = effectiveGroupId(line.category_id);
      const k = `${line.kind}::${groupId}`;
      if (!map.has(k)) map.set(k, { kind: line.kind, category_id: groupId, lines: [] });
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
      // Succès confirmé — on peut fermer la modale
      onClose?.();
    } catch (err) {
      // FIX 2026-05-18 : si saveRefMonth re-throw, on NE FERME PAS la modale.
      // Le toast d'erreur est déjà affiché par YotoriApp.saveRefMonth.
      // Le draft local reste à l'écran → l'user peut retry ou copier ses lignes.
      console.error('[RefMonthEditor] save failed, keeping editor open:', err);
    } finally {
      setSaving(false);
    }
  };

  // "Tout réinitialiser" — back to the empty starter scaffold. Same state as
  // first-time open. Save still required for the change to persist.
  const handleReset = () => {
    if (window.confirm('Tout réinitialiser ? Toutes les lignes seront remplacées par le modèle de départ (montants à 0).')) {
      setDraft(_buildStarter());
    }
  };

  // Navigation wizard.
  const goNext = () => {
    if (step < lastStep) { setDir(1); setStep(s => s + 1); }
    else handleSave();
  };
  const goPrev = () => { if (step > 0) { setDir(-1); setStep(s => s - 1); } };
  const goTo = (i) => { if (i === step) return; setDir(i > step ? 1 : -1); setStep(i); };

  // Sorted list of categories per kind for the "add line" picker. For saving
  // we include transfer-typed categories (savings, investment, credit_principal…)
  // since these are the natural buckets for the épargne section.
  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense' && c.id !== 'uncategorized');
  const savingCats = categories.filter(c => (c.type === 'transfer' || c.kind === 'savings') && c.id !== 'uncategorized' && c.id !== 'transfer');

  const incomeCount = grouped.filter(g => g.kind === 'income').reduce((s, g) => s + g.lines.length, 0);
  const expenseCount = grouped.filter(g => g.kind === 'expense').reduce((s, g) => s + g.lines.length, 0);
  const savingCount = grouped.filter(g => g.kind === 'saving').reduce((s, g) => s + g.lines.length, 0);

  // Lignes d'un type, en plat (1 ligne = 1 catégorie). Style wizard.
  const renderKindLines = (kind) => {
    const groups = grouped.filter(g => g.kind === kind);
    const cats = kind === 'income' ? incomeCats : (kind === 'saving' ? savingCats : expenseCats);
    const lines = groups.flatMap(g => g.lines);
    return (
      <div className="rmw-lines">
        {lines.length === 0 && (
          <p className="rmw-empty">Aucune ligne pour l'instant — ajoutez votre première catégorie ci-dessous.</p>
        )}
        {lines.map(line => {
          const c = catFor(line.category_id);
          const sug = suggestions[`${line.kind}::${line.category_id || 'uncategorized'}`];
          const filled = (parseFloat(line.amount) || 0) > 0;
          return (
            <div key={line.id} className={`rmw-line ${filled ? 'is-filled' : ''}`} style={{ '--rmw-cat': c?.color || 'var(--border-strong)' }}>
              <div className="rmw-line-info">
                <span className="rmw-line-cat">
                  <span className="rmw-line-emoji" aria-hidden="true">{c?.icon || '•'}</span>
                  <span className="rmw-line-name">{c?.name || line.label || 'Ligne'}</span>
                </span>
                {sug && (
                  <button
                    type="button"
                    className="rmw-sug"
                    title={`Moyenne de vos 3 derniers mois : ${EUR0(sug.mean)}`}
                    onClick={() => updateLine(line.id, { amount: sug.mean })}
                  >
                    ≈ {EUR0(sug.mean)} · utiliser
                  </button>
                )}
              </div>
              <div className="rmw-amount">
                <input
                  className="rmw-amount-input"
                  type="number" inputMode="decimal" step="1"
                  value={line.amount}
                  onChange={e => updateLine(line.id, { amount: e.target.value })}
                  placeholder="0"
                />
                <span className="rmw-eur">€</span>
              </div>
              <button className="rmw-del" onClick={() => removeLine(line.id)} aria-label="Supprimer la ligne">
                <Trash2 size={15}/>
              </button>
            </div>
          );
        })}
        <div className="rmw-add">
          <RefMonthAddCategory kind={kind} cats={cats} onAdd={(catId) => addLine({ kind, category_id: catId })}/>
        </div>
      </div>
    );
  };

  const current = WIZARD_STEPS[step];
  const isRecap = current.kind === null;

  return (
    <div className="modal-backdrop rm-backdrop" onClick={handleClose}>
      <div className="modal rmw" onClick={e => e.stopPropagation()} role="dialog" aria-label="Configurer mon mois type">

        {/* En-tête : titre + fermeture */}
        <div className="rmw-head">
          <div className="rmw-head-titles">
            <span className="rmw-eyebrow">Mois type · {scopeLabel}</span>
            <h2 className="rmw-title">{current.title}</h2>
            <p className="rmw-sub">{current.sub}</p>
          </div>
          <button className="ds-icon-btn rmw-close" onClick={handleClose} aria-label="Fermer"><X size={18}/></button>
        </div>

        {/* Barre de progression segmentée — cliquable */}
        <div className="rmw-steps" role="tablist">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.short}
              role="tab"
              aria-selected={i === step}
              className={`rmw-step ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}
              style={{ '--rmw-acc': s.accent }}
              onClick={() => goTo(i)}
            >
              <span className="rmw-step-dot">{i < step ? <Check size={12}/> : i + 1}</span>
              <span className="rmw-step-label">{s.short}</span>
            </button>
          ))}
        </div>

        {/* Corps animé — re-monté à chaque step (clé) → slide+fade */}
        <div className="rmw-body" key={step} data-dir={dir} style={{ '--rmw-acc': current.accent }}>
          {!isRecap ? (
            <>
              {/* Chemin facile : remplir depuis l'historique (idempotent) */}
              <button className="rmw-magic" onClick={resyncAll}>
                <RotateCcw size={15}/>
                <span>Remplir depuis mes 3 derniers mois</span>
              </button>
              {renderKindLines(current.kind)}
            </>
          ) : (
            <div className="rmw-recap">
              <div className={`rmw-sankey-status ${totals.balance < 0 ? 'is-neg' : 'is-pos'}`}>
                {totals.balance < 0
                  ? <>⚠ Déficit de <strong>{EUR0(-totals.balance)}</strong> — dépenses + épargne dépassent les revenus.</>
                  : <>Vous dégagez <strong>{EUR0(totals.balance)}</strong> de reste à vivre chaque mois.</>}
              </div>
              <MoisTypeBudgetSankey grouped={grouped} catFor={catFor}/>
              <div className="rmw-recap-grid">
                <div><span className="ds-micro">Entrées</span><span className="num pos">{EUR0(totals.income)}</span></div>
                <div><span className="ds-micro">Dépenses</span><span className="num neg">−{EUR0(totals.expense)}</span></div>
                <div><span className="ds-micro">Épargne</span><span className="num">−{EUR0(totals.saving)}</span></div>
                <div className="rmw-recap-bal">
                  <span className="ds-micro">Reste à vivre</span>
                  <span className={`num ${totals.balance >= 0 ? 'pos' : 'neg'}`}>{totals.balance >= 0 ? '+' : ''}{EUR0(totals.balance)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pied : navigation */}
        <div className="rmw-foot">
          <button className="rmw-nav rmw-nav--prev" onClick={goPrev} disabled={step === 0}>
            <ArrowLeft size={15}/> Précédent
          </button>
          <span className="rmw-foot-counter">{step + 1} / {WIZARD_STEPS.length}</span>
          {!isRecap ? (
            <button className="rmw-nav rmw-nav--next" onClick={goNext} style={{ '--rmw-acc': current.accent }}>
              Suivant <ArrowRight size={15}/>
            </button>
          ) : (
            <button className="rmw-nav rmw-nav--save" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : <>Enregistrer <Check size={15}/></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MoisTypeBudgetSankey — le VRAI Sankey (recharts), comme Cashflow : chaque
// source de revenu → hub « Budget » → chaque poste de dépense + épargne +
// reste à vivre. Construit depuis les catégories du mois type.
// ──────────────────────────────────────────────────────────────────────
const RecapSankeyNode = React.memo(function RecapSankeyNode({ x, y, width, height, index, payload }) {
  const isLeft = payload.kind === 'income';
  const isHub = payload.kind === 'hub';
  const color = payload.color
    || (isHub ? 'var(--accent)' : payload.kind === 'saving' ? 'var(--accent)' : payload.kind === 'rest' ? 'var(--positive)' : 'var(--negative)');
  const val = payload.value
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(payload.value))
    : '';
  return (
    <Layer key={`n-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} radius={[2, 2, 2, 2]} fill={color} fillOpacity={isHub ? 0.95 : 0.85} stroke="none"/>
      {!isHub && (
        <text
          textAnchor={isLeft ? 'end' : 'start'}
          x={isLeft ? x - 8 : x + width + 8}
          y={y + height / 2} dy={4}
          fontSize={11.5} fill="var(--ink)"
        >
          {payload.name}{val ? ` · ${val}` : ''}
        </text>
      )}
      {isHub && (
        <text textAnchor="middle" x={x + width / 2} y={y - 7} fontSize={10.5} fill="var(--ink-3)">Budget</text>
      )}
    </Layer>
  );
});

function MoisTypeBudgetSankey({ grouped, catFor }) {
  const { nodes, links, empty } = useMemo(() => {
    const incByCat = {}, expByCat = {};
    let saving = 0;
    for (const g of grouped) {
      const sum = g.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
      if (sum <= 0) continue;
      if (g.kind === 'income') incByCat[g.category_id] = (incByCat[g.category_id] || 0) + sum;
      else if (g.kind === 'saving') saving += sum;
      else expByCat[g.category_id] = (expByCat[g.category_id] || 0) + sum;
    }
    const incEntries = Object.entries(incByCat).sort((a, b) => b[1] - a[1]);
    const expEntries = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
    const totalInc = incEntries.reduce((s, [, v]) => s + v, 0);
    const totalExp = expEntries.reduce((s, [, v]) => s + v, 0);
    const reste = totalInc - totalExp - saving;
    if (totalInc <= 0) return { empty: true };

    const N = [], L = [];
    incEntries.forEach(([slug]) => { const c = catFor(slug); N.push({ name: c?.name || slug, color: c?.color || 'var(--positive)', kind: 'income' }); });
    const hub = N.length; N.push({ name: 'Budget', kind: 'hub' });
    expEntries.forEach(([slug]) => { const c = catFor(slug); N.push({ name: c?.name || slug, color: c?.color || 'var(--negative)', kind: 'expense' }); });
    let savIdx = null, restIdx = null;
    if (saving > 0) { savIdx = N.length; N.push({ name: 'Épargne', color: 'var(--accent)', kind: 'saving' }); }
    if (reste > 0) { restIdx = N.length; N.push({ name: 'Reste à vivre', color: 'var(--positive)', kind: 'rest' }); }
    incEntries.forEach((e, i) => L.push({ source: i, target: hub, value: e[1] }));
    expEntries.forEach((e, i) => L.push({ source: hub, target: hub + 1 + i, value: e[1] }));
    if (savIdx != null) L.push({ source: hub, target: savIdx, value: saving });
    if (restIdx != null) L.push({ source: hub, target: restIdx, value: reste });
    return { nodes: N, links: L };
  }, [grouped, catFor]);

  if (empty) {
    return <div className="rmw-sankey-empty">Renseignez vos <strong>entrées</strong> pour voir votre flux se dessiner.</div>;
  }

  const rightCount = links.filter(l => typeof l.source === 'number').length; // approx
  const rows = Math.max(nodes.filter(n => n.kind === 'income').length, nodes.filter(n => ['expense', 'saving', 'rest'].includes(n.kind)).length);
  const height = Math.min(440, Math.max(240, rows * 38));

  return (
    <div className="rmw-realsankey">
      <ResponsiveContainer width="100%" height={height}>
        <Sankey
          data={{ nodes, links }}
          nodePadding={16}
          nodeWidth={11}
          linkCurvature={0.5}
          iterations={64}
          node={<RecapSankeyNode/>}
          link={{ stroke: 'none', fill: 'var(--accent)', fillOpacity: 0.16 }}
          margin={{ top: 14, right: 150, bottom: 14, left: 120 }}
        >
          <Tooltip
            formatter={(v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)}
            contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MoisTypeSankey — mini-flux live « Revenus → Dépenses / Épargne / Reste ».
// SVG fait main (1 source → 3 cibles) : se redessine à chaque keystroke via
// `totals`. Pas de recharts (capricieux dans un petit espace) — rubans bézier
// proportionnels, robustes aux cas limites (revenus=0, déficit).
// ──────────────────────────────────────────────────────────────────────
function MoisTypeSankey({ totals, fmt }) {
  const income = Math.max(0, totals.income || 0);
  const expense = Math.max(0, totals.expense || 0);
  const saving = Math.max(0, totals.saving || 0);
  const rest = income - expense - saving;          // peut être négatif (déficit)

  // État vide : pas encore d'entrées → invite douce, pas de flux.
  if (income <= 0) {
    return (
      <div className="rm-sankey rm-sankey--empty">
        <span>Renseignez vos <strong>entrées</strong> pour voir votre flux mensuel se dessiner.</span>
      </div>
    );
  }

  // Montants ronds (pas de centimes) — un flux veut des chiffres lisibles.
  const eur0 = (v) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(Math.round(v));

  // Géométrie : gouttières dédiées aux labels (gauche + droite) pour qu'AUCUN
  // texte ne soit coupé et que les labels ne chevauchent jamais les barres.
  const W = 560, H = 150, padV = 12;
  const BAR_W = 12;
  const GUT_L = 86;             // gouttière labels gauche (Revenus + montant)
  const GUT_R = 152;            // gouttière labels droite
  const LB_X = GUT_L;          // x de la barre Revenus
  const RB_X = W - GUT_R - BAR_W;
  const flowL = LB_X + BAR_W;
  const flowR = RB_X;
  const cx = (flowL + flowR) / 2;
  const usable = H - 2 * padV;

  const scale = Math.max(income, expense + saving, 1);
  const px = (v) => (v / scale) * usable;

  const hIncome = px(income);
  const leftTop = padV + (usable - hIncome) / 2;
  const incomeCy = leftTop + hIncome / 2;

  const segs = [
    { key: 'expense', label: 'Dépenses',      val: expense,           color: 'var(--negative)' },
    { key: 'saving',  label: 'Épargne',       val: saving,            color: 'var(--accent)' },
    { key: 'rest',    label: 'Reste à vivre', val: Math.max(0, rest), color: 'var(--positive)' },
  ].filter(s => s.val > 0);

  const rightTotalH = segs.reduce((s, x) => s + px(x.val), 0);
  let lY = leftTop;
  let rY = padV + (usable - rightTotalH) / 2;
  const bands = segs.map(s => {
    const h = px(s.val);
    const b = { ...s, h, lY, rY, cy: rY + h / 2 };
    lY += h; rY += h;
    return b;
  });

  return (
    <div className="rm-sankey">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Flux du mois type">
        {/* Rubans */}
        {bands.map(b => {
          const d = `M ${flowL},${b.lY} C ${cx},${b.lY} ${cx},${b.rY} ${flowR},${b.rY} `
                  + `L ${flowR},${b.rY + b.h} C ${cx},${b.rY + b.h} ${cx},${b.lY + b.h} ${flowL},${b.lY + b.h} Z`;
          return <path key={b.key} d={d} fill={b.color} fillOpacity="0.20"/>;
        })}

        {/* Barre Revenus (gauche) + labels dans la gouttière gauche */}
        <rect x={LB_X} y={leftTop} width={BAR_W} height={hIncome} rx="3" fill="var(--accent)"/>
        <text x={LB_X - 12} y={incomeCy - 3} textAnchor="end" className="rm-sankey-lbl" fill="var(--ink-2)" fontSize="11">Revenus</text>
        <text x={LB_X - 12} y={incomeCy + 13} textAnchor="end" className="rm-sankey-val" fill="var(--ink)" fontSize="13" fontWeight="600">{eur0(income)}</text>

        {/* Barres cibles (droite) + labels dans la gouttière droite */}
        {bands.map(b => (
          <g key={`r-${b.key}`}>
            <rect x={RB_X} y={b.rY} width={BAR_W} height={b.h} rx="3" fill={b.color}/>
            <text x={RB_X + BAR_W + 12} y={b.cy - 3} className="rm-sankey-lbl" fill="var(--ink-2)" fontSize="11">{b.label}</text>
            <text x={RB_X + BAR_W + 12} y={b.cy + 13} className="rm-sankey-val" fill="var(--ink)" fontSize="12.5" fontWeight="600">{eur0(b.val)}</text>
          </g>
        ))}
      </svg>

      {/* Bandeau état : équilibré / déficit */}
      <div className={`rm-sankey-status ${rest < 0 ? 'is-neg' : 'is-pos'}`}>
        {rest < 0
          ? <>⚠ Déficit de <strong>{eur0(-rest)}</strong> — dépenses + épargne dépassent les revenus.</>
          : <>Vous dégagez <strong>{eur0(rest)}</strong> de reste à vivre chaque mois.</>}
      </div>
    </div>
  );
}

// "Ajouter une sous-ligne" inside a parent group.
// If the parent has sub-categories, shows a dropdown filtered to its children.
// If not (leaf category), adds a new line with the parent category directly.
function RefMonthAddSubLine({ kind, parentCatId, categories, onAdd }) {
  const [open, setOpen] = useState(false);
  const subCats = categories.filter(c => c.parent === parentCatId);

  const handleClick = () => {
    if (subCats.length === 0) {
      onAdd(parentCatId);
    } else {
      setOpen(true);
    }
  };

  if (!open) return (
    <button className="rm-add-sub" onClick={handleClick}>
      <Plus size={12}/> Ajouter une sous-ligne
    </button>
  );

  return (
    <div className="rm-add-sub-form">
      <CategoryDropdown
        value=""
        categories={subCats}
        onChange={(catId) => { if (catId) { onAdd(catId); setOpen(false); } }}
        placeholder="Choisir une sous-catégorie…"
        searchable clearable={false} align="left"
      />
      <button className="ds-btn ghost sm" onClick={() => setOpen(false)}>Annuler</button>
    </div>
  );
}

// Single CategoryDropdown for adding a new category line. Much simpler than
// the old dual-select approach — one picker, one Ajouter button.
function RefMonthAddCategory({ kind, cats, onAdd }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  if (!open) return (
    <button className="rm-add-cat" onClick={() => setOpen(true)}>
      <Plus size={14}/> Ajouter une catégorie
    </button>
  );

  return (
    <div className="rm-add-cat-form">
      <CategoryDropdown
        value={selectedId}
        categories={cats}
        onChange={setSelectedId}
        placeholder="Choisir une catégorie…"
        grouped searchable clearable={false} align="left"
      />
      <button className="ds-btn primary sm" disabled={!selectedId}
        onClick={() => { if (selectedId) { onAdd(selectedId); setOpen(false); setSelectedId(''); } }}>
        Ajouter
      </button>
      <button className="ds-btn ghost sm" onClick={() => { setOpen(false); setSelectedId(''); }}>
        Annuler
      </button>
    </div>
  );
}
