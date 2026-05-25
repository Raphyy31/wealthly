// ============================================================================
// PostSyncReviewModal — modale qui s'ouvre après une sync GoCardless ayant
// importé au moins une nouvelle transaction. Permet à l'utilisateur de vérifier
// (et corriger d'un clic) la catégorie attribuée automatiquement à chacune.
//
// Pattern :
//   - Header Newsreader italic sur le nombre de nouvelles tx
//   - Liste compacte : date · libellé · montant · compte · Combobox catégorie
//   - Badge "à vérifier" si catégorie absente / 'uncategorized' / cat_source
//     === 'unknown' (cas où ni payee, ni règle, ni learning n'a matché)
//   - CTA "Tout valider" → POST /transactions/mark-reviewed avec tous les ids
//   - "Plus tard" → ferme sans marquer (les tx restent review_status='pending')
//
// La modification de catégorie en ligne réutilise la fonction
// updateTransactionCategory existante de WealthlyApp (passée en prop).
// ============================================================================
import { useMemo, useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';
import { Combobox } from './Combobox.jsx';
import { formatDate, formatCurrency } from '../utils.js';
import * as api from '../api.js';

export function PostSyncReviewModal({
  open,
  onClose,
  transactions,      // tx complètes (mappées txFromApi) à reviewer
  categories,        // [{ id|slug, name, icon, parent_slug, type }]
  accounts,
  onUpdateCategory,  // (txId, categorySlug) => Promise<void>
  onAfterValidate,   // () => void  → reload côté parent après "Tout valider"
}) {
  const [busy, setBusy] = useState(false);

  // Options Combobox groupées par catégorie parente — même hiérarchie que
  // Transactions.jsx pour cohérence visuelle. Slug servant d'id côté frontend.
  const categoryOptions = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0) return [];
    const parents = categories.filter(c => !c.parent_slug && !c.parent);
    const opts = [];
    parents.forEach(parent => {
      const parentSlug = parent.slug || parent.id;
      const parentName = parent.name || parentSlug;
      // Le parent lui-même reste sélectionnable (catégorie de premier niveau).
      opts.push({
        value: parentSlug,
        label: parent.icon ? `${parent.icon}  ${parentName}` : parentName,
        group: parentName,
      });
      categories
        .filter(c => (c.parent_slug || c.parent) === parentSlug)
        .forEach(child => {
          const childSlug = child.slug || child.id;
          const childName = child.name || childSlug;
          opts.push({
            value: childSlug,
            label: child.icon ? `${child.icon}  ${childName}` : childName,
            group: parentName,
          });
        });
    });
    return opts;
  }, [categories]);

  const isUncertain = (tx) => {
    const cat = tx.categoryId;
    if (!cat || cat === 'uncategorized') return true;
    if (tx.catSource === 'unknown' || tx.catSource === null) return true;
    return false;
  };

  const uncertainCount = transactions.filter(isUncertain).length;

  const handleValidateAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ids = transactions.map(t => t.id).filter(Boolean);
      if (ids.length > 0) {
        await api.transactions.markReviewed(ids);
      }
      onAfterValidate?.();
      onClose?.();
    } catch (err) {
      // Best-effort : on ferme quand même, l'utilisateur retrouvera les tx
      // marquées 'pending' dans la prochaine sync.
      console.error('[PostSyncReviewModal] mark-reviewed failed', err);
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  if (!transactions || transactions.length === 0) return null;

  return (
    <ResponsiveModal open={open} onClose={onClose} className="post-sync-review-modal">
      <div className="modal-header">
        <h2 style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {transactions.length} <em style={{ fontStyle: 'italic', fontFamily: 'Newsreader, serif', fontWeight: 400 }}>
            nouvelle{transactions.length > 1 ? 's' : ''} transaction{transactions.length > 1 ? 's' : ''}.
          </em>
        </h2>
        <button className="icon-btn" onClick={onClose} title="Fermer" type="button">
          <X size={18}/>
        </button>
      </div>

      <div className="modal-body" style={{ padding: '4px 0 0' }}>
        <p
          style={{
            margin: '0 20px 14px',
            fontSize: 12.5,
            color: 'var(--ink-2)',
            lineHeight: 1.45,
          }}
        >
          Vérifie la catégorie attribuée automatiquement à chaque opération. Tu peux la
          corriger en un clic — l'apprentissage retiendra ta préférence pour la prochaine fois.
          {uncertainCount > 0 && (
            <>
              {' '}
              <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                {uncertainCount} ligne{uncertainCount > 1 ? 's' : ''} à vérifier en priorité.
              </span>
            </>
          )}
        </p>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {transactions.map(tx => {
            const acc = accounts?.find(a => a.id === tx.accountId);
            const uncertain = isUncertain(tx);
            const amountColor = tx.amount < 0 ? 'var(--ink)' : 'var(--positive)';
            return (
              <div
                key={tx.id}
                className="post-sync-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto 180px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: uncertain ? 'color-mix(in srgb, var(--warning) 4%, transparent)' : undefined,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {tx.label || '(sans libellé)'}
                    {uncertain && (
                      <span
                        title="Catégorie incertaine — vérifie avant de valider"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--warning)',
                          background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                          flexShrink: 0,
                        }}
                      >
                        <AlertCircle size={10}/> à vérifier
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {formatDate(tx.date)} · {acc?.name || 'Compte'}
                    {tx.payeeName && <> · <span style={{ fontStyle: 'italic' }}>{tx.payeeName}</span></>}
                  </div>
                </div>

                <div
                  className="w-num"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: amountColor,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatCurrency(tx.amount)}
                </div>

                <Combobox
                  options={categoryOptions}
                  value={tx.categoryId || ''}
                  onChange={(slug) => onUpdateCategory?.(tx.id, slug)}
                  placeholder="Catégorie…"
                  width={180}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="modal-footer"
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          className="ds-btn ghost"
          onClick={onClose}
          disabled={busy}
          type="button"
        >
          Plus tard
        </button>
        <button
          className="ds-btn primary"
          onClick={handleValidateAll}
          disabled={busy}
          type="button"
        >
          <CheckCircle2 size={14}/>
          {busy ? 'Validation…' : `Tout valider${transactions.length > 1 ? ` (${transactions.length})` : ''}`}
        </button>
      </div>
    </ResponsiveModal>
  );
}
