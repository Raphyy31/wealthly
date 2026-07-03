// ============================================================================
// AddTransactionModal — saisie manuelle d'une transaction (2026-07-03).
//
// Comble le trou du flow « Compte manuel » : le formulaire promettait
// « saisissez le solde et les transactions à la main » mais aucune UI
// n'existait. Champs : type (dépense/revenu), montant, libellé, compte,
// date, catégorie (auto-suggérée via le même moteur regex que l'import CSV
// — règles custom incluses — avec override manuel), et « Ajouter une autre »
// pour enchaîner les saisies (tickets, espèces…).
//
// La création passe par YotoriApp.createTransaction → POST /transactions
// (dedup + résolution catégorie côté backend).
// ============================================================================
import { useMemo, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';
import { Combobox } from './Combobox.jsx';
import { ChipSelect } from './ChipSelect.jsx';
import { categorize } from '../utils.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AddTransactionModal({ accounts = [], categories = [], customRules = [], defaultAccountId = null, onSave, onClose }) {
  const [type, setType] = useState('expense');          // expense | income
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [manualCat, setManualCat] = useState(null);     // slug choisi explicitement, sinon suggestion
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);  // feedback bref après « Ajouter une autre »

  const signedAmount = useMemo(() => {
    const a = Math.abs(parseFloat(String(amount).replace(',', '.')) || 0);
    return type === 'expense' ? -a : a;
  }, [amount, type]);

  // Même moteur que l'import CSV : règles custom (apprises + user) puis
  // règles builtin. Ne suggère que si le libellé matche quelque chose.
  const suggestedSlug = useMemo(() => {
    if (!label.trim()) return null;
    const slug = categorize({ label, amount: signedAmount }, customRules);
    return slug !== 'uncategorized' ? slug : null;
  }, [label, signedAmount, customRules]);

  const effectiveCat = manualCat ?? suggestedSlug ?? '';

  const catName = (slug) => {
    const c = categories.find(x => x.id === slug);
    return c ? c.name : slug;
  };

  const categoryOptions = useMemo(() => {
    const parentName = (c) => {
      const ps = c.parent || c.parent_slug;
      if (!ps) return null;
      const p = categories.find(x => x.id === ps);
      return p ? p.name : null;
    };
    const toOption = (c) => ({
      value: c.id,
      label: parentName(c) ? `${parentName(c)} · ${c.name}` : c.name,
      icon: c.icon || undefined,
      group: c.type === 'income' ? 'Revenus' : 'Dépenses',
    });
    const incomes = categories.filter(c => c.type === 'income').map(toOption);
    const expenses = categories.filter(c => c.type !== 'income').map(toOption);
    // Groupe cohérent avec le type saisi : dépenses en premier si type=expense.
    return type === 'income' ? [...incomes, ...expenses] : [...expenses, ...incomes];
  }, [categories, type]);

  const accountOptions = useMemo(() => accounts.map(a => ({
    value: a.id,
    label: a.name || a.bank || 'Compte',
    meta: a.bank && a.name !== a.bank ? a.bank : undefined,
  })), [accounts]);

  const valid = accountId && label.trim().length > 0 && Math.abs(signedAmount) > 0 && date;

  const buildPayload = () => ({
    accountId,
    amount: signedAmount,
    date,
    label: label.trim(),
    // Seul un choix EXPLICITE voyage (catégorie « verrouillée » : le learning
    // et les règles ne la réécriront pas). Sans choix, on n'envoie rien : le
    // moteur canonique serveur décide (payees + règles apprises + builtin) —
    // la suggestion locale n'est qu'un aperçu indicatif.
    categorySlug: manualCat || undefined,
    isManualCategory: manualCat !== null,
  });

  const submit = async (keepOpen) => {
    if (!valid || saving) return;
    setSaving(true);
    const created = await onSave(buildPayload());
    setSaving(false);
    if (!created) return; // erreur déjà toastée par createTransaction
    if (!keepOpen) { onClose(); return; }
    // « Ajouter une autre » : on garde compte + date + type, on vide le reste.
    setAmount('');
    setLabel('');
    setManualCat(null);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <ResponsiveModal open onClose={onClose} className="add-tx-modal" title="Ajouter une transaction">
      <div className="modal-header">
        <h2 style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 600 }}>Ajouter une <em>transaction.</em></h2>
        <button type="button" className="icon-btn" onClick={onClose} title="Fermer" aria-label="Fermer"><X size={18}/></button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Type</label>
            <ChipSelect
              value={type}
              onChange={(v) => { setType(v); setManualCat(null); }}
              options={[
                { value: 'expense', label: 'Dépense' },
                { value: 'income', label: 'Revenu' },
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Montant (€) *</label>
              <input
                className="form-input num"
                type="number" min="0" step="0.01" inputMode="decimal"
                placeholder="42,50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input
                className="form-input"
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Libellé *</label>
            <input
              className="form-input"
              placeholder="ex: Boulangerie, Loyer juillet, Remboursement Léa…"
              value={label}
              maxLength={500}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Compte *</label>
            <Combobox
              options={accountOptions}
              value={accountId}
              onChange={setAccountId}
              placeholder="Choisir un compte…"
            />
          </div>

          <div>
            <label className="form-label">Catégorie</label>
            <Combobox
              options={categoryOptions}
              value={effectiveCat}
              onChange={(v) => setManualCat(v)}
              placeholder="Automatique (selon le libellé)"
            />
            {suggestedSlug && manualCat === null && (
              <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                Aperçu : <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{catName(suggestedSlug)}</span> — affiné à l'enregistrement par le moteur (marchands connus, règles apprises). Choisissez ci-dessus pour verrouiller.
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {savedFlash && (
            <span style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--positive)' }}>
              <Check size={13}/> Transaction ajoutée
            </span>
          )}
          <button type="button" className="ds-btn" onClick={onClose} disabled={saving}>Annuler</button>
          <button
            type="button"
            className="ds-btn"
            onClick={() => submit(true)}
            disabled={!valid || saving}
            title="Enregistre puis garde le formulaire ouvert (compte et date conservés)"
          >
            <Plus size={14}/> Ajouter une autre
          </button>
          <button type="submit" className="ds-btn primary" disabled={!valid || saving}>
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
