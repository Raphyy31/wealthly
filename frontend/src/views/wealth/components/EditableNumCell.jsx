// ============================================================================
// EditableNumCell — displays a formatted value, becomes an input on focus.
// onCommit(newValue) called on blur or Enter if the value changed.
// Escape cancels. Disabled if no callback or cell is live-priced.
// Extracted from Wealth.jsx lines 2775-2824.
// ============================================================================
import { useState } from 'react';

export function EditableNumCell({ value, format, onCommit, disabled, className = '', title }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const startEdit = () => {
    if (disabled) return;
    // Représentation FR éditable : virgule décimale, pas d'espace
    const s = value == null ? '' : String(value).replace('.', ',');
    setDraft(s);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(String(draft).replace(',', '.').replace(/\s/g, ''));
    if (!Number.isFinite(parsed) || parsed === value) return;
    onCommit?.(parsed);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className={`cell-r inv-v3-edit-cell ${className}`}>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          onFocus={(e) => e.target.select()}
        />
      </div>
    );
  }
  return (
    <div
      className={`cell-r num ${className} ${disabled ? '' : 'inv-v3-editable'}`}
      onClick={startEdit}
      title={title || (disabled ? '' : 'Cliquer pour modifier')}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startEdit(); } }}
    >
      {format ? format(value) : value}
    </div>
  );
}
