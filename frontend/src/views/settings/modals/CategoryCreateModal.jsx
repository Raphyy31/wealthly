// Source: Settings.jsx lines 1748-1824 — CategoryCreateModal
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

const CATEGORY_PALETTE = [
  '#2540D9', '#136D3E', '#B0392B', '#8E641A',
  '#7E5A9B', '#C76A8A', '#6B7280', '#0F766E',
  '#A16207', '#9333EA', '#0EA5E9', '#DC2626',
];
const COMMON_ICONS = ['🏷️', '🛒', '🍽️', '🚗', '🏠', '💡', '📱', '🎬', '🎵', '🏥', '🎁', '✈️', '🎓', '👶', '💼', '💰', '☕', '🐶', '🎨', '🛠️'];

export function CategoryCreateModal({ parent, parentName, forcedType, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    name: '',
    color: CATEGORY_PALETTE[0],
    icon: COMMON_ICONS[0],
    type: forcedType || 'expense',
    kind: 'needs',
    parent_slug: parent || null,
  });
  const canSave = draft.name.trim().length >= 2;

  return (
    <ResponsiveModal open={true} onClose={onCancel}>
        <div className="modal-header">
          <h2>{parent ? <>Nouveau <em>détail</em></> : <>Nouvelle <em>catégorie</em></>}</h2>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {parent && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Rattaché à <strong style={{ color: 'var(--ink)' }}>{parentName}</strong></div>
          )}
          <label>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nom</span>
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder={parent ? 'ex : Vacances été' : 'ex : Mes loisirs'}
              autoFocus
              style={{ width: '100%' }}
            />
          </label>

          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Icône</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COMMON_ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setDraft({ ...draft, icon: ic })}
                  style={{ width: 30, height: 30, fontSize: 16, borderRadius: 6, border: '1px solid ' + (draft.icon === ic ? 'var(--accent)' : 'var(--border)'), background: draft.icon === ic ? 'var(--accent-soft)' : 'var(--bg-elev)', cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Couleur</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORY_PALETTE.map(co => (
                <button key={co} type="button" onClick={() => setDraft({ ...draft, color: co })}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: draft.color === co ? '3px solid var(--ink)' : '1px solid var(--border)', background: co, cursor: 'pointer' }}/>
              ))}
            </div>
          </div>

          {!parent && !forcedType && (
            <label>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Type</span>
              <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} style={{ width: '100%' }}>
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
                <option value="transfer">Virement</option>
              </select>
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>Annuler</button>
          <button className="primary-btn" disabled={!canSave} onClick={() => onSave(draft)}>
            <Check size={14}/> Créer
          </button>
        </div>
      </ResponsiveModal>
  );
}
