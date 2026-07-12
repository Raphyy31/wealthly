// Source: Settings.jsx lines 1748-1824 — CategoryCreateModal
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

const CATEGORY_PALETTE = [
  '#0E7C56', '#136D3E', '#B0392B', '#8E641A',
  '#7E5A9B', '#C76A8A', '#6B7280', '#0F766E',
  '#A16207', '#9333EA', '#0EA5E9', '#DC2626',
];
const COMMON_ICONS = ['🏷️', '🛒', '🍽️', '🚗', '🏠', '💡', '📱', '🎬', '🎵', '🏥', '🎁', '✈️', '🎓', '👶', '💼', '💰', '☕', '🐶', '🎨', '🛠️'];

export function CategoryCreateModal({ parent, parentName, forcedType, initial = null, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    name: initial?.name || '',
    color: initial?.color || CATEGORY_PALETTE[0],
    icon: initial?.icon || COMMON_ICONS[0],
    type: initial?.type || forcedType || 'expense',
    kind: initial?.kind || 'needs',
    parent_slug: parent || null,
  });
  const isEditing = !!initial;
  const canSave = draft.name.trim().length >= 2;

  return (
    <ResponsiveModal open={true} onClose={onCancel} className="category-editor-modal">
        <div className="modal-header">
          <div>
            <span className="category-editor-eyebrow">{parent ? `Dans ${parentName}` : 'Organisation des opérations'}</span>
            <h2>{isEditing ? <>Modifier <em>{initial.name}</em></> : parent ? <>Nouveau <em>détail</em></> : <>Nouvelle <em>catégorie</em></>}</h2>
          </div>
          <button className="icon-btn" onClick={onCancel}><X size={18}/></button>
        </div>
        <div className="modal-body category-editor-body">
          <div className="category-editor-preview">
            <span className="category-editor-preview-icon" style={{ background: `${draft.color}1f`, color: draft.color }}>{draft.icon}</span>
            <span>
              <strong>{draft.name.trim() || (parent ? 'Nom du détail' : 'Nom de la catégorie')}</strong>
              <small>{parent ? `Détail de ${parentName}` : draft.type === 'income' ? 'Revenu' : draft.type === 'transfer' ? 'Virement' : 'Dépense'}</small>
            </span>
          </div>

          <label className="category-editor-field">
            <span>Nom</span>
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder={parent ? 'ex : Vacances été' : 'ex : Mes loisirs'}
              autoFocus
            />
          </label>

          <div className="category-editor-appearance">
          <div className="category-editor-choice">
            <span>Icône</span>
            <div className="category-icon-grid">
              {COMMON_ICONS.map(ic => (
                <button key={ic} type="button" className={draft.icon === ic ? 'is-active' : ''} onClick={() => setDraft({ ...draft, icon: ic })} aria-label={`Icône ${ic}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="category-editor-choice">
            <span>Couleur</span>
            <div className="category-color-grid">
              {CATEGORY_PALETTE.map(co => (
                <button key={co} type="button" className={draft.color === co ? 'is-active' : ''} onClick={() => setDraft({ ...draft, color: co })} style={{ '--category-swatch': co }} aria-label={`Couleur ${co}`}/>
              ))}
            </div>
          </div>
          </div>

          {!parent && !forcedType && (
            <label className="category-editor-field">
              <span>Type d’opération</span>
              <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
                <option value="transfer">Virement</option>
              </select>
            </label>
          )}

          {draft.type === 'expense' && (
            <div className="category-budget-role">
              <span>Rôle dans le budget <small>pour la répartition 50 / 30 / 20</small></span>
              <div className="category-budget-options">
                {[
                  ['needs', 'Besoin', 'Dépense essentielle'],
                  ['wants', 'Envie', 'Dépense plaisir'],
                  ['savings', 'Épargne', 'Argent mis de côté'],
                ].map(([value, label, description]) => (
                  <button key={value} type="button" className={draft.kind === value ? 'is-active' : ''} onClick={() => setDraft({ ...draft, kind: value })}>
                    <strong>{label}</strong><small>{description}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="ds-btn" onClick={onCancel}>Annuler</button>
          <button className="ds-btn primary" disabled={!canSave} onClick={() => onSave(draft)}>
            <Check size={14}/> {isEditing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </ResponsiveModal>
  );
}
