// Source: Settings.jsx lines 1619-1745 — MyCategoriesSection
import { useState, useMemo, useCallback } from 'react';
import { Sparkles, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import * as api from '../../../api.js';
import { CategoryCreateModal } from '../modals/CategoryCreateModal.jsx';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';

export function MyCategoriesSection({ categories, reloadCategories, onCategoryCreated, onCategoryDeleted, showToast }) {
  const [creating, setCreating] = useState(null); // null | { parent: string|null }
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const toast = showToast || (() => {}); // safe fallback if not wired

  const topCats = useMemo(
    () => categories.filter(c => !c.parent && c.id !== 'uncategorized'),
    [categories]
  );

  const onDelete = async (slug, label) => {
    if (!window.confirm(`Supprimer « ${label} » ? Les transactions et règles liées seront détachées.`)) return;
    try {
      setBusyId(slug);
      await api.categories.delete(slug);
      // Optimistic local update — instant UI feedback, no wait for refetch.
      if (onCategoryDeleted) onCategoryDeleted(slug);
      toast(`« ${label} » supprimée`, 'success');
      // Background safety re-sync (no await, doesn't block UI).
      if (reloadCategories) reloadCategories();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
      toast(err.message || 'Suppression impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onCreate = async (draft) => {
    try {
      const created = await api.categories.create({
        name: draft.name,
        color: draft.color,
        icon: draft.icon,
        type: draft.type,
        kind: draft.kind,
        parent_slug: draft.parent_slug || null,
      });
      // Optimistic local update FIRST so the new chip pops in instantly.
      if (onCategoryCreated && created) onCategoryCreated(created);
      setCreating(null);
      setError(null);
      const kindLabel = draft.parent_slug ? 'Détail' : 'Catégorie';
      toast(`${kindLabel} « ${created?.name || draft.name} » créé${draft.parent_slug ? '' : 'e'}`, 'success');
      // Background safety re-sync (no await, doesn't block UI).
      if (reloadCategories) reloadCategories();
    } catch (err) {
      setError(err.message || 'Création impossible');
      toast(err.message || 'Création impossible', 'error');
    }
  };

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h3><Sparkles size={16} style={{ color: 'var(--accent)' }}/> Mes catégories</h3>
        <button className="ds-btn" onClick={() => setCreating({ parent: null })}>
          <Plus size={14}/> Catégorie
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        Ajoutez vos propres catégories (niveau 1) et leurs détails (niveau 2). Les transactions et règles peuvent ensuite cibler n'importe lequel des deux niveaux.
      </p>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/> {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topCats.map(top => {
          const subs = categories.filter(c => c.parent === top.id);
          return (
            <div key={top.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{top.icon}</span>
                <strong style={{ flex: 1, fontSize: 13.5 }}>{top.name}</strong>
                <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-elev)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {top.type === 'income' ? 'Revenu' : top.type === 'transfer' ? 'Virement' : 'Dépense'}
                </span>
                <button className="icon-btn-sm" title="Ajouter un détail" onClick={() => setCreating({ parent: top.id, parentName: top.name, type: top.type })}>
                  <Plus size={13}/>
                </button>
                <BusyButton className="icon-btn-sm" iconOnly spinnerSize={12} title="Supprimer" onClick={() => onDelete(top.id, top.name)}>
                  <Trash2 size={13}/>
                </BusyButton>
              </div>
              {subs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: 26 }}>
                  {subs.map(sub => (
                    <span key={sub.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-elev)', border: '1px solid var(--border)', fontSize: 12 }}>
                      {sub.icon} {sub.name}
                      <BusyButton className="icon-btn-sm" iconOnly spinnerSize={10} style={{ padding: 2 }} onClick={() => onDelete(sub.id, sub.name)}>
                        <X size={11}/>
                      </BusyButton>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <CategoryCreateModal
          parent={creating.parent}
          parentName={creating.parentName}
          forcedType={creating.type}
          onSave={onCreate}
          onCancel={() => setCreating(null)}
        />
      )}
    </section>
  );
}
