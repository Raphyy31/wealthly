// Source: Settings.jsx lines 1827-2050 — PayeesSection
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Edit3, Trash2, X, AlertCircle, Activity } from 'lucide-react';
import * as api from '../../../api.js';

export function PayeesSection({ categories, showToast }) {
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [mergeSrc, setMergeSrc] = useState(null);
  const toast = showToast || (() => {});

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.payees.list();
      setPayees(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return payees;
    return payees.filter(p => p.name.toLowerCase().includes(q));
  }, [payees, search]);

  const onRename = async (id, name) => {
    try {
      await api.payees.update(id, { name });
      toast(`Renommé en « ${name} »`, 'success');
      setPayees(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      setEditingId(null);
    } catch (err) {
      toast(err.message || 'Renommage impossible', 'error');
    }
  };

  const onToggleTransfer = async (p) => {
    try {
      const next = !p.is_transfer;
      await api.payees.update(p.id, { is_transfer: next });
      toast(next ? '↔ Marqué comme virement interne' : 'Statut transfert retiré', 'success');
      setPayees(prev => prev.map(x => x.id === p.id ? { ...x, is_transfer: next } : x));
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    }
  };

  const onSetDefaultCat = async (p, slug) => {
    try {
      await api.payees.update(p.id, { default_category_slug: slug });
      toast('Catégorie par défaut mise à jour', 'success');
      await refresh();
    } catch (err) {
      toast(err.message || 'Mise à jour impossible', 'error');
    }
  };

  const onDelete = async (p) => {
    if (!window.confirm(`Supprimer « ${p.name} » ? Les transactions liées seront détachées de ce marchand mais conservent leur catégorie.`)) return;
    try {
      await api.payees.delete(p.id);
      toast(`« ${p.name} » supprimé`, 'success');
      setPayees(prev => prev.filter(x => x.id !== p.id));
    } catch (err) {
      toast(err.message || 'Suppression impossible', 'error');
    }
  };

  const onMerge = async (targetId) => {
    if (!mergeSrc || mergeSrc.id === targetId) return;
    try {
      await api.payees.merge(targetId, mergeSrc.id);
      toast(`« ${mergeSrc.name} » fusionné dans le marchand cible`, 'success');
      setMergeSrc(null);
      await refresh();
    } catch (err) {
      toast(err.message || 'Fusion impossible', 'error');
    }
  };

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h3><Sparkles size={16} style={{ color: 'var(--accent)' }}/> Marchands canoniques</h3>
        <span className="card-meta">{payees.length} marchand{payees.length > 1 ? 's' : ''}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 640 }}>
        Le moteur crée automatiquement un marchand pour chaque enseigne reconnue (Uber, Franprix, MAIF…). Toutes les variantes de libellé (« FRANPRIX LEVALLOIS P », « FRANPRIX 5 RUE… ») pointent dessus.
        Renomme ou fusionne pour requalifier en un seul endroit.
      </p>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/> {error}
        </div>
      )}

      <input
        type="text"
        placeholder="Filtrer les marchands…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      {mergeSrc && (
        <div style={{ padding: 10, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 6, fontSize: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Fusion : sélectionne le marchand cible pour absorber « <strong>{mergeSrc.name}</strong> » →</span>
          <button onClick={() => setMergeSrc(null)} className="icon-btn-sm" style={{ color: 'inherit' }}>
            <X size={14}/>
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-mini"><Activity size={20}/><p>Chargement…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-mini">
          <Sparkles size={22}/>
          <p>{payees.length === 0 ? 'Aucun marchand encore — importe des transactions pour que le moteur en crée.' : 'Aucun marchand ne correspond à la recherche.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(p => {
            const isEditing = editingId === p.id;
            const isMergeTarget = mergeSrc && mergeSrc.id !== p.id;
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: isMergeTarget ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid ' + (isMergeTarget ? 'var(--accent)' : 'var(--border)'),
                  cursor: isMergeTarget ? 'pointer' : 'default',
                }}
                onClick={isMergeTarget ? () => onMerge(p.id) : undefined}
              >
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={p.name}
                    autoFocus
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) onRename(p.id, v); else setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, fontSize: 13, fontWeight: 500 }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                )}
                {p.is_transfer && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ↔ Virement
                  </span>
                )}
                {p.created_by && p.created_by !== 'user' && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-elev)', color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p.created_by === 'builtin' ? 'Auto' : p.created_by}
                  </span>
                )}
                {!isMergeTarget && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="icon-btn-sm" title="Renommer" onClick={() => setEditingId(p.id)}>
                      <Edit3 size={13}/>
                    </button>
                    <button className="icon-btn-sm" title={p.is_transfer ? 'Retirer le statut virement' : 'Marquer comme virement interne'} onClick={() => onToggleTransfer(p)}>
                      ↔
                    </button>
                    <button className="icon-btn-sm" title="Fusionner avec un autre marchand…" onClick={() => setMergeSrc(p)}>
                      ⇆
                    </button>
                    <button className="icon-btn-sm" title="Supprimer" onClick={() => onDelete(p)}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="settings-footnote" style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-3)' }}>
        Tu peux fusionner deux marchands (variantes d'une même enseigne) via le bouton ⇆ — les transactions de la source sont réassignées à la cible.
      </p>
    </section>
  );
}
