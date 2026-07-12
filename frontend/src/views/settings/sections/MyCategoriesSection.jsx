import { useMemo, useState } from 'react';
import { ChevronDown, Layers3, Lock, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import * as api from '../../../api.js';
import { DEFAULT_CATEGORIES } from '../../../constants.js';
import { CategoryCreateModal } from '../modals/CategoryCreateModal.jsx';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';

const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map((category) => category.id));
const FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'expense', label: 'Dépenses' },
  { id: 'income', label: 'Revenus' },
  { id: 'transfer', label: 'Virements' },
  { id: 'custom', label: 'Personnalisées' },
];
const KIND_LABELS = { needs: 'Besoin', wants: 'Envie', savings: 'Épargne' };

export function MyCategoriesSection({
  categories,
  transactions = [],
  reloadCategories,
  onCategoryCreated,
  onCategoryUpdated,
  onCategoryDeleted,
  showToast,
}) {
  const [creating, setCreating] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(new Set());
  const toast = showToast || (() => {});

  const childrenByParent = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => {
      if (!category.parent) return;
      if (!map.has(category.parent)) map.set(category.parent, []);
      map.get(category.parent).push(category);
    });
    map.forEach((children) => children.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    return map;
  }, [categories]);

  const usageByCategory = useMemo(() => {
    const counts = new Map();
    transactions.forEach((transaction) => {
      if (transaction.categoryId) counts.set(transaction.categoryId, (counts.get(transaction.categoryId) || 0) + 1);
    });
    return counts;
  }, [transactions]);

  const topCategories = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return categories
      .filter((category) => !category.parent && category.id !== 'uncategorized')
      .filter((category) => {
        if (filter === 'custom') {
          const children = childrenByParent.get(category.id) || [];
          if (DEFAULT_IDS.has(category.id) && !children.some((child) => !DEFAULT_IDS.has(child.id))) return false;
        } else if (filter !== 'all' && category.type !== filter) return false;
        if (!query) return true;
        return category.name.toLocaleLowerCase('fr').includes(query)
          || (childrenByParent.get(category.id) || []).some((child) => child.name.toLocaleLowerCase('fr').includes(query));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [categories, childrenByParent, filter, search]);

  const toggleExpanded = (id) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const transactionCount = (category) => {
    const direct = usageByCategory.get(category.id) || 0;
    if (category.parent) return direct;
    return direct + (childrenByParent.get(category.id) || []).reduce((sum, child) => sum + (usageByCategory.get(child.id) || 0), 0);
  };

  const onDelete = async (category) => {
    if (DEFAULT_IDS.has(category.id)) return;
    const affected = transactionCount(category);
    const detail = affected ? ` ${affected} transaction${affected > 1 ? 's' : ''} seront à reclasser.` : '';
    if (!window.confirm(`Supprimer « ${category.name} » ?${detail}`)) return;
    try {
      await api.categories.delete(category.id);
      onCategoryDeleted?.(category.id);
      toast(`« ${category.name} » supprimée`, 'success');
      reloadCategories?.();
    } catch (error) {
      toast(error.message || 'Suppression impossible', 'error');
    }
  };

  const onCreate = async (draft) => {
    try {
      const created = await api.categories.create(draft);
      onCategoryCreated?.(created);
      setCreating(null);
      if (draft.parent_slug) setExpanded((current) => new Set(current).add(draft.parent_slug));
      toast(`« ${created?.name || draft.name} » ajouté${draft.parent_slug ? '' : 'e'}`, 'success');
      reloadCategories?.();
    } catch (error) {
      toast(error.message || 'Création impossible', 'error');
    }
  };

  const onUpdate = async (draft) => {
    try {
      const updated = await api.categories.update(editing.id, {
        name: draft.name,
        color: draft.color,
        icon: draft.icon,
        kind: draft.kind,
      });
      onCategoryUpdated?.(updated);
      setEditing(null);
      toast(`« ${updated?.name || draft.name} » mis à jour`, 'success');
      reloadCategories?.();
    } catch (error) {
      toast(error.message || 'Modification impossible', 'error');
    }
  };

  return (
    <section className="card settings-categories">
      <div className="card-header settings-categories-header">
        <div>
          <h3><Layers3 size={17}/> Catégories et sous-catégories</h3>
          <p>Organisez vos transactions et le ratio 50 / 30 / 20 depuis un seul endroit.</p>
        </div>
        <button className="ds-btn primary" onClick={() => setCreating({ parent: null })}>
          <Plus size={14}/> Nouvelle catégorie
        </button>
      </div>

      <div className="settings-categories-tools">
        <label className="settings-categories-search">
          <Search size={15}/>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une catégorie ou un détail…"/>
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Effacer la recherche"><X size={13}/></button>}
        </label>
        <div className="settings-categories-filters" aria-label="Filtrer les catégories">
          {FILTERS.map((item) => (
            <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      <div className="settings-category-summary">
        <span><strong>{topCategories.length}</strong> catégories affichées</span>
        <span><strong>{categories.filter((category) => category.parent).length}</strong> sous-catégories au total</span>
        <span><Sparkles size={12}/> Les éléments « Inclus » sont modifiables, mais protégés contre la suppression.</span>
      </div>

      {topCategories.length === 0 ? (
        <div className="settings-categories-empty">
          <Search size={20}/><strong>Aucun résultat</strong><span>Essayez un autre mot ou affichez toutes les catégories.</span>
        </div>
      ) : (
        <div className="settings-category-list">
          {topCategories.map((category) => {
            const children = childrenByParent.get(category.id) || [];
            const isOpen = !!search || expanded.has(category.id);
            const isDefault = DEFAULT_IDS.has(category.id);
            const customChildren = children.filter((child) => !DEFAULT_IDS.has(child.id)).length;
            return (
              <article className="settings-category-group" key={category.id}>
                <div className="settings-category-parent">
                  <button className="settings-category-expand" onClick={() => toggleExpanded(category.id)} aria-expanded={isOpen}>
                    <span className="settings-category-icon" style={{ background: `${category.color}20`, color: category.color }}>{category.icon}</span>
                    <span className="settings-category-copy">
                      <strong>{category.name}</strong>
                      <small>{children.length} sous-catégorie{children.length > 1 ? 's' : ''}{customChildren ? ` · ${customChildren} personnalisée${customChildren > 1 ? 's' : ''}` : ''}</small>
                    </span>
                    <span className={`settings-category-kind is-${category.kind}`}>{category.type === 'income' ? 'Revenu' : category.type === 'transfer' ? 'Virement' : KIND_LABELS[category.kind] || 'Dépense'}</span>
                    <span className="settings-category-usage">{transactionCount(category)} opération{transactionCount(category) > 1 ? 's' : ''}</span>
                    <ChevronDown size={16} className={isOpen ? 'is-open' : ''}/>
                  </button>
                  <div className="settings-category-actions">
                    <button className="icon-btn-sm" onClick={() => setEditing(category)} title="Modifier"><Pencil size={13}/></button>
                    <button className="ds-btn sm" onClick={() => setCreating({ parent: category.id, parentName: category.name, type: category.type })}><Plus size={12}/> Sous-catégorie</button>
                    {!isDefault && <BusyButton className="icon-btn-sm" iconOnly title="Supprimer" onClick={() => onDelete(category)}><Trash2 size={13}/></BusyButton>}
                  </div>
                </div>

                {isOpen && (
                  <div className="settings-subcategory-list">
                    {children.length === 0 ? (
                      <button className="settings-subcategory-empty" onClick={() => setCreating({ parent: category.id, parentName: category.name, type: category.type })}>
                        <Plus size={13}/> Ajouter un premier détail à « {category.name} »
                      </button>
                    ) : children.map((child) => {
                      const childDefault = DEFAULT_IDS.has(child.id);
                      return (
                        <div className="settings-subcategory-row" key={child.id}>
                          <span className="settings-subcategory-icon">{child.icon}</span>
                          <span className="settings-subcategory-name">{child.name}</span>
                          <span className={`settings-category-kind is-${child.kind}`}>{KIND_LABELS[child.kind] || child.type}</span>
                          <span className="settings-category-usage">{transactionCount(child)} opération{transactionCount(child) > 1 ? 's' : ''}</span>
                          {childDefault && <span className="settings-category-protected"><Lock size={11}/> Inclus</span>}
                          <div className="settings-subcategory-actions">
                            <button className="icon-btn-sm" onClick={() => setEditing(child)} title="Modifier"><Pencil size={12}/></button>
                            {!childDefault && <BusyButton className="icon-btn-sm" iconOnly title="Supprimer" onClick={() => onDelete(child)}><Trash2 size={12}/></BusyButton>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {creating && <CategoryCreateModal
        parent={creating.parent}
        parentName={creating.parentName}
        forcedType={creating.type}
        onSave={onCreate}
        onCancel={() => setCreating(null)}
      />}
      {editing && <CategoryCreateModal
        parent={editing.parent}
        parentName={categories.find((category) => category.id === editing.parent)?.name}
        forcedType={editing.type}
        initial={editing}
        onSave={onUpdate}
        onCancel={() => setEditing(null)}
      />}
    </section>
  );
}
