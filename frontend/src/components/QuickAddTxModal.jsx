// QuickAddTxModal — FAB quick-add transaction modal (mobile-first)
// Collects: date, type (income/expense), amount, label, account.
// Calls createTransaction from WealthlyApp data layer.
import { useState } from 'react';
import { X, Check, TrendingUp, TrendingDown } from 'lucide-react';

export function QuickAddTxModal({ accounts = [], createTransaction, onClose }) {
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState('expense'); // 'income' | 'expense'
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const canSave = amount !== '' && parseFloat(amount) > 0 && label.trim() && accountId;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const signed = type === 'expense'
      ? -Math.abs(parseFloat(amount))
      : Math.abs(parseFloat(amount));
    const ok = await createTransaction({
      accountId,
      amount: signed,
      date,
      label: label.trim(),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="qadd-overlay" onClick={onClose} />

      {/* Sheet */}
      <div className="qadd-sheet" role="dialog" aria-modal="true" aria-label="Ajouter une transaction">
        {/* Drag handle */}
        <div className="qadd-handle" />

        <div className="qadd-header">
          <span className="qadd-title">Nouvelle transaction</span>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={16}/></button>
        </div>

        {/* Type toggle */}
        <div className="qadd-type-row">
          <button
            className={`qadd-type-btn ${type === 'expense' ? 'active expense' : ''}`}
            onClick={() => setType('expense')}
          >
            <TrendingDown size={15}/> Dépense
          </button>
          <button
            className={`qadd-type-btn ${type === 'income' ? 'active income' : ''}`}
            onClick={() => setType('income')}
          >
            <TrendingUp size={15}/> Revenu
          </button>
        </div>

        <div className="qadd-body">
          {/* Amount — prominent */}
          <div className="qadd-amount-row">
            <span className={`qadd-amount-sign ${type === 'expense' ? 'neg' : 'pos'}`}>
              {type === 'expense' ? '−' : '+'}
            </span>
            <input
              className="qadd-amount-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
            />
            <span className="qadd-amount-currency">€</span>
          </div>

          {/* Label */}
          <label className="qadd-field">
            <span>Libellé</span>
            <input
              type="text"
              placeholder="Ex. Courses Carrefour"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); }}
              maxLength={200}
            />
          </label>

          {/* Date */}
          <label className="qadd-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>

          {/* Account */}
          {accounts.length > 1 && (
            <label className="qadd-field">
              <span>Compte</span>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="qadd-footer">
          <button className="ds-btn" onClick={onClose}>Annuler</button>
          <button
            className="ds-btn primary"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Enregistrement…' : <><Check size={14}/> Enregistrer</>}
          </button>
        </div>
      </div>
    </>
  );
}
