// Source: Settings.jsx lines 1140-1389 — CustomRulesSection
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Sparkles, AlertCircle, Activity } from 'lucide-react';
import * as api from '../../../api.js';
import { CategoryDropdown } from '../../../components/CategoryDropdown.jsx';

export function CustomRulesSection({ categories }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPattern, setNewPattern] = useState('');
  const [newTopId, setNewTopId] = useState('');     // niveau 1 (Catégorie)
  const [newSubId, setNewSubId] = useState('');     // niveau 2 (Détail, optionnel)
  const [submitting, setSubmitting] = useState(false);
  const [rulesFilter, setRulesFilter] = useState('all'); // all | user | learning | transfer

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.rules.list();
      setRules(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      setError(err.message || t('settings.rules.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  // All expense + transfer cats, top-level + subs. Both pickers (Catégorie
  // and Détail) show this same grouped list ; the linked-pick logic below
  // keeps them in sync.
  const pickerCats = useMemo(
    () => categories.filter((c) => c.id !== 'uncategorized' && c.type !== 'income'),
    [categories]
  );
  // Linked picker handler — picking a sub-cat in either dropdown auto-fills
  // the parent ; picking a top-level resets the détail.
  const resolveLink = (slug) => {
    if (!slug) return { top: '', sub: '' };
    const cat = categories.find(c => (c.id || c.slug) === slug);
    if (!cat) return { top: '', sub: '' };
    const parent = cat.parent || cat.parent_slug;
    return parent ? { top: parent, sub: slug } : { top: slug, sub: '' };
  };
  const onPickCat = (slug) => { const r = resolveLink(slug); setNewTopId(r.top); setNewSubId(r.sub); };
  const targetSlug = newSubId || newTopId;

  const onAdd = async (e) => {
    e.preventDefault();
    if (!newPattern.trim() || !targetSlug) return;
    try {
      setSubmitting(true);
      // Validate the regex client-side first — fail fast with a clear message.
      try { new RegExp(newPattern, 'i'); } catch (re) {
        setError(t('settings.rules.invalidRegex', { message: re.message }));
        setSubmitting(false);
        return;
      }
      await api.rules.create({ pattern: newPattern.trim(), category_slug: targetSlug });
      setNewPattern('');
      setNewTopId('');
      setNewSubId('');
      setError(null);
      await refresh();
    } catch (err) {
      setError(err.message || t('settings.rules.addFail'));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm(t('confirms.deleteRule'))) return;
    try {
      await api.rules.delete(id);
      await refresh();
    } catch (err) {
      setError(err.message || t('settings.rules.deleteFail'));
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3><Sparkles size={16}/> {t('settings.rules.cardTitle')}</h3>
        <span className="card-meta">{t('settings.rules.rules', { count: rules.length })}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        {t('settings.rules.lead')}
      </p>

      {/* Add form — pattern + niveau 1 (Catégorie) + niveau 2 (Détail, optionnel) */}
      <form onSubmit={onAdd} style={{ display: 'grid', gap: 8, marginBottom: 16, gridTemplateColumns: 'minmax(180px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr) auto' }}>
        <input
          type="text"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          placeholder={t('settings.rules.patternPh')}
          style={{ minWidth: 0 }}
        />
        <CategoryDropdown
          value={newTopId}
          categories={pickerCats}
          onChange={onPickCat}
          placeholder="Catégorie"
          grouped
          clearable={false}
          showParentInChip={false}
        />
        <CategoryDropdown
          value={newSubId}
          categories={pickerCats}
          onChange={onPickCat}
          placeholder="Détail (optionnel)"
          grouped
          emptyLabel="Aucun détail"
        />
        <button
          type="submit"
          className="ds-btn primary"
          disabled={submitting || !newPattern.trim() || !targetSlug}
        >
          <Plus size={14}/> {t('actions.add')}
        </button>
      </form>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-mini"><Activity size={20}/><p>{t('actions.loading')}</p></div>
      ) : rules.length === 0 ? (
        <div className="empty-mini">
          <Sparkles size={22}/>
          <p>{t('settings.rules.emptyRules')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Filtre par provenance (Manuelle / Apprise / Intégrée) */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            {[
              { v: 'all', label: `Toutes (${rules.length})` },
              { v: 'user', label: `Manuelles (${rules.filter(r => (r.created_by || 'user') === 'user').length})` },
              { v: 'learning', label: `🧠 Apprises (${rules.filter(r => r.created_by === 'learning').length})` },
              { v: 'transfer', label: `↔ Virement (${rules.filter(r => r.rule_type === 'transfer').length})` },
            ].map(opt => (
              <button
                key={opt.v}
                className={`tx-sort-btn ${rulesFilter === opt.v ? 'active' : ''}`}
                onClick={() => setRulesFilter(opt.v)}
                style={{ fontSize: 11 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rules.filter(r => {
            if (rulesFilter === 'all') return true;
            if (rulesFilter === 'transfer') return r.rule_type === 'transfer';
            return (r.created_by || 'user') === rulesFilter;
          }).map((r) => {
            const slug = r.category_slug || r.categoryId;
            const cat = categories.find((c) => c.id === slug);
            const parentCat = cat?.parent ? categories.find((c) => c.id === cat.parent) : null;
            const cb = r.created_by || 'user';
            const isTransferRule = r.rule_type === 'transfer';
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.pattern}
                >
                  /{r.pattern}/i
                </code>
                {/* Badge provenance : Manuelle / 🧠 Apprise / Intégrée */}
                {cb !== 'user' && (
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: cb === 'learning' ? '#E7E0F7' : 'var(--bg-elev)',
                    color: cb === 'learning' ? '#7B57C6' : 'var(--ink-3)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {cb === 'learning' ? '🧠 Apprise' : cb === 'builtin' ? 'Intégrée' : cb}
                  </span>
                )}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: isTransferRule ? 'var(--accent-soft)' : (cat?.color || '#999') + '22',
                    color: isTransferRule ? 'var(--accent)' : (cat?.color || 'var(--text-secondary)'),
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isTransferRule
                    ? <>↔ Virement interne</>
                    : (parentCat
                        ? <>{parentCat.icon} {parentCat.name} <span style={{ opacity: 0.6 }}>›</span> {cat.icon} {cat.name}</>
                        : <>{cat?.icon} {cat?.name || slug}</>)}
                </span>
                <button className="icon-btn-sm" onClick={() => onDelete(r.id)} title={t('actions.delete')}>
                  <Trash2 size={13}/>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="settings-footnote" dangerouslySetInnerHTML={{ __html: t('settings.rules.footnote') }} />
    </section>
  );
}
